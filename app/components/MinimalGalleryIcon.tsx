import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

interface MinimalGalleryIconProps {
  size?: number;
  color?: string;
}

export default function MinimalGalleryIcon({ size = 32, color = '#fff' }: MinimalGalleryIconProps) {
  const scale1 = useSharedValue(1);
  const scale2 = useSharedValue(1);
  const scale3 = useSharedValue(1);

  useEffect(() => {
    // Staggered pulse animation
    scale1.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    scale2.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 500 }),
        withTiming(1.1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    scale3.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(1.1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle1 = useAnimatedStyle(() => ({
    transform: [{ scale: scale1.value }],
  }));

  const animatedStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: scale2.value }],
  }));

  const animatedStyle3 = useAnimatedStyle(() => ({
    transform: [{ scale: scale3.value }],
  }));

  const squareSize = size * 0.35;
  const gap = size * 0.08;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Top row - 2 squares */}
      <View style={styles.row}>
        <Animated.View
          style={[
            styles.square,
            {
              width: squareSize,
              height: squareSize,
              backgroundColor: color,
              borderRadius: size * 0.08,
            },
            animatedStyle1,
          ]}
        />
        <View style={{ width: gap }} />
        <Animated.View
          style={[
            styles.square,
            {
              width: squareSize,
              height: squareSize,
              backgroundColor: color,
              borderRadius: size * 0.08,
            },
            animatedStyle2,
          ]}
        />
      </View>

      <View style={{ height: gap }} />

      {/* Bottom row - 2 squares */}
      <View style={styles.row}>
        <Animated.View
          style={[
            styles.square,
            {
              width: squareSize,
              height: squareSize,
              backgroundColor: color,
              borderRadius: size * 0.08,
            },
            animatedStyle3,
          ]}
        />
        <View style={{ width: gap }} />
        <Animated.View
          style={[
            styles.square,
            {
              width: squareSize,
              height: squareSize,
              backgroundColor: color,
              borderRadius: size * 0.08,
            },
            animatedStyle1,
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
  row: {
    flexDirection: 'row',
  },
  square: {
    opacity: 0.9,
  },
});

