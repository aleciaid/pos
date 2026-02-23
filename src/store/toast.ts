import { create } from 'zustand';

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface ToastState {
    toasts: Toast[];
    addToast: (message: string, type?: Toast['type']) => void;
    removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
    toasts: [],
    addToast: (message, type = 'success') => {
        const id = Date.now().toString(36);
        set({ toasts: [...get().toasts, { id, message, type }] });
        setTimeout(() => {
            set({ toasts: get().toasts.filter(t => t.id !== id) });
        }, 3000);
    },
    removeToast: (id) => set({ toasts: get().toasts.filter(t => t.id !== id) }),
}));
