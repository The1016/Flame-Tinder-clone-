'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAtom } from 'jotai';
import { tokenAtom } from '@/state/auth';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import { motion } from 'framer-motion';

type Photo = { id: string; url: string; order: number };
type Profile = {
  age?: number | null;
  gender?: string | null;
  bio?: string | null;
  lat?: number | null;
  lon?: number | null;
  interests: string[];
  institution?: string | null;
};
type Me = { id: string; email: string; name?: string | null; profile?: Profile | null; photos?: Photo[] };

const REQUIRED = ['photo', 'institution', 'bio', 'interests'] as const;
const DEFAULT_INTERESTS = ['Music','Movies','Gaming','Gym','Cooking','Reading','Hiking','Photography','Travel','Tech','Art','Pets'];

export default function ProfilePage() {
  const router = useRouter();
  const [token] = useAtom(tokenAtom);

  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const p: Profile = useMemo(() => me?.profile ?? { interests: [] }, [me]);
  const photos = me?.photos ?? [];
  const primaryPhoto = useMemo(() => [...photos].sort((a, b) => a.order - b.order)[0], [photos]);
  const displayName = useMemo(() => (me?.name?.trim() || me?.email?.split('@')[0] || ''), [me]);

  async function loadMe() {
    if (!token) return;
    setLoading(true); setErr(null); setMsg(null);
    try {
      const data = await api<Me>('/users/me', { token });
      if (!data.profile) data.profile = { interests: [] };
      if (!data.photos) data.photos = [];
      setMe(data);
    } catch (e: any) {
      setErr(e.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (token) void loadMe(); }, [token]);

  const completion = useMemo(() => {
    const checks = {
      photo: photos.length > 0,
      institution: !!p.institution?.trim(),
      bio: !!p.bio?.trim(),
      interests: (p.interests?.length ?? 0) > 0
    };
    const done = Object.values(checks).filter(Boolean).length;
    return { done, total: REQUIRED.length, checks };
  }, [p, photos.length]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !me) return;
    setSaving(true); setMsg(null); setErr(null);
    try {
      await api('/users/me/profile', { token, method: 'PUT', body: JSON.stringify(p) });
      setMsg('Saved');
      if (completion.done === completion.total) router.push('/feed');
    } catch (e: any) {
      setErr(e.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(file: File, setPrimaryFlag = true) {
    if (!token) return;
    setUploading(true); setErr(null); setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const base = process.env.NEXT_PUBLIC_API_URL!;
      // create photo
      const createdRes = await fetch(`${base}/photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      if (!createdRes.ok) throw new Error((await createdRes.json().catch(() => ({} as any)))?.error || 'Upload failed');
      const created: Photo = await createdRes.json();
      // set primary if asked
      if (setPrimaryFlag && created?.id) {
        await fetch(`${base}/photos/${created.id}/primary`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      await loadMe();
      setMsg('Photo uploaded');
    } catch (e: any) {
      setErr(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const setField = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    if (!me) return;
    setMe({ ...me, profile: { ...p, [k]: v } });
  };

  const toggleInterest = (label: string) => {
    const set = new Set(p.interests ?? []);
    set.has(label) ? set.delete(label) : set.add(label);
    setField('interests', Array.from(set));
  };

  const badge = (ok: boolean) => (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] border ${
      ok ? 'border-emerald-500 text-emerald-400' : 'border-yellow-500 text-yellow-400'
    }`}>{ok ? 'Done' : 'Required'}</span>
  );

  return (
    <AppShell>
      <PageHeader
        title="Profile"
        subtitle="Complete your profile to unlock the feed."
        right={
          <div className="text-sm text-neutral-400">
            {completion.done}/{completion.total} complete
            <div className="mt-1 h-1.5 w-40 rounded bg-neutral-800 overflow-hidden">
              <div className="h-full bg-white transition-all" style={{ width: `${(completion.done / completion.total) * 100}%` }} />
            </div>
          </div>
        }
      />

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-48 rounded-2xl bg-neutral-900" />
          <div className="h-80 rounded-2xl bg-neutral-900" />
        </div>
      ) : err ? (
        <p className="text-red-400">{err}</p>
      ) : me ? (
        <form onSubmit={saveProfile} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT */}
          <motion.aside initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className="lg:col-span-4 rounded-2xl border border-neutral-900 bg-neutral-950 p-5">
            <div className="mb-2 text-xs text-neutral-400 flex items-center justify-between">
              <span>Profile photo <span className="text-red-400">*</span></span>
              {badge(photos.length > 0)}
            </div>
            <div className="relative mx-auto w-40">
              <img
                src={primaryPhoto?.url || 'https://picsum.photos/300?blur=1'}
                alt="Avatar"
                className="w-40 h-40 rounded-full object-cover border border-neutral-800"
              />
              <label className="absolute -bottom-2 -right-2 text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 cursor-pointer border border-neutral-700">
                {uploading ? '…' : (primaryPhoto ? 'Replace' : 'Upload')}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadPhoto(f, true);
                    e.currentTarget.value = '';
                  }}
                  disabled={uploading}
                />
              </label>
            </div>
            {photos.length === 0 && <p className="mt-2 text-[12px] text-yellow-400">Add at least one photo.</p>}

            <div className="mt-5 space-y-3">
              <div>
                <label className="text-xs text-neutral-500">Name (read-only)</label>
                <input value={displayName} readOnly className="mt-1 w-full rounded-lg bg-neutral-900 text-neutral-200 border border-neutral-800 px-3 py-2" />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Email</label>
                <input value={me.email} readOnly className="mt-1 w-full rounded-lg bg-neutral-900 text-neutral-200 border border-neutral-800 px-3 py-2" />
              </div>
            </div>
          </motion.aside>

          {/* RIGHT */}
          <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }}
            className="lg:col-span-8 rounded-2xl border border-neutral-900 bg-neutral-950 p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-neutral-500">Age</label>
                <input className="mt-1 w-full rounded-lg bg-black border border-neutral-800 text-neutral-100 px-3 py-2"
                  type="number" placeholder="Age" value={p.age ?? ''} onChange={e => setField('age', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Gender</label>
                <select className="mt-1 w-full rounded-lg bg-black border border-neutral-800 text-neutral-100 px-3 py-2"
                  value={p.gender ?? ''} onChange={e => setField('gender', e.target.value || null)}>
                  <option value="">Rather not specify</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="text-xs text-neutral-500">Institution <span className="text-red-400">*</span></label>
                {badge(!!p.institution?.trim())}
              </div>
              <input className="mt-1 w-full rounded-lg bg-black border border-neutral-800 text-neutral-100 px-3 py-2"
                placeholder="Your institution" value={p.institution ?? ''} onChange={e => setField('institution', e.target.value || null)} />
              {!p.institution?.trim() && <p className="mt-1 text-[12px] text-yellow-400">Required.</p>}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="text-xs text-neutral-500">Bio <span className="text-red-400">*</span></label>
                {badge(!!p.bio?.trim())}
              </div>
              <textarea className="mt-1 w-full rounded-lg bg-black border border-neutral-800 text-neutral-100 px-3 py-2"
                rows={4} placeholder="A little about you…" value={p.bio ?? ''} onChange={e => setField('bio', e.target.value || null)} />
              {!p.bio?.trim() && <p className="mt-1 text-[12px] text-yellow-400">Required.</p>}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="text-sm text-neutral-300">Interests <span className="text-red-400">*</span></label>
                {badge((p.interests?.length ?? 0) > 0)}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {Array.from(new Set([...(p.interests ?? []), ...DEFAULT_INTERESTS])).map(label => {
                  const selected = p.interests?.includes(label);
                  return (
                    <button key={label} type="button" onClick={() => toggleInterest(label)}
                      className={`px-3 py-1.5 rounded-full border transition text-sm
                        ${selected ? 'bg-white text-black border-white' : 'bg-black text-neutral-200 border-neutral-800 hover:border-neutral-600'}`}>
                      {label}
                    </button>
                  );
                })}
                <input
                  className="px-3 py-1.5 rounded-full bg-black border border-dashed border-neutral-700 text-neutral-100"
                  placeholder="Add interest… (Enter)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (!val) return;
                      toggleInterest(val);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
              </div>
              {(p.interests?.length ?? 0) === 0 && <p className="mt-1 text-[12px] text-yellow-400">Choose at least one interest.</p>}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-neutral-500">Latitude</label>
                <input className="mt-1 w-full rounded-lg bg-black border border-neutral-800 text-neutral-100 px-3 py-2"
                  type="number" step="0.0001" placeholder="Latitude" value={p.lat ?? ''} onChange={e => setField('lat', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Longitude</label>
                <input className="mt-1 w-full rounded-lg bg-black border border-neutral-800 text-neutral-100 px-3 py-2"
                  type="number" step="0.0001" placeholder="Longitude" value={p.lon ?? ''} onChange={e => setField('lon', e.target.value ? Number(e.target.value) : null)} />
              </div>
            </div>

            <div className="sticky bottom-5 mt-6">
              <div className="rounded-xl border border-neutral-800 bg-black/60 backdrop-blur px-3 py-2 flex items-center gap-3">
                <span className="text-xs text-neutral-400">
                  {completion.done === completion.total ? 'All set — save to continue' : 'Finish required fields to unlock the feed'}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  {err && <span className="text-xs text-red-400">{err}</span>}
                  {msg && <span className="text-xs text-emerald-400">{msg}</span>}
                  <button disabled={saving} className="px-4 py-2 rounded-lg bg-white text-black disabled:opacity-60">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </motion.section>
        </form>
      ) : null}
    </AppShell>
  );
}
