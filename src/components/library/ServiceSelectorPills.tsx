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
import { getTierForSource } from '../../services/adapters/musicServiceAdapter';

// ─── Service metadata ───────────────────────────────────────

interface ServiceMeta {
  key: TrackSource;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// Order matches the tier model in musicServiceAdapter.ts:
//   Tier 1 — universal (Apple Music, SoundCloud)
//   Tier 2 — subscription required (Tidal)
//   Tier 3 — restricted beta, Spotify Feb 2026 Dev Mode 5-user cap
// Pills render left→right in this order so the most-universal source
// is the first thing the user sees and the restricted source is last.
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
        // Tier 3 (Spotify, as of Feb 2026) is treated as "Restricted Beta".
        // The badge stays visible whether the user is connected or not so the
        // scarcity is communicated up front, not after a failed connect.
        const tier = getTierForSource(svc.key);
        const isRestrictedBeta = tier === 3;

        // Build accessibility label: include the tier framing for screen-reader
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
            {isRestrictedBeta && (
              <View style={styles.tierBadge}>
                <Text style={styles.tierBadgeText}>BETA</Text>
              </View>
            )}
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
  // ─── Tier 3 "Restricted Beta" badge ────────────────────────
  // Compact orange-tinted chip rendered inline at the trailing edge of
  // the Spotify pill. Uses the primary accent (orange) at low alpha so
  // it reads as a tag, not a CTA, and stays legible against both the
  // resting steel background and the active orange-tinted background.
  tierBadge: {
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: withAlpha(palette.orange, 0.18),
    borderWidth: 1,
    borderColor: withAlpha(palette.orange, 0.45),
  },
  tierBadgeText: {
    color: palette.orange,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
