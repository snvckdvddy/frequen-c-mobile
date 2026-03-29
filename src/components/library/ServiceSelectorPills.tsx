/**
 * ServiceSelectorPills
 * ─────────────────────────────────────────────────────────────
 * Horizontal row of pill buttons — one per streaming service.
 * Active pill uses the accent color; dim pills show unconnected
 * services as "Connect" targets.
 *
 * Designed to sit at the top of the Library screen or the
 * Library tab inside the Search HUD.
 */

import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, withAlpha } from '@/design/tokens/materials';
import { TrackSource } from '../../types';

// ─── Service metadata ───────────────────────────────────────

interface ServiceMeta {
  key: TrackSource;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const SERVICES: ServiceMeta[] = [
  { key: 'soundcloud',  label: 'SoundCloud',  icon: 'cloud-outline' },
  { key: 'spotify',     label: 'Spotify',     icon: 'musical-notes-outline' },
  { key: 'appleMusic',  label: 'Apple Music', icon: 'logo-apple' },
  { key: 'tidal',       label: 'Tidal',       icon: 'water-outline' },
];

// ─── Props ──────────────────────────────────────────────────

export interface ServiceSelectorPillsProps {
  /** Which services the user has connected */
  connectedServices: TrackSource[];
  /** Currently selected service (highlighted pill) */
  selectedService: TrackSource | null;
  /** Called when the user taps a connected service pill */
  onSelectService: (service: TrackSource) => void;
  /** Called when the user taps a disconnected service pill (navigate to settings) */
  onConnectService?: (service: TrackSource) => void;
}

// ─── Component ──────────────────────────────────────────────

export function ServiceSelectorPills({
  connectedServices,
  selectedService,
  onSelectService,
  onConnectService,
}: ServiceSelectorPillsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scrollView}
      contentContainerStyle={styles.container}
    >
      {SERVICES.map((svc) => {
        const isConnected = connectedServices.includes(svc.key);
        const isSelected = selectedService === svc.key;

        return (
          <TouchableOpacity
            key={svc.key}
            style={[
              styles.pill,
              isSelected && styles.pillActive,
              !isConnected && styles.pillDisabled,
            ]}
            onPress={() => {
              if (isConnected) {
                onSelectService(svc.key);
              } else {
                onConnectService?.(svc.key);
              }
            }}
            activeOpacity={isConnected ? 0.7 : 0.4}
            accessibilityRole="button"
            accessibilityLabel={
              isConnected
                ? `${svc.label}${isSelected ? ', selected' : ''}`
                : `Connect ${svc.label}`
            }
          >
            <Ionicons
              name={svc.icon}
              size={16}
              color={
                isSelected
                  ? palette.orange
                  : isConnected
                    ? palette.frost
                    : palette.slate
              }
              style={styles.pillIcon}
            />
            <Text
              style={[
                styles.pillText,
                isSelected && styles.pillTextActive,
                !isConnected && styles.pillTextDisabled,
              ]}
              numberOfLines={1}
            >
              {isConnected ? svc.label : 'Connect'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 0,  // Prevent stretching to fill flex parent
  },
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: palette.steel,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  pillActive: {
    backgroundColor: withAlpha(palette.orange, 0.15),
    borderColor: palette.orange,
  },
  pillDisabled: {
    opacity: 0.5,
  },
  pillIcon: {
    marginRight: 6,
  },
  pillText: {
    color: palette.frost,
    fontSize: 13,
    fontWeight: '500',
  },
  pillTextActive: {
    color: palette.orange,
    fontWeight: '600',
  },
  pillTextDisabled: {
    color: palette.slate,
  },
});
