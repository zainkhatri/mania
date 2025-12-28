import React from 'react';
import { View, StyleSheet } from 'react-native';

interface MinimalFriendsIconProps {
  size?: number;
  color?: string;
}

export default function MinimalFriendsIcon({ size = 32, color = '#fff' }: MinimalFriendsIconProps) {
  const circleSize = size * 0.38;
  const spacing = size * 0.06;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Top circle */}
      <View
        style={[
          styles.circle,
          {
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            backgroundColor: color,
            marginBottom: spacing,
          },
        ]}
      />

      {/* Bottom row - 2 circles */}
      <View style={styles.bottomRow}>
        <View
          style={[
            styles.circle,
            {
              width: circleSize,
              height: circleSize,
              borderRadius: circleSize / 2,
              backgroundColor: color,
            },
          ]}
        />
        <View style={{ width: spacing }} />
        <View
          style={[
            styles.circle,
            {
              width: circleSize,
              height: circleSize,
              borderRadius: circleSize / 2,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circle: {
    opacity: 0.9,
  },
});
