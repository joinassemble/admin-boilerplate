export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

let nextId = 1;
const DURATION_MS = 3000;

class ToastStore {
  items = $state<Toast[]>([]);

  push(kind: ToastKind, message: string): void {
    const t: Toast = { id: nextId++, kind, message };
    this.items = [...this.items, t];
    setTimeout(() => this.dismiss(t.id), DURATION_MS);
  }

  success(message: string): void { this.push('success', message); }
  error(message: string): void { this.push('error', message); }
  info(message: string): void { this.push('info', message); }

  dismiss(id: number): void {
    this.items = this.items.filter((t) => t.id !== id);
  }
}

export const toast = new ToastStore();
