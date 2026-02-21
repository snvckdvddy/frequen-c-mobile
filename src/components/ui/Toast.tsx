/**
 * Toast — Non-blocking notification
 *
 * Slides down from top, auto-dismisses.
 * Used for: track added, vote cast, room joined, errors.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// ─── Toast Queue (global) ───────────────────────────────────

type ToastType = 'success' | 'info' | 'warning' | 'error';

interface ToastData {
  id: string;
  message: string;
  type: ToastType;
  icon?: string;
  duration?: number;
}

let toastListeners: Array<(toast: ToastData) => void> = [];

/** Call from anywhere to show a toast */
export function showToast(
  message: string,
  type: ToastType = 'info',
  icon?: string,
  duration = 2500
) {
  const toast: ToastData = {
    id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    message,
    type,
    icon,
    duration,
  };
  toastListeners.forEach((fn) => fn(toast));
}

// ─── Toast Item ─────────────────────────────────────────────

function ToastItem({ toast, onDone }: { toast: ToastData; onDone: (id: string) => void }) {
  const translateY = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const typeColors: Record<ToastType, string> = {
    success: colors.action.primary,
    info: colors.text.secondary,
    warning: '#F5A623',
    error: colors.action.destructive,
  };

  const borderColor = typeColors[toast.type];

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 4,
      }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -60, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => onDone(toast.id));
    }, toast.duration || 2500);

    return () => clearTimeout(timer);
  }, [translateY, opacity, toast.id, toast.duration, onDone]);

  return (
    <Animated.View
      style={[
        toastStyles.item,
        { borderLeftColor: borderColor, transform: [{ translateY }], opacity },
      ]}
    >
      {toast.icon && <Text style={{ fontSize: 16 }}>{toast.icon}</Text>}
      <Text variant="label" color={colors.text.primary} numberOfLines={2} style={{ flex: 1 }}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}

const toastStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    marginHorizontal: spacing.screenPadding,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.bg.elevated,
    borderLeftWidth: 3,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});

// ─── Toast Provider (mount once at app root) ────────────────

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    const listener = (toast: ToastData) => {
      setToasts((prev) => [...prev.slice(-3), toast]); // max 4 visible
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== listener);
    };
  }, []);

  const handleDone = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <View style={providerStyles.container} pointerEvents="none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDone={handleDone} />
      ))}
    </View>
  );
}

const providerStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
});

export default ToastProvider;
