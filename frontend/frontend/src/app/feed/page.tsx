// src/app/feed/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import SwipeDeck from '@/components/SwipeDeck';

type Photo = { id: string; url: string; order: number };
type Candidate = {
  id: string;
  email: string;
  name?: string | null;
  profile?: {
    age?: number | null;
    gender?: string | null;
    bio?: string | null;
    interests: string[];
    institution?: string | null;
  } | null;
  photos: Photo[];
};

export default function FeedPage() {
  const [token, setToken] = useState<string>('');
  const [cards, setCards] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Read token on the client (avoids SSR localStorage issues)
  useEffect(() => {
    const t =
      typeof window !== 'undefined'
        ? localStorage.getItem('token') ?? ''
        : '';
    setToken(t);
  }, []);

  const load = useCallback(async () => {
    if (!token) return; // wait until token is ready
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/feed?limit=20`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }
      );
      const data: Candidate[] = await res.json();
      setCards(data);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <PageHeader title="Feed" />

      {!token ? (
        <div className="text-neutral-400">Loading session…</div>
      ) : loading ? (
        <div className="text-neutral-400">Loading…</div>
      ) : cards.length === 0 ? (
        <div className="text-neutral-400">No more profiles nearby.</div>
      ) : (
        <SwipeDeck cards={cards} token={token} onEmpty={load} />
      )}
    </AppShell>
  );
}
