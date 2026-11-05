// apps/web-portal/app/tv/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { deriveKeys, decryptRecord, decodeRecord } from "@iypm/sync-crypto";
import { PlaylistGrid } from "@/components/PlaylistGrid";
import { SyncKeyEntry } from "@/components/SyncKeyEntry";
import { PairingDisplay } from "@/components/PairingDisplay";

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

export default function TVPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isPaired, setIsPaired] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [syncKey, setSyncKey] = useState<string | null>(null);

  // Check for existing pairing on load
  useEffect(() => {
    const stored = localStorage.getItem("tv_sync_key");
    if (stored) {
      setSyncKey(stored);
      setIsPaired(true);
      loadPlaylists(stored);
    } else {
      generatePairingCode();
    }
  }, []);

  function generatePairingCode() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setPairingCode(code);
    listenForKey(code).then((key) => {
      localStorage.setItem("tv_sync_key", key);
      setSyncKey(key);
      setIsPaired(true);
      loadPlaylists(key);
    });
  }

  async function listenForKey(code: string): Promise<string> {
    // Poll for pairing completion via Supabase Realtime or REST
    // For now, simple polling
    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        const { data } = await supabase
          .from("pairing_codes")
          .select("sync_key")
          .eq("code", code)
          .eq("used", false)
          .single();

        if (data?.sync_key) {
          await supabase.from("pairing_codes").update({ used: true }).eq("code", code);
          clearInterval(interval);
          resolve(data.sync_key);
        }
      }, 2000);
    });
  }

  async function loadPlaylists(syncKey: string) {
    try {
      const { encryptionKey, spaceAddress } = await deriveKeys(syncKey);

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
    } catch (error) {
      console.error("Failed to load playlists:", error);
    }
  }

  function playOnYouTube(playlistId: string) {
    // Deep-link to YouTube app on Android TV / Google TV / Fire TV
    window.open(`vnd.youtube://playlist?list=${playlistId}`, "_blank");
  }

  if (!isPaired) {
    return (
      <div className="tv-layout flex flex-col items-center justify-center min-h-screen gap-8 p-8">
        <h1 className="text-5xl font-light text-white">Pair Your TV</h1>
        <div className="text-6xl font-mono tracking-widest bg-gray-900 px-8 py-4 rounded-lg border border-gray-700">
          {pairingCode}
        </div>
        <p className="text-xl text-gray-400 max-w-xl text-center">
          On your phone, go to <span className="text-brand-400">iypm.vercel.app/pair</span>
          and enter this code. Your sync key will be sent securely.
        </p>
        <button
          onClick={generatePairingCode}
          className="mt-8 px-6 py-3 bg-brand-600 text-white rounded-lg text-lg hover:bg-brand-500 transition-colors"
        >
          Generate New Code
        </button>
      </div>
    );
  }

  return (
    <div className="tv-layout p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-light text-white">My Playlists</h1>
        <button
          onClick={() => {
            localStorage.removeItem("tv_sync_key");
            setIsPaired(false);
            generatePairingCode();
          }}
          className="text-gray-400 hover:text-white transition-colors"
        >
          Unpair Device
        </button>
      </header>
      <PlaylistGrid playlists={playlists} onPlay={playOnYouTube} />
    </div>
  );
}
