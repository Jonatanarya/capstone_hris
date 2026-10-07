-- Auth stand-ins only: the database job tests JWT/RLS semantics, NOT the Auth email service.
insert into auth.users(id,email,email_confirmed_at,encrypted_password)
select e.id,e.work_email,now(),'ci-only-not-a-real-password-hash' from public.employees e;
insert into public.user_profiles(user_id,employee_id,role,account_status)
select e.id,e.id,
  (case when e.id='e0000000-0000-4000-8000-000000000001' then 'ADMIN_HR' when e.id='e0000000-0000-4000-8000-000000000004' then 'MANAGER' else 'EMPLOYEE' end)::public.business_role,
  (case when e.id='e0000000-0000-4000-8000-000000000009' then 'DISABLED' when e.id='e0000000-0000-4000-8000-000000000010' then 'INVITED' else 'ACTIVE' end)::public.account_status
from public.employees e where e.id in ('e0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000005','e0000000-0000-4000-8000-000000000008','e0000000-0000-4000-8000-000000000009','e0000000-0000-4000-8000-000000000010');
