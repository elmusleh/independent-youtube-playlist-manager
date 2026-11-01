/**
 * The portal's canonical origin.
 *
 * `robots.ts`, `sitemap.ts` and the Open Graph metadata in `layout.tsx` all need an
 * absolute URL. Keeping one constant avoids the case where the sitemap advertises one
 * host while social cards resolve against `http://localhost:3000` because
 * `metadataBase` was never set.
 */
export const SITE_URL = "https://iypm.vercel.app";
