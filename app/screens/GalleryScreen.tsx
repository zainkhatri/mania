import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  Pressable,
  Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Journal, getUserJournals } from '../services/journalService';
import LiveJournalCanvas from '../components/LiveJournalCanvas';
import EmptyGalleryState from '../components/EmptyGalleryState';
import BottomNav from '../components/BottomNav';
import { haptics } from '../utils/haptics';
import { scaleFont, scaleHeight, scaleWidth, scaleSize } from '../utils/responsive';

const { width } = Dimensions.get('window');
const isIPad = width >= 768;

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return 'TH';
    switch (day % 10) {
      case 1: return 'ST';
      case 2: return 'ND';
      case 3: return 'RD';
      default: return 'TH';
    }
  };

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  let dateStr = date.toLocaleDateString('en-US', options);
  const day = date.getDate();
  const ordinal = getOrdinalSuffix(day);
  dateStr = dateStr.replace(/(\d+)/, `$1${ordinal}`);
  return dateStr.toUpperCase();
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Calculate day cell size to fit 7 columns
const DAY_CELL_WIDTH = (width - scaleWidth(48)) / 7;
const DAY_CELL_HEIGHT = DAY_CELL_WIDTH * (2620 / 1860); // Journal aspect ratio
const PREVIEW_SIZE = DAY_CELL_WIDTH * 0.85;
const PREVIEW_HEIGHT = PREVIEW_SIZE * (2620 / 1860);

interface MonthData {
  year: number;
  month: number;
  monthYear: string;
  days: Array<{ date: Date | null; journal: Journal | null }>;
}

export default function GalleryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJournals = async () => {
    try {
      setLoading(true);
      const data = await getUserJournals();
      setJournals(data);
    } catch (error) {
      console.error('Error loading journals:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadJournals();
    }, [])
  );

  // Create a map of journals by date for quick lookup
  const journalsByDate = useMemo(() => {
    const map: { [key: string]: Journal } = {};
    journals.forEach((journal) => {
      const date = new Date(journal.date);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      map[key] = journal;
    });
    return map;
  }, [journals]);

  // Generate all months that have journals, plus current month
  const monthsToShow = useMemo(() => {
    const months: MonthData[] = [];
    const today = new Date();
    const monthsSet = new Set<string>();

    // Add current month
    monthsSet.add(`${today.getFullYear()}-${today.getMonth()}`);

    // Add months with journals
    journals.forEach((journal) => {
      const date = new Date(journal.date);
      monthsSet.add(`${date.getFullYear()}-${date.getMonth()}`);
    });

    // Convert to array and sort descending (most recent first)
    const sortedMonths = Array.from(monthsSet)
      .sort((a, b) => {
        const [yearA, monthA] = a.split('-').map(Number);
        const [yearB, monthB] = b.split('-').map(Number);
        if (yearA !== yearB) return yearB - yearA;
        return monthB - monthA;
      });

    // Generate calendar data for each month
    sortedMonths.forEach((monthKey) => {
      const [year, month] = monthKey.split('-').map(Number);

      // First day of month
      const firstDay = new Date(year, month, 1);
      const firstDayOfWeek = firstDay.getDay();

      // Last day of month
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();

      // Build calendar grid
      const days: Array<{ date: Date | null; journal: Journal | null }> = [];

      // Add empty cells for days before month starts
      for (let i = 0; i < firstDayOfWeek; i++) {
        days.push({ date: null, journal: null });
      }

      // Add days of month
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const key = `${year}-${month}-${day}`;
        const journal = journalsByDate[key] || null;
        days.push({ date, journal });
      }

      const monthYear = new Date(year, month).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
      });

      months.push({ year, month, monthYear, days });
    });

    return months;
  }, [journals, journalsByDate]);

  const handleDayPress = (journal: Journal | null) => {
    if (journal) {
      haptics.medium();
      (navigation as any).navigate('JournalDetail', { journalId: journal.id });
    }
  };

  const renderDay = ({ date, journal }: { date: Date | null; journal: Journal | null }, index: number) => {
    if (!date) {
      return <View style={styles.emptyDay} key={`empty-${index}`} />;
    }

    const dayNumber = date.getDate();
    const isToday = new Date().toDateString() === date.toDateString();

    return (
      <Pressable
        key={date.toISOString()}
        onPress={() => handleDayPress(journal)}
        style={({ pressed }) => [
          styles.dayCell,
          journal && styles.dayCellWithJournal,
          isToday && styles.todayCell,
          pressed && styles.dayCellPressed,
        ]}
      >
        {journal ? (
          <View style={styles.journalPreviewContainer}>
            <View style={styles.miniPreview}>
              <LiveJournalCanvas
                date={formatDate(journal.date)}
                location={journal.location || ''}
                text={journal.text}
                locationColor={journal.colors.locationColor}
                images={journal.images}
                canvasWidth={PREVIEW_SIZE}
                canvasHeight={PREVIEW_HEIGHT}
              />
            </View>
            <Text style={styles.dayNumber}>{dayNumber}</Text>
          </View>
        ) : (
          <Text style={[styles.dayNumber, styles.dayNumberEmpty]}>{dayNumber}</Text>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Title */}
      <View style={[styles.titleContainer, { top: insets.top + scaleHeight(20) }]}>
        <Text style={styles.title}>What have you written?</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top + scaleHeight(80), paddingBottom: scaleHeight(120) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Weekday Headers (sticky would be nice but keeping it simple) */}
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((day) => (
            <View key={day} style={styles.weekdayCell}>
              <Text style={styles.weekdayText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Scrollable months - most recent first */}
        {monthsToShow.map((monthData) => (
          <View key={`${monthData.year}-${monthData.month}`} style={styles.monthSection}>
            {/* Month label */}
            <Text style={styles.monthLabel}>{monthData.monthYear.toUpperCase()}</Text>

            {/* Calendar Grid for this month */}
            <View style={styles.calendarGrid}>
              {monthData.days.map((dayData, index) => (
                <View key={index} style={styles.dayWrapper}>
                  {renderDay(dayData, index)}
                </View>
              ))}
            </View>
          </View>
        ))}

        {journals.length === 0 && !loading && <EmptyGalleryState />}
      </ScrollView>

      <BottomNav activeTab="gallery" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: scaleWidth(24),
    zIndex: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: scaleFont(32),
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -1,
    textAlign: 'center',
  },
  contentContainer: {
    paddingHorizontal: scaleWidth(24),
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: scaleHeight(12),
  },
  weekdayCell: {
    width: DAY_CELL_WIDTH,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: scaleFont(11),
    fontFamily: 'TitleFont',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: -0.3,
  },
  monthSection: {
    marginBottom: scaleHeight(32),
  },
  monthLabel: {
    fontSize: scaleFont(16),
    fontFamily: 'TitleFont',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: -0.5,
    marginBottom: scaleHeight(12),
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayWrapper: {
    width: DAY_CELL_WIDTH,
    height: DAY_CELL_HEIGHT,
    padding: scaleSize(1),
  },
  dayCell: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: scaleSize(4),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: scaleSize(1),
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  dayCellWithJournal: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  todayCell: {
    borderColor: '#007AFF',
    borderWidth: scaleSize(2),
  },
  dayCellPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    transform: [{ scale: 0.95 }],
  },
  emptyDay: {
    flex: 1,
  },
  journalPreviewContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  miniPreview: {
    width: PREVIEW_SIZE,
    height: PREVIEW_HEIGHT,
    borderRadius: scaleSize(2),
    overflow: 'hidden',
  },
  dayNumber: {
    fontSize: scaleFont(10),
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.3,
    marginTop: scaleHeight(2),
  },
  dayNumberEmpty: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
});
