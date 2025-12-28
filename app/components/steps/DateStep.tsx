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
import BottomNav from '../BottomNav';
import { scaleFont, scaleHeight, scaleWidth, scaleSize } from '../../utils/responsive';

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

  // Animate elements when calendar opens/closes
  useEffect(() => {
    if (showPicker) {
      // Fade out and scale down date elements when calendar opens
      dateOpacity.value = withTiming(0, { duration: 300 });
      dateScale.value = withTiming(0.9, { duration: 300 });
      optionsOpacity.value = withTiming(0, { duration: 300 });
      optionsTranslate.value = withTiming(-20, { duration: 300 });
      buttonOpacity.value = withTiming(0, { duration: 300 });
      backOpacity.value = withTiming(0, { duration: 300 });
    } else {
      // Fade in and scale up date elements when calendar closes
      dateOpacity.value = withDelay(100, withTiming(1, { duration: 400 }));
      dateScale.value = withDelay(100, withSpring(1, { damping: 15, stiffness: 100 }));
      optionsOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
      optionsTranslate.value = withDelay(200, withSpring(0, { damping: 20, stiffness: 90 }));
      buttonOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
      backOpacity.value = withDelay(350, withTiming(1, { duration: 400 }));
    }
  }, [showPicker]);

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
  
  // Check if date is today
  const isToday = () => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if date is yesterday
  const isYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date.toDateString() === yesterday.toDateString();
  };

  return (
    <View style={styles.container}>
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
            isToday() && styles.quickButtonSelected,
            pressed && styles.quickButtonPressed,
          ]}
          onPress={() => handleDateChange(new Date())}
        >
          <Text style={[styles.quickButtonText, isToday() && styles.quickButtonTextSelected]}>
            Today
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.quickButton,
            isYesterday() && styles.quickButtonSelected,
            pressed && styles.quickButtonPressed,
          ]}
          onPress={() => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            handleDateChange(yesterday);
          }}
        >
          <Text style={[styles.quickButtonText, isYesterday() && styles.quickButtonTextSelected]}>
            Yesterday
          </Text>
        </Pressable>
      </Animated.View>

      {/* Navigation Buttons */}
      {!showPicker && (
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
      )}

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

      {/* Bottom Navigation Bar */}
      <BottomNav activeTab="journal" />
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
    paddingVertical: scaleHeight(32),
    paddingHorizontal: scaleWidth(48),
    borderRadius: scaleSize(24),
    borderWidth: scaleSize(1),
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: scaleHeight(20),
  },
  dateCardPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    transform: [{ scale: 0.98 }],
  },
  dateMonth: {
    fontSize: scaleFont(14),
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 2,
    marginBottom: scaleHeight(8),
  },
  dateDay: {
    fontSize: scaleFont(72),
    fontFamily: 'TitleFont',
    color: '#fff',
    lineHeight: scaleFont(72),
    marginBottom: scaleHeight(4),
  },
  dateYear: {
    fontSize: scaleFont(16),
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  dateFull: {
    fontSize: scaleFont(16),
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
  quickOptions: {
    flexDirection: 'row',
    gap: scaleWidth(12),
    marginBottom: scaleHeight(32),
  },
  quickButton: {
    paddingHorizontal: scaleWidth(28),
    paddingVertical: scaleHeight(14),
    borderRadius: scaleSize(100),
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: scaleSize(1),
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  quickButtonSelected: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  quickButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ scale: 0.97 }],
  },
  quickButtonText: {
    fontSize: scaleFont(15),
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
  },
  quickButtonTextSelected: {
    color: '#000',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: scaleWidth(320),
  },
  continueButton: {
    width: '100%',
    backgroundColor: '#fff',
    paddingVertical: scaleHeight(18),
    borderRadius: scaleSize(100),
    alignItems: 'center',
  },
  continueButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    transform: [{ scale: 0.98 }],
  },
  continueText: {
    fontSize: scaleFont(17),
    fontFamily: 'TitleFont',
    color: '#000',
    letterSpacing: -0.5,
  },
});
