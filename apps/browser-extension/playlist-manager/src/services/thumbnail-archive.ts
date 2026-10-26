import { createStore, get, set, entries, clear } from "idb-keyval";

const store = createStore("yph_thumbnail_archive_v1", "images");
export const THUMBNAIL_ORIGINS = ["https://i.ytimg.com/*"];
const MAX_BYTES = 512 * 1024;
const pending = new Map<string, Promise<string | undefined>>();
let active = 0;
const queue: (() => void)[] = [];

export function validThumbnail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_BYTES * 1.4 &&
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  );
}

export async function archivedThumbnails(): Promise<Record<string, string>> {
  return Object.fromEntries(await entries<string, string>(store));
}
export async function clearArchivedThumbnails(): Promise<void> {
  await clear(store);
}
export async function restoreThumbnails(images: Record<string, string>): Promise<void> {
  for (const [id, data] of Object.entries(images)) {
    if (!/^[\w-]{11}$/.test(id) || !validThumbnail(data))
      throw new Error("Invalid saved thumbnail.");
    if (!(await get(id, store))) await set(id, data, store);
  }
}

export async function readArchivedThumbnail(id: string): Promise<string | undefined> {
  try {
    return await get<string>(id, store);
  } catch {
    return undefined;
  }
}

export function archiveThumbnail(id: string): Promise<string | undefined> {
  if (!/^[\w-]{11}$/.test(id)) return Promise.resolve(undefined);
  if (pending.has(id)) return pending.get(id)!;
  const task = (async () => {
    const saved = await readArchivedThumbnail(id);
    if (saved) return saved;
    const api = (globalThis as any).browser || (globalThis as any).chrome;
    if (!(await api?.permissions?.contains({ origins: THUMBNAIL_ORIGINS }))) return;
    if (active >= 4) await new Promise<void>((resolve) => queue.push(resolve));
    else active++;
    try {
      // Permissions may have been revoked while this image waited for a slot.
      if (!(await api.permissions.contains({ origins: THUMBNAIL_ORIGINS }))) return;
      const response = await fetch(`https://i.ytimg.com/vi/${id}/default.jpg`, {
        credentials: "omit",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok || Number(response.headers.get("content-length")) > MAX_BYTES) return;
      const blob = await response.blob();
      if (!/^image\/(jpeg|png|webp)$/.test(blob.type) || !blob.size || blob.size > MAX_BYTES)
        return;
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      if (!validThumbnail(data)) return;
      await set(id, data, store);
      return data;
    } finally {
      const next = queue.shift();
      if (next) next();
      else active--;
    }
  })()
    .catch(() => undefined)
    .finally(() => pending.delete(id));
  pending.set(id, task);
  return task;
}
