import { env, fetchMock } from 'cloudflare:test';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setConnectionSecret } from '../connections/secrets';
import type { Resource } from './types';
import { proxyResourceOp } from './proxy';

const ROOT_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(async () => {
  await env.DB.prepare('DELETE FROM connection_secrets').run();
  fetchMock.assertNoPendingInterceptors();
});

const session = { userId: 'ada@example.com', email: 'ada@example.com', orgId: null, role: 'admin' };

const stripeConnection = {
  id: 'stripe',
  name: 'Stripe',
  baseUrl: 'https://api.stripe.com',
  auth: { type: 'bearer' as const },
};

const customersResource: Resource = {
  id: 'stripe-customers',
  connection: 'stripe',
  name: 'Customers',
  list: { method: 'GET', path: '/v1/customers', dataPath: 'data' },
  detail: { method: 'GET', path: '/v1/customers/:id' },
  fields: [
    { key: 'id', label: 'ID', type: 'string', primary: true },
    { key: 'email', label: 'Email', type: 'email' },
  ],
};

describe('proxyResourceOp', () => {
  it('proxies a list call with bearer auth and extracts dataPath', async () => {
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'sk_test_xyz' }, ROOT_KEY, 'admin@example.com');

    fetchMock.get('https://api.stripe.com').intercept({ path: '/v1/customers' })
      .reply(200, { data: [{ id: 'cus_1', email: 'a@b.com' }], has_more: false });

    const res = await proxyResourceOp({
      db: env.DB,
      rootKey: ROOT_KEY,
      connection: stripeConnection,
      resource: customersResource,
      op: 'list',
      session,
      query: {},
      params: {},
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([{ id: 'cus_1', email: 'a@b.com' }]);
  });

  it('proxies a detail call with :id param', async () => {
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'sk_test_xyz' }, ROOT_KEY, 'admin@example.com');

    fetchMock.get('https://api.stripe.com').intercept({ path: '/v1/customers/cus_42' })
      .reply(200, { id: 'cus_42', email: 'x@y.com' });

    const res = await proxyResourceOp({
      db: env.DB,
      rootKey: ROOT_KEY,
      connection: stripeConnection,
      resource: customersResource,
      op: 'detail',
      session,
      query: {},
      params: { id: 'cus_42' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'cus_42', email: 'x@y.com' });
  });

  it('returns 502 when the upstream returns a 5xx', async () => {
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'sk_test_xyz' }, ROOT_KEY, 'admin@example.com');
    fetchMock.get('https://api.stripe.com').intercept({ path: '/v1/customers' }).reply(500, 'Internal Error');

    const res = await proxyResourceOp({
      db: env.DB,
      rootKey: ROOT_KEY,
      connection: stripeConnection,
      resource: customersResource,
      op: 'list',
      session,
      query: {},
      params: {},
    });
    expect(res.status).toBe(502);
  });

  it('returns 412 if the connection has no secret stored', async () => {
    // No setConnectionSecret call.
    const res = await proxyResourceOp({
      db: env.DB,
      rootKey: ROOT_KEY,
      connection: stripeConnection,
      resource: customersResource,
      op: 'list',
      session,
      query: {},
      params: {},
    });
    expect(res.status).toBe(412); // Precondition Failed
  });

  it('returns 403 when :session.<key> is null', async () => {
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'sk_test_xyz' }, ROOT_KEY, 'admin@example.com');

    const orgScopedResource: Resource = {
      ...customersResource,
      list: { method: 'GET', path: '/v1/customers?org=:session.orgId', dataPath: 'data' },
    };

    const res = await proxyResourceOp({
      db: env.DB,
      rootKey: ROOT_KEY,
      connection: stripeConnection,
      resource: orgScopedResource,
      op: 'list',
      session, // orgId is null
      query: {},
      params: {},
    });
    expect(res.status).toBe(403);
  });

  it('returns 405 when the op is not enabled', async () => {
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'sk_test_xyz' }, ROOT_KEY, 'admin@example.com');

    const res = await proxyResourceOp({
      db: env.DB,
      rootKey: ROOT_KEY,
      connection: stripeConnection,
      resource: customersResource, // no `create` op
      op: 'create',
      session,
      query: {},
      params: {},
      body: { email: 'new@example.com' },
    });
    expect(res.status).toBe(405);
  });

  it('returns 405 for a mutation op that omits enabled:true (Codex regression)', async () => {
    // Per spec §7, mutations are opt-in. A resource that declares
    // `create: { method:'POST', path:'/...' }` WITHOUT `enabled: true`
    // must NOT be callable — only with `enabled === true` is the route live.
    await setConnectionSecret(env.DB, 'stripe', { type: 'bearer', token: 'sk_test_xyz' }, ROOT_KEY, 'admin@example.com');

    const halfDeclaredResource: Resource = {
      ...customersResource,
      // Author declared the shape but didn't flip enabled. Should remain inert.
      create: { method: 'POST', path: '/v1/customers' },
      update: { method: 'PATCH', path: '/v1/customers/:id' },
      delete: { method: 'DELETE', path: '/v1/customers/:id' },
    };

    const createRes = await proxyResourceOp({
      db: env.DB, rootKey: ROOT_KEY, connection: stripeConnection,
      resource: halfDeclaredResource, op: 'create', session, query: {}, params: {},
      body: { email: 'new@example.com' },
    });
    expect(createRes.status).toBe(405);

    const updateRes = await proxyResourceOp({
      db: env.DB, rootKey: ROOT_KEY, connection: stripeConnection,
      resource: halfDeclaredResource, op: 'update', session, query: {}, params: { id: 'cus_1' },
      body: { email: 'updated@example.com' },
    });
    expect(updateRes.status).toBe(405);

    const deleteRes = await proxyResourceOp({
      db: env.DB, rootKey: ROOT_KEY, connection: stripeConnection,
      resource: halfDeclaredResource, op: 'delete', session, query: {}, params: { id: 'cus_1' },
    });
    expect(deleteRes.status).toBe(405);
  });
});
