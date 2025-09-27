'use client';
import { useAtom } from 'jotai';
import { initAtom, userAtom } from '@/state/auth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function HomePage() {
  const [user] = useAtom(userAtom);
  const [, init] = useAtom(initAtom);
  const router = useRouter();

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user) router.replace('/feed');
  }, [user, router]);

  return (
    <div className="text-center py-16">
      <h1 className="text-3xl font-bold mb-2">Welcome to Flame</h1>
      <p className="text-gray-600 mb-6">Find your match. Chat. Repeat.</p>
      <div className="flex gap-3 justify-center">
        <Link className="px-4 py-2 rounded bg-black text-white" href="/register">Get started</Link>
        <Link className="px-4 py-2 rounded border" href="/login">Login</Link>
      </div>
    </div>
  );
}
