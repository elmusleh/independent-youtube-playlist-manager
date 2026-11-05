-- Trusted-client-IP rate limiting for the encrypted sync relay.
-- Apply only after docs/migrations/0002_rate_limit_and_push_validation.sql.
-- Strategy: prefer cf-connecting-ip (Cloudflare strips & overwrites it with the real
-- client socket IP, so it cannot be spoofed). Fall back to the LAST hop in
-- X-Forwarded-For (appended by the gateway). Fail closed if neither is present.
-- Never trust the first value in X-Forwarded-For (caller-controlled).

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
  v_cf_ip text;
  v_forwarded_for text;
  v_client_ip_text text;
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

  -- Prefer cf-connecting-ip: Cloudflare strips and overwrites this header with the
  -- real client socket IP, so it cannot be spoofed by the caller. Fall back to the
  -- LAST value in X-Forwarded-For (the hop appended by the gateway), never the
  -- first value (which the caller controls). Fail closed if neither is available.
  v_cf_ip := nullif(trim(v_headers ->> 'cf-connecting-ip'), '');
  v_forwarded_for := nullif(trim(v_headers ->> 'x-forwarded-for'), '');

  if v_cf_ip is not null then
    v_client_ip_text := v_cf_ip;
  elsif v_forwarded_for is not null then
    -- The gateway appends the real client IP to the RIGHT of any caller-supplied
    -- values, so the trusted hop is the last comma-separated entry.
    v_client_ip_text := nullif(trim((string_to_array(v_forwarded_for, ','))[array_length(string_to_array(v_forwarded_for, ','), 1)]), '');
  else
    v_client_ip_text := null;
  end if;

  if v_client_ip_text is null then
    raise sqlstate 'PGRST'
      using message = '{"code":"client_ip_unavailable","message":"Sync relay requires a gateway-verified client IP"}',
            detail = '{"status":403,"headers":{}}';
  end if;

  begin
    v_client_ip := v_client_ip_text::inet;
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
