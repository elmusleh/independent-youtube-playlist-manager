# Supabase Relay Setup and Compatibility

## Important: v1 → v2 data transition is unresolved

Sync v1 stored one encrypted snapshot in `public.relay_snapshots`. Sync v2 uses the RPC-only `sync_spaces` / `sync_records` model, record-level IDs, HLC versions, and different key derivation. The formats are not wire-compatible; creating a v2 space does not migrate a v1 snapshot.

A **read-only probe of the configured IYPM hosted project on 2026-11-04** returned HTTP 404 for `relay_snapshots`. This establishes that the old table is currently unavailable through the API; it does **not** establish whether it previously held user rows or whether a Supabase backup can recover them. Direct anonymous reads of v2 tables returned 401, which is expected because v2 access is through RPCs only.

**Do not claim existing v1 users are migrated or data-safe.** Before public v2 rollout, the owner must verify whether a recoverable database backup exists and decide the recovery/announcement path. Users who still have an old device should export a full JSON backup from each device before changing its sync setup. Do not delete local data or treat an empty v2 space as proof the old cloud copy was empty.

## Fresh v2 relay setup

For a **new** Supabase project:

1. Run [`sync-relay-v2.sql`](./sync-relay-v2.sql) once in the Supabase SQL editor. It creates the v2 tables, RPCs, RLS, and server-side guards. This is a bootstrap schema, not a migration for an existing v1 database.
2. Apply numbered migrations in order when they are not already included in the bootstrap schema. Check each migration's preconditions and read the resulting catalog state back; `CREATE TABLE IF NOT EXISTS` does not alter an existing table.
3. Before public use, configure and verify a trusted gateway-level client-IP limit. `docs/migrations/0003_trusted_ip_rate_limit.sql` depends on the gateway overwriting `X-Forwarded-For`; never trust a client-supplied forwarding header. The local Postgres/PostgREST test fixture does not prove a hosted gateway is configured correctly.
4. Enter the project URL and public/anon key in the extension's **Your own Supabase project** settings. The anon key is public; do not enter a service-role key. Sync payloads must be encrypted on-device before they reach the backend.

For a **new v2 deployment**, verify that `sync_claim`, `sync_pull`, `sync_push`, and `sync_delete_space` are present, direct anonymous table access is denied, and the expected RLS is enabled. Do not publish the relay as ready until trusted-rate-limit behavior is verified on the actual hosted gateway.

## Existing v1 projects

- Do not run the v2 bootstrap file as a migration, and do not drop `relay_snapshots` as cleanup.
- If `relay_snapshots` still exists in a self-hosted project, preserve it until a client-side decrypt-and-migrate procedure is available and verified.
- If it is already absent, recovery requires a database backup/PITR restore or another device/local backup that still has the data. The extension cannot reconstruct an inaccessible encrypted snapshot.
- A supported transition must keep the v1 copy until the v2 records are written, read back, decrypted, and verified. Only then may a separately reviewed cleanup migration remove v1 storage.

See `docs/DATA_COMPATIBILITY.md` and `docs/SYNC_V2_STATUS.md` for current release gates. **Current status: NO-GO for claiming v1-to-v2 hosted data migration is complete.**
