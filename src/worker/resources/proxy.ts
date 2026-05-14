import { buildAuthHeaders } from '../connections/auth-header';
import { getConnectionSecret } from '../connections/secrets';
import type { Connection } from '../connections/types';
import { interpolatePath, TemplatingError, type TemplateSession } from './templating';
import type { Resource, ResourceOp } from './types';

export type OpName = 'list' | 'detail' | 'create' | 'update' | 'delete';

interface ProxyArgs {
  db: D1Database;
  rootKey: string;
  connection: Connection;
  resource: Resource;
  op: OpName;
  session: TemplateSession;
  query: Record<string, string>;
  params: Record<string, string>;
  body?: unknown;
}

export async function proxyResourceOp(args: ProxyArgs): Promise<Response> {
  const opConfig = pickOp(args.resource, args.op);
  if (!opConfig) {
    return new Response(JSON.stringify({ ok: false, error: 'op_not_enabled' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Load + decrypt the secret.
  const secret = await getConnectionSecret(args.db, args.connection.id, args.rootKey);
  if (!secret) {
    return new Response(JSON.stringify({ ok: false, error: 'connection_not_configured' }), {
      status: 412,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build the outbound URL.
  let fullPath: string;
  try {
    fullPath = interpolatePath(opConfig.path, args.session, args.query, args.params);
  } catch (err) {
    if (err instanceof TemplatingError) {
      return new Response(JSON.stringify({ ok: false, error: err.kind }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw err;
  }

  const url = args.connection.baseUrl.replace(/\/$/, '') + (fullPath.startsWith('/') ? fullPath : `/${fullPath}`);

  // Build the outbound request.
  const headers: Record<string, string> = {
    ...buildAuthHeaders(args.connection.auth, secret),
    Accept: 'application/json',
  };
  const init: RequestInit = { method: opConfig.method, headers };
  if (args.body !== undefined) {
    init.body = JSON.stringify(args.body);
    headers['Content-Type'] = 'application/json';
  }

  // Outbound call.
  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: 'upstream_unreachable', detail: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Pass through 4xx as-is (upstream knows best); convert 5xx to 502 so
  // the caller knows it wasn't our Worker.
  if (upstream.status >= 500) {
    return new Response(JSON.stringify({ ok: false, error: 'upstream_5xx', status: upstream.status }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Extract dataPath for list operations.
  if (args.op === 'list' && upstream.ok && opConfig.dataPath) {
    const json = await upstream.json<Record<string, unknown>>();
    const extracted = extractByDotPath(json, opConfig.dataPath);
    return new Response(JSON.stringify(extracted), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Otherwise return the upstream body unchanged.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  });
}

function pickOp(resource: Resource, op: OpName): ResourceOp | undefined {
  switch (op) {
    case 'list':
      return resource.list;
    case 'detail':
      return resource.detail;
    case 'create':
      return resource.create?.enabled === false ? undefined : resource.create;
    case 'update':
      return resource.update?.enabled === false ? undefined : resource.update;
    case 'delete':
      return resource.delete?.enabled === false ? undefined : resource.delete;
  }
}

function extractByDotPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const segment of path.split('.')) {
    if (cur && typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return cur;
}
