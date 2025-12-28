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
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptics } from '../../utils/haptics';

const { width, height } = Dimensions.get('window');

interface TitleStepProps {
  title: string;
  onChangeTitle: (title: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function TitleStep({
  title,
  onChangeTitle,
  onNext,
  onBack,
}: TitleStepProps) {
  const insets = useSafeAreaInsets();
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
      <Animated.View style={[styles.content, animatedStyle, { paddingBottom: insets.bottom + 30 }]}>
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

        {/* Buttons */}
        <View style={styles.buttonsContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            onPress={() => {
              haptics.light();
              onBack();
            }}
          >
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.continueButton,
              pressed && styles.continueButtonPressed,
            ]}
            onPress={handleNext}
          >
            <Text style={styles.continueText}>Continue</Text>
          </Pressable>
        </View>

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
  buttonsContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
    marginTop: 40,
  },
  backButton: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ scale: 0.98 }],
  },
  backText: {
    fontSize: 17,
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
  },
  continueButton: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: 'center',
  },
  continueButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    transform: [{ scale: 0.98 }],
  },
  continueText: {
    fontSize: 17,
    fontFamily: 'TitleFont',
    color: '#000',
    letterSpacing: -0.5,
  },
  helperText: {
    position: 'absolute',
    bottom: -60,
    fontSize: 14,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
});
