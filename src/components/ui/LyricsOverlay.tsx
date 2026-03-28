import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Image,
    Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Track } from '../../types';
import api from '../../services/api';
import TacticalGridBackground from '../../features/session-v2/components/TacticalGridBackground';
import { tacticalTokens } from '../../features/session-v2/theme/tacticalTokens';

interface LyricsOverlayProps {
    track: Track | undefined;
    visible: boolean;
    onClose: () => void;
}

export function LyricsOverlay({ track, visible, onClose }: LyricsOverlayProps) {
    const [lyrics, setLyrics] = useState<string | null>(null);
    const [thumbnail, setThumbnail] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!visible || !track) return;
        let didCancel = false;

        setLoading(true);
        setLyrics(null);
        setThumbnail(null);
        setError(null);

        api.integrations.fetchLyrics(track.title, track.artist)
            .then((res) => {
                if (!didCancel) {
                    setLyrics(res.lyrics);
                    setThumbnail(res.thumbnail || null);
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (!didCancel) {
                    setError(err.message || 'Failed to fetch lyrics.');
                    setLoading(false);
                }
            });

        return () => {
            didCancel = true;
        };
    }, [visible, track]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
            accessibilityViewIsModal
        >
            <View style={styles.overlay}>
                <Pressable
                    style={styles.backdrop}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close lyrics overlay"
                />
                <View style={styles.container}>
                    <TacticalGridBackground opacity={0.84} />
                    <View style={styles.content}>
                        <View style={styles.header}>
                            <View style={styles.headerTitleContainer}>
                                <Text style={styles.headerSys}>SYS.FREQ // LYRIC BUS</Text>
                                <Text style={styles.headerTitle} numberOfLines={1}>
                                    {track ? track.title.toUpperCase() : 'LYRICS'}
                                </Text>
                                <Text style={styles.headerArtist} numberOfLines={1}>
                                    {track ? track.artist : 'NO ACTIVE TRACK'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={onClose}
                                style={styles.closeBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Close lyrics"
                            >
                                <Ionicons name="close" size={18} color={tacticalTokens.colors.white} />
                            </TouchableOpacity>
                        </View>

                        {loading ? (
                            <View style={styles.center}>
                                <ActivityIndicator size="large" color={tacticalTokens.colors.orange} />
                                <Text style={styles.loadingText}>FETCHING LYRICS...</Text>
                            </View>
                        ) : error ? (
                            <View style={styles.center}>
                                <Ionicons name="alert-circle-outline" size={42} color={tacticalTokens.colors.orange} />
                                <Text style={styles.errorText}>{error.toUpperCase()}</Text>
                            </View>
                        ) : (
                            <ScrollView contentContainerStyle={styles.scrollContent} indicatorStyle="white">
                                {thumbnail ? (
                                    <View style={styles.thumbnailFrame}>
                                        <Image source={{ uri: thumbnail }} style={styles.thumbnail} accessible={false} />
                                    </View>
                                ) : null}
                                <View style={styles.lyricCard}>
                                    <Text style={styles.lyricLabel}>LIVE TRANSCRIPT</Text>
                                    <Text style={styles.lyricsText}>{lyrics || 'NO LYRICS AVAILABLE.'}</Text>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: tacticalTokens.spacing.xl,
        backgroundColor: 'rgba(0, 0, 0, 0.68)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    container: {
        height: '86%',
        borderWidth: 1,
        borderColor: tacticalTokens.colors.border,
        backgroundColor: tacticalTokens.colors.void,
        overflow: 'hidden',
    },
    content: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: tacticalTokens.spacing.xl,
        paddingTop: tacticalTokens.spacing.lg,
        paddingBottom: tacticalTokens.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: tacticalTokens.colors.border,
        backgroundColor: 'rgba(4, 4, 4, 0.9)',
    },
    closeBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: tacticalTokens.colors.border,
        backgroundColor: tacticalTokens.colors.void,
    },
    headerTitleContainer: {
        flex: 1,
        minWidth: 0,
        paddingRight: tacticalTokens.spacing.md,
    },
    headerSys: {
        fontFamily: tacticalTokens.fonts.mono,
        fontSize: tacticalTokens.fontSize.sys,
        color: tacticalTokens.colors.textDim,
        letterSpacing: 1.8,
    },
    headerTitle: {
        marginTop: 2,
        color: tacticalTokens.colors.white,
        fontFamily: tacticalTokens.fonts.display,
        fontSize: tacticalTokens.fontSize.display,
        textTransform: 'uppercase',
    },
    headerArtist: {
        color: tacticalTokens.colors.ice,
        fontFamily: tacticalTokens.fonts.mono,
        fontSize: tacticalTokens.fontSize.small,
        letterSpacing: 0.6,
        marginTop: 2,
    },
    scrollContent: {
        paddingHorizontal: tacticalTokens.spacing.xl,
        paddingTop: tacticalTokens.spacing.lg,
        paddingBottom: tacticalTokens.spacing.xl * 2,
        alignItems: 'stretch',
    },
    thumbnailFrame: {
        alignSelf: 'center',
        width: 220,
        height: 220,
        padding: 8,
        marginBottom: tacticalTokens.spacing.lg,
        borderWidth: 1,
        borderColor: tacticalTokens.colors.border,
        backgroundColor: tacticalTokens.colors.matte,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
        opacity: 0.9,
    },
    lyricCard: {
        borderWidth: 1,
        borderColor: tacticalTokens.colors.border,
        backgroundColor: 'rgba(6, 6, 6, 0.92)',
        paddingHorizontal: tacticalTokens.spacing.lg,
        paddingVertical: tacticalTokens.spacing.lg,
    },
    lyricLabel: {
        fontFamily: tacticalTokens.fonts.monoBold,
        fontSize: tacticalTokens.fontSize.sys,
        color: tacticalTokens.colors.textDim,
        letterSpacing: 1.6,
        marginBottom: tacticalTokens.spacing.md,
    },
    lyricsText: {
        color: tacticalTokens.colors.white,
        fontFamily: tacticalTokens.fonts.mono,
        fontSize: tacticalTokens.fontSize.body + 1,
        lineHeight: 30,
        letterSpacing: 0.3,
        textAlign: 'left',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: tacticalTokens.spacing.xl,
    },
    loadingText: {
        color: tacticalTokens.colors.textSoft,
        marginTop: tacticalTokens.spacing.sm,
        fontFamily: tacticalTokens.fonts.mono,
        fontSize: tacticalTokens.fontSize.sys,
        letterSpacing: 1.4,
    },
    errorText: {
        color: tacticalTokens.colors.orange,
        marginTop: tacticalTokens.spacing.md,
        textAlign: 'center',
        fontFamily: tacticalTokens.fonts.monoBold,
        fontSize: tacticalTokens.fontSize.small,
        letterSpacing: 1,
    },
});

