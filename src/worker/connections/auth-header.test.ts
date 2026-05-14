import { describe, expect, it } from 'vitest';
import { buildAuthHeaders } from './auth-header';

describe('buildAuthHeaders', () => {
  it('returns empty for type=none', () => {
    expect(buildAuthHeaders({ type: 'none' }, { type: 'none' })).toEqual({});
  });

  it('adds Authorization: Bearer for type=bearer', () => {
    const h = buildAuthHeaders({ type: 'bearer' }, { type: 'bearer', token: 'sk_test_xyz' });
    expect(h).toEqual({ Authorization: 'Bearer sk_test_xyz' });
  });

  it('adds custom header for type=header', () => {
    const h = buildAuthHeaders(
      { type: 'header', headerName: 'X-API-Key' },
      { type: 'header', value: 'secret123' },
    );
    expect(h).toEqual({ 'X-API-Key': 'secret123' });
  });

  it('adds Authorization: Basic base64(user:pass) for type=basic', () => {
    const h = buildAuthHeaders(
      { type: 'basic' },
      { type: 'basic', username: 'admin', password: 'hunter2' },
    );
    expect(h).toEqual({ Authorization: `Basic ${btoa('admin:hunter2')}` });
  });

  it('throws if auth type and secret type disagree (defensive)', () => {
    expect(() =>
      buildAuthHeaders(
        { type: 'bearer' } as const,
        { type: 'basic', username: 'x', password: 'y' } as const,
      ),
    ).toThrow();
  });
});
