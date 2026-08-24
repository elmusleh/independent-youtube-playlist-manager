# Independent YouTube Playlist Manager - Usage Examples

## Overview

This document provides examples of how to use and extend the Independent YouTube Playlist Manager.

## For Users

### Basic Usage

1. Install the extension from Chrome Web Store or Firefox Add-ons
2. Click the extension icon to open the popup
3. Use the "Save Video" button to save the current YouTube video to your playlist
4. Open the playlist editor to manage your saved videos, create playlists, and sync with YouTube

### Keyboard Shortcuts

- `Ctrl+Shift+Y` (or `Cmd+Shift+Y` on Mac): Quick add current video to playlist builder
- Access additional shortcuts via `chrome://extensions/shortcuts` or `about:addons` -> extensions -> shortcuts

## For Developers

### Project Structure

```
/
├── apps/
│   ├── browser-extension/          # Extension source code
│   │   ├── background/             # Service worker scripts
│   │   ├── content-scripts/        # Content scripts injected into pages
│   │   ├── popup/                  # Extension popup UI
│   │   └── playlist-editor/        # Main Svelte SPA (editor UI)
│   └── web-portal/                 # Next.js web application
├── docs/                           # Documentation and assets
└── packages/                       # Build tools and utilities
```

### Extension Architecture

- **Manifest V3**: Uses service worker (`background-worker.js`)
- **Storage**:
  - IndexedDB for video metadata (`db-service.ts`)
  - `browser.storage.local` for playlist/app state
  - `browser.storage.sync` for settings (if enabled)
- **Messaging**: Communication between components via `browser.runtime.sendMessage`

### Key Services

1. **Video Service** (`apps/browser-extension/playlist-editor/src/services/video-service.ts`)
   - Fetches video metadata using multiple strategies
   - Fallback chain: Cache → Innertube → Embed → oEmbed → API → Piped/Invidious

2. **Storage Service** (`apps/browser-extension/playlist-editor/src/services/storage-service.ts`)
   - Manages playlist persistence with debounced saves
   - Handles local and synced playlists

3. **Supabase Sync** (`apps/browser-extension/playlist-editor/src/services/supabase-sync.ts`)
   - Cross-device synchronization
   - Last-write-wins conflict resolution

4. **Database Service** (`apps/browser-extension/playlist-editor/src/services/db-service.ts`)
   - IndexedDB wrapper for video metadata
   - Exponential backoff retry mechanism

### Development Commands

```bash
# Install dependencies
npm install

# Development watch mode (rebuilds on changes)
npm run watch

# Production build
npm run build

# Create distribution packages
npm run pack

# Lint code
npm run lint

# Fix lint issues automatically
npm run lint:fix

# Run unit tests
npm run test

# Run E2E tests (requires HEADED=true)
HEADED=true npm run web:test

# Format code
npm run format
```

### Extending the Extension

#### Adding a New Context Menu Item

1. Add constants in `background/background.js`:

```javascript
const NEW_MENU_ID = "yphNewMenu";
```

2. Create the menu in `buildContextMenus()`:

```javascript
browser.contextMenus.create({
  id: NEW_MENU_ID,
  title: "New Menu Item",
  contexts: ["link", "video"],
});
```

3. Add handler in the `onClicked` listener:

```javascript
else if (clickedMenuId === NEW_MENU_ID) {
  // Your logic here
}
```

#### Adding a New Settings Option

1. Add to Settings type in `apps/browser-extension/playlist-editor/src/types/model.ts`
2. Add UI control in `apps/browser-extension/playlist-editor/src/components/Settings.svelte`
3. Update `storage-service.ts` to handle the new setting
4. Use the setting in your code via `await window.getSettings()`

#### Adding a New Metadata Source

1. Edit `apps/browser-extension/playlist-editor/src/services/video-service.ts`
2. Add your source to the fetch chain in `fetchVideoMetadata()`
3. Add configuration options in `storage-service.ts` if needed
4. Update the manifest if new permissions are required

### Web Portal Development

The web portal is a standard Next.js 15 app:

```bash
# Start development server
npm run web

# Build for production
npm run web:build

# Run E2E tests
npm run web:test
```

Key directories:

- `/app` - App router components
- `/components` - Reusable UI components
- `/lib` - Utility functions and Supabase client
- `/public` - Static assets

## Configuration

### Extension Settings

Accessible via the extension popup → Settings gear icon:

- `autoFetchMetadata`: Automatically fetch metadata for new videos
- `metadataExecutionStrategy`: `"free_first"` (default) or `"api_first"`
- Various toggles for metadata sources (Innertube, Embed, oEmbed, etc.)
- Custom instance URLs for Piped/Invidious services

### Supabase Synchronization

To enable cross-device sync:

1. Click the "Sign in with Supabase" button in Settings
2. Authorize via email/password or OAuth provider
3. Sync happens automatically in the background
4. Manually trigger via the sync button in the editor

## Troubleshooting

### Extension Not Working

1. Check if the service worker is running (chrome://extensions → Service worker)
2. Look for errors in the service worker console (Inspect views → background-worker.js)
3. Verify manifest validity (no `manifest.json` in extension root)
4. Ensure required permissions are granted

### Metadata Not Fetching

1. Check network tab for requests to YouTube/fallback services
2. Verify API key is configured if using `"api_first"` strategy
3. Check console for CORS or fetch errors
4. Try disabling specific metadata sources in Settings

### Sync Issues

1. Verify Supabase connection status in Settings
2. Check browser console for sync errors
3. Ensure you're online and not behind restrictive firewall
4. Try triggering sync manually and checking logs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Ensure lint passes (`npm run lint`)
6. Submit a pull request

## License

MIT
