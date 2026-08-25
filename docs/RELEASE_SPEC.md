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

_Note: <NEW_VERSION> must follow semver (x.y.z)._

### 2. Validation Check

After updating, run the build command again to confirm the new version is correctly propagated into the `dist/` folders:

```bash
npm run build
```

### 3. Stage & Commit

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

### 4. Tagging

Create an annotated Git tag:

```bash
git tag -a v<NEW_VERSION> -m "Release v<NEW_VERSION>"
```

### 5. Post-Release

- Notify the user that the release is ready.
- **NEVER execute `git push`**. Wait for human authorization to push the branch and tags to origin.
