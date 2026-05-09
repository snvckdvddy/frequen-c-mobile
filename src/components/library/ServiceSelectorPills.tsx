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
import { getAccessForSource } from '../../services/adapters/musicServiceAdapter';
import { BetaBadge } from '@/components/ui';

// ─── Service metadata ───────────────────────────────────────

interface ServiceMeta {
  key: TrackSource;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// Order matches SOURCE_META.crossMatchPriority in musicServiceAdapter.ts —
// pills render left→right in priority order so the highest-quality source
// is the first thing the user sees and the restricted-beta source is last.
// As of 2026-05-09: Apple Music → SoundCloud → Tidal → Spotify (BETA).
const SERVICES: ServiceMeta[] = [
  { key: 'appleMusic',  label: 'Apple Music', icon: 'logo-apple' },
  { key: 'soundcloud',  label: 'SoundCloud',  icon: 'cloud-outline' },
  { key: 'tidal',       label: 'Tidal',       icon: 'water-outline' },
  { key: 'spotify',     label: 'Spotify',     icon: 'musical-notes-outline' },
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
        // Subscription-beta sources (Spotify as of Feb 2026) carry a
        // "Restricted Beta" treatment. The badge stays visible whether
        // the user is connected or not so the scarcity is communicated
        // up front, not after a failed connect. The visual chip lives in
        // <BetaBadge />; we still need this boolean locally so the
        // accessibility label can be enriched at the parent.
        const isRestrictedBeta = getAccessForSource(svc.key) === 'subscription-beta';

        // Build accessibility label: include the beta framing for screen-reader
        // users so they hear *why* a service might be different, not just its name.
        const a11yBase = isConnected
          ? `${svc.label}${isSelected ? ', selected' : ''}`
          : `Connect ${svc.label}`;
        const a11yLabel = isRestrictedBeta
          ? `${a11yBase}, restricted beta`
          : a11yBase;

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
            accessibilityLabel={a11yLabel}
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
            <BetaBadge source={svc.key} style={styles.betaBadgeOffset} />
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
  // ─── Restricted-beta badge offset ──────────────────────────
  // Layout-only spacer for the shared <BetaBadge /> primitive when it
  // sits inline at the trailing edge of the Spotify pill. Visual styling
  // (color, border, padding, font) lives in components/ui/BetaBadge.tsx —
  // sizing belongs to the primitive, spacing belongs to the parent.
  betaBadgeOffset: {
    marginLeft: 6,
  },
});
