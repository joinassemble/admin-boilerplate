/**
 * Fetch wrapper that always sends cookies and surfaces typed errors.
 * Use this for every call from the SPA to the Worker — never raw fetch.
 */

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    ...init,
  });
  if (!res.ok) {
    throw new ApiError(res.status, `${init.method ?? 'GET'} ${path} → ${res.status}`);
  }
  // 204 / no body → return undefined-as-T
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
