import { derived, get, writable } from "svelte/store";
import type { Video } from "../types/model.js";

/**
 * A snapshot of a playlist deletion that can be rolled back.
 *
 * `originalIndices` maps each removed video's internal id to its position in
 * the playlist array at the moment it was removed, so an undo can restore the
 * exact original ordering.
 */
export interface UndoSnapshot {
  removedVideos: Video[];
  originalIndices: Map<string | number, number>;
  timestamp: number;
}

/**
 * Single-slot in-memory undo history for playlist video removals.
 *
 * Only the most recent deletion is kept (matching the timed undo-toast UX):
 * pushing a new snapshot replaces any previous one, and calling `restore()`
 * returns the snapshot while clearing the slot.
 */
function createUndoStore() {
  const store = writable<UndoSnapshot | null>(null);

  return {
    subscribe: store.subscribe,
    pushSnapshot(removedVideos: Video[], originalIndices: Map<string | number, number>) {
      store.set({
        removedVideos,
        originalIndices,
        timestamp: Date.now(),
      });
    },
    /**
     * Returns the latest snapshot and clears the undo slot.
     * Returns `null` when there is nothing to undo.
     */
    restore(): UndoSnapshot | null {
      const snapshot = get(store);
      store.set(null);
      return snapshot;
    },
    /** Discards the current snapshot (undo window expired or dismissed). */
    clear() {
      store.set(null);
    },
  };
}

export const undoStore = createUndoStore();

/** Reactive flag: `true` while a deletion is available to undo. */
export const canUndo = derived(undoStore, ($undoStore) => $undoStore !== null);
