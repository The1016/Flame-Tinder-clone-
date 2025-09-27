'use client';
import Link from 'next/link';

export default function WelcomePage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white space-y-6">
      <h1 className="text-4xl font-bold">Welcome to Flame</h1>
      <p className="text-gray-400">Join the community or sign in to continue</p>
      <div className="space-x-4">
        <Link href="/login" className="px-4 py-2 bg-white text-black rounded">Login</Link>
        <Link href="/register" className="px-4 py-2 bg-red-500 text-white rounded">Register</Link>
      </div>
    </div>
  );
}
