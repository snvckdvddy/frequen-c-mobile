import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeScreen, ErrorState } from '../components/ui';
import { NotificationDrawer } from '../components/NotificationDrawer';
import { ArchiveSessionModal } from '../components/ArchiveSessionModal';
import { ManualPanel } from '../components/manual/ManualPanel';
import { useAuth } from '../contexts/AuthContext';
import { useCV } from '../hooks/useCV';
import { useManualMode } from '../hooks/useManualMode';
import { notificationApi, sessionApi } from '../services/api';
import { VoidSurface } from '../design/components';
import type { Session } from '../types';
import PowerRoutingSheet from '../features/power-routing/PowerRoutingSheet';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import { formatModeLabel, getModeBlockColors, tacticalTokens } from '../features/session-v2/theme/tacticalTokens';

interface HomeScreenProps {
  onCreateSession: () => void;
  onJoinSession: () => void;
  onOpenRoom: (sessionId: string) => void;
  onOpenProfile?: () => void;
  onOpenFriends?: () => void;
  onOpenActivityFeed?: () => void;
  onViewAllLibrary?: () => void;
}

function SectionHeader({
  label,
  accent = tacticalTokens.colors.acid,
  actionLabel,
  onAction,
}: {
  label: string;
  accent?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionBar, { backgroundColor: accent }]} />
      <View style={styles.sectionHeaderInline}>
        <View style={styles.sectionLabelRow}>
          <Ionicons name="radio-outline" size={12} color={accent} />
          <View style={{ width: tacticalTokens.spacing.xs }} />
          <TextMono style={[styles.sectionLabel, { color: accent }]}>{label}</TextMono>
        </View>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}
          >
            <TextMono style={styles.sectionActionText}>{actionLabel}</TextMono>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function TextMono({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

function ActionTile({
  label,
  caption,
  icon,
  accent,
  onPress,
}: {
  label: string;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={caption}
      style={({ pressed }) => [
        styles.actionTile,
        { borderColor: accent },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={18} color={accent} />
      <TextMono style={styles.actionTileLabel}>{label}</TextMono>
      <TextMono style={styles.actionTileCaption}>{caption}</TextMono>
    </Pressable>
  );
}

function EmptyActivePatch({
  onCreateSession,
  onJoinSession,
}: {
  onCreateSession: () => void;
  onJoinSession: () => void;
}) {
  return (
    <View style={[styles.roomCard, styles.ghostCard]}>
      <TacticalGridBackground opacity={0.48} />
      <View style={styles.roomCardContent}>
        <TextMono style={styles.ghostEyebrow}>NO LIVE PATCH</TextMono>
        <TextMono style={styles.ghostTitle}>ARM A ROOM TO START TRANSMISSION</TextMono>
        <View style={styles.ghostActions}>
          <Pressable onPress={onCreateSession} accessibilityRole="button" accessibilityLabel="Create a room" style={({ pressed }) => [styles.ghostActionButton, pressed && styles.pressed]}>
            <TextMono style={styles.ghostActionLabel}>CREATE</TextMono>
          </Pressable>
          <Pressable onPress={onJoinSession} accessibilityRole="button" accessibilityLabel="Join a room" style={({ pressed }) => [styles.ghostActionButton, pressed && styles.pressed]}>
            <TextMono style={styles.ghostActionLabel}>JOIN</TextMono>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function ActiveRoomCard({
  room,
  onOpenRoom,
}: {
  room: Session;
  onOpenRoom: (sessionId: string) => void;
}) {
  const modeColors = getModeBlockColors(room.roomMode);

  return (
    <Pressable
      onPress={() => onOpenRoom(room.id)}
      accessibilityRole="button"
      accessibilityLabel={`Open live room ${room.name}`}
      style={({ pressed }) => [styles.roomCard, pressed && styles.pressed]}
    >
      <TacticalGridBackground opacity={0.52} />
      <View style={styles.roomCardContent}>
        <View style={styles.roomCardTop}>
          <View style={styles.roomTitleWrap}>
            <TextMono style={styles.roomEyebrow}>SYS.FREQ // ACTIVE PATCH</TextMono>
            <TextMono style={styles.roomTitle} numberOfLines={1}>{room.name.toUpperCase()}</TextMono>
          </View>
          <View style={[styles.modeBadge, { backgroundColor: modeColors.backgroundColor, borderColor: modeColors.borderColor }]}>
            <TextMono style={[styles.modeBadgeText, { color: modeColors.color }]}>{formatModeLabel(room.roomMode)}</TextMono>
          </View>
        </View>

        <View style={styles.roomNowPlaying}>
          {room.currentTrack?.albumArt ? (
            <Image source={{ uri: room.currentTrack.albumArt }} style={styles.roomArt} />
          ) : (
            <View style={[styles.roomArt, styles.roomArtGhost]}>
              <Ionicons name="radio-outline" size={24} color={tacticalTokens.colors.textMuted} />
            </View>
          )}
          <View style={styles.roomNowPlayingMeta}>
            <TextMono style={styles.trackTitle} numberOfLines={1}>
              {(room.currentTrack?.title || 'NO TRACK PATCHED').toUpperCase()}
            </TextMono>
            <TextMono style={styles.trackArtist} numberOfLines={1}>
              {room.currentTrack?.artist || 'QUEUE // STANDBY'}
            </TextMono>
            <View style={styles.roomMetaRow}>
              <TextMono style={styles.roomMetaText}>{String(room.listeners?.length || 0).padStart(2, '0')} USERS</TextMono>
              <TextMono style={styles.roomMetaDivider}>//</TextMono>
              <TextMono style={styles.roomMetaText}>CODE {room.joinCode.toUpperCase()}</TextMono>
            </View>
          </View>
        </View>

        <View style={styles.roomEnterRail}>
          <TextMono style={styles.roomEnterText}>ENTER ROOM</TextMono>
          <Ionicons name="arrow-forward" size={16} color={tacticalTokens.colors.white} />
        </View>
      </View>
    </Pressable>
  );
}

function ArchiveCard({
  room,
  onPress,
}: {
  room: Session;
  onPress: () => void;
}) {
  const modeColors = getModeBlockColors(room.roomMode);
  const timeLabel = formatRelativeStamp(room.endedAt || room.createdAt);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open archive preview for ${room.name}`}
      style={({ pressed }) => [styles.archiveCard, pressed && styles.pressed]}
    >
      <TextMono style={styles.archiveIndex}>{room.joinCode.toUpperCase()}</TextMono>
      <TextMono style={styles.archiveTitle} numberOfLines={1}>{room.name.toUpperCase()}</TextMono>
      <TextMono style={styles.archiveMeta} numberOfLines={1}>
        {(room.genre || 'MIXED').toUpperCase()}
      </TextMono>
      <View style={styles.archiveFooter}>
        <View style={[styles.archiveModeChip, { borderColor: modeColors.borderColor }]}>
          <TextMono style={[styles.archiveModeText, { color: modeColors.borderColor }]}>
            {formatModeLabel(room.roomMode)}
          </TextMono>
        </View>
        <TextMono style={styles.archiveStamp}>{timeLabel}</TextMono>
      </View>
    </Pressable>
  );
}

export function HomeScreen({
  onCreateSession,
  onJoinSession,
  onOpenRoom,
  onOpenProfile,
  onOpenFriends,
  onOpenActivityFeed,
  onViewAllLibrary,
}: HomeScreenProps) {
  const { user } = useAuth();
  const cv = useCV();
  const { readManual } = useManualMode();
  const [myRooms, setMyRooms] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [archivePreview, setArchivePreview] = useState<Session | null>(null);
  const [powerRoutingOpen, setPowerRoutingOpen] = useState(false);

  const fetchMyRooms = useCallback(async () => {
    try {
      const { sessions } = await sessionApi.myRooms();
      setMyRooms(sessions);
      setError(null);
    } catch (err) {
      setMyRooms([]);
      setError('ENTRY BUS OFFLINE // USING LOCAL SHELL');
    }
  }, []);

  useEffect(() => {
    fetchMyRooms();
    const interval = setInterval(fetchMyRooms, 15000);
    return () => clearInterval(interval);
  }, [fetchMyRooms]);

  useEffect(() => {
    const fetchUnread = () => {
      notificationApi.unreadCount()
        .then((res) => setUnreadCount(res.count ?? 0))
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMyRooms();
    setRefreshing(false);
  }, [fetchMyRooms]);

  const liveRoom = useMemo(() => myRooms.find((room) => room.isLive), [myRooms]);
  const archiveRooms = useMemo(() => myRooms.filter((room) => !room.isLive), [myRooms]);

  const utilityActions = [
    { key: 'create', label: 'CREATE', caption: 'Arm a new room', icon: 'add-circle-outline' as const, accent: tacticalTokens.colors.orange, onPress: onCreateSession },
    { key: 'join', label: 'JOIN', caption: 'Patch into signal', icon: 'git-network-outline' as const, accent: tacticalTokens.colors.ice, onPress: onJoinSession },
    ...(onOpenFriends ? [{ key: 'friends', label: 'FRIENDS', caption: 'View roster', icon: 'people-outline' as const, accent: tacticalTokens.colors.acid, onPress: onOpenFriends }] : []),
    ...(onOpenActivityFeed ? [{ key: 'activity', label: 'ACTIVITY', caption: 'Check relay log', icon: 'pulse-outline' as const, accent: tacticalTokens.colors.white, onPress: onOpenActivityFeed }] : []),
  ];

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
        <View style={styles.screen}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <TacticalGridBackground opacity={0.58} />
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={(
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={tacticalTokens.colors.acid}
              />
            )}
          >
            <View style={styles.topBar}>
              <View style={styles.headerTextWrap}>
                <TextMono style={styles.eyebrow}>SYS.FREQ // ENTRY BUS</TextMono>
                <TextMono style={styles.headerTitle}>HOME GRID</TextMono>
                <TextMono style={styles.headerSubtitle}>
                  {user?.username ? `${user.username.toUpperCase()} ONLINE` : 'PATCH READY'}
                </TextMono>
              </View>
              <View style={styles.topActions}>
                <Pressable
                  onPress={() => setPowerRoutingOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Open voltage panel"
                  style={({ pressed }) => [styles.cvPill, pressed && styles.pressed]}
                >
                  <Ionicons name="flash-outline" size={15} color={tacticalTokens.colors.ice} />
                  <TextMono style={styles.cvPillText}>{String(cv.balance).padStart(3, '0')}V</TextMono>
                </Pressable>
                <Pressable
                  onPress={() => setShowNotifications(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Open notifications"
                  style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                >
                  <Ionicons name="notifications-outline" size={18} color={tacticalTokens.colors.white} />
                  {unreadCount > 0 ? (
                    <View style={styles.iconBadge}>
                      <TextMono style={styles.iconBadgeText}>{Math.min(unreadCount, 9)}</TextMono>
                    </View>
                  ) : null}
                </Pressable>
                <Pressable
                  onPress={onOpenProfile}
                  accessibilityRole="button"
                  accessibilityLabel="Open profile"
                  style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                >
                  <Ionicons name="person-outline" size={18} color={tacticalTokens.colors.white} />
                </Pressable>
              </View>
            </View>

            {error ? (
              <View style={styles.errorWrap}>
                <ErrorState variant="banner" message={error} onRetry={fetchMyRooms} />
              </View>
            ) : null}

            {readManual ? (
              <ManualPanel
                contextLabel="ENTRY BUS"
                style={styles.manualRailHero}
                title="START HERE"
                subtitle="Use the entry grid to host, join, or reopen a room without guessing what each action does."
                steps={[
                  { tag: 'HOST', text: 'CREATE opens the room builder and then drops you straight into Session V2.' },
                  { tag: 'JOIN', text: 'JOIN is the guest path. Use it when someone else already has a room running.' },
                  { tag: 'LIVE', text: 'ACTIVE PATCH reopens the room already attached to your profile if one is running.' },
                ]}
                callouts={[
                  { label: 'CREATE', value: 'Host path into a new room.' },
                  { label: 'JOIN', value: 'Guest path with code or QR.' },
                  { label: 'CV', value: 'Voltage is a special layer, not basic queueing.' },
                ]}
                footer="Profile > Read the Manual keeps these helper rails visible."
              />
            ) : null}

            <View style={styles.actionGrid}>
              {utilityActions.map((action) => (
                <ActionTile
                  key={action.key}
                  label={action.label}
                  caption={action.caption}
                  icon={action.icon}
                  accent={action.accent}
                  onPress={action.onPress}
                />
              ))}
            </View>

            <SectionHeader label="ACTIVE PATCH" accent={tacticalTokens.colors.acid} />
            {liveRoom ? (
              <ActiveRoomCard room={liveRoom} onOpenRoom={onOpenRoom} />
            ) : (
              <EmptyActivePatch onCreateSession={onCreateSession} onJoinSession={onJoinSession} />
            )}

            <SectionHeader
              label="RECENT FLIGHT CASES"
              accent={tacticalTokens.colors.ice}
              actionLabel={archiveRooms.length > 0 && onViewAllLibrary ? 'VIEW ALL' : undefined}
              onAction={archiveRooms.length > 0 ? onViewAllLibrary : undefined}
            />

            {archiveRooms.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.archiveRail}
              >
                {archiveRooms.slice(0, 8).map((room) => (
                  <ArchiveCard
                    key={room.id}
                    room={room}
                    onPress={() => setArchivePreview(room)}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={[styles.roomCard, styles.ghostCard]}>
                <TacticalGridBackground opacity={0.36} />
                <View style={styles.roomCardContent}>
                  <TextMono style={styles.ghostEyebrow}>ARCHIVE BUS // EMPTY</TextMono>
                  <TextMono style={styles.ghostTitle}>NO FLIGHT CASES RECORDED YET</TextMono>
                </View>
              </View>
            )}

            <View style={{ height: 120 }} />
          </ScrollView>
        </View>
      </VoidSurface>

      <NotificationDrawer
        visible={showNotifications}
        onClose={() => {
          setShowNotifications(false);
          notificationApi.unreadCount()
            .then((res) => setUnreadCount(res.count ?? 0))
            .catch(() => {});
        }}
        onOpenRoom={onOpenRoom}
      />
      <ArchiveSessionModal session={archivePreview} onClose={() => setArchivePreview(null)} />
      <PowerRoutingSheet
        visible={powerRoutingOpen}
        voltage={cv.balance}
        onClose={() => setPowerRoutingOpen(false)}
        onExecute={() => setPowerRoutingOpen(false)}
      />
    </SafeScreen>
  );
}

function formatRelativeStamp(dateStr?: string): string {
  if (!dateStr) return 'NO STAMP';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'JUST NOW';
  if (hours < 24) return `${hours}H AGO`;
  const days = Math.floor(hours / 24);
  return `${days}D AGO`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingTop: tacticalTokens.spacing.xl,
    paddingBottom: tacticalTokens.spacing.xxxl,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.xl,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.acid,
    letterSpacing: 2,
  },
  headerTitle: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.hero,
    color: tacticalTokens.colors.white,
  },
  headerSubtitle: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1.1,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.sm,
  },
  cvPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: tacticalTokens.spacing.md,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.ice,
    backgroundColor: '#081218',
  },
  cvPillText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.4,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
  },
  iconBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tacticalTokens.colors.orange,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.orange,
  },
  iconBadgeText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.void,
  },
  errorWrap: {
    marginBottom: tacticalTokens.spacing.lg,
  },
  manualRailHero: {
    marginTop: -tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.xl,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.xl,
  },
  actionTile: {
    flexBasis: '48%',
    minHeight: 92,
    borderWidth: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.9)',
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.md,
  },
  actionTileLabel: {
    marginTop: tacticalTokens.spacing.sm,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
  },
  actionTileCaption: {
    marginTop: 4,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    lineHeight: 18,
  },
  sectionHeader: {
    marginBottom: tacticalTokens.spacing.md,
  },
  sectionBar: {
    width: 56,
    height: 2,
    marginBottom: tacticalTokens.spacing.sm,
  },
  sectionHeaderBody: {
    display: 'none',
  },
  sectionHeaderTextWrap: {
    display: 'none',
  },
  sectionLabelShell: {
    display: 'none',
  },
  sectionHeaderInline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tacticalTokens.spacing.sm,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionDot: {
    display: 'none',
  },
  sectionLabelWrap: {
    display: 'none',
  },
  sectionLabel: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    letterSpacing: 2,
  },
  sectionAction: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
  },
  sectionActionText: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1.1,
  },
  roomCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    marginBottom: tacticalTokens.spacing.xl,
  },
  roomCardContent: {
    padding: tacticalTokens.spacing.lg,
  },
  roomCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.lg,
  },
  roomTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  roomEyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.6,
  },
  roomTitle: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.title,
    color: tacticalTokens.colors.white,
  },
  modeBadge: {
    minWidth: 96,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: tacticalTokens.spacing.sm,
  },
  modeBadgeText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    letterSpacing: 1.4,
  },
  roomNowPlaying: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.md,
    marginBottom: tacticalTokens.spacing.lg,
  },
  roomArt: {
    width: 76,
    height: 76,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matteRaised,
  },
  roomArtGhost: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomNowPlayingMeta: {
    flex: 1,
    minWidth: 0,
  },
  trackTitle: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
  },
  trackArtist: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.ice,
    letterSpacing: 0.8,
  },
  roomMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: tacticalTokens.spacing.sm,
  },
  roomMetaText: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
  },
  roomMetaDivider: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
  },
  roomEnterRail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tacticalTokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tacticalTokens.colors.borderGhost,
  },
  roomEnterText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.white,
    letterSpacing: 1.5,
  },
  ghostCard: {
    borderColor: tacticalTokens.colors.borderGhost,
  },
  ghostEyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.5,
  },
  ghostTitle: {
    marginTop: tacticalTokens.spacing.sm,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.title,
    color: tacticalTokens.colors.textMuted,
  },
  ghostActions: {
    flexDirection: 'row',
    gap: tacticalTokens.spacing.sm,
    marginTop: tacticalTokens.spacing.lg,
  },
  ghostActionButton: {
    minWidth: 112,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    paddingHorizontal: tacticalTokens.spacing.md,
  },
  ghostActionLabel: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.white,
    letterSpacing: 1.4,
  },
  archiveRail: {
    gap: tacticalTokens.spacing.sm,
    paddingBottom: tacticalTokens.spacing.sm,
  },
  archiveCard: {
    width: 188,
    minHeight: 170,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(8, 8, 8, 0.94)',
    padding: tacticalTokens.spacing.md,
  },
  archiveIndex: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.3,
  },
  archiveTitle: {
    marginTop: tacticalTokens.spacing.sm,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
  },
  archiveMeta: {
    marginTop: 4,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    lineHeight: 18,
  },
  archiveFooter: {
    marginTop: 'auto',
    paddingTop: tacticalTokens.spacing.md,
    gap: tacticalTokens.spacing.sm,
  },
  archiveModeChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    backgroundColor: tacticalTokens.colors.void,
    paddingHorizontal: tacticalTokens.spacing.xs + 2,
    paddingVertical: 4,
  },
  archiveModeText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    letterSpacing: 1.2,
  },
  archiveStamp: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.1,
  },
  pressed: {
    opacity: 0.84,
  },
});

export default HomeScreen;
