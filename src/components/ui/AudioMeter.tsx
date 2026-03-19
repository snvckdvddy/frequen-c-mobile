import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
} from 'react-native-reanimated';

interface AudioMeterProps {
  color?: string;
  bars?: number;
  width?: number;
  height?: number;
  gap?: number;
}

const AudioBar = ({ color, maxHeight }: { color: string; maxHeight: number }) => {
  const height = useSharedValue(maxHeight * 0.2);

  useEffect(() => {
    // Generate pseudo-random values for each bar's animation sequence
    const h1 = Math.max(maxHeight * 0.3, Math.random() * maxHeight);
    const h2 = Math.max(maxHeight * 0.3, Math.random() * maxHeight);
    const d1 = 200 + Math.random() * 200;
    const d2 = 200 + Math.random() * 200;

    height.value = withRepeat(
      withSequence(
        withTiming(h1, { duration: d1 }),
        withTiming(h2, { duration: d2 }),
        withTiming(maxHeight * 0.2, { duration: 150 })
      ),
      -1, // infinite loop
      true // reverse
    );
  }, [maxHeight, height]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      height: height.value,
    };
  });

  return (
    <Animated.View style={[{ width: '100%', backgroundColor: color }, animatedStyle]} />
  );
};

export function AudioMeter({
  color = '#39FF14',
  bars = 4,
  width = 40,
  height = 24,
  gap = 2,
}: AudioMeterProps) {
  const barWidth = (width - gap * (bars - 1)) / bars;

  return (
    <View style={[styles.container, { width, height, gap }]}>
      {Array.from({ length: bars }).map((_, i) => (
        <View key={i} style={{ width: barWidth, height, justifyContent: 'flex-end' }}>
          <AudioBar color={color} maxHeight={height} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
});
