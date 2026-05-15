import { api, ApiError } from './api';
import type { Resource } from '$shared/resource-schema';

class ResourceRegistry {
  status = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
  items = $state<Resource[]>([]);
  errorMessage = $state<string | null>(null);

  async load(): Promise<void> {
    if (this.status === 'loading' || this.status === 'ready') return;
    this.status = 'loading';
    try {
      this.items = await api<Resource[]>('/api/resources');
      this.status = 'ready';
    } catch (err) {
      this.errorMessage = err instanceof ApiError ? `${err.status}` : 'unknown';
      this.status = 'error';
    }
  }

  byId(id: string): Resource | undefined {
    return this.items.find((r) => r.id === id);
  }

  /** Returns resources keyed by their `.group` (or 'Other' if missing), in registration order. */
  grouped(): Record<string, Resource[]> {
    const out: Record<string, Resource[]> = {};
    for (const r of this.items) {
      const key = r.group ?? 'Other';
      (out[key] ??= []).push(r);
    }
    return out;
  }
}

export const registry = new ResourceRegistry();
