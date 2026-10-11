-- Demo workflows. Additive only: no salary/password/history resets.
alter table public.hr_policy add column holiday_dates date[] not null default '{}';
alter table public.hr_policy add column sick_backdate_days integer not null default 7 check(sick_backdate_days between 0 and 30);
alter table public.leave_requests add column cancelled_at timestamptz;

create or replace function private.business_days(p_start date,p_end date,p_days integer[],p_holidays date[])
returns integer language sql stable set search_path='' as $$
  select count(*)::integer from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d
  where extract(isodow from d)::integer=any(p_days) and not d::date=any(p_holidays);
$$;

-- A manager handles non-manager members of their department. HR handles manager
-- requests and departments without an active manager. Nobody approves themselves.
create or replace function private.can_decide_leave(p_employee uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.is_active_actor() and p_employee<>private.current_employee_id() and exists(
    select 1 from public.employees e left join public.user_profiles u on u.employee_id=e.id
    where e.id=p_employee and e.employment_status='ACTIVE' and (
      (private.is_manager() and e.department_id=private.current_department_id() and coalesce(u.role::text,'EMPLOYEE')<>'MANAGER')
      or (private.is_hr() and (u.role='MANAGER' or not exists(
        select 1 from public.user_profiles m join public.employees me on me.id=m.employee_id
        where m.role='MANAGER' and m.account_status='ACTIVE' and me.employment_status='ACTIVE' and me.department_id=e.department_id
      )))
    )
  );
$$;

create or replace function public.leave_request_actions(p_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_active_actor() then raise exception 'FORBIDDEN'; end if;
  if cardinality(p_ids)>100 then raise exception 'VALIDATION_ERROR'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'canDecide',l.status='PENDING' and private.can_decide_leave(l.employee_id),
    'decidedByName',a.full_name)) from public.leave_requests l join public.employees e on e.id=l.employee_id
    left join public.user_profiles u on u.user_id=l.decided_by left join public.employees a on a.id=u.employee_id
    where l.id=any(p_ids) and (private.is_hr() or l.employee_id=private.current_employee_id()
      or (private.is_manager() and e.department_id=private.current_department_id()))),'[]'::jsonb);
end $$;

create or replace function public.create_leave_request(p_type public.leave_type,p_start date,p_end date,p_reason text)
returns public.leave_requests language plpgsql security definer set search_path='' as $$
declare policy public.hr_policy; result public.leave_requests; days integer; available integer;
  today date:=(now() at time zone 'Asia/Jakarta')::date; employee uuid:=private.current_employee_id();
begin
  if not private.is_active_actor() then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(740701001::bigint);
  perform 1 from public.employees where id=employee for update;
  select * into policy from public.hr_policy where id=1;
  if p_type is null or p_start is null or p_end is null or p_reason is null or length(btrim(p_reason)) not between 1 and 2000
    or p_end<p_start or extract(year from p_start) not between 2000 and 2100
    or extract(year from p_start)<>extract(year from p_end)
    or p_start<(case when p_type='SICK' then today-policy.sick_backdate_days else today end) then raise exception 'VALIDATION_ERROR'; end if;
  days:=private.business_days(p_start,p_end,policy.working_days,policy.holiday_dates);
  if days=0 then raise exception 'VALIDATION_ERROR'; end if;
  if exists(select 1 from public.leave_requests where employee_id=employee and status in ('PENDING','APPROVED')
    and p_start<=end_date and p_end>=start_date) then raise exception 'LEAVE_OVERLAP'; end if;
  if p_type='ANNUAL' then
    select available_days into available from public.leave_balance(employee,extract(year from p_start)::integer);
    if days>available then raise exception 'LEAVE_BALANCE_EXCEEDED'; end if;
  end if;
  insert into public.leave_requests(employee_id,type,start_date,end_date,working_days,reason,policy_version,policy_snapshot)
    values(employee,p_type,p_start,p_end,days,btrim(p_reason),policy.policy_version,
      jsonb_build_object('timezone',policy.timezone,'workingDays',policy.working_days,'holidayDates',policy.holiday_dates,
        'defaultEntitlement',policy.default_entitlement,'sickBackdateDays',policy.sick_backdate_days)) returning * into result;
  perform private.audit(auth.uid(),'leave.create','leave_request',result.id,'{}');
  return result;
end $$;

create or replace function public.decide_leave_request(p_request_id uuid,p_decision public.leave_status,p_rejection_reason text,p_expected_version integer)
returns public.leave_requests language plpgsql security definer set search_path='' as $$
declare target uuid; result public.leave_requests;
begin
  if not private.is_hr() and not private.is_manager() then raise exception 'FORBIDDEN'; end if;
  perform private.require_version(p_expected_version);
  perform pg_advisory_xact_lock(740701001::bigint);
  select employee_id into target from public.leave_requests where id=p_request_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not private.can_decide_leave(target) then raise exception 'FORBIDDEN'; end if;
  perform 1 from public.employees where id=target for update;
  select * into result from public.leave_requests where id=p_request_id for update;
  if result.version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if result.status<>'PENDING' then raise exception 'LEAVE_ALREADY_DECIDED'; end if;
  if p_decision is null or p_decision not in ('APPROVED','REJECTED') or
    (p_decision='REJECTED' and (p_rejection_reason is null or length(btrim(p_rejection_reason)) not between 1 and 2000)) then raise exception 'VALIDATION_ERROR'; end if;
  -- Avoid contradictory attendance/leave records in the demonstration.
  if p_decision='APPROVED' and exists(select 1 from public.attendances where employee_id=target
    and work_date between result.start_date and result.end_date and check_in_at is not null) then raise exception 'ATTENDANCE_LEAVE_CONFLICT'; end if;
  update public.leave_requests set status=p_decision,decided_by=auth.uid(),decided_at=now(),
    rejection_reason=case when p_decision='REJECTED' then btrim(p_rejection_reason) end where id=result.id returning * into result;
  perform private.audit(auth.uid(),'leave.decide','leave_request',result.id,jsonb_build_object('decision',p_decision));
  return result;
end $$;

create function public.cancel_leave_request(p_id uuid,p_expected_version integer) returns public.leave_requests
language plpgsql security definer set search_path='' as $$
declare result public.leave_requests;
begin
  if not private.is_active_actor() then raise exception 'FORBIDDEN'; end if;
  perform private.require_version(p_expected_version);
  perform pg_advisory_xact_lock(740701001::bigint);
  perform 1 from public.employees where id=private.current_employee_id() for update;
  select * into result from public.leave_requests where id=p_id and employee_id=private.current_employee_id() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if result.version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if result.status<>'PENDING' then raise exception 'LEAVE_ALREADY_DECIDED'; end if;
  update public.leave_requests set status='CANCELLED',cancelled_at=now() where id=p_id returning * into result;
  perform private.audit(auth.uid(),'leave.cancel','leave_request',p_id,'{}');
  return result;
end $$;

create or replace function public.attendance_check_in() returns public.attendances
language plpgsql security definer set search_path='' as $$
declare policy public.hr_policy; today date:=(now() at time zone 'Asia/Jakarta')::date;
begin
  if not private.is_active_actor() then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(740701001::bigint);
  perform 1 from public.employees where id=private.current_employee_id() for update;
  select * into policy from public.hr_policy where id=1;
  if not extract(isodow from today)::integer=any(policy.working_days) or today=any(policy.holiday_dates) then raise exception 'NON_WORKING_DAY'; end if;
  if exists(select 1 from public.leave_requests where employee_id=private.current_employee_id() and status='APPROVED'
    and today between start_date and end_date) then raise exception 'ON_APPROVED_LEAVE'; end if;
  return private.attendance_check_in_v1();
end $$;

create function public.update_hr_policy(p_expected_version integer,p_start time,p_end time,p_days integer[],p_entitlement integer,p_holidays date[],p_sick_backdate integer)
returns public.hr_policy language plpgsql security definer set search_path='' as $$
declare result public.hr_policy;
begin
  perform private.lock_hr_write(); perform private.require_version(p_expected_version);
  select * into result from public.hr_policy where id=1 for update;
  if result.policy_version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if p_start is null or p_end is null or p_end<=p_start or p_days is null or cardinality(p_days) not between 1 and 7
    or exists(select 1 from unnest(p_days) d where d is null or d not between 1 and 7)
    or (select count(distinct d) from unnest(p_days) d)<>cardinality(p_days)
    or p_entitlement is null or p_entitlement not between 0 and 60 or p_holidays is null or cardinality(p_holidays)>100
    or exists(select 1 from unnest(p_holidays) d where d is null)
    or p_sick_backdate is null or p_sick_backdate not between 0 and 30 then raise exception 'VALIDATION_ERROR'; end if;
  update public.hr_policy set work_start=p_start,work_end=p_end,working_days=p_days,default_entitlement=p_entitlement,
    holiday_dates=p_holidays,sick_backdate_days=p_sick_backdate,policy_version=policy_version+1,updated_at=now() where id=1 returning * into result;
  perform private.audit(auth.uid(),'policy.update','hr_policy',null,to_jsonb(result)-'created_at'-'updated_at');
  return result;
end $$;

-- Personal published payroll access for every role, never other people's salary.
drop policy payroll_runs_read on public.payroll_runs;
create policy payroll_runs_read on public.payroll_runs for select to authenticated using(
  private.is_hr() or (private.is_active_actor() and status='PUBLISHED' and exists(
    select 1 from public.payroll_items i where i.payroll_run_id=payroll_runs.id and i.employee_id=private.current_employee_id())));
drop policy payroll_items_read on public.payroll_items;
create policy payroll_items_read on public.payroll_items for select to authenticated using(
  private.is_hr() or (private.is_active_actor() and status='PUBLISHED' and employee_id=private.current_employee_id()));

create table public.attendance_corrections(
  id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees(id),
  work_date date not null, requested_in timestamptz not null, requested_out timestamptz,
  reason text not null check(length(btrim(reason)) between 1 and 2000),
  status public.leave_status not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED')),
  attendance_version integer, decided_by uuid references public.user_profiles(user_id), decided_at timestamptz,
  decision_note text, created_at timestamptz not null default now(), version integer not null default 1,
  check(requested_out is null or requested_out>=requested_in)
);
create unique index attendance_corrections_pending on public.attendance_corrections(employee_id,work_date) where status='PENDING';
alter table public.attendance_corrections enable row level security;
create policy corrections_read on public.attendance_corrections for select to authenticated using(
  private.is_active_actor() and (employee_id=private.current_employee_id() or private.is_hr()));
revoke all on public.attendance_corrections from anon,authenticated;
grant select on public.attendance_corrections to authenticated;

create function public.request_attendance_correction(p_date date,p_in time,p_out time,p_reason text)
returns public.attendance_corrections language plpgsql security definer set search_path='' as $$
declare result public.attendance_corrections; today date:=(now() at time zone 'Asia/Jakarta')::date; v integer;
begin
  if not private.is_active_actor() then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(740701001::bigint);
  perform 1 from public.employees where id=private.current_employee_id() for update;
  if p_date is null or p_date not between today-30 and today or p_in is null or p_reason is null
    or length(btrim(p_reason)) not between 1 and 2000 or (p_out is not null and p_out<p_in)
    or (p_date+p_in) at time zone 'Asia/Jakarta'>now()
    or (p_date+p_out) at time zone 'Asia/Jakarta'>now() then raise exception 'VALIDATION_ERROR'; end if;
  if exists(select 1 from public.attendance_corrections where employee_id=private.current_employee_id() and work_date=p_date and status='PENDING') then raise exception 'DUPLICATE_CORRECTION'; end if;
  select version into v from public.attendances where employee_id=private.current_employee_id() and work_date=p_date;
  insert into public.attendance_corrections(employee_id,work_date,requested_in,requested_out,reason,attendance_version)
    values(private.current_employee_id(),p_date,(p_date+p_in) at time zone 'Asia/Jakarta',(p_date+p_out) at time zone 'Asia/Jakarta',btrim(p_reason),v) returning * into result;
  perform private.audit(auth.uid(),'attendance.correction.request','attendance_correction',result.id,'{}');
  return result;
end $$;

create function public.decide_attendance_correction(p_id uuid,p_decision public.leave_status,p_note text,p_expected_version integer)
returns public.attendance_corrections language plpgsql security definer set search_path='' as $$
declare result public.attendance_corrections; target uuid; a public.attendances; policy public.hr_policy; start_time time;
begin
  perform private.lock_hr_write(); perform private.require_version(p_expected_version);
  select employee_id into target from public.attendance_corrections where id=p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if target=private.current_employee_id() then raise exception 'FORBIDDEN'; end if;
  perform 1 from public.employees where id=target and employment_status='ACTIVE' for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  select * into result from public.attendance_corrections where id=p_id for update;
  if result.version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if result.status<>'PENDING' then raise exception 'LEAVE_ALREADY_DECIDED'; end if;
  if p_decision is null or p_decision not in ('APPROVED','REJECTED') or p_note is null or length(btrim(p_note)) not between 1 and 2000 then raise exception 'VALIDATION_ERROR'; end if;
  if p_decision='APPROVED' then
    select * into a from public.attendances where employee_id=target and work_date=result.work_date for update;
    if a.version is distinct from result.attendance_version then raise exception 'VERSION_CONFLICT'; end if;
    select * into policy from public.hr_policy where id=1;
    if private.business_days(result.work_date,result.work_date,policy.working_days,policy.holiday_dates)=0 then raise exception 'NON_WORKING_DAY'; end if;
    if exists(select 1 from public.leave_requests where employee_id=target and status='APPROVED' and result.work_date between start_date and end_date) then raise exception 'ON_APPROVED_LEAVE'; end if;
    start_time:=coalesce((a.policy_snapshot->>'workStart')::time,policy.work_start);
    insert into public.attendances(employee_id,work_date,check_in_at,check_out_at,status,policy_version,policy_snapshot)
      values(target,result.work_date,result.requested_in,result.requested_out,
        (case when (result.requested_in at time zone 'Asia/Jakarta')::time>start_time then 'LATE' else 'PRESENT' end)::public.attendance_status,
        coalesce(a.policy_version,policy.policy_version),coalesce(a.policy_snapshot,jsonb_build_object('workStart',policy.work_start,'workEnd',policy.work_end,'timezone',policy.timezone)))
      on conflict(employee_id,work_date) do update set check_in_at=excluded.check_in_at,check_out_at=excluded.check_out_at,status=excluded.status;
    perform private.audit(auth.uid(),'attendance.correction.apply','attendance',coalesce(a.id,(select id from public.attendances where employee_id=target and work_date=result.work_date)),
      jsonb_build_object('before',to_jsonb(a),'requestedIn',result.requested_in,'requestedOut',result.requested_out,'reason',p_note));
  end if;
  update public.attendance_corrections set status=p_decision,decided_by=auth.uid(),decided_at=now(),decision_note=btrim(p_note),version=version+1 where id=p_id returning * into result;
  perform private.audit(auth.uid(),'attendance.correction.decide','attendance_correction',p_id,jsonb_build_object('decision',p_decision));
  return result;
end $$;

create table private.notification_reads(user_id uuid not null references public.user_profiles(user_id),event_id text not null,read_at timestamptz not null default now(),primary key(user_id,event_id));
create function public.my_notifications() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_active_actor() then raise exception 'FORBIDDEN'; end if;
  return coalesce((with events as (
    select 'leave:'||l.id||':'||l.version event_id,case when l.status='PENDING' then 'Pengajuan perlu persetujuan' when l.status='APPROVED' then 'Pengajuan disetujui' else 'Pengajuan ditolak' end title,
      e.full_name||' · '||l.start_date||' s.d. '||l.end_date message,coalesce(l.decided_at,l.submitted_at) at,'leave' view
      from public.leave_requests l join public.employees e on e.id=l.employee_id
      where (l.status='PENDING' and private.can_decide_leave(l.employee_id)) or (l.employee_id=private.current_employee_id() and l.status in ('APPROVED','REJECTED'))
    union all select 'payroll:'||i.id,'Slip gaji tersedia',r.period||' · payroll diterbitkan',r.published_at,'selfservice'
      from public.payroll_items i join public.payroll_runs r on r.id=i.payroll_run_id where i.employee_id=private.current_employee_id() and i.status='PUBLISHED' and r.status='PUBLISHED'
    union all select 'review:'||r.id||':'||r.version,'Penilaian kinerja tersedia',r.period||' · skor '||r.score,r.assessed_at,'performance'
      from public.performance_reviews r where r.employee_id=private.current_employee_id()
    union all select 'correction:'||c.id||':'||c.version,case when c.status='PENDING' then 'Koreksi absensi perlu ditinjau' when c.status='APPROVED' then 'Koreksi absensi disetujui' else 'Koreksi absensi ditolak' end,
      e.full_name||' · '||c.work_date,coalesce(c.decided_at,c.created_at),'selfservice'
      from public.attendance_corrections c join public.employees e on e.id=c.employee_id
      where (private.is_hr() and c.status='PENDING' and c.employee_id<>private.current_employee_id()) or (c.employee_id=private.current_employee_id() and c.status in ('APPROVED','REJECTED'))
  ), latest as (select * from events order by at desc,event_id limit 200)
  select jsonb_agg(jsonb_build_object('id',e.event_id,'title',e.title,'message',e.message,'at',e.at,'view',e.view,'read',n.event_id is not null) order by e.at desc,e.event_id)
    from latest e left join private.notification_reads n on n.user_id=auth.uid() and n.event_id=e.event_id),'[]'::jsonb);
end $$;

create function public.read_my_notifications(p_ids text[]) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not private.is_active_actor() then raise exception 'FORBIDDEN'; end if;
  if p_ids is null or cardinality(p_ids)>200 then raise exception 'VALIDATION_ERROR'; end if;
  insert into private.notification_reads(user_id,event_id)
    select auth.uid(),e->>'id' from jsonb_array_elements(public.my_notifications()) e where e->>'id'=any(p_ids)
    on conflict do nothing;
end $$;

create function public.hr_audit_log(p_offset integer default 0,p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_hr() then raise exception 'FORBIDDEN'; end if;
  if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then raise exception 'VALIDATION_ERROR'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.occurred_at desc,x.id) from (
    select a.id,a.action,a.resource_type,a.resource_id,a.occurred_at,e.full_name actor_name from private.audit_events a
    left join public.user_profiles u on u.user_id=a.actor_user_id left join public.employees e on e.id=u.employee_id
    order by a.occurred_at desc,a.id offset p_offset limit p_limit) x),'[]'::jsonb);
end $$;

revoke execute on function private.business_days(date,date,integer[],date[]),private.can_decide_leave(uuid) from public,anon,authenticated;
revoke all on private.notification_reads from public,anon,authenticated;
revoke execute on function public.leave_request_actions(uuid[]),public.cancel_leave_request(uuid,integer),
  public.update_hr_policy(integer,time,time,integer[],integer,date[],integer),public.request_attendance_correction(date,time,time,text),
  public.decide_attendance_correction(uuid,public.leave_status,text,integer),public.my_notifications(),public.read_my_notifications(text[]),public.hr_audit_log(integer,integer) from public,anon;
grant execute on function public.leave_request_actions(uuid[]),public.cancel_leave_request(uuid,integer),
  public.update_hr_policy(integer,time,time,integer[],integer,date[],integer),public.request_attendance_correction(date,time,time,text),
  public.decide_attendance_correction(uuid,public.leave_status,text,integer),public.my_notifications(),public.read_my_notifications(text[]),public.hr_audit_log(integer,integer) to authenticated;

notify pgrst, 'reload schema';
