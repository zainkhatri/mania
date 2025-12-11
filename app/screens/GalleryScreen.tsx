import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  SectionList,
  StyleSheet,
  StatusBar,
  Text,
  Pressable,
  Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Journal, getUserJournals } from '../services/journalService';
import LiveJournalCanvas from '../components/LiveJournalCanvas';
import EmptyGalleryState from '../components/EmptyGalleryState';
import { haptics } from '../utils/haptics';

interface JournalSection {
  title: string;
  data: Journal[][];
}

const { width } = Dimensions.get('window');
const PAGE_WIDTH = (width - 48) / 2; // Two pages side by side with gap
const PAGE_HEIGHT = PAGE_WIDTH * (2620 / 1860);

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

export default function GalleryScreen() {
  const navigation = useNavigation();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJournals = async () => {
    try {
      setLoading(true);
      const data = await getUserJournals();
      const sorted = data.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setJournals(sorted);
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

  // Group journals by month and year
  const sections = useMemo(() => {
    const grouped: { [key: string]: Journal[] } = {};

    journals.forEach((journal) => {
      const date = new Date(journal.date);
      const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      grouped[monthYear].push(journal);
    });

    // Convert to sections array and chunk into pairs for 2-column layout
    const sectionsArray: JournalSection[] = Object.keys(grouped).map((monthYear) => {
      const journalsInMonth = grouped[monthYear];
      const pairs: Journal[][] = [];

      for (let i = 0; i < journalsInMonth.length; i += 2) {
        pairs.push(journalsInMonth.slice(i, i + 2));
      }

      return {
        title: monthYear,
        data: pairs,
      };
    });

    return sectionsArray;
  }, [journals]);

  const handlePagePress = (journal: Journal) => {
    haptics.medium();
    navigation.navigate('JournalDetail' as never, { journalId: journal.id } as never);
  };

  const handleBack = () => {
    haptics.light();
    navigation.goBack();
  };

  const renderRow = ({ item }: { item: Journal[] }) => (
    <View style={styles.row}>
      {item.map((journal) => (
        <Pressable
          key={journal.id}
          onPress={() => handlePagePress(journal)}
          style={({ pressed }) => [
            styles.pageContainer,
            pressed && styles.pagePressed,
          ]}
        >
          <View style={styles.page}>
            <LiveJournalCanvas
              date={formatDate(journal.date)}
              location={journal.location || ''}
              text={journal.text}
              locationColor={journal.colors.locationColor}
              images={journal.images}
              canvasWidth={PAGE_WIDTH}
              canvasHeight={PAGE_HEIGHT}
            />
          </View>
        </Pressable>
      ))}
    </View>
  );

  const renderSectionHeader = ({ section }: { section: JournalSection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  const renderEmpty = () => {
    if (loading) return null;
    return <EmptyGalleryState />;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Your Journals</Text>
        {journals.length > 0 && (
          <Text style={styles.count}>{journals.length}</Text>
        )}
      </View>

      {/* Journal Pages */}
      <SectionList
        sections={sections}
        renderItem={renderRow}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item, index) => `row-${index}`}
        contentContainerStyle={[
          styles.contentContainer,
          sections.length === 0 && styles.emptyContainer,
        ]}
        ListEmptyComponent={renderEmpty}
        refreshing={loading}
        onRefresh={loadJournals}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: StatusBar.currentHeight || 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -1,
    marginLeft: 8,
  },
  count: {
    fontSize: 16,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.6)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  pageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    width: PAGE_WIDTH,
  },
  page: {
    backgroundColor: '#f5f2e9',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  pagePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
