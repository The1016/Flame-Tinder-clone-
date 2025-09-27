'use client';
import { atom } from 'jotai';

export type UserBasic = { id: string; email: string; name?: string | null };

export const tokenAtom = atom<string | null>(null);
export const userAtom = atom<UserBasic | null>(null);

// initialize from localStorage
export const initAtom = atom(null, (_get, set) => {
  if (typeof window === 'undefined') return;
  const t = localStorage.getItem('token');
  const u = localStorage.getItem('user');
  if (t) set(tokenAtom, t);
  if (u) set(userAtom, JSON.parse(u));
});

// persist
export const setAuthAtom = atom(
  null,
  (_get, set, payload: { token: string; user: UserBasic }) => {
    set(tokenAtom, payload.token);
    set(userAtom, payload.user);
    localStorage.setItem('token', payload.token);
    localStorage.setItem('user', JSON.stringify(payload.user));
  }
);

export const clearAuthAtom = atom(null, (_get, set) => {
  set(tokenAtom, null);
  set(userAtom, null);
  localStorage.removeItem('token');
  localStorage.removeItem('user');
});
