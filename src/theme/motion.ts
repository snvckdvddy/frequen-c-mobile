/**
 * Motion — Shared animation constants for Frequen-C.
 *
 * Convergence Strategy §7: Animation & Motion.
 * All spring configs, durations, and easing curves in one place.
 * Components import from here instead of defining inline values.
 */

import { Easing } from 'react-native';

// ─── Spring Configs (tension / friction) ────────────────────

/** §7: Mini → Full player appear — 350ms, damping 0.8 */
export const SPRING_SHEET_APPEAR = { tension: 65, friction: 11 } as const;

/** §7: Bottom sheet appear — 350ms, damping 0.75 */
export const SPRING_BOTTOM_SHEET = { tension: 65, friction: 10 } as const;

/** §7: Drag recovery snap-back */
export const SPRING_SNAP_BACK = { tension: 80, friction: 10 } as const;

/** §7: Queue reorder — 200ms spring snap */
export const SPRING_REORDER = { tension: 120, friction: 14 } as const;

// ─── Durations (ms) ─────────────────────────────────────────

export const DURATION = {
  /** Full → Mini player collapse */
  playerCollapse: 300,
  /** Bottom sheet dismiss */
  sheetDismiss: 250,
  /** Tab switch cross-fade */
  tabSwitch: 200,
  /** Queue reorder snap */
  reorderSnap: 200,
  /** Reaction float */
  reactionFloat: 1500,
  /** Dynamic gradient cross-fade */
  gradientCrossfade: 800,
  /** Live indicator pulse cycle */
  livePulse: 2000,
  /** Card press feedback */
  cardPress: 150,
} as const;

// ─── Easing Curves ──────────────────────────────────────────

/** Standard back coefficient for spring-snap easing */
export const SPRING_BACK_COEFF = 1.2;

export const EASING = {
  /** Attack phase — snappy entrance with back overshoot */
  springSnap: Easing.out(Easing.back(SPRING_BACK_COEFF)),
  /** Standard ease-out for smooth deceleration */
  easeOut: Easing.out(Easing.cubic),
  /** Decay phase — settle to sustain */
  decaySettle: Easing.out(Easing.quad),
  /** Dismiss — ease-in for accelerating exit */
  dismissIn: Easing.in(Easing.quad),
  /** Tab switch — symmetric ease */
  tabCrossFade: Easing.inOut(Easing.ease),
} as const;

// ─── Stagger ────────────────────────────────────────────────

export const STAGGER = {
  /** Default stagger for list items (ms per index) */
  listItem: 60,
  /** Max total stagger delay (prevents long waits on big lists) */
  listMax: 300,
  /** Section-level stagger */
  section: 80,
} as const;

export default { SPRING_SHEET_APPEAR, SPRING_BOTTOM_SHEET, SPRING_SNAP_BACK, SPRING_REORDER, DURATION, EASING, STAGGER };
