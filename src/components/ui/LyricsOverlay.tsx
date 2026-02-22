import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Track } from '../../types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import api from '../../services/api';

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
            .then(res => {
                if (!didCancel) {
                    setLyrics(res.lyrics);
                    setThumbnail(res.thumbnail || null);
                    setLoading(false);
                }
            })
            .catch(err => {
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
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15, 17, 21, 0.85)' }]} />

                {/* ─── Header ────────────────────────────────────────────── */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close lyrics">
                        <Ionicons name="chevron-down" size={28} color={colors.text.primary} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            {track ? track.title : 'LYRICS'}
                        </Text>
                        <Text style={styles.headerArtist} numberOfLines={1}>
                            {track ? track.artist : ''}
                        </Text>
                    </View>
                </View>

                {/* ─── Content ───────────────────────────────────────────── */}
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={colors.action.primary} />
                        <Text style={styles.loadingText}>Fetching lyrics...</Text>
                    </View>
                ) : error ? (
                    <View style={styles.center}>
                        <Ionicons name="alert-circle-outline" size={48} color={colors.action.destructive} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.scrollContent} indicatorStyle="white">
                        {thumbnail && (
                            <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
                        )}
                        <Text style={styles.lyricsText}>{lyrics}</Text>
                    </ScrollView>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(15, 17, 21, 0.95)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: spacing.xl,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.chrome.border,
        backgroundColor: 'rgba(15, 17, 21, 0.8)',
        zIndex: 10,
    },
    closeBtn: {
        padding: spacing.xs,
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
        paddingRight: 36, // Counter-balance closeBtn
    },
    headerTitle: {
        color: colors.text.primary,
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 1,
    },
    headerArtist: {
        color: colors.chrome.text,
        fontSize: 10,
        letterSpacing: 0.5,
        marginTop: 2,
    },
    scrollContent: {
        padding: spacing.xl,
        paddingBottom: spacing.xl * 2,
        alignItems: 'center',
    },
    thumbnail: {
        width: 250,
        height: 250,
        borderRadius: 8,
        marginBottom: spacing.xl,
        opacity: 0.8,
    },
    lyricsText: {
        color: colors.text.primary,
        fontSize: 20,
        lineHeight: 34,
        fontWeight: '500',
        textAlign: 'center',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    loadingText: {
        color: colors.chrome.text,
        marginTop: spacing.sm,
        fontSize: 12,
        letterSpacing: 1,
    },
    errorText: {
        color: colors.action.destructive,
        marginTop: spacing.md,
        textAlign: 'center',
        fontSize: 14,
    },
});
