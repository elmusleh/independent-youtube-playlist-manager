# Release Specification for AI Agents

This document defines the industry-standard, automated workflow for releasing new versions of the Independent YouTube Playlist Manager. AI agents MUST follow these steps to ensure version consistency and repository integrity.

## Pre-Release Requirements

1. **Repository State:** Must be on `main` branch.
2. **Clean Working Directory:** Run `git status` to verify no uncommitted changes.
3. **Build Validation:** Execute `npm run build` to ensure the release is stable.

## Step-by-Step Release Workflow

### 1. Update Version Numbers

Sync the version across all manifests and configuration files:

```bash
node packages/build-tools/sync-version.mjs --set <NEW_VERSION>
```

_Note: <NEW_VERSION> must follow semver (x.y.z). The Edge manifest is generated from the Chrome manifest at build time, so it needs no separate version file._

### 2. Validation Check

After updating, run the build command again to confirm the new version is correctly propagated into the `dist/` folders:

```bash
npm run build
```

`validate-manifests.js` also asserts that `dist/edge/manifest.json` exactly matches the Chrome manifest minus `key` and `browser_specific_settings`.

### 3. Package Store Artifacts

Build and ZIP all store packages, including the Edge Add-ons package:

```bash
npm run pack
```

Confirm `dist/independent-youtube-playlist-manager-edge.zip` exists and its `manifest.json` has no `key` or `browser_specific_settings` before uploading it to Partner Center.

### 4. Stage & Commit

Stage the changed files:

```bash
git add apps/browser-extension/manifest.chrome.json \
        apps/browser-extension/manifest.firefox.json \
        package.json \
        apps/browser-extension/playlist-manager/package.json \
        apps/web-portal/package.json
```

Commit the changes using the following format:

```bash
git commit -m "chore(release): bump version to <NEW_VERSION>"
```

### 5. Tagging

Create an annotated Git tag:

```bash
git tag -a v<NEW_VERSION> -m "Release v<NEW_VERSION>"
```

### 6. Post-Release

- Upload the Edge ZIP to Microsoft Partner Center; after approval, set `NEXT_PUBLIC_EDGE_STORE_URL` and add the Edge listing link to the README/portal.
- Notify the user that the release is ready.
- **NEVER execute `git push`**. Wait for human authorization to push the branch and tags to origin.
