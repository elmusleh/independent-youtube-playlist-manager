// Placeholder — implementation in next session
// apps/smart-tv/src/services/launcher.ts
export function buildWatchVideosUrl(videoIds: string[]): string {
  // TODO: implement chunking for >50 videos
  return `https://www.youtube.com/watch_videos?video_ids=${videoIds.join(",")}`;
}

export function launchYouTube(url: string): void {
  // TODO: platform-specific deep link
  console.log("Launch YouTube:", url);
}
