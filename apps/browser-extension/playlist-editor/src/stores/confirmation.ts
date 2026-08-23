import { writable } from "svelte/store";

export type ConfirmationColor = "default" | "primary" | "danger";

export interface ConfirmationConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: (() => any) | null;
  onCancel?: (() => any) | null;
  color: ConfirmationColor;
  confirmLabel?: string;
  cancelLabel?: string;
}

const initialValue: ConfirmationConfig = {
  isOpen: false,
  title: "",
  message: "",
  onConfirm: null,
  onCancel: null,
  color: "default",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
};

export const activeConfirmation = writable<ConfirmationConfig>(initialValue);

export function requestConfirm(config: Omit<ConfirmationConfig, "isOpen">) {
  activeConfirmation.set({
    ...initialValue,
    ...config,
    isOpen: true,
  });
}

export function closeConfirm() {
  activeConfirmation.update((state) => ({ ...state, isOpen: false }));
}

export async function executeConfirm() {
  let callbackResult: any = null;
  let hasCallback = false;

  // First, close the dialog immediately for user feedback
  activeConfirmation.update((state) => {
    if (state.onConfirm) {
      hasCallback = true;
      callbackResult = state.onConfirm();
    }
    return { ...state, isOpen: false };
  });

  // If the callback returns a promise, await it after dialog closes
  if (
    hasCallback &&
    callbackResult &&
    typeof callbackResult === "object" &&
    "then" in callbackResult
  ) {
    try {
      await callbackResult;
    } catch (e: any) {
      console.error("Confirmation callback error:", e);
    }
  }
}

export async function executeCancel() {
  let callbackResult: any = null;
  let hasCallback = false;

  // First, close the dialog immediately for user feedback
  activeConfirmation.update((state) => {
    if (state.onCancel) {
      hasCallback = true;
      callbackResult = state.onCancel();
    }
    return { ...state, isOpen: false };
  });

  // If the callback returns a promise, await it after dialog closes
  if (
    hasCallback &&
    callbackResult &&
    typeof callbackResult === "object" &&
    "then" in callbackResult
  ) {
    try {
      await callbackResult;
    } catch (e: any) {
      console.error("Cancel callback error:", e);
    }
  }
}
