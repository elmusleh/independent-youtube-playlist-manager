import type { Settings } from "../types/model.js";

/**
 * The metadata sources, in the order they are attempted.
 *
 * The Data Manager renders this list. Keep the descriptors here so adding a
 * source does not require editing the view or duplicating its cost/caveat copy.
 */
export interface MetadataEngineDescriptor {
  id: "page-cache" | "innertube" | "data-api" | "embed" | "oembed" | "invidious" | "apify";
  label: string;
  settingKey?: keyof Settings;
  providesDuration: boolean;
  badge: string;
  badgeKind: "beta" | "official" | "community" | "future";
  description: string;
  cost: string;
  requests: string;
  duration: string;
  bestFor: string;
  caveat: string;
}

export interface MetadataEngineStatus extends MetadataEngineDescriptor {
  enabled: boolean;
  state: string;
}

export const METADATA_ENGINES: readonly MetadataEngineDescriptor[] = [
  {
    id: "page-cache",
    label: "Page cache",
    providesDuration: true,
    badge: "BETA",
    badgeKind: "beta",
    description:
      "Reads title, channel and duration labels already present on the page while you capture or import.",
    cost: "Free",
    requests: "0 extra requests",
    duration: "When the page label exists",
    bestFor: "Bulk capture and first imports",
    caveat: "Depends on YouTube's page markup, which can change.",
  },
  {
    id: "innertube",
    label: "Multi-Client Innertube",
    settingKey: "enableInnertubeScraping",
    providesDuration: true,
    badge: "BETA",
    badgeKind: "beta",
    description: "Unofficial player API. Tries the Android VR client first, then web clients.",
    cost: "Free · no quota",
    requests: "1 per unresolved video",
    duration: "Yes",
    bestFor: "Normal public videos without an API key",
    caveat: "Client versions and bot checks can change without notice.",
  },
  {
    id: "data-api",
    label: "YouTube Data API",
    providesDuration: true,
    badge: "Official",
    badgeKind: "official",
    description: "Official videos.list endpoint for batched metadata.",
    cost: "Free · user key or sign-in",
    requests: "Batched by video ID",
    duration: "Yes",
    bestFor: "Reliable bulk repair and duration fallback",
    caveat: "Requires an API key or Google sign-in; the daily quota applies.",
  },
  {
    id: "embed",
    label: "Embed page",
    settingKey: "enableEmbedScraping",
    providesDuration: true,
    badge: "BETA",
    badgeKind: "beta",
    description: "Legacy scraper for the player response on YouTube's /embed page.",
    cost: "Free",
    requests: "1 per video",
    duration: "Sometimes",
    bestFor: "A last-resort legacy fallback",
    caveat: "Modern embed pages often omit the player JSON entirely.",
  },
  {
    id: "oembed",
    label: "oEmbed",
    settingKey: "enableOEmbedScraping",
    providesDuration: false,
    badge: "Official",
    badgeKind: "official",
    description: "Official, fast endpoint for title and channel.",
    cost: "Free",
    requests: "1 per video",
    duration: "No",
    bestFor: "Quick title and channel lookup",
    caveat: "Cannot repair duration gaps by itself.",
  },
  {
    id: "invidious",
    label: "Piped & Invidious",
    settingKey: "enableInvidiousPiped",
    providesDuration: true,
    badge: "BETA · COMMUNITY",
    badgeKind: "community",
    description: "Community mirrors that expose metadata when YouTube blocks a direct request.",
    cost: "Free · self-hostable",
    requests: "1+ per video",
    duration: "Yes",
    bestFor: "Self-hosted setups and region fallbacks",
    caveat: "Public instances are rate-limited, unstable, or block extension requests (CORS).",
  },
  {
    id: "apify",
    label: "Apify / hosted actors",
    providesDuration: true,
    badge: "FUTURE · PAID",
    badgeKind: "future",
    description: "Server-side scraping actors that can return metadata when local tiers fail.",
    cost: "Paid per result/run",
    requests: "Batched server-side",
    duration: "Yes",
    bestFor: "Teams needing an SLA or custom fields",
    caveat:
      "Not connected. Requires an Apify token, sends IDs to a third party, and adds per-result cost.",
  },
];

/** Merge persisted settings and the API state into the descriptor list. */
export function describeEngines(
  settings: Settings | null | undefined,
  dataApiReady = false,
  dataApiState = "Not configured"
): MetadataEngineStatus[] {
  return METADATA_ENGINES.map((engine) => {
    if (engine.id === "page-cache") {
      return { ...engine, enabled: true, state: "Always on" };
    }
    if (engine.id === "data-api") {
      return { ...engine, enabled: dataApiReady, state: dataApiState };
    }
    if (engine.id === "apify") {
      return { ...engine, enabled: false, state: "Not connected" };
    }
    const enabled = Boolean(settings && engine.settingKey && settings[engine.settingKey]);
    return { ...engine, enabled, state: enabled ? "Enabled" : "Disabled" };
  });
}
