import type { VideoTab } from "./tabs";
export function scrapeMetadataFromTabs(tabs: VideoTab[]): Promise<
  Array<{
    videoId: string;
    title: string;
    channel: string;
    durationISO: string;
    durationSeconds?: number;
  }>
>;
