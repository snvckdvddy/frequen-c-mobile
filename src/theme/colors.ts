/**
 * Frequen-C Color System — Y2K Edition
 *
 * Design philosophy: Chrome-era futurism meets collaborative music.
 * Icy translucency, hot accent pops, metallic depth.
 * Think early iPod × PS2 menu × Winamp — optimistic future, not retro.
 */

// ─── Core Palette ───────────────────────────────────────────

const palette = {
  // Backgrounds — deep navy-black, cool undertone
  void: '#06080F',          // Deepest background (session rooms)
  midnight: '#0E1219',      // Primary surface
  steel: '#161B28',         // Card/elevated surface
  gunmetal: '#1E2436',      // Input fields, secondary surfaces

  // Signal colors — chrome-era electric
  ice: '#00E5FF',            // Primary — icy cyan, the Frequen-C signature
  hotPink: '#FF2D55',        // Accent — Y2K pop, energy
  warmOrange: '#FF6B35',     // Heat — urgency, hot queue
  chromeBlue: '#C0DFFF',     // Metallic — premium, currency
  neonGreen: '#39FF14',      // Live indicator — unmistakable "on-air"

  // Neutrals — cool steel temperature
  frost: '#F0F4F8',          // Primary text — slightly cool white
  silver: '#94A3B8',         // Secondary text — steel silver
  slate: '#5A6680',          // Tertiary / muted text
  darkSteel: '#2D3548',      // Borders, dividers, disabled

  // Semantic overlays
  iceGlow: 'rgba(0, 229, 255, 0.12)',       // Cyan frost for active states
  pinkGlow: 'rgba(255, 45, 85, 0.10)',      // Hot pink glow
  chromeGlow: 'rgba(192, 223, 255, 0.08)',   // Chrome shimmer
} as const;

// ─── Semantic Tokens ────────────────────────────────────────

export const colors = {
  // Backgrounds
  bg: {
    primary: palette.void,
    surface: palette.midnight,
    elevated: palette.steel,
    input: palette.gunmetal,
    overlay: 'rgba(6, 8, 15, 0.88)',
  },

  // Text
  text: {
    primary: palette.frost,
    secondary: palette.silver,
    muted: palette.slate,
    inverse: palette.void,
  },

  // Borders & Dividers
  border: {
    default: palette.darkSteel,
    subtle: 'rgba(0, 229, 255, 0.06)',
    focus: palette.ice,
  },

  // Actions
  action: {
    primary: palette.ice,
    primaryText: palette.void,        // Dark text on icy cyan buttons
    secondary: palette.chromeBlue,
    destructive: palette.hotPink,
  },

  // Session / Room states
  session: {
    live: palette.neonGreen,
    liveGlow: 'rgba(57, 255, 20, 0.12)',
    campfire: palette.warmOrange,     // Campfire mode (equal turns)
    spotlight: palette.hotPink,       // Spotlight mode (host curates)
    openFloor: palette.chromeBlue,    // Open Floor mode (free-for-all)
  },

  // Social Voltage economy
  voltage: {
    charge: palette.chromeBlue,
    chargeGlow: palette.chromeGlow,
    spent: palette.slate,
    boost: palette.hotPink,
  },

  // Queue
  queue: {
    myTrack: palette.ice,
    myTrackGlow: palette.iceGlow,
    otherTrack: palette.steel,
    nowPlaying: palette.ice,
    upNext: palette.chromeBlue,
  },

  // Contribution visibility
  contribution: {
    active: palette.ice,
    recent: palette.chromeBlue,
    idle: palette.slate,
    streak: palette.warmOrange,
  },

  // Reactions
  reaction: {
    fire: palette.warmOrange,
    vibe: palette.hotPink,
    skip: palette.slate,
  },

  // Raw palette access (escape hatch)
  raw: palette,
} as const;

export type ColorToken = typeof colors;
export default colors;
