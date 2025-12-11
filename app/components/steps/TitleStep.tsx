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
  onNext: () => void;
}

export default function TitleStep({
  title,
  onChangeTitle,
  onNext,
}: TitleStepProps) {
  const titleInputRef = useRef<TextInput>(null);
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
          {title.length === 0
            ? 'Optional - tap Continue to skip'
            : 'Give your journal a title'}
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
    fontFamily: 'TitleFont',
    color: '#fff',
    marginBottom: 40,
    textAlign: 'center',
    letterSpacing: -0.5,
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
  continueButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 48,
    paddingVertical: 20,
    borderRadius: 30,
  },
  continueText: {
    fontSize: 20,
    fontFamily: 'TitleFont',
    color: '#000',
    letterSpacing: -0.5,
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
