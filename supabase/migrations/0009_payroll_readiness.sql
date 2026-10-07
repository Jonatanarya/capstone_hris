-- Zero salary is an unconfigured draft, not a publishable salary.
-- No existing salaries, payroll items, published history, or users are changed.
do $backup$
declare f record; definition text;
begin
  for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('create_payroll_run','publish_payroll_run','update_payroll_item') loop
    if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='private' and p.proname=f.proname||'_before_readiness') then
      definition:=replace(pg_get_functiondef(f.oid),'FUNCTION public.'||f.proname||'(',
        'FUNCTION private.'||f.proname||'_before_readiness(');
      execute definition;
    end if;
  end loop;
end $backup$;

create or replace function public.payroll_run_readiness(p_run_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare run public.payroll_runs; result jsonb;
begin
  if not private.is_hr() then raise exception 'FORBIDDEN'; end if;
  select * into run from public.payroll_runs where id=p_run_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if run.status='PUBLISHED' then
    return jsonb_build_object('status','PUBLISHED','ready',false,'missingSalaryCount',0,'missingSalaryEmployees','[]'::jsonb,
      'missingItemCount',0,'inactiveItemCount',0,'staleItemCount',0,'invalidDeductionCount',0,
      'itemCount',(select count(*) from public.payroll_items where payroll_run_id=p_run_id),'activeEmployeeCount',0);
  end if;
  with targets as (
    select e.id,e.employee_no,e.full_name,c.base_salary_idr as current_salary,
      i.id as item_id,i.base_salary_idr as draft_salary,i.allowance_idr,i.bonus_idr,i.deduction_idr,
      (i.employee_no,i.full_name,i.department_name,i.position_name) is distinct from (e.employee_no,e.full_name,d.name,p.name) as metadata_stale
    from public.employees e join public.departments d on d.id=e.department_id join public.positions p on p.id=e.position_id
    left join private.employee_compensation c on c.employee_id=e.id
    left join public.payroll_items i on i.employee_id=e.id and i.payroll_run_id=p_run_id
    where e.employment_status='ACTIVE'
  ), missing as (
    select id,employee_no,full_name from targets where coalesce(current_salary,0)<=0 order by full_name,id limit 20
  )
  select jsonb_build_object(
    'status','DRAFT','activeEmployeeCount',count(*),
    'missingSalaryCount',count(*) filter(where coalesce(current_salary,0)<=0),
    'missingSalaryEmployees',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'employeeNo',employee_no,'fullName',full_name)),'[]'::jsonb) from missing),
    'missingItemCount',count(*) filter(where item_id is null),
    'staleItemCount',count(*) filter(where item_id is not null and (current_salary is distinct from draft_salary or metadata_stale)),
    'invalidDeductionCount',count(*) filter(where item_id is not null and deduction_idr>coalesce(current_salary,0)+allowance_idr+bonus_idr),
    'inactiveItemCount',(select count(*) from public.payroll_items i join public.employees e on e.id=i.employee_id
      where i.payroll_run_id=p_run_id and e.employment_status<>'ACTIVE'),
    'itemCount',(select count(*) from public.payroll_items where payroll_run_id=p_run_id)) into result from targets;
  return result||jsonb_build_object('ready',
    (result->>'activeEmployeeCount')::int>0 and (result->>'missingSalaryCount')::int=0
    and (result->>'missingItemCount')::int=0 and (result->>'staleItemCount')::int=0
    and (result->>'inactiveItemCount')::int=0 and (result->>'invalidDeductionCount')::int=0);
end $$;

create or replace function public.sync_payroll_run(p_run_id uuid,p_expected_version integer)
returns public.payroll_runs language plpgsql security definer set search_path='' as $$
declare run public.payroll_runs; added integer; removed integer; refreshed integer;
begin
  perform private.lock_hr_write();
  perform private.require_version(p_expected_version);
  select * into run from public.payroll_runs where id=p_run_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if run.status='PUBLISHED' then raise exception 'PAYROLL_ALREADY_PUBLISHED'; end if;
  if run.version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if exists(select 1 from public.payroll_items i join public.employees e on e.id=i.employee_id
    left join private.employee_compensation c on c.employee_id=e.id where i.payroll_run_id=p_run_id
    and e.employment_status='ACTIVE' and i.deduction_idr>coalesce(c.base_salary_idr,0)+i.allowance_idr+i.bonus_idr) then
    raise exception 'VALIDATION_ERROR';
  end if;
  delete from public.payroll_items i using public.employees e where i.payroll_run_id=p_run_id
    and i.employee_id=e.id and e.employment_status<>'ACTIVE';
  get diagnostics removed=row_count;
  update public.payroll_items i set employee_no=e.employee_no,full_name=e.full_name,
    department_name=d.name,position_name=p.name,base_salary_idr=coalesce(c.base_salary_idr,0),
    net_salary_idr=coalesce(c.base_salary_idr,0)+i.allowance_idr+i.bonus_idr-i.deduction_idr
  from public.employees e join public.departments d on d.id=e.department_id join public.positions p on p.id=e.position_id
    left join private.employee_compensation c on c.employee_id=e.id
  where i.payroll_run_id=p_run_id and i.employee_id=e.id and e.employment_status='ACTIVE'
    and (i.employee_no,i.full_name,i.department_name,i.position_name,i.base_salary_idr)
      is distinct from (e.employee_no,e.full_name,d.name,p.name,coalesce(c.base_salary_idr,0));
  get diagnostics refreshed=row_count;
  insert into public.payroll_items(payroll_run_id,employee_id,employee_no,full_name,department_name,position_name,
    base_salary_idr,allowance_idr,bonus_idr,deduction_idr,net_salary_idr,status)
  select p_run_id,e.id,e.employee_no,e.full_name,d.name,p.name,coalesce(c.base_salary_idr,0),0,0,0,coalesce(c.base_salary_idr,0),'DRAFT'
  from public.employees e join public.departments d on d.id=e.department_id join public.positions p on p.id=e.position_id
    left join private.employee_compensation c on c.employee_id=e.id
  where e.employment_status='ACTIVE' and not exists(select 1 from public.payroll_items i where i.payroll_run_id=p_run_id and i.employee_id=e.id);
  get diagnostics added=row_count;
  update public.payroll_runs set updated_at=now() where id=p_run_id returning * into run;
  perform private.audit(auth.uid(),'payroll.sync','payroll_run',p_run_id,
    jsonb_build_object('added',added,'removedInactive',removed,'refreshed',refreshed));
  return run;
end $$;

create or replace function public.create_payroll_run(p_period text)
returns public.payroll_runs language plpgsql security definer set search_path='' as $$
begin
  perform private.lock_hr_write();
  return private.create_payroll_run_before_readiness(p_period);
end $$;

-- Editing components also invalidates the aggregate run version for publishers.
create or replace function public.update_payroll_item(p_item_id uuid,p_allowance_idr bigint,p_bonus_idr bigint,
  p_deduction_idr bigint,p_expected_version integer)
returns public.payroll_items language plpgsql security definer set search_path='' as $$
declare run_id uuid; item public.payroll_items;
begin
  perform private.lock_hr_write();
  perform private.require_version(p_expected_version);
  select payroll_run_id into run_id from public.payroll_items where id=p_item_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform 1 from public.payroll_runs where id=run_id for update;
  item:=private.update_payroll_item_before_readiness(p_item_id,p_allowance_idr,p_bonus_idr,p_deduction_idr,p_expected_version);
  update public.payroll_runs set updated_at=now() where id=run_id;
  return item;
end $$;

create or replace function public.publish_payroll_run(p_run_id uuid,p_expected_version integer)
returns public.payroll_runs language plpgsql security definer set search_path='' as $$
declare run public.payroll_runs;
begin
  perform private.lock_hr_write();
  perform private.require_version(p_expected_version);
  select * into run from public.payroll_runs where id=p_run_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if run.status='PUBLISHED' then raise exception 'PAYROLL_ALREADY_PUBLISHED'; end if;
  if run.version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if not (public.payroll_run_readiness(p_run_id)->>'ready')::boolean then raise exception 'PAYROLL_NOT_READY'; end if;
  return private.publish_payroll_run_before_readiness(p_run_id,p_expected_version);
end $$;

revoke all on function private.create_payroll_run_before_readiness(text),
  private.publish_payroll_run_before_readiness(uuid,integer),
  private.update_payroll_item_before_readiness(uuid,bigint,bigint,bigint,integer) from public,anon,authenticated;
revoke all on function public.payroll_run_readiness(uuid),public.sync_payroll_run(uuid,integer),
  public.create_payroll_run(text),public.publish_payroll_run(uuid,integer),
  public.update_payroll_item(uuid,bigint,bigint,bigint,integer) from public,anon,authenticated;
grant execute on function public.payroll_run_readiness(uuid),public.sync_payroll_run(uuid,integer),
  public.create_payroll_run(text),public.publish_payroll_run(uuid,integer),
  public.update_payroll_item(uuid,bigint,bigint,bigint,integer) to authenticated;
notify pgrst,'reload schema';
