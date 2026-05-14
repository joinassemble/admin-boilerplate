import type { ConnectionAuth, ConnectionSecret } from './types';

/**
 * Build the outbound auth headers for a Connection given its declared
 * auth type and the decrypted secret blob. Throws if the secret shape
 * doesn't match the declared type — that's a programming error
 * (someone stored a malformed secret), not a runtime input.
 */
export function buildAuthHeaders(auth: ConnectionAuth, secret: ConnectionSecret): Record<string, string> {
  if (auth.type !== secret.type) {
    throw new Error(`Connection auth.type (${auth.type}) does not match secret.type (${secret.type})`);
  }

  switch (auth.type) {
    case 'none':
      return {};
    case 'bearer':
      if (secret.type !== 'bearer') throw new Error('unreachable');
      return { Authorization: `Bearer ${secret.token}` };
    case 'header':
      if (secret.type !== 'header') throw new Error('unreachable');
      return { [auth.headerName]: secret.value };
    case 'basic': {
      if (secret.type !== 'basic') throw new Error('unreachable');
      const encoded = btoa(`${secret.username}:${secret.password}`);
      return { Authorization: `Basic ${encoded}` };
    }
  }
}
