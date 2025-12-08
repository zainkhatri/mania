import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { haptics } from '../../utils/haptics';

const { width, height } = Dimensions.get('window');

interface TitleStepProps {
  title: string;
  onChangeTitle: (title: string) => void;
  location: string;
  onChangeLocation: (location: string) => void;
  onNext: () => void;
}

export default function TitleStep({
  title,
  onChangeTitle,
  location,
  onChangeLocation,
  onNext,
}: TitleStepProps) {
  const titleInputRef = useRef<TextInput>(null);
  const locationInputRef = useRef<TextInput>(null);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Smooth entrance animation
    scale.value = withTiming(1, { duration: 400 });
    opacity.value = withTiming(1, { duration: 400 });

    // Auto-focus title input
    setTimeout(() => {
      titleInputRef.current?.focus();
      haptics.light();
    }, 400);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handleNext = () => {
    haptics.medium();
    onNext();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Animated.View style={[styles.content, animatedStyle]}>
        {/* Instruction */}
        <Text style={styles.instruction}>Let's start your journal</Text>

        {/* Title Input */}
        <TextInput
          ref={titleInputRef}
          style={styles.titleInput}
          placeholder="Title (optional)"
          placeholderTextColor="rgba(255, 255, 255, 0.3)"
          value={title}
          onChangeText={onChangeTitle}
          onFocus={() => haptics.light()}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => locationInputRef.current?.focus()}
        />

        {/* Location Input (EXACT match to OG) */}
        <TextInput
          ref={locationInputRef}
          style={styles.locationInput}
          placeholder="e.g., MANIA, LA JOLLA, CA"
          placeholderTextColor="rgba(52, 152, 219, 0.5)"
          value={location}
          onChangeText={onChangeLocation}
          onFocus={() => haptics.light()}
          autoCapitalize="characters"
          returnKeyType="done"
          onSubmitEditing={handleNext}
        />

        {/* Continue Button */}
        <Animated.View style={{ marginTop: 40 }}>
          <TouchableOpacity style={styles.continueButton} onPress={handleNext}>
            <Text style={styles.continueText}>Continue →</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Helper Text */}
        <Text style={styles.helperText}>
          {location.length === 0 && title.length === 0
            ? 'Optional - tap Continue to skip'
            : 'Location will appear in color on your journal'}
        </Text>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: width - 48,
    alignItems: 'center',
  },
  instruction: {
    fontSize: 28,
    fontFamily: 'ZainCustomFont',
    color: '#fff',
    marginBottom: 40,
    textAlign: 'center',
    fontWeight: '300',
  },
  titleInput: {
    width: '100%',
    fontSize: 48,
    fontFamily: 'ZainCustomFont',
    color: '#fff',
    textAlign: 'center',
    paddingVertical: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 24,
  },
  locationInput: {
    width: '100%',
    fontSize: 24,
    fontFamily: 'ZainCustomFont',
    color: '#3498DB',
    textAlign: 'center',
    paddingVertical: 16,
  },
  continueButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 48,
    paddingVertical: 20,
    borderRadius: 30,
  },
  continueText: {
    fontSize: 20,
    fontFamily: 'ZainCustomFont',
    color: '#000',
    fontWeight: '600',
  },
  helperText: {
    position: 'absolute',
    bottom: -100,
    fontSize: 14,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
});
