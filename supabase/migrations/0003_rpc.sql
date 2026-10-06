-- 0003_rpc.sql — transaksi bisnis (SECURITY DEFINER, search_path kosong)
-- Aturan otorisasi ditegakkan di dalam fungsi; identitas dari JWT.

create or replace function private.working_days(p_start date, p_end date, p_days integer[])
returns integer language sql immutable set search_path = '' as $$
  select coalesce(count(*), 0)::int
  from generate_series(p_start, p_end, interval '1 day') d
  where extract(isodow from d)::int = any(p_days);
$$;

create or replace function private.audit(
  p_actor uuid, p_action text, p_resource_type text, p_resource_id uuid, p_changes jsonb
) returns void language sql security definer set search_path = '' as $$
  insert into private.audit_events (actor_user_id, action, resource_type, resource_id, changes)
  values (p_actor, p_action, p_resource_type, p_resource_id, coalesce(p_changes, '{}'::jsonb));
$$;

-- Saldo cuti: entitlement - used(APPROVED) - reserved(PENDING) untuk tahun.
create or replace function public.leave_balance(p_employee uuid, p_year integer)
returns table (year integer, entitlement_days integer, used_days integer,
               reserved_days integer, available_days integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_entitlement integer;
  v_used integer;
  v_reserved integer;
begin
  if not (private.is_hr() or p_employee = private.current_employee_id()) then
    raise exception 'FORBIDDEN';
  end if;

  select coalesce(
      (select ale.entitlement_days from public.annual_leave_entitlements ale
       where ale.employee_id = p_employee and ale.year = p_year),
      (select hp.default_entitlement from public.hr_policy hp where hp.id = 1),
      12)
    into v_entitlement;

  select coalesce(sum(lr.working_days), 0) into v_used
  from public.leave_requests lr
  where lr.employee_id = p_employee and lr.type = 'ANNUAL'
    and lr.status = 'APPROVED' and extract(year from lr.start_date)::int = p_year;

  select coalesce(sum(lr.working_days), 0) into v_reserved
  from public.leave_requests lr
  where lr.employee_id = p_employee and lr.type = 'ANNUAL'
    and lr.status = 'PENDING' and extract(year from lr.start_date)::int = p_year;

  return query select p_year, v_entitlement, v_used, v_reserved,
    greatest(0, v_entitlement - v_used - v_reserved);
end;
$$;

-- create_employee: employees + contacts + compensation + audit atomik -------
create or replace function public.create_employee(
  p_employee_no text, p_full_name text, p_work_email text, p_department_id uuid,
  p_position_id uuid, p_employment_status public.employment_status, p_joined_on date,
  p_phone text, p_address text, p_base_salary_idr bigint
) returns public.employees
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_emp public.employees;
  v_constraint text;
begin
  if not private.is_hr() then raise exception 'FORBIDDEN'; end if;

  begin
    insert into public.employees
      (employee_no, full_name, work_email, department_id, position_id, employment_status, joined_on)
    values
      (upper(btrim(p_employee_no)), btrim(p_full_name), lower(btrim(p_work_email)),
       p_department_id, p_position_id, p_employment_status, p_joined_on)
    returning * into v_emp;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'employees_employee_no_unique' then raise exception 'DUPLICATE_EMPLOYEE_NO';
    elsif v_constraint = 'employees_work_email_unique' then raise exception 'DUPLICATE_EMAIL';
    else raise; end if;
  end;

  insert into public.employee_contacts (employee_id, phone, address)
  values (v_emp.id, btrim(p_phone), btrim(p_address));

  insert into private.employee_compensation (employee_id, base_salary_idr)
  values (v_emp.id, p_base_salary_idr);

  perform private.audit(v_actor, 'employee.create', 'employee', v_emp.id,
    jsonb_build_object('employeeNo', v_emp.employee_no));

  return v_emp;
end;
$$;

-- update_employee: allowlist + optimistic locking --------------------------
create or replace function public.update_employee(
  p_employee_id uuid, p_expected_version integer,
  p_full_name text default null, p_work_email text default null,
  p_department_id uuid default null, p_position_id uuid default null,
  p_employment_status public.employment_status default null, p_joined_on date default null,
  p_phone text default null, p_address text default null, p_base_salary_idr bigint default null
) returns public.employees
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_emp public.employees;
  v_constraint text;
begin
  if not private.is_hr() then raise exception 'FORBIDDEN'; end if;

  select * into v_emp from public.employees where id = p_employee_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_emp.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;

  begin
    update public.employees set
      full_name = coalesce(btrim(p_full_name), full_name),
      work_email = coalesce(lower(btrim(p_work_email)), work_email),
      department_id = coalesce(p_department_id, department_id),
      position_id = coalesce(p_position_id, position_id),
      employment_status = coalesce(p_employment_status, employment_status),
      joined_on = coalesce(p_joined_on, joined_on)
    where id = p_employee_id returning * into v_emp;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'employees_work_email_unique' then raise exception 'DUPLICATE_EMAIL';
    else raise; end if;
  end;

  if p_phone is not null or p_address is not null then
    insert into public.employee_contacts (employee_id, phone, address)
    values (p_employee_id, coalesce(btrim(p_phone), '00000000'), coalesce(btrim(p_address), '-'))
    on conflict (employee_id) do update
      set phone = coalesce(btrim(p_phone), public.employee_contacts.phone),
          address = coalesce(btrim(p_address), public.employee_contacts.address);
  end if;

  if p_base_salary_idr is not null then
    insert into private.employee_compensation (employee_id, base_salary_idr)
    values (p_employee_id, p_base_salary_idr)
    on conflict (employee_id) do update set base_salary_idr = excluded.base_salary_idr;
  end if;

  perform private.audit(v_actor, 'employee.update', 'employee', p_employee_id, '{}'::jsonb);
  select * into v_emp from public.employees where id = p_employee_id;
  return v_emp;
end;
$$;

-- update_own_contact: pemilik mengubah phone/address sendiri ----------------
create or replace function public.update_own_contact(
  p_expected_version integer, p_phone text, p_address text
) returns public.employee_contacts
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_emp uuid := private.current_employee_id();
  v_row public.employee_contacts;
begin
  if not private.is_active_actor() then raise exception 'FORBIDDEN'; end if;

  select * into v_row from public.employee_contacts where employee_id = v_emp for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_row.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;

  update public.employee_contacts
    set phone = btrim(p_phone), address = btrim(p_address)
    where employee_id = v_emp returning * into v_row;

  -- Naikkan version aggregate employees agar edit HR dari snapshot lama berkonflik.
  update public.employees set updated_at = now() where id = v_emp;

  perform private.audit(v_actor, 'contact.update', 'employee_contacts', v_emp, '{}'::jsonb);
  return v_row;
end;
$$;

-- attendance_check_in / check_out -----------------------------------------
create or replace function public.attendance_check_in()
returns public.attendances language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_emp uuid := private.current_employee_id();
  v_policy public.hr_policy;
  v_work_date date := (now() at time zone 'Asia/Jakarta')::date;
  v_time time := (now() at time zone 'Asia/Jakarta')::time;
  v_row public.attendances;
begin
  if not private.is_active_actor() then raise exception 'FORBIDDEN'; end if;
  select * into v_policy from public.hr_policy where id = 1;

  if exists (select 1 from public.attendances a
             where a.employee_id = v_emp and a.work_date = v_work_date) then
    raise exception 'ALREADY_CHECKED_IN';
  end if;

  insert into public.attendances
    (employee_id, work_date, check_in_at, status, policy_version, policy_snapshot)
  values
    (v_emp, v_work_date, now(),
     case when v_time > v_policy.work_start then 'LATE' else 'PRESENT' end,
     v_policy.policy_version,
     jsonb_build_object('timezone', v_policy.timezone, 'workStart', v_policy.work_start,
                        'workEnd', v_policy.work_end))
  returning * into v_row;

  perform private.audit(v_actor, 'attendance.check_in', 'attendance', v_row.id, '{}'::jsonb);
  return v_row;
end;
$$;

create or replace function public.attendance_check_out()
returns public.attendances language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_emp uuid := private.current_employee_id();
  v_work_date date := (now() at time zone 'Asia/Jakarta')::date;
  v_row public.attendances;
begin
  if not private.is_active_actor() then raise exception 'FORBIDDEN'; end if;

  select * into v_row from public.attendances
    where employee_id = v_emp and work_date = v_work_date for update;
  if not found then raise exception 'CHECK_IN_REQUIRED'; end if;
  if v_row.check_out_at is not null then raise exception 'ALREADY_CHECKED_OUT'; end if;

  update public.attendances set check_out_at = now()
    where id = v_row.id returning * into v_row;

  perform private.audit(v_actor, 'attendance.check_out', 'attendance', v_row.id, '{}'::jsonb);
  return v_row;
end;
$$;

-- create_leave_request ------------------------------------------------------
create or replace function public.create_leave_request(
  p_type public.leave_type, p_start date, p_end date, p_reason text
) returns public.leave_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_emp uuid := private.current_employee_id();
  v_policy public.hr_policy;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_days integer;
  v_available integer;
  v_row public.leave_requests;
begin
  if not private.is_active_actor() then raise exception 'FORBIDDEN'; end if;
  select * into v_policy from public.hr_policy where id = 1;

  if p_end < p_start then raise exception 'VALIDATION_ERROR'; end if;
  if p_start < v_today then raise exception 'VALIDATION_ERROR'; end if;
  if extract(year from p_start) <> extract(year from p_end) then raise exception 'VALIDATION_ERROR'; end if;

  v_days := private.working_days(p_start, p_end, v_policy.working_days);
  if v_days = 0 then raise exception 'VALIDATION_ERROR'; end if;

  if exists (select 1 from public.leave_requests lr
             where lr.employee_id = v_emp and lr.status <> 'REJECTED'
               and p_start <= lr.end_date and p_end >= lr.start_date) then
    raise exception 'LEAVE_OVERLAP';
  end if;

  if p_type = 'ANNUAL' then
    select lb.available_days into v_available
    from public.leave_balance(v_emp, extract(year from p_start)::int) lb;
    if v_days > v_available then raise exception 'LEAVE_BALANCE_EXCEEDED'; end if;
  end if;

  insert into public.leave_requests
    (employee_id, type, start_date, end_date, working_days, reason, status,
     policy_version, policy_snapshot)
  values
    (v_emp, p_type, p_start, p_end, v_days, btrim(p_reason), 'PENDING',
     v_policy.policy_version,
     jsonb_build_object('timezone', v_policy.timezone, 'workingDays', v_policy.working_days,
                        'defaultEntitlement', v_policy.default_entitlement))
  returning * into v_row;

  perform private.audit(v_actor, 'leave.create', 'leave_request', v_row.id, '{}'::jsonb);
  return v_row;
end;
$$;

-- decide_leave_request ------------------------------------------------------
create or replace function public.decide_leave_request(
  p_request_id uuid, p_decision public.leave_status,
  p_rejection_reason text, p_expected_version integer
) returns public.leave_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_row public.leave_requests;
  v_dept uuid := private.current_department_id();
begin
  if not private.is_manager() then raise exception 'FORBIDDEN'; end if;
  if p_decision not in ('APPROVED', 'REJECTED') then raise exception 'VALIDATION_ERROR'; end if;

  select * into v_row from public.leave_requests where id = p_request_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_row.status <> 'PENDING' then raise exception 'LEAVE_ALREADY_DECIDED'; end if;
  if v_row.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if not exists (select 1 from public.employees e
                 where e.id = v_row.employee_id and e.department_id = v_dept) then
    raise exception 'NOT_FOUND';
  end if;
  if v_row.employee_id = private.current_employee_id() then raise exception 'FORBIDDEN'; end if;
  if p_decision = 'REJECTED'
     and (p_rejection_reason is null or btrim(p_rejection_reason) = '') then
    raise exception 'VALIDATION_ERROR';
  end if;

  update public.leave_requests set
    status = p_decision,
    decided_by = v_actor,
    decided_at = now(),
    rejection_reason = case when p_decision = 'REJECTED'
      then btrim(p_rejection_reason) else null end
  where id = p_request_id returning * into v_row;

  perform private.audit(v_actor, 'leave.decide', 'leave_request', v_row.id,
    jsonb_build_object('decision', p_decision));
  return v_row;
end;
$$;

-- create_payroll_run --------------------------------------------------------
create or replace function public.create_payroll_run(p_period text)
returns public.payroll_runs language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_run public.payroll_runs;
begin
  if not private.is_hr() then raise exception 'FORBIDDEN'; end if;
  if p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'VALIDATION_ERROR'; end if;

  begin
    insert into public.payroll_runs (period, status) values (p_period, 'DRAFT')
    returning * into v_run;
  exception when unique_violation then
    raise exception 'DUPLICATE_PERIOD';
  end;

  insert into public.payroll_items
    (payroll_run_id, employee_id, employee_no, full_name, department_name, position_name,
     base_salary_idr, allowance_idr, bonus_idr, deduction_idr, net_salary_idr, status)
  select v_run.id, e.id, e.employee_no, e.full_name, d.name, p.name,
         coalesce(c.base_salary_idr, 0), 0, 0, 0, coalesce(c.base_salary_idr, 0), 'DRAFT'
  from public.employees e
  join public.departments d on d.id = e.department_id
  join public.positions p on p.id = e.position_id
  left join private.employee_compensation c on c.employee_id = e.id
  where e.employment_status = 'ACTIVE';

  perform private.audit(v_actor, 'payroll.create', 'payroll_run', v_run.id,
    jsonb_build_object('period', p_period));
  return v_run;
end;
$$;

-- update_payroll_item -------------------------------------------------------
create or replace function public.update_payroll_item(
  p_item_id uuid, p_allowance_idr bigint, p_bonus_idr bigint,
  p_deduction_idr bigint, p_expected_version integer
) returns public.payroll_items
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_item public.payroll_items;
  v_run public.payroll_runs;
begin
  if not private.is_hr() then raise exception 'FORBIDDEN'; end if;

  select * into v_item from public.payroll_items where id = p_item_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into v_run from public.payroll_runs where id = v_item.payroll_run_id for update;
  if v_run.status <> 'DRAFT' or v_item.status <> 'DRAFT' then
    raise exception 'PAYROLL_ALREADY_PUBLISHED';
  end if;
  if v_item.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if p_allowance_idr < 0 or p_bonus_idr < 0 or p_deduction_idr < 0 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if p_deduction_idr > v_item.base_salary_idr + p_allowance_idr + p_bonus_idr then
    raise exception 'VALIDATION_ERROR';
  end if;

  update public.payroll_items set
    allowance_idr = p_allowance_idr,
    bonus_idr = p_bonus_idr,
    deduction_idr = p_deduction_idr,
    net_salary_idr = v_item.base_salary_idr + p_allowance_idr + p_bonus_idr - p_deduction_idr
  where id = p_item_id returning * into v_item;

  perform private.audit(v_actor, 'payroll.item.update', 'payroll_item', v_item.id, '{}'::jsonb);
  return v_item;
end;
$$;

-- publish_payroll_run -------------------------------------------------------
create or replace function public.publish_payroll_run(
  p_run_id uuid, p_expected_version integer
) returns public.payroll_runs
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_run public.payroll_runs;
begin
  if not private.is_hr() then raise exception 'FORBIDDEN'; end if;

  select * into v_run from public.payroll_runs where id = p_run_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_run.status = 'PUBLISHED' then raise exception 'PAYROLL_ALREADY_PUBLISHED'; end if;
  if v_run.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;

  update public.payroll_items
    set status = 'PUBLISHED',
        net_salary_idr = base_salary_idr + allowance_idr + bonus_idr - deduction_idr
    where payroll_run_id = p_run_id;

  update public.payroll_runs
    set status = 'PUBLISHED', published_at = now(), published_by = v_actor
    where id = p_run_id returning * into v_run;

  perform private.audit(v_actor, 'payroll.publish', 'payroll_run', v_run.id, '{}'::jsonb);
  return v_run;
end;
$$;

-- upsert_performance_review -------------------------------------------------
create or replace function public.upsert_performance_review(
  p_employee_id uuid, p_period text, p_score integer,
  p_notes text, p_expected_version integer
) returns public.performance_reviews
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_row public.performance_reviews;
begin
  if not private.is_manager() then raise exception 'FORBIDDEN'; end if;
  if p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'VALIDATION_ERROR'; end if;
  if p_score < 0 or p_score > 100 then raise exception 'VALIDATION_ERROR'; end if;
  if p_employee_id = private.current_employee_id() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.employees e
                 where e.id = p_employee_id
                   and e.department_id = private.current_department_id()) then
    raise exception 'NOT_FOUND';
  end if;

  select * into v_row from public.performance_reviews
    where employee_id = p_employee_id and period = p_period;

  if found then
    if p_expected_version is null or v_row.version <> p_expected_version then
      raise exception 'VERSION_CONFLICT';
    end if;
    update public.performance_reviews set
      score = p_score, notes = coalesce(p_notes, ''), assessed_by = v_actor, assessed_at = now()
    where id = v_row.id returning * into v_row;
  else
    insert into public.performance_reviews
      (employee_id, period, score, notes, assessed_by)
    values
      (p_employee_id, p_period, p_score, coalesce(p_notes, ''), v_actor)
    returning * into v_row;
  end if;

  perform private.audit(v_actor, 'performance.upsert', 'performance_review', v_row.id, '{}'::jsonb);
  return v_row;
end;
$$;

-- update_account ------------------------------------------------------------
create or replace function public.update_account(
  p_user_id uuid, p_role public.business_role,
  p_account_status public.account_status, p_expected_version integer
) returns public.user_profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_row public.user_profiles;
  v_role public.business_role;
  v_status public.account_status;
  v_other_hr integer;
begin
  if not private.is_hr() then raise exception 'FORBIDDEN'; end if;

  select * into v_row from public.user_profiles where user_id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_row.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;

  v_role := coalesce(p_role, v_row.role);
  v_status := coalesce(p_account_status, v_row.account_status);

  if p_user_id = v_actor and (v_role <> 'ADMIN_HR' or v_status <> 'ACTIVE') then
    raise exception 'FORBIDDEN';
  end if;

  if v_row.role = 'ADMIN_HR' and v_row.account_status = 'ACTIVE'
     and (v_role <> 'ADMIN_HR' or v_status <> 'ACTIVE') then
    select count(*) into v_other_hr from public.user_profiles up
      where up.role = 'ADMIN_HR' and up.account_status = 'ACTIVE' and up.user_id <> p_user_id;
    if v_other_hr = 0 then raise exception 'FORBIDDEN'; end if;
  end if;

  update public.user_profiles set role = v_role, account_status = v_status
    where user_id = p_user_id returning * into v_row;

  perform private.audit(v_actor, 'account.update', 'user_profile', p_user_id,
    jsonb_build_object('role', v_role, 'accountStatus', v_status));
  return v_row;
end;
$$;

-- Grants fungsi (authenticated saja) ---------------------------------------
do $$
declare f record;
begin
  for f in
    select p.proname as name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'leave_balance', 'create_employee', 'update_employee', 'update_own_contact',
        'attendance_check_in', 'attendance_check_out', 'create_leave_request',
        'decide_leave_request', 'create_payroll_run', 'update_payroll_item',
        'publish_payroll_run', 'upsert_performance_review', 'update_account')
  loop
    execute format('revoke all on function public.%I(%s) from public, anon', f.name, f.args);
    execute format('grant execute on function public.%I(%s) to authenticated', f.name, f.args);
  end loop;
end $$;