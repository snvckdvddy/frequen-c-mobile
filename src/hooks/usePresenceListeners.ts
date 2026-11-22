/**
 * usePresenceListeners — listen heartbeat + participant join/leave
 * ─────────────────────────────────────────────────────────────
 * Extracted from SessionRoomScreen to isolate the presence domain:
 *   • CV heartbeat (1 CV per minute of active listening)
 *   • Participant join/leave socket events → listener list + toasts
 *   • Mock joiner (dev only, guarded by USE_MOCKS)
 *
 * Pure side-effect hook — returns nothing.
 */

import { useEffect, useRef, useState } from 'react';
import { listenHeartbeat, onSessionEvent } from '../services/socket';
import { notifyParticipantJoined } from '../services/notifications';
import { JoinAnnouncer } from '../services/joinAnnouncer';
import { USE_MOCKS } from '../services/config';
import type { Listener, Session } from '../types';
import type { ToastMessage } from '../components/ListenerPresence';

interface PresenceListenerParams {
  sessionId: string;
  userId: string | undefined;
  session: Session | null;
  setListeners: React.Dispatch<React.SetStateAction<Listener[]>>;
  setToasts: React.Dispatch<React.SetStateAction<ToastMessage[]>>;
}

export function usePresenceListeners({
  sessionId,
  userId,
  session,
  setListeners,
  setToasts,
}: PresenceListenerParams): void {

  // ─── CV heartbeat (1 CV per minute of active listening) ──
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => {
      listenHeartbeat(sessionId);
    }, 60_000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // ─── Participant join/leave socket events ────────────────
  // Toasts + push notifications ONLY — the roster itself is owned by
  // useSessionRoom's subscriptions (single writer; the duplicate
  // setListeners here caused silent divergence risk, 2026-07-25 audit).
  // Refs keep the handlers current without rebinding: the old
  // empty-deps closure captured session === null at mount, which is
  // why the join push notification never fired in practice.
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const sessionNameRef = useRef(session?.name);
  sessionNameRef.current = session?.name;
  // A reconnect is not an arrival. Locking a phone drops its socket, so the
  // server sends participant-left and then participant-joined on unlock. The
  // old 60 s per-user toast timer let every unlock after the first minute
  // through. The announcer stays quiet for anyone we saw join or leave within
  // REJOIN_QUIET_MS, so only a genuinely new (or long-gone) guest is news.
  const [joinAnnouncer] = useState(() => new JoinAnnouncer());

  useEffect(() => {
    // Keyed by room too, so a guest seen in one room never mutes another.
    const presenceKey = (id: string) => `${sessionId}:${id}`;
    const unsubs = [
      onSessionEvent('participant-joined', (participant: Listener) => {
        if (!joinAnnouncer.onJoined(presenceKey(participant.userId), Date.now())) return;

        const toast: ToastMessage = {
          id: `join_${participant.userId}_${Date.now()}`,
          text: `${participant.username} joined`,
          type: 'join',
        };
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, 3000);
        if (participant.userId !== userIdRef.current && sessionNameRef.current) {
          notifyParticipantJoined(participant.username, sessionNameRef.current, sessionId).catch(() => { });
        }
      }),
      onSessionEvent('participant-left', (data: { userId: string }) => {
        // Our own departure only reaches us from a stale socket timing out
        // after a reconnect; we are still here, so no "left" toast.
        if (data.userId === userIdRef.current) return;
        joinAnnouncer.onLeft(presenceKey(data.userId), Date.now());
        setListeners((prev) => {
          const leaving = prev.find((l) => l.userId === data.userId);
          if (leaving) {
            const toast: ToastMessage = {
              id: `leave_${data.userId}_${Date.now()}`,
              text: `${leaving.username} left`,
              type: 'leave',
            };
            setToasts((p) => [...p, toast]);
            setTimeout(() => {
              setToasts((p) => p.filter((t) => t.id !== toast.id));
            }, 3000);
          }
          // Roster write stays in useSessionRoom; return prev untouched.
          return prev;
        });
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [sessionId, setListeners, setToasts, joinAnnouncer]);

  // ─── Mock: simulate someone joining after 5s (mock mode only) ──
  useEffect(() => {
    if (!session) return;
    if (!USE_MOCKS) return;
    const timer = setTimeout(() => {
      const mockJoiner: Listener = {
        userId: 'usr_sim_' + Date.now(),
        username: ['zara', 'finn', 'rio', 'ivy', 'sage'][Math.floor(Math.random() * 5)],
      };
      setListeners((prev) => {
        if (prev.some((l) => l.username === mockJoiner.username)) return prev;
        return [...prev, mockJoiner];
      });
      const toast: ToastMessage = {
        id: `join_${mockJoiner.userId}`,
        text: `${mockJoiner.username} joined`,
        type: 'join',
      };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => setToasts((p) => p.filter((t) => t.id !== toast.id)), 3000);
    }, 5000);
    return () => clearTimeout(timer);
  }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}
