import { describe, expect, it } from 'vitest';
import { defineConnection } from './define';

describe('defineConnection', () => {
  it('returns the connection object verbatim (declarative helper)', () => {
    const c = defineConnection({
      id: 'stripe',
      name: 'Stripe',
      baseUrl: 'https://api.stripe.com',
      auth: { type: 'bearer' },
    });
    expect(c).toEqual({
      id: 'stripe',
      name: 'Stripe',
      baseUrl: 'https://api.stripe.com',
      auth: { type: 'bearer' },
    });
  });

  it('preserves header auth config including headerName', () => {
    const c = defineConnection({
      id: 'custom',
      name: 'Custom',
      baseUrl: 'https://example.com',
      auth: { type: 'header', headerName: 'X-API-Key' },
    });
    expect(c.auth).toEqual({ type: 'header', headerName: 'X-API-Key' });
  });
});
