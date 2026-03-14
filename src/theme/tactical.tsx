// src/components/WireframeGrid.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Path, Rect } from 'react-native-svg';
import { theme } from '../theme/theme';

export const WireframeGrid = ({ children }: { children: React.ReactNode }) => {
  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <Path d="M 20 0 L 0 0 0 20" fill="none" stroke={theme.colors.gridLine} strokeWidth="1" />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#grid)" />
        </Svg>
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.void },
  content: { flex: 1, zIndex: 1 },
});