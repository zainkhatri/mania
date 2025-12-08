import React, { useEffect, useRef, useState } from 'react';
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

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 400 });
    scale.value = withTiming(1, { duration: 400 });

    setTimeout(() => {
      textInputRef.current?.focus();
      haptics.light();
    }, 400);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Animated.View style={[styles.content, animatedStyle]}>
        {/* AI Prompt */}
        <View style={styles.promptContainer}>
          <Text style={styles.promptText}>{prompt}</Text>
          {text.length > 20 && (
            <TouchableOpacity
              style={styles.generateButton}
              onPress={handleGeneratePrompt}
              disabled={isGenerating}
            >
              <Text style={styles.generateText}>
                {isGenerating ? 'Thinking...' : '✨ New Prompt'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Writing Area */}
        <TextInput
          ref={textInputRef}
          style={styles.textArea}
          placeholder="Start writing your thoughts..."
          placeholderTextColor="rgba(255, 255, 255, 0.3)"
          value={text}
          onChangeText={(newText) => {
            onChangeText(newText);
            if (newText.length % 10 === 0) haptics.selection();
          }}
          multiline
          textAlignVertical="top"
          autoFocus
        />

        {/* Word Count */}
        <Text style={styles.wordCount}>
          {text.split(' ').filter((w) => w.length > 0).length} words
        </Text>

        {/* Continue Button */}
        {text.trim().length > 0 && (
          <TouchableOpacity style={styles.continueButton} onPress={handleNext}>
            <Text style={styles.continueText}>Finish →</Text>
          </TouchableOpacity>
        )}

        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 120,
    paddingBottom: 40,
  },
  promptContainer: {
    marginBottom: 24,
  },
  promptText: {
    fontSize: 20,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  generateButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  generateText: {
    fontSize: 14,
    fontFamily: 'ZainCustomFont',
    color: '#fff',
  },
  textArea: {
    flex: 1,
    fontSize: 24,
    fontFamily: 'ZainCustomFont',
    color: '#fff',
    lineHeight: 36,
  },
  wordCount: {
    fontSize: 14,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.4)',
    marginBottom: 20,
  },
  continueButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 48,
    paddingVertical: 20,
    borderRadius: 30,
    alignSelf: 'center',
    marginBottom: 20,
  },
  continueText: {
    fontSize: 20,
    fontFamily: 'ZainCustomFont',
    color: '#000',
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 12,
    alignSelf: 'center',
  },
  backText: {
    fontSize: 16,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
