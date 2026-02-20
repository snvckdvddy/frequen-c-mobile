/**
 * Error Boundary
 *
 * Catches JS errors in the component tree and shows
 * a recovery screen instead of a white crash.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Button } from './ui';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface Props {
  children: ReactNode;
  /** Optional fallback component */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console in dev — future: send to crash reporting
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text variant="displaySmall" color={colors.text.muted} align="center" style={styles.icon}>
            \u26A0
          </Text>
          <Text variant="h2" color={colors.text.primary} align="center">
            Something went wrong
          </Text>
          <Text variant="body" color={colors.text.secondary} align="center" style={styles.message}>
            The app hit an unexpected error. Tap below to try again.
          </Text>
          {__DEV__ && this.state.error && (
            <View style={styles.errorBox}>
              <Text variant="mono" color={colors.action.destructive} style={styles.errorText}>
                {this.state.error.message}
              </Text>
            </View>
          )}
          <Button
            title="Try Again"
            onPress={this.handleReset}
            variant="primary"
            size="lg"
            style={styles.retryBtn}
          />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg.primary,
    paddingHorizontal: spacing.screenPadding,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  message: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  errorBox: {
    backgroundColor: colors.bg.elevated,
    borderRadius: spacing.radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: colors.action.destructive + '30',
  },
  errorText: {
    fontSize: 12,
  },
  retryBtn: {
    minWidth: 160,
  },
});

export default ErrorBoundary;
