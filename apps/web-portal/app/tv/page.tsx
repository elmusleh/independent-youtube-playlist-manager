// apps/web-portal/app/tv/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  deriveKeys,
  decryptRecord,
  decodeRecord,
  EncryptedRecord,
  DerivedKeys,
} from "@iypm/sync-crypto";
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

interface PairingCodeRecord {
  code: string;
  expires_at: string;
  used: boolean;
  sync_key: string | null;
  paired_at: string | null;
}

export default function TVPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isPaired, setIsPaired] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [pairingExpiresAt, setPairingExpiresAt] = useState<number | null>(null);
  const [syncKey, setSyncKey] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Check for existing pairing on load
  useEffect(() => {
    const stored = localStorage.getItem("tv_sync_key");
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSyncKey(stored);

      setIsPaired(true);
      loadPlaylists(stored);
    } else {
      generatePairingCode();
    }

    return () => {
      cleanup();
    };
  }, []);

  function cleanup() {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }

  async function generatePairingCode() {
    cleanup();

    try {
      // Generate a new 6-digit code via API
      const response = await fetch("/api/pair/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceType: "tv" }),
      });

      if (!response.ok) throw new Error("Failed to generate pairing code");

      const { code, expiresAt } = await response.json();
      setPairingCode(code);
      setPairingExpiresAt(expiresAt);

      // Subscribe to Realtime for this pairing code
      subscribeToPairing(code);

      // Start countdown timer
      startCountdown(expiresAt);
    } catch (error) {
      console.error("Failed to generate pairing code:", error);
    }
  }

  function subscribeToPairing(code: string) {
    const channel = supabase
      .channel(`pairing:${code}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pairing_codes",
          filter: `code=eq.${code}`,
        },
        async (payload) => {
          const newRecord = payload.new as PairingCodeRecord | null;
          if (newRecord?.sync_key && newRecord.used === true) {
            // Pairing complete! Phone delivered the sync key
            await handlePairingComplete(newRecord.sync_key);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
  }

  async function handlePairingComplete(receivedSyncKey: string) {
    cleanup();

    localStorage.setItem("tv_sync_key", receivedSyncKey);
    setSyncKey(receivedSyncKey);
    setIsPaired(true);
    setPairingCode("");
    setPairingExpiresAt(null);

    await loadPlaylists(receivedSyncKey);
  }

  function startCountdown(expiresAt: number) {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    const update = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        // Auto-generate new code if expired
        if (!isPaired) generatePairingCode();
      }
    };

    update();
    countdownRef.current = setInterval(update, 1000);
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
        .filter((r: Record<string, unknown>) => r.collection === "playlists" && !r.deleted)
        .map(async (r: Record<string, unknown>) => {
          const decrypted = await decryptRecord(
            r.payload as EncryptedRecord,
            {
              encryptionKey,
              recordIdKey: encryptionKey,
              authTokenKey: encryptionKey,
            } as DerivedKeys
          );
          return decodeRecord(decrypted as unknown as Uint8Array);
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

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  if (!isPaired) {
    return (
      <div className="tv-layout flex flex-col items-center justify-center min-h-screen gap-8 p-8">
        <h1 className="text-5xl font-light text-white">Pair Your TV</h1>
        <div className="text-6xl font-mono tracking-widest bg-gray-900 px-8 py-4 rounded-lg border border-gray-700">
          {pairingCode || "Generating..."}
        </div>
        {timeRemaining > 0 && (
          <div className="text-lg text-gray-400">
            Expires in:{" "}
            <span className="text-brand-400 font-mono">{formatTime(timeRemaining)}</span>
          </div>
        )}
        <p className="text-xl text-gray-400 max-w-xl text-center">
          On your phone, go to <span className="text-brand-400">iypm.vercel.app/pair</span>
          and enter this code. Your sync key will be sent securely.
        </p>
        <button
          onClick={generatePairingCode}
          className="mt-8 px-6 py-3 bg-brand-600 text-white rounded-lg text-lg hover:bg-brand-500 transition-colors"
          disabled={timeRemaining > 0 && pairingCode}
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
            cleanup();
            localStorage.removeItem("tv_sync_key");
            setIsPaired(false);
            setSyncKey(null);
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
