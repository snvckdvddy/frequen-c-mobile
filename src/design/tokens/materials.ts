/**
 * Frequen-C Material Tokens
 * ─────────────────────────────────────────────────────────────
 * Materials are not just colors — they define how surfaces LOOK.
 * Each material includes: base color, gradient stops, blur values,
 * noise parameters, glow configs, and border treatments.
 *
 * Rendering priority:
 *   1. Skia shader (ideal — GPU-accelerated, pixel-perfect)
 *   2. SVG + LinearGradient fallback (if Skia unavailable)
 *   3. Flat color fallback (absolute minimum)
 *
 * Usage in components:
 *   import { materials } from '@/design/tokens/materials';
 *   <VoidSurface /> or style={materials.void.flat}
 */

// ─── Core Palette (from existing colors.ts) ─────────────────

export const palette = {
  void: '#06080F',
  midnight: '#0E1219',
  steel: '#161B28',
  gunmetal: '#1E2436',
  ice: '#00E5FF',
  amber: '#FFB347',
  white: '#E8EAED',
  textSecondary: '#8B9EB0',
  textDim: '#4A5568',
} as const;

// ─── Emission / Glow Configs ────────────────────────────────

export const glow = {
  ice: {
    /** Bright core color */
    core: '#00E5FF',
    /** Inner glow — tight, bright */
    inner: 'rgba(0, 229, 255, 0.40)',
    innerRadius: 10,
    /** Outer glow — wide, soft */
    outer: 'rgba(0, 229, 255, 0.15)',
    outerRadius: 30,
    /** Ambient — very wide, barely visible */
    ambient: 'rgba(0, 229, 255, 0.06)',
    ambientRadius: 60,
  },
  amber: {
    core: '#FFB347',
    inner: 'rgba(255, 179, 71, 0.40)',
    innerRadius: 10,
    outer: 'rgba(255, 179, 71, 0.15)',
    outerRadius: 30,
    ambient: 'rgba(255, 179, 71, 0.06)',
    ambientRadius: 60,
  },
  /** Subtle interaction feedback glow */
  subtle: {
    core: 'rgba(0, 229, 255, 0.20)',
    inner: 'rgba(0, 229, 255, 0.10)',
    innerRadius: 6,
    outer: 'rgba(0, 229, 255, 0.04)',
    outerRadius: 15,
    ambient: 'rgba(0, 229, 255, 0.02)',
    ambientRadius: 30,
  },
} as const;

// ─── Material Definitions ───────────────────────────────────

export const materials = {
  /**
   * VOID — The deepest background. Not flat black — has micro-grain.
   * Implementation: Base fill + Skia noise shader overlay at ~3% opacity.
   */
  void: {
    flat: palette.void,
    noiseFrequency: 0.9,
    noiseOctaves: 4,
    noiseOpacity: 0.03,
    vignette: {
      color: 'rgba(0, 0, 0, 0.4)',
      radius: 0.8, // percentage of surface diagonal
    },
  },

  /**
   * CHROME — Polished metallic surface. Reflects light.
   * Implementation: Multi-stop linear gradient simulating metal bands.
   * The gradient angle can shift based on scroll position for "living" reflection.
   */
  chrome: {
    flat: '#2a2d35',
    gradientStops: [
      { offset: 0, color: '#1a1d25' },
      { offset: 0.2, color: '#2a2d35' },
      { offset: 0.4, color: '#3d4150' },
      { offset: 0.5, color: '#4a4e5c' },
      { offset: 0.6, color: '#3d4150' },
      { offset: 0.8, color: '#2a2d35' },
      { offset: 1, color: '#1a1d25' },
    ],
    gradientAngle: 135, // degrees, can animate
    /** Top-edge specular highlight */
    specularHighlight: {
      color: 'rgba(255, 255, 255, 0.08)',
      height: 1, // px
    },
  },

  /**
   * BRUSHED STEEL — Anodized aluminum. Directional grain.
   * Implementation: Base fill + horizontal noise pattern (Skia) or
   * repeating linear-gradient for fine parallel lines.
   */
  brushedSteel: {
    flat: '#1E2436',
    baseGradient: [
      { offset: 0, color: '#1a2030' },
      { offset: 0.5, color: '#222840' },
      { offset: 1, color: '#1a2030' },
    ],
    grainDirection: 0, // degrees, 0 = horizontal
    grainFrequency: 2.0,
    grainOpacity: 0.06,
    /** The thin lines that simulate brushed texture */
    brushLines: {
      spacing: 2, // px between lines
      opacity: 0.04,
      color: 'rgba(255, 255, 255, 0.04)',
    },
  },

  /**
   * GLASS — Frosted translucent panel.
   * Implementation: Semi-transparent fill + backdrop-blur + edge light.
   */
  glass: {
    flat: 'rgba(30, 36, 54, 0.40)',
    fillOpacity: 0.40,
    blurRadius: 20, // px — backdrop blur
    border: {
      width: 1,
      /** Gradient border: bright at top-left, transparent at bottom-right */
      colorStart: 'rgba(255, 255, 255, 0.12)',
      colorEnd: 'rgba(255, 255, 255, 0.02)',
      gradientAngle: 135,
    },
    /** Chromatic aberration on edges — subtle color fringing */
    chromaticAberration: {
      enabled: true,
      offsetPx: 0.5,
      colors: ['rgba(255, 100, 100, 0.05)', 'rgba(100, 100, 255, 0.05)'],
    },
  },

  /**
   * ICE EMISSION — Accent elements that appear to emit light.
   * Implementation: Solid fill + layered shadows for bloom effect.
   */
  iceEmission: {
    flat: palette.ice,
    glow: glow.ice,
    /** Pulsing animation — subtle brightness oscillation */
    pulse: {
      enabled: false, // enable per-component
      minOpacity: 0.85,
      maxOpacity: 1.0,
      durationMs: 2000,
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
      minOpacity: 0.85,
      maxOpacity: 1.0,
      durationMs: 2400,
    },
  },
} as const;

// ─── Surface Elevation ──────────────────────────────────────
// Which material to use at each depth level

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
    { upTo: 0.6, color: palette.ice },         // Normal — ice cyan
    { upTo: 0.8, color: '#FFD700' },            // Caution — gold
    { upTo: 1.0, color: '#FF3B30' },            // Clip — red
  ],
  dimColor: 'rgba(30, 36, 54, 0.5)',            // Unlit segment
  segmentGap: 2,                                 // px between segments
} as const;
