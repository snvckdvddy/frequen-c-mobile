/**
 * Frequen-C Design System Components
 * ─────────────────────────────────────────────────────────────
 * Layered component library for the Rack × Chrome visual language.
 *
 * Layer 1: Materials — surfaces and textures
 * Layer 2: Rack — structural hardware elements
 * Layer 3: Display — data visualization hardware
 * Layer 4: Controls — interactive elements (TODO)
 * Layer 5: Composites — assembled screen-level patterns (TODO)
 *
 * Usage:
 *   import { VoidSurface, ModuleFaceplate, LEDReadout } from '@/design/components';
 */

// Layer 1: Materials
export {
  VoidSurface,
  ChromeSurface,
  BrushedSteelSurface,
  GlassPanel,
  EmissionGlow,
} from './materials';

// Layer 2: Rack
export { RackRails, ModuleFaceplate } from './rack';

// Layer 3: Display
export { LEDReadout, VUMeter, PatchPoint } from './display';

// Layer 4: Controls
export {
  ChromeButton,
  HardwareSlider,
  FaderKnob,
  StatusLight,
  ScrewHead,
} from './controls';
