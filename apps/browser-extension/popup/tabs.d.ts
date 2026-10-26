export interface VideoTab {
  id?: number;
  url?: string;
}
export function isYouTubeHost(hostname: string): boolean;
export function isYoutubeTab(tab: VideoTab): boolean;
export function isYoutubeVideoTab(tab: VideoTab): boolean;
export function getActiveTab(): Promise<VideoTab>;
export function getVideoTabsInWindow(
  windowId: number,
  filterFn?: (tab: VideoTab) => boolean
): Promise<VideoTab[]>;
export function getAllVideoTabsAcrossWindows(): Promise<VideoTab[]>;
