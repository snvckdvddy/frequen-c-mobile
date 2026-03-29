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

import { useEffect } from 'react';
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
  // Empty deps is intentional — captures userId and session via closure
  // at mount time, matching the original SessionRoomScreen pattern.
  useEffect(() => {
    const unsubs = [
      onSessionEvent('participant-joined', (participant: Listener) => {
        setListeners((prev) => {
          if (prev.some((l) => l.userId === participant.userId)) return prev;
          return [...prev, participant];
        });
        const toast: ToastMessage = {
          id: `join_${participant.userId}_${Date.now()}`,
          text: `${participant.username} joined`,
          type: 'join',
        };
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, 3000);
        if (participant.userId !== userId && session?.name) {
          notifyParticipantJoined(participant.username, session.name, sessionId).catch(() => { });
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
          return prev.filter((l) => l.userId !== data.userId);
        });
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
