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
import { saveJournal, updateJournal } from '../../services/journalService';
import LiveJournalCanvas from '../LiveJournalCanvas';

const { width, height } = Dimensions.get('window');

interface CompleteStepProps {
  location: string;
  locationColor: string;
  date: Date;
  images: { uri: string; x: number; y: number; scale: number }[];
  text: string;
  onSave: () => void;
  isEditing?: boolean;
  journalId?: string;
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
  isEditing = false,
  journalId,
}: CompleteStepProps) {
  const navigation = useNavigation();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const [isSaving, setIsSaving] = React.useState(false);

  useEffect(() => {
    // Auto-save immediately
    handleSave();
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handleSave = async () => {
    haptics.heavy();
    setIsSaving(true);

    try {
      const journalData = {
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
          locationShadowColor: locationColor + '40',
        },
      };

      if (isEditing && journalId) {
        await updateJournal(journalId, journalData);
      } else {
        await saveJournal(journalData);
      }

      haptics.success();

      // Smooth fade out and scale down animation
      opacity.value = withTiming(0, { duration: 400 });
      scale.value = withTiming(0.95, { duration: 400 });

      // Navigate to gallery after animation
      setTimeout(() => {
        navigation.navigate('Gallery' as never);
      }, 450);
    } catch (error) {
      haptics.error();
      Alert.alert(
        'Error',
        isEditing
          ? 'Could not update journal. Please try again.'
          : 'Could not save journal. Please try again.'
      );
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.savingContainer, animatedStyle]}>
        <Text style={styles.savingText}>
          {isEditing ? 'Updating your journal...' : 'Saving your journal...'}
        </Text>
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
  savingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  savingText: {
    fontSize: 20,
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
    opacity: 0.8,
  },
});
