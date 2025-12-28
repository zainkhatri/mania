import React from 'react';
import { View, StyleSheet } from 'react-native';

interface MinimalFeedIconProps {
  size?: number;
  color?: string;
}

export default function MinimalFeedIcon({ size = 32, color = '#fff' }: MinimalFeedIconProps) {
  const circleSize = size * 0.45;
  const overlap = size * 0.15;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={styles.avatarsContainer}>
        {/* First avatar circle */}
        <View
          style={[
            styles.avatar,
            {
              width: circleSize,
              height: circleSize,
              borderRadius: circleSize / 2,
              backgroundColor: color,
              zIndex: 2,
            },
          ]}
        />
        
        {/* Second avatar circle - overlapping */}
        <View
          style={[
            styles.avatar,
            {
              width: circleSize,
              height: circleSize,
              borderRadius: circleSize / 2,
              backgroundColor: color,
              marginLeft: -overlap,
              opacity: 0.75,
              zIndex: 1,
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
  avatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.3)',
  },
});

