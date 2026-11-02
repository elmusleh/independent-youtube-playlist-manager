-- IYPM sync relay — one-shot schema for Supabase.
-- Run this in the SQL Editor of your Supabase project. It is idempotent.

create table if not exists public.sync_snapshots (
  address text primary key,
  blob text not null,
  revision bigint not null default 0,
  device_id text,
  updated_at timestamptz not null default now()
);

alter table public.sync_snapshots enable row level security;

-- The address is SHA-256 of a 100-bit sync key (a bearer token) and the blob is
-- AES-256-GCM ciphertext, so the anonymous policy is safe: nothing readable is stored.
drop policy if exists "sync_anon_select" on public.sync_snapshots;
create policy "sync_anon_select" on public.sync_snapshots
  for select using (true);

drop policy if exists "sync_anon_insert" on public.sync_snapshots;
create policy "sync_anon_insert" on public.sync_snapshots
  for insert with check (true);

drop policy if exists "sync_anon_update" on public.sync_snapshots;
create policy "sync_anon_update" on public.sync_snapshots
  for update using (true) with check (true);
