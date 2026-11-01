import type { NormalizedVideoMeta } from "../types/model";
import { clampPage } from "./pagination";

export type UnavailableReason = "deleted" | "private" | "broken" | "other";

export interface QueueOrigin {
  id: string;
  title: string;
}

export function unavailableReason(meta: NormalizedVideoMeta): UnavailableReason {
  if (meta.isPrivate) return "private";
  if (meta.isBroken) return "broken";
  if (meta.isDeleted || meta.isUnavailable) return "deleted";
  return "other";
}

export function filterUnavailable(
  items: NormalizedVideoMeta[],
  origins: Record<string, QueueOrigin[]>,
  reason: string,
  originId: string
): NormalizedVideoMeta[] {
  return items.filter((meta) => {
    if (reason !== "all" && unavailableReason(meta) !== reason) return false;
    if (originId !== "all" && !(origins[meta.videoId] || []).some((o) => o.id === originId)) {
      return false;
    }
    return true;
  });
}

export function collectOriginOptions(origins: Record<string, QueueOrigin[]>): QueueOrigin[] {
  const titles = new Map<string, string>();
  for (const list of Object.values(origins)) {
    for (const origin of list) titles.set(origin.id, origin.title);
  }
  return [...titles.entries()]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function paginateQueue<T>(items: T[], page: number, pageSize: number): T[] {
  const pages = Math.max(1, Math.ceil(items.length / Math.max(1, pageSize)));
  const safePage = clampPage(page, pages);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function selectAllVisible(selected: ReadonlySet<string>, visibleIds: string[]): Set<string> {
  const next = new Set(selected);
  for (const id of visibleIds) next.add(id);
  return next;
}

export function clearSelected(selected: ReadonlySet<string>, ids: string[]): Set<string> {
  const remove = new Set(ids);
  return new Set([...selected].filter((id) => !remove.has(id)));
}
