import type { Video } from "../types/model";

export const sortByTitle = (videos: Video[]) => {
  return [...videos].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
};

export const sortByChannel = (videos: Video[]) => {
  return [...videos].sort((a, b) => (a.channel || "").localeCompare(b.channel || ""));
};

export const sortByDuration = (videos: Video[]) => {
  return [...videos].sort((a, b) => {
    const durA = a.durationSeconds ?? 0;
    const durB = b.durationSeconds ?? 0;
    return durA - durB;
  });
};

export const sortByViewCount = (videos: Video[]) => {
  return [...videos].sort((a, b) => {
    if (a.viewCount === b.viewCount) return 0;
    if (a.viewCount === undefined) return 1;
    if (b.viewCount === undefined) return -1;
    return b.viewCount - a.viewCount;
  });
};

export const sortByReleaseDate = (videos: Video[]) => {
  return [...videos].sort((a, b) => {
    if (a.publishedAt === b.publishedAt) return 0;
    if (a.publishedAt === undefined) return 1;
    if (b.publishedAt === undefined) return -1;

    const timeA = new Date(a.publishedAt).getTime();
    const timeB = new Date(b.publishedAt).getTime();

    const isInvalidA = isNaN(timeA);
    const isInvalidB = isNaN(timeB);

    if (isInvalidA && isInvalidB) return 0;
    if (isInvalidA) return 1;
    if (isInvalidB) return -1;

    return timeB - timeA;
  });
};

export const reversePlaylist = (videos: Video[]) => {
  return [...videos].reverse();
};
