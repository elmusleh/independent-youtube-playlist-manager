import type { Settings } from "../types/model.js";

/**
 * The metadata extraction tiers, in the order they are attempted.
 *
 * Single source of truth: the Data Manager renders this list, and
 * `youtube-api.ts` documents the same order around `INNERTUBE_CLIENTS` and the
 * fallback tiers. Reordering one without the other used to be invisible.
 */
export interface MetadataEngineDescriptor {
  id: "innertube" | "embed" | "oembed" | "invidious";
  label: string;
  hint: string;
  settingKey: keyof Settings;
  /** Only these tiers can recover a duration; oEmbed never returns one. */
  providesDuration: boolean;
}

export interface MetadataEngineStatus extends MetadataEngineDescriptor {
  enabled: boolean;
}

export const METADATA_ENGINES: readonly MetadataEngineDescriptor[] = [
  {
    id: "innertube",
    label: "Multi-Client Innertube",
    hint: "Zero-quota primary source for title, channel and duration.",
    settingKey: "enableInnertubeScraping",
    providesDuration: true,
  },
  {
    id: "embed",
    label: "Embed Page Scraper",
    hint: "Zero-quota fallback. Reads the embed player response.",
    settingKey: "enableEmbedScraping",
    providesDuration: true,
  },
  {
    id: "oembed",
    label: "oEmbed",
    hint: "Guarantees title and channel only — never a duration.",
    settingKey: "enableOEmbedScraping",
    providesDuration: false,
  },
  {
    id: "invidious",
    label: "Piped & Invidious",
    hint: "Mirrored instances, used when YouTube blocks direct requests.",
    settingKey: "enableInvidiousPiped",
    providesDuration: true,
  },
];

/** Merge the persisted settings into the descriptor list for display. */
export function describeEngines(settings: Settings | null | undefined): MetadataEngineStatus[] {
  return METADATA_ENGINES.map((engine) => ({
    ...engine,
    enabled: Boolean(settings && settings[engine.settingKey]),
  }));
}
