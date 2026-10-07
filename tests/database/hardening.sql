-- Mandatory final exception rolls back ALL changes, including audit events.
create temporary table regression_results(label text);
create function pg_temp.check_result(label text,passed boolean) returns void language plpgsql as $$
begin
  if passed is distinct from true then raise exception 'REGRESSION_FAILED: %',label; end if;
  insert into pg_temp.regression_results values(label);
end $$;
create function pg_temp.expect_error(label text,statement text,expected text) returns void language plpgsql as $$
declare code text;
begin
  begin execute statement; exception when others then code:=sqlerrm; end;
  perform pg_temp.check_result(label,code=expected or (expected='PERMISSION' and code like 'permission denied%'));
end $$;
grant all on pg_temp.regression_results to authenticated,service_role;
do $tests$
declare hr uuid; manager uuid; emp uuid; disabled uuid; invited uuid; inactive uuid;
  emp_id uuid:='e0000000-0000-4000-8000-000000000002';
  hr_id uuid:='e0000000-0000-4000-8000-000000000001';
  account public.user_profiles; run public.payroll_runs; item public.payroll_items;
  leave_row public.leave_requests; review public.performance_reviews; employee public.employees;
  contact public.employee_contacts; salary bigint; v integer; claim jsonb;
begin
  select user_id into strict hr from public.user_profiles where employee_id=hr_id;
  select user_id into strict emp from public.user_profiles where employee_id=emp_id;
  select user_id into strict manager from public.user_profiles where employee_id='e0000000-0000-4000-8000-000000000004';
  select user_id into strict disabled from public.user_profiles where account_status='DISABLED';
  select user_id into strict invited from public.user_profiles where account_status='INVITED';
  select user_id into strict inactive from public.user_profiles where employee_id='e0000000-0000-4000-8000-000000000008';
  perform set_config('request.jwt.claim.sub',hr::text,true); execute 'set local role authenticated';
  perform pg_temp.check_result('HR compensation RPC',public.employee_compensation_for_hr(emp_id)>0);
  select public.write_master('positions',null,'Regression unused master',null) into claim;
  perform pg_temp.check_result('Audited master create',claim->>'name'='Regression unused master');
  select public.write_master('positions',(claim->>'id')::uuid,'Regression renamed master',(claim->>'version')::integer) into claim;
  perform pg_temp.check_result('Versioned master rename',(claim->>'version')::integer=2);
  perform pg_temp.expect_error('Master direct mutation denied','update public.positions set name=name','PERMISSION');
  perform pg_temp.expect_error('Direct employee writes denied',format('update public.employees set full_name=full_name where id=%L',emp_id),'PERMISSION');
  perform pg_temp.expect_error('TRUNCATE denied','truncate public.employees cascade','PERMISSION');
  select version into v from public.employees where id=hr_id;
  perform pg_temp.expect_error('HR cannot deactivate own employee',format('select public.update_employee(%L,%s,p_employment_status=>''INACTIVE'')',hr_id,v),'FORBIDDEN');
  perform pg_temp.expect_error('Null employee version rejected',format('select public.update_employee(%L,null)',emp_id),'VALIDATION_ERROR');
  select * into account from public.user_profiles where user_id=hr;
  perform pg_temp.expect_error('HR cannot demote own account',format('select public.update_account(%L,''EMPLOYEE'',null,%s)',hr,account.version),'FORBIDDEN');
  perform pg_temp.expect_error('Null account version rejected',format('select public.update_account(%L,null,null,null)',hr),'VALIDATION_ERROR');
  select version into v from public.employees where id=emp_id;
  perform pg_temp.expect_error('Linked Auth email protected',format('select public.update_employee(%L,%s,p_work_email=>''mismatch@example.test'')',emp_id,v),'VALIDATION_ERROR');
  select * into employee from public.create_employee('CI-ROLLBACK','Database regression','ci-rollback@example.test',
    'd0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','ACTIVE','2026-01-01','081234567890','Rollback',1234567);
  perform pg_temp.check_result('Atomic employee/contact/compensation',employee.id is not null and
    exists(select 1 from public.employee_contacts where employee_id=employee.id) and public.employee_compensation_for_hr(employee.id)=1234567);
  select * into run from public.create_payroll_run('2099-12');
  select * into item from public.payroll_items where payroll_run_id=run.id and employee_id=emp_id;
  select * into item from public.update_payroll_item(item.id,100,200,50,item.version);
  perform pg_temp.check_result('Payroll computation',item.net_salary_idr=item.base_salary_idr+250);
  salary:=item.base_salary_idr;
  select version into v from public.employees where id=emp_id;
  perform public.update_employee(emp_id,v,p_base_salary_idr=>salary+100);
  perform public.publish_payroll_run(run.id,run.version);
  select * into item from public.payroll_items where payroll_run_id=run.id and employee_id=emp_id;
  perform pg_temp.check_result('Publish refreshes compensation',item.base_salary_idr=salary+100 and item.net_salary_idr=salary+350);
  perform pg_temp.expect_error('Published payroll immutable',format('select public.update_payroll_item(%L,0,0,0,%s)',item.id,item.version),'PAYROLL_ALREADY_PUBLISHED');
  perform pg_temp.expect_error('Null publish version rejected',format('select public.publish_payroll_run(%L,null)',run.id),'VALIDATION_ERROR');
  select * into run from public.create_payroll_run('2099-11');
  select * into item from public.payroll_items where payroll_run_id=run.id and employee_id=emp_id;
  perform public.update_payroll_item(item.id,0,0,item.base_salary_idr,item.version);
  select version into v from public.employees where id=emp_id;
  perform public.update_employee(emp_id,v,p_base_salary_idr=>100);
  perform pg_temp.expect_error('Publish checks refreshed deduction',format('select public.publish_payroll_run(%L,%s)',run.id,run.version),'VALIDATION_ERROR');
  select public.claim_account_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',employee.id,'EMPLOYEE',repeat('a',64)) into claim;
  perform pg_temp.check_result('Private invitation claim',claim->>'state'='PROCESSING' and claim->>'operationId' is not null);
  perform pg_temp.expect_error('Same key does not resend',format('select public.claim_account_invitation(''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',%L,''EMPLOYEE'',repeat(''a'',64))',employee.id),'OPERATION_IN_PROGRESS');
  perform pg_temp.expect_error('Invitation payload conflict',format('select public.claim_account_invitation(''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',%L,''MANAGER'',repeat(''b'',64))',employee.id),'IDEMPOTENCY_CONFLICT');
  perform pg_temp.expect_error('Public cannot finalize invitation',format('select public.finish_account_invitation(%L,%L)',claim->>'operationId',emp),'PERMISSION');
  perform set_config('request.jwt.claim.sub',emp::text,true);
  perform pg_temp.expect_error('Employee salary access denied',format('select public.employee_compensation_for_hr(%L)',emp_id),'FORBIDDEN');
  perform pg_temp.expect_error('Direct contact writes denied',format('update public.employee_contacts set phone=phone where employee_id=%L',emp_id),'PERMISSION');
  select * into contact from public.employee_contacts where employee_id=emp_id;
  select version into v from public.employees where id=emp_id;
  perform public.update_own_contact(contact.version,'081234567890','Regression rollback');
  perform pg_temp.check_result('Contact bumps aggregate',(select version from public.employees where id=emp_id)=v+1);
  perform pg_temp.expect_error('Null contact version rejected','select public.update_own_contact(null,''081234567890'',''Rollback'')','VALIDATION_ERROR');
  select * into leave_row from public.create_leave_request('PERMISSION','2099-01-05','2099-01-05','Regression rollback');
  perform pg_temp.check_result('Leave creates pending working day',leave_row.status='PENDING' and leave_row.working_days=1);
  perform pg_temp.expect_error('Overlap rejected','select public.create_leave_request(''SICK'',''2099-01-05'',''2099-01-05'',''Overlap'')','LEAVE_OVERLAP');
  perform pg_temp.expect_error('Quota enforced','select public.create_leave_request(''ANNUAL'',''2099-02-02'',''2099-02-27'',''Quota'')','LEAVE_BALANCE_EXCEEDED');
  perform set_config('request.jwt.claim.sub',manager::text,true);
  perform pg_temp.check_result('Manager payroll hidden',(select count(*) from public.payroll_items)=0);
  perform pg_temp.expect_error('Manager leave bypass denied','select public.create_leave_request(''PERMISSION'',''2099-01-05'',''2099-01-05'',''Bypass'')','FORBIDDEN');
  perform public.decide_leave_request(leave_row.id,'REJECTED','Regression rollback',leave_row.version);
  perform pg_temp.check_result('Manager decision metadata',(select status='REJECTED' and decided_by=manager and decided_at is not null from public.leave_requests where id=leave_row.id));
  select * into review from public.upsert_performance_review(emp_id,'2099-12',80,'Regression rollback',null);
  perform public.upsert_performance_review(emp_id,'2099-12',81,'Updated regression',review.version);
  perform pg_temp.expect_error('Review stale version rejected',format('select public.upsert_performance_review(%L,''2099-12'',82,''Stale'',%s)',emp_id,review.version),'VERSION_CONFLICT');
  perform pg_temp.expect_error('Inactive review target denied','select public.upsert_performance_review(''e0000000-0000-4000-8000-000000000008'',''2099-12'',80,''Inactive'',null)','NOT_FOUND');
  foreach emp in array array[disabled,invited,inactive] loop
    perform set_config('request.jwt.claim.sub',emp::text,true);
    perform pg_temp.check_result('Inactive actor directory hidden: '||emp::text,(select count(*) from public.employees)=0);
    perform pg_temp.expect_error('Inactive balance denied: '||emp::text,format('select public.leave_balance((select employee_id from public.user_profiles where user_id=%L),2026)',emp),'FORBIDDEN');
  end loop;
  execute 'reset role';
  raise exception 'HRIS_REGRESSION_PASS:%', (select count(*) from pg_temp.regression_results);
end $tests$;
