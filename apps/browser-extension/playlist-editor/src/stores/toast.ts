import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  message: string;
  type: ToastType;
  visible: boolean;
}

function createToastStore() {
  const { subscribe, set, update } = writable<ToastMessage>({
    message: '',
    type: 'info',
    visible: false
  });

  let timeout: ReturnType<typeof setTimeout>;

  return {
    subscribe,
    show: (message: string, type: ToastType = 'info', duration: number = 3000) => {
      if (timeout) clearTimeout(timeout);
      
      set({ message, type, visible: true });
      
      timeout = setTimeout(() => {
        update(state => ({ ...state, visible: false }));
      }, duration);
    },
    hide: () => {
      if (timeout) clearTimeout(timeout);
      update(state => ({ ...state, visible: false }));
    }
  };
}

export const toast = createToastStore();
