//Chat page

'use client';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { tokenAtom, userAtom } from '@/state/auth';
import { api } from '@/lib/api';
import { io, Socket } from 'socket.io-client';

type Msg = { id: string; content: string; createdAt: string; senderId: string };
type Match = {
  id: string;
  userAId: string; userBId: string;
  counterpart?: { id: string; name?: string | null; email: string; photos: { url: string; order: number }[] };
};
type Me = { id: string; email: string; name?: string | null; photos?: { url: string; order: number }[] };

export default function ChatPage() {
  const { id: matchId } = useParams<{ id: string }>();
  const [token] = useAtom(tokenAtom);
  const [meBasic] = useAtom(userAtom);

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [match, setMatch] = useState<Match | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const sockRef = useRef<Socket | null>(null);

  const myId = meBasic?.id;
  const myAvatar = me?.photos?.[0]?.url;
  const cpAvatar = match?.counterpart?.photos?.[0]?.url;
  const avatarFallback = 'https://picsum.photos/80';

  // initial load
  useEffect(() => {
    if (!token || !matchId) return;
    (async () => {
      const [list, ms, meData] = await Promise.all([
        api<Msg[]>(`/matches/${matchId}/messages`, { token }),
        api<Match[]>(`/matches`, { token }),
        api<Me>(`/users/me`, { token })
      ]);
      setMsgs(list);
      setMatch(ms.find(m => m.id === matchId) || null);
      setMe({ ...meData, photos: meData?.photos ?? [] });
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
    })();
  }, [token, matchId]);

  // realtime: connect socket, join room
  useEffect(() => {
    if (!token || !matchId) return;
    const s = io(process.env.NEXT_PUBLIC_API_URL!, {
      transports: ['websocket'],
      auth: { token }
    });
    sockRef.current = s;

    s.on('connect_error', (err) => console.error('socket error', err.message));
    s.emit('room:join', String(matchId));
    s.on('message:new', (m: Msg) => {
      setMsgs(prev => prev.concat(m));
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
    });

    return () => {
      s.emit('room:leave', String(matchId));
      s.disconnect();
      sockRef.current = null;
    };
  }, [token, matchId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !token || !matchId) return;
    const m = await api<Msg>(`/matches/${matchId}/messages`, {
      token,
      method: 'POST',
      body: JSON.stringify({ content: text.trim() })
    });
    // optimistic update is optional since server will echo via socket
    setMsgs(prev => prev.concat(m));
    setText('');
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
  };

  // Helper: show avatar only on the last message of a consecutive block
  const shouldShowAvatar = (i: number) => {
    const cur = msgs[i];
    const next = msgs[i + 1];
    return !next || next.senderId !== cur.senderId;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] border border-gray-800 rounded bg-black">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {msgs.map((m, i) => {
          const isMe = m.senderId === myId;
          const showAvatar = shouldShowAvatar(i);
          return (
            <div key={m.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {/* left avatar or spacer */}
              {!isMe && (showAvatar
                ? <img src={cpAvatar || avatarFallback} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-700" />
                : <div className="w-8 h-8" />
              )}

              {/* bubble */}
              <div className="max-w-[70%] rounded-2xl bg-gray-800 text-white px-3 py-2">
                <div className="whitespace-pre-wrap leading-snug">{m.content}</div>
                <div className="text-[10px] text-gray-400 mt-1">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* right avatar or spacer */}
              {isMe && (showAvatar
                ? <img src={myAvatar || avatarFallback} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-700" />
                : <div className="w-8 h-8" />
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form onSubmit={send} className="p-3 flex gap-2 border-t border-gray-800 bg-black">
        <input
          className="flex-1 border border-gray-700 bg-black text-gray-100 rounded px-3 py-2 placeholder:text-gray-500 focus:outline-none focus:border-gray-500"
          placeholder="Type a message…"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <button className="px-4 py-2 rounded bg-white text-black hover:bg-gray-200">
          Send
        </button>
      </form>
    </div>
  );
}
