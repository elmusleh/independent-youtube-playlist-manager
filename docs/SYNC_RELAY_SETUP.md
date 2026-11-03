# Sync Relay Setup (the "Recommended" backend)

The **Recommended (IYPM hosted)** sync option talks to a Supabase project you own. It is a
zero-knowledge relay: the extension uploads only **encrypted** blobs keyed by a SHA-256
address derived from the user's sync key, so the server cannot read anyone's playlists.

This guide stands up that relay in ~10 minutes, once.

## What you need

- A free [Supabase](https://supabase.com) account.
- ~5 minutes.

## Step 1 — create the project

1. Sign in to [supabase.com/dashboard](https://supabase.com/dashboard).
2. **New project**, give it a name (e.g. `iypm-sync`), pick any region, set a database
   password you keep.
3. Wait for the project to provision.

## Step 2 — create the table + policies

Open **SQL Editor** → **New query**, paste the contents of
[`sync-relay.sql`](./sync-relay.sql), and **Run**.

That creates the `relay_snapshots` table and enables row-level security with an
allow-anonymous policy. The policy is deliberately open (`using (true)`): the _address_
column is a one-way SHA-256 hash of a 100-bit sync key, so it is effectively a bearer token,
and the _payload_ column is AES-256-GCM ciphertext. Nothing readable is ever stored.
The open policy also lets anyone overwrite or delete rows; see `SYNC_HARDENING_PLAN.md`.

## Step 3 — copy the URL + anon key

1. In the dashboard, open **Settings → API**.
2. Copy **Project URL** and the **anon / public** key.

## Step 4 — wire them into the extension

Open `apps/browser-extension/playlist-manager/src/services/sync/sync-config.ts` and replace
the two placeholders:

```ts
export const RELAY_SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
export const RELAY_SUPABASE_ANON_KEY = "YOUR-ANON-KEY";
```

Rebuild (`npm run build`) and the **Recommended** backend works end-to-end.

## Security model

| Concern                | How it is handled                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Server reads playlists | Impossible — only ciphertext is stored; the key never leaves the device              |
| Someone finds a row    | The address is SHA-256 of a 100-bit key (unguessable); the blob is GCM-authenticated |
| Tampering              | Any changed byte fails GCM authentication and the sync is rejected                   |
| Cost                   | Free tier; a single small text row per sync key                                      |

## Notes

- The **Supabase BYO** and **File / Syncthing** backends do **not** need this — they work
  immediately (BYO uses the user's own project; File writes to a local folder).
- If you later want the relay to also support BYO-style "many projects", this same table
  shape works unchanged; only the endpoint differs.
