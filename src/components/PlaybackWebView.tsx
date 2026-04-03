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
  hidden: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'hidden',
  },
  webview: {
    width: 1,
    height: 1,
  },
});
