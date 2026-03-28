import type { RoomMode } from '../../../types';
import type { SignalChainVisualMode } from '../types';

export const tacticalTokens = {
  colors: {
    void: '#000000',
    matte: '#111111',
    matteRaised: '#1A1A1A',
    gridLine: '#1A1A1A',
    border: '#333333',
    borderSoft: '#222222',
    acid: '#52F03A',
    orange: '#F05A2A',
    white: '#FFFFFF',
    textDim: '#666666',
    textMuted: '#8A8A8A',
    textSoft: '#767676',
    ice: '#2AD2E3',
    hotPink: '#F04A72',
    guide: '#C6A57A',
    guideSoft: '#9F8666',
    borderGhost: '#2A2A2A',
    matteGhost: '#101010',
    overlay: 'rgba(0, 0, 0, 0.78)',
  },
  radius: {
    none: 0,
    micro: 1,
    sharp: 2,
  },
  spacing: {
    unit: 4,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  grid: {
    cell: 20,
  },
  fonts: {
    display: 'ChakraPetch-Bold',
    mono: 'SpaceMono-Regular',
    monoBold: 'SpaceMono-Bold',
  },
  fontSize: {
    sys: 10,
    micro: 11,
    small: 12,
    body: 14,
    label: 16,
    title: 24,
    display: 28,
    hero: 32,
  },
} as const;

export function getModeBlockColors(mode: SignalChainVisualMode | RoomMode) {
  switch (mode) {
    case 'campfire':
      return {
        backgroundColor: tacticalTokens.colors.orange,
        borderColor: tacticalTokens.colors.orange,
        color: tacticalTokens.colors.void,
      };
    case 'openFloor':
      return {
        backgroundColor: tacticalTokens.colors.acid,
        borderColor: tacticalTokens.colors.acid,
        color: tacticalTokens.colors.void,
      };
    default:
      return {
        backgroundColor: tacticalTokens.colors.white,
        borderColor: tacticalTokens.colors.white,
        color: tacticalTokens.colors.void,
      };
  }
}

export function formatModeLabel(mode: SignalChainVisualMode | RoomMode): string {
  switch (mode) {
    case 'campfire':
      return 'CAMPFIRE';
    case 'spotlight':
      return 'SPOTLIGHT';
    case 'openFloor':
      return 'OPEN FLR';
    default:
      return String(mode).toUpperCase();
  }
}
