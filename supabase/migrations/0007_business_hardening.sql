-- Additive hardening. Existing published payroll and employee data stay unchanged.
-- Preserve v1 implementations in a non-exposed schema, then guard their entrypoints.
do $migration$
declare f record; definition text;
begin
  for f in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'leave_balance','update_employee','update_own_contact','create_leave_request',
      'decide_leave_request','upsert_performance_review','update_account',
      'update_payroll_item','publish_payroll_run','attendance_check_in','attendance_check_out')
  loop
    -- Do not replace preserved implementations when this migration is retried.
    if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='private' and p.proname=f.proname || '_v1') then
      definition := replace(pg_get_functiondef(f.oid),
        'FUNCTION public.' || f.proname || '(', 'FUNCTION private.' || f.proname || '_v1(');
      execute definition;
    end if;
  end loop;
end $migration$;

create or replace function private.require_version(p_version integer) returns void
language plpgsql set search_path='' as $$
begin
  if p_version is null or p_version < 1 then raise exception 'VALIDATION_ERROR'; end if;
end $$;

-- One organization-wide HR lock also serializes last-HR checks and salary publication.
create or replace function private.lock_hr_write() returns void
language plpgsql set search_path='' as $$
begin
  perform pg_advisory_xact_lock(740701001::bigint);
  if not private.is_hr() then raise exception 'FORBIDDEN'; end if;
end $$;

create or replace function public.employee_compensation_for_hr(p_employee_id uuid)
returns bigint language plpgsql stable security definer set search_path='' as $$
declare salary bigint;
begin
  if not private.is_hr() then raise exception 'FORBIDDEN'; end if;
  select base_salary_idr into salary from private.employee_compensation where employee_id=p_employee_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  return salary;
end $$;

create or replace function public.leave_balance(p_employee uuid,p_year integer)
returns table(year integer,entitlement_days integer,used_days integer,reserved_days integer,available_days integer)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_employee is null then raise exception 'VALIDATION_ERROR'; end if;
  if not private.is_active_actor() or not (private.is_hr() or
    p_employee=private.current_employee_id()) then
    raise exception 'FORBIDDEN';
  end if;
  if p_year is null or p_year not between 2000 and 2100 then raise exception 'VALIDATION_ERROR'; end if;
  return query select * from private.leave_balance_v1(p_employee,p_year);
end $$;

create or replace function public.update_employee(
  p_employee_id uuid,p_expected_version integer,p_full_name text default null,p_work_email text default null,
  p_department_id uuid default null,p_position_id uuid default null,
  p_employment_status public.employment_status default null,p_joined_on date default null,
  p_phone text default null,p_address text default null,p_base_salary_idr bigint default null)
returns public.employees language plpgsql security definer set search_path='' as $$
declare employee public.employees;
begin
  perform private.lock_hr_write();
  perform private.require_version(p_expected_version);
  select * into employee from public.employees where id=p_employee_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if employee.version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if p_work_email is not null and lower(btrim(p_work_email))<>employee.work_email and
    exists(select 1 from public.user_profiles where employee_id=p_employee_id) then
    raise exception 'VALIDATION_ERROR';
  end if;
  if p_employment_status='INACTIVE' and employee.employment_status='ACTIVE' and exists(
    select 1 from public.user_profiles where employee_id=p_employee_id and role='ADMIN_HR' and account_status='ACTIVE') then
    if p_employee_id=private.current_employee_id() or not exists(
      select 1 from public.user_profiles u join public.employees e on e.id=u.employee_id
      where u.role='ADMIN_HR' and u.account_status='ACTIVE' and e.employment_status='ACTIVE' and e.id<>p_employee_id
    ) then raise exception 'FORBIDDEN'; end if;
  end if;
  return private.update_employee_v1(p_employee_id,p_expected_version,p_full_name,p_work_email,
    p_department_id,p_position_id,p_employment_status,p_joined_on,p_phone,p_address,p_base_salary_idr);
end $$;

create or replace function public.update_own_contact(p_expected_version integer,p_phone text,p_address text)
returns public.employee_contacts language plpgsql security definer set search_path='' as $$
begin
  if not private.is_active_actor() then raise exception 'FORBIDDEN'; end if;
  perform private.require_version(p_expected_version);
  -- Same lock order as HR editing: employee, then contact. Avoid AB/BA deadlock.
  perform 1 from public.employees where id=private.current_employee_id() for update;
  return private.update_own_contact_v1(p_expected_version,p_phone,p_address);
end $$;

create or replace function public.attendance_check_in()
returns public.attendances language plpgsql security definer set search_path='' as $$
begin
  if not private.is_active_actor() then raise exception 'FORBIDDEN'; end if;
  perform 1 from public.employees where id=private.current_employee_id() for update;
  return private.attendance_check_in_v1();
end $$;

create or replace function public.attendance_check_out()
returns public.attendances language plpgsql security definer set search_path='' as $$
begin
  if not private.is_active_actor() then raise exception 'FORBIDDEN'; end if;
  perform 1 from public.employees where id=private.current_employee_id() for update;
  return private.attendance_check_out_v1();
end $$;

create or replace function public.create_leave_request(p_type public.leave_type,p_start date,p_end date,p_reason text)
returns public.leave_requests language plpgsql security definer set search_path='' as $$
begin
  if not private.is_active_actor() or private.current_business_role()<>'EMPLOYEE' then raise exception 'FORBIDDEN'; end if;
  if p_type is null or p_start is null or p_end is null or p_reason is null or
    length(btrim(p_reason)) not between 1 and 2000 or extract(year from p_start) not between 2000 and 2100 then
    raise exception 'VALIDATION_ERROR';
  end if;
  -- Covers all leave types and all years; overlap/quota are read AFTER acquiring the lock.
  perform 1 from public.employees where id=private.current_employee_id() for update;
  return private.create_leave_request_v1(p_type,p_start,p_end,p_reason);
end $$;

create or replace function public.decide_leave_request(p_request_id uuid,p_decision public.leave_status,
  p_rejection_reason text,p_expected_version integer)
returns public.leave_requests language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  if not private.is_manager() then raise exception 'FORBIDDEN'; end if;
  perform private.require_version(p_expected_version);
  select l.employee_id into target from public.leave_requests l join public.employees e on e.id=l.employee_id
    where l.id=p_request_id and e.department_id=private.current_department_id() and e.employment_status='ACTIVE';
  if not found then raise exception 'NOT_FOUND'; end if;
  if target=private.current_employee_id() then raise exception 'FORBIDDEN'; end if;
  if p_decision is null then raise exception 'VALIDATION_ERROR'; end if;
  perform 1 from public.employees where id=target for update;
  -- Recheck scope after employee locking (HR may have transferred/deactivated it).
  if not exists(select 1 from public.employees where id=target and
    department_id=private.current_department_id() and employment_status='ACTIVE') then raise exception 'NOT_FOUND'; end if;
  return private.decide_leave_request_v1(p_request_id,p_decision,p_rejection_reason,p_expected_version);
end $$;

create or replace function public.upsert_performance_review(p_employee_id uuid,p_period text,p_score integer,
  p_notes text,p_expected_version integer)
returns public.performance_reviews language plpgsql security definer set search_path='' as $$
begin
  if not private.is_manager() then raise exception 'FORBIDDEN'; end if;
  perform 1 from public.employees where id=p_employee_id and employment_status='ACTIVE'
    and department_id=private.current_department_id() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_score is null or p_period is null or p_notes is null or length(btrim(p_notes)) not between 1 and 2000 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if p_expected_version is not null then
    perform private.require_version(p_expected_version);
    if not exists(select 1 from public.performance_reviews where employee_id=p_employee_id and period=p_period) then
      raise exception 'VERSION_CONFLICT';
    end if;
  end if;
  -- Employee lock serializes both first INSERT and subsequent optimistic UPDATE.
  return private.upsert_performance_review_v1(p_employee_id,p_period,p_score,btrim(p_notes),p_expected_version);
end $$;

create or replace function public.update_account(p_user_id uuid,p_role public.business_role,
  p_account_status public.account_status,p_expected_version integer)
returns public.user_profiles language plpgsql security definer set search_path='' as $$
declare account public.user_profiles;
begin
  perform private.lock_hr_write();
  perform private.require_version(p_expected_version);
  select * into account from public.user_profiles where user_id=p_user_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_account_status='INVITED' and account.account_status<>'INVITED' then raise exception 'VALIDATION_ERROR'; end if;
  if account.account_status='INVITED' and p_account_status='ACTIVE' then raise exception 'VALIDATION_ERROR'; end if;
  if account.role='ADMIN_HR' and account.account_status='ACTIVE' and
    (coalesce(p_role,account.role)<>'ADMIN_HR' or coalesce(p_account_status,account.account_status)<>'ACTIVE') and not exists(
      select 1 from public.user_profiles u join public.employees e on e.id=u.employee_id
      where u.role='ADMIN_HR' and u.account_status='ACTIVE' and e.employment_status='ACTIVE' and u.user_id<>p_user_id
    ) then raise exception 'FORBIDDEN'; end if;
  return private.update_account_v1(p_user_id,p_role,p_account_status,p_expected_version);
end $$;

create or replace function public.update_payroll_item(p_item_id uuid,p_allowance_idr bigint,p_bonus_idr bigint,
  p_deduction_idr bigint,p_expected_version integer)
returns public.payroll_items language plpgsql security definer set search_path='' as $$
declare run_id uuid;
begin
  perform private.lock_hr_write();
  perform private.require_version(p_expected_version);
  if p_allowance_idr is null or p_bonus_idr is null or p_deduction_idr is null then raise exception 'VALIDATION_ERROR'; end if;
  select payroll_run_id into run_id from public.payroll_items where id=p_item_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform 1 from public.payroll_runs where id=run_id for update;
  return private.update_payroll_item_v1(p_item_id,p_allowance_idr,p_bonus_idr,p_deduction_idr,p_expected_version);
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
  if exists(select 1 from public.payroll_items i left join private.employee_compensation c on c.employee_id=i.employee_id
    where i.payroll_run_id=p_run_id and (c.employee_id is null or i.deduction_idr>c.base_salary_idr+i.allowance_idr+i.bonus_idr)) then
    raise exception 'VALIDATION_ERROR';
  end if;
  -- Refresh salary at publication, never mutate an already published run.
  update public.payroll_items i set base_salary_idr=c.base_salary_idr,
    net_salary_idr=c.base_salary_idr+i.allowance_idr+i.bonus_idr-i.deduction_idr
    from private.employee_compensation c where i.employee_id=c.employee_id and i.payroll_run_id=p_run_id;
  return private.publish_payroll_run_v1(p_run_id,p_expected_version);
end $$;

drop policy if exists payroll_runs_read on public.payroll_runs;
create policy payroll_runs_read on public.payroll_runs for select to authenticated using(
  private.is_hr() or (private.is_active_actor() and private.current_business_role()='EMPLOYEE' and status='PUBLISHED' and exists(
    select 1 from public.payroll_items i where i.payroll_run_id=payroll_runs.id and i.employee_id=private.current_employee_id())));
drop policy if exists payroll_items_read on public.payroll_items;
create policy payroll_items_read on public.payroll_items for select to authenticated using(
  private.is_hr() or (private.is_active_actor() and private.current_business_role()='EMPLOYEE' and status='PUBLISHED'
    and employee_id=private.current_employee_id()));

create or replace function public.write_master(p_kind text,p_id uuid,p_name text,p_expected_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row_data jsonb; current_version integer;
begin
  perform private.lock_hr_write();
  if p_kind is null or p_kind not in ('departments','positions') or p_name is null or length(btrim(p_name)) not between 1 and 150 then raise exception 'VALIDATION_ERROR'; end if;
  if p_id is null then
    if p_expected_version is not null then raise exception 'VALIDATION_ERROR'; end if;
    execute format('insert into public.%I(name) values($1) returning to_jsonb(%I.*)',p_kind,p_kind) into row_data using btrim(p_name);
  else
    perform private.require_version(p_expected_version);
    execute format('select version from public.%I where id=$1 for update',p_kind) into current_version using p_id;
    if current_version is null then raise exception 'NOT_FOUND'; end if;
    if current_version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
    execute format('update public.%I set name=$1 where id=$2 returning to_jsonb(%I.*)',p_kind,p_kind) into row_data using btrim(p_name),p_id;
  end if;
  perform private.audit(auth.uid(),'master.write',p_kind,(row_data->>'id')::uuid,jsonb_build_object('name',btrim(p_name)));
  return row_data;
end $$;

-- No direct business writes: all changes must use authorized, versioned, audited RPCs.
revoke all on public.employees,public.employee_contacts,public.user_profiles,public.attendances,
  public.annual_leave_entitlements,public.leave_requests,public.payroll_runs,public.payroll_items,
  public.performance_reviews,public.hr_policy from anon,authenticated;
grant select on public.employees,public.employee_contacts,public.user_profiles,public.attendances,
  public.annual_leave_entitlements,public.leave_requests,public.payroll_runs,public.payroll_items,
  public.performance_reviews,public.hr_policy to authenticated;
revoke all on public.departments,public.positions from anon,authenticated;
grant select on public.departments,public.positions to authenticated;

revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.current_user_id(),private.current_employee_id(),private.current_business_role(),private.current_account_status(),
  private.current_department_id(),private.is_active_actor(),private.is_hr(),private.is_manager() to authenticated;
revoke all on function public.employee_compensation_for_hr(uuid) from public,anon;
grant execute on function public.employee_compensation_for_hr(uuid) to authenticated;
revoke all on function public.write_master(text,uuid,text,integer) from public,anon;
grant execute on function public.write_master(text,uuid,text,integer) to authenticated;
notify pgrst,'reload schema';
