import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('worker', () => {
  it('GET /api/health returns {ok: true}', async () => {
    const res = await SELF.fetch('http://localhost/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('static asset catch-all', () => {
  it('serves the SPA index at /', async () => {
    const res = await SELF.fetch('http://localhost/');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<div id="app"></div>');
  });

  it('does not intercept /api/* even for unknown endpoints', async () => {
    const res = await SELF.fetch('http://localhost/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});
