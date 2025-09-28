'use client';
import { useAtom } from 'jotai';
import { tokenAtom, userAtom } from '@/state/auth';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

type Match = {
  id: string;
  createdAt: string;
  userAId: string;
  userBId: string;
  messages: { id: string; content: string; createdAt: string; senderId: string }[];
  counterpart?: {
    id: string;
    name?: string | null;
    email: string;
    profile?: { bio?: string | null } | null;
    photos: { url: string; order: number }[];
  }
};

export default function MatchesPage() {
  const [token] = useAtom(tokenAtom);
  const [me] = useAtom(userAtom);
  const [list, setList] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api<Match[]>('/matches', { token }).then(setList).finally(() => setLoading(false));
  }, [token]);

  if (!token) return <p>Please <a className="underline" href="/login">log in</a>.</p>;
  if (loading) return <p>Loading matches…</p>;
  if (!list.length) return <p>No matches yet.</p>;

  return (
    <div className="space-y-3">
      {list.map(m => {
        const cp = m.counterpart!;
        const img = cp.photos[0]?.url || 'https://picsum.photos/200';
        const last = m.messages[0];
        return (
          <Link href={`/chat/${m.id}`} key={m.id} className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
            <img src={img} alt="" className="w-12 h-12 rounded-full object-cover" />
            <div className="flex-1">
              <div className="font-medium">{cp.name || cp.email.split('@')[0]}</div>
              <div className="text-sm text-gray-600 truncate">{last ? `${last.senderId === me?.id ? 'You: ' : ''}${last.content}` : cp.profile?.bio || 'Say hi!'}</div>
            </div>
            <span className="text-xs text-gray-500">{new Date(m.createdAt).toLocaleDateString()}</span>
          </Link>
        );
      })}
    </div>
  );
}
