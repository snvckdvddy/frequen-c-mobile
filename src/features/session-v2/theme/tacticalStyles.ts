import { StyleSheet } from 'react-native';
import { tacticalTokens } from './tacticalTokens';

export const tacticalSharedStyles = StyleSheet.create({
  fillAbsolute: {
    ...StyleSheet.absoluteFillObject,
  },
  screen: {
    flex: 1,
    backgroundColor: tacticalTokens.colors.void,
  },
  panel: {
    backgroundColor: tacticalTokens.colors.void,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    borderRadius: tacticalTokens.radius.sharp,
  },
  raisedPanel: {
    backgroundColor: tacticalTokens.colors.matte,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    borderRadius: tacticalTokens.radius.sharp,
  },
  monoLabel: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  hairline: {
    height: 1,
    backgroundColor: tacticalTokens.colors.borderSoft,
  },
});

export const tactilePressStyle = {
  opacity: 0.84,
  transform: [{ scale: 0.98 }],
} as const;
