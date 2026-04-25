import { handshakeBus, HandshakeSource } from '../handshakeBus';

describe('handshakeBus', () => {
  beforeEach(() => {
    handshakeBus.__resetForTests();
  });

  it('fires registered listeners with the source', () => {
    const received: HandshakeSource[] = [];
    handshakeBus.subscribe((s) => received.push(s));

    handshakeBus.fire('spotify');
    handshakeBus.fire('tidal');

    expect(received).toEqual(['spotify', 'tidal']);
  });

  it('fan-outs to multiple listeners', () => {
    const a: HandshakeSource[] = [];
    const b: HandshakeSource[] = [];
    handshakeBus.subscribe((s) => a.push(s));
    handshakeBus.subscribe((s) => b.push(s));

    handshakeBus.fire('appleMusic');

    expect(a).toEqual(['appleMusic']);
    expect(b).toEqual(['appleMusic']);
  });

  it('unsubscribe stops the listener from receiving further events', () => {
    const received: HandshakeSource[] = [];
    const unsubscribe = handshakeBus.subscribe((s) => received.push(s));

    handshakeBus.fire('spotify');
    unsubscribe();
    handshakeBus.fire('tidal');

    expect(received).toEqual(['spotify']);
  });

  it('fire is a no-op when no listeners are registered', () => {
    // Just shouldn't throw
    expect(() => handshakeBus.fire('soundcloud')).not.toThrow();
  });

  it('a listener that throws does not block sibling listeners', () => {
    const consoleErr = jest.spyOn(console, 'error').mockImplementation(() => {});
    const sibling: HandshakeSource[] = [];

    handshakeBus.subscribe(() => {
      throw new Error('boom');
    });
    handshakeBus.subscribe((s) => sibling.push(s));

    handshakeBus.fire('lastfm');

    expect(sibling).toEqual(['lastfm']);
    expect(consoleErr).toHaveBeenCalled();

    consoleErr.mockRestore();
  });

  it('a listener that unsubscribes itself mid-fire does not skip siblings', () => {
    const order: string[] = [];
    let unsubA: (() => void) | null = null;

    unsubA = handshakeBus.subscribe(() => {
      order.push('A');
      unsubA?.(); // unsubscribe self mid-iteration
    });
    handshakeBus.subscribe(() => {
      order.push('B');
    });

    handshakeBus.fire('tidal');

    expect(order).toEqual(['A', 'B']);
  });
});
