# Playlist Editor (Extension SPA)

The Svelte 5 + TypeScript single-page application that powers the extension's playlist editor UI. It compiles via Rollup into `../src/editor/` (`main.js`, `bundle.css`, `index.html`), which the extension shell loads.

> **Do not run commands from this directory for building the extension.** All build commands run from the **repository root** — see the [root README](../README.md) and [AGENTS.md](../../../AGENTS.md).

## Structure

- `src/App.svelte` — Root view router (Editor, Saved, Settings, History, Search)
- `src/services/` — Data layer: `video-service.ts` / `youtube-api.ts` (5-tier metadata pipeline), `db-service.ts` (IndexedDB), `storage-service.ts` (debounced persistence), `backup-service.ts` (JSON/CSV/M3U export), `schema-normalizer.ts`, `supabase-client.ts` / `supabase-sync.ts` (optional cloud sync)
- `src/types/` — Shared TypeScript models

## Commands (from repository root)

```bash
npm run watch                                  # Dev: Rollup watcher, rebuilds into src/editor/
npm run build                                  # Production build (extension + dist/ folders)
cd playlist-editor && npx svelte-check         # Type-check the SPA
```

## Conventions

- All storage writes go through `schema-normalizer.ts` sanitizers.
- High-frequency video metadata belongs in IndexedDB via `db-service.ts`, never in `browser.storage.local` (see [AGENTS.md](../../../AGENTS.md) storage rules).
- UI edits to playlists must trigger the debounced autosave in `storage-service.ts`.
