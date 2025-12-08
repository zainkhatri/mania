import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { haptics } from '../utils/haptics';

// Import steps
import TitleStep from '../components/steps/TitleStep';
import DateStep from '../components/steps/DateStep';
import ImageStep from '../components/steps/ImageStep';
import WriteStep from '../components/steps/WriteStep';
import CompleteStep from '../components/steps/CompleteStep';

const { width, height } = Dimensions.get('window');

const STEPS = {
  TITLE: 0,
  DATE: 1,
  IMAGES: 2,
  WRITE: 3,
  COMPLETE: 4,
};

export default function JournalScreen() {
  const [currentStep, setCurrentStep] = useState(STEPS.TITLE);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date());
  const [location, setLocation] = useState('MANIA, LA JOLLA, CA');
  const [images, setImages] = useState<{ uri: string; x: number; y: number; scale: number }[]>([]);
  const [text, setText] = useState('');

  // Animation values
  const opacity = useSharedValue(1);

  const goToNextStep = () => {
    haptics.medium();

    // Smooth fade out, then fade in
    opacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(setCurrentStep)(currentStep + 1);
      opacity.value = withTiming(1, { duration: 300 });
    });
  };

  const goToPreviousStep = () => {
    if (currentStep > STEPS.TITLE) {
      haptics.light();

      // Smooth fade transition
      opacity.value = withTiming(0, { duration: 200 }, () => {
        runOnJS(setCurrentStep)(currentStep - 1);
        opacity.value = withTiming(1, { duration: 300 });
      });
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const renderStep = () => {
    switch (currentStep) {
      case STEPS.TITLE:
        return (
          <TitleStep
            title={title}
            onChangeTitle={setTitle}
            location={location}
            onChangeLocation={setLocation}
            onNext={goToNextStep}
          />
        );
      case STEPS.DATE:
        return (
          <DateStep
            date={date}
            onChangeDate={setDate}
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
            title={title}
            location={location}
            date={date}
            text={text}
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
      case STEPS.COMPLETE:
        return (
          <CompleteStep
            title={title}
            location={location}
            date={date}
            images={images}
            text={text}
            onSave={() => {
              // Save logic
              haptics.success();
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: `${((currentStep + 1) / 5) * 100}%` },
            ]}
          />
        </View>
      </View>

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
  progressContainer: {
    position: 'absolute',
    top: 60,
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
