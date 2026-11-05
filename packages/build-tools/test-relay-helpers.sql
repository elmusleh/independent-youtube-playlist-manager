-- Local-only PostgREST test helper. Never apply this file to hosted databases.
create or replace function public.test_reset_sync_rate_limit()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.sync_rate_limit;
$$;

revoke execute on function public.test_reset_sync_rate_limit() from public;
grant execute on function public.test_reset_sync_rate_limit() to anon;
