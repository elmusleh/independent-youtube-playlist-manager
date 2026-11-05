// apps/web-portal/app/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  deriveKeys,
  computeStorageAddress,
  decryptRecord,
  decodeRecord,
  EncryptedRecord,
  DerivedKeys,
} from "@iypm/sync-crypto";
import { PlaylistManager } from "@/components/PlaylistManager";
import { SyncKeyEntry } from "@/components/SyncKeyEntry";
import { SyncStatus } from "@/components/SyncStatus";
import { PairingCodeEntry } from "@/components/PairingCodeEntry";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

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
  const [showPairing, setShowPairing] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("dashboard_sync_key");
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSyncKey(stored);
      loadPlaylists(stored);
    }
  }, []);

  async function loadPlaylists(key: string) {
    setIsLoading(true);
    setError(null);
    try {
      const keys = await deriveKeys(key);
      const spaceAddress = await computeStorageAddress(key);

      const sb = getSupabase(); if (!sb) return;
      const { data } = await sb.rpc("sync_pull", {
        space: spaceAddress,
        auth_hash: spaceAddress,
        since_seq: 0,
        limit: 1000,
      });

      const lists = data
        .filter((r: Record<string, unknown>) => r.collection === "playlists" && !r.deleted)
        .map(async (r: Record<string, unknown>) => {
          const decrypted = await decryptRecord(
            r.payload as EncryptedRecord,
            {
              encryptionKey: keys.encryptionKey,
              recordIdKey: keys.recordIdKey,
              authTokenKey: keys.authTokenKey,
            } as DerivedKeys
          );
          return decodeRecord(decrypted as unknown as Uint8Array);
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

  function handlePairingComplete(receivedSyncKey: string) {
    localStorage.setItem("dashboard_sync_key", receivedSyncKey);
    setSyncKey(receivedSyncKey);
    setShowPairing(false);
    loadPlaylists(receivedSyncKey);
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

  if (showPairing) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pair Device</h1>
              <button
                onClick={() => setShowPairing(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <PairingCodeEntry onComplete={handlePairingComplete} />
        </main>
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
              <button
                onClick={() => setShowPairing(true)}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors"
              >
                Pair New Device
              </button>
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

function playOnYouTube(playlistId: string) {
  window.open(`https://youtube.com/playlist?list=${playlistId}`, "_blank");
}
