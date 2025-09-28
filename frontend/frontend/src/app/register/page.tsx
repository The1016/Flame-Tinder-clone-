//register page

'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAtom } from 'jotai';
import { setAuthAtom } from '@/state/auth';
import { useRouter } from 'next/navigation';

type RegisterResp = { token: string; user: any; requiresOnboarding?: boolean };

export default function RegisterPage() {
  const [, setAuth] = useAtom(setAuthAtom);
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setLoading(true);
    try {
      const resp = await api<RegisterResp>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setAuth(resp);
      router.push(resp.requiresOnboarding ? '/profile' : '/feed');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Create account</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full border p-2 rounded" placeholder="Name"
          value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input className="w-full border p-2 rounded" placeholder="Email" type="email"
          value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input className="w-full border p-2 rounded" placeholder="Password" type="password"
          value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={loading} className="w-full py-2 rounded bg-black text-white">
          {loading ? 'Creating...' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
