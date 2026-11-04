-- IYPM encrypted sync relay v2 hardening migration.
-- Apply only to the intended hosted relay after reviewing docs/SYNC_V2_STATUS.md.
-- The new-space claim limit is service-wide; trusted gateway rate limiting is still
-- required before public launch. Do not trust client-supplied forwarding headers.
-- This migration is not applied by repository automation.

create index if not exists sync_rate_limit_window_idx
  on public.sync_rate_limit (window_start);

alter table public.sync_spaces enable row level security;
alter table public.sync_records enable row level security;
alter table public.sync_rate_limit enable row level security;
revoke all on table public.sync_spaces from public, anon, authenticated;
revoke all on table public.sync_records from public, anon, authenticated;
revoke all on table public.sync_rate_limit from public, anon, authenticated;

create or replace function public.check_rate_limit(p_space text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.sync_rate_limit
  where window_start < now() - interval '2 hours';

  insert into public.sync_rate_limit (space, window_start, request_count)
  values (p_space, date_trunc('minute', now()), 1)
  on conflict (space, window_start) do update
  set request_count = sync_rate_limit.request_count + 1
  returning request_count into v_count;

  return v_count <= 100;
end;
$$;
revoke execute on function public.check_rate_limit(text) from public, anon;

create or replace function public.sync_claim(p_space text, p_auth_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_space is null or p_space !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid space';
  end if;
  if p_auth_hash is null or p_auth_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid auth hash';
  end if;

  if exists (select 1 from public.sync_spaces where space = p_space) then
    if not exists (
      select 1 from public.sync_spaces
      where space = p_space and auth_hash = p_auth_hash
    ) then
      return false;
    end if;
    if not public.check_rate_limit(p_space) then
      raise exception 'rate limit exceeded' using errcode = 'P0001';
    end if;
    return true;
  end if;

  if not public.check_rate_limit('__new_space_claims__') then
    raise exception 'rate limit exceeded' using errcode = 'P0001';
  end if;
  if (select count(*) from public.sync_spaces) >= 100000 then
    raise exception 'space cap reached';
  end if;

  insert into public.sync_spaces (space, auth_hash)
  values (p_space, p_auth_hash)
  on conflict (space) do nothing;

  if exists (select 1 from public.sync_spaces where space = p_space and auth_hash <> p_auth_hash) then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.sync_pull(
  p_space text,
  p_auth_hash text,
  p_since_seq bigint default 0,
  p_limit integer default 200
)
returns table (
  collection text,
  rid text,
  version bigint,
  seq bigint,
  payload text,
  deleted boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.sync_spaces
    where space = p_space and auth_hash = p_auth_hash
  ) then
    raise exception 'unauthorized';
  end if;
  if not public.check_rate_limit(p_space) then
    raise exception 'rate limit exceeded' using errcode = 'P0001';
  end if;

  return query
    select r.collection, r.rid, r.version, r.seq, r.payload, r.deleted, r.updated_at
    from public.sync_records r
    where r.space = p_space and r.seq > p_since_seq
    order by r.seq asc
    limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;

create or replace function public.sync_push(
  p_space text,
  p_auth_hash text,
  p_records jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec jsonb;
  results jsonb := '[]'::jsonb;
  cur_version bigint;
  incoming_version bigint;
  incoming_collection text;
  incoming_rid text;
  incoming_payload text;
  incoming_version_text text;
  incoming_deleted boolean;
  status text;
begin
  if not exists (
    select 1 from public.sync_spaces
    where space = p_space and auth_hash = p_auth_hash
  ) then
    raise exception 'unauthorized';
  end if;
  if not public.check_rate_limit(p_space) then
    raise exception 'rate limit exceeded' using errcode = 'P0001';
  end if;

  if p_records is null or jsonb_typeof(p_records) is distinct from 'array' then
    return jsonb_build_array(jsonb_build_object(
      'status', 'error',
      'message', 'records must be an array'
    ));
  end if;
  if jsonb_array_length(p_records) > 50 then
    return jsonb_build_array(jsonb_build_object(
      'status', 'error',
      'message', 'batch exceeds 50 records'
    ));
  end if;

  for rec in select * from jsonb_array_elements(p_records) loop
    incoming_collection := rec->>'collection';
    incoming_rid := rec->>'rid';
    incoming_payload := rec->>'payload';
    incoming_version_text := rec->>'version';
    cur_version := null;

    if incoming_collection is null or incoming_collection not in ('playlists', 'history', 'settings', 'devices')
       or incoming_rid is null or incoming_rid !~ '^[0-9a-f]{32}$'
       or incoming_payload is null or octet_length(incoming_payload) = 0 then
      results := results || jsonb_build_array(jsonb_build_object(
        'collection', incoming_collection,
        'rid', incoming_rid,
        'status', 'error',
        'message', 'missing or invalid fields'
      ));
      continue;
    end if;

    if incoming_version_text is null or incoming_version_text !~ '^[0-9]{1,19}$' then
      results := results || jsonb_build_array(jsonb_build_object(
        'collection', incoming_collection,
        'rid', incoming_rid,
        'status', 'error',
        'message', 'invalid version'
      ));
      continue;
    end if;
    begin
      incoming_version := incoming_version_text::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      results := results || jsonb_build_array(jsonb_build_object(
        'collection', incoming_collection,
        'rid', incoming_rid,
        'status', 'error',
        'message', 'invalid version'
      ));
      continue;
    end;

    if incoming_version < 1 then
      results := results || jsonb_build_array(jsonb_build_object(
        'collection', incoming_collection,
        'rid', incoming_rid,
        'status', 'error',
        'message', 'version must be positive'
      ));
      continue;
    end if;
    if rec ? 'deleted' and jsonb_typeof(rec->'deleted') <> 'boolean' then
      results := results || jsonb_build_array(jsonb_build_object(
        'collection', incoming_collection,
        'rid', incoming_rid,
        'status', 'error',
        'message', 'deleted must be a boolean'
      ));
      continue;
    end if;
    incoming_deleted := coalesce((rec->>'deleted')::boolean, false);
    if octet_length(incoming_payload) > 200000 then
      results := results || jsonb_build_array(jsonb_build_object(
        'collection', incoming_collection,
        'rid', incoming_rid,
        'status', 'error',
        'message', 'payload exceeds 200KB'
      ));
      continue;
    end if;
    if incoming_version > (extract(epoch from now()) * 1000)::bigint + 86400000 then
      results := results || jsonb_build_array(jsonb_build_object(
        'collection', incoming_collection,
        'rid', incoming_rid,
        'status', 'error',
        'message', 'version too far in future'
      ));
      continue;
    end if;

    insert into public.sync_records as current_record (space, collection, rid, version, payload, deleted)
    values (p_space, incoming_collection, incoming_rid, incoming_version, incoming_payload, incoming_deleted)
    on conflict (space, collection, rid) do update
    set version = excluded.version,
        payload = excluded.payload,
        deleted = excluded.deleted,
        updated_at = now(),
        seq = nextval(pg_get_serial_sequence('public.sync_records', 'seq'))
    where excluded.version > current_record.version
    returning version into cur_version;

    if found then
      status := 'ok';
    else
      select version into cur_version
      from public.sync_records
      where space = p_space and collection = incoming_collection and rid = incoming_rid;
      status := 'conflict';
    end if;

    results := results || jsonb_build_array(jsonb_build_object(
      'collection', incoming_collection,
      'rid', incoming_rid,
      'status', status,
      'current_version', cur_version
    ));
  end loop;

  return results;
end;
$$;

create or replace function public.sync_delete_space(p_space text, p_auth_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.sync_spaces
    where space = p_space and auth_hash = p_auth_hash
  ) then
    return false;
  end if;
  if not public.check_rate_limit(p_space) then
    raise exception 'rate limit exceeded' using errcode = 'P0001';
  end if;
  delete from public.sync_spaces where space = p_space;
  return true;
end;
$$;

revoke execute on function public.sync_claim(text, text) from public;
revoke execute on function public.sync_pull(text, text, bigint, integer) from public;
revoke execute on function public.sync_push(text, text, jsonb) from public;
revoke execute on function public.sync_delete_space(text, text) from public;
grant execute on function public.sync_claim(text, text) to anon;
grant execute on function public.sync_pull(text, text, bigint, integer) to anon;
grant execute on function public.sync_push(text, text, jsonb) to anon;
grant execute on function public.sync_delete_space(text, text) to anon;
