import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { haptics } from '../../utils/haptics';
import { saveJournal } from '../../services/journalService';
import LiveJournalCanvas from '../LiveJournalCanvas';

const { width, height } = Dimensions.get('window');

interface CompleteStepProps {
  location: string;
  locationColor: string;
  date: Date;
  images: { uri: string; x: number; y: number; scale: number }[];
  text: string;
  onSave: () => void;
}

const formatDate = (date: Date): string => {
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

export default function CompleteStep({
  location,
  locationColor,
  date,
  images,
  text,
  onSave,
}: CompleteStepProps) {
  const navigation = useNavigation();
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const [isSaving, setIsSaving] = React.useState(false);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 400 });
    scale.value = withTiming(1, { duration: 400 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handleSave = async () => {
    haptics.heavy();
    setIsSaving(true);

    // Celebration animation
    scale.value = withSequence(
      withTiming(1.05, { duration: 150 }),
      withSpring(1)
    );

    try {
      await saveJournal({
        date: date.toISOString(),
        location: location.trim(),
        text: text,
        images: images.map(img => ({
          uri: img.uri,
          x: img.x,
          y: img.y,
          scale: img.scale,
        })),
        colors: {
          locationColor: locationColor,
          locationShadowColor: locationColor + '40', // Add transparency for shadow
        },
      });

      haptics.success();

      // Show success
      Alert.alert(
        '✓ Journal Saved',
        'Your entry has been saved successfully!',
        [
          {
            text: 'Done',
            onPress: () => {
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      haptics.error();
      Alert.alert('Error', 'Could not save journal. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Animated.View style={animatedStyle}>
        <Text style={styles.instruction}>Your journal is ready!</Text>

        {/* Preview */}
        <View style={styles.previewContainer}>
          <LiveJournalCanvas
            date={formatDate(date)}
            location={location}
            text={text}
            locationColor={locationColor}
            images={images}
          />
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          {location && (
            <>
              <Text style={styles.summaryLabel}>Location</Text>
              <Text style={styles.summaryValue}>{location}</Text>
            </>
          )}

          <Text style={styles.summaryLabel}>Date</Text>
          <Text style={styles.summaryValue}>{formatDate(date)}</Text>

          <Text style={styles.summaryLabel}>Words</Text>
          <Text style={styles.summaryValue}>
            {text.split(' ').filter(w => w.length > 0).length}
          </Text>

          {images.length > 0 && (
            <>
              <Text style={styles.summaryLabel}>Photos</Text>
              <Text style={styles.summaryValue}>{images.length}</Text>
            </>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.disabledButton]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveText}>
            {isSaving ? 'Saving...' : '✓ Save Journal'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 120,
    paddingBottom: 60,
  },
  instruction: {
    fontSize: 32,
    fontFamily: 'TitleFont',
    color: '#fff',
    marginBottom: 40,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  previewContainer: {
    marginBottom: 40,
  },
  summary: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 40,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: 'ZainCustomFont',
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    borderRadius: 100,
    alignItems: 'center',
  },
  saveText: {
    fontSize: 18,
    fontFamily: 'ZainCustomFont',
    color: '#000',
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
