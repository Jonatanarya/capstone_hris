-- 0005_tighten_active.sql — predikat "own" juga menuntut aktor aktif.
-- Menutup celah: akun DISABLED / karyawan INACTIVE tidak boleh membaca data
-- (termasuk barisnya sendiri) lewat Data API langsung.

drop policy if exists employees_read on public.employees;
create policy employees_read on public.employees
  for select to authenticated using (
    private.is_hr()
    or (private.is_manager() and department_id = private.current_department_id())
    or (private.is_active_actor() and id = private.current_employee_id())
  );

drop policy if exists employee_contacts_read on public.employee_contacts;
create policy employee_contacts_read on public.employee_contacts
  for select to authenticated using (
    private.is_hr()
    or (private.is_active_actor() and employee_id = private.current_employee_id())
  );

drop policy if exists employee_contacts_update on public.employee_contacts;
create policy employee_contacts_update on public.employee_contacts
  for update to authenticated
  using (private.is_hr() or (private.is_active_actor() and employee_id = private.current_employee_id()))
  with check (private.is_hr() or (private.is_active_actor() and employee_id = private.current_employee_id()));

drop policy if exists attendances_read on public.attendances;
create policy attendances_read on public.attendances
  for select to authenticated using (
    private.is_hr()
    or (private.is_manager() and employee_id in (
      select e.id from public.employees e where e.department_id = private.current_department_id()
    ))
    or (private.is_active_actor() and employee_id = private.current_employee_id())
  );

drop policy if exists leave_entitlements_read on public.annual_leave_entitlements;
create policy leave_entitlements_read on public.annual_leave_entitlements
  for select to authenticated using (
    private.is_hr()
    or (private.is_active_actor() and employee_id = private.current_employee_id())
  );

drop policy if exists leave_requests_read on public.leave_requests;
create policy leave_requests_read on public.leave_requests
  for select to authenticated using (
    private.is_hr()
    or (private.is_manager() and employee_id in (
      select e.id from public.employees e where e.department_id = private.current_department_id()
    ))
    or (private.is_active_actor() and employee_id = private.current_employee_id())
  );

drop policy if exists payroll_runs_read on public.payroll_runs;
create policy payroll_runs_read on public.payroll_runs
  for select to authenticated using (
    private.is_hr()
    or (private.is_active_actor() and status = 'PUBLISHED' and exists (
      select 1 from public.payroll_items pi
      where pi.payroll_run_id = payroll_runs.id
        and pi.employee_id = private.current_employee_id()
    ))
  );

drop policy if exists payroll_items_read on public.payroll_items;
create policy payroll_items_read on public.payroll_items
  for select to authenticated using (
    private.is_hr()
    or (private.is_active_actor() and status = 'PUBLISHED' and employee_id = private.current_employee_id())
  );

drop policy if exists performance_reviews_read on public.performance_reviews;
create policy performance_reviews_read on public.performance_reviews
  for select to authenticated using (
    private.is_hr()
    or (private.is_manager() and employee_id in (
      select e.id from public.employees e where e.department_id = private.current_department_id()
    ))
    or (private.is_active_actor() and employee_id = private.current_employee_id())
  );