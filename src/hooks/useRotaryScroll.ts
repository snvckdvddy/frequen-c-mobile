/**
 * useRotaryScroll — Rotary encoder scroll physics.
 *
 * Adds "detent" snap points to scroll behavior, simulating the
 * click-stop feel of a hardware rotary encoder. Each item in the
 * list acts as a detent. Scroll momentum decays toward the nearest
 * detent with a subtle haptic tick.
 *
 * Usage with FlatList:
 *   const { onScroll, onMomentumEnd, scrollToIndex } = useRotaryScroll({
 *     itemHeight: 72,
 *     itemCount: queue.length,
 *     listRef,
 *   });
 *
 *   <FlatList
 *     ref={listRef}
 *     onScroll={onScroll}
 *     onMomentumScrollEnd={onMomentumEnd}
 *     snapToInterval={72}
 *     decelerationRate="fast"
 *     ...
 *   />
 */

import { useRef, useCallback } from 'react';
import {
  NativeSyntheticEvent, NativeScrollEvent, FlatList, Animated,
} from 'react-native';
import { tapLight } from '../utils/haptics';

interface RotaryScrollConfig {
  /** Height of each item (detent spacing) */
  itemHeight: number;
  /** Total number of items */
  itemCount: number;
  /** Ref to the FlatList */
  listRef: React.RefObject<FlatList>;
  /** Enable haptic ticks at each detent (default true) */
  hapticTicks?: boolean;
  /** Overshoot resistance factor 0-1 (default 0.3) */
  resistance?: number;
}

export function useRotaryScroll({
  itemHeight,
  itemCount,
  listRef,
  hapticTicks = true,
  resistance = 0.3,
}: RotaryScrollConfig) {
  const lastDetent = useRef(0);
  const scrollY = useRef(new Animated.Value(0)).current;

  /** Track current detent index as user scrolls */
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const currentDetent = Math.round(y / itemHeight);

      // Fire haptic tick when crossing a new detent boundary
      if (currentDetent !== lastDetent.current && hapticTicks) {
        lastDetent.current = currentDetent;
        tapLight();
      }
    },
    [itemHeight, hapticTicks]
  );

  /** Snap to nearest detent when momentum ends */
  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const nearestDetent = Math.round(y / itemHeight);
      const clamped = Math.max(0, Math.min(nearestDetent, itemCount - 1));

      listRef.current?.scrollToOffset({
        offset: clamped * itemHeight,
        animated: true,
      });
    },
    [itemHeight, itemCount, listRef]
  );

  /** Programmatic scroll to a specific index with detent snap */
  const scrollToIndex = useCallback(
    (index: number, animated = true) => {
      const clamped = Math.max(0, Math.min(index, itemCount - 1));
      listRef.current?.scrollToOffset({
        offset: clamped * itemHeight,
        animated,
      });
      lastDetent.current = clamped;
    },
    [itemHeight, itemCount, listRef]
  );

  /** Get the Animated.event handler for direct binding */
  const animatedScrollHandler = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false, listener: onScroll }
  );

  /** Interpolation helper — map scroll position to item visibility */
  const getItemOpacity = useCallback(
    (index: number) => {
      return scrollY.interpolate({
        inputRange: [
          (index - 2) * itemHeight,
          (index - 1) * itemHeight,
          index * itemHeight,
          (index + 1) * itemHeight,
          (index + 2) * itemHeight,
        ],
        outputRange: [0.3, 0.7, 1, 0.7, 0.3],
        extrapolate: 'clamp',
      });
    },
    [scrollY, itemHeight]
  );

  /** Interpolation helper — scale items closer to center */
  const getItemScale = useCallback(
    (index: number) => {
      return scrollY.interpolate({
        inputRange: [
          (index - 1) * itemHeight,
          index * itemHeight,
          (index + 1) * itemHeight,
        ],
        outputRange: [0.95, 1, 0.95],
        extrapolate: 'clamp',
      });
    },
    [scrollY, itemHeight]
  );

  return {
    onScroll,
    onMomentumEnd,
    scrollToIndex,
    animatedScrollHandler,
    scrollY,
    getItemOpacity,
    getItemScale,
    lastDetent: lastDetent.current,
  };
}

export default useRotaryScroll;
