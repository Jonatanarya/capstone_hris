-- 0006_fix_attendance_check_in.sql — perbaikan bug runtime.
-- `case when ... end` bertipe text tidak bisa implicit ke kolom enum
-- public.attendance_status (ERROR 42804). Tambah cast eksplisit.
-- Idempoten: fungsi ditimpa dengan definisi yang sama + cast.

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
     (case when v_time > v_policy.work_start then 'LATE' else 'PRESENT' end)::public.attendance_status,
     v_policy.policy_version,
     jsonb_build_object('timezone', v_policy.timezone, 'workStart', v_policy.work_start,
                        'workEnd', v_policy.work_end))
  returning * into v_row;

  perform private.audit(v_actor, 'attendance.check_in', 'attendance', v_row.id, '{}'::jsonb);
  return v_row;
end;
$$;