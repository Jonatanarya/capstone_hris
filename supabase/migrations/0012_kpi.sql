-- Additive, demo-scale monthly KPI. No seeded scores or changes to salary/auth.
create table public.kpi_assessments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  period text not null check (period ~ '^(20[0-9]{2}|2100)-(0[1-9]|1[0-2])$'),
  indicators jsonb not null,
  notes text not null default '',
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED')),
  score integer check (score between 0 and 100),
  created_by uuid not null references public.user_profiles(user_id),
  published_by uuid references public.user_profiles(user_id),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique(employee_id,period),
  check ((status='DRAFT' and score is null and published_at is null and published_by is null)
    or (status='PUBLISHED' and score is not null and published_at is not null and published_by is not null))
);
alter table public.performance_reviews add column kpi_id uuid references public.kpi_assessments(id);
alter table public.kpi_assessments enable row level security;
create policy kpi_read on public.kpi_assessments for select to authenticated using (
  private.is_active_actor() and (private.is_hr()
    or (employee_id=private.current_employee_id() and status='PUBLISHED')
    or (private.is_manager() and employee_id<>private.current_employee_id() and exists (
      select 1 from public.employees e where e.id=employee_id and e.department_id=private.current_department_id())))
);
revoke all on public.kpi_assessments from public,anon,authenticated;
grant select on public.kpi_assessments to authenticated;
grant all on public.kpi_assessments to service_role;

create function private.validate_kpi(p_items jsonb) returns void
language plpgsql set search_path='' as $$
declare item jsonb; weights numeric:=0; names text[]:=array[]::text[]; label text;
begin
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'VALIDATION_ERROR'; end if;
  if jsonb_array_length(p_items) not between 1 and 10 then raise exception 'VALIDATION_ERROR'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item)<>'object' then raise exception 'VALIDATION_ERROR'; end if;
    if exists(select 1 from jsonb_object_keys(item) k where k not in ('name','unit','direction','target','weight','actual'))
      or not (item ?& array['name','unit','direction','target','weight','actual']) then raise exception 'VALIDATION_ERROR'; end if;
    if jsonb_typeof(item->'name')<>'string' or length(btrim(item->>'name')) not between 1 and 120
      or jsonb_typeof(item->'unit')<>'string' or length(btrim(item->>'unit')) not between 1 and 30
      or jsonb_typeof(item->'direction')<>'string' or item->>'direction' not in ('HIGHER','LOWER')
      or jsonb_typeof(item->'target')<>'number' or jsonb_typeof(item->'weight')<>'number'
      or jsonb_typeof(item->'actual') not in ('number','null') then raise exception 'VALIDATION_ERROR'; end if;
    if (item->>'target')::numeric<=0 or (item->>'target')::numeric>1000000000
      or (item->>'weight')::numeric not between 1 and 100 or (item->>'weight')::numeric<>trunc((item->>'weight')::numeric)
      or (item->>'actual')::numeric<0 or (item->>'actual')::numeric>1000000000 then raise exception 'VALIDATION_ERROR'; end if;
    label:=lower(btrim(item->>'name'));
    if label=any(names) then raise exception 'VALIDATION_ERROR'; end if;
    names:=array_append(names,label); weights:=weights+(item->>'weight')::numeric;
  end loop;
  if weights<>100 then raise exception 'VALIDATION_ERROR'; end if;
end $$;

create function public.save_kpi(p_employee_id uuid,p_period text,p_indicators jsonb,p_notes text,p_expected_version integer)
returns public.kpi_assessments language plpgsql security definer set search_path='' as $$
declare existing public.kpi_assessments; result public.kpi_assessments;
begin
  if not private.is_manager() or p_employee_id=private.current_employee_id() then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(740701001::bigint);
  perform 1 from public.employees where id=p_employee_id and employment_status='ACTIVE'
    and department_id=private.current_department_id() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_period is null or p_period !~ '^(20[0-9]{2}|2100)-(0[1-9]|1[0-2])$' or p_notes is null or length(p_notes)>2000 then raise exception 'VALIDATION_ERROR'; end if;
  perform private.validate_kpi(p_indicators);
  select * into existing from public.kpi_assessments where employee_id=p_employee_id and period=p_period for update;
  if found then
    if p_expected_version is null or p_expected_version<>existing.version then raise exception 'VERSION_CONFLICT'; end if;
    if existing.status='PUBLISHED' then raise exception 'KPI_FINALIZED'; end if;
    update public.kpi_assessments set indicators=p_indicators,notes=btrim(p_notes),version=version+1,updated_at=now()
      where id=existing.id returning * into result;
  else
    if p_expected_version is not null then raise exception 'VERSION_CONFLICT'; end if;
    insert into public.kpi_assessments(employee_id,period,indicators,notes,created_by)
      values(p_employee_id,p_period,p_indicators,btrim(p_notes),auth.uid()) returning * into result;
  end if;
  perform private.audit(auth.uid(),'kpi.save','kpi_assessment',result.id,jsonb_build_object('before',to_jsonb(existing),'after',to_jsonb(result)));
  return result;
end $$;

create function public.publish_kpi(p_id uuid,p_expected_version integer,p_expected_review_version integer)
returns public.kpi_assessments language plpgsql security definer set search_path='' as $$
declare existing public.kpi_assessments; result public.kpi_assessments; target uuid; review public.performance_reviews; final_score integer;
begin
  if not private.is_manager() then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(740701001::bigint);
  select employee_id into target from public.kpi_assessments where id=p_id;
  if target is null then raise exception 'NOT_FOUND'; end if;
  if target=private.current_employee_id() then raise exception 'FORBIDDEN'; end if;
  perform 1 from public.employees where id=target and employment_status='ACTIVE' and department_id=private.current_department_id() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into existing from public.kpi_assessments where id=p_id for update;
  perform private.require_version(p_expected_version);
  if existing.version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if existing.status='PUBLISHED' then raise exception 'KPI_FINALIZED'; end if;
  perform private.validate_kpi(existing.indicators);
  if exists(select 1 from jsonb_array_elements(existing.indicators) i where i->>'actual' is null) then raise exception 'VALIDATION_ERROR'; end if;
  select round(sum(least(100::numeric,case when i->>'direction'='HIGHER' then (i->>'actual')::numeric/(i->>'target')::numeric*100
      when (i->>'actual')::numeric=0 then 100 else (i->>'target')::numeric/(i->>'actual')::numeric*100 end)*(i->>'weight')::numeric/100))::integer
    into final_score from jsonb_array_elements(existing.indicators) i;
  select * into review from public.performance_reviews where employee_id=target and period=existing.period for update;
  if (review.id is null and p_expected_review_version is not null)
    or (review.id is not null and (p_expected_review_version is null or p_expected_review_version<>review.version)) then raise exception 'VERSION_CONFLICT'; end if;
  -- Uses preserved core review implementation, atomically updates existing review with explicit version consent.
  select * into review from private.upsert_performance_review_v1(target,existing.period,final_score,
    coalesce(nullif(existing.notes,''),'Nilai final berdasarkan KPI berbobot.'),p_expected_review_version);
  update public.performance_reviews set kpi_id=existing.id where id=review.id;
  update public.kpi_assessments set status='PUBLISHED',score=final_score,published_at=now(),published_by=auth.uid(),
    version=version+1,updated_at=now() where id=existing.id returning * into result;
  perform private.audit(auth.uid(),'kpi.publish','kpi_assessment',result.id,jsonb_build_object('before',to_jsonb(existing),'after',to_jsonb(result)));
  return result;
end $$;

-- Preserve the previously hardened public review wrapper, then disallow manual edits after KPI finalization.
do $$ begin
  execute replace(pg_get_functiondef('public.upsert_performance_review(uuid,text,integer,text,integer)'::regprocedure),
    'FUNCTION public.upsert_performance_review(', 'FUNCTION private.upsert_review_before_kpi(');
end $$;
create or replace function public.upsert_performance_review(p_employee_id uuid,p_period text,p_score integer,p_notes text,p_expected_version integer)
returns public.performance_reviews language plpgsql security definer set search_path='' as $$
begin
  if not private.is_manager() then raise exception 'FORBIDDEN'; end if;
  perform 1 from public.employees where id=p_employee_id and employment_status='ACTIVE' and department_id=private.current_department_id() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if exists(select 1 from public.kpi_assessments where employee_id=p_employee_id and period=p_period and status='PUBLISHED') then raise exception 'KPI_FINALIZED'; end if;
  return private.upsert_review_before_kpi(p_employee_id,p_period,p_score,p_notes,p_expected_version);
end $$;
revoke all on function private.validate_kpi(jsonb), private.upsert_review_before_kpi(uuid,text,integer,text,integer) from public,anon,authenticated;
revoke all on function public.save_kpi(uuid,text,jsonb,text,integer), public.publish_kpi(uuid,integer,integer) from public,anon;
grant execute on function public.save_kpi(uuid,text,jsonb,text,integer), public.publish_kpi(uuid,integer,integer) to authenticated;
notify pgrst,'reload schema';
