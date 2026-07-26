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

import { useEffect, useRef } from 'react';
import { listenHeartbeat, onSessionEvent } from '../services/socket';
import { notifyParticipantJoined } from '../services/notifications';
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
  // Reconnects and app-foregrounds re-emit join-session; without a
  // dedupe window every phone unlock at a party broadcast a fresh
  // "X joined" toast + push to the whole room.
  const recentJoinToastRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const unsubs = [
      onSessionEvent('participant-joined', (participant: Listener) => {
        const last = recentJoinToastRef.current.get(participant.userId) || 0;
        if (Date.now() - last < 60_000) return;
        recentJoinToastRef.current.set(participant.userId, Date.now());

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
  }, [sessionId, setListeners, setToasts]);

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
