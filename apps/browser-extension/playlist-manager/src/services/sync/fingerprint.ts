/**
 * Key fingerprint for Sync v2.
 *
 * Human-friendly verification that two devices share the same sync key.
 * Returns both emoji and word forms for accessibility.
 */

import { normalizeSyncKey } from "./sync-key";
import { EMOJI_POOL } from "./fingerprint-emoji";
import { WORD_POOL } from "./fingerprint-words";

export type KeyFingerprint = {
  emoji: string;
  words: string;
};

/**
 * Generate a 4-symbol fingerprint from the sync key.
 * Returns both emoji and word forms for accessibility.
 */
export async function generateKeyFingerprint(
  syncKey: string,
  subtle: SubtleCrypto = globalThis.crypto.subtle
): Promise<KeyFingerprint> {
  const normalized = normalizeSyncKey(syncKey);
  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`iypm-sync-fingerprint:${normalized}`)
  );
  const bytes = new Uint8Array(digest);

  // Use first 4 bytes for 4 symbols (each byte -> 0-255 index)
  const emoji = Array.from(bytes.slice(0, 4))
    .map((b) => EMOJI_POOL[b % EMOJI_POOL.length])
    .join("");

  const words = Array.from(bytes.slice(4, 8))
    .map((b) => WORD_POOL[b % WORD_POOL.length])
    .join("-");

  return { emoji, words };
}
