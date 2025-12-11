import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { haptics } from '../../utils/haptics';
import CustomCalendar from '../CustomCalendar';

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
  return date.toLocaleDateString('en-US', options);
};

const getShortDate = (date: Date): { month: string; day: string; year: string } => {
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = date.getDate().toString();
  const year = date.getFullYear().toString();
  return { month, day, year };
};

export default function DateStep({ date, onChangeDate, onNext, onBack }: DateStepProps) {
  const [showPicker, setShowPicker] = useState(false);
  const titleOpacity = useSharedValue(0);
  const titleTranslate = useSharedValue(30);
  const dateOpacity = useSharedValue(0);
  const dateScale = useSharedValue(0.9);
  const optionsOpacity = useSharedValue(0);
  const optionsTranslate = useSharedValue(20);
  const buttonOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(0.95);
  const backOpacity = useSharedValue(0);

  useEffect(() => {
    // Staggered entrance animation
    titleOpacity.value = withTiming(1, { duration: 600 });
    titleTranslate.value = withSpring(0, { damping: 20, stiffness: 90 });

    dateOpacity.value = withDelay(150, withTiming(1, { duration: 600 }));
    dateScale.value = withDelay(150, withSpring(1, { damping: 15, stiffness: 100 }));

    optionsOpacity.value = withDelay(300, withTiming(1, { duration: 600 }));
    optionsTranslate.value = withDelay(300, withSpring(0, { damping: 20, stiffness: 90 }));

    buttonOpacity.value = withDelay(450, withTiming(1, { duration: 600 }));
    buttonScale.value = withDelay(450, withSpring(1, { damping: 15, stiffness: 100 }));

    backOpacity.value = withDelay(600, withTiming(1, { duration: 600 }));
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslate.value }],
  }));

  const dateStyle = useAnimatedStyle(() => ({
    opacity: dateOpacity.value,
    transform: [{ scale: dateScale.value }],
  }));

  const optionsStyle = useAnimatedStyle(() => ({
    opacity: optionsOpacity.value,
    transform: [{ translateY: optionsTranslate.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ scale: buttonScale.value }],
  }));

  const backStyle = useAnimatedStyle(() => ({
    opacity: backOpacity.value,
  }));

  const handleNext = () => {
    haptics.medium();
    buttonScale.value = withTiming(0.95, { duration: 100 }, () => {
      buttonScale.value = withSpring(1, { damping: 10 });
    });
    setTimeout(() => onNext(), 150);
  };

  const handleDateChange = (newDate: Date) => {
    haptics.light();
    dateScale.value = withTiming(0.95, { duration: 100 }, () => {
      dateScale.value = withSpring(1, { damping: 10 });
    });
    onChangeDate(newDate);
  };

  const handleBack = () => {
    haptics.light();
    onBack();
  };

  const handleDateCardPress = () => {
    haptics.medium();
    setShowPicker(true);
  };

  const handleCalendarSelect = (selectedDate: Date) => {
    handleDateChange(selectedDate);
    setShowPicker(false);
  };

  const shortDate = getShortDate(date);

  return (
    <View style={styles.container}>
      {/* Title */}
      <Animated.View style={[styles.titleContainer, titleStyle]}>
        <Text style={styles.title}>When did this happen?</Text>
      </Animated.View>

      {/* Date Display - Large and Centered */}
      <Animated.View style={[styles.dateSection, dateStyle]}>
        <Pressable
          style={({ pressed }) => [
            styles.dateCard,
            pressed && styles.dateCardPressed,
          ]}
          onPress={handleDateCardPress}
        >
          <Text style={styles.dateMonth}>{shortDate.month}</Text>
          <Text style={styles.dateDay}>{shortDate.day}</Text>
          <Text style={styles.dateYear}>{shortDate.year}</Text>
        </Pressable>
        <Text style={styles.dateFull}>{formatDate(date)}</Text>
      </Animated.View>

      {/* Quick Options */}
      <Animated.View style={[styles.quickOptions, optionsStyle]}>
        <Pressable
          style={({ pressed }) => [
            styles.quickButton,
            pressed && styles.quickButtonPressed,
          ]}
          onPress={() => handleDateChange(new Date())}
        >
          <Text style={styles.quickButtonText}>Today</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.quickButton,
            pressed && styles.quickButtonPressed,
          ]}
          onPress={() => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            handleDateChange(yesterday);
          }}
        >
          <Text style={styles.quickButtonText}>Yesterday</Text>
        </Pressable>
      </Animated.View>

      {/* Continue Button */}
      <Animated.View style={[styles.buttonContainer, buttonStyle]}>
        <Pressable
          style={({ pressed }) => [
            styles.continueButton,
            pressed && styles.continueButtonPressed,
          ]}
          onPress={handleNext}
        >
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>
      </Animated.View>

      {/* Back Button */}
      <Animated.View style={[styles.backButtonContainer, backStyle]}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          onPress={handleBack}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </Animated.View>

      {/* Custom Calendar */}
      {showPicker && (
        <CustomCalendar
          selectedDate={date}
          onSelectDate={handleCalendarSelect}
          onClose={() => {
            haptics.light();
            setShowPicker(false);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  titleContainer: {
    marginBottom: 60,
  },
  title: {
    fontSize: 32,
    fontFamily: 'TitleFont',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  dateSection: {
    alignItems: 'center',
    marginBottom: 60,
  },
  dateCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingVertical: 32,
    paddingHorizontal: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  dateCardPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    transform: [{ scale: 0.98 }],
  },
  dateMonth: {
    fontSize: 14,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 2,
    marginBottom: 8,
  },
  dateDay: {
    fontSize: 72,
    fontFamily: 'TitleFont',
    color: '#fff',
    lineHeight: 72,
    marginBottom: 4,
  },
  dateYear: {
    fontSize: 16,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  dateFull: {
    fontSize: 16,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
  quickOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 60,
  },
  quickButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  quickButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ scale: 0.97 }],
  },
  quickButtonText: {
    fontSize: 15,
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
  },
  continueButton: {
    backgroundColor: '#fff',
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: 'center',
  },
  continueButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    transform: [{ scale: 0.98 }],
  },
  continueText: {
    fontSize: 17,
    fontFamily: 'TitleFont',
    color: '#000',
    letterSpacing: -0.5,
  },
  backButtonContainer: {
    position: 'absolute',
    bottom: 60,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: 'TitleFont',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: -0.5,
  },
});
