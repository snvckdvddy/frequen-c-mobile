/**
 * Frequen-C Elevation Tokens
 * ─────────────────────────────────────────────────────────────
 * Depth system based on hardware metaphor:
 * - Recessed: engraved labels, inset displays (negative depth)
 * - Flush: rack-mounted modules, faceplates (zero depth)
 * - Raised: buttons, active elements (positive depth)
 * - Floating: modals, overlays, bottom sheets (high depth)
 *
 * Light source: top-left (135° angle), consistent across all elements.
 * This matches the chrome gradient angle for visual coherence.
 */

// ─── Shadow Definitions ─────────────────────────────────────

export type ShadowConfig = {
  color: string;
  offset: { x: number; y: number };
  blur: number;
  spread?: number;
};

export const elevation = {
  /**
   * RECESSED — Engraved into the surface. Used for labels, inset displays.
   * Implementation: inset shadow (not directly supported in RN —
   * simulate with inner shadow via overlay or Skia).
   */
  recessed: {
    depth: -1,
    shadows: [
      {
        color: 'rgba(0, 0, 0, 0.6)',
        offset: { x: 1, y: 1 },
        blur: 2,
      },
      {
        color: 'rgba(255, 255, 255, 0.03)',
        offset: { x: -1, y: -1 },
        blur: 1,
      },
    ] as ShadowConfig[],
  },

  /**
   * FLUSH — Flat against the rack. Modules at rest.
   * Minimal shadow — just enough to separate from background.
   */
  flush: {
    depth: 0,
    shadows: [
      {
        color: 'rgba(0, 0, 0, 0.3)',
        offset: { x: 0, y: 1 },
        blur: 2,
      },
    ] as ShadowConfig[],
  },

  /**
   * RAISED — Slightly above surface. Buttons, interactive elements.
   * Visible shadow + top-edge specular highlight.
   */
  raised: {
    depth: 1,
    shadows: [
      {
        color: 'rgba(0, 0, 0, 0.4)',
        offset: { x: 0, y: 2 },
        blur: 8,
      },
      {
        color: 'rgba(0, 0, 0, 0.2)',
        offset: { x: 0, y: 1 },
        blur: 3,
      },
    ] as ShadowConfig[],
    specularHighlight: {
      color: 'rgba(255, 255, 255, 0.08)',
      position: 'top', // 1px line at the top edge
    },
  },

  /**
   * FLOATING — Modals, bottom sheets, overlays.
   * Deep shadow + glass material treatment.
   */
  floating: {
    depth: 2,
    shadows: [
      {
        color: 'rgba(0, 0, 0, 0.6)',
        offset: { x: 0, y: 8 },
        blur: 32,
      },
      {
        color: 'rgba(0, 0, 0, 0.3)',
        offset: { x: 0, y: 2 },
        blur: 8,
      },
    ] as ShadowConfig[],
  },

  /**
   * EMITTING — Element appears to emit light (accent elements).
   * No downward shadow — instead, glow radiates outward.
   * Combine with materials.iceEmission or amberEmission.
   */
  emitting: {
    depth: 0,
    shadows: [] as ShadowConfig[], // Glow handled by material, not elevation
  },
} as const;

// ─── Helper: Convert to RN Shadow Style ─────────────────────
// React Native only supports a single shadow. For multi-shadow,
// use Skia or stack multiple View layers.

export function toRNShadow(config: ShadowConfig) {
  return {
    shadowColor: config.color,
    shadowOffset: config.offset,
    shadowOpacity: 1, // opacity baked into color
    shadowRadius: config.blur / 2,
    elevation: Math.max(1, config.blur / 2), // Android
  };
}

/**
 * Quick access: apply the first (most prominent) shadow from an elevation.
 * For full multi-shadow support, use Skia DropShadow.
 */
export function primaryShadow(level: keyof typeof elevation) {
  const shadows = elevation[level].shadows;
  if (shadows.length === 0) return {};
  return toRNShadow(shadows[0]);
}

// ─── Rack Hardware Constants ────────────────────────────────

export const rackHardware = {
  /** Rail groove width */
  railWidth: 1,
  railColor: 'rgba(255, 255, 255, 0.04)',
  /** Mounting screw size and color */
  screwSize: 4,
  screwColor: 'rgba(255, 255, 255, 0.10)',
  screwHighlight: 'rgba(255, 255, 255, 0.20)',
  /** Spacing between mounting holes along rails */
  mountingInterval: 60,
  /** Module top-edge highlight (light hitting the top of hardware) */
  topEdgeHighlight: {
    color: 'rgba(255, 255, 255, 0.06)',
    height: 1,
  },
  /** Module faceplate border radius */
  faceplateRadius: {
    topLeft: 0,
    topRight: 0,
    bottomLeft: 2,
    bottomRight: 2,
  },
} as const;
