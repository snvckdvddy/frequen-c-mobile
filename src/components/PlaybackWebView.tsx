/**
 * PlaybackWebView — Hidden WebView hosting Spotify Web Playback SDK & MusicKit JS.
 *
 * Mount this component at the app level (GlobalSessionRoomProvider) so it
 * persists across screen navigation. It loads the playback bridge HTML from
 * the backend and connects to the WebViewSDKBackend singleton via postMessage.
 *
 * The WebView is invisible (0x0 px) — audio plays through the device speakers.
 * Communication:
 *   React Native → WebView: postMessage (load, play, pause, seek, stop)
 *   WebView → React Native: onMessage (ready, progress, trackEnd, error)
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { Audio } from 'expo-av';
import { webViewSDKBackend } from '../services/playback/WebViewBridge';
import { SOCKET_URL } from '../services/config';
import { logger } from '../utils/logger';

interface PlaybackWebViewProps {
  /** Only render when the current user is the session host */
  enabled: boolean;
}

/**
 * The bridge URL points to the backend's inline HTML endpoint that loads
 * both Spotify Web Playback SDK and MusicKit JS. Using SOCKET_URL (base
 * domain without /api) because this is a full HTML page, not a JSON API call.
 */
function getBridgeUrl(): string {
  return `${SOCKET_URL}/api/playback/bridge`;
}

export function PlaybackWebView({ enabled }: PlaybackWebViewProps) {
  const webViewRef = useRef<WebView>(null);

  // Stable callback for sending messages to the WebView
  const postMessage = useCallback((message: string) => {
    webViewRef.current?.postMessage(message);
  }, []);

  // Register/unregister the postMessage function with the WebView SDK backend singleton
  useEffect(() => {
    if (!enabled) return;
    webViewSDKBackend.registerWebView(postMessage);
    return () => {
      webViewSDKBackend.unregisterWebView();
    };
  }, [enabled, postMessage]);

  // Raise the OS audio session for SDK playback. ExpoAvBackend does
  // this for direct-URL tracks, but the WebView path (Spotify / Apple
  // Music / SoundCloud — the primary sources) never did: iOS ran on
  // the default ambient category (silenced by the ring switch, torn
  // down on lock) and Android never requested ducking. Best-effort —
  // a failure here must not block the bridge.
  useEffect(() => {
    if (!enabled) return;
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    }).catch(() => {});
  }, [enabled]);

  // Handle messages FROM the WebView (progress, trackEnd, error, ready)
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    webViewSDKBackend.handleWebViewMessage(event.nativeEvent.data);
  }, []);

  const handleError = useCallback(() => {
    logger.warn('PlaybackWebView', 'WebView failed to load bridge page');
  }, []);

  if (!enabled) return null;

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={webViewRef}
        source={{ uri: getBridgeUrl() }}
        onMessage={handleMessage}
        onError={handleError}
        javaScriptEnabled
        // Allow audio to play without user gesture (critical for SDK playback)
        mediaPlaybackRequiresUserAction={false}
        // iOS: allow inline media playback (no fullscreen takeover)
        allowsInlineMediaPlayback
        // Android: enable mixed content for SDK CDN scripts loaded over HTTPS
        mixedContentMode="compatibility"
        // Prevent the WebView from showing in accessibility tree
        accessible={false}
        // User agent helps SDKs recognize the environment
        applicationNameForUserAgent="FrequenC-PlaybackBridge"
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Position the WebView off-screen instead of clipping it to 0x0.
  // Background: when the parent container is width:0 / height:0 with
  // overflow:hidden, Android's WebView treats the page as
  // non-visible and throttles JavaScript execution (timers run at
  // ~1Hz instead of 60Hz, postMessage queues stall, etc.). Audio
  // playback continues — the OS audio path doesn't depend on
  // visibility — but our SoundCloud Widget polling timer + event
  // dispatches drop messages, producing the "audio plays but UI
  // shows loading spinner forever + auto-advance broken" symptom
  // observed 2026-05-11.
  // Off-screen positioning (top:-10000, left:-10000) keeps the page
  // technically rendered + non-throttled while keeping it
  // visually invisible to the user. Standard pattern for hidden
  // iframes that need their JS to keep running.
  hidden: {
    position: 'absolute',
    top: -10000,
    left: -10000,
    width: 320,
    height: 240,
  },
  webview: {
    flex: 1,
  },
});
