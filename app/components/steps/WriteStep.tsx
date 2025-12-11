import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { haptics } from '../../utils/haptics';
import { generateJournalPrompts } from '../../services/gptService';

const { width, height } = Dimensions.get('window');

interface WriteStepProps {
  text: string;
  onChangeText: (text: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function WriteStep({ text, onChangeText, onNext, onBack }: WriteStepProps) {
  const textInputRef = useRef<TextInput>(null);
  const [prompt, setPrompt] = useState("How are you feeling today?");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showFinish, setShowFinish] = useState(false);

  // Animation values
  const promptOpacity = useSharedValue(0);
  const promptTranslate = useSharedValue(20);
  const textOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);
  const buttonsTranslate = useSharedValue(20);
  const finishOpacity = useSharedValue(0);
  const finishScale = useSharedValue(0.8);
  const finishTranslate = useSharedValue(20);

  useEffect(() => {
    // Staggered entrance animations
    promptOpacity.value = withTiming(1, { duration: 600 });
    promptTranslate.value = withSpring(0, { damping: 20, stiffness: 90 });

    textOpacity.value = withDelay(150, withTiming(1, { duration: 600 }));

    buttonsOpacity.value = withDelay(300, withTiming(1, { duration: 600 }));
    buttonsTranslate.value = withDelay(300, withSpring(0, { damping: 20, stiffness: 90 }));

    setTimeout(() => {
      textInputRef.current?.focus();
      haptics.light();
    }, 500);
  }, []);

  const promptStyle = useAnimatedStyle(() => ({
    opacity: promptOpacity.value,
    transform: [{ translateY: promptTranslate.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
    transform: [{ translateY: buttonsTranslate.value }],
  }));

  const finishStyle = useAnimatedStyle(() => ({
    opacity: finishOpacity.value,
    transform: [
      { scale: finishScale.value },
      { translateY: finishTranslate.value },
    ],
  }));

  // Animate finish button when text is entered
  useEffect(() => {
    if (text.trim().length > 0 && !showFinish) {
      setShowFinish(true);
      finishOpacity.value = withTiming(1, { duration: 400 });
      finishScale.value = withSpring(1, { damping: 15, stiffness: 120 });
      finishTranslate.value = withSpring(0, { damping: 20, stiffness: 90 });
    } else if (text.trim().length === 0 && showFinish) {
      finishOpacity.value = withTiming(0, { duration: 200 });
      finishScale.value = withTiming(0.8, { duration: 200 });
      finishTranslate.value = withTiming(20, { duration: 200 });
      setTimeout(() => setShowFinish(false), 200);
    }
  }, [text]);

  const handleGeneratePrompt = async () => {
    if (!text.trim()) {
      haptics.warning();
      return;
    }

    haptics.medium();
    setIsGenerating(true);

    try {
      const generated = await generateJournalPrompts(text);
      setPrompt(generated);
      haptics.success();
    } catch (error) {
      haptics.error();
      setPrompt("Keep writing...");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNext = () => {
    if (text.trim()) {
      haptics.heavy();
      onNext();
    } else {
      haptics.error();
    }
  };

  const handleBack = () => {
    haptics.light();
    onBack();
  };

  const wordCount = text.split(' ').filter((w) => w.length > 0).length;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* AI Prompt */}
        <Animated.View style={[styles.promptSection, promptStyle]}>
          <Text style={styles.promptText}>{prompt}</Text>
          {text.length > 20 && (
            <Pressable
              style={({ pressed }) => [
                styles.generateButton,
                pressed && styles.generateButtonPressed,
              ]}
              onPress={handleGeneratePrompt}
              disabled={isGenerating}
            >
              <Text style={styles.generateText}>
                {isGenerating ? 'Thinking...' : '✨ New Prompt'}
              </Text>
            </Pressable>
          )}
        </Animated.View>

        {/* Writing Area */}
        <Animated.View style={[styles.textSection, textStyle]}>
          <TextInput
            ref={textInputRef}
            style={styles.textArea}
            placeholder="Start writing your thoughts..."
            placeholderTextColor="rgba(255, 255, 255, 0.25)"
            value={text}
            onChangeText={(newText) => {
              onChangeText(newText);
              if (newText.length % 10 === 0) haptics.selection();
            }}
            multiline
            textAlignVertical="top"
            autoFocus
          />
        </Animated.View>

        {/* Footer with Word Count and Buttons */}
        <Animated.View style={[styles.footer, buttonsStyle]}>
          <Text style={styles.wordCount}>{wordCount} words</Text>

          <View style={styles.buttonSection}>
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
              onPress={handleBack}
            >
              <Text style={styles.backText}>Back</Text>
            </Pressable>

            {showFinish && (
              <Animated.View style={[styles.finishButtonWrapper, finishStyle]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.continueButton,
                    pressed && styles.continueButtonPressed,
                  ]}
                  onPress={handleNext}
                >
                  <Text style={styles.continueText}>Finish</Text>
                </Pressable>
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 40,
  },
  promptSection: {
    marginBottom: 32,
  },
  promptText: {
    fontSize: 22,
    fontFamily: 'TitleFont',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  generateButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  generateButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    transform: [{ scale: 0.97 }],
  },
  generateText: {
    fontSize: 13,
    fontFamily: 'ZainCustomFont',
    color: '#fff',
  },
  textSection: {
    flex: 1,
    marginBottom: 24,
  },
  textArea: {
    flex: 1,
    fontSize: 20,
    fontFamily: 'ZainCustomFont',
    color: '#fff',
    lineHeight: 32,
  },
  footer: {
    gap: 20,
  },
  wordCount: {
    fontSize: 13,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
  buttonSection: {
    flexDirection: 'row',
    gap: 12,
  },
  finishButtonWrapper: {
    flex: 2,
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
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: 'center',
    backgroundColor: '#fff',
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
});
