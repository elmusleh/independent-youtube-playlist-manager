-- Migration: add 200KB payload cap to sync_records
-- Run this against the live database. It is NOT idempotent on its own
-- because it checks for existing violations first.

-- Step 1: Check for oversized records (will fail loudly if any exist)
do $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.sync_records
  where octet_length(payload) > 200000;
  if v_count > 0 then
    raise exception 'Cannot add cap: % records exceed 200KB', v_count;
  end if;
end;
$$;

-- Step 2: Add the constraint (idempotent via DO block)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sync_records_payload_cap'
    and conrelid = 'public.sync_records'::regclass
  ) then
    alter table public.sync_records
      add constraint sync_records_payload_cap
      check (octet_length(payload) <= 200000);
  end if;
end;
$$;
