/**
 * packages/sync-crypto/src/utils.ts
 *
 * Unicode and general string utilities for sync-crypto.
 */
/**
 * Count user-perceived grapheme clusters in a string.
 * Uses Intl.Segmenter when available with fallback to spreading code points.
 *
 * This correctly counts complex grapheme clusters such as multi-codepoint emoji
 * (e.g. ZWJ sequences like 🐈‍⬛ or skin tone modifiers) as single units.
 */
export declare function countGraphemes(text: string, locale?: string): number;
/**
 * Split text into individual grapheme clusters.
 */
export declare function splitGraphemes(text: string, locale?: string): string[];
//# sourceMappingURL=utils.d.ts.map