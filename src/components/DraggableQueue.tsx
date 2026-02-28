/**
 * DraggableQueue — Drag-to-reorder queue list.
 *
 * Convergence Strategy §5.1:
 * Drag handle on queue item → Reorder (authorized users only)
 * Source: Spotify, TIDAL, Castro
 *
 * Uses react-native-gesture-handler PanGestureHandler for native drag.
 * Items are rearranged on drag-end based on Y displacement.
 * Now-playing (index 0) is excluded from reorder targets.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View, StyleSheet, FlatList, Animated, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  State,
} from 'react-native-gesture-handler';
import { palette } from '../design/tokens/materials';
import { tapLight, tapMedium } from '../utils/haptics';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ROW_HEIGHT = 88; // Approximate height of QueueTrackCard (72 min + padding)

interface DraggableQueueProps<T> {
  data: T[];
  /** Render each item. `isDragging` is true for the currently dragged item. */
  renderItem: (info: { item: T; index: number; isDragging: boolean; drag: () => void }) => React.ReactElement;
  keyExtractor: (item: T, index: number) => string;
  /** Called with reordered array after drag completes */
  onReorder: (data: T[]) => void;
  /** Items at these indices cannot be dragged or displaced (e.g., now-playing at 0) */
  lockedIndices?: number[];
  /** FlatList header component */
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  /** Content container style */
  contentContainerStyle?: any;
  /** Whether drag handles are enabled (e.g., only for hosts in Spotlight) */
  dragEnabled?: boolean;
  /** FlatList empty component */
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null;
  /** FlatList footer component */
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
}

export function DraggableQueue<T>({
  data,
  renderItem,
  keyExtractor,
  onReorder,
  lockedIndices = [0],
  ListHeaderComponent,
  contentContainerStyle,
  dragEnabled = true,
  ListEmptyComponent,
  ListFooterComponent,
}: DraggableQueueProps<T>) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragIndexRef = useRef<number | null>(null);

  const handleGestureEvent = useCallback(
    Animated.event(
      [{ nativeEvent: { translationY: dragY } }],
      { useNativeDriver: true }
    ),
    [dragY]
  );

  const handleStateChange = useCallback(
    (event: PanGestureHandlerGestureEvent, index: number) => {
      const { state, translationY } = event.nativeEvent;

      if (state === State.BEGAN) {
        tapMedium();
        dragIndexRef.current = index;
        setDraggingIndex(index);
      }

      if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
        if (state === State.END && dragIndexRef.current !== null) {
          // Calculate how many slots the item moved
          const slotsMovedRaw = Math.round(translationY / ROW_HEIGHT);
          const fromIndex = dragIndexRef.current;
          let toIndex = fromIndex + slotsMovedRaw;

          // Clamp to valid range — skip locked indices
          const minIndex = lockedIndices.includes(0) ? 1 : 0;
          toIndex = Math.max(minIndex, Math.min(data.length - 1, toIndex));

          // Skip if landing on a locked slot
          while (lockedIndices.includes(toIndex) && toIndex < data.length - 1) {
            toIndex++;
          }

          if (fromIndex !== toIndex && !lockedIndices.includes(fromIndex)) {
            tapLight();
            // Perform the reorder
            const newData = [...data];
            const [removed] = newData.splice(fromIndex, 1);
            newData.splice(toIndex, 0, removed);

            // Animate layout change
            LayoutAnimation.configureNext(
              LayoutAnimation.create(200, 'easeInEaseOut', 'opacity')
            );

            onReorder(newData);
          }
        }

        // Reset
        dragY.setValue(0);
        dragIndexRef.current = null;
        setDraggingIndex(null);
      }
    },
    [data, onReorder, lockedIndices, dragY]
  );

  const internalRenderItem = useCallback(
    ({ item, index }: { item: T; index: number }) => {
      const isDragging = draggingIndex === index;
      const isLocked = lockedIndices.includes(index);

      const drag = () => {
        // Trigger function — used by drag handle to indicate "start drag"
        // Actual gesture is handled by PanGestureHandler wrapping the handle
      };

      const content = renderItem({ item, index, isDragging, drag });

      if (!dragEnabled || isLocked) {
        return content;
      }

      return (
        <PanGestureHandler
          onGestureEvent={handleGestureEvent}
          onHandlerStateChange={(e) => handleStateChange(e, index)}
          activeOffsetY={[-10, 10]}  // Must move 10pt vertically to activate
          failOffsetX={[-20, 20]}    // Fail if horizontal (allows swipe-to-remove)
        >
          <Animated.View
            style={[
              isDragging && {
                transform: [{ translateY: dragY }],
                zIndex: 999,
                elevation: 8,
                shadowColor: palette.orange,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
              },
              isDragging && styles.draggingItem,
            ]}
          >
            {content}
          </Animated.View>
        </PanGestureHandler>
      );
    },
    [draggingIndex, dragEnabled, lockedIndices, renderItem, handleGestureEvent, handleStateChange, dragY]
  );

  // Perf: fixed row height → provide getItemLayout for O(1) scroll-to-index
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    []
  );

  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={internalRenderItem}
      getItemLayout={getItemLayout}
      initialNumToRender={8}
      maxToRenderPerBatch={5}
      windowSize={7}
      removeClippedSubviews={Platform.OS === 'android'}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={ListFooterComponent}
      contentContainerStyle={contentContainerStyle}
      scrollEnabled={draggingIndex === null} // Disable scroll while dragging
    />
  );
}

const styles = StyleSheet.create({
  draggingItem: {
    opacity: 0.92,
    borderRadius: 12,
    backgroundColor: palette.steel,
  },
});

export default DraggableQueue;
