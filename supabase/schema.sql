-- ====================================================================
-- Independent YouTube Playlist Manager (YPH) — Production Supabase Schema
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Shared Global Video Catalog (Deduplicated across all users)
CREATE TABLE IF NOT EXISTS public.videos_catalog (
    video_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    channel TEXT NOT NULL,
    duration_iso TEXT NOT NULL DEFAULT 'PT0S',
    duration_seconds INT NOT NULL DEFAULT 0,
    view_count BIGINT DEFAULT 0,
    published_at TIMESTAMPTZ,
    is_live BOOLEAN DEFAULT FALSE,
    is_private BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. User Playlists Table
CREATE TABLE IF NOT EXISTS public.playlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted_at TIMESTAMPTZ -- Soft-delete tombstone timestamp for delta sync
);

-- 5. Playlist Items (Join table with custom ordering)
CREATE TABLE IF NOT EXISTS public.playlist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
    video_id TEXT NOT NULL REFERENCES public.videos_catalog(video_id) ON DELETE RESTRICT,
    position INT NOT NULL,
    added_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted_at TIMESTAMPTZ,
    UNIQUE (playlist_id, video_id)
);

-- 6. API & Extension Sync Tokens
CREATE TABLE IF NOT EXISTS public.api_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    label TEXT DEFAULT 'Browser Extension',
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Cloud Snapshots Table (Point-in-time full database backup)
CREATE TABLE IF NOT EXISTS public.cloud_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_origin TEXT NOT NULL,
    playlist_count INT NOT NULL,
    video_count INT NOT NULL,
    size_bytes BIGINT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_playlists_user ON public.playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON public.playlist_items(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_order ON public.playlist_items(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON public.api_tokens(token);
CREATE INDEX IF NOT EXISTS idx_cloud_snapshots_user_id ON public.cloud_snapshots(user_id);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_snapshots ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only read & update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- videos_catalog: Anyone can read, authenticated can upsert
CREATE POLICY "Allow read access to all users" ON public.videos_catalog
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to insert/update video catalog" ON public.videos_catalog
    FOR ALL USING (auth.role() = 'authenticated');

-- playlists: Users manage their own playlists
CREATE POLICY "Users manage their own playlists" ON public.playlists
    FOR ALL USING (auth.uid() = user_id);

-- playlist_items: Users manage items of playlists they own
CREATE POLICY "Users manage their own playlist items" ON public.playlist_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.playlists
            WHERE public.playlists.id = public.playlist_items.playlist_id
            AND public.playlists.user_id = auth.uid()
        )
    );

-- Snapshots: Users can manage their own snapshots
CREATE POLICY "Users can manage own snapshots" ON public.cloud_snapshots
    FOR ALL USING (auth.uid() = user_id);

-- API Tokens: Users can manage their own API tokens
CREATE POLICY "Users can manage own tokens" ON public.api_tokens
    FOR ALL USING (auth.uid() = user_id);
