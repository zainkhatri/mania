import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { haptics } from '../utils/haptics';

const { width } = Dimensions.get('window');

interface CustomCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

export default function CustomCalendar({ selectedDate, onSelectDate, onClose }: CustomCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate.getMonth());
  const [currentYear, setCurrentYear] = useState(selectedDate.getFullYear());

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(50);
  const monthOpacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    translateY.value = withTiming(0, { duration: 400 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const monthAnimatedStyle = useAnimatedStyle(() => ({
    opacity: monthOpacity.value,
  }));

  const handleClose = () => {
    opacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(50, { duration: 200 });
    setTimeout(() => onClose(), 200);
  };

  const handleDateSelect = (day: number) => {
    haptics.medium();
    const newDate = new Date(currentYear, currentMonth, day);
    onSelectDate(newDate);
    // Add delay before closing so user sees the selection
    setTimeout(() => {
      handleClose();
    }, 300);
  };

  const goToPreviousMonth = () => {
    haptics.light();
    monthOpacity.value = withTiming(0, { duration: 150 }, () => {
      monthOpacity.value = withTiming(1, { duration: 150 });
    });
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    haptics.light();
    monthOpacity.value = withTiming(0, { duration: 150 }, () => {
      monthOpacity.value = withTiming(1, { duration: 150 });
    });
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    // Actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected =
        day === selectedDate.getDate() &&
        currentMonth === selectedDate.getMonth() &&
        currentYear === selectedDate.getFullYear();

      const isToday =
        day === new Date().getDate() &&
        currentMonth === new Date().getMonth() &&
        currentYear === new Date().getFullYear();

      const isFuture = new Date(currentYear, currentMonth, day) > new Date();

      days.push(
        <Pressable
          key={day}
          style={({ pressed }) => [
            styles.dayCell,
            isSelected && styles.selectedDay,
            pressed && !isFuture && styles.dayPressed,
            isFuture && styles.futureDay,
          ]}
          onPress={() => !isFuture && handleDateSelect(day)}
          disabled={isFuture}
        >
          <Text
            style={[
              styles.dayText,
              isSelected && styles.selectedDayText,
              isToday && !isSelected && styles.todayText,
              isFuture && styles.futureDayText,
            ]}
          >
            {day}
          </Text>
        </Pressable>
      );
    }

    return days;
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={handleClose} />

      <Animated.View style={[styles.calendarContainer, animatedStyle]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.monthButton,
              pressed && styles.monthButtonPressed,
            ]}
            onPress={goToPreviousMonth}
          >
            <Text style={styles.arrow}>‹</Text>
          </Pressable>

          <Text style={styles.monthYear}>
            {MONTHS[currentMonth]} {currentYear}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.monthButton,
              pressed && styles.monthButtonPressed,
            ]}
            onPress={goToNextMonth}
          >
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>

        {/* Day labels */}
        <View style={styles.daysRow}>
          {DAYS.map((day) => (
            <View key={day} style={styles.dayLabelCell}>
              <Text style={styles.dayLabel}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <Animated.View style={[styles.calendarGrid, monthAnimatedStyle]}>
          {renderCalendar()}
        </Animated.View>
      </Animated.View>

      {/* Close button - moved outside calendar container */}
      <Animated.View style={[styles.doneButtonContainer, animatedStyle]}>
        <Pressable
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closeButtonPressed,
          ]}
          onPress={handleClose}
        >
          <Text style={styles.closeButtonText}>Done</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  calendarContainer: {
    width: width - 48,
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  monthButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  monthButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ scale: 0.95 }],
  },
  arrow: {
    fontSize: 32,
    fontFamily: 'ZainCustomFont',
    color: '#fff',
  },
  monthYear: {
    fontSize: 20,
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
  },
  daysRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dayLabelCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayLabel: {
    fontSize: 12,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: 240,
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  selectedDay: {
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  futureDay: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 16,
    fontFamily: 'ZainCustomFont',
    color: '#fff',
  },
  selectedDayText: {
    color: '#000',
    fontWeight: '600',
  },
  todayText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  futureDayText: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  doneButtonContainer: {
    width: width - 48,
    marginTop: 16,
  },
  closeButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 100,
    alignItems: 'center',
  },
  closeButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    transform: [{ scale: 0.98 }],
  },
  closeButtonText: {
    fontSize: 16,
    fontFamily: 'TitleFont',
    color: '#000',
    letterSpacing: -0.5,
  },
});
