/**
 * DesignSystemTestScreen
 * ─────────────────────────────────────────────────────────────
 * Visual test bed for every Layer 1-3 component.
 * Scroll through to verify materials, rack structure, and data displays
 * render correctly on-device.
 *
 * Access: Add to nav stack or import directly for testing.
 * Remove from production builds.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Dimensions,
} from 'react-native';

// Layer 1: Materials
import { VoidSurface } from '../design/components/materials/VoidSurface';
import { ChromeSurface } from '../design/components/materials/ChromeSurface';
import { BrushedSteelSurface } from '../design/components/materials/BrushedSteelSurface';
import { GlassPanel } from '../design/components/materials/GlassPanel';
import { EmissionGlow } from '../design/components/materials/EmissionGlow';

// Layer 2: Rack
import { RackRails } from '../design/components/rack/RackRails';
import { ModuleFaceplate } from '../design/components/rack/ModuleFaceplate';

// Layer 3: Display
import { LEDReadout } from '../design/components/display/LEDReadout';
import { VUMeter } from '../design/components/display/VUMeter';
import { PatchPoint } from '../design/components/display/PatchPoint';

// Tokens
import { palette } from '../design/tokens/materials';
import { fontFamily, fontSize, letterSpacing } from '../design/tokens/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Section Header ──────────────────────────────────────────

function SectionHeader({ title, layer }: { title: string; layer: string }) {
  return (
    <View style={sectionStyles.header}>
      <Text style={sectionStyles.layer}>{layer}</Text>
      <Text style={sectionStyles.title}>{title}</Text>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 12,
  },
  layer: {
    fontFamily: fontFamily.label,
    fontSize: fontSize.xs,
    letterSpacing: letterSpacing.widest,
    textTransform: 'uppercase',
    color: palette.ice,
    fontWeight: '700',
    marginBottom: 4,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: palette.white,
    letterSpacing: letterSpacing.tight,
  },
});

// ─── Material Swatch ─────────────────────────────────────────

function MaterialSwatch({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={swatchStyles.container}>
      <View style={swatchStyles.swatch}>{children}</View>
      <Text style={swatchStyles.label}>{label}</Text>
    </View>
  );
}

const swatchStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: (SCREEN_WIDTH - 60) / 3,
    marginBottom: 16,
  },
  swatch: {
    width: 90,
    height: 90,
    borderRadius: 2,
    overflow: 'hidden',
  },
  label: {
    fontFamily: fontFamily.label,
    fontSize: fontSize.xs,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase',
    color: palette.textSecondary,
    fontWeight: '700',
    marginTop: 8,
  },
});

// ─── Main Screen ─────────────────────────────────────────────

export function DesignSystemTestScreen() {
  const [vuLevel, setVuLevel] = useState(0.65);

  return (
    <VoidSurface style={styles.root}>
      {/* Rack rails behind everything */}
      <RackRails />

      <SafeAreaView style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Title ──────────────────────────── */}
          <View style={styles.titleBlock}>
            <Text style={styles.titleLabel}>FREQUEN-C</Text>
            <Text style={styles.titleMain}>Design System</Text>
            <Text style={styles.titleSub}>Rack × Chrome — Component Test</Text>
          </View>

          {/* ═══════════════════════════════════════
              LAYER 1: MATERIALS
              ═══════════════════════════════════════ */}
          <SectionHeader layer="LAYER 1" title="Materials" />

          <View style={styles.swatchGrid}>
            <MaterialSwatch label="Void">
              <VoidSurface style={styles.flex} />
            </MaterialSwatch>

            <MaterialSwatch label="Chrome">
              <ChromeSurface style={styles.flex} />
            </MaterialSwatch>

            <MaterialSwatch label="Brushed Steel">
              <BrushedSteelSurface style={styles.flex} />
            </MaterialSwatch>
          </View>

          <View style={styles.swatchGrid}>
            <MaterialSwatch label="Glass">
              <GlassPanel style={styles.flex} borderRadius={2}>
                <View style={styles.glassInner} />
              </GlassPanel>
            </MaterialSwatch>

            <MaterialSwatch label="Ice Emission">
              <View style={styles.emissionSwatch}>
                <EmissionGlow variant="ice" bloom>
                  <View style={[styles.emissionDot, { backgroundColor: palette.ice }]} />
                </EmissionGlow>
              </View>
            </MaterialSwatch>

            <MaterialSwatch label="Amber Emission">
              <View style={styles.emissionSwatch}>
                <EmissionGlow variant="amber" bloom>
                  <View style={[styles.emissionDot, { backgroundColor: palette.amber }]} />
                </EmissionGlow>
              </View>
            </MaterialSwatch>
          </View>

          {/* Full-width material demos */}
          <View style={styles.fullWidthDemo}>
            <Text style={styles.demoLabel}>CHROME SURFACE — FULL WIDTH</Text>
            <ChromeSurface style={styles.fullWidthSurface}>
              <View style={styles.chromeDemoContent}>
                <Text style={styles.chromeDemoText}>Metallic Gradient — 7 stops</Text>
              </View>
            </ChromeSurface>
          </View>

          <View style={styles.fullWidthDemo}>
            <Text style={styles.demoLabel}>GLASS PANEL — OVERLAY</Text>
            <BrushedSteelSurface style={styles.glassDemoBg}>
              <GlassPanel style={styles.glassDemoPanel} borderRadius={4}>
                <View style={styles.glassDemoContent}>
                  <Text style={styles.glassDemoText}>
                    Frosted glass over brushed steel
                  </Text>
                </View>
              </GlassPanel>
            </BrushedSteelSurface>
          </View>

          {/* ═══════════════════════════════════════
              LAYER 2: RACK STRUCTURE
              ═══════════════════════════════════════ */}
          <SectionHeader layer="LAYER 2" title="Rack Structure" />

          {/* Module Faceplate — Steel */}
          <View style={styles.moduleDemo}>
            <ModuleFaceplate label="NOW PLAYING" screws material="steel">
              <View style={styles.modulePlaceholder}>
                <Text style={styles.placeholderText}>
                  Steel faceplate with screws + label
                </Text>
              </View>
            </ModuleFaceplate>
          </View>

          {/* Module Faceplate — Chrome */}
          <View style={styles.moduleDemo}>
            <ModuleFaceplate label="QUEUE" material="chrome">
              <View style={styles.modulePlaceholder}>
                <Text style={styles.placeholderText}>
                  Chrome faceplate — interactive surface
                </Text>
              </View>
            </ModuleFaceplate>
          </View>

          {/* Module Faceplate — No label, no screws */}
          <View style={styles.moduleDemo}>
            <ModuleFaceplate material="steel">
              <View style={styles.modulePlaceholder}>
                <Text style={styles.placeholderText}>
                  Minimal module — no label, no screws
                </Text>
              </View>
            </ModuleFaceplate>
          </View>

          {/* ═══════════════════════════════════════
              LAYER 3: DATA DISPLAY
              ═══════════════════════════════════════ */}
          <SectionHeader layer="LAYER 3" title="Data Display" />

          {/* LED Readouts */}
          <View style={styles.moduleDemo}>
            <ModuleFaceplate label="LED READOUTS" screws>
              <View style={styles.readoutRow}>
                <LEDReadout value="03:42" label="ELAPSED" size="md" />
                <LEDReadout value="-05:18" label="REMAINING" size="md" />
              </View>

              <View style={[styles.readoutRow, { marginTop: 16 }]}>
                <LEDReadout value="128" label="BPM" size="lg" variant="ice" />
                <LEDReadout value="-3.2" label="dB" size="lg" variant="amber" />
              </View>

              <View style={[styles.readoutRow, { marginTop: 16 }]}>
                <LEDReadout value="44.1kHz" label="SAMPLE RATE" size="sm" />
                <LEDReadout value="320kbps" label="BITRATE" size="sm" />
                <LEDReadout value="STEREO" label="CHANNELS" size="sm" />
              </View>
            </ModuleFaceplate>
          </View>

          {/* VU Meters */}
          <View style={styles.moduleDemo}>
            <ModuleFaceplate label="VU METERS">
              <Text style={styles.subLabel}>Horizontal — tap to cycle levels</Text>
              <Pressable
                onPress={() => setVuLevel((prev) => (prev + 0.15) % 1.05)}
                style={styles.vuContainer}
              >
                <VUMeter level={vuLevel} size={SCREEN_WIDTH - 80} thickness={10} />
              </Pressable>
              <Text style={styles.vuValue}>
                Level: {Math.round(vuLevel * 100)}%
              </Text>

              <Text style={[styles.subLabel, { marginTop: 20 }]}>
                Vertical — fixed levels
              </Text>
              <View style={styles.vuVerticalRow}>
                <View style={styles.vuVerticalItem}>
                  <VUMeter level={0.3} direction="vertical" size={80} thickness={8} />
                  <Text style={styles.vuVerticalLabel}>L</Text>
                </View>
                <View style={styles.vuVerticalItem}>
                  <VUMeter level={0.65} direction="vertical" size={80} thickness={8} />
                  <Text style={styles.vuVerticalLabel}>R</Text>
                </View>
                <View style={styles.vuVerticalItem}>
                  <VUMeter level={0.85} direction="vertical" size={80} thickness={8} />
                  <Text style={styles.vuVerticalLabel}>M</Text>
                </View>
                <View style={styles.vuVerticalItem}>
                  <VUMeter level={0.95} direction="vertical" size={80} thickness={8} />
                  <Text style={styles.vuVerticalLabel}>!</Text>
                </View>
              </View>
            </ModuleFaceplate>
          </View>

          {/* Patch Points */}
          <View style={styles.moduleDemo}>
            <ModuleFaceplate label="PATCH POINTS" screws>
              <Text style={styles.subLabel}>Connection states</Text>
              <View style={styles.patchRow}>
                <View style={styles.patchItem}>
                  <PatchPoint state="inactive" size={12} />
                  <Text style={styles.patchLabel}>Inactive</Text>
                </View>
                <View style={styles.patchItem}>
                  <PatchPoint state="active" variant="ice" size={12} />
                  <Text style={styles.patchLabel}>Active</Text>
                </View>
                <View style={styles.patchItem}>
                  <PatchPoint state="flowing" variant="ice" size={12} />
                  <Text style={styles.patchLabel}>Flowing</Text>
                </View>
                <View style={styles.patchItem}>
                  <PatchPoint state="active" variant="amber" size={12} />
                  <Text style={styles.patchLabel}>Amber</Text>
                </View>
                <View style={styles.patchItem}>
                  <PatchPoint state="flowing" variant="amber" size={12} />
                  <Text style={styles.patchLabel}>Flow/Amb</Text>
                </View>
              </View>

              <Text style={[styles.subLabel, { marginTop: 20 }]}>Size variants</Text>
              <View style={styles.patchRow}>
                <View style={styles.patchItem}>
                  <PatchPoint state="active" size={6} />
                  <Text style={styles.patchLabel}>6px</Text>
                </View>
                <View style={styles.patchItem}>
                  <PatchPoint state="active" size={8} />
                  <Text style={styles.patchLabel}>8px</Text>
                </View>
                <View style={styles.patchItem}>
                  <PatchPoint state="active" size={12} />
                  <Text style={styles.patchLabel}>12px</Text>
                </View>
                <View style={styles.patchItem}>
                  <PatchPoint state="active" size={16} />
                  <Text style={styles.patchLabel}>16px</Text>
                </View>
                <View style={styles.patchItem}>
                  <PatchPoint state="flowing" size={20} />
                  <Text style={styles.patchLabel}>20px</Text>
                </View>
              </View>
            </ModuleFaceplate>
          </View>

          {/* ═══════════════════════════════════════
              COMPOSITE: Assembled Module
              ═══════════════════════════════════════ */}
          <SectionHeader layer="COMPOSITE" title="Assembled Preview" />

          <View style={styles.moduleDemo}>
            <ModuleFaceplate label="TRACK MODULE" screws material="steel">
              <View style={styles.trackModule}>
                {/* Track info row */}
                <View style={styles.trackInfo}>
                  {/* Album art placeholder */}
                  <ChromeSurface style={styles.albumArt}>
                    <View style={styles.albumArtInner}>
                      <Text style={styles.albumArtText}>ART</Text>
                    </View>
                  </ChromeSurface>

                  <View style={styles.trackMeta}>
                    <Text style={styles.trackTitle}>Midnight Protocol</Text>
                    <Text style={styles.trackArtist}>Frequen-C</Text>
                    <View style={styles.trackDataRow}>
                      <LEDReadout value="03:42" size="sm" />
                      <PatchPoint state="flowing" variant="ice" size={8} />
                      <LEDReadout value="128 BPM" size="sm" variant="amber" />
                    </View>
                  </View>
                </View>

                {/* VU bar */}
                <View style={styles.trackVu}>
                  <VUMeter level={0.72} size={SCREEN_WIDTH - 80} thickness={6} />
                </View>
              </View>
            </ModuleFaceplate>
          </View>

          {/* Bottom padding */}
          <View style={{ height: 60 }} />
        </ScrollView>
      </SafeAreaView>
    </VoidSurface>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Title block
  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  titleLabel: {
    fontFamily: fontFamily.label,
    fontSize: fontSize.xs,
    letterSpacing: letterSpacing.widest,
    textTransform: 'uppercase',
    color: palette.ice,
    fontWeight: '700',
    marginBottom: 4,
  },
  titleMain: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize['5xl'],
    color: palette.white,
    letterSpacing: letterSpacing.tight,
  },
  titleSub: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: palette.textSecondary,
    marginTop: 4,
  },

  // Swatch grid
  swatchGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  glassInner: {
    flex: 1,
  },
  emissionSwatch: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.void,
    borderRadius: 2,
  },
  emissionDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },

  // Full-width demos
  fullWidthDemo: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  demoLabel: {
    fontFamily: fontFamily.label,
    fontSize: fontSize.xs,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase',
    color: palette.textDim,
    fontWeight: '700',
    marginBottom: 8,
  },
  fullWidthSurface: {
    height: 60,
    borderRadius: 2,
  },
  chromeDemoContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chromeDemoText: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: palette.textSecondary,
  },
  glassDemoBg: {
    height: 100,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  glassDemoPanel: {
    width: '80%',
    height: 60,
  },
  glassDemoContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassDemoText: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: palette.white,
  },

  // Module demos
  moduleDemo: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  modulePlaceholder: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: palette.textSecondary,
  },

  // LED Readouts
  readoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },

  // VU Meters
  subLabel: {
    fontFamily: fontFamily.label,
    fontSize: fontSize.xs,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase',
    color: palette.textDim,
    fontWeight: '700',
    marginBottom: 10,
  },
  vuContainer: {
    alignItems: 'center',
  },
  vuValue: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: palette.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  vuVerticalRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  vuVerticalItem: {
    alignItems: 'center',
  },
  vuVerticalLabel: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: palette.textDim,
    marginTop: 6,
  },

  // Patch Points
  patchRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  patchItem: {
    alignItems: 'center',
  },
  patchLabel: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: palette.textDim,
    marginTop: 8,
  },

  // Composite track module
  trackModule: {},
  trackInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  albumArt: {
    width: 64,
    height: 64,
    borderRadius: 2,
  },
  albumArtInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumArtText: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: palette.textDim,
  },
  trackMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  trackTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: palette.white,
    letterSpacing: letterSpacing.tight,
  },
  trackArtist: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.textSecondary,
    marginTop: 2,
  },
  trackDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  trackVu: {
    marginTop: 12,
    alignItems: 'center',
  },
});
