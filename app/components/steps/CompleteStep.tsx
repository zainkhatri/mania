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
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { haptics } from '../../utils/haptics';
import { saveJournal, updateJournal } from '../../services/journalService';
import LiveJournalCanvas from '../LiveJournalCanvas';
import { scaleFont, scaleHeight, scaleWidth, scaleSize, DIMENSIONS } from '../../utils/responsive';
import { PrivacyLevel } from '../../types/models';
import { getStoredUser } from '../../services/authService';
import PrivacySelector from '../PrivacySelector';

const { width, height } = Dimensions.get('window');
const isIPad = width >= 768;

// Calculate canvas size with constraints for iPad - MUST match ImageStep exactly
// ImageStep uses: (width - 32) * 1.25
const calculatedCanvasWidth = (width - 32) * 1.25; // 25% larger - matches ImageStep
const calculatedCanvasHeight = calculatedCanvasWidth * (2620 / 1860);

// On iPad, limit canvas to fit on screen nicely
const MAX_CANVAS_HEIGHT_IPAD = height * 0.55; // Use 55% of screen height on iPad for preview
const MAX_CANVAS_WIDTH_IPAD = MAX_CANVAS_HEIGHT_IPAD * (1860 / 2620);

const CANVAS_WIDTH = isIPad ? Math.min(calculatedCanvasWidth, MAX_CANVAS_WIDTH_IPAD) : calculatedCanvasWidth;
const CANVAS_HEIGHT = isIPad ? Math.min(calculatedCanvasHeight, MAX_CANVAS_HEIGHT_IPAD) : calculatedCanvasHeight;

interface CompleteStepProps {
  location: string;
  locationColor: string;
  date: Date;
  images: { uri: string; x: number; y: number; scale: number; width: number; height: number }[];
  text: string;
  onSave: () => void;
  onBack: () => void;
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
  onBack,
  isEditing = false,
  journalId,
}: CompleteStepProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const scrollViewRef = React.useRef<ScrollView>(null);
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const [isSaving, setIsSaving] = React.useState(false);
  const [showPrivacySelector, setShowPrivacySelector] = React.useState(false);
  const [selectedPrivacy, setSelectedPrivacy] = React.useState<PrivacyLevel>('private');

  useEffect(() => {
    // Entrance animation
    opacity.value = withTiming(1, { duration: 400 });
    scale.value = withSpring(1, { damping: 15, stiffness: 100 });
  }, []);

  useEffect(() => {
    // Scroll to privacy selector when it appears
    if (showPrivacySelector) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300); // Delay to let the privacy selector render
    }
  }, [showPrivacySelector]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  const handleSave = async () => {
    haptics.heavy();
    setIsSaving(true);
    setShowPrivacySelector(false);

    try {
      // Get current user for Firebase sync
      const user = await getStoredUser();

      const journalData = {
        date: date.toISOString(),
        location: location.trim(),
        text: text,
        images: images.map(img => ({
          uri: img.uri,
          x: img.x,
          y: img.y,
          scale: img.scale,
          width: img.width,
          height: img.height,
        })),
        colors: {
          locationColor: locationColor,
          locationShadowColor: locationColor + '40',
        },
        privacy: selectedPrivacy,
        userId: user?.uid,
        userDisplayName: user?.displayName || user?.fullName || null,
        userProfileImage: user?.profileImageUrl || null,
      };

      if (isEditing && journalId) {
        await updateJournal(journalId, journalData, user?.uid);
      } else {
        await saveJournal(journalData);
      }

      haptics.success();

      // Genie animation: shrink, spin, and fly down to gallery tab
      const duration = 600;
      scale.value = withTiming(0, { duration, easing: Easing.in(Easing.cubic) });
      opacity.value = withTiming(0, { duration });
      translateY.value = withTiming(height / 2, { duration, easing: Easing.in(Easing.back(1.5)) });
      rotate.value = withTiming(15, { duration, easing: Easing.inOut(Easing.ease) });

      // Navigate to gallery after animation
      setTimeout(() => {
        navigation.navigate('Gallery' as never);
      }, duration + 50);
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

  const handleSavePress = () => {
    if (isEditing) {
      // If editing, just save without privacy selector
      handleSave();
    } else {
      // Show privacy selector for new journals
      setShowPrivacySelector(true);
    }
  };

  const handleBackPress = () => {
    haptics.light();
    onBack();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + scaleHeight(110), paddingBottom: insets.bottom + scaleHeight(100) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Journal Preview */}
        <Animated.View style={[styles.previewContainer, animatedStyle]}>
          <LiveJournalCanvas
            date={formatDate(date)}
            location={location}
            text={text}
            locationColor={locationColor}
            images={images}
            canvasWidth={CANVAS_WIDTH}
            canvasHeight={CANVAS_HEIGHT}
          />
        </Animated.View>

        {/* Action Buttons */}
        {!showPrivacySelector ? (
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackPress}
              disabled={isSaving}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSavePress}
              disabled={isSaving}
            >
              <Text style={styles.saveButtonText}>
                {isSaving
                  ? isEditing
                    ? 'Updating...'
                    : 'Saving...'
                  : isEditing
                  ? 'Update'
                  : 'Finish'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.privacyContainer}>
            <PrivacySelector
              selectedPrivacy={selectedPrivacy}
              onSelectPrivacy={setSelectedPrivacy}
              disabled={isSaving}
            />
            <View style={styles.privacyActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPrivacySelector(false)}
                disabled={isSaving}
              >
                <Text style={styles.cancelButtonText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <Text style={styles.saveButtonText}>
                  {isSaving ? 'Saving...' : 'Save Journal'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    paddingHorizontal: scaleWidth(30),
    alignItems: 'center',
  },
  previewContainer: {
    borderRadius: scaleSize(12),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleHeight(8) },
    shadowOpacity: 0.4,
    shadowRadius: scaleSize(16),
    elevation: 10,
    marginBottom: scaleHeight(24),
  },
  buttonsContainer: {
    width: '100%',
    flexDirection: 'row',
    gap: scaleWidth(4),
  },
  backButton: {
    flex: 1,
    paddingVertical: scaleHeight(18),
    borderRadius: scaleSize(100),
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: scaleSize(1),
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButtonText: {
    fontSize: scaleFont(17),
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
  },
  saveButton: {
    flex: 1,
    paddingVertical: scaleHeight(18),
    borderRadius: scaleSize(100),
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  saveButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  saveButtonText: {
    fontSize: scaleFont(17),
    fontFamily: 'TitleFont',
    color: '#000',
    letterSpacing: -0.5,
  },
  privacyContainer: {
    width: '100%',
    gap: scaleHeight(20),
  },
  privacyActions: {
    width: '100%',
    flexDirection: 'row',
    gap: scaleWidth(8),
  },
  cancelButton: {
    flex: 1,
    paddingVertical: scaleHeight(18),
    borderRadius: scaleSize(100),
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: scaleSize(1),
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButtonText: {
    fontSize: scaleFont(16),
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
  },
});
