/**
 * Frequen-C Material Tokens
 * ─────────────────────────────────────────────────────────────
 * Clean, warm dark palette. Surfaces are flat colors with soft
 * borders and generous radius. No metallic textures or grain.
 *
 * Usage in components:
 *   import { materials } from '@/design/tokens/materials';
 *   <VoidSurface /> or style={materials.void.flat}
 */

// ─── Core Palette ────────────────────────────────────────────

export const palette = {
  // ─── Surface tones (warm neutrals) ─────────────────
  void: '#0F1012',       // Deepest background — warm near-black
  midnight: '#161819',   // Card/section backgrounds — warm charcoal
  steel: '#1E2022',      // Raised surfaces — warm dark gray
  gunmetal: '#262829',   // Interactive surface base

  // ─── Primary accent: ORANGE (warm, inviting) ──────
  orange: '#FF7A45',     // Primary interactive — slightly warmer
  orangeGlow: 'rgba(255, 122, 69, 0.25)',
  orangeDim: '#D4612F',  // Pressed/disabled orange

  // ─── Secondary accent: TEAL (organic, muted) ──────
  ice: '#5AC8C8',        // Soft teal replaces electric cyan
  iceGlow: 'rgba(90, 200, 200, 0.20)',

  // ─── Alert accents ──────────────────────────────────
  amber: '#FFB860',      // Voltage sag / warning — warmer gold
  red: '#FF4D6A',        // Destructive / ACTIVE PATCH badge
  green: '#34D399',      // CV economy, success — soft emerald
  magenta: '#F472B6',    // Phase Cancel — soft pink

  // ─── Text hierarchy (warm whites & grays) ─────────
  frost: '#F5F0EB',      // Primary text — warm off-white
  white: '#EDE8E3',      // Secondary white — cream tint
  silver: '#9CA3A8',     // Secondary text — neutral mid-tone
  slate: '#7A8388',      // Muted/tertiary — warm gray (WCAG AA on midnight)
  textSecondary: '#8E9499',
  textDim: '#62686C',    // Module labels — passes AA-large on midnight

  // ─── Signal waveform colors (room mode identity) ────
  signalSine: '#FF7A45',      // Campfire — warm orange
  signalSquare: '#F472B6',    // Spotlight — soft pink
  signalSaw: '#93C5FD',       // Open Floor — soft blue

  // ─── Semantic border / surface ─────────────────────
  chromeBorder: 'rgba(255, 255, 255, 0.08)',
  chromeHighlight: 'rgba(255, 255, 255, 0.04)',
} as const;

// ─── Glow Configs ────────────────────────────────────────────
// Softer, subtler glows for the warm palette

export const glow = {
  /** Orange — primary accent glow */
  orange: {
    core: '#FF7A45',
    inner: 'rgba(255, 122, 69, 0.35)',
    innerRadius: 10,
    outer: 'rgba(255, 122, 69, 0.12)',
    outerRadius: 25,
    ambient: 'rgba(255, 122, 69, 0.05)',
    ambientRadius: 50,
  },
  /** Teal — secondary indicator glow */
  ice: {
    core: '#5AC8C8',
    inner: 'rgba(90, 200, 200, 0.30)',
    innerRadius: 8,
    outer: 'rgba(90, 200, 200, 0.10)',
    outerRadius: 20,
    ambient: 'rgba(90, 200, 200, 0.04)',
    ambientRadius: 40,
  },
  /** Amber — warning state glow */
  amber: {
    core: '#FFB860',
    inner: 'rgba(255, 184, 96, 0.30)',
    innerRadius: 8,
    outer: 'rgba(255, 184, 96, 0.10)',
    outerRadius: 20,
    ambient: 'rgba(255, 184, 96, 0.04)',
    ambientRadius: 40,
  },
  /** Subtle interaction feedback */
  subtle: {
    core: 'rgba(90, 200, 200, 0.15)',
    inner: 'rgba(90, 200, 200, 0.08)',
    innerRadius: 5,
    outer: 'rgba(90, 200, 200, 0.03)',
    outerRadius: 12,
    ambient: 'rgba(90, 200, 200, 0.01)',
    ambientRadius: 20,
  },
} as const;

// ─── Material Definitions ───────────────────────────────────

export const materials = {
  /**
   * VOID — Deep background. Clean, warm near-black.
   * Grain and vignette tokens preserved for API compat but
   * component defaults set to off for a cleaner look.
   */
  void: {
    flat: palette.void,
    noiseFrequency: 0.9,
    noiseOctaves: 4,
    noiseOpacity: 0.02,
    vignette: {
      color: 'rgba(0, 0, 0, 0.25)',
      radius: 0.85,
    },
  },

  /**
   * CHROME — Clean elevated surface (no longer metallic gradient).
   * Gradient stops preserved for API compat but flattened.
   */
  chrome: {
    flat: palette.gunmetal,
    gradientStops: [
      { offset: 0, color: '#232526' },
      { offset: 0.2, color: '#262829' },
      { offset: 0.4, color: '#2A2C2E' },
      { offset: 0.5, color: '#2C2E30' },
      { offset: 0.6, color: '#2A2C2E' },
      { offset: 0.8, color: '#262829' },
      { offset: 1, color: '#232526' },
    ],
    gradientAngle: 180,
    specularHighlight: {
      color: 'rgba(255, 255, 255, 0.04)',
      height: 1,
    },
  },

  /**
   * BRUSHED STEEL → Clean Surface (warm flat card bg).
   * Tokens preserved for API compat, visuals simplified.
   */
  brushedSteel: {
    flat: palette.midnight,
    baseGradient: [
      { offset: 0, color: palette.midnight },
      { offset: 0.5, color: '#191B1D' },
      { offset: 1, color: palette.midnight },
    ],
    grainDirection: 0,
    grainFrequency: 0,
    grainOpacity: 0,
    brushLines: {
      spacing: 2,
      opacity: 0,
      color: 'rgba(255, 255, 255, 0)',
    },
  },

  /**
   * GLASS — Frosted overlay panel. Slightly warmer.
   */
  glass: {
    flat: 'rgba(22, 24, 25, 0.75)',
    fillOpacity: 0.75,
    blurRadius: 24,
    border: {
      width: 1,
      colorStart: 'rgba(255, 255, 255, 0.08)',
      colorEnd: 'rgba(255, 255, 255, 0.02)',
      gradientAngle: 180,
    },
    chromaticAberration: {
      enabled: false,
      offsetPx: 0,
      colors: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'],
    },
  },

  /**
   * TEAL EMISSION — Accent elements with subtle glow.
   */
  iceEmission: {
    flat: palette.ice,
    glow: glow.ice,
    pulse: {
      enabled: false,
      minOpacity: 0.9,
      maxOpacity: 1.0,
      durationMs: 2400,
    },
  },

  /**
   * AMBER EMISSION — Voltage sag accent.
   */
  amberEmission: {
    flat: palette.amber,
    glow: glow.amber,
    pulse: {
      enabled: false,
      minOpacity: 0.9,
      maxOpacity: 1.0,
      durationMs: 2800,
    },
  },
} as const;

// ─── Surface Elevation ──────────────────────────────────────

export const surfaceElevation = {
  /** Screen background */
  base: materials.void,
  /** Cards, modules at rest */
  raised: materials.brushedSteel,
  /** Modals, bottom sheets */
  overlay: materials.glass,
  /** Interactive elements */
  interactive: materials.chrome,
  /** Active/focused accent */
  accent: materials.iceEmission,
} as const;

// ─── VU Meter Color Thresholds ──────────────────────────────

export const vuColors = {
  segments: 20,
  thresholds: [
    { upTo: 0.6, color: palette.ice },
    { upTo: 0.8, color: '#FFD166' },
    { upTo: 1.0, color: palette.red },
  ],
  dimColor: 'rgba(30, 32, 34, 0.5)',
  segmentGap: 2,
} as const;
