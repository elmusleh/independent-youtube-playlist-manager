# Development Build & Test Workflow

## After ANY source code change

Always run the build before testing in the browser:

```bash
cd /home/steve/dev/independent-youtube-playlist-manager
npm run build
```

This compiles:

- Svelte SPA → `apps/browser-extension/editor/`
- Chrome extension → `dist/chrome/`
- Firefox extension → `dist/firefox/`
- Edge extension → `dist/edge/`

## Testing in browsers

After build completes:

1. **Chrome**: `chrome://extensions` → click reload icon on IYPM
2. **Firefox**: `about:debugging` → "This Firefox" → "Reload" button on IYPM
3. **Edge**: `edge://extensions` → click reload on IYPM

## Dev watch mode (auto-rebuild)

For active development, use watch mode instead of manual builds:

```bash
npm run watch
```

This auto-rebuilds the Svelte SPA on file save. You still need to reload the extension in the browser after each rebuild.

## Sync relay project

The sync relay is hosted on Supabase project `pfydngsbcmuhsqqjbcte` (IYPM project).

- Default relay URL: `https://pfydngsbcmuhsqqjbcte.supabase.co`
- Anon key: `sb_publishable_pKwO4ShF2yR1cufZA-2jfw_QsENS9vN`
- Do NOT use `mawqiei.net` (ref: `qvwitlpnetwthyhrobca`) for extension sync — it's a separate project.

## Sync data safety

- All sync data is encrypted on-device (AES-256-GCM) before reaching the relay
- The relay stores only encrypted records keyed by SHA-256 space address
- Local data is never deleted by sync — it's merged, not replaced
- If sync fails, local data remains untouched
- To recover: export a full JSON backup from Settings → Backup before making changes
