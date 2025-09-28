'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
  type PanInfo,
  type Variants,
  type Easing,
} from 'framer-motion';
import Image from 'next/image';
import { api } from '@/lib/api';

// ---------- Types ----------
type Photo = { id: string; url: string; order: number };

type Candidate = {
  id: string;
  email: string;
  name?: string | null;
  profile?: {
    age?: number | null;
    gender?: string | null;
    bio?: string | null;
    city?: string | null;
    jobTitle?: string | null;
    company?: string | null;
    education?: string | null;
    heightCm?: number | null;
    interests?: string[] | null;
    photos?: Photo[] | null;
  } | null;
  photos?: Photo[] | null;
};

type SwipeDeckProps = {
  cards: Candidate[];
  token: string;
  onEmpty?: () => void;
  onSwiped?: (id: string, liked: boolean) => void; // keep existing signature
};

// ---------- Utils ----------
const nonEmpty = (s?: string | null) => (s && s.trim().length ? s.trim() : undefined);

function bestPhoto(c: Candidate): string | undefined {
  const list = (c.profile?.photos ?? c.photos ?? []) as Photo[];
  if (!list || list.length === 0) return undefined;
  const sorted = [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return sorted[0]?.url;
}

function cmToFeetInches(cm?: number | null): string | undefined {
  if (!cm) return undefined;
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  return `${feet}'${inches}"`;
}

// ---------- Page model ----------
type Page =
  | { kind: 'hero' }
  | { kind: 'interests' }
  | { kind: 'section'; section: 'about' | 'work' | 'edu' | 'basics' };

function buildPages(c: Candidate): Page[] {
  const pages: Page[] = [{ kind: 'hero' }];

  const hasInterests = (c.profile?.interests?.length ?? 0) > 0 || nonEmpty(c.profile?.bio);
  if (hasInterests) pages.push({ kind: 'interests' });

  if (c.profile?.jobTitle || c.profile?.company) pages.push({ kind: 'section', section: 'work' });
  if (c.profile?.education) pages.push({ kind: 'section', section: 'edu' });
  if (c.profile?.gender || c.profile?.age || c.profile?.city || c.profile?.heightCm)
    pages.push({ kind: 'section', section: 'basics' });
  if (nonEmpty(c.profile?.bio)) pages.push({ kind: 'section', section: 'about' });

  return pages;
}

// ---------- Motion (Framer v12-typed) ----------
const CB_EASE: Easing = [0.22, 1, 0.36, 1];

const pageVariants: Variants = {
  enter: (dir: number) => ({
    y: dir > 0 ? 40 : -40,
    opacity: 0,
    filter: 'blur(4px)',
    transition: { duration: 0.22, ease: CB_EASE },
  }),
  center: {
    y: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.26, ease: CB_EASE },
  },
  exit: (dir: number) => ({
    y: dir > 0 ? -40 : 40,
    opacity: 0,
    filter: 'blur(4px)',
    transition: { duration: 0.22, ease: CB_EASE },
  }),
};

const swipeConfidenceThreshold = 500; // px * velocity

// ---------- Component ----------
export default function SwipeDeck({ cards, token, onEmpty, onSwiped }: SwipeDeckProps) {
  const [index, setIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageDir, setPageDir] = useState(1); // -1 up, +1 down (for vertical page animation)

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-10, 0, 10]);
  const opacity = useTransform(x, [-300, 0, 300], [0.6, 1, 0.6]);

  const current = cards[index];
  const pages = useMemo(() => (current ? buildPages(current) : []), [current]);

  const resetMotion = useCallback(() => {
    x.set(0);
  }, [x]);

  useEffect(() => {
    if (!current && onEmpty) onEmpty();
  }, [current, onEmpty]);

  useEffect(() => {
    // when card changes, reset page state & motion
    setPageIndex(0);
    setPageDir(1);
    resetMotion();
  }, [index, resetMotion]);

  const paginate = useCallback(
    (dir: 1 | -1) => {
      if (!current) return;
      setIndex((i) => {
        const next = i + dir;
        if (next >= cards.length) {
          onEmpty?.();
          return i;
        }
        if (next < 0) return 0;
        return next;
      });
    },
    [cards.length, current, onEmpty]
  );

  // Correct api() usage (fetch-style, not axios)
  const post = useCallback(
    async (path: string) => {
      await api<void>(path, { token, method: 'POST', body: JSON.stringify({}) });
    },
    [token]
  );

  const handleSwipe = useCallback(
    async (direction: 'left' | 'right') => {
      if (!current) return;
      const liked = direction === 'right';

      try {
        if (liked) {
          await post(`/likes/${current.id}`);
        } else {
          await post(`/passes/${current.id}`);
        }
      } catch {
        // swallow for now; consider toast/error state
      } finally {
        onSwiped?.(current.id, liked);
        paginate(1);
      }
    },
    [current, onSwiped, paginate, post]
  );

  const onDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const swipe = Math.abs(info.offset.x) * info.velocity.x;
      if (swipe > swipeConfidenceThreshold) {
        handleSwipe('right');
      } else if (swipe < -swipeConfidenceThreshold) {
        handleSwipe('left');
      } else {
        // snap back (no-op; motion spring returns)
      }
    },
    [handleSwipe]
  );

  // Wheel to change inner page
  const wheelRef = useRef(0);
  const onWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - wheelRef.current < 250) return; // throttle
    wheelRef.current = now;

    if (e.deltaY > 0 && pageIndex < pages.length - 1) {
      setPageDir(1);
      setPageIndex((p) => p + 1);
    } else if (e.deltaY < 0 && pageIndex > 0) {
      setPageDir(-1);
      setPageIndex((p) => p - 1);
    }
  };

  // ---------- Renderers ----------
  const renderHero = (c: Candidate) => {
    const photo = bestPhoto(c);
    const nameAge = `${nonEmpty(c.name) || c.email}${c.profile?.age ? `, ${c.profile.age}` : ''}`;
    const city = nonEmpty(c.profile?.city);

    return (
      <div className="flex flex-col gap-3">
        <div className="relative w-full aspect-[4/5] overflow-hidden rounded-2xl bg-neutral-800">
          {photo ? (
            <Image
              src={photo}
              alt={nameAge}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-neutral-400">
              No photo
            </div>
          )}
        </div>

        <div className="px-1">
          <div className="text-xl font-semibold">{nameAge}</div>
          {city && <div className="text-sm text-neutral-400">{city}</div>}
        </div>
      </div>
    );
  };

  // Interests page — text only (no image) as requested for the feed
  const renderInterests = (c: Candidate) => {
    const bio = nonEmpty(c.profile?.bio);
    const interests = c.profile?.interests ?? [];

    return (
      <div className="flex flex-col gap-4">
        {bio && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-sm leading-relaxed text-neutral-200">{bio}</div>
          </div>
        )}

        {interests.length > 0 && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="mb-2 text-sm font-medium text-neutral-300">Interests</div>
            <div className="flex flex-wrap gap-2">
              {interests.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-200"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSection = (c: Candidate, section: 'about' | 'work' | 'edu' | 'basics') => {
    if (section === 'about') {
      const bio = nonEmpty(c.profile?.bio);
      return bio ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="text-sm leading-relaxed text-neutral-200 whitespace-pre-wrap">{bio}</div>
        </div>
      ) : (
        <div className="text-neutral-400 text-sm">No bio provided.</div>
      );
    }

    if (section === 'work') {
      const jt = nonEmpty(c.profile?.jobTitle);
      const co = nonEmpty(c.profile?.company);
      return (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="text-sm text-neutral-200">
            {jt ? <span className="font-medium">{jt}</span> : 'Job not added'}
            {co ? <span className="text-neutral-400"> · {co}</span> : ''}
          </div>
        </div>
      );
    }

    if (section === 'edu') {
      const edu = nonEmpty(c.profile?.education);
      return (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="text-sm text-neutral-200">{edu ?? 'Education not added'}</div>
        </div>
      );
    }

    // basics
    const gender = nonEmpty(c.profile?.gender);
    const city = nonEmpty(c.profile?.city);
    const age = c.profile?.age ? `${c.profile.age}` : undefined;
    const height = cmToFeetInches(c.profile?.heightCm);

    const rows = [
      { k: 'Age', v: age },
      { k: 'Gender', v: gender },
      { k: 'Height', v: height },
      { k: 'City', v: city },
    ].filter((r) => !!r.v);

    return rows.length ? (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {rows.map((r) => (
            <div key={r.k} className="flex items-center justify-between gap-3">
              <dt className="text-neutral-400">{r.k}</dt>
              <dd className="text-neutral-100">{r.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    ) : (
      <div className="text-neutral-400 text-sm">No basic details yet.</div>
    );
  };

  if (!current) {
    return (
      <div className="w-full h-full flex items-center justify-center text-neutral-400">
        No more cards
      </div>
    );
  }

  const page = pages[pageIndex];
  const content =
    page?.kind === 'hero'
      ? renderHero(current)
      : page?.kind === 'interests'
      ? renderInterests(current)
      : renderSection(current, page.section);

  // ---------- UI ----------
  return (
    <div className="w-full h-full px-4 md:px-6" onWheel={onWheel}>
      {/* Page dots */}
      <div className="flex justify-center gap-1 pt-2">
        {pages.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to page ${i + 1}`}
            onClick={() => {
              setPageDir(i > pageIndex ? 1 : -1);
              setPageIndex(i);
            }}
            className={`h-1.5 rounded-full transition-all ${
              i === pageIndex ? 'w-4 bg-neutral-100' : 'w-2 bg-neutral-600'
            }`}
          />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Left: swipeable content */}
        <div className="md:col-span-3">
          <AnimatePresence custom={pageDir} mode="popLayout">
            <motion.div
              key={`${current.id}-${pageIndex}`}
              custom={pageDir}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              style={{ rotate, opacity }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.9}
              onDragEnd={onDragEnd}
              className="select-none"
            >
              {content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right: actions & meta */}
        <div className="md:col-span-2">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 md:p-6 text-neutral-100">
            <div className="flex items-center gap-3">
              <button
                className="h-11 w-11 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700"
                onClick={() => handleSwipe('left')}
                aria-label="Pass"
                title="Pass"
              >
                ✖
              </button>
              <button
                className="h-12 w-12 rounded-full bg-neutral-100 text-neutral-900 hover:bg-white"
                onClick={() => handleSwipe('right')}
                aria-label="Like"
                title="Like"
              >
                ❤
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button
                  className="text-sm px-3 py-1.5 rounded-lg border border-neutral-700 hover:bg-neutral-800"
                  onClick={() => {
                    if (pageIndex > 0) {
                      setPageDir(-1);
                      setPageIndex((p) => p - 1);
                    }
                  }}
                >
                  Prev
                </button>
                <button
                  className="text-sm px-3 py-1.5 rounded-lg border border-neutral-700 hover:bg-neutral-800"
                  onClick={() => {
                    if (pageIndex < pages.length - 1) {
                      setPageDir(1);
                      setPageIndex((p) => p + 1);
                    }
                  }}
                >
                  Next
                </button>
              </div>
            </div>

            {/* Meta */}
            <div className="mt-4 space-y-2 text-sm text-neutral-300">
              <div>
                <span className="text-neutral-500">User ID:</span> {current.id}
              </div>
              {current.profile?.city && (
                <div>
                  <span className="text-neutral-500">Based in:</span> {current.profile.city}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
