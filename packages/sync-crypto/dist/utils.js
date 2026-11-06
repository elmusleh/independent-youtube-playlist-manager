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
export function countGraphemes(text, locale = "en") {
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
        const segmenter = new Intl.Segmenter(locale, { granularity: "grapheme" });
        let count = 0;
        // Iterate over segments efficiently without allocating an intermediate array
        for (const _ of segmenter.segment(text)) {
            count++;
        }
        return count;
    }
    // Fallback for runtimes without Intl.Segmenter
    return [...text].length;
}
/**
 * Split text into individual grapheme clusters.
 */
export function splitGraphemes(text, locale = "en") {
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
        const segmenter = new Intl.Segmenter(locale, { granularity: "grapheme" });
        return Array.from(segmenter.segment(text), (s) => s.segment);
    }
    return [...text];
}
