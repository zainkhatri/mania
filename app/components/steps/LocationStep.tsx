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
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { haptics } from '../../utils/haptics';
import { getColors } from 'react-native-image-colors';

const { width, height } = Dimensions.get('window');

// Fallback color palette (used if no images)
const DEFAULT_COLORS = [
  '#3498DB', '#E74C3C', '#2ECC71', '#F39C12',
  '#9B59B6', '#1ABC9C', '#E91E63', '#FF5722',
];

interface LocationStepProps {
  location: string;
  onChangeLocation: (location: string) => void;
  locationColor: string;
  onChangeLocationColor: (color: string) => void;
  onNext: () => void;
  onBack: () => void;
  images?: { uri: string }[];
}

export default function LocationStep({
  location,
  onChangeLocation,
  locationColor,
  onChangeLocationColor,
  onNext,
  onBack,
  images = [],
}: LocationStepProps) {
  const locationInputRef = useRef<TextInput>(null);
  const [selectedColor, setSelectedColor] = useState(locationColor || DEFAULT_COLORS[0]);
  const [extractedColors, setExtractedColors] = useState<string[]>(DEFAULT_COLORS);
  const [isExtracting, setIsExtracting] = useState(false);

  // Animation values
  const titleOpacity = useSharedValue(0);
  const titleTranslate = useSharedValue(30);
  const inputOpacity = useSharedValue(0);
  const inputScale = useSharedValue(0.95);
  const colorsOpacity = useSharedValue(0);
  const colorsTranslate = useSharedValue(20);
  const buttonsOpacity = useSharedValue(0);
  const buttonsTranslate = useSharedValue(20);

  // Extract colors from images
  useEffect(() => {
    const extractColorsFromImages = async () => {
      if (images.length === 0) {
        setExtractedColors(DEFAULT_COLORS);
        return;
      }

      setIsExtracting(true);
      const colors: string[] = [];

      try {
        for (const image of images) {
          const result = await getColors(image.uri, {
            fallback: '#3498DB',
            cache: true,
            key: image.uri,
          });

          if (Platform.OS === 'ios') {
            colors.push(result.background);
            colors.push(result.primary);
            colors.push(result.secondary);
            colors.push(result.detail);
          } else if (Platform.OS === 'android') {
            colors.push(result.dominant);
            colors.push(result.vibrant);
            colors.push(result.darkVibrant);
            colors.push(result.lightVibrant);
          }
        }

        // Remove duplicates and filter out invalid colors
        const uniqueColors = [...new Set(colors.filter(c => c && c !== '#000000'))];
        setExtractedColors(uniqueColors.length > 0 ? uniqueColors : DEFAULT_COLORS);
      } catch (error) {
        console.error('Error extracting colors:', error);
        setExtractedColors(DEFAULT_COLORS);
      } finally {
        setIsExtracting(false);
      }
    };

    extractColorsFromImages();
  }, [images]);

  useEffect(() => {
    // Staggered entrance animations
    titleOpacity.value = withTiming(1, { duration: 600 });
    titleTranslate.value = withSpring(0, { damping: 20, stiffness: 90 });

    inputOpacity.value = withDelay(150, withTiming(1, { duration: 600 }));
    inputScale.value = withDelay(150, withSpring(1, { damping: 15, stiffness: 100 }));

    colorsOpacity.value = withDelay(300, withTiming(1, { duration: 600 }));
    colorsTranslate.value = withDelay(300, withSpring(0, { damping: 20, stiffness: 90 }));

    buttonsOpacity.value = withDelay(450, withTiming(1, { duration: 600 }));
    buttonsTranslate.value = withDelay(450, withSpring(0, { damping: 20, stiffness: 90 }));

    // Auto-focus
    setTimeout(() => {
      locationInputRef.current?.focus();
      haptics.light();
    }, 500);
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslate.value }],
  }));

  const inputStyle = useAnimatedStyle(() => ({
    opacity: inputOpacity.value,
    transform: [{ scale: inputScale.value }],
  }));

  const colorsStyle = useAnimatedStyle(() => ({
    opacity: colorsOpacity.value,
    transform: [{ translateY: colorsTranslate.value }],
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
    transform: [{ translateY: buttonsTranslate.value }],
  }));

  const handleColorSelect = (color: string) => {
    haptics.medium();
    setSelectedColor(color);
    onChangeLocationColor(color);
  };

  const handleNext = () => {
    haptics.medium();
    onNext();
  };

  const handleBack = () => {
    haptics.light();
    onBack();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
        {/* Title */}
        <Animated.View style={[styles.titleContainer, titleStyle]}>
          <Text style={styles.title}>Where were you?</Text>
          <Text style={styles.subtitle}>Add a location to your memory</Text>
        </Animated.View>

        {/* Location Input */}
        <Animated.View style={[styles.inputSection, inputStyle]}>
          <TextInput
            ref={locationInputRef}
            style={[styles.locationInput, { color: selectedColor }]}
            placeholder="MANIA, LA JOLLA, CA"
            placeholderTextColor={`${selectedColor}50`}
            value={location}
            onChangeText={onChangeLocation}
            onFocus={() => haptics.light()}
            autoCapitalize="characters"
            returnKeyType="done"
            onSubmitEditing={handleNext}
          />
        </Animated.View>

        {/* Color Picker */}
        <Animated.View style={[styles.colorSection, colorsStyle]}>
          <Text style={styles.colorLabel}>
            {isExtracting ? 'Extracting colors from your photos...' : 'Choose a color'}
          </Text>
          {isExtracting ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.colorScroll}
            >
              {extractedColors.map((color, index) => (
                <Pressable
                  key={`${color}-${index}`}
                  style={({ pressed }) => [
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorOptionSelected,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => handleColorSelect(color)}
                >
                  {selectedColor === color && (
                    <View style={styles.colorCheck}>
                      <Text style={styles.checkmark}>✓</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Animated.View>

        {/* Navigation Buttons */}
        <Animated.View style={[styles.buttonSection, buttonsStyle]}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            onPress={handleBack}
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
        </Animated.View>

        {/* Helper Text */}
        <Text style={styles.helperText}>
          {location.length === 0
            ? 'Optional — skip if you prefer'
            : 'Your location will appear in this color'}
        </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    minHeight: height,
  },
  titleContainer: {
    marginBottom: 50,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontFamily: 'TitleFont',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  inputSection: {
    width: '100%',
    marginBottom: 50,
  },
  locationInput: {
    width: '100%',
    fontSize: 28,
    fontFamily: 'ZainCustomFont',
    textAlign: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  colorSection: {
    width: '100%',
    marginBottom: 50,
  },
  colorLabel: {
    fontSize: 14,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 1,
  },
  colorScroll: {
    paddingHorizontal: 8,
    gap: 12,
  },
  loadingContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOption: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#fff',
    borderWidth: 3,
  },
  colorCheck: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  checkmark: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  buttonSection: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 320,
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
    flex: 2,
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
  helperText: {
    position: 'absolute',
    bottom: 60,
    fontSize: 13,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
});
