# Frequen-C Design System: Rack × Chrome

**Date**: 2026-02-22
**Status**: Design approved, awaiting implementation
**Visual Reference**: `docs/lookbook.html`
**Token Source**: `src/design/tokens/`

---

## Problem Statement

The current UI uses standard React Native `View` components with flat solid fills, uniform `borderRadius: 12`, and the ice cyan accent applied as a color value. The result is visually indistinguishable from any other dark-themed social app — it reads as generic, juvenile, and AI-generated.

The Y2K Chrome-Era Futurism identity exists in spec documents but has zero presence in the actual rendered interface. The modular synth metaphor ("signal chain," "patch bay," "CV economy") exists in naming but not in visual language.

**The core issue**: We've been building features on top of a visual foundation that doesn't exist yet.

## Design Direction

**"The Rack" structural metaphor + Chrome/Glass material language.**

The entire app is a virtual modular rack. Components are hardware modules that mount into visible rack rails. Surfaces have physical material properties — brushed metal, chrome reflection, frosted glass, light emission. Typography is split between futuristic display faces and technical mono readouts. The UI should feel like holding a piece of reimagined hardware.

## Dependencies

### Required (install before implementation)

| Package | Version Target | Purpose |
|---|---|---|
| `@shopify/react-native-skia` | latest compatible with Expo 54 | Custom rendering: shaders, paths, blur, noise |
| `react-native-reanimated` | ^3.x | Physics-based animations, spring gestures |
| `expo-font` | bundled with Expo 54 | Load Chakra Petch, Space Mono, Inter |
| `expo-blur` | bundled with Expo 54 | BlurView for glass panels (Android) |
| `expo-asset` | bundled with Expo 54 | Font and texture asset loading |

### Already installed

| Package | Current Version | Role |
|---|---|---|
| `react-native-svg` | 15.12.1 | Decorative elements, rack rails, signal lines |
| `expo-linear-gradient` | ~15.0.8 | Gradient fallback if Skia unavailable |
| `react-native-gesture-handler` | ~2.28.0 | Gesture recognition for sheets, knobs |

### Installation commands

```bash
npx expo install @shopify/react-native-skia
npx expo install react-native-reanimated
npx expo install expo-font expo-blur expo-asset
```

**Note**: `@shopify/react-native-skia` requires a development build (not Expo Go). After install:

```bash
npx expo prebuild --clean
npx expo run:android
# OR
npx eas build --profile development --platform android
```

### Fonts to download

Download from Google Fonts and place in `src/design/fonts/`:

- Chakra Petch: Regular (400), SemiBold (600), Bold (700)
- Space Mono: Regular (400), Bold (700)
- Inter: Regular (400), Bold (700)

## Component Inventory

### Layer 1: Materials (Skia shaders / fallback surfaces)

| Component | What it renders | Skia implementation | Fallback |
|---|---|---|---|
| `VoidSurface` | Noise-grained dark background | Perlin noise shader at 3% opacity over #06080F | Flat #06080F |
| `ChromeSurface` | Metallic gradient that shifts | Multi-stop gradient, angle tied to scroll | `expo-linear-gradient` static |
| `BrushedSteelSurface` | Anodized aluminum with grain | Directional noise + base gradient | Flat #1E2436 + subtle border-top |
| `GlassPanel` | Frosted translucent surface | Skia blur + chromatic aberration | `expo-blur` BlurView + tinted overlay |
| `IceGlow` | Accent emission effect | Gradient fill + layered blur | Box shadow via `shadowColor` |
| `AmberGlow` | Voltage sag emission | Same as IceGlow, warm palette | Box shadow via `shadowColor` |

### Layer 2: Structural Primitives (The Rack)

| Component | Purpose | Key visual elements |
|---|---|---|
| `RackFrame` | Outer container with rail grooves | SVG vertical rail lines, mounting holes at 60px intervals |
| `RackModule` | Mountable component unit | BrushedSteel faceplate, 0/0/2/2 corner radius, top-edge highlight, screw dots at corners |
| `PatchPoint` | Connection node | 12px circle, 2px ring border, inner dot. States: dim (inactive), glowing (active), pulsing (data flowing) |
| `SignalLine` | Connection between patch points | 1px line with traveling glow pulse animation |
| `ModuleLabel` | Engraved hardware text | Label font, recessed text-shadow, uppercase |

### Layer 3: Data Display

| Component | Purpose | Visual treatment |
|---|---|---|
| `VUMeter` | Level meter | 20 segments, ice→gold→red thresholds, dim segments for unfilled |
| `WaveformBar` | Audio-shaped progress | SVG path from audio data (or generated), filled portion glows |
| `DataReadout` | Technical number display | Mono font + subtle glow behind, like LED hardware display |

### Layer 4: Interactive Elements

| Component | Purpose | States |
|---|---|---|
| `ChromeButton` | Primary action button | Rest: chrome gradient. Pressed: inverted gradient, deeper shadow. Disabled: desaturated |
| `GlassButton` | Secondary action | Rest: frosted glass. Pressed: brighter fill. Disabled: reduced opacity |
| `TransportRack` | Playback controls module | RackModule containing skip-back, play (large, emitting), skip-forward |

### Layer 5: Composites

| Component | Composed of | Used in |
|---|---|---|
| `TrackModule` | RackModule + album art + text + PatchPoint | Queue chain, search results |
| `QueueChain` | Multiple TrackModules + SignalLines | Queue sheet, queue peek |
| `ParticipantNode` | Avatar circle + PatchPoint ring | Participant cluster |
| `MasterBus` | ChromeSurface + tab icons + active glow | Tab bar |

## Implementation Order

### Phase 0: Foundation (no visible screens, infrastructure only)

1. Download and place font files in `src/design/fonts/`
2. Install dependencies (`npx expo install ...`)
3. Set up font loading in App.tsx using `expo-font`
4. Create `src/design/` directory structure
5. Token files already written — verify imports work
6. Create `LookbookScreen.tsx` route in navigator (dev-only)
7. Build and verify dev client runs on Android

### Phase 1: Materials

8. `VoidSurface` — test Skia noise shader, verify performance
9. `ChromeSurface` — multi-stop gradient with scroll-linked angle
10. `BrushedSteelSurface` — directional grain
11. `GlassPanel` — blur + edge light
12. `IceGlow` / `AmberGlow` — emission effect

**Checkpoint**: All 6 materials render correctly in LookbookScreen. Profile frame rate on target Android device.

### Phase 2: Rack Primitives

13. `RackFrame` with SVG rails
14. `RackModule` with faceplate, edge highlight, screws
15. `PatchPoint` with dim/active/pulsing states
16. `SignalLine` with traveling glow animation
17. `ModuleLabel` with engraved text treatment

**Checkpoint**: Rack system looks correct in LookbookScreen. Typography feels like hardware.

### Phase 3: Data Display + Controls

18. `VUMeter` with segment coloring
19. `WaveformBar` with progress fill
20. `DataReadout` with glow
21. `ChromeButton` with press states
22. `GlassButton` with press states
23. `TransportRack` module

**Checkpoint**: All interactive elements feel physical. Transport controls emit light.

### Phase 4: Composites

24. `TrackModule` with all sub-elements
25. `QueueChain` with signal flow animation
26. `ParticipantNode` cluster
27. `MasterBus` tab bar

**Checkpoint**: Full LookbookScreen complete. Visual proof matches HTML reference.

### Phase 5: Screen Rebuilds

28. Rebuild `SessionRoomScreen` using new component library
29. Rebuild `MasterBus` tab bar in `AppNavigator`
30. Rebuild Home screen with rack modules
31. Rebuild Discover screen
32. Rebuild Library screen

### Phase 6: Polish

33. Staggered entrance animations for lists
34. Shared element transitions between screens
35. Reaction particle system
36. Voltage Sag mode (swap materials to amber)
37. Performance optimization pass

## Risk Assessment

### Risk 1: Skia + Expo SDK 54 incompatibility

**Likelihood**: Low-medium. Skia has Expo config plugin support and is widely used.
**Impact**: High — materials system depends on it.
**Mitigation**: Every material has a defined fallback (see Component Inventory table). If Skia fails to install or crashes on Android, we fall back to `react-native-svg` + `expo-linear-gradient` + `expo-blur`. We lose noise grain shaders and chromatic aberration but keep 80% of the visual language.

### Risk 2: Android performance with complex shaders

**Likelihood**: Medium. Mid-range Android GPUs vary widely.
**Impact**: Medium — janky UI defeats the purpose.
**Mitigation**:
- Materials are static (rendered once, cached) not dynamic per-frame
- Noise grain is a single full-screen overlay, not per-element
- VU meter and waveform use SVG paths, not shader math
- Signal flow animation uses Reanimated (UI thread), not JS thread
- Performance budget: maintain 60fps during scroll, 30fps minimum during sheet animations
- Profile on a mid-range device (Pixel 4a class) before shipping

### Risk 3: Dev build requirement blocks iteration speed

**Likelihood**: Certain. Skia cannot run in Expo Go.
**Impact**: Medium — slower dev cycle.
**Mitigation**: Use EAS development build. Once built, hot reloading still works. Only need fresh build when native deps change.

### Risk 4: Font loading fails or flickers

**Likelihood**: Low. expo-font is mature.
**Impact**: Low — system fonts work as fallback.
**Mitigation**: Load fonts in App.tsx before rendering any screens. Show splash screen until fonts are ready. Define system font fallbacks in token file.

## Success Criteria

The design system is successful when:

1. **Recognition test**: Someone seeing the app for the first time says "this looks like hardware" or "this looks like nothing else" — not "this looks like Spotify" or "this is a React Native app."
2. **Material depth**: No surface in the app is a flat solid color. Every element has texture, gradient, glow, or grain.
3. **Typography hierarchy**: You can identify the information type (title vs. data vs. label vs. body) without reading the content — the font treatment alone communicates it.
4. **Structural coherence**: The rack metaphor is consistent. Every card is a module. Every connection is a signal line. Every indicator is a meter.
5. **Performance**: Maintains 60fps scroll on a Pixel 4a class device.
