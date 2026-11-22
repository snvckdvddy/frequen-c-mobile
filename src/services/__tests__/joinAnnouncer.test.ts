/**
 * Join announcer tests: which participant-joined events the host hears about.
 *
 * The rule under test: a join is news only when nothing has been seen for that
 * id in the last REJOIN_QUIET_MS. Every join or leave restarts that clock, so
 * a locked-and-unlocked phone (server sends participant-left, then
 * participant-joined) stays quiet, while a first arrival, or someone who has
 * been gone longer than the window, is announced. The clock is passed in, so
 * no timers are involved.
 */

import { JoinAnnouncer, REJOIN_QUIET_MS } from '../joinAnnouncer';

const SEC = 1000;
const MIN = 60 * SEC;

// An arbitrary fixed start; only the gaps between events matter.
const T0 = Date.UTC(2026, 10, 11, 20, 0, 0);

describe('JoinAnnouncer', () => {
  it('announces the first time a user is seen', () => {
    const announcer = new JoinAnnouncer();
    expect(announcer.onJoined('room1:zara', T0)).toBe(true);
  });

  it('stays quiet for a repeat join with no leave in between (double join-session)', () => {
    const announcer = new JoinAnnouncer();
    announcer.onJoined('room1:zara', T0);
    expect(announcer.onJoined('room1:zara', T0 + 2 * SEC)).toBe(false);
    expect(announcer.onJoined('room1:zara', T0 + 30 * SEC)).toBe(false);
  });

  it('stays quiet when a guest locks and unlocks past the old 60 s timer', () => {
    const announcer = new JoinAnnouncer();
    expect(announcer.onJoined('room1:zara', T0)).toBe(true);

    // Phone locks at 3 min; the server drops the socket ~45 s later and
    // broadcasts participant-left. Unlock reconnects 2 min after that.
    announcer.onLeft('room1:zara', T0 + 3 * MIN + 45 * SEC);
    expect(announcer.onJoined('room1:zara', T0 + 5 * MIN + 45 * SEC)).toBe(false);
  });

  it('stays quiet across many lock and unlock cycles', () => {
    const announcer = new JoinAnnouncer();
    announcer.onJoined('room1:zara', T0);

    // Ten cycles, each leave and rejoin pair 4 min apart. Every event restarts
    // the clock, so the total span (well over the window) does not matter.
    let t = T0;
    for (let cycle = 0; cycle < 10; cycle++) {
      t += 4 * MIN;
      announcer.onLeft('room1:zara', t);
      t += 4 * MIN;
      expect(announcer.onJoined('room1:zara', t)).toBe(false);
    }
    expect(t - T0).toBeGreaterThan(REJOIN_QUIET_MS);
  });

  it('announces a guest who has been gone longer than the window', () => {
    const announcer = new JoinAnnouncer();
    announcer.onJoined('room1:zara', T0);
    announcer.onLeft('room1:zara', T0 + 5 * MIN);

    expect(announcer.onJoined('room1:zara', T0 + 5 * MIN + REJOIN_QUIET_MS)).toBe(true);
  });

  it('draws the line exactly at the window', () => {
    // One millisecond short of the window: still the same visit.
    const justInside = new JoinAnnouncer();
    justInside.onLeft('room1:zara', T0);
    expect(justInside.onJoined('room1:zara', T0 + REJOIN_QUIET_MS - 1)).toBe(false);

    // At the window: a new arrival.
    const atEdge = new JoinAnnouncer();
    atEdge.onLeft('room1:zara', T0);
    expect(atEdge.onJoined('room1:zara', T0 + REJOIN_QUIET_MS)).toBe(true);
  });

  it('announces again after a long silence even if the leave was never seen', () => {
    const announcer = new JoinAnnouncer();
    announcer.onJoined('room1:zara', T0);

    // The host missed the leave (its own socket was down). Nothing since the
    // original join for longer than the window, so this is a fresh arrival.
    expect(announcer.onJoined('room1:zara', T0 + 45 * MIN)).toBe(true);
  });

  it('treats a leave seen first as a recent visit', () => {
    const announcer = new JoinAnnouncer();
    // Host opens the room after the guest is already in it, so the first event
    // it sees for them is the drop from a lock.
    announcer.onLeft('room1:zara', T0);
    expect(announcer.onJoined('room1:zara', T0 + 90 * SEC)).toBe(false);
  });

  it('tracks each user independently', () => {
    const announcer = new JoinAnnouncer();
    announcer.onJoined('room1:zara', T0);
    announcer.onLeft('room1:zara', T0 + MIN);

    expect(announcer.onJoined('room1:finn', T0 + 2 * MIN)).toBe(true);
    expect(announcer.onJoined('room1:zara', T0 + 2 * MIN)).toBe(false);
  });

  it('keeps rooms apart when ids are namespaced by room', () => {
    const announcer = new JoinAnnouncer();
    announcer.onJoined('room1:zara', T0);

    expect(announcer.onJoined('room2:zara', T0 + SEC)).toBe(true);
  });

  it('honors a custom window', () => {
    const inside = new JoinAnnouncer(30 * SEC);
    inside.onLeft('room1:zara', T0);
    expect(inside.onJoined('room1:zara', T0 + 29 * SEC)).toBe(false);

    const outside = new JoinAnnouncer(30 * SEC);
    outside.onLeft('room1:zara', T0);
    expect(outside.onJoined('room1:zara', T0 + 30 * SEC)).toBe(true);
  });

  it('defaults to a window longer than a lock cycle', () => {
    // The server closes a frozen app's socket within about a minute, and the
    // old per-user timer was 60 s, so the default has to be well past both.
    expect(REJOIN_QUIET_MS).toBeGreaterThanOrEqual(5 * MIN);
  });
});
