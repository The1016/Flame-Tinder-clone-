'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NavLink = ({ href, label }: { href: string; label: string }) => {
  const path = usePathname();
  const active = path === href || (href !== '/' && path?.startsWith(href));
  return (
    <Link
      href={href}
      className={`px-3 py-2 rounded-lg text-sm transition
        ${active ? 'bg-white text-black' : 'text-neutral-300 hover:text-white hover:bg-neutral-800'}`}
    >
      {label}
    </Link>
  );
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-40 border-b border-neutral-900 bg-black/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight">flame</Link>
          <nav className="flex items-center gap-1">
            <NavLink href="/feed" label="Feed" />
            <NavLink href="/profile" label="Profile" />
            <NavLink href="/settings" label="Settings" />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="mt-16 pb-12 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} flame — crafted with care
      </footer>
    </div>
  );
}
