/**
 * SignalPathBreadcrumb — Navigation chain displayed as connected signal nodes.
 *
 * Shows current navigation path as: [Patch Bay] ─── [Room: Name] ─── [Queue]
 * Each node is tappable. Connection lines pulse subtly.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Text } from './Text';
import { colors } from '../../theme/colors';

export interface BreadcrumbNode {
  id: string;
  label: string;
  onPress?: () => void;
}

interface SignalPathBreadcrumbProps {
  nodes: BreadcrumbNode[];
}

export function SignalPathBreadcrumb({ nodes }: SignalPathBreadcrumbProps) {
  if (nodes.length === 0) return null;

  return (
    <View style={styles.container}>
      {nodes.map((node, index) => (
        <React.Fragment key={node.id}>
          {/* Connection line between nodes */}
          {index > 0 && (
            <View style={styles.connector}>
              <Svg width={20} height={2}>
                <Line
                  x1={0} y1={1} x2={20} y2={1}
                  stroke={colors.chrome.border}
                  strokeWidth={1}
                  strokeDasharray="3,3"
                />
              </Svg>
            </View>
          )}
          {/* Node */}
          <TouchableOpacity
            onPress={node.onPress}
            disabled={!node.onPress}
            style={[
              styles.node,
              index === nodes.length - 1 && styles.activeNode,
            ]}
          >
            <Text
              variant="labelSmall"
              color={index === nodes.length - 1 ? colors.action.primary : colors.chrome.text}
              style={styles.nodeText}
            >
              {node.label}
            </Text>
          </TouchableOpacity>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: colors.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.chrome.border,
  },
  connector: {
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  node: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  activeNode: {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  nodeText: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
});

export default SignalPathBreadcrumb;
