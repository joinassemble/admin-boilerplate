import { api, ApiError } from './api';
import type { PublicSession } from '$shared/auth-types';

/**
 * Singleton session store, rune-based.
 *
 * Call `loadSession()` once on app mount.
 * `signOut()` clears the cookie and resets the store.
 * Components read `session.value` reactively.
 */

class SessionStore {
  status = $state<'loading' | 'authed' | 'anonymous'>('loading');
  value = $state<PublicSession | null>(null);

  async load(): Promise<void> {
    try {
      this.value = await api<PublicSession>('/api/me');
      this.status = 'authed';
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        this.value = null;
        this.status = 'anonymous';
      } else {
        // Network or server error — treat as anonymous, allow sign-in flow.
        console.error('session load failed', err);
        this.value = null;
        this.status = 'anonymous';
      }
    }
  }

  async signOut(): Promise<void> {
    try {
      await api('/auth/sign-out', { method: 'POST' });
    } finally {
      this.value = null;
      this.status = 'anonymous';
    }
  }
}

export const session = new SessionStore();
