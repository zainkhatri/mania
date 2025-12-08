import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { haptics } from '../../utils/haptics';

const { width, height } = Dimensions.get('window');

interface DateStepProps {
  date: Date;
  onChangeDate: (date: Date) => void;
  onNext: () => void;
  onBack: () => void;
}

const formatDate = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return date.toLocaleDateString('en-US', options).toUpperCase();
};

export default function DateStep({ date, onChangeDate, onNext, onBack }: DateStepProps) {
  const scale = useSharedValue(0);
  const dateScale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Smooth entrance
    opacity.value = withTiming(1, { duration: 400 });
    scale.value = withTiming(1, { duration: 400 });
    dateScale.value = withTiming(1, { duration: 400 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const dateAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dateScale.value }],
  }));

  const handleNext = () => {
    // Subtle scale animation
    haptics.heavy();
    dateScale.value = withTiming(0.95, { duration: 100 }, () => {
      dateScale.value = withTiming(1, { duration: 100 });
    });

    setTimeout(() => {
      onNext();
    }, 200);
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, animatedStyle]}>
        <Text style={styles.instruction}>When did this happen?</Text>

        {/* Date Display */}
        <Animated.View style={dateAnimatedStyle}>
          <TouchableOpacity
            style={styles.dateContainer}
            onPress={() => {
              haptics.light();
              // Could open date picker here
            }}
          >
            <Text style={styles.dateText}>{formatDate(date)}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Quick Date Options */}
        <View style={styles.quickOptions}>
          <TouchableOpacity
            style={styles.quickButton}
            onPress={() => {
              haptics.light();
              onChangeDate(new Date());
            }}
          >
            <Text style={styles.quickButtonText}>Today</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickButton}
            onPress={() => {
              haptics.light();
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              onChangeDate(yesterday);
            }}
          >
            <Text style={styles.quickButtonText}>Yesterday</Text>
          </TouchableOpacity>
        </View>

        {/* Continue Button */}
        <TouchableOpacity style={styles.continueButton} onPress={handleNext}>
          <Text style={styles.continueText}>Continue →</Text>
        </TouchableOpacity>

        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: width - 48,
    alignItems: 'center',
  },
  instruction: {
    fontSize: 28,
    fontFamily: 'ZainCustomFont',
    color: '#fff',
    marginBottom: 60,
    textAlign: 'center',
    fontWeight: '300',
  },
  dateContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 40,
    paddingVertical: 30,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 40,
  },
  dateText: {
    fontSize: 24,
    fontFamily: 'ZainCustomFont',
    color: '#fff',
    textAlign: 'center',
  },
  quickOptions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 60,
  },
  quickButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  quickButtonText: {
    fontSize: 16,
    fontFamily: 'ZainCustomFont',
    color: '#fff',
  },
  continueButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 48,
    paddingVertical: 20,
    borderRadius: 30,
    marginBottom: 20,
  },
  continueText: {
    fontSize: 20,
    fontFamily: 'ZainCustomFont',
    color: '#000',
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 12,
  },
  backText: {
    fontSize: 16,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
