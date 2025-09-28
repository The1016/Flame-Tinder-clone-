// NavBar.tsx
'use client';
import Link from 'next/link';
import { useAtom } from 'jotai';
import { tokenAtom } from '@/state/auth';
import { Menu } from 'lucide-react';
import { useState } from 'react';

export default function NavBar() {
  const [token] = useAtom(tokenAtom);
  const [open, setOpen] = useState(false);

  return (
    <nav className="flex items-center justify-between px-4 py-2 bg-black text-white">
      {/* Flame now goes to /welcome */}
      <Link href="/welcome" className="text-2xl font-bold text-red-500">
        🔥
      </Link>

      <div className="relative">
        <button onClick={() => setOpen(o => !o)}>
          <Menu className="w-6 h-6" />
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-40 bg-neutral-900 border border-neutral-700 rounded shadow-lg">
            {token ? (
              <>
                <Link href="/feed" className="block px-4 py-2 hover:bg-neutral-800">Feed</Link>
                <Link href="/matches" className="block px-4 py-2 hover:bg-neutral-800">Matches</Link>
                <Link href="/profile" className="block px-4 py-2 hover:bg-neutral-800">Profile</Link>
                <Link href="/logout" className="block px-4 py-2 hover:bg-neutral-800">Logout</Link>
              </>
            ) : (
              <>
                <Link href="/login" className="block px-4 py-2 hover:bg-neutral-800">Login</Link>
                <Link href="/register" className="block px-4 py-2 hover:bg-neutral-800">Register</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
