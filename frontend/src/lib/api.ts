// frontend/src/lib/api.ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function api<T>(
  path: string,
  opts: RequestInit & { token?: string } = {}
): Promise<T> {
  const url = joinUrl(BASE, path);

  const headers = new Headers(opts.headers || {});
  headers.set('Content-Type', 'application/json');
  if (opts.token) headers.set('Authorization', `Bearer ${opts.token}`);

  const res = await fetch(url, { ...opts, headers, cache: 'no-store' });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || res.statusText || `HTTP ${res.status}`);
  }

  const txt = await res.text();
  if (!txt) return undefined as T;
  try { return JSON.parse(txt) as T; } catch { return txt as unknown as T; }
}

function joinUrl(base: string, path: string) {
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path : `/${path}`;
  return b ? `${b}${p}` : p; // falls back to relative if BASE not set (local proxy)
}
