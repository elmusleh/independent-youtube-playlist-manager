# Data Compatibility & Migration Policy

> **Purpose:** Ensure that any future release of IYPM (including the planned Smart TV companion app) never causes data loss for existing users, regardless of upgrade timing or device mix.

---

## Core Principles

1. **Additive Only** — New fields, keys, tables, and stores may be added. Existing ones are never renamed or removed without a deprecation window.
2. **Forward-Compatible Reads** — New code must tolerate data written by old code (missing fields → sensible defaults via normalizers).
3. **Backward-Migrating Writes** — Old code reading data written by new code must not crash; unknown fields are ignored.
4. **No Silent Data Loss** — Storage migrations must preserve existing data. Wiping or recreating stores is forbidden.
5. **Rolling-Upgrade Safe** — Mixed versions (some users on 1.2, some on 1.3) must sync without breaking.

---

## Storage Layers & Rules

### 1. IndexedDB (`yph_metadata_db_v2`, store: `metadata`)

- **DB_VERSION** lives in `db-service-core.ts`. Bumping it triggers `onupgradeneeded`.
- **Migration registry** is in the `onupgradeneeded` handler. Add a case for each version bump.
- **Rule:** Migrations are additive. Create new stores if needed; never `db.deleteObjectStore()` on existing stores. Migrate data in-place.
- **Normalizers** (`normalizeVideoMeta`) fill defaults for any missing fields, so old records read by new code always work.

### 2. `browser.storage.local` / `browser.storage.sync`

- **Keys:** `playlists`, `yph_local_playlists`, `local_yt_history`, `yph_settings`, `yph_sync_state`.
- **Rule:** Never rename a key. If a new structure is needed, add a new key and keep reading the old one as a fallback.
- **Deprecation:** Old keys may be marked deprecated in comments but must remain readable for at least 2 major versions.

### 3. Backup Format (`schemaVersion`)

- Current: `CURRENT_SCHEMA_VERSION = 2` in `backup-service.ts`.
- **Accept:** Any version `1 <= v <= CURRENT`. Migrate in-memory during import.
- **Reject:** Versions `> CURRENT` ("upgrade your app first") and non-integer/`< 1` versions.
- **Rule:** When bumping `CURRENT_SCHEMA_VERSION`, add a migration case in `importFullDatabaseBackup` and update `validateBackupSchema` to accept the new range. Never remove acceptance of old versions.

### 4. Sync Snapshots (`SNAPSHOT_SCHEMA_VERSION`)

- Current: `SNAPSHOT_SCHEMA_VERSION = 1` in `snapshot-codec.ts`.
- **Accept:** Any version `1 <= v <= SNAPSHOT_SCHEMA_VERSION`. Migrate via `migrateSnapshot()`.
- **Reject:** Versions `> SNAPSHOT_SCHEMA_VERSION` ("upgrade your app first").
- **Rule:** When bumping, add a migration case in `migrateSnapshot()`. Migration must be purely additive.

### 5. Supabase (Cloud Sync)

- **Rule:** Schema changes are additive only (new tables, new columns). Never rename or drop columns.
- **New features** (e.g., TV device pairing) use entirely new tables (`device_codes`, `paired_devices`) that old clients simply ignore.
- **Row-Level Security (RLS):** New tables must have RLS policies that don't break existing queries.

---

## Checklist for Any Future Release

Before merging a PR that touches storage or sync:

- [ ] No storage keys renamed or removed
- [ ] No IndexedDB stores dropped without migration
- [ ] New fields have defaults in normalizers
- [ ] Backup schema version handling updated if format changed
- [ ] Sync snapshot version handling updated if envelope changed
- [ ] Supabase changes are additive (new tables/columns only)
- [ ] Old backups still import successfully (test with v1 and v2)
- [ ] Mixed-version sync tested (old client ↔ new client)

---

## What Breaks Users (and how to avoid it)

| Mistake                                  | Consequence                    | Prevention                      |
| ---------------------------------------- | ------------------------------ | ------------------------------- |
| Renaming a storage key                   | Old data invisible to new code | Add new key, keep reading old   |
| Dropping an IndexedDB store              | Total metadata cache loss      | Migrate in `onupgradeneeded`    |
| Strict version equality on sync          | Mixed-version sync fails       | Accept `<= current`, migrate    |
| Requiring a new field without default    | Old records fail normalization | Always default in normalizer    |
| Changing Supabase column type            | Old clients get type errors    | Add new column, deprecate old   |
| Bumping backup version without migration | Old backups rejected           | Accept range, migrate in-memory |

---

## Smart TV App Considerations

The planned TV companion app is a **read-only consumer** of the same Supabase data. It must:

- Use the same table schemas (no TV-specific columns in shared tables).
- Store device-pairing state in **new tables only** (`device_codes`, `paired_devices`).
- Never write to playlist/metadata tables — only read.
- Accept that desktop clients may write fields the TV app doesn't know about (ignore unknown fields).

This ensures the TV app can be developed and released independently without risking desktop user data.
