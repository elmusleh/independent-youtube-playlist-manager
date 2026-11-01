/**
 * Sync-key generation, validation and formatting.
 *
 * The sync key is the only credential for cross-device sync: it addresses the snapshot
 * and derives the encryption key, so nothing about the user is ever transmitted. It lives
 * in human hands (written down, typed on a second device), so the encoding is Crockford
 * base32 — case-insensitive, no `I`, `L`, `O` or `U` to confuse with `1`, `0` or each
 * other — and rendered in groups of five.
 *
 * 20 symbols of base32 carry 100 bits of entropy, which is the whole security budget here.
 * This module deliberately contains no crypto beyond drawing random bytes.
 */

/** Crockford base32: no I, L, O, U. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const SYMBOLS = 20;
const GROUP = 5;
const SYMBOL_COUNT = ALPHABET.length;

export const SYNC_KEY_SYMBOLS = SYMBOLS;
export const SYNC_KEY_GROUPS = SYMBOLS / GROUP;

/** Thrown when a string cannot be a sync key, with a message fit for the UI. */
export class InvalidSyncKeyError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidSyncKeyError";
  }
}

function randomByte(): number {
  const buffer = new Uint8Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0];
}

/**
 * A uniformly distributed symbol index.
 *
 * `% SYMBOL_COUNT` is unbiased here specifically because the alphabet has 32 symbols and a
 * byte has 256 values — 256 is an exact multiple of 32. (An alphabet whose size does not
 * divide 256 would need rejection sampling; Crockford base32 avoids that by construction.)
 */
function randomIndex(): number {
  return randomByte() % SYMBOL_COUNT;
}

/** A fresh key, formatted the way the user should write it down. */
export function generateSyncKey(): string {
  let symbols = "";
  for (let index = 0; index < SYMBOLS; index += 1) symbols += ALPHABET[randomIndex()];
  return formatSyncKey(symbols);
}

/**
 * Canonicalise user input: uppercase, drop separators and whitespace, apply the Crockford
 * glyph map (`O`→`0`, `I`/`L`→`1`) so a key copied off paper still resolves.
 */
export function normalizeSyncKey(input: string): string {
  return String(input ?? "")
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/[^0-9A-Z]/g, "");
}

/** `ABCDE-FGHJK-MNPQR-STVWX` layout used by the UI and the docs. */
export function formatSyncKey(input: string): string {
  const normalized = normalizeSyncKey(input);
  const groups: string[] = [];
  for (let index = 0; index < normalized.length; index += GROUP) {
    groups.push(normalized.slice(index, index + GROUP));
  }
  return groups.join("-");
}

/** True when `input` is a well-formed key (separators and case are ignored). */
export function isValidSyncKey(input: string): boolean {
  const normalized = normalizeSyncKey(input);
  if (normalized.length !== SYMBOLS) return false;
  return [...normalized].every((symbol) => ALPHABET.includes(symbol));
}

/** Throw `InvalidSyncKeyError` unless the input is a usable key. */
export function assertValidSyncKey(input: string): string {
  if (!isValidSyncKey(input)) {
    throw new InvalidSyncKeyError(
      `A sync key is ${SYMBOLS} characters, for example ${formatSyncKey("0".repeat(SYMBOLS))}`
    );
  }
  return normalizeSyncKey(input);
}
