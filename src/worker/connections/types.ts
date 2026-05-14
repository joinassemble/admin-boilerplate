/**
 * A Connection describes ONE external service the Worker proxies.
 * Declared in code at `src/connections/<id>.ts`.
 *
 * The auth `type` selects what shape of secret D1 will hold for this
 * connection. The actual secret values are NEVER in code — only the
 * structural declaration.
 */

export type ConnectionAuth =
  | { type: 'none' }
  | { type: 'bearer' }
  | { type: 'header'; headerName: string }
  | { type: 'basic' };

export interface Connection {
  id: string;
  name: string;
  baseUrl: string;
  auth: ConnectionAuth;
}

/**
 * Shape of the (encrypted) JSON blob stored in `connection_secrets.ciphertext`
 * for each auth type. The Worker never returns these to the SPA — they're
 * only decrypted at outbound-fetch time.
 */
export type ConnectionSecret =
  | { type: 'none' } // empty, but stored so `isConfigured` is true
  | { type: 'bearer'; token: string }
  | { type: 'header'; value: string }
  | { type: 'basic'; username: string; password: string };
