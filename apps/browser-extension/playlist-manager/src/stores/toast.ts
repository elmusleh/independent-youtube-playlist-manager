import { get, writable } from "svelte/store";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  /** Auto-dismiss delay in milliseconds. Falls back to a type-based default. */
  duration: number;
  /** Optional action button (e.g. "Undo"). */
  action?: ToastAction;
  /** Whether the close (×) button is rendered. */
  dismissible: boolean;
  /** Number of duplicate dispatches collapsed into this toast (dedup counter). */
  count?: number;
}

export interface ToastShowOptions {
  duration?: number;
  action?: ToastAction;
  dismissible?: boolean;
}

/** Maximum number of toasts rendered at once; extras are queued until a slot frees up. */
export const MAX_VISIBLE_TOASTS = 3;
/** Default duration used when neither a type default nor an explicit duration applies. */
export const DEFAULT_DURATION_MS = 4000;
/** Rapid identical dispatches inside this window are collapsed or ignored (spam prevention). */
export const DEDUP_WINDOW_MS = 1500;

const TYPE_DURATIONS: Record<ToastType, number> = {
  info: 5000,
  success: 4000,
  warning: 5000,
  error: 6000,
};

function createToastStore() {
  const toasts = writable<ToastMessage[]>([]);

  /** Toasts waiting for a visible slot (FIFO). */
  let queue: ToastMessage[] = [];
  /** Per-toast auto-dismiss timers keyed by toast id. */
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Last dispatch timestamp per `type:message` key (debounce/dedup bookkeeping). */
  const lastDispatch = new Map<string, number>();
  let idCounter = 0;

  function generateId(): string {
    idCounter += 1;
    return `toast-${Date.now()}-${idCounter}`;
  }

  function clearTimer(id: string) {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
  }

  function scheduleDismiss(toast: ToastMessage) {
    clearTimer(toast.id);
    const timer = setTimeout(() => {
      timers.delete(toast.id);
      dismiss(toast.id);
    }, toast.duration);
    timers.set(toast.id, timer);
  }

  /** Promote the oldest queued toast into the visible list once capacity frees up. */
  function promoteFromQueue() {
    const next = queue.shift();
    if (!next) return;
    toasts.update((list) => [next, ...list]);
    scheduleDismiss(next);
  }

  function dismiss(id: string) {
    clearTimer(id);
    toasts.update((list) => list.filter((t) => t.id !== id));
    promoteFromQueue();
  }

  /**
   * Show a toast. Returns a dismiss callback that removes only this toast.
   *
   * Dedup: identical visible toasts are collapsed into a single card with a repeat
   * counter and a refreshed timer. Debounce: identical dispatches within
   * `DEDUP_WINDOW_MS` are ignored entirely (spam prevention).
   */
  function show(
    message: string,
    type: ToastType = "info",
    options: ToastShowOptions = {}
  ): () => void {
    const duration = options.duration ?? TYPE_DURATIONS[type] ?? DEFAULT_DURATION_MS;
    const dismissible = options.dismissible ?? true;
    const dedupKey = `${type}:${message}`;
    const now = Date.now();

    // Deduplication: collapse into an identical toast that is already visible.
    const existing = get(toasts).find((t) => t.message === message && t.type === type);
    if (existing) {
      lastDispatch.set(dedupKey, now);
      const updated: ToastMessage = {
        ...existing,
        count: (existing.count ?? 1) + 1,
        duration,
        action: options.action ?? existing.action,
      };
      toasts.update((list) => list.map((t) => (t.id === existing.id ? updated : t)));
      scheduleDismiss(updated);
      return () => dismiss(existing.id);
    }

    // Debounce: ignore rapid-fire identical dispatches (spam prevention).
    const last = lastDispatch.get(dedupKey);
    if (last !== undefined && now - last < DEDUP_WINDOW_MS) {
      return () => {};
    }

    const id = generateId();
    const newToast: ToastMessage = {
      id,
      type,
      message,
      duration,
      action: options.action,
      dismissible,
    };
    lastDispatch.set(dedupKey, now);

    if (get(toasts).length >= MAX_VISIBLE_TOASTS) {
      queue.push(newToast);
    } else {
      // Prepend: newest toast occupies the bottom slot; older ones push upward
      // (matches the column-reverse container).
      toasts.update((list) => [newToast, ...list]);
      scheduleDismiss(newToast);
    }

    return () => dismiss(id);
  }

  /** Dismiss every visible and queued toast immediately. */
  function dismissAll() {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    queue = [];
    lastDispatch.clear();
    toasts.set([]);
  }

  return {
    subscribe: toasts.subscribe,
    show,
    dismiss,
    dismissAll,
  };
}

export const toast = createToastStore();
