-- Revisi dosen: Manager plans, HR operates/evaluates, both monitor monthly.
-- Additive migration. Existing accounts, salaries, final KPI and payroll stay intact.
create or replace function private.can_decide_leave(p_employee uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.is_active_actor() and private.is_hr()
    and p_employee<>private.current_employee_id()
    and exists(select 1 from public.employees where id=p_employee and employment_status='ACTIVE');
$$;

create function private.can_plan_kpi(p_employee uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.is_active_actor() and private.is_manager()
    and p_employee<>private.current_employee_id() and exists (
      select 1 from public.employees e where e.id=p_employee and e.employment_status='ACTIVE'
        and e.department_id=private.current_department_id() and not exists (
          select 1 from public.user_profiles u where u.employee_id=e.id and u.role='MANAGER' and u.account_status='ACTIVE'));
$$;
create or replace function private.can_manage_kpi(p_employee uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.is_active_actor() and private.is_hr()
    and p_employee<>private.current_employee_id()
    and exists(select 1 from public.employees where id=p_employee and employment_status='ACTIVE');
$$;
create or replace function public.kpi_assessment_targets() returns table(id uuid,name text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_active_actor() or not (private.is_hr() or private.is_manager()) then raise exception 'FORBIDDEN'; end if;
  return query select e.id,e.full_name from public.employees e
    where private.can_plan_kpi(e.id) or private.can_manage_kpi(e.id) order by e.full_name,e.id;
end $$;

create or replace function public.save_kpi(p_employee_id uuid,p_period text,p_indicators jsonb,p_notes text,p_expected_version integer)
returns public.kpi_assessments language plpgsql security definer set search_path='' as $$
declare existing public.kpi_assessments; result public.kpi_assessments;
begin
  if not private.is_active_actor() or not (private.is_hr() or private.is_manager())
    or p_employee_id=private.current_employee_id() then raise exception 'FORBIDDEN'; end if;
  if not (private.can_plan_kpi(p_employee_id) or private.can_manage_kpi(p_employee_id)) then raise exception 'NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(740701001::bigint);
  perform 1 from public.employees where id=p_employee_id for update;
  if not (private.can_plan_kpi(p_employee_id) or private.can_manage_kpi(p_employee_id)) then raise exception 'NOT_FOUND'; end if;
  if p_period is null or p_period !~ '^(20[0-9]{2}|2100)-(0[1-9]|1[0-2])$' or p_notes is null or length(p_notes)>2000 then raise exception 'VALIDATION_ERROR'; end if;
  perform private.validate_kpi(p_indicators);
  select * into existing from public.kpi_assessments where employee_id=p_employee_id and period=p_period for update;
  if existing.id is not null then
    if p_expected_version is null or p_expected_version<>existing.version then raise exception 'VERSION_CONFLICT'; end if;
    if existing.status='PUBLISHED' then raise exception 'KPI_FINALIZED'; end if;
  elsif p_expected_version is not null then raise exception 'VERSION_CONFLICT'; end if;
  if private.is_manager() then
    -- Planning only: a Manager cannot submit scores/evidence/assessment notes.
    if (existing.id is not null and existing.goals_shared_at is not null)
      or btrim(p_notes)<>'' or exists(select 1 from jsonb_array_elements(p_indicators) i
        where i->>'actual' is not null or coalesce(btrim(i->>'evidence'),'')<>'') then raise exception 'FORBIDDEN'; end if;
  else
    -- HR cannot create/change targets, including by submitting a new assessment.
    if existing.id is null or existing.goals_shared_at is null then raise exception 'FORBIDDEN'; end if;
    if private.kpi_goal_projection(existing.indicators)<>private.kpi_goal_projection(p_indicators) then raise exception 'VALIDATION_ERROR'; end if;
  end if;
  if existing.id is null then
    insert into public.kpi_assessments(employee_id,period,indicators,notes,created_by)
      values(p_employee_id,p_period,p_indicators,'',auth.uid()) returning * into result;
  else
    update public.kpi_assessments set indicators=p_indicators,notes=btrim(p_notes),version=version+1,updated_at=now()
      where id=existing.id returning * into result;
  end if;
  perform private.audit(auth.uid(),case when private.is_manager() then 'kpi.plan' else 'kpi.save' end,
    'kpi_assessment',result.id,jsonb_build_object('before',to_jsonb(existing),'after',to_jsonb(result)));
  return result;
end $$;

-- Preserve existing version, evidence, audit and atomic publication safeguards.
do $roles$
declare definition text; original text;
begin
  original:=pg_get_functiondef('public.share_kpi_goals(uuid,integer)'::regprocedure);
  definition:=replace(replace(original,
    'if not (private.is_manager() or private.is_hr()) then', 'if not private.is_manager() then'),
    'private.can_manage_kpi(existing.employee_id)', 'private.can_plan_kpi(existing.employee_id)');
  if definition=original then raise exception 'REVISION_SHARE_PRECONDITION'; end if;
  execute definition;
  original:=pg_get_functiondef('public.publish_kpi(uuid,integer,integer)'::regprocedure);
  definition:=replace(original,'if not (private.is_manager() or private.is_hr()) then','if not private.is_hr() then');
  if definition=original then raise exception 'REVISION_PUBLISH_PRECONDITION'; end if;
  execute definition;
end $roles$;

-- Retire manual scoring. Final performance now has one source: published KPI.
create or replace function public.upsert_performance_review(p_employee_id uuid,p_period text,p_score integer,p_notes text,p_expected_version integer)
returns public.performance_reviews language plpgsql security definer set search_path='' as $$
begin
  raise exception 'FORBIDDEN';
end $$;

-- Only artificial applicant records are introduced; no employee/account creation.
create table public.demo_applicants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check(length(btrim(full_name)) between 1 and 150),
  position_name text not null,
  applied_on date not null,
  aptitude_score integer not null check(aptitude_score between 0 and 100),
  technical_score integer not null check(technical_score between 0 and 100),
  interview_score integer not null check(interview_score between 0 and 100),
  notes text not null default '' check(length(notes)<=1000),
  is_dummy boolean not null default true check(is_dummy),
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.demo_applicants enable row level security;
create policy applicants_read on public.demo_applicants for select to authenticated using (
  private.is_active_actor() and (private.is_hr() or private.is_manager())
);
revoke all on public.demo_applicants from public,anon,authenticated;
grant select on public.demo_applicants to authenticated;
grant all on public.demo_applicants to service_role;
insert into public.demo_applicants(full_name,position_name,applied_on,aptitude_score,technical_score,interview_score)
select name,(array['Staff Administrasi','Frontend Developer','Staff Keuangan','Customer Support'])[1+((n-1)%4)],
  date '2026-10-01'+((n-1)%15)::integer,
  45+floor(random()*56)::integer,45+floor(random()*56)::integer,45+floor(random()*56)::integer
from unnest(array['Aditya Pranawa','Nadira Lestari','Bima Hartanto','Alya Maheswari','Raka Permana',
  'Citra Anggraini','Damar Wijaksana','Sekar Puspita','Farhan Kusuma','Intan Paramita',
  'Galih Wicaksana','Ratih Kinasih','Hendra Saputra','Maya Saraswati','Ilham Prasetya',
  'Dewi Larasati','Fajar Mahendra','Nabila Kirana','Reza Firmansyah','Tiara Savitri'])
  with ordinality as names(name,n);
create function public.update_demo_applicant(p_id uuid,p_aptitude integer,p_technical integer,p_interview integer,p_notes text,p_expected_version integer)
returns public.demo_applicants language plpgsql security definer set search_path='' as $$
declare result public.demo_applicants;
begin
  if not private.is_active_actor() or not private.is_hr() then raise exception 'FORBIDDEN'; end if;
  perform private.require_version(p_expected_version);
  if p_aptitude is null or p_technical is null or p_interview is null or p_aptitude not between 0 and 100
    or p_technical not between 0 and 100 or p_interview not between 0 and 100 or p_notes is null or length(p_notes)>1000 then raise exception 'VALIDATION_ERROR'; end if;
  select * into result from public.demo_applicants where id=p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if result.version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  update public.demo_applicants set aptitude_score=p_aptitude,technical_score=p_technical,interview_score=p_interview,
    notes=btrim(p_notes),version=version+1,updated_at=now() where id=p_id returning * into result;
  perform private.audit(auth.uid(),'applicant.update','demo_applicant',p_id,to_jsonb(result));
  return result;
end $$;

-- No payroll/contact data. Manager scope is applied in SQL, not browser filters.
create function public.monthly_performance_report(p_period text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare month_start date; month_end date; today date:=(now() at time zone 'Asia/Jakarta')::date;
  policy public.hr_policy; result jsonb;
begin
  if not private.is_active_actor() or not (private.is_hr() or private.is_manager()) then raise exception 'FORBIDDEN'; end if;
  if p_period is null or p_period !~ '^(20[0-9]{2}|2100)-(0[1-9]|1[0-2])$' then raise exception 'VALIDATION_ERROR'; end if;
  month_start:=(p_period||'-01')::date;
  month_end:=(month_start+interval '1 month'-interval '1 day')::date;
  select * into policy from public.hr_policy where id=1;
  with roster as (
    select e.*,d.name as department_name from public.employees e join public.departments d on d.id=e.department_id
    where (private.is_hr() or e.department_id=private.current_department_id()) and e.joined_on<=month_end
      and (e.employment_status='ACTIVE'
        or exists(select 1 from public.attendances a where a.employee_id=e.id and a.work_date between month_start and month_end)
        or exists(select 1 from public.performance_reviews r where r.employee_id=e.id and r.period=p_period))
  ), days as (
    select e.id,d::date as work_date from roster e
    cross join lateral generate_series(greatest(month_start,e.joined_on)::timestamp,least(month_end,today)::timestamp,interval '1 day') d
    where extract(isodow from d)::integer=any(policy.working_days) and not d::date=any(policy.holiday_dates)
  ), daily as (
    select d.*,a.check_in_at,a.check_out_at,a.status,
      (select l.type from public.leave_requests l where l.employee_id=d.id and l.status='APPROVED'
        and d.work_date between l.start_date and l.end_date order by l.id limit 1) as leave_type
    from days d left join public.attendances a on a.employee_id=d.id and a.work_date=d.work_date
  ), totals as (
    select id,count(*)::integer as work_days,
      count(*) filter(where check_in_at is not null)::integer as present_days,
      count(*) filter(where check_in_at is not null and status='LATE')::integer as late_days,
      count(*) filter(where leave_type='ANNUAL' and check_in_at is null)::integer as annual_leave_days,
      count(*) filter(where leave_type='PERMISSION' and check_in_at is null)::integer as permission_days,
      count(*) filter(where leave_type='SICK' and check_in_at is null)::integer as sick_days,
      count(*) filter(where check_in_at is null and leave_type is null and (work_date<today
        or (now() at time zone 'Asia/Jakarta')::time>=policy.work_end))::integer as absence_days,
      count(*) filter(where check_in_at is not null and check_out_at is null)::integer as incomplete_days
    from daily group by id
  ) select coalesce(jsonb_agg(jsonb_build_object(
      'employeeId',e.id,'employeeNo',e.employee_no,'name',e.full_name,'department',e.department_name,
      'employmentStatus',e.employment_status,'period',p_period,
      'workDays',coalesce(t.work_days,0),'presentDays',coalesce(t.present_days,0),'lateDays',coalesce(t.late_days,0),
      'annualLeaveDays',coalesce(t.annual_leave_days,0),'permissionDays',coalesce(t.permission_days,0),
      'sickDays',coalesce(t.sick_days,0),'absenceDays',coalesce(t.absence_days,0),'incompleteDays',coalesce(t.incomplete_days,0),
      'pendingCorrections',(select count(*) from public.attendance_corrections c where c.employee_id=e.id and c.status='PENDING' and c.work_date between month_start and month_end),
      'score',case when k.status='PUBLISHED' then k.score when r.kpi_id is null then r.score else null end,
      'scoreSource',case when k.status='PUBLISHED' then 'KPI' when r.score is not null and r.kpi_id is null then 'LEGACY' else null end,
      'kpiStatus',case when k.status='PUBLISHED' then 'FINAL' when k.goals_shared_at is not null then 'IN_REVIEW' else 'NO_TARGET' end
    ) order by e.full_name,e.id),'[]'::jsonb) into result
    from roster e left join totals t on t.id=e.id
    left join public.kpi_assessments k on k.employee_id=e.id and k.period=p_period
    left join public.performance_reviews r on r.employee_id=e.id and r.period=p_period;
  return result;
end $$;
revoke all on function private.can_plan_kpi(uuid) from public,anon,authenticated;
revoke all on function public.update_demo_applicant(uuid,integer,integer,integer,text,integer),public.monthly_performance_report(text) from public,anon;
grant execute on function public.update_demo_applicant(uuid,integer,integer,integer,text,integer),public.monthly_performance_report(text) to authenticated;
notify pgrst,'reload schema';
