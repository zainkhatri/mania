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
  Keyboard,
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
import { getColors } from 'react-native-image-colors';
import LiveJournalCanvas from '../LiveJournalCanvas';
import { scaleFont, scaleHeight, scaleWidth, scaleSize } from '../../utils/responsive';

const { width, height } = Dimensions.get('window');
const isIPad = width >= 768;

// Calculate canvas size with constraints for iPad - MUST match ImageStep exactly
// ImageStep uses: (width - 32) * 1.25 and height * 0.70
const calculatedCanvasWidth = (width - 32) * 1.25; // 25% larger - matches ImageStep
const calculatedCanvasHeight = calculatedCanvasWidth * (2620 / 1860);

// On iPad, limit canvas to fit on screen nicely - MUST match ImageStep
const MAX_CANVAS_HEIGHT_IPAD = height * 0.70; // SAME as ImageStep!
const MAX_CANVAS_WIDTH_IPAD = MAX_CANVAS_HEIGHT_IPAD * (1860 / 2620);

const CANVAS_WIDTH = isIPad ? Math.min(calculatedCanvasWidth, MAX_CANVAS_WIDTH_IPAD) : calculatedCanvasWidth;
const CANVAS_HEIGHT = isIPad ? Math.min(calculatedCanvasHeight, MAX_CANVAS_HEIGHT_IPAD) : calculatedCanvasHeight;

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
  images?: { uri: string; x: number; y: number; scale: number; width: number; height: number }[];
  date?: Date;
  text?: string;
}

export default function LocationStep({
  location,
  onChangeLocation,
  locationColor,
  onChangeLocationColor,
  onNext,
  onBack,
  images = [],
  date,
  text = '',
}: LocationStepProps) {
  const insets = useSafeAreaInsets();
  const locationInputRef = useRef<TextInput>(null);
  const [selectedColor, setSelectedColor] = useState(locationColor || DEFAULT_COLORS[0]);
  const [extractedColors, setExtractedColors] = useState<string[]>(DEFAULT_COLORS);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showColors, setShowColors] = useState(false); // Track when to show color picker
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [cursorPosition, setCursorPosition] = useState<{ start: number; end: number } | undefined>(undefined);

  // Animation values
  const inputOpacity = useSharedValue(0);
  const inputScale = useSharedValue(0.95);
  const inputTranslate = useSharedValue(0);  // Slide animation for input
  const colorsOpacity = useSharedValue(0);
  const colorsTranslate = useSharedValue(width);  // Start from right off-screen
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
    inputOpacity.value = withDelay(150, withTiming(1, { duration: 600 }));
    inputScale.value = withDelay(150, withSpring(1, { damping: 15, stiffness: 100 }));

    buttonsOpacity.value = withDelay(450, withTiming(1, { duration: 600 }));
    buttonsTranslate.value = withDelay(450, withSpring(0, { damping: 20, stiffness: 90 }));
  }, []);

  // Keyboard listeners
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // Fade animation when user submits location (clicks done)
  useEffect(() => {
    if (showColors) {
      // Dismiss keyboard first
      locationInputRef.current?.blur();

      // Fade out location input
      inputOpacity.value = withTiming(0, { duration: 300 });

      // Fade in colors
      colorsOpacity.value = withTiming(1, { duration: 300 });
    } else {
      // Fade in location input
      inputOpacity.value = withTiming(1, { duration: 300 });

      // Fade out colors
      colorsOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [showColors]);

  const inputStyle = useAnimatedStyle(() => ({
    opacity: inputOpacity.value,
    transform: [{ scale: inputScale.value }],
  }));

  const colorsStyle = useAnimatedStyle(() => ({
    opacity: colorsOpacity.value,
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

  const handleLocationSubmit = () => {
    if (location.trim().length > 0) {
      haptics.light();
      setShowColors(true);
    }
  };

  // Hide colors when user clears the location completely
  useEffect(() => {
    if (location.trim().length === 0 && showColors) {
      setShowColors(false);
    }
  }, [location]);

  // Set cursor to beginning on mount
  useEffect(() => {
    setCursorPosition({ start: 0, end: 0 });
    // After a brief moment, allow normal cursor behavior
    const timer = setTimeout(() => {
      setCursorPosition(undefined);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleNext = () => {
    // If user typed location but hasn't shown colors yet, show colors first
    if (location.trim().length > 0 && !showColors) {
      haptics.light();
      setShowColors(true);
    } else {
      // Otherwise proceed to next step
      haptics.medium();
      onNext();
    }
  };

  const handleBack = () => {
    haptics.light();
    onBack();
  };

  // Format date for journal preview
  const formatDateForPreview = (date?: Date): string => {
    if (!date) return '';
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    let dateStr = date.toLocaleDateString('en-US', options);
    const day = date.getDate();
    const getOrdinalSuffix = (day: number): string => {
      if (day > 3 && day < 21) return 'TH';
      switch (day % 10) {
        case 1: return 'ST';
        case 2: return 'ND';
        case 3: return 'RD';
        default: return 'TH';
      }
    };
    const ordinal = getOrdinalSuffix(day);
    dateStr = dateStr.replace(/(\d+)/, `$1${ordinal}`);
    return dateStr.toUpperCase();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + scaleHeight(60),
            paddingBottom: keyboardHeight > 0 ? keyboardHeight + 120 : 180
          }
        ]}
        keyboardShouldPersistTaps="always"
        scrollEnabled={!showColors}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
        {/* Input/Color Toggle Container - both occupy same space */}
        <View style={styles.toggleContainer}>
          {/* Location Input */}
          {!showColors && (
            <Animated.View style={[styles.inputSection, inputStyle]}>
              <View style={styles.locationInputWrapper}>
                {location.length === 0 && (
                  <Text style={styles.placeholderText}>MANIA, LA JOLLA, CA</Text>
                )}
                <TextInput
                  ref={locationInputRef}
                  style={[
                    styles.locationInput,
                    {
                      color: '#fff',
                      fontSize: location.length > 30 ? scaleFont(32) : location.length > 20 ? scaleFont(38) : scaleFont(48)
                    }
                  ]}
                  placeholder=""
                  placeholderTextColor="transparent"
                  value={location}
                  onChangeText={onChangeLocation}
                  onFocus={() => haptics.light()}
                  autoCapitalize="characters"
                  returnKeyType="done"
                  onSubmitEditing={handleLocationSubmit}
                  autoFocus={true}
                  blurOnSubmit={false}
                  selection={cursorPosition}
                />
              </View>
            </Animated.View>
          )}

          {/* Color Picker with Journal Preview - only show when user submits location */}
          {showColors && (
            <Animated.View style={[styles.colorSection, colorsStyle, { marginTop: scaleHeight(80) }]}>
              {/* Journal Preview */}
              <View style={styles.journalPreview}>
                <LiveJournalCanvas
                  date={formatDateForPreview(date)}
                  location={location}
                  text={text}
                  locationColor={selectedColor}
                  images={images}
                  canvasWidth={CANVAS_WIDTH}
                  canvasHeight={CANVAS_HEIGHT}
                />
              </View>

              {/* Color Picker Below Preview */}
              <Text style={styles.colorLabel}>
                {isExtracting ? 'Extracting colors from your photos...' : 'Choose a color'}
              </Text>
              {isExtracting ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              ) : (
                <View style={styles.colorPickerContainer}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.colorScroll}
                    style={styles.colorScrollView}
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
                </View>
              )}
            </Animated.View>
          )}
        </View>

        </View>
      </ScrollView>

      {/* Navigation Buttons - Fixed at bottom */}
      <Animated.View style={[
        buttonsStyle,
        {
          position: 'absolute',
          bottom: keyboardHeight > 0 ? keyboardHeight + 20 : Math.max(insets.bottom, 20),
          left: 0,
          right: 0,
          alignItems: 'center',
        }
      ]}>
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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 200,
    minHeight: height - 150,
  },
  toggleContainer: {
    width: '100%',
    minHeight: 140,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputSection: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInputWrapper: {
    width: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: scaleFont(48),
    fontFamily: 'TitleFont',
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: -0.5,
    position: 'absolute',
    width: '100%',
    top: scaleHeight(20),
  },
  tapToEditText: {
    fontSize: scaleFont(13),
    fontFamily: 'ZainCustomFont',
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.3)',
    position: 'absolute',
    width: '100%',
    top: scaleHeight(70),
    letterSpacing: 0.5,
  },
  locationInput: {
    width: '100%',
    fontSize: scaleFont(38),
    fontFamily: 'TitleFont',
    textAlign: 'center',
    paddingVertical: scaleHeight(20),
    paddingHorizontal: scaleWidth(20),
    borderRadius: scaleSize(16),
    backgroundColor: 'transparent',
    borderWidth: 0,
    letterSpacing: -0.5,
    zIndex: 1,
  },
  colorSection: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  journalPreview: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  colorLabel: {
    fontSize: 14,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 1,
  },
  colorPickerContainer: {
    width: '100%',
    alignItems: 'center',
  },
  colorScrollView: {
    width: '100%',
  },
  colorScroll: {
    paddingHorizontal: 24,
    gap: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  loadingContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOption: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
    gap: 4,
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
    flex: 1,
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
