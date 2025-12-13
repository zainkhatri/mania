import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRoute, useNavigation } from '@react-navigation/native';
import { haptics } from '../utils/haptics';
import { getJournalById } from '../services/journalService';

// Import steps
import DateStep from '../components/steps/DateStep';
import ImageStep from '../components/steps/ImageStep';
import LocationStep from '../components/steps/LocationStep';
import WriteStep from '../components/steps/WriteStep';
import CompleteStep from '../components/steps/CompleteStep';

const { width, height } = Dimensions.get('window');

const STEPS = {
  DATE: 0,
  WRITE: 1,
  IMAGES: 2,
  LOCATION: 3,
  COMPLETE: 4,
};

export default function JournalScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const journalId = (route.params as { journalId?: string })?.journalId;
  const isEditing = !!journalId;

  const [currentStep, setCurrentStep] = useState(STEPS.DATE);
  const [date, setDate] = useState(new Date());
  const [location, setLocation] = useState('');
  const [locationColor, setLocationColor] = useState('#3498DB');
  const [images, setImages] = useState<{ uri: string; x: number; y: number; scale: number }[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  // Animation values
  const opacity = useSharedValue(1);
  const progressBarOffset = useSharedValue(0);

  // Load existing journal for edit mode
  useEffect(() => {
    if (journalId) {
      loadExistingJournal();
    }
  }, [journalId]);

  // Animate progress bar position for WRITE step
  useEffect(() => {
    if (currentStep === STEPS.WRITE) {
      progressBarOffset.value = withTiming(5, { duration: 300 });
    } else {
      progressBarOffset.value = withTiming(0, { duration: 300 });
    }
  }, [currentStep]);

  const loadExistingJournal = async () => {
    try {
      setLoading(true);
      const journal = await getJournalById(journalId!);
      if (journal) {
        setDate(new Date(journal.date));
        setLocation(journal.location || '');
        setLocationColor(journal.colors.locationColor);
        setImages(journal.images);
        setText(journal.text);
      }
    } catch (error) {
      console.error('Error loading journal:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToNextStep = () => {
    haptics.medium();

    // Smooth fade out, then fade in
    opacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(setCurrentStep)(currentStep + 1);
      opacity.value = withTiming(1, { duration: 300 });
    });
  };

  const goToPreviousStep = () => {
    if (currentStep > STEPS.DATE) {
      haptics.light();

      // Smooth fade transition
      opacity.value = withTiming(0, { duration: 200 }, () => {
        runOnJS(setCurrentStep)(currentStep - 1);
        opacity.value = withTiming(1, { duration: 300 });
      });
    } else {
      // On first step, go back to home
      haptics.light();
      navigation.navigate('Home' as never);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: progressBarOffset.value }],
  }));

  const renderStep = () => {
    switch (currentStep) {
      case STEPS.DATE:
        return (
          <DateStep
            date={date}
            onChangeDate={setDate}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
          />
        );
      case STEPS.WRITE:
        return (
          <WriteStep
            text={text}
            onChangeText={setText}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
          />
        );
      case STEPS.IMAGES:
        return (
          <ImageStep
            images={images}
            onChangeImages={setImages}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
            location={location}
            date={date}
            text={text}
          />
        );
      case STEPS.LOCATION:
        return (
          <LocationStep
            location={location}
            onChangeLocation={setLocation}
            locationColor={locationColor}
            onChangeLocationColor={setLocationColor}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
            images={images}
          />
        );
      case STEPS.COMPLETE:
        return (
          <CompleteStep
            location={location}
            locationColor={locationColor}
            date={date}
            images={images}
            text={text}
            isEditing={isEditing}
            journalId={journalId}
            onSave={() => {
              // Save logic handled in CompleteStep
              haptics.success();
            }}
          />
        );
      default:
        return null;
    }
  };

  // Show loading while loading journal for edit
  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading journal...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Step Title - Above Progress Bar */}
      <View style={[styles.stepTitleContainer, { top: insets.top + 10 }]}>
        {currentStep === STEPS.DATE && (
          <Text style={styles.stepTitle}>When did this happen?</Text>
        )}
        {currentStep === STEPS.IMAGES && (
          <Text style={styles.stepTitle}>
            Add <Text style={styles.specialChar}>&</Text> Arrange Your Photos
          </Text>
        )}
        {currentStep === STEPS.LOCATION && (
          <Text style={styles.stepTitle}>Where were you?</Text>
        )}
        {currentStep === STEPS.WRITE && (
          <Text style={styles.stepTitle}>What happened?</Text>
        )}
        {currentStep === STEPS.COMPLETE && (
          <Text style={styles.stepTitle}>Preview & Save</Text>
        )}
      </View>

      {/* Progress Bar */}
      <Animated.View style={[styles.progressContainer, { top: insets.top + 60 }, progressBarStyle]}>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: `${((currentStep + 1) / 5) * 100}%` },
            ]}
          />
        </View>
      </Animated.View>

      {/* Step Content */}
      <Animated.View style={[styles.stepContainer, animatedStyle]}>
        {renderStep()}
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 16,
  },
  stepTitleContainer: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    zIndex: 101,
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 32,
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -1,
  },
  specialChar: {
    fontFamily: 'ZainCustomFont',
  },
  progressContainer: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 24,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  stepContainer: {
    flex: 1,
  },
});
