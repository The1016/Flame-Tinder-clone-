'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
  type PanInfo,
  cubicBezier,
  type Variants,
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
    interests: string[];
    institution?: string | null;
  } | null;
  photos: Photo[];
};

// Section content subtypes
type SectionContentText = { body?: string };
type SectionContentGallery = { images?: string[] };
type SectionContentCardItem = { image?: string; text?: string };
type SectionContentCard = { items?: SectionContentCardItem[] };

// Section union
type Section = {
  id: string;
  title: string;
  type: 'text' | 'qa' | 'gallery' | 'links' | 'card' | string;
  content?: SectionContentText | SectionContentGallery | SectionContentCard | Record<string, unknown>;
  order: number;
};

// ---------- Page transition variants ----------
const ease = cubicBezier(0.22, 1, 0.36, 1);

const pageVariants: Variants = {
  enter: (dir: number) => ({
    y: dir > 0 ? 40 : -40,
    opacity: 0,
    filter: 'blur(4px)',
    transition: { duration: 0.22, ease }
  }),
  center: {
    y: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.26, ease }
  },
  exit: (dir: number) => ({
    y: dir > 0 ? -40 : 40,
    opacity: 0,
    filter: 'blur(4px)',
    transition: { duration: 0.22, ease }
  })
};

export default function SwipeDeck({
  cards,
  token,
  onEmpty,
  onSwiped,
}: {
  cards: Candidate[];
  token: string;
  onEmpty?: () => void;
  onSwiped?: (id: string, liked: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageDir, setPageDir] = useState(0);
  const [sectionsByUser, setSectionsByUser] = useState<Record<string, Section[]>>({});
  const [loadingSections, setLoadingSections] = useState<Record<string, boolean>>({});
  const [reaction, setReaction] = useState<null | 'like' | 'nope'>(null);

  const current = cards[index];

  // Fetch sections per user
  useEffect(() => {
    if (!current) return;
    const uid = current.id;
    if (sectionsByUser[uid] || loadingSections[uid]) return;
    setLoadingSections(m => ({ ...m, [uid]: true }));
    api<Section[]>(`/sections/${uid}`, { token })
      .then(list => {
        const sorted = [...(list || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setSectionsByUser(m => ({ ...m, [uid]: sorted }));
      })
      .catch(() => setSectionsByUser(m => ({ ...m, [uid]: [] })))
      .finally(() => setLoadingSections(m => ({ ...m, [uid]: false })));
  }, [current, token, sectionsByUser, loadingSections]);

  // Build pages
  const pages = useMemo(() => {
    if (!current) return [];
    const secs = sectionsByUser[current.id] || [];
    const built: Array<{ kind: 'hero' | 'section' | 'interests'; section?: Section; sectionItemIndex?: number }> = [];
    built.push({ kind: 'hero' });
    for (const s of secs) {
      if (s.type === 'card') {
        const items = Array.isArray((s.content as SectionContentCard | undefined)?.items)
          ? (s.content as SectionContentCard).items!
          : [];
        items.forEach((_, i) => built.push({ kind: 'section', section: s, sectionItemIndex: i }));
      } else {
        built.push({ kind: 'section', section: s });
      }
    }
    built.push({ kind: 'interests' });
    if (pageIndex > built.length - 1) setPageIndex(built.length - 1);
    return built;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, sectionsByUser]);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-400, 0, 400], [-10, 0, 10]);
  const resetMotion = useCallback(() => x.set(0), [x]);

  const showReaction = (kind: 'like' | 'nope') => {
    setReaction(kind);
    setTimeout(() => setReaction(null), 650);
  };

  const doSwipe = useCallback(
    async (liked: boolean) => {
      if (!current) return;
      showReaction(liked ? 'like' : 'nope');
      try {
        await api('/swipes', {
          token,
          method: 'POST',
          body: JSON.stringify({ targetId: current.id, liked }),
        });
      } catch {
        /* ignore */
      } finally {
        onSwiped?.(current.id, liked);
        setIndex(i => {
          const next = i + 1;
          if (next >= cards.length) {
            onEmpty?.();
            return i;
          }
          return next;
        });
        setPageIndex(0);
        resetMotion();
      }
    },
    [current, token, cards.length, onSwiped, onEmpty, resetMotion]
  );

  const onDragEnd = (_: MouseEvent | TouchEvent, info: PanInfo) => {
    const threshold = 140;
    if (info.offset.x > threshold) {
      x.set(400);
      void doSwipe(true);
    } else if (info.offset.x < -threshold) {
      x.set(-400);
      void doSwipe(false);
    } else {
      resetMotion();
    }
  };

  const goPage = (next: number, dir: number) => {
    setPageDir(dir);
    setPageIndex(prev => Math.max(0, Math.min((pages.length || 1) - 1, next)));
  };
  const goNextPage = () => goPage(pageIndex + 1, +1);
  const goPrevPage = () => goPage(pageIndex - 1, -1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); void doSwipe(true); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); void doSwipe(false); }
      if (e.key === 'ArrowDown')  { e.preventDefault(); goNextPage(); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); goPrevPage(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, doSwipe]);

  const wheelRef = useRef<number>(0);
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - (wheelRef.current || 0) < 250) return;
    if (Math.abs(e.deltaY) < 10) return;
    wheelRef.current = now;
    if (e.deltaY > 0) goNextPage();
    else goPrevPage();
  };

  // ... (rest of render logic same as before)

  if (!current) {
    return <div className="text-neutral-400 text-center py-16">No more profiles nearby.</div>;
  }

  const content =
    pages[pageIndex]?.kind === 'hero'
      ? renderHero(current)
      : pages[pageIndex]?.kind === 'interests'
      ? renderInterests(current)
      : renderSection(current, pages[pageIndex].section!, pages[pageIndex].sectionItemIndex);

  return (
    <div className="w-full h-full px-4 md:px-6" onWheel={onWheel}>
      <div className="flex justify-center gap-1 pt-2">
        {pages.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to page ${i + 1}`}
            onClick={() => goPage(i, i > pageIndex ? +1 : -1)}
            className={`h-1.5 rounded-full transition-all ${i === pageIndex ? 'bg-white w-8' : 'bg-neutral-600 w-3'}`}
          />
        ))}
      </div>

      <div className="relative h-[calc(100vh-6rem)]">
        <AnimatePresence initial={false} mode="wait" custom={pageDir}>
          <motion.div
            key={`${current.id}-${pageIndex}`}
            custom={pageDir}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0"
          >
            <motion.div
              drag="x"
              style={{ x, rotate }}
              dragMomentum={false}
              onDragEnd={onDragEnd}
              dragElastic={0.2}
              className="h-full"
            >
              {content}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// helpers (renderHero, renderSection, renderInterests, TwoColCard, bestPhoto)
// ... keep same implementations as in the previous fixed version.
