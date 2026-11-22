/**
 * useChatUnread: the chat badge count for one room.
 *
 * Counts messages from other users that were not seen in the chat panel.
 * While the panel is open everything in the log is being read, so the log is
 * marked seen on every change and the count stays 0; closing it needs no
 * snapshot. The counting rules and why they are id-based live in
 * utils/chatUnread.ts.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ChatMessage } from '../types';
import {
  chatSeenKey,
  countUnreadChat,
  getChatSeen,
  recordChatSeen,
  subscribeChatSeen,
} from '../utils/chatUnread';

interface UseChatUnreadArgs {
  /** Room whose log this is. Seen state is remembered per user and room. */
  sessionId: string | null | undefined;
  /** The signed-in user. Their own messages never count. */
  selfUserId: string | null | undefined;
  /** useSessionRoom's always-on transcript (history replay plus live messages). */
  chatLog: readonly ChatMessage[];
  /** True while the chat panel is showing. */
  chatOpen: boolean;
}

export function useChatUnread({
  sessionId,
  selfUserId,
  chatLog,
  chatOpen,
}: UseChatUnreadArgs): number {
  const key = chatSeenKey(selfUserId, sessionId);
  const getSnapshot = () => getChatSeen(key);
  const seen = useSyncExternalStore(subscribeChatSeen, getSnapshot, getSnapshot);

  useEffect(() => {
    if (chatOpen && key) recordChatSeen(key, chatLog, selfUserId);
  }, [chatOpen, key, chatLog, selfUserId]);

  return useMemo(
    () => (chatOpen ? 0 : countUnreadChat(chatLog, seen, selfUserId)),
    [chatOpen, chatLog, seen, selfUserId],
  );
}
