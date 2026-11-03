/**
 * Supabase Realtime broadcast nudge for Sync v2.
 *
 * Devices share a sync key, which derives a deterministic space id. They subscribe
 * to a broadcast channel named `sync-<space>` and call `pullNow()` when a `nudge`
 * (or `sync-nudge`) event arrives. The nudge carries NO data — it only tells peers
 * that something changed so they pull the encrypted snapshot themselves.
 */

import { createAnonClient } from "../supabase-client.js";
import { computeStorageAddress } from "./keys.js";
import { RELAY_SUPABASE_URL, RELAY_SUPABASE_ANON_KEY } from "./sync-config.js";

export type NudgeUnsubscribe = () => void;

export type RealtimeNudgeOptions = {
  url?: string;
  anonKey?: string;
};

/**
 * Subscribe to the broadcast channel for `syncKey`. Returns an unsubscribe function.
 * The callback is debounced internally to absorb nudge storms.
 */
export async function subscribeToSyncNudge(
  syncKey: string,
  onNudge: () => void,
  options: RealtimeNudgeOptions = {}
): Promise<NudgeUnsubscribe> {
  const url = options.url || RELAY_SUPABASE_URL;
  const anonKey = options.anonKey || RELAY_SUPABASE_ANON_KEY;
  const space = await computeStorageAddress(syncKey);
  const channelName = `sync-${space}`;
  const client = createAnonClient(url, anonKey);
  const channel = client.channel(channelName, {
    config: { broadcast: { self: false } },
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const trigger = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      try {
        onNudge();
      } catch {
        /* ignore */
      }
    }, 1000);
  };

  channel.on("broadcast", { event: "nudge" }, trigger);
  channel.on("broadcast", { event: "sync-nudge" }, trigger);

  await new Promise<void>((resolve) => {
    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR") resolve();
    });
  });

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    try {
      client.removeChannel(channel);
    } catch {
      /* ignore */
    }
  };
}

/**
 * Broadcast a nudge to peers (no data). Best-effort; never throws.
 */
export async function broadcastSyncNudge(
  syncKey: string,
  options: RealtimeNudgeOptions = {}
): Promise<void> {
  try {
    const url = options.url || RELAY_SUPABASE_URL;
    const anonKey = options.anonKey || RELAY_SUPABASE_ANON_KEY;
    const space = await computeStorageAddress(syncKey);
    const client = createAnonClient(url, anonKey);
    const channel = client.channel(`sync-${space}`);
    await new Promise<void>((resolve) => {
      channel.subscribe((status: string) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR") resolve();
      });
    });
    await channel.send({ type: "broadcast", event: "nudge", payload: {} });
    client.removeChannel(channel);
  } catch {
    /* best-effort */
  }
}
