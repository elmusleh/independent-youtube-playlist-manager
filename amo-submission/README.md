# AMO Listed Submission Package

This directory contains everything needed to switch **Independent YouTube Playlist Manager** from an Unlisted to a Listed add-on on [addons.mozilla.org](https://addons.mozilla.org/).

## Files

| File | Purpose |
|------|---------|
| `metadata.md` | Copy-paste ready text for AMO Description, Tags, URLs |
| `reviewer-notes.md` | Technical notes to paste into the "Notes for Reviewers" field |
| `checklist.md` | Step-by-step manual actions required on the AMO Developer Hub |
| `assets/` | Editable promotional source files and store artwork |
| `tools/capture.js` | Reproducible screenshot capture utility |
| `screenshots/README.md` | Screenshot requirements and capture instructions |

## Upload Artifacts

| Artifact | Location |
|----------|----------|
| Extension ZIP | Generated at `dist/independent-youtube-playlist-manager-firefox.zip` |
| Signed XPI | Generated at `dist/firefox/web-ext-artifacts/*.xpi` |
| Source ZIP | Generate locally as an AMO upload attachment; do not commit it |

The `dist/` files and source ZIP are generated release artifacts. They are intentionally ignored by Git. Keep them locally while uploading to AMO, or attach them to a GitHub Release.

## Quick Start

1. Open `checklist.md` and work through the pre-flight checklist.
2. Run `npm run build`, then capture screenshots with `node amo-submission/tools/capture.js`.
3. Copy metadata from `metadata.md` into the AMO forms.
4. Paste `reviewer-notes.md` into the reviewer notes field.
5. Switch the channel from **Unlisted** to **Listed** and submit for review.

## Current AMO Status

- **Current channel:** Unlisted
- **Current upload UUID:** `0379b5d80cc941c289548955e9dc9d5d`
- **Target version:** Set this from `src/manifest.firefox.json` immediately before upload.
- **Extension ID:** `{790842fe-fecb-4375-a127-95c1c1d35d3e}`
