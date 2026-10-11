-- Share safe, immutable goals separately from confidential draft evaluations.
alter table public.kpi_assessments add column goals_shared_at timestamptz;
create table public.kpi_goal_plans (
  assessment_id uuid primary key references public.kpi_assessments(id),
  employee_id uuid not null references public.employees(id),
  period text not null,
  indicators jsonb not null,
  shared_at timestamptz not null default now(),
  shared_by uuid not null references public.user_profiles(user_id),
  unique(employee_id,period)
);
alter table public.kpi_goal_plans enable row level security;
create policy goals_read on public.kpi_goal_plans for select to authenticated using (
  private.is_active_actor() and (private.is_hr() or employee_id=private.current_employee_id()
    or (private.is_manager() and exists(select 1 from public.employees e
      where e.id=employee_id and e.department_id=private.current_department_id())))
);
revoke all on public.kpi_goal_plans from public,anon,authenticated;
grant select on public.kpi_goal_plans to authenticated;
grant all on public.kpi_goal_plans to service_role;

create function private.can_manage_kpi(p_employee uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.is_active_actor() and p_employee<>private.current_employee_id() and exists (
    select 1 from public.employees e where e.id=p_employee and e.employment_status='ACTIVE' and (
      (private.is_hr() and exists(select 1 from public.user_profiles u where u.employee_id=e.id and u.role='MANAGER' and u.account_status='ACTIVE'))
      or (private.is_manager() and e.department_id=private.current_department_id() and not exists(
        select 1 from public.user_profiles u where u.employee_id=e.id and u.role='MANAGER' and u.account_status='ACTIVE'))))
$$;
create function public.kpi_assessment_targets() returns table(id uuid,name text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not (private.is_hr() or private.is_manager()) then raise exception 'FORBIDDEN'; end if;
  return query select e.id,e.full_name from public.employees e where private.can_manage_kpi(e.id) order by e.full_name,e.id;
end $$;

-- Extend the original validator without weakening its numeric/name rules.
do $$ begin
  execute replace(pg_get_functiondef('private.validate_kpi(jsonb)'::regprocedure),
    'FUNCTION private.validate_kpi(', 'FUNCTION private.validate_kpi_core(');
end $$;
create or replace function private.validate_kpi(p_items jsonb) returns void
language plpgsql set search_path='' as $$
declare item jsonb; stripped jsonb;
begin
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'VALIDATION_ERROR'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item)<>'object' then raise exception 'VALIDATION_ERROR'; end if;
    if (item ? 'measurement' and (jsonb_typeof(item->'measurement')<>'string' or length(item->>'measurement')>1000))
      or (item ? 'evidence' and (jsonb_typeof(item->'evidence')<>'string' or length(item->>'evidence')>1000)) then raise exception 'VALIDATION_ERROR'; end if;
  end loop;
  select coalesce(jsonb_agg(value-'measurement'-'evidence'),'[]'::jsonb) into stripped from jsonb_array_elements(p_items);
  perform private.validate_kpi_core(stripped);
end $$;
create function private.kpi_goal_projection(p_items jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_agg(value-'actual'-'evidence') from jsonb_array_elements(p_items)
$$;

create or replace function public.save_kpi(p_employee_id uuid,p_period text,p_indicators jsonb,p_notes text,p_expected_version integer)
returns public.kpi_assessments language plpgsql security definer set search_path='' as $$
declare existing public.kpi_assessments; result public.kpi_assessments;
begin
  if not (private.is_manager() or private.is_hr()) or p_employee_id=private.current_employee_id() then raise exception 'FORBIDDEN'; end if;
  -- HR may assess Managers only; never ordinary employees.
  if private.is_hr() and not private.can_manage_kpi(p_employee_id) then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(740701001::bigint);
  perform 1 from public.employees where id=p_employee_id for update;
  if not private.can_manage_kpi(p_employee_id) then raise exception 'NOT_FOUND'; end if;
  if p_period is null or p_period !~ '^(20[0-9]{2}|2100)-(0[1-9]|1[0-2])$' or p_notes is null or length(p_notes)>2000 then raise exception 'VALIDATION_ERROR'; end if;
  perform private.validate_kpi(p_indicators);
  select * into existing from public.kpi_assessments where employee_id=p_employee_id and period=p_period for update;
  if found then
    if p_expected_version is null or p_expected_version<>existing.version then raise exception 'VERSION_CONFLICT'; end if;
    if existing.status='PUBLISHED' then raise exception 'KPI_FINALIZED'; end if;
    if existing.goals_shared_at is not null and private.kpi_goal_projection(existing.indicators)<>private.kpi_goal_projection(p_indicators) then raise exception 'VALIDATION_ERROR'; end if;
    update public.kpi_assessments set indicators=p_indicators,notes=btrim(p_notes),version=version+1,updated_at=now() where id=existing.id returning * into result;
  else
    if p_expected_version is not null then raise exception 'VERSION_CONFLICT'; end if;
    insert into public.kpi_assessments(employee_id,period,indicators,notes,created_by) values(p_employee_id,p_period,p_indicators,btrim(p_notes),auth.uid()) returning * into result;
  end if;
  perform private.audit(auth.uid(),'kpi.save','kpi_assessment',result.id,jsonb_build_object('before',to_jsonb(existing),'after',to_jsonb(result)));
  return result;
end $$;

create function public.share_kpi_goals(p_id uuid,p_expected_version integer)
returns public.kpi_assessments language plpgsql security definer set search_path='' as $$
declare existing public.kpi_assessments; result public.kpi_assessments;
begin
  if not (private.is_manager() or private.is_hr()) then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(740701001::bigint);
  select * into existing from public.kpi_assessments where id=p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not private.can_manage_kpi(existing.employee_id) then raise exception 'FORBIDDEN'; end if;
  perform private.require_version(p_expected_version);
  if existing.version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if existing.status='PUBLISHED' or existing.goals_shared_at is not null then raise exception 'KPI_FINALIZED'; end if;
  perform private.validate_kpi(existing.indicators);
  if exists(select 1 from jsonb_array_elements(existing.indicators) i where coalesce(length(btrim(i->>'measurement')),0)=0) then raise exception 'VALIDATION_ERROR'; end if;
  insert into public.kpi_goal_plans(assessment_id,employee_id,period,indicators,shared_by)
    values(existing.id,existing.employee_id,existing.period,private.kpi_goal_projection(existing.indicators),auth.uid());
  update public.kpi_assessments set goals_shared_at=now(),updated_at=now(),version=version+1 where id=p_id returning * into result;
  perform private.audit(auth.uid(),'kpi.share_goals','kpi_assessment',p_id,jsonb_build_object('after',to_jsonb(result)));
  return result;
end $$;

create or replace function public.publish_kpi(p_id uuid,p_expected_version integer,p_expected_review_version integer)
returns public.kpi_assessments language plpgsql security definer set search_path='' as $$
declare existing public.kpi_assessments; result public.kpi_assessments; target uuid; review public.performance_reviews; previous public.performance_reviews; final_score integer;
begin
  if not (private.is_manager() or private.is_hr()) then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(740701001::bigint);
  select employee_id into target from public.kpi_assessments where id=p_id;
  if target is null then raise exception 'NOT_FOUND'; end if;
  if target=private.current_employee_id() then raise exception 'FORBIDDEN'; end if;
  perform 1 from public.employees where id=target for update;
  if not private.can_manage_kpi(target) then raise exception 'FORBIDDEN'; end if;
  select * into existing from public.kpi_assessments where id=p_id for update;
  perform private.require_version(p_expected_version);
  if existing.version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if existing.status='PUBLISHED' then raise exception 'KPI_FINALIZED'; end if;
  perform private.validate_kpi(existing.indicators);
  if existing.goals_shared_at is null or exists(select 1 from jsonb_array_elements(existing.indicators) i where i->>'actual' is null
    or coalesce(length(btrim(i->>'evidence')),0)=0) then raise exception 'VALIDATION_ERROR'; end if;
  select round(sum(least(100::numeric,case when i->>'direction'='HIGHER' then (i->>'actual')::numeric/(i->>'target')::numeric*100
      when (i->>'actual')::numeric=0 then 100 else (i->>'target')::numeric/(i->>'actual')::numeric*100 end)*(i->>'weight')::numeric/100))::integer into final_score from jsonb_array_elements(existing.indicators) i;
  select * into previous from public.performance_reviews where employee_id=target and period=existing.period for update;
  if (previous.id is null and p_expected_review_version is not null) or (previous.id is not null and (p_expected_review_version is null or p_expected_review_version<>previous.version)) then raise exception 'VERSION_CONFLICT'; end if;
  if previous.id is null then
    insert into public.performance_reviews(employee_id,period,score,notes,assessed_by,kpi_id)
      values(target,existing.period,final_score,coalesce(nullif(existing.notes,''),'Nilai final berdasarkan KPI berbobot.'),auth.uid(),existing.id) returning * into review;
  else
    update public.performance_reviews set score=final_score,notes=coalesce(nullif(existing.notes,''),'Nilai final berdasarkan KPI berbobot.'),assessed_by=auth.uid(),assessed_at=now(),kpi_id=existing.id where id=previous.id returning * into review;
  end if;
  perform private.audit(auth.uid(),'performance.upsert','performance_review',review.id,jsonb_build_object('before',to_jsonb(previous),'after',to_jsonb(review)));
  update public.kpi_assessments set status='PUBLISHED',score=final_score,published_at=now(),published_by=auth.uid(),version=version+1,updated_at=now() where id=p_id returning * into result;
  perform private.audit(auth.uid(),'kpi.publish','kpi_assessment',p_id,jsonb_build_object('before',to_jsonb(existing),'after',to_jsonb(result)));
  return result;
end $$;
revoke all on function private.can_manage_kpi(uuid),private.validate_kpi_core(jsonb),private.kpi_goal_projection(jsonb) from public,anon,authenticated;
revoke all on function public.share_kpi_goals(uuid,integer),public.kpi_assessment_targets() from public,anon;
grant execute on function public.share_kpi_goals(uuid,integer),public.kpi_assessment_targets() to authenticated;
-- Retain all existing event types/read receipts, add only the owner's shared goal event.
do $notification$
declare definition text; marker text:='union all select ''review:''';
begin
  definition:=pg_get_functiondef('public.my_notifications()'::regprocedure);
  if position(marker in definition)=0 then raise exception 'NOTIFICATION_MIGRATION_PRECONDITION'; end if;
  execute replace(definition,marker,
    'union all select ''kpi-goals:''||g.assessment_id,''Target KPI tersedia'',g.period||'' · target dan bobot telah dibagikan'',g.shared_at,''kpi''
      from public.kpi_goal_plans g where g.employee_id=private.current_employee_id()
    '||marker);
end $notification$;
notify pgrst,'reload schema';
