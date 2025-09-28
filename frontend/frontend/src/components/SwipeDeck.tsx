'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence, type PanInfo } from 'framer-motion';
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
const pageVariants = {
  enter: (dir: number) => ({
    y: dir > 0 ? 40 : -40,
    opacity: 0,
    filter: 'blur(4px)',
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
  }),
  center: {
    y: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] }
  },
  exit: (dir: number) => ({
    y: dir > 0 ? -40 : 40,
    opacity: 0,
    filter: 'blur(4px)',
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
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
  const [pageDir, setPageDir] = useState(0); // -1 up, +1 down
  const [sectionsByUser, setSectionsByUser] = useState<Record<string, Section[]>>({});
  const [loadingSections, setLoadingSections] = useState<Record<string, boolean>>({});
  const [reaction, setReaction] = useState<null | 'like' | 'nope'>(null);

  const current = cards[index];

  // Per-user sections (fetched once per user)
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

  // Build pages: hero, each section (card items expand), then interests page
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

  // Horizontal swipe values (applied to the whole page incl. image)
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

  // Paging helpers with direction
  const goPage = (next: number, dir: number) => {
    setPageDir(dir);
    setPageIndex(prev => Math.max(0, Math.min((pages.length || 1) - 1, next)));
  };
  const goNextPage = () => goPage(pageIndex + 1, +1);
  const goPrevPage = () => goPage(pageIndex - 1, -1);

  // Keyboard controls
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

  // Wheel paging (throttled)
  const wheelRef = useRef<number>(0);
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - (wheelRef.current || 0) < 250) return;
    if (Math.abs(e.deltaY) < 10) return;
    wheelRef.current = now;
    if (e.deltaY > 0) goNextPage();
    else goPrevPage();
  };

  // ---- Renderers ----
  const renderHero = (c: Candidate) => {
    const photo = bestPhoto(c);
    const nameAge = `${c.name || c.email.split('@')[0]}${c.profile?.age ? `, ${c.profile.age}` : ''}`;
    const inst = c.profile?.institution;
    return (
      <TwoColCard
        photoUrl={photo}
        right={
          <div className="space-y-3">
            <h2 className="text-2xl md:text-3xl font-semibold">{nameAge}</h2>
            {inst && <div className="text-neutral-300">{inst}</div>}
            {c.profile?.bio && <p className="text-neutral-300 leading-relaxed">{c.profile.bio}</p>}
          </div>
        }
      />
    );
  };

  const renderSection = (c: Candidate, s: Section, itemIndex?: number) => {
    if (s.type === 'text') {
      const text = (s.content as SectionContentText | undefined)?.body ?? '';
      return (
        <TwoColCard
          photoUrl={bestPhoto(c)}
          right={
            <div className="space-y-3">
              <h3 className="text-xl font-semibold">{s.title}</h3>
              <p className="text-neutral-300 whitespace-pre-wrap">{text}</p>
            </div>
          }
        />
      );
    }
    if (s.type === 'gallery') {
      const imgs: string[] = Array.isArray((s.content as SectionContentGallery | undefined)?.images)
        ? ((s.content as SectionContentGallery).images as string[])
        : [];
      const img = imgs[0] || bestPhoto(c);
      return (
        <TwoColCard
          photoUrl={img}
          right={
            <div className="space-y-3">
              <h3 className="text-xl font-semibold">{s.title}</h3>
              <div className="grid grid-cols-2 gap-2">
                {imgs.map((u, i) => (
                  <div key={i} className="relative w-full aspect-[4/3] overflow-hidden rounded-lg border border-neutral-800">
                    <Image src={u} alt="" fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover" />
                  </div>
                ))}
              </div>
            </div>
          }
        />
      );
    }
    if (s.type === 'card') {
      const items = Array.isArray((s.content as SectionContentCard | undefined)?.items)
        ? (s.content as SectionContentCard).items!
        : [];
      const it = typeof itemIndex === 'number' ? items[itemIndex] : items[0];
      const img = it?.image || bestPhoto(c);
      const text = it?.text || '';
      return (
        <TwoColCard
          photoUrl={img}
          right={
            <div className="space-y-3">
              <h3 className="text-xl font-semibold">{s.title}</h3>
              {text && <p className="text-neutral-300 whitespace-pre-wrap">{text}</p>}
            </div>
          }
        />
      );
    }
    return (
      <TwoColCard
        photoUrl={bestPhoto(c)}
        right={
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">{s.title}</h3>
            <p className="text-neutral-400 text-sm">Unsupported section type.</p>
          </div>
        }
      />
    );
  };

  const renderInterests = (c: Candidate) => {
    const interests = c.profile?.interests ?? [];
    return (
      // text-only final page per your spec (no image here)
      <div className="mx-auto h-full max-w-7xl">
        <div className="h-full rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900 p-6 text-neutral-100">
          <div className="space-y-4 max-w-3xl">
            {c.profile?.bio && (
              <>
                <h3 className="text-xl font-semibold">About</h3>
                <p className="text-neutral-300 whitespace-pre-wrap">{c.profile.bio}</p>
              </>
            )}
            <h3 className="text-xl font-semibold">Interests</h3>
            {interests.length ? (
              <div className="flex flex-wrap gap-2">
                {interests.map(i => (
                  <span key={i} className="px-3 py-1.5 rounded-full border border-neutral-700 bg-neutral-900 text-neutral-100">
                    {i}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-neutral-400">No interests added.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ---- Empty state ----
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
      {/* Page dots */}
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

      {/* Animated page container */}
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
            {/* Draggable layer wraps the entire page, so the IMAGE is draggable too */}
            <motion.div
              drag="x"
              style={{ x, rotate }}
              dragMomentum={false}
              onDragEnd={onDragEnd}
              dragElastic={0.2}
              className="h-full"
            >
              {/* Reaction overlay */}
              <AnimatePresence>
                {reaction && (
                  <motion.div
                    key={reaction}
                    initial={{ scale: 0.6, opacity: 0, y: 20 }}
                    animate={{ scale: 1.1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.8, opacity: 0, y: -10 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center z-20"
                  >
                    <div className={`text-7xl ${reaction === 'like' ? 'text-pink-500' : 'text-red-500'}`}>
                      {reaction === 'like' ? '💖' : '✖️'}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {content}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-3 text-center text-xs text-neutral-500">
        ← / → to pass/like • ↑ / ↓ to switch pages • Drag horizontally anywhere on the card
      </div>
    </div>
  );
}

// ---------- Two-column Card ----------
function TwoColCard({ photoUrl, right }: { photoUrl?: string; right: React.ReactNode }) {
  const src = photoUrl || 'https://picsum.photos/1200/1600';
  return (
    <div className="mx-auto h-full max-w-7xl">
      <div className="grid h-full grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
        {/* Image wider (8/12) */}
        <div className="md:col-span-8 h-full">
          <div className="h-full w-full rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900">
            <div className="relative h-full w-full md:aspect-[3/4]">
              <Image src={src} alt="" fill priority sizes="(max-width: 768px) 100vw, 60vw" className="object-cover" />
            </div>
          </div>
        </div>
        {/* Text (4/12) */}
        <div className="md:col-span-4 h-full">
          <div className="h-full w-full rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900 p-4 md:p-6 text-neutral-100">
            {right}
          </div>
        </div>
      </div>
    </div>
  );
}

function bestPhoto(c: Candidate): string | undefined {
  const p = [...(c.photos ?? [])].sort((a, b) => a.order - b.order)[0];
  return p?.url;
}
