#!/usr/bin/env bash
# scripts/release.sh — One-command release helper
# Usage:  npm run release -- 2.12.25
# Effect: bumps all versions, commits, tags. You then push.

set -euo pipefail

VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
  echo "❌  Usage: npm run release -- <version>  (e.g. 2.12.25)"
  exit 1
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌  Version must be semver x.y.z (got: $VERSION)"
  exit 1
fi

TAG="v$VERSION"

echo ""
echo "🚀  Preparing release $TAG"
echo ""

# 1. Must be on main and clean
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "main" ]]; then
  echo "❌  Must be on 'main' branch (currently on '$BRANCH')"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌  Working directory is not clean. Commit or stash changes first."
  exit 1
fi

# 2. Sync version across all manifests + package.json files
echo "📝  Syncing version $VERSION across all manifests and package.json files..."
node packages/build-tools/sync-version.mjs --set "$VERSION"

# 3. Commit the version bump
echo ""
echo "💾  Committing version bump..."
git add \
  apps/browser-extension/manifest.chrome.json \
  apps/browser-extension/manifest.firefox.json \
  package.json \
  apps/browser-extension/playlist-manager/package.json \
  apps/web-portal/package.json
# Only commit if there are actual changes (avoid empty commit)
if git diff --cached --quiet; then
  echo "⚠  No version changes to commit. Skipping commit step."
else
  HUSKY=0 git commit -m "chore(release): bump version to $VERSION"
fi

# 4. Create annotated tag (skip if already exists)
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "⚠  Tag $TAG already exists – skipping tag creation."
else
  echo "🏷   Tagging $TAG..."
  git tag -a "$TAG" -m "Release $TAG"
fi

echo ""
echo "✅  Done! Push to trigger GitHub Actions:"
echo ""
echo "    git push && git push origin $TAG"
# dummy change for release test
echo ""
