/**
 * Chat unread counting tests.
 *
 * The scenarios follow the two device reports: a badge that disagreed with
 * what had arrived (and climbed after the chat was read), and a user's own
 * messages counting as unread after rejoining a room.
 *
 * createRoom() mirrors how useSessionRoom builds the log (live append, the
 * server's last 50 replacing it on join and reconnect, emptied on leave) and
 * how useChatUnread reads it, so each test reads as a sequence of events.
 */

import type { ChatMessage } from '../../types';
import {
  MAX_CARRIED_SEEN,
  MAX_TRACKED_ROOMS,
  chatSeenKey,
  countUnreadChat,
  getChatSeen,
  isOtherUsersMessage,
  markChatSeen,
  recordChatSeen,
  subscribeChatSeen,
} from '../chatUnread';

const ME = 'user_me';
const ALICE = 'user_alice';
const BOB = 'user_bob';
const HISTORY_LIMIT = 50; // socketHandler.ts room-state: LIMIT 50

let counter = 0;
function line(userId: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  counter += 1;
  return {
    id: `msg_${counter}`,
    sessionId: 'room_1',
    userId,
    username: userId,
    text: `text ${counter}`,
    type: 'message',
    timestamp: new Date(Date.UTC(2026, 6, 25, 12, 0, counter)).toISOString(),
    ...overrides,
  };
}

function lines(userId: string, count: number): ChatMessage[] {
  return Array.from({ length: count }, () => line(userId));
}

function createRoom(selfUserId: string) {
  const server: ChatMessage[] = []; // everything ever said, as persisted
  let log: ChatMessage[] = []; // what useSessionRoom exposes as chatLog
  let seen: ReadonlySet<string> = new Set();
  return {
    /** Said in the room and delivered live (chat-message event). */
    say(msg: ChatMessage) {
      server.push(msg);
      if (!log.some((m) => m.id === msg.id)) log = [...log, msg];
    },
    /** Said while this client had no connection: persisted, not delivered. */
    sayWhileAway(msg: ChatMessage) {
      server.push(msg);
    },
    /** join-session or reconnect: room-state replaces the log with the last 50. */
    join() {
      log = server.slice(-HISTORY_LIMIT);
    },
    /** Leaving the room empties the log. */
    leave() {
      log = [];
    },
    /** The chat panel is open, so everything in the log is being read. */
    read() {
      seen = markChatSeen(seen, log, selfUserId);
    },
    /** App restart: nothing is remembered. */
    forgetSeen() {
      seen = new Set();
    },
    unread() {
      return countUnreadChat(log, seen, selfUserId);
    },
  };
}

function roomKey(selfUserId: string = ME): string {
  counter += 1;
  const key = chatSeenKey(selfUserId, `room_${counter}`);
  if (!key) throw new Error('test setup: expected a store key');
  return key;
}

describe('isOtherUsersMessage', () => {
  it('accepts a message from another user', () => {
    expect(isOtherUsersMessage(line(ALICE), ME)).toBe(true);
  });

  it('rejects the user\'s own message', () => {
    expect(isOtherUsersMessage(line(ME), ME)).toBe(false);
  });

  it('rejects system lines', () => {
    expect(isOtherUsersMessage(line('system', { type: 'system' }), ME)).toBe(false);
  });

  it('accepts a reaction line from another user', () => {
    expect(isOtherUsersMessage(line(ALICE, { type: 'reaction' }), ME)).toBe(true);
  });

  it('rejects everything while the user id is unknown', () => {
    expect(isOtherUsersMessage(line(ALICE), undefined)).toBe(false);
    expect(isOtherUsersMessage(line(ALICE), null)).toBe(false);
    expect(isOtherUsersMessage(line(ALICE), '')).toBe(false);
  });

  it('rejects a line with no id, since it cannot be tracked', () => {
    expect(isOtherUsersMessage(line(ALICE, { id: '' }), ME)).toBe(false);
  });
});

describe('countUnreadChat', () => {
  it('is 0 for an empty log', () => {
    expect(countUnreadChat([], new Set(), ME)).toBe(0);
  });

  it('counts only lines from other users', () => {
    const log = [line(ALICE), line(ME), line(BOB), line(ME), line('system', { type: 'system' })];
    expect(countUnreadChat(log, new Set(), ME)).toBe(2);
  });

  it('skips lines whose id is already seen', () => {
    const [a, b, c] = lines(ALICE, 3);
    expect(countUnreadChat([a, b, c], new Set([a.id, c.id]), ME)).toBe(1);
  });

  it('counts a line delivered twice once', () => {
    const a = line(ALICE);
    expect(countUnreadChat([a, a], new Set(), ME)).toBe(1);
  });

  it('ignores seen ids that are no longer in the log', () => {
    const a = line(ALICE);
    expect(countUnreadChat([a], new Set(['msg_gone']), ME)).toBe(1);
  });

  it('is 0 while the user id is unknown', () => {
    expect(countUnreadChat([line(ALICE)], new Set(), undefined)).toBe(0);
  });
});

describe('markChatSeen', () => {
  it('marks other users\' lines and leaves the user\'s own out', () => {
    const [a, b] = lines(ALICE, 2);
    const mine = line(ME);
    const seen = markChatSeen(new Set(), [a, mine, b], ME);
    expect(seen.has(a.id)).toBe(true);
    expect(seen.has(b.id)).toBe(true);
    expect(seen.has(mine.id)).toBe(false);
  });

  it('does not change the input set', () => {
    const input: ReadonlySet<string> = new Set();
    markChatSeen(input, [line(ALICE)], ME);
    expect(input.size).toBe(0);
  });

  it('returns the same instance when nothing is new', () => {
    const log = [line(ALICE), line(ME)];
    const once = markChatSeen(new Set(), log, ME);
    expect(markChatSeen(once, log, ME)).toBe(once);
  });

  it('never forgets a line that is still in the log, however long the log grows', () => {
    const log = lines(ALICE, MAX_CARRIED_SEEN + HISTORY_LIMIT);
    const seen = markChatSeen(new Set(), log, ME);
    expect(countUnreadChat(log, seen, ME)).toBe(0);
  });

  it('carries only the newest ids that have left the log', () => {
    const old = lines(ALICE, MAX_CARRIED_SEEN + 50);
    const seenOld = markChatSeen(new Set(), old, ME);
    const fresh = line(ALICE);
    const seen = markChatSeen(seenOld, [fresh], ME);

    expect(seen.size).toBe(MAX_CARRIED_SEEN + 1);
    expect(seen.has(fresh.id)).toBe(true);
    expect(seen.has(old[old.length - 1].id)).toBe(true);
    expect(seen.has(old[0].id)).toBe(false);
  });
});

describe('badge scenarios from the device reports', () => {
  it('shows every message that arrived, then clears when the chat is read', () => {
    const room = createRoom(ME);
    room.join();
    room.say(line(ALICE));
    room.say(line(ALICE));
    expect(room.unread()).toBe(2);

    room.read();
    expect(room.unread()).toBe(0);
  });

  it('does not climb back up after the chat was read', () => {
    const room = createRoom(ME);
    room.join();
    room.say(line(ALICE));
    room.say(line(ALICE));
    room.read();

    room.join(); // a reconnect replays the same messages
    expect(room.unread()).toBe(0);
  });

  it('keeps messages that arrive while the chat is open from returning as unread on close', () => {
    const room = createRoom(ME);
    room.join();
    room.read(); // chat opens on an empty room
    room.say(line(ALICE));
    room.read(); // the open panel marks each change
    room.say(line(BOB));
    room.read();

    // The chat closes here. The old swipe-down close used a snapshot taken
    // at open time and left both of these counted.
    expect(room.unread()).toBe(0);
  });

  it('counts messages that arrive after the chat was read', () => {
    const room = createRoom(ME);
    room.join();
    room.say(line(ALICE));
    room.read();

    room.say(line(BOB));
    expect(room.unread()).toBe(1);
    room.say(line(ALICE));
    expect(room.unread()).toBe(2);
  });

  it('does not hide new messages when a replay shortens the log', () => {
    // A room past 50 messages: the log is the 50 replayed plus 3 live (53),
    // all read. A reconnect replays only the last 50, so the log shrinks.
    // The old length diff compared 50 against a snapshot of 53 and showed 0,
    // then 1, for messages that were new.
    const room = createRoom(ME);
    lines(ALICE, HISTORY_LIMIT).forEach((m) => room.sayWhileAway(m));
    room.join();
    lines(ALICE, 3).forEach((m) => room.say(m));
    room.read();
    expect(room.unread()).toBe(0);

    room.join();
    room.say(line(BOB));
    room.say(line(BOB));
    expect(room.unread()).toBe(2);
  });

  it('counts a message that was missed live and only shows up in the replay', () => {
    const room = createRoom(ME);
    room.join();
    room.say(line(ALICE));
    room.read();

    room.sayWhileAway(line(ALICE)); // connection dropped for this one
    room.join(); // reconnect replays it
    expect(room.unread()).toBe(1);
  });

  it('never counts the user\'s own messages, including the echo of one just sent', () => {
    const room = createRoom(ME);
    room.join();
    room.say(line(ME));
    room.say(line(ME));
    expect(room.unread()).toBe(0);

    room.join();
    expect(room.unread()).toBe(0);
  });

  it('does not count own or already-read messages after leaving and rejoining', () => {
    const room = createRoom(ME);
    room.join();
    room.say(line(ME));
    room.say(line(ME));
    room.say(line(ALICE));
    room.say(line(ME));
    room.read();

    room.leave();
    room.join(); // rejoin replays all four from history
    expect(room.unread()).toBe(0);
  });

  it('counts only other users\' lines when nothing is remembered', () => {
    const room = createRoom(ME);
    room.join();
    room.say(line(ME));
    room.say(line(ME));
    room.say(line(ALICE));
    room.say(line(ME));

    room.forgetSeen();
    room.leave();
    room.join();
    expect(room.unread()).toBe(1);
  });

  it('counts what other users said while the user was away', () => {
    const room = createRoom(ME);
    room.join();
    room.say(line(ALICE));
    room.read();

    room.leave();
    room.sayWhileAway(line(BOB));
    room.sayWhileAway(line(ME));
    room.join();
    expect(room.unread()).toBe(1);
  });

  it('counts other users\' unseen history on a first join, but not the user\'s own', () => {
    const room = createRoom(ME);
    room.sayWhileAway(line(ALICE));
    room.sayWhileAway(line(ME));
    room.sayWhileAway(line(BOB));
    room.sayWhileAway(line(ME));

    room.join();
    expect(room.unread()).toBe(2);
  });

  it('never counts system lines', () => {
    const room = createRoom(ME);
    room.join();
    room.say(line('system', { type: 'system', text: 'Alice joined' }));
    expect(room.unread()).toBe(0);
  });
});

describe('seen store', () => {
  it('builds a key per user and room, and none when either is missing', () => {
    expect(chatSeenKey(ME, 'room_a')).not.toBe(chatSeenKey(ME, 'room_b'));
    expect(chatSeenKey(ME, 'room_a')).not.toBe(chatSeenKey(ALICE, 'room_a'));
    expect(chatSeenKey(undefined, 'room_a')).toBeNull();
    expect(chatSeenKey(ME, undefined)).toBeNull();
    expect(chatSeenKey('', 'room_a')).toBeNull();
  });

  it('returns one stable empty set for an unknown or missing key', () => {
    expect(getChatSeen(null)).toBe(getChatSeen(null));
    expect(getChatSeen(roomKey()).size).toBe(0);
  });

  it('remembers what was seen, so a remounted screen starts from it', () => {
    const key = roomKey();
    const log = [line(ALICE), line(BOB), line(ME)];
    recordChatSeen(key, log, ME);

    // A new SessionRoomScreen instance reads the store, not component state.
    expect(countUnreadChat(log, getChatSeen(key), ME)).toBe(0);
    const later = [...log, line(ALICE)];
    expect(countUnreadChat(later, getChatSeen(key), ME)).toBe(1);
  });

  it('keeps users and rooms apart', () => {
    const log = [line(ALICE)];
    const mine = roomKey(ME);
    const theirs = roomKey(BOB);
    recordChatSeen(mine, log, ME);

    expect(getChatSeen(mine).size).toBe(1);
    expect(getChatSeen(theirs).size).toBe(0);
  });

  it('notifies subscribers on a change, not when nothing is new, and not after unsubscribe', () => {
    const key = roomKey();
    const log = [line(ALICE)];
    const listener = jest.fn();
    const unsubscribe = subscribeChatSeen(listener);

    recordChatSeen(key, log, ME);
    expect(listener).toHaveBeenCalledTimes(1);

    recordChatSeen(key, log, ME);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    recordChatSeen(key, [...log, line(BOB)], ME);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps the same set instance while nothing changes', () => {
    const key = roomKey();
    const log = [line(ALICE)];
    recordChatSeen(key, log, ME);
    const first = getChatSeen(key);
    recordChatSeen(key, log, ME);
    expect(getChatSeen(key)).toBe(first);
  });

  it('drops the least recently updated room past the cap', () => {
    // Push every earlier test's room out so the cap is the only variable.
    for (let i = 0; i < MAX_TRACKED_ROOMS; i++) {
      recordChatSeen(roomKey(), [line(ALICE)], ME);
    }

    const keys = Array.from({ length: MAX_TRACKED_ROOMS }, () => roomKey());
    keys.forEach((key) => recordChatSeen(key, [line(ALICE)], ME));
    expect(getChatSeen(keys[0]).size).toBe(1);

    // Updating the oldest room makes the next one the oldest.
    recordChatSeen(keys[0], [line(ALICE)], ME);
    const newest = roomKey();
    recordChatSeen(newest, [line(ALICE)], ME);

    expect(getChatSeen(keys[1]).size).toBe(0);
    expect(getChatSeen(keys[0]).size).toBe(2); // the first line carried plus the new one
    expect(getChatSeen(newest).size).toBe(1);
  });
});
