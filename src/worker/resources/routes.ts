import type { Context, Hono } from 'hono';
import { recordAuditEvent } from '../audit/writer';
import type { Session } from '../auth/session';
import { getConnection } from '../connections/registry';
import { proxyResourceOp, type OpName } from './proxy';
import { getResource, listResources } from './registry';

export function registerResourceRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get('/api/resources', (c) => {
    const session = c.get('session') as Session | undefined;
    if (!session) return new Response(null, { status: 401 });

    return c.json(
      listResources().map((r) => ({
        id: r.id,
        connection: r.connection,
        name: r.name,
        group: r.group,
        list: r.list,
        detail: r.detail,
        create: r.create,
        update: r.update,
        delete: r.delete,
        fields: r.fields,
      })),
    );
  });

  // Helper for the proxy endpoints.
  const handle = async (
    c: Context<{ Bindings: Env }>,
    op: OpName,
    recordIdParam: string | undefined,
  ): Promise<Response> => {
    const session = c.get('session') as Session | undefined;
    if (!session) return new Response(null, { status: 401 });

    const id = c.req.param('id');
    const resource = id ? getResource(id) : undefined;
    if (!resource) return new Response(JSON.stringify({ ok: false, error: 'unknown_resource' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

    const connection = getConnection(resource.connection);
    if (!connection) return new Response(JSON.stringify({ ok: false, error: 'unknown_connection' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

    if (!c.env.SECRETS_KEY) {
      return new Response(JSON.stringify({ ok: false, error: 'SECRETS_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    let body: unknown = undefined;
    if (op === 'create' || op === 'update') {
      try { body = await c.req.json(); } catch { /* allow empty body */ }
    }

    const query: Record<string, string> = {};
    for (const [k, v] of new URL(c.req.url).searchParams.entries()) query[k] = v;

    const params: Record<string, string> = {};
    if (recordIdParam) params.id = recordIdParam;

    const res = await proxyResourceOp({
      db: c.env.DB,
      rootKey: c.env.SECRETS_KEY,
      connection,
      resource,
      op,
      session: {
        userId: session.email,
        email: session.email,
        orgId: session.orgId,
        role: session.role,
      },
      query,
      params,
      body,
    });

    // Audit mutations on success.
    if (res.status >= 200 && res.status < 300 && (op === 'create' || op === 'update' || op === 'delete')) {
      await recordAuditEvent(c.env.DB, {
        action: `resource.${op}`,
        actor: { email: session.email, orgId: session.orgId, role: session.role },
        resourceId: resource.id,
        recordId: recordIdParam,
        connectionId: connection.id,
        ip: c.req.header('CF-Connecting-IP') ?? '',
      });
    }

    return res;
  };

  app.get('/api/resources/:id/list', (c) => handle(c, 'list', undefined));
  app.get('/api/resources/:id/detail/:recordId', (c) => handle(c, 'detail', c.req.param('recordId')));
  app.post('/api/resources/:id', (c) => handle(c, 'create', undefined));
  app.patch('/api/resources/:id/:recordId', (c) => handle(c, 'update', c.req.param('recordId')));
  app.delete('/api/resources/:id/:recordId', (c) => handle(c, 'delete', c.req.param('recordId')));
}
