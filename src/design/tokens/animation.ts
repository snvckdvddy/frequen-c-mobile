/**
 * Frequen-C Animation Tokens
 * ─────────────────────────────────────────────────────────────
 * Motion language based on hardware metaphor:
 * - Mechanical: crisp, immediate, no overshoot (button presses, toggles)
 * - Spring: organic, slight overshoot (sheet openings, element entrances)
 * - Signal: smooth flow, constant velocity (data traveling through signal chain)
 * - Emission: slow oscillation (glow pulses, idle animations)
 *
 * Implementation:
 *   Reanimated 3 — withSpring(value, springConfigs.sheet)
 *   Reanimated 3 — withTiming(value, { duration, easing })
 *   Animated API fallback — for non-Reanimated contexts
 */

// ─── Spring Configs (Reanimated withSpring) ──────────────────

export const springConfigs = {
  /**
   * MECHANICAL — Hardware button press. No bounce, crisp stop.
   * Use for: button press/release, toggle states, tab switches
   */
  mechanical: {
    stiffness: 400,
    damping: 30,
    mass: 0.8,
    overshootClamping: true,
  },

  /**
   * SHEET — Bottom sheet slide. Slight settle at end.
   * Use for: bottom sheets, modals, drawer open/close
   */
  sheet: {
    stiffness: 300,
    damping: 28,
    mass: 1,
    overshootClamping: false,
  },

  /**
   * ENTRANCE — Element appearing on screen. Gentle overshoot.
   * Use for: list items entering, cards appearing, staggered reveals
   */
  entrance: {
    stiffness: 200,
    damping: 20,
    mass: 0.8,
    overshootClamping: false,
  },

  /**
   * RUBBERY — Playful bounce. More overshoot.
   * Use for: reactions, emoji bursts, achievement unlocks
   */
  rubbery: {
    stiffness: 180,
    damping: 14,
    mass: 0.6,
    overshootClamping: false,
  },

  /**
   * HEAVY — Large/important elements. Deliberate, weighty.
   * Use for: album art transitions, full-screen overlays
   */
  heavy: {
    stiffness: 120,
    damping: 20,
    mass: 1.5,
    overshootClamping: false,
  },
} as const;

// ─── Timing Configs (Reanimated withTiming) ──────────────────

export const timingConfigs = {
  /**
   * INSTANT — near-instant state changes.
   * Use for: color changes, opacity toggles
   */
  instant: {
    duration: 100,
  },

  /**
   * FAST — quick transitions.
   * Use for: hover states, active feedback
   */
  fast: {
    duration: 150,
  },

  /**
   * NORMAL — standard transition speed.
   * Use for: page transitions, element movements
   */
  normal: {
    duration: 250,
  },

  /**
   * SLOW — deliberate, noticeable transitions.
   * Use for: modal appearance, important state changes
   */
  slow: {
    duration: 400,
  },

  /**
   * DRAMATIC — slow, cinematic.
   * Use for: first-time reveals, onboarding, duel animations
   */
  dramatic: {
    duration: 700,
  },
} as const;

// ─── Signal Flow Animation ──────────────────────────────────
// Used for the glowing pulse that travels along signal chain lines

export const signalFlow = {
  /** Duration for pulse to travel one segment */
  segmentDurationMs: 1200,
  /** Glow width of the traveling pulse */
  pulseWidth: 40, // px
  /** Colors for the traveling pulse */
  pulseColor: 'rgba(0, 229, 255, 0.6)',
  pulseTrail: 'rgba(0, 229, 255, 0.1)',
  /** Base line color (when no pulse is passing) */
  lineColor: 'rgba(0, 229, 255, 0.08)',
  lineWidth: 1,
} as const;

// ─── Emission / Glow Pulse ──────────────────────────────────
// Subtle brightness oscillation for accent elements at rest

export const emissionPulse = {
  /** Idle glow pulse — barely noticeable breathing */
  idle: {
    durationMs: 3000,
    minOpacity: 0.85,
    maxOpacity: 1.0,
  },
  /** Active glow pulse — more pronounced when element is in use */
  active: {
    durationMs: 1500,
    minOpacity: 0.7,
    maxOpacity: 1.0,
  },
  /** Alert pulse — urgent, fast */
  alert: {
    durationMs: 800,
    minOpacity: 0.5,
    maxOpacity: 1.0,
  },
} as const;

// ─── Stagger Delays ─────────────────────────────────────────
// For lists and groups entering the screen

export const stagger = {
  /** Delay between each item in a list */
  listItem: 50, // ms
  /** Delay between sections on a screen */
  section: 120, // ms
  /** Delay between rack modules */
  module: 80, // ms
  /** Max total stagger (cap to prevent long waits) */
  maxTotal: 600, // ms
} as const;

// ─── Gesture Thresholds ─────────────────────────────────────

export const gesture = {
  /** Minimum swipe velocity to trigger action (points/sec) */
  swipeVelocity: 500,
  /** Distance threshold for sheet snap points */
  sheetSnapThreshold: 0.3, // 30% of sheet height
  /** Resistance factor for over-scroll/over-drag */
  rubberBandFactor: 0.55,
} as const;

// ─── Particle System (Reactions) ─────────────────────────────

export const particles = {
  /** Number of particles per reaction */
  count: 8,
  /** Particle size range */
  minSize: 2,
  maxSize: 5,
  /** Velocity range (points/sec) */
  minVelocityY: -200,
  maxVelocityY: -400,
  velocityXSpread: 80,
  /** Lifetime before fade out */
  lifetimeMs: 1200,
  /** Gravity (points/sec²) */
  gravity: 50,
  /** Fade out starts at this fraction of lifetime */
  fadeStart: 0.6,
} as const;
