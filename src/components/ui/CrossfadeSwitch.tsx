/**
 * CrossfadeSwitch — Smooth crossfade between loading and loaded states.
 *
 * Fades out the first child (skeleton) while fading in the second (content).
 * Prevents the jarring "pop" of instant conditional rendering.
 *
 * Usage:
 *   <CrossfadeSwitch loading={isLoading}>
 *     <SkeletonPlaceholder />
 *     <RealContent />
 *   </CrossfadeSwitch>
 */

import React, { useEffect, useRef, useState, ReactNode } from 'react';
import { Animated, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';

interface CrossfadeSwitchProps {
  /** When true, shows first child; when false, crossfades to second child */
  loading: boolean;
  /** [loadingContent, loadedContent] */
  children: [ReactNode, ReactNode];
  /** Crossfade duration in ms (default 200) */
  duration?: number;
  /** Extra container style */
  style?: StyleProp<ViewStyle>;
}

export function CrossfadeSwitch({
  loading,
  children,
  duration = 200,
  style,
}: CrossfadeSwitchProps) {
  const fadeOut = useRef(new Animated.Value(1)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  // Keep skeleton mounted briefly during fade-out
  const [showSkeleton, setShowSkeleton] = useState(true);

  useEffect(() => {
    if (!loading) {
      // Crossfade: fade out skeleton, fade in content
      Animated.parallel([
        Animated.timing(fadeOut, {
          toValue: 0,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(fadeIn, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Unmount skeleton after animation completes
        setShowSkeleton(false);
      });
    } else {
      // Reset when loading restarts (e.g. pull-to-refresh)
      fadeOut.setValue(1);
      fadeIn.setValue(0);
      setShowSkeleton(true);
    }
  }, [loading, fadeOut, fadeIn, duration]);

  return (
    <View style={style}>
      {showSkeleton && (
        <Animated.View style={[styles.layer, { opacity: fadeOut }]}>
          {children[0]}
        </Animated.View>
      )}
      <Animated.View style={[styles.layer, { opacity: fadeIn }]}>
        {children[1]}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    // Layers stack; skeleton is absolute so content can measure naturally
  },
});

export default CrossfadeSwitch;
