-- 0004_seed.sql — data referensi + fixture fiktif (BUKAN data HR nyata).
-- Akun Auth (auth.users + user_profiles) dibuat oleh scripts/seed-supabase.mjs
-- memakai service role, karena auth.users harus melalui layanan Auth.

insert into public.departments (id, name) values
  ('d0000000-0000-4000-8000-000000000001', 'Human Resources'),
  ('d0000000-0000-4000-8000-000000000002', 'Engineering'),
  ('d0000000-0000-4000-8000-000000000003', 'Design'),
  ('d0000000-0000-4000-8000-000000000004', 'Marketing'),
  ('d0000000-0000-4000-8000-000000000005', 'Finance')
on conflict (id) do nothing;

insert into public.positions (id, name) values
  ('b0000000-0000-4000-8000-000000000001', 'HR Specialist'),
  ('b0000000-0000-4000-8000-000000000002', 'Frontend Developer'),
  ('b0000000-0000-4000-8000-000000000003', 'Backend Developer'),
  ('b0000000-0000-4000-8000-000000000004', 'Product Designer'),
  ('b0000000-0000-4000-8000-000000000005', 'UI Designer'),
  ('b0000000-0000-4000-8000-000000000006', 'Marketing Specialist'),
  ('b0000000-0000-4000-8000-000000000007', 'Finance Analyst'),
  ('b0000000-0000-4000-8000-000000000008', 'QA Engineer')
on conflict (id) do nothing;

insert into public.employees
  (id, employee_no, full_name, work_email, department_id, position_id, employment_status, joined_on)
values
  ('e0000000-0000-4000-8000-000000000001', 'EMP-001', 'Nadia Putri', 'nadia.putri@example.test',
   'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'ACTIVE', '2025-01-06'),
  ('e0000000-0000-4000-8000-000000000002', 'EMP-002', 'Rizky Pratama', 'rizky.pratama@example.test',
   'd0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'ACTIVE', '2025-01-06'),
  ('e0000000-0000-4000-8000-000000000003', 'EMP-003', 'Alya Maharani', 'alya.maharani@example.test',
   'd0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004', 'ACTIVE', '2025-01-06'),
  ('e0000000-0000-4000-8000-000000000004', 'EMP-004', 'Dimas Saputra', 'dimas.saputra@example.test',
   'd0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', 'ACTIVE', '2025-01-06'),
  ('e0000000-0000-4000-8000-000000000005', 'EMP-005', 'Citra Lestari', 'citra.lestari@example.test',
   'd0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000006', 'ACTIVE', '2025-01-06'),
  ('e0000000-0000-4000-8000-000000000006', 'EMP-006', 'Fajar Ramadhan', 'fajar.ramadhan@example.test',
   'd0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000007', 'ACTIVE', '2025-01-06'),
  ('e0000000-0000-4000-8000-000000000007', 'EMP-007', 'Salsa Amalia', 'salsa.amalia@example.test',
   'd0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000005', 'ACTIVE', '2025-01-06'),
  ('e0000000-0000-4000-8000-000000000008', 'EMP-008', 'Bima Aditya', 'bima.aditya@example.test',
   'd0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000008', 'INACTIVE', '2025-01-06'),
  -- Identitas penguji (fixture) — ditempatkan di HR agar tidak masuk tim Manager Eng.
  ('e0000000-0000-4000-8000-000000000009', 'EMP-009', 'Penguji Nonaktif', 'penguji.disabled@example.test',
   'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'INACTIVE', '2025-01-06'),
  ('e0000000-0000-4000-8000-000000000010', 'EMP-010', 'Penguji Undangan', 'penguji.invited@example.test',
   'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'INACTIVE', '2025-01-06')
on conflict (id) do nothing;

insert into public.employee_contacts (employee_id, phone, address) values
  ('e0000000-0000-4000-8000-000000000001', '081200000001', 'Bandung (alamat contoh)'),
  ('e0000000-0000-4000-8000-000000000002', '081200000002', 'Bandung (alamat contoh)'),
  ('e0000000-0000-4000-8000-000000000003', '081200000003', 'Bandung (alamat contoh)'),
  ('e0000000-0000-4000-8000-000000000004', '081200000004', 'Bandung (alamat contoh)'),
  ('e0000000-0000-4000-8000-000000000005', '081200000005', 'Bandung (alamat contoh)'),
  ('e0000000-0000-4000-8000-000000000006', '081200000006', 'Bandung (alamat contoh)'),
  ('e0000000-0000-4000-8000-000000000007', '081200000007', 'Bandung (alamat contoh)'),
  ('e0000000-0000-4000-8000-000000000008', '081200000008', 'Bandung (alamat contoh)'),
  ('e0000000-0000-4000-8000-000000000009', '081200000009', 'Bandung (alamat contoh)'),
  ('e0000000-0000-4000-8000-000000000010', '081200000010', 'Bandung (alamat contoh)')
on conflict (employee_id) do nothing;

insert into private.employee_compensation (employee_id, base_salary_idr) values
  ('e0000000-0000-4000-8000-000000000001', 7500000),
  ('e0000000-0000-4000-8000-000000000002', 9000000),
  ('e0000000-0000-4000-8000-000000000003', 8500000),
  ('e0000000-0000-4000-8000-000000000004', 9500000),
  ('e0000000-0000-4000-8000-000000000005', 7000000),
  ('e0000000-0000-4000-8000-000000000006', 8000000),
  ('e0000000-0000-4000-8000-000000000007', 8000000),
  ('e0000000-0000-4000-8000-000000000008', 7500000),
  ('e0000000-0000-4000-8000-000000000009', 7500000),
  ('e0000000-0000-4000-8000-000000000010', 7500000)
on conflict (employee_id) do nothing;

insert into public.annual_leave_entitlements (employee_id, year, entitlement_days)
select e.id, 2026, 12 from public.employees e
on conflict (employee_id, year) do nothing;

-- Contoh pengajuan cuti (PENDING untuk anggota tim Engineering) ------------
insert into public.leave_requests
  (id, employee_id, type, start_date, end_date, working_days, reason, status,
   policy_version, policy_snapshot)
values
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
   'ANNUAL', '2026-10-05', '2026-10-06', 2, 'Keperluan keluarga', 'PENDING', 1,
   jsonb_build_object('timezone', 'Asia/Jakarta'))
on conflict (id) do nothing;

-- Contoh presensi (hari contoh) --------------------------------------------
insert into public.attendances
  (id, employee_id, work_date, check_in_at, check_out_at, status, policy_version, policy_snapshot)
values
  ('a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004',
   date '2026-09-30', timestamptz '2026-09-30 01:04:00+00', timestamptz '2026-09-30 10:00:00+00',
   'LATE', 1, jsonb_build_object('timezone', 'Asia/Jakarta'))
on conflict (id) do nothing;

-- Fixture fiktif selesai. Contoh di atas adalah ilustrasi, bukan kebijakan HR final.