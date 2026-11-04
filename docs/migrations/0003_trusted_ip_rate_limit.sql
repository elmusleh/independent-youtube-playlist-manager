-- Trusted-client-IP rate limiting for the encrypted sync relay.
-- Apply only after docs/migrations/0002_rate_limit_and_push_validation.sql.
-- Supabase's API gateway must overwrite/normalize X-Forwarded-For; verify that
-- behavior on the hosted project before enabling public sync. Never trust a
-- client-controlled forwarding header from an untrusted proxy.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, authenticator;

create table if not exists private.sync_ip_rate_limit (
  client_ip inet not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (client_ip, window_start)
);
create index if not exists sync_ip_rate_limit_window_idx
  on private.sync_ip_rate_limit (window_start);
alter table private.sync_ip_rate_limit enable row level security;
revoke all on table private.sync_ip_rate_limit from public, anon, authenticated, authenticator;

create or replace function private.check_sync_client_ip_rate_limit()
returns void
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_headers jsonb;
  v_forwarded_for text;
  v_client_ip inet;
  v_window_start timestamptz;
  v_request_count integer;
  v_request_path text := current_setting('request.path', true);
begin
  -- Scope the budget to sync RPCs only; other API endpoints are unaffected.
  if v_request_path !~ '^/?rpc/sync_[a-z_]+$' then
    return;
  end if;

  v_headers := coalesce(current_setting('request.headers', true)::jsonb, '{}'::jsonb);
  v_forwarded_for := nullif(trim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), '');
  if v_forwarded_for is null then
    raise sqlstate 'PGRST'
      using message = '{"code":"client_ip_unavailable","message":"Sync relay requires a gateway-verified client IP"}',
            detail = '{"status":403,"headers":{}}';
  end if;

  begin
    v_client_ip := v_forwarded_for::inet;
  exception when invalid_text_representation then
    raise sqlstate 'PGRST'
      using message = '{"code":"client_ip_unavailable","message":"Sync relay requires a gateway-verified client IP"}',
            detail = '{"status":403,"headers":{}}';
  end;

  v_window_start := to_timestamp(floor(extract(epoch from clock_timestamp()) / 300) * 300);
  delete from private.sync_ip_rate_limit
  where window_start < clock_timestamp() - interval '1 day';

  insert into private.sync_ip_rate_limit (client_ip, window_start, request_count)
  values (v_client_ip, v_window_start, 1)
  on conflict (client_ip, window_start) do update
    set request_count = private.sync_ip_rate_limit.request_count + 1
  returning request_count into v_request_count;

  if v_request_count > 250 then
    raise sqlstate 'PGRST'
      using message = '{"code":"client_ip_rate_limited","message":"Sync relay client request rate limit exceeded"}',
            detail = '{"status":429,"headers":{"Retry-After":"300"}}';
  end if;
end;
$$;
revoke all on function private.check_sync_client_ip_rate_limit() from public;
grant execute on function private.check_sync_client_ip_rate_limit() to anon, authenticated, authenticator;

-- PostgREST invokes this hook before routing API requests. The Supabase gateway
-- must supply a trusted X-Forwarded-For value; direct clients cannot be allowed
-- to select their own rate-limit key.
alter role authenticator set pgrst.db_pre_request = 'private.check_sync_client_ip_rate_limit';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
