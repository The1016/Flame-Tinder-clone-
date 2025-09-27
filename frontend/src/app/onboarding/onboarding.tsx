'use client';
import { useAtom } from 'jotai';
import { tokenAtom } from '@/state/auth';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const DEFAULT_INTERESTS = ['Music','Movies','Gaming','Gym','Cooking','Reading','Hiking','Photography','Travel','Tech','Art','Pets'];

type Photo = { id: string; url: string; order: number };
type Me = {
  id: string;
  email: string;
  name?: string | null;
  profile?: {
    bio?: string | null;
    institution?: string | null;
    interests: string[];
  } | null;
  photos?: Photo[];
};

export default function OnboardingPage() {
  const [token] = useAtom(tokenAtom);
  const router = useRouter();

  const [me, setMe] = useState<Me | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const p = me?.profile ?? { interests: [] as string[] };
  const hasPhoto = (me?.photos?.length ?? 0) > 0;
  const canNext = useMemo(() => {
    if (step === 0) return hasPhoto;
    if (step === 1) return !!p.institution?.trim();
    if (step === 2) return !!p.bio?.trim();
    if (step === 3) return (p.interests?.length ?? 0) > 0;
    return true;
  }, [step, hasPhoto, p]);

  useEffect(() => {
    if (!token) return;
    api<Me>('/users/me', { token }).then((data) => {
      if (!data.profile) data.profile = { interests: [] };
      if (!data.photos) data.photos = [];
      setMe(data);
    });
  }, [token]);

  const setProfile = (patch: Partial<NonNullable<Me['profile']>>) => {
    if (!me) return;
    setMe({ ...me, profile: { ...(me.profile ?? { interests: [] }), ...patch } });
  };

  const uploadPhoto = async (file: File) => {
    if (!token) return;
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      if (!res.ok) throw new Error('Upload failed');
      const fresh = await api<Me>('/users/me', { token });
      if (!fresh.profile) fresh.profile = { interests: [] };
      if (!fresh.photos) fresh.photos = [];
      setMe(fresh);
    } catch (e: any) {
      setErr(e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleInterest = (label: string) => {
    if (!me) return;
    const set = new Set(p.interests ?? []);
    set.has(label) ? set.delete(label) : set.add(label);
    setProfile({ interests: Array.from(set) });
  };

  const next = async () => {
    if (!token || !me) return;
    setErr(null);

    // Persist the current profile data as we go
    try {
      await api('/users/me/profile', {
        token,
        method: 'PUT',
        body: JSON.stringify(me.profile ?? {}),
      });
    } catch (e: any) {
      setErr(e.message || 'Failed to save');
      return;
    }

    if (step < 3) {
      setStep(step + 1);
    } else {
      // Finalize onboarding
      try {
        const done = await api<{ ok: boolean }>('/onboarding/complete', {
          token,
          method: 'PUT',
          body: JSON.stringify({ profile: me.profile ?? {} }),
        });
        if (done.ok) router.replace('/feed');
      } catch (e: any) {
        setErr(e.message || 'Could not complete onboarding');
      }
    }
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  if (!token) return <p className="text-gray-200 p-6">Please log in.</p>;
  if (!me) return <p className="text-gray-200 p-6">Loading…</p>;

  return (
    <div className="max-w-lg mx-auto p-6 text-gray-100">
      <h1 className="text-2xl font-semibold mb-4">Set up your profile</h1>

      {/* Steps indicator */}
      <div className="flex gap-2 mb-6">
        {[0,1,2,3].map(i => (
          <div key={i} className={`h-1.5 flex-1 rounded ${i <= step ? 'bg-white' : 'bg-neutral-700'}`} />
        ))}
      </div>

      {/* Step content */}
      {step === 0 && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-300">Add a profile photo</p>
          <div className="flex items-center gap-4">
            <img
              src={me.photos?.[0]?.url || 'https://picsum.photos/300/300'}
              className="w-32 h-32 rounded-full object-cover border border-neutral-700"
              alt=""
            />
            <label className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 cursor-pointer border border-neutral-700">
              {busy ? 'Uploading…' : 'Upload'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPhoto(f);
                  e.currentTarget.value = '';
                }}
                disabled={busy}
              />
            </label>
          </div>
          {!hasPhoto && <p className="text-xs text-red-400">Photo is required</p>}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-2">
          <label className="text-sm text-neutral-300">Institution</label>
          <input
            className="w-full bg-black border border-gray-700 text-gray-100 p-2 rounded"
            placeholder="Your institution"
            value={me.profile?.institution ?? ''}
            onChange={(e) => setProfile({ institution: e.target.value })}
          />
          {!p.institution?.trim() && <p className="text-xs text-red-400">Institution is required</p>}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2">
          <label className="text-sm text-neutral-300">Bio</label>
          <textarea
            className="w-full bg-black border border-gray-700 text-gray-100 p-2 rounded"
            rows={4}
            placeholder="A little about you…"
            value={me.profile?.bio ?? ''}
            onChange={(e) => setProfile({ bio: e.target.value })}
          />
          {!p.bio?.trim() && <p className="text-xs text-red-400">Bio is required</p>}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="text-sm text-neutral-300">Pick some interests</div>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set([...(p.interests ?? []), ...DEFAULT_INTERESTS])).map(label => {
              const selected = p.interests?.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleInterest(label)}
                  className={`px-3 py-1.5 rounded-full border transition ${
                    selected ? 'bg-white text-black border-white'
                             : 'bg-black text-gray-200 border-gray-700 hover:border-gray-500'
                  }`}
                >
                  {label}
                </button>
              );
            })}
            <input
              className="px-3 py-1.5 rounded-full bg-black border border-dashed border-gray-700 text-gray-100"
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
          {(p.interests?.length ?? 0) === 0 && <p className="text-xs text-red-400">At least one interest is required</p>}
        </div>
      )}

      {err && <p className="text-sm text-red-400 mt-3">{err}</p>}

      {/* Nav buttons */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={back}
          disabled={step === 0}
          className="px-4 py-2 rounded border border-neutral-700 text-neutral-200 disabled:opacity-40"
        >
          Back
        </button>
        <button
          onClick={next}
          disabled={!canNext}
          className="px-4 py-2 rounded bg-white text-black disabled:opacity-50"
        >
          {step < 3 ? 'Continue' : 'Finish'}
        </button>
      </div>
    </div>
  );
}
