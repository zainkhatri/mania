import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Dimensions,
  Image,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { haptics } from '../../utils/haptics';
import LiveJournalCanvas from '../LiveJournalCanvas';

const { width, height } = Dimensions.get('window');

// Detect if device is a tablet (iPad)
const isTablet = width >= 768;

// Calculate display dimensions to fit full page on screen
const ASPECT_RATIO = 2620 / 1860;
// Account for: progress bar (60) + instruction (30) + buttons/helper (70) = 160
const AVAILABLE_HEIGHT = height - 160;
const AVAILABLE_WIDTH = width - 32;

// For tablets, cap the journal size to maintain phone-like proportions
// Use 70% of available height for tablets to ensure it fits nicely
const MAX_TABLET_HEIGHT = AVAILABLE_HEIGHT * 0.7;
const MAX_PHONE_HEIGHT = AVAILABLE_HEIGHT;

// Size based on height constraint to ensure full page is visible
const DISPLAY_CANVAS_HEIGHT = isTablet ? MAX_TABLET_HEIGHT : MAX_PHONE_HEIGHT;
const DISPLAY_CANVAS_WIDTH = DISPLAY_CANVAS_HEIGHT / ASPECT_RATIO;

// If width is still too large, constrain by width instead
const MAX_WIDTH = AVAILABLE_WIDTH;
const FINAL_CANVAS_WIDTH = Math.min(DISPLAY_CANVAS_WIDTH, MAX_WIDTH);
const FINAL_CANVAS_HEIGHT = FINAL_CANVAS_WIDTH * ASPECT_RATIO;

// Match the canvas size from JournalDetailScreen for consistency
const CANVAS_WIDTH = FINAL_CANVAS_WIDTH;
const CANVAS_HEIGHT = FINAL_CANVAS_HEIGHT;

// Web canvas dimensions (for storage)
const WEB_CANVAS_WIDTH = 1860;
const WEB_CANVAS_HEIGHT = 2620;

// Scale factor to convert between display and web coordinates
const CANVAS_SCALE = CANVAS_WIDTH / WEB_CANVAS_WIDTH;

interface ImageStepProps {
  images: { uri: string; x: number; y: number; scale: number; width: number; height: number }[];
  onChangeImages: (images: { uri: string; x: number; y: number; scale: number; width: number; height: number }[]) => void;
  onNext: () => void;
  onBack: () => void;
  location?: string;
  date?: Date;
  text?: string;
  locationColor?: string;
}

interface DraggableImageProps {
  uri: string;
  index: number;
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
  onUpdate: (index: number, x: number, y: number, scale: number) => void;
  onRemove: () => void;
  canvasWidth: number;
  canvasHeight: number;
  isSelected: boolean;
  onSelect: () => void;
  isRemoving: boolean;
}

function DraggableImage({
  uri,
  index,
  x,
  y,
  scale,
  width,
  height,
  onUpdate,
  onRemove,
  canvasWidth,
  canvasHeight,
  isSelected,
  onSelect,
  isRemoving,
}: DraggableImageProps) {
  // Calculate display size preserving aspect ratio
  // Base the size on a 150px reference, maintaining aspect ratio
  const aspectRatio = width / height;
  const baseSize = 150;
  let displayWidth: number;
  let displayHeight: number;

  if (aspectRatio > 1) {
    // Landscape
    displayWidth = baseSize;
    displayHeight = baseSize / aspectRatio;
  } else {
    // Portrait or square
    displayHeight = baseSize;
    displayWidth = baseSize * aspectRatio;
  }
  
  // Animated values for position and scale
  const translateX = useSharedValue(x ?? 0);
  const translateY = useSharedValue(y ?? 0);
  const imageScale = useSharedValue(scale ?? 1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const isDragging = useSharedValue(false);
  const isResizing = useSharedValue(false);
  
  // Entrance/Exit animation
  const entranceOpacity = useSharedValue(0);
  const entranceScale = useSharedValue(0.5);

  // Trigger entrance animation on mount
  useEffect(() => {
    entranceOpacity.value = withTiming(1, { duration: 400 });
    entranceScale.value = withTiming(1, { duration: 400 });
  }, []);
  
  // Trigger exit animation when removing
  useEffect(() => {
    if (isRemoving) {
      entranceOpacity.value = withTiming(0, { duration: 250 });
      entranceScale.value = withTiming(0.5, { duration: 250 });
    }
  }, [isRemoving]);

  const handleSelect = () => {
    onSelect();
    haptics.light();
  };

  // Tap gesture to select image immediately
  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => {
      runOnJS(handleSelect)();
    });

  // Pan gesture for moving the image
  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
      isDragging.value = true;
      runOnJS(handleSelect)();
    })
    .onUpdate((event) => {
      // Calculate new position with bounds checking, using the larger dimension for boundary
      const scaledWidth = displayWidth * imageScale.value;
      const scaledHeight = displayHeight * imageScale.value;
      const newX = Math.max(0, Math.min(canvasWidth - scaledWidth, startX.value + event.translationX));
      const newY = Math.max(0, Math.min(canvasHeight - scaledHeight, startY.value + event.translationY));

      translateX.value = newX;
      translateY.value = newY;
    })
    .onEnd(() => {
      isDragging.value = false;
      runOnJS(onUpdate)(index, translateX.value, translateY.value, imageScale.value);
    });

  // Combine tap and pan gestures - race to see which recognizes first
  const combinedGesture = Gesture.Race(tapGesture, panGesture);

  // Resize gesture for the bottom-right handle
  const resizeGesture = Gesture.Pan()
    .onStart(() => {
      startScale.value = imageScale.value;
      startX.value = translateX.value; // Use current animated values
      startY.value = translateY.value;
      isResizing.value = true;
      runOnJS(haptics.light)();
    })
    .onUpdate((event) => {
      // Calculate new scale based on diagonal movement
      const diagonal = Math.sqrt(event.translationX ** 2 + event.translationY ** 2);
      const direction = event.translationX + event.translationY > 0 ? 1 : -1;
      const scaleChange = (diagonal * direction) / 100;

      // Calculate max scale based on canvas boundaries and START position with 5px margin
      const MARGIN = 5;
      const maxScaleByWidth = (canvasWidth - startX.value - MARGIN) / displayWidth;
      const maxScaleByHeight = (canvasHeight - startY.value - MARGIN) / displayHeight;
      const maxAllowedScale = Math.min(maxScaleByWidth, maxScaleByHeight);

      const newScale = Math.max(0.5, Math.min(maxAllowedScale, startScale.value + scaleChange));
      imageScale.value = newScale;

      // Keep image position fixed at start position while resizing
      translateX.value = startX.value;
      translateY.value = startY.value;
    })
    .onEnd(() => {
      isResizing.value = false;
      runOnJS(onUpdate)(index, translateX.value, translateY.value, imageScale.value);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: entranceOpacity.value,
    width: displayWidth * imageScale.value,
    height: displayHeight * imageScale.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: entranceScale.value },
    ],
  }));


  return (
    <Pressable
      onPress={() => {
        handleSelect();
      }}
    >
      <GestureDetector gesture={combinedGesture}>
        <Animated.View
          style={[
            styles.draggableImage,
            {
              zIndex: isSelected ? 100 : 1,
            },
            animatedStyle,
          ]}
        >
          <Image source={{ uri }} style={styles.image} />

        {/* Selection border */}
        {isSelected && (
          <View style={styles.selectionBorder} />
        )}

        {/* Delete Button - Top Left */}
        {isSelected && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => {
              haptics.heavy();
              onRemove();
            }}
          >
            <Text style={styles.deleteText}>×</Text>
          </TouchableOpacity>
        )}

        {/* Resize Handle - Bottom Right */}
        {isSelected && (
          <GestureDetector gesture={resizeGesture}>
            <Animated.View style={styles.resizeHandle}>
              <View style={styles.resizeIcon}>
                <View style={styles.resizeDot} />
                <View style={styles.resizeDot} />
                <View style={styles.resizeDot} />
              </View>
            </Animated.View>
          </GestureDetector>
        )}
        </Animated.View>
      </GestureDetector>
    </Pressable>
  );
}

const formatDate = (date: Date): string => {
  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return 'TH';
    switch (day % 10) {
      case 1: return 'ST';
      case 2: return 'ND';
      case 3: return 'RD';
      default: return 'TH';
    }
  };

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  let dateStr = date.toLocaleDateString('en-US', options);
  const day = date.getDate();
  const ordinal = getOrdinalSuffix(day);
  dateStr = dateStr.replace(/(\d+)/, `$1${ordinal}`);
  return dateStr.toUpperCase();
};

export default function ImageStep({ images, onChangeImages, onNext, onBack, location = '', date = new Date(), text = '', locationColor = '#3498DB' }: ImageStepProps) {
  const insets = useSafeAreaInsets();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  
  // Button animation values
  const addMoreOpacity = useSharedValue(0);
  const addMoreTranslateY = useSharedValue(20);
  const buttonsOpacity = useSharedValue(1);
  const buttonsScale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 400 });
    scale.value = withTiming(1, { duration: 400 });
  }, []);

  // Animate buttons when images change
  useEffect(() => {
    if (images.length > 0) {
      // Fade in "Add More Photos" button
      addMoreOpacity.value = withTiming(1, { duration: 300 });
      addMoreTranslateY.value = withTiming(0, { duration: 300 });
      
      // Animate button transition
      buttonsOpacity.value = withTiming(0, { duration: 150 }, () => {
        buttonsScale.value = 0.95;
        buttonsOpacity.value = withTiming(1, { duration: 200 });
        buttonsScale.value = withTiming(1, { duration: 200 });
      });
    } else {
      // Reset animations when no images
      addMoreOpacity.value = 0;
      addMoreTranslateY.value = 20;
      buttonsOpacity.value = 1;
      buttonsScale.value = 1;
    }
  }, [images.length]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  
  const addMoreAnimatedStyle = useAnimatedStyle(() => ({
    opacity: addMoreOpacity.value,
    transform: [{ translateY: addMoreTranslateY.value }],
  }));
  
  const buttonsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
    transform: [{ scale: buttonsScale.value }],
  }));

  const handlePickImages = async () => {
    haptics.light();

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      haptics.error();
      Alert.alert('Permission Required', 'We need access to your photos!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      haptics.success();

      // Initialize images at center of canvas with original dimensions
      const newImages = result.assets.map((asset, idx) => ({
        uri: asset.uri,
        x: (FINAL_CANVAS_WIDTH / 2 - 75) + (idx * 20),  // Center with slight offset
        y: (FINAL_CANVAS_HEIGHT / 2 - 75) + (idx * 20), // Center with slight offset
        scale: 1,
        width: asset.width,
        height: asset.height,
      }));

      onChangeImages([...images, ...newImages]);
    }
  };

  const updateImage = (index: number, x: number, y: number, scale: number) => {
    const updated = [...images];
    updated[index] = { ...updated[index], x, y, scale };
    onChangeImages(updated);
  };

  const removeImage = (index: number) => {
    // Mark image as being removed for animation
    setRemovingIndex(index);
    
    // Wait for animation to complete before actually removing
    setTimeout(() => {
      const updated = images.filter((_, i) => i !== index);
      onChangeImages(updated);
      setRemovingIndex(null);
      
      // If removing the last image, animate buttons back with POP effect
      if (updated.length === 0) {
        addMoreOpacity.value = withTiming(0, { duration: 200 });
        addMoreTranslateY.value = withTiming(20, { duration: 200 });
        
        // Fade out current buttons
        buttonsOpacity.value = withTiming(0, { duration: 150 }, () => {
          // Start from small scale
          buttonsScale.value = 0.7;
          // Pop in with spring animation
          buttonsOpacity.value = withTiming(1, { duration: 150 });
          buttonsScale.value = withSpring(1, {
            damping: 12,
            stiffness: 200,
            mass: 0.8,
          });
        });
      }
    }, 250);
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, animatedStyle, { paddingTop: insets.top + 10 }]}>
        {/* Live Journal Preview with Canvas Overlay */}
        <View style={styles.canvas}>
          <View style={styles.journalPreview}>
            <LiveJournalCanvas
              date={formatDate(date)}
              location={location}
              text={text}
              locationColor={locationColor}
              images={images} // Pass images for text wrapping calculations
              hideImages={true} // But hide them visually - we render draggable overlays instead
              canvasWidth={FINAL_CANVAS_WIDTH}
              canvasHeight={FINAL_CANVAS_HEIGHT}
            />
          </View>

          {/* Overlay for image arrangement */}
          <View
            style={styles.imageOverlay}
            onTouchStart={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedIndex(null);
              }
            }}
          >
            {images.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Pressable
                  style={({ pressed }) => [
                    styles.addPhotosButton,
                    pressed && styles.addPhotosButtonPressed,
                  ]}
                  onPress={handlePickImages}
                >
                  <Ionicons name="camera-outline" size={32} color="#000" />
                  <Text style={styles.addPhotosText}>Tap to add photos</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {images.map((img, index) => (
                  <DraggableImage
                    key={`${img.uri}-${index}`}
                    uri={img.uri}
                    index={index}
                    x={img.x}
                    y={img.y}
                    scale={img.scale}
                    width={img.width}
                    height={img.height}
                    onUpdate={updateImage}
                    onRemove={() => removeImage(index)}
                    canvasWidth={FINAL_CANVAS_WIDTH}
                    canvasHeight={FINAL_CANVAS_HEIGHT}
                    isSelected={selectedIndex === index}
                    onSelect={() => setSelectedIndex(index)}
                    isRemoving={removingIndex === index}
                  />
                ))}
              </>
            )}
          </View>
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          {/* Add More Button - only show when images exist */}
          {images.length > 0 && (
            <Animated.View style={addMoreAnimatedStyle}>
              <Pressable
                style={({ pressed }) => [
                  styles.addMoreButton,
                  pressed && styles.addMoreButtonPressed,
                ]}
                onPress={handlePickImages}
              >
                <Ionicons name="add-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.addMoreText}>Add More Photos</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Navigation Buttons - side by side when images exist */}
          <Animated.View style={[{ width: '100%', alignItems: 'center' }, buttonsAnimatedStyle]}>
            {images.length > 0 ? (
              <View style={styles.navigationButtons}>
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
                  onPress={() => {
                    haptics.medium();
                    onNext();
                  }}
                >
                  <Text style={styles.continueText}>Continue</Text>
                </Pressable>
              </View>
            ) : (
              /* Side-by-side buttons when no images */
              <View style={styles.navigationButtons}>
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
                  onPress={() => {
                    haptics.medium();
                    onNext();
                  }}
                >
                  <Text style={styles.continueText}>Skip for now</Text>
                </Pressable>
              </View>
            )}
          </Animated.View>
        </View>
      </Animated.View>
    </View>
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
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 100,
    paddingBottom: 30,
  },
  instruction: {
    fontSize: 15,
    fontFamily: 'TitleFont',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  specialChar: {
    fontFamily: 'ZainCustomFont',
  },
  canvas: {
    width: FINAL_CANVAS_WIDTH,
    height: FINAL_CANVAS_HEIGHT,
    borderRadius: 12,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomControls: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
    marginTop: 7,
  },
  navigationButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 4,
    paddingHorizontal: 0,
  },
  journalPreview: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    overflow: 'visible',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    overflow: 'hidden',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 100,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addPhotosButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    transform: [{ scale: 0.97 }],
  },
  addPhotosText: {
    fontSize: 18,
    fontFamily: 'TitleFont',
    color: '#000',
    letterSpacing: -0.5,
  },
  draggableImage: {
    position: 'absolute',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  selectionBorder: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderWidth: 3,
    borderColor: '#007AFF',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  deleteButton: {
    position: 'absolute',
    top: -12,
    left: -12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  deleteText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  resizeHandle: {
    position: 'absolute',
    bottom: -12,
    right: -12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  resizeIcon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 12,
    height: 12,
    gap: 2,
  },
  resizeDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#fff',
  },
  helperText: {
    fontSize: 14,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  addMoreButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ scale: 0.97 }],
  },
  addMoreText: {
    fontSize: 15,
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
  },
  continueButton: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 100,
    alignItems: 'center',
  },
  continueButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    transform: [{ scale: 0.98 }],
  },
  continueText: {
    fontSize: 16,
    fontFamily: 'TitleFont',
    color: '#000',
    letterSpacing: -0.5,
  },
  backButton: {
    flex: 1,
    paddingVertical: 14,
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
    fontSize: 16,
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
  },
});
