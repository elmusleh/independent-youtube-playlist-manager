# Smart TV Companion — Architecture

## Overview

The IYPM Smart TV Companion is a **read-only consumer** of synced playlist data. It does not capture, scrape, or modify playlists. It displays synced playlists and launches the YouTube app to play them.

## Core Principle: Client-Only

- **Reads** from Supabase (playlists, metadata catalog)
- **Writes** only device pairing state (new tables)
- **Never** fetches YouTube metadata
- **Never** modifies playlist data

## Auth: Device Pairing

Uses OAuth2 Device Authorization Grant (RFC 8628):

1. TV displays 6-digit code + QR
2. User confirms on portal/phone
3. TV receives Supabase JWT

## Play Mechanism

IYPM playlists are independent (not YouTube playlists). To play:

```
https://www.youtube.com/watch_videos?video_ids=ID1,ID2,ID3,...
```

This creates an ad-hoc Mix in YouTube. Chunked at 50 videos per URL.

## Platform Adapters

| Platform   | Launcher                                        |
| ---------- | ----------------------------------------------- |
| Android TV | `Intent` to `com.google.android.youtube.tv`     |
| Fire TV    | Same as Android TV                              |
| tvOS       | `UIApplication.shared.open()` with `youtube://` |
| Tizen      | `tizen.application.launch`                      |
| webOS      | `webOS.service.request`                         |

## Data Compatibility

See `docs/DATA_COMPATIBILITY.md` for full policy. TV app:

- Uses same Supabase table schemas
- Stores pairing in new tables only
- Ignores unknown fields from desktop clients
