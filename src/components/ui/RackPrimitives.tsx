import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { fontFamily, fontSize } from '../../design/tokens';

// ==========================================
// 1. RACK MODULE (The standard card container)
// ==========================================
interface RackModuleProps {
  children: React.ReactNode;
  label?: string;
  style?: ViewStyle;
}

export const RackModule: React.FC<RackModuleProps> = ({ children, label, style }) => {
  return (
    <LinearGradient
      colors={['#1c2234', '#161B28']} // Gunmetal to Steel
      style={[styles.rackModule, style]}
    >
      {/* Top Edge Specular Highlight */}
      <View style={styles.specularHighlight} />

      {/* Hardware Screws */}
      <View style={[styles.screw, { top: 8, left: 8 }]} />
      <View style={[styles.screw, { top: 8, right: 8 }]} />
      <View style={[styles.screw, { bottom: 8, left: 8 }]} />
      <View style={[styles.screw, { bottom: 8, right: 8 }]} />

      {/* Optional Engraved Label */}
      {label && <Text style={styles.moduleLabel}>{label}</Text>}

      <View style={{ marginTop: label ? 12 : 0 }}>
        {children}
      </View>
    </LinearGradient>
  );
};

// ==========================================
// 2. CHROME BUTTON (Tactile, heavy action button)
// ==========================================
interface ChromeButtonProps {
  title: string;
  onPress: () => void;
  isGlowing?: boolean;
}

export const ChromeButton: React.FC<ChromeButtonProps> = ({ title, onPress, isGlowing }) => {
  const { themeColors, isVoltageSag } = useTheme();
  const glowColor = themeColors.orange;

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <LinearGradient
        colors={['#3a3f52', '#2e3345', '#252a3a', '#1e2230']}
        locations={[0, 0.4, 0.6, 1]}
        style={[
          styles.chromeButton,
          isGlowing && {
            shadowColor: glowColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: isVoltageSag ? 0.4 : 0.8, // Dim glow if sagging
            shadowRadius: 15,
            elevation: 10,
          }
        ]}
      >
        <Text style={styles.chromeButtonText}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

// ==========================================
// 3. LED READOUT (For CV, BPM, Time)
// ==========================================
export const LEDReadout: React.FC<{ value: string | number, label?: string }> = ({ value, label }) => {
  const { themeColors } = useTheme();

  return (
    <View style={styles.ledContainer}>
      <Text style={[styles.ledValue, { color: themeColors.orange, textShadowColor: themeColors.ice }]}>
        {value}
      </Text>
      {label && <Text style={styles.ledLabel}>{label}</Text>}
    </View>
  );
};

// ==========================================
// STYLES
// ==========================================
const styles = StyleSheet.create({
  rackModule: {
    borderRadius: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    padding: 16,
    marginBottom: 16,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  specularHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  screw: {
    position: 'absolute',
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#111',
  },
  moduleLabel: {
    fontFamily: fontFamily.label,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  chromeButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chromeButtonText: {
    fontFamily: fontFamily.label,
    fontSize: 12,
    fontWeight: '700',
    color: '#F0F4F8',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  ledContainer: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#1E2436',
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
  },
  ledValue: {
    fontFamily: fontFamily.monoBold,
    fontSize: 24,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  ledLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    color: '#5A6680',
    letterSpacing: 1,
    marginTop: 2,
  }
});