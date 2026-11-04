-- Fix: sync_push failed with 400 because `seq` is an identity column defined
-- as GENERATED ALWAYS, which can only be updated to DEFAULT.
-- Replace the nextval() assignment with DEFAULT so Postgres generates the next
-- identity value on conflict updates.
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

  for rec in select * from jsonb_array_elements(coalesce(p_records, '[]'::jsonb)) loop
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
        seq = DEFAULT
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
