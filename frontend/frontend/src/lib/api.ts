export const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export async function api<T>(
  path: string,
  opts: RequestInit & { token?: string } = {}
): Promise<T> {
  const headers = new Headers(opts.headers || {});
  headers.set('Content-Type', 'application/json');
  if (opts.token) headers.set('Authorization', `Bearer ${opts.token}`);

  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers,
    cache: 'no-store'
  });
  if (!res.ok) {
    const msg = await safeJson(res);
    throw new Error(msg?.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function safeJson(res: Response) {
  try { return await res.json(); } catch { return null; }
}
