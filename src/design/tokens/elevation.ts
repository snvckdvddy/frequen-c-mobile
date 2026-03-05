/**
 * Frequen-C Elevation Tokens
 * ─────────────────────────────────────────────────────────────
 * Clean depth system with soft shadows and uniform radius.
 *
 * Levels:
 *   recessed: inset/engraved (labels, secondary)
 *   flush: card at rest (minimal shadow)
 *   raised: interactive elements (visible shadow)
 *   floating: modals, overlays (deep shadow)
 *   emitting: accent elements (no shadow, glow)
 */

// ─── Shadow Definitions ─────────────────────────────────────

export type ShadowConfig = {
  color: string;
  offset: { x: number; y: number };
  blur: number;
  spread?: number;
};

export const elevation = {
  recessed: {
    depth: -1,
    shadows: [
      {
        color: 'rgba(0, 0, 0, 0.4)',
        offset: { x: 0, y: 1 },
        blur: 2,
      },
    ] as ShadowConfig[],
  },

  flush: {
    depth: 0,
    shadows: [
      {
        color: 'rgba(0, 0, 0, 0.2)',
        offset: { x: 0, y: 1 },
        blur: 3,
      },
    ] as ShadowConfig[],
  },

  raised: {
    depth: 1,
    shadows: [
      {
        color: 'rgba(0, 0, 0, 0.25)',
        offset: { x: 0, y: 4 },
        blur: 12,
      },
      {
        color: 'rgba(0, 0, 0, 0.15)',
        offset: { x: 0, y: 1 },
        blur: 4,
      },
    ] as ShadowConfig[],
  },

  floating: {
    depth: 2,
    shadows: [
      {
        color: 'rgba(0, 0, 0, 0.4)',
        offset: { x: 0, y: 12 },
        blur: 40,
      },
      {
        color: 'rgba(0, 0, 0, 0.2)',
        offset: { x: 0, y: 4 },
        blur: 12,
      },
    ] as ShadowConfig[],
  },

  emitting: {
    depth: 0,
    shadows: [] as ShadowConfig[],
  },
} as const;

// ─── Helper: Convert to RN Shadow Style ─────────────────────

export function toRNShadow(config: ShadowConfig) {
  return {
    shadowColor: config.color,
    shadowOffset: config.offset,
    shadowOpacity: 1,
    shadowRadius: config.blur / 2,
    elevation: Math.max(1, config.blur / 2), // Android
  };
}

export function primaryShadow(level: keyof typeof elevation) {
  const shadows = elevation[level].shadows;
  if (shadows.length === 0) return {};
  return toRNShadow(shadows[0]);
}

// ─── Layout Constants ────────────────────────────────────────

export const rackHardware = {
  /** Rail groove — kept for API compat, not visually used */
  railWidth: 1,
  railColor: 'rgba(255, 255, 255, 0.03)',
  /** Screw tokens — kept for API compat, not rendered */
  screwSize: 4,
  screwColor: 'rgba(255, 255, 255, 0.08)',
  screwHighlight: 'rgba(255, 255, 255, 0.15)',
  mountingInterval: 60,
  topEdgeHighlight: {
    color: 'rgba(255, 255, 255, 0.04)',
    height: 1,
  },
  /** Uniform border radius — 12px all corners */
  faceplateRadius: {
    topLeft: 12,
    topRight: 12,
    bottomLeft: 12,
    bottomRight: 12,
  },
} as const;
