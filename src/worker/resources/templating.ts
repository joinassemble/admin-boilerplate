export class TemplatingError extends Error {
  constructor(public readonly kind: 'missing_session_field', message: string) {
    super(message);
  }
}

export interface TemplateSession {
  userId: string | null;
  email: string | null;
  orgId: string | null;
  role: string | null;
}

/**
 * Replace tokens in a URL path:
 *   :session.<key>   — values from the session (userId, email, orgId, role)
 *   :query.<key>     — values from URL query params
 *   :<paramName>     — values from the params map (e.g. {id: 'cus_xyz'})
 *
 * If a :session.<key> resolves to null, throw TemplatingError so the
 * route can return 403 — this means a resource declared org-scoping
 * but the current session has no orgId set.
 *
 * Tokens that don't match any of the three known patterns are left as-is.
 */
export function interpolatePath(
  path: string,
  session: TemplateSession,
  query: Record<string, string>,
  params: Record<string, string>,
): string {
  // :session.<key>
  let out = path.replace(/:session\.([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, key: string) => {
    const value = (session as unknown as Record<string, string | null>)[key];
    if (value == null) {
      throw new TemplatingError('missing_session_field', `session.${key} is not set`);
    }
    return encodeURIComponent(value);
  });

  // :query.<key>
  out = out.replace(/:query\.([a-zA-Z_][a-zA-Z0-9_]*)/g, (m, key: string) => {
    const value = query[key];
    return value === undefined ? m : encodeURIComponent(value);
  });

  // :<paramName>  (one segment only, no dots)
  out = out.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)(?![.a-zA-Z0-9_])/g, (m, key: string) => {
    const value = params[key];
    return value === undefined ? m : encodeURIComponent(value);
  });

  return out;
}
