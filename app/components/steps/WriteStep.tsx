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
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptics } from '../../utils/haptics';
import { generateJournalPrompts } from '../../services/gptService';
import { scaleFont, scaleHeight, scaleWidth, scaleSize } from '../../utils/responsive';

interface WriteStepProps {
  text: string;
  onChangeText: (text: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function WriteStep({ text, onChangeText, onNext, onBack }: WriteStepProps) {
  const insets = useSafeAreaInsets();
  const textInputRef = useRef<TextInput>(null);
  const [prompt, setPrompt] = useState("");
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
  const backButtonFlex = useSharedValue(2); // Start at full width

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
    transform: [{ scale: finishScale.value }],
  }));

  const backButtonStyle = useAnimatedStyle(() => ({
    flex: backButtonFlex.value,
  }));

  // Animate finish button and back button when text is entered
  useEffect(() => {
    if (text.trim().length > 0 && !showFinish) {
      setShowFinish(true);
      // Shrink back button to make room for finish button
      backButtonFlex.value = withSpring(1, { damping: 30, stiffness: 100 });
      // Animate finish button in
      finishOpacity.value = withTiming(1, { duration: 300 });
      finishScale.value = withSpring(1, { damping: 20, stiffness: 120 });
    } else if (text.trim().length === 0 && showFinish) {
      // Animate finish button out first with smooth fade
      finishOpacity.value = withTiming(0, { duration: 200 });
      finishScale.value = withTiming(0.8, { duration: 200 });
      // Expand back button with smooth timing animation (no bounce)
      backButtonFlex.value = withTiming(2, { duration: 300 });
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
      keyboardVerticalOffset={scaleHeight(60)}
    >
      <View style={[styles.content, { paddingTop: insets.top + scaleHeight(70) }]}>
        {/* AI Prompt - Right below progress bar */}
        {prompt && (
          <Animated.View style={[styles.promptSection, promptStyle]}>
            <Text style={styles.promptText}>{prompt}</Text>
          </Animated.View>
        )}

        {/* Writing Area - In a visible box */}
        <Animated.View style={[styles.textSection, textStyle]}>
          <View style={styles.textBoxContainer}>
            <ScrollView
              style={styles.textAreaScroll}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="always"
            >
              <TextInput
                ref={textInputRef}
                style={styles.textArea}
                placeholder="How are you feeling today?"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                value={text}
                onChangeText={(newText) => {
                  onChangeText(newText);
                  if (newText.length % 10 === 0) haptics.selection();
                }}
                multiline
                scrollEnabled={true}
                blurOnSubmit={false}
                autoFocus
                caretHidden={text.length === 0}
                selectTextOnFocus={false}
                selection={undefined}
              />
            </ScrollView>
          </View>
        </Animated.View>

        {/* Footer with Buttons */}
        <Animated.View style={[styles.footer, buttonsStyle]}>
          <View style={styles.buttonSection}>
            <Animated.View style={backButtonStyle}>
              <Pressable
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.backButtonPressed,
                ]}
                onPress={handleBack}
              >
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            </Animated.View>

            {showFinish && (
              <Animated.View style={[styles.finishButtonContainer, finishStyle]}>
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
    paddingHorizontal: scaleWidth(24),
    paddingTop: scaleHeight(80),
    paddingBottom: scaleHeight(80),
  },
  promptSection: {
    marginBottom: scaleHeight(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleWidth(12),
  },
  promptText: {
    fontSize: scaleFont(15),
    fontFamily: 'TitleFont',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  generateButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: scaleWidth(20),
    paddingVertical: scaleHeight(10),
    borderRadius: scaleSize(100),
    borderWidth: scaleSize(1),
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  generateButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    transform: [{ scale: 0.97 }],
  },
  generateText: {
    fontSize: scaleFont(13),
    fontFamily: 'ZainCustomFont',
    color: '#fff',
  },
  textSection: {
    flex: 1,
    marginTop: scaleHeight(15),
    marginBottom: scaleHeight(12),
  },
  textBoxContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: scaleSize(16),
    borderWidth: scaleSize(1),
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: scaleSize(20),
  },
  textAreaScroll: {
    flex: 1,
  },
  textArea: {
    fontSize: scaleFont(18),
    fontFamily: 'ZainCustomFont',
    color: '#fff',
    lineHeight: scaleHeight(28),
    textAlignVertical: 'top',
    minHeight: scaleHeight(400),
  },
  footer: {
    marginTop: 0,
  },
  wordCount: {
    fontSize: scaleFont(13),
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
  buttonSection: {
    flexDirection: 'row',
    gap: scaleWidth(4),
  },
  finishButtonContainer: {
    flex: 1,
  },
  backButton: {
    paddingVertical: scaleHeight(18),
    borderRadius: scaleSize(100),
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: scaleSize(1),
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ scale: 0.98 }],
  },
  backText: {
    fontSize: scaleFont(17),
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
  },
  continueButton: {
    paddingVertical: scaleHeight(18),
    borderRadius: scaleSize(100),
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  continueButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    transform: [{ scale: 0.98 }],
  },
  continueText: {
    fontSize: scaleFont(17),
    fontFamily: 'TitleFont',
    color: '#000',
    letterSpacing: -0.5,
  },
});
