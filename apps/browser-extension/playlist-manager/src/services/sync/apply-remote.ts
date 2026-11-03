import { selectSyncableSettings } from "./settings-selector.js";

function extBrowser() {
  return (globalThis as any).browser || (globalThis as any).chrome;
}

export async function applyRemote(
  payload: Record<string, unknown>,
  selection: { playlists: boolean; settings: boolean; history: boolean }
): Promise<{ applied: string[]; failed: string[] }> {
  const applied: string[] = [];
  const failed: string[] = [];
  if (selection.playlists && Array.isArray(payload.playlists)) {
    try {
      const { librarySnapshot, mutateLibrary } =
        await import("../../../../shared/storage-client.js");
      const local = await librarySnapshot();
      await mutateLibrary({
        type: "replace",
        playlists: payload.playlists,
        expectedRevision: local.revision,
      });
      applied.push("playlists");
    } catch (e: any) {
      failed.push(`playlists: ${e?.message || e}`);
    }
  }
  if (selection.settings && payload.settings && typeof payload.settings === "object") {
    try {
      const safeSettings = selectSyncableSettings(payload.settings);
      let storedAny = false;
      for (const [key, value] of Object.entries(safeSettings)) {
        if (typeof (window as any).storeObject === "function") {
          await (window as any).storeObject(key, value);
          storedAny = true;
        }
      }
      if (Object.keys(safeSettings).length > 0 && storedAny) applied.push("settings");
      else if (Object.keys(safeSettings).length > 0)
        failed.push("settings: storeObject unavailable");
    } catch (e: any) {
      failed.push(`settings: ${e?.message || e}`);
    }
  }
  if (selection.history && payload.history) {
    try {
      await extBrowser().storage.local.set({ local_yt_history: payload.history });
      applied.push("history");
    } catch (e: any) {
      failed.push(`history: ${e?.message || e}`);
    }
  }
  return { applied, failed };
}
