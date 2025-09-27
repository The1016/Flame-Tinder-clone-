'use client';

import { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { tokenAtom } from '@/state/auth';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import SwipeDeck from '@/components/SwipeDeck';
import { useRouter } from 'next/navigation';

type Candidate = {
  id: string;
  email: string;
  name?: string | null;
  profile?: { bio?: string | null; interests: string[]; institution?: string | null } | null;
  photos: { id: string; url: string; order: number }[];
};

export default function FeedPage() {
  const router = useRouter();
  const [token] = useAtom(tokenAtom);

  const [cards, setCards] = useState<Candidate[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setErr(null);
    try {
      const list = await api<Candidate[]>('/feed?maxKm=200', { token });
      setCards(list);
    } catch (e: any) {
      if (e?.message === 'ONBOARDING_REQUIRED') {
        router.replace('/profile');
        return;
      }
      setErr(e.message || 'Failed to load feed');
    }
  }

  useEffect(() => { if (token) load(); }, [token]);

  return (
    <AppShell>
      <PageHeader title="Discover" subtitle="People you may like nearby." />
      {cards === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-80 rounded-2xl bg-neutral-900" />
          ))}
        </div>
      ) : err ? (
        <p className="text-red-400">{err}</p>
      ) : cards.length === 0 ? (
        <div className="rounded-2xl border border-neutral-900 bg-neutral-950 p-8 text-center">
          <h3 className="font-medium">No profiles nearby right now</h3>
          <p className="mt-1 text-sm text-neutral-400">
            Try again later, or update your interests to broaden your matches.
          </p>
          <button onClick={() => router.push('/profile')} className="mt-4 px-4 py-2 rounded-lg bg-white text-black">
            Update profile
          </button>
        </div>
      ) : (
        <SwipeDeck cards={cards} onEmpty={load} />
      )}
    </AppShell>
  );
}
