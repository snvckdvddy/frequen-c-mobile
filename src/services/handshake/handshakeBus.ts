/**
 * Hardware Handshake — pub/sub bus
 *
 * Decouples auth flows (which know "a connection just succeeded") from the
 * UI overlay (which renders the animation). AuthContext fires `handshakeBus.fire`
 * imperatively at the success leg of each connect handler. The
 * `HardwareHandshakeProvider` mounted at the app root subscribes once and
 * dispatches each fire event to the underlying animated component.
 *
 * Why a module-level pub/sub instead of React context:
 *   - AuthContext is mounted higher than HardwareHandshakeProvider in App.tsx;
 *     a context-based handle would invert the dependency.
 *   - Fire-and-forget animation has no need for React state plumbing — a
 *     simple listener registry is the lighter-weight, more testable option.
 *   - Easy to test in isolation without rendering React.
 *
 * Sources are typed strictly so callers can't fire for unknown providers.
 */

export type HandshakeSource =
  | 'spotify'
  | 'soundcloud'
  | 'tidal'
  | 'appleMusic'
  | 'lastfm';

type Listener = (source: HandshakeSource) => void;

let listeners: Listener[] = [];

export const handshakeBus = {
  /**
   * Notify all subscribers that a provider just successfully connected.
   * Safe to call before any subscribers are registered (no-op).
   */
  fire(source: HandshakeSource): void {
    // Snapshot the listeners at fire time so a listener removing itself
    // mid-iteration doesn't skip a sibling.
    const snapshot = listeners.slice();
    for (const listener of snapshot) {
      try {
        listener(source);
      } catch (err) {
        // A failing listener should never break sibling listeners or the caller.
        console.error('[handshakeBus] listener threw:', err);
      }
    }
  },

  /**
   * Subscribe a listener. Returns an unsubscribe function. Safe to call
   * subscribe()() with no side effects.
   */
  subscribe(listener: Listener): () => void {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },

  /**
   * Test-only: clear all listeners. Don't call from production code.
   */
  __resetForTests(): void {
    listeners = [];
  },
};
