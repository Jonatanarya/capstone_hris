-- Service role only finalizes an HR-claimed invitation; private tables remain unexposed.
create or replace function public.claim_account_invitation(p_key uuid,p_employee uuid,p_role public.business_role,p_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare op private.operation_requests; employee public.employees;
begin
  perform private.lock_hr_write();
  if p_key is null or p_employee is null or p_role is null or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'VALIDATION_ERROR'; end if;
  select * into op from private.operation_requests where actor_user_id=auth.uid() and operation='account.invite' and idempotency_key=p_key for update;
  if found then
    if op.payload_hash<>p_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    if op.state='SUCCEEDED' then return jsonb_build_object('state',op.state,'account',op.result_account); end if;
    raise exception 'OPERATION_IN_PROGRESS';
  end if;
  select * into employee from public.employees where id=p_employee for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if employee.employment_status<>'ACTIVE' then raise exception 'VALIDATION_ERROR'; end if;
  if exists(select 1 from public.user_profiles where employee_id=p_employee) then raise exception 'DUPLICATE_EMAIL'; end if;
  if exists(select 1 from private.operation_requests where employee_id=p_employee and operation='account.invite'
    and state in ('PROCESSING','FAILED')) then raise exception 'OPERATION_IN_PROGRESS'; end if;
  insert into private.operation_requests(actor_user_id,operation,idempotency_key,payload_hash,employee_id,state,result_account)
    values(auth.uid(),'account.invite',p_key,p_hash,p_employee,'PROCESSING',jsonb_build_object('role',p_role)) returning * into op;
  return jsonb_build_object('state',op.state,'operationId',op.id,'email',employee.work_email);
end $$;

create or replace function public.finish_account_invitation(p_operation uuid,p_auth_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare op private.operation_requests; account public.user_profiles; email text; result jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(740701001::bigint);
  select * into op from private.operation_requests where id=p_operation and operation='account.invite' for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if op.state='SUCCEEDED' then
    if op.external_auth_user_id<>p_auth_user then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return op.result_account;
  end if;
  if p_auth_user is null or (op.external_auth_user_id is not null and op.external_auth_user_id<>p_auth_user) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  select e.work_email into email from public.employees e join auth.users u on lower(u.email)=lower(e.work_email)
    where e.id=op.employee_id and u.id=p_auth_user and e.employment_status='ACTIVE';
  if not found then raise exception 'VALIDATION_ERROR'; end if;
  insert into public.user_profiles(user_id,employee_id,role,account_status)
    values(p_auth_user,op.employee_id,(op.result_account->>'role')::public.business_role,'INVITED') returning * into account;
  result:=jsonb_build_object('userId',account.user_id,'employeeId',account.employee_id,'role',account.role,'accountStatus',account.account_status,'version',account.version);
  update private.operation_requests set state='SUCCEEDED',external_auth_user_id=p_auth_user,result_account=result,failure_code=null where id=op.id;
  perform private.audit(op.actor_user_id,'account.invite','user_profile',p_auth_user,jsonb_build_object('role',account.role));
  return result;
end $$;

create or replace function public.record_invitation_external(p_operation uuid,p_auth_user uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN'; end if;
  update private.operation_requests set external_auth_user_id=p_auth_user
    where id=p_operation and state='PROCESSING' and (external_auth_user_id is null or external_auth_user_id=p_auth_user);
  if not found then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
end $$;

create or replace function public.activate_invited_account(p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(740701001::bigint);
  if not exists(select 1 from auth.users u join public.user_profiles p on p.user_id=u.id join public.employees e on e.id=p.employee_id
    where u.id=p_user and u.email_confirmed_at is not null and coalesce(u.encrypted_password,'')<>'' and e.employment_status='ACTIVE') then
    raise exception 'FORBIDDEN'; end if;
  update public.user_profiles set account_status='ACTIVE' where user_id=p_user and account_status='INVITED';
  if found then perform private.audit(p_user,'account.activate','user_profile',p_user,'{}'); end if;
end $$;

revoke all on function public.claim_account_invitation(uuid,uuid,public.business_role,text),
  public.finish_account_invitation(uuid,uuid),public.record_invitation_external(uuid,uuid),public.activate_invited_account(uuid) from public,anon,authenticated;
grant execute on function public.claim_account_invitation(uuid,uuid,public.business_role,text) to authenticated;
grant execute on function public.finish_account_invitation(uuid,uuid),public.record_invitation_external(uuid,uuid),
  public.activate_invited_account(uuid) to service_role;
notify pgrst,'reload schema';
