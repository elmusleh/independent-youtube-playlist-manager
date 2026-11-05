-- LEGACY V1 ONLY: single encrypted snapshot relay. Do not use for a v2 client or new
-- deployment; use sync-relay-v2.sql and the current numbered migrations instead.
-- The hosted IYPM endpoint currently returns 404 for relay_snapshots; any old rows are
-- not migrated by this file. See SYNC_RELAY_SETUP.md before making a v1/v2 transition.

create table if not exists public.relay_snapshots (
  address text primary key,
  payload text not null,
  revision bigint not null default 0,
  device_id text,
  updated_at timestamptz not null default now()
);

alter table public.relay_snapshots enable row level security;

-- The address is SHA-256 of a 100-bit sync key (a bearer token) and the payload is
-- AES-256-GCM ciphertext, so the anonymous policy is safe: nothing readable is stored.
-- Known limitation: these open policies also let anyone overwrite or delete rows. The
-- hardened RPC-only relay (SYNC_HARDENING_PLAN.md, Phase 2) replaces them.
drop policy if exists "sync_anon_select" on public.relay_snapshots;
create policy "sync_anon_select" on public.relay_snapshots
  for select using (true);

drop policy if exists "sync_anon_insert" on public.relay_snapshots;
create policy "sync_anon_insert" on public.relay_snapshots
  for insert with check (true);

drop policy if exists "sync_anon_update" on public.relay_snapshots;
create policy "sync_anon_update" on public.relay_snapshots
  for update using (true) with check (true);

-- SQL Editor-created tables may not inherit the API role grants used by the dashboard.
grant select, insert, update on table public.relay_snapshots to anon;
