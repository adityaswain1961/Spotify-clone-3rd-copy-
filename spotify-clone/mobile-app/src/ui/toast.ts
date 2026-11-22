import { create } from 'zustand';

interface ToastState {
  message: string | null;
  id: number;
}

export const useToast = create<ToastState>(() => ({ message: null, id: 0 }));

let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(message: string, durationMs = 2600): void {
  clearTimeout(timer);
  useToast.setState((state) => ({ message, id: state.id + 1 }));
  timer = setTimeout(() => useToast.setState({ message: null }), durationMs);
}
