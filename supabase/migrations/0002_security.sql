-- 0002_security.sql — helper fungsi + RLS + grants
-- Matriks akses: docs/backend-handoff/03_ACCESS_AND_RLS.md

-- Helper identitas. SECURITY DEFINER + search_path kosong + schema-qualified,
-- sehingga tidak bisa dibajak dan tidak memicu rekursi policy.
create or replace function private.current_user_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select auth.uid();
$$;

create or replace function private.current_employee_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select up.employee_id from public.user_profiles up where up.user_id = auth.uid();
$$;

create or replace function private.current_business_role()
returns public.business_role language sql stable security definer set search_path = '' as $$
  select up.role from public.user_profiles up where up.user_id = auth.uid();
$$;

create or replace function private.current_account_status()
returns public.account_status language sql stable security definer set search_path = '' as $$
  select up.account_status from public.user_profiles up where up.user_id = auth.uid();
$$;

create or replace function private.current_department_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select e.department_id
  from public.user_profiles up
  join public.employees e on e.id = up.employee_id
  where up.user_id = auth.uid();
$$;

create or replace function private.is_active_actor()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.user_profiles up
    join public.employees e on e.id = up.employee_id
    where up.user_id = auth.uid()
      and up.account_status = 'ACTIVE'
      and e.employment_status = 'ACTIVE'
  );
$$;

create or replace function private.is_hr()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_actor() and private.current_business_role() = 'ADMIN_HR';
$$;

create or replace function private.is_manager()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_actor() and private.current_business_role() = 'MANAGER';
$$;

grant usage on schema private to authenticated;
grant execute on function
  private.current_user_id(),
  private.current_employee_id(),
  private.current_business_role(),
  private.current_account_status(),
  private.current_department_id(),
  private.is_active_actor(),
  private.is_hr(),
  private.is_manager()
to authenticated;

-- private schema tidak diekspos sebagai Data API.
revoke all on all tables in schema private from anon, authenticated;
alter default privileges in schema private revoke all on tables from anon, authenticated;

-- Aktifkan RLS ------------------------------------------------------------
alter table public.departments enable row level security;
alter table public.positions enable row level security;
alter table public.employees enable row level security;
alter table public.user_profiles enable row level security;
alter table public.employee_contacts enable row level security;
alter table public.attendances enable row level security;
alter table public.annual_leave_entitlements enable row level security;
alter table public.leave_requests enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_items enable row level security;
alter table public.performance_reviews enable row level security;
alter table public.hr_policy enable row level security;
alter table private.employee_compensation enable row level security;
alter table private.audit_events enable row level security;
alter table private.operation_requests enable row level security;

-- Master (departments/positions): read semua aktor; write HR -------------
create policy departments_read on public.departments
  for select to authenticated using (private.is_active_actor());
create policy departments_write on public.departments
  for all to authenticated using (private.is_hr()) with check (private.is_hr());

create policy positions_read on public.positions
  for select to authenticated using (private.is_active_actor());
create policy positions_write on public.positions
  for all to authenticated using (private.is_hr()) with check (private.is_hr());

-- employees: HR semua; M departemennya; E diri sendiri; write HR ---------
create policy employees_read on public.employees
  for select to authenticated using (
    private.is_hr()
    or (private.is_manager() and department_id = private.current_department_id())
    or id = private.current_employee_id()
  );
create policy employees_write on public.employees
  for all to authenticated using (private.is_hr()) with check (private.is_hr());

-- user_profiles: HR semua; selain itu hanya baris sendiri ----------------
create policy user_profiles_read on public.user_profiles
  for select to authenticated using (
    private.is_hr() or user_id = private.current_user_id()
  );
-- Tidak ada insert/update/delete langsung untuk pemohon biasa (via RPC/admin).

-- employee_contacts: HR semua; M/E hanya milik sendiri ------------------
create policy employee_contacts_read on public.employee_contacts
  for select to authenticated using (
    private.is_hr() or employee_id = private.current_employee_id()
  );
create policy employee_contacts_update on public.employee_contacts
  for update to authenticated
  using (private.is_hr() or employee_id = private.current_employee_id())
  with check (private.is_hr() or employee_id = private.current_employee_id());

-- attendances: HR semua; M tim; E diri sendiri; insert/update via RPC ----
create policy attendances_read on public.attendances
  for select to authenticated using (
    private.is_hr()
    or (private.is_manager() and employee_id in (
      select e.id from public.employees e where e.department_id = private.current_department_id()
    ))
    or employee_id = private.current_employee_id()
  );

-- annual_leave_entitlements: HR semua; selain itu sendiri ----------------
create policy leave_entitlements_read on public.annual_leave_entitlements
  for select to authenticated using (
    private.is_hr() or employee_id = private.current_employee_id()
  );

-- leave_requests: HR semua; M tim; E sendiri ----------------------------
create policy leave_requests_read on public.leave_requests
  for select to authenticated using (
    private.is_hr()
    or (private.is_manager() and employee_id in (
      select e.id from public.employees e where e.department_id = private.current_department_id()
    ))
    or employee_id = private.current_employee_id()
  );

-- payroll_runs: HR semua; E hanya run terbit yang punya item dirinya -----
create policy payroll_runs_read on public.payroll_runs
  for select to authenticated using (
    private.is_hr()
    or (status = 'PUBLISHED' and exists (
      select 1 from public.payroll_items pi
      where pi.payroll_run_id = payroll_runs.id
        and pi.employee_id = private.current_employee_id()
    ))
  );

-- payroll_items: HR semua; E hanya item sendiri yang terbit --------------
create policy payroll_items_read on public.payroll_items
  for select to authenticated using (
    private.is_hr()
    or (status = 'PUBLISHED' and employee_id = private.current_employee_id())
  );

-- performance_reviews: HR semua; M tim; E sendiri ------------------------
create policy performance_reviews_read on public.performance_reviews
  for select to authenticated using (
    private.is_hr()
    or (private.is_manager() and employee_id in (
      select e.id from public.employees e where e.department_id = private.current_department_id()
    ))
    or employee_id = private.current_employee_id()
  );

-- hr_policy: dibaca semua aktor aktif -----------------------------------
create policy hr_policy_read on public.hr_policy
  for select to authenticated using (private.is_active_actor());

-- Grants ------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
revoke all on all tables in schema public from anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;