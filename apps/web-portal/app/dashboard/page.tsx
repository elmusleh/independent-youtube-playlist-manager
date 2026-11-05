// apps/web-portal/app/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { deriveKeys, decryptRecord, decodeRecord } from "@iypm/sync-crypto";
import { PlaylistManager } from "@/components/PlaylistManager";
import { SyncKeyEntry } from "@/components/SyncKeyEntry";
import { SyncStatus } from "@/components/SyncStatus";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Playlist {
  id: string;
  title: string;
  youtubeId: string;
  thumbnails?: { url: string }[];
  videoCount: number;
  updatedAt: string;
}

export default function DashboardPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [syncKey, setSyncKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("dashboard_sync_key");
    if (stored) {
      setSyncKey(stored);
      loadPlaylists(stored);
    }
  }, []);

  async function loadPlaylists(key: string) {
    setIsLoading(true);
    setError(null);
    try {
      const { encryptionKey, spaceAddress } = await deriveKeys(key);

      const { data } = await supabase.rpc("sync_pull", {
        space: spaceAddress,
        auth_hash: spaceAddress,
        since_seq: 0,
        limit: 1000,
      });

      const lists = data
        .filter((r: any) => r.collection === "playlists" && !r.deleted)
        .map((r: any) => {
          const decrypted = await decryptRecord(r.payload, { encryptionKey } as any);
          return decodeRecord(decrypted);
        });

      const playlists = await Promise.all(lists);
      setPlaylists(playlists);
      setLastSynced(new Date());
    } catch (error) {
      setError("Failed to load playlists. Check your sync key.");
      console.error("Failed to load playlists:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSync() {
    if (!syncKey) return;
    setIsLoading(true);
    try {
      await loadPlaylists(syncKey);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeySave(key: string) {
    localStorage.setItem("dashboard_sync_key", key);
    setSyncKey(key);
    loadPlaylists(key);
  }

  function playOnYouTube(playlistId: string) {
    window.open(`https://youtube.com/playlist?list=${playlistId}`, "_blank");
  }

  if (!syncKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <SyncKeyEntry onSave={handleKeySave} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Playlist Dashboard</h1>
            <div className="flex items-center gap-4">
              <SyncStatus lastSynced={lastSynced} isLoading={isLoading} onSync={handleSync} />
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <PlaylistManager
          playlists={playlists}
          isLoading={isLoading}
          onPlay={playOnYouTube}
          onSync={handleSync}
        />
      </main>
    </div>
  );
}
