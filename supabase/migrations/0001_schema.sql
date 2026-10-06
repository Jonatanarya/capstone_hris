-- 0001_schema.sql — PeopleSpace HRIS
-- Rancangan tabel per docs/backend-handoff/02_DATABASE_DESIGN.md.
-- Satu organisasi; tanpa tenant id. ID UUID server-generated.

create extension if not exists pgcrypto;
create schema if not exists private;

-- Enums -------------------------------------------------------------------
create type business_role as enum ('ADMIN_HR', 'MANAGER', 'EMPLOYEE');
create type account_status as enum ('INVITED', 'ACTIVE', 'DISABLED');
create type employment_status as enum ('ACTIVE', 'INACTIVE');
create type master_status as enum ('ACTIVE', 'INACTIVE');
create type leave_type as enum ('ANNUAL', 'PERMISSION', 'SICK');
create type leave_status as enum ('PENDING', 'APPROVED', 'REJECTED');
create type payroll_status as enum ('DRAFT', 'PUBLISHED');
create type attendance_status as enum ('PRESENT', 'LATE');
create type provisioning_state as enum ('PROCESSING', 'SUCCEEDED', 'FAILED');

-- Trigger umum: updated_at + bump version bila kolom version ada -----------
create or replace function private.touch_updated_at_version()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if to_jsonb(old) ? 'version' then
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;

-- Master: departments & positions ------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '' and char_length(name) between 1 and 150),
  status master_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
create unique index departments_name_unique on public.departments (lower(btrim(name)));

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '' and char_length(name) between 1 and 150),
  status master_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
create unique index positions_name_unique on public.positions (lower(btrim(name)));

-- Employees (direktori tanpa gaji/kontak) ----------------------------------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_no text not null check (char_length(employee_no) between 1 and 30),
  full_name text not null check (btrim(full_name) <> '' and char_length(full_name) <= 150),
  work_email text not null,
  department_id uuid not null references public.departments(id) on delete restrict,
  position_id uuid not null references public.positions(id) on delete restrict,
  employment_status employment_status not null default 'ACTIVE',
  joined_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
create unique index employees_employee_no_unique on public.employees (upper(btrim(employee_no)));
create unique index employees_work_email_unique on public.employees (lower(btrim(work_email)));
create index employees_department_idx on public.employees (department_id);
create index employees_position_idx on public.employees (position_id);

-- user_profiles: role/status akun terproteksi -------------------------------
create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  employee_id uuid not null unique references public.employees(id) on delete restrict,
  role business_role not null,
  account_status account_status not null default 'INVITED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

-- employee_contacts: privat HR/pemilik -------------------------------------
create table public.employee_contacts (
  employee_id uuid primary key references public.employees(id) on delete restrict,
  phone text not null check (char_length(btrim(phone)) between 8 and 20),
  address text not null check (btrim(address) <> '' and char_length(address) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

-- employee_compensation (private): gaji pokok terkini ----------------------
create table private.employee_compensation (
  employee_id uuid primary key references public.employees(id) on delete restrict,
  base_salary_idr bigint not null check (base_salary_idr between 0 and 1000000000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

-- hr_policy: konfigurasi organisasi tunggal --------------------------------
create table public.hr_policy (
  id integer primary key default 1 check (id = 1),
  timezone text not null default 'Asia/Jakarta',
  work_start time not null default '08:00',
  work_end time not null default '17:00',
  working_days integer[] not null default '{1,2,3,4,5}',
  default_entitlement integer not null default 12 check (default_entitlement >= 0),
  policy_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.hr_policy (id) values (1) on conflict (id) do nothing;

-- attendances -------------------------------------------------------------- 
create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  work_date date not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  status attendance_status not null default 'PRESENT',
  policy_version integer not null,
  policy_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (employee_id, work_date),
  check (check_out_at is null or check_in_at is not null)
);
create index attendances_employee_date_idx on public.attendances (employee_id, work_date);

-- annual_leave_entitlements -------------------------------------------- 
create table public.annual_leave_entitlements (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  year integer not null check (year between 2000 and 2100),
  entitlement_days integer not null check (entitlement_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (employee_id, year)
);

-- leave_requests ------------------------------------------------------- 
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  type leave_type not null,
  start_date date not null,
  end_date date not null,
  working_days integer not null check (working_days >= 0),
  reason text not null check (btrim(reason) <> '' and char_length(reason) <= 2000),
  status leave_status not null default 'PENDING',
  submitted_at timestamptz not null default now(),
  decided_by uuid references public.user_profiles(user_id) on delete restrict,
  decided_at timestamptz,
  rejection_reason text,
  policy_version integer not null,
  policy_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  check (end_date >= start_date)
);
create index leave_requests_employee_status_idx on public.leave_requests (employee_id, status, start_date, end_date);

-- payroll_runs -----------------------------------------------------------
create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status payroll_status not null default 'DRAFT',
  published_at timestamptz,
  published_by uuid references public.user_profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (period)
);

-- payroll_items ---------------------------------------------------------
create table public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  employee_no text not null,
  full_name text not null,
  department_name text not null,
  position_name text not null,
  base_salary_idr bigint not null check (base_salary_idr between 0 and 1000000000000),
  allowance_idr bigint not null default 0 check (allowance_idr between 0 and 1000000000000),
  bonus_idr bigint not null default 0 check (bonus_idr between 0 and 1000000000000),
  deduction_idr bigint not null default 0 check (deduction_idr between 0 and 1000000000000),
  net_salary_idr bigint not null default 0 check (net_salary_idr between 0 and 1000000000000),
  status payroll_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  check (deduction_idr <= base_salary_idr + allowance_idr + bonus_idr),
  unique (payroll_run_id, employee_id)
);
create index payroll_items_employee_idx on public.payroll_items (employee_id, payroll_run_id);

-- performance_reviews ---------------------------------------------------
create table public.performance_reviews (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  score integer not null check (score between 0 and 100),
  notes text not null default '' check (char_length(notes) <= 2000),
  assessed_by uuid not null references public.user_profiles(user_id) on delete restrict,
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (employee_id, period)
);
create index performance_reviews_employee_period_idx on public.performance_reviews (employee_id, period);

-- private.audit_events (append-only) ------------------------------------
create table private.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  occurred_at timestamptz not null default now(),
  request_id text,
  changes jsonb not null default '{}'::jsonb
);
create index audit_events_resource_idx on private.audit_events (resource_type, resource_id, occurred_at);

-- private.operation_requests (bookkeeping undangan) ---------------------
create table private.operation_requests (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.user_profiles(user_id) on delete restrict,
  operation text not null,
  idempotency_key uuid not null,
  payload_hash text not null,
  employee_id uuid,
  external_auth_user_id uuid,
  state provisioning_state not null default 'PROCESSING',
  result_account jsonb,
  failure_code text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (actor_user_id, operation, idempotency_key)
);

-- Triggers updated_at/version -------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'departments','positions','employees','user_profiles','employee_contacts',
    'attendances','annual_leave_entitlements','leave_requests',
    'payroll_runs','payroll_items','performance_reviews'
  ] loop
    execute format(
      'create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at_version()',
      t, t
    );
  end loop;
end $$;

create trigger employee_compensation_touch before update on private.employee_compensation
  for each row execute function private.touch_updated_at_version();
create trigger operation_requests_touch before update on private.operation_requests
  for each row execute function private.touch_updated_at_version();