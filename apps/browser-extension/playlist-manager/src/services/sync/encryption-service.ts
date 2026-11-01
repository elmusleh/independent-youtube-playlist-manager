/**
 * AES-256-GCM packing for sync snapshots.
 *
 * The wire format is intentionally self-describing and short:
 *
 * ```
 *   "IYPM" | version:1 byte | iv:12 bytes | ciphertext || tag:16 bytes
 * ```
 *
 * GCM authenticates the ciphertext, so a single flipped byte — or a payload encrypted
 * under a different sync key — fails to decrypt instead of producing garbage that would
 * overwrite local data. Version and IV travel with the payload because the *sync address*
 * is derived from the key, not from the bytes: a second device must be able to read the
 * container without any side-channel.
 */

const MAGIC = [0x49, 0x59, 0x50, 0x4d]; // "IYPM"
const FORMAT_VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;
const HEADER_LENGTH = MAGIC.length + 1;

/** Thrown for any payload that cannot be authenticated or understood. */
export class SyncDecryptionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "SyncDecryptionError";
    // `Error` options exist in ES2022; the app targets an older lib, so attach manually.
    if (options?.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

/**
 * TypeScript 5.7 types `Uint8Array` over `ArrayBufferLike`, while WebCrypto's `BufferSource`
 * requires `ArrayBuffer`. The bytes are always backed by a plain ArrayBuffer here, so this
 * narrows at the single boundary instead of casting at every call.
 */
function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

export type EncryptionOptions = {
  subtle?: SubtleCrypto;
  /** Injectable for deterministic tests; must return `length` random bytes. */
  randomBytes?: (length: number) => Uint8Array;
};

function defaultRandomBytes(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

function resolve(options: EncryptionOptions) {
  return {
    subtle: options.subtle ?? globalThis.crypto.subtle,
    randomBytes: options.randomBytes ?? defaultRandomBytes,
  };
}

/** True when the buffer starts with this module's magic + version header. */
export function isEncryptedSnapshot(bytes: Uint8Array): boolean {
  if (bytes.length <= HEADER_LENGTH) return false;
  if (bytes[HEADER_LENGTH - 1] !== FORMAT_VERSION) return false;
  return MAGIC.every((byte, index) => bytes[index] === byte);
}

/** Encrypt `plaintext` and return the packed container. */
export async function encryptSnapshot(
  key: CryptoKey,
  plaintext: Uint8Array,
  options: EncryptionOptions = {}
): Promise<Uint8Array> {
  const { subtle, randomBytes } = resolve(options);
  const iv = randomBytes(IV_LENGTH);

  const ciphertext = new Uint8Array(
    await subtle.encrypt(
      { name: "AES-GCM", iv: asBufferSource(iv), tagLength: TAG_LENGTH },
      key,
      asBufferSource(plaintext)
    )
  );

  const packed = new Uint8Array(HEADER_LENGTH + IV_LENGTH + ciphertext.length);
  packed.set(MAGIC, 0);
  packed[MAGIC.length] = FORMAT_VERSION;
  packed.set(iv, HEADER_LENGTH);
  packed.set(ciphertext, HEADER_LENGTH + IV_LENGTH);
  return packed;
}

/**
 * Decrypt a packed container.
 *
 * Every failure mode — wrong key, tampered bytes, truncated file, unknown version — raises
 * `SyncDecryptionError` so callers can treat them uniformly and never touch local data.
 */
export async function decryptSnapshot(
  key: CryptoKey,
  packed: Uint8Array,
  options: EncryptionOptions = {}
): Promise<Uint8Array> {
  const { subtle } = resolve(options);

  if (!isEncryptedSnapshot(packed)) {
    throw new SyncDecryptionError("Not an IYPM sync snapshot, or an unsupported version.");
  }

  const iv = packed.slice(HEADER_LENGTH, HEADER_LENGTH + IV_LENGTH);
  const ciphertext = packed.slice(HEADER_LENGTH + IV_LENGTH);
  // A GCM ciphertext is the tag (16 bytes) plus the plaintext, so 16 is the floor for a
  // valid *empty* payload; anything shorter cannot authenticate.
  if (ciphertext.length < TAG_LENGTH / 8) {
    throw new SyncDecryptionError("The sync snapshot is truncated.");
  }

  try {
    const plaintext = await subtle.decrypt(
      { name: "AES-GCM", iv: asBufferSource(iv), tagLength: TAG_LENGTH },
      key,
      asBufferSource(ciphertext)
    );
    return new Uint8Array(plaintext);
  } catch (error) {
    throw new SyncDecryptionError(
      "Could not decrypt the sync snapshot. Check the sync key, or the file may be damaged.",
      { cause: error }
    );
  }
}
