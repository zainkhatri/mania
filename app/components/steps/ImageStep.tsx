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
} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { haptics } from '../../utils/haptics';
import LiveJournalCanvas from '../LiveJournalCanvas';

const { width, height } = Dimensions.get('window');

// Calculate display dimensions to fit full page on screen
const ASPECT_RATIO = 2620 / 1860;
// Account for: progress bar (60) + instruction (30) + buttons/helper (70) = 160
const AVAILABLE_HEIGHT = height - 160;
const AVAILABLE_WIDTH = width - 32;

// Size based on height constraint to ensure full page is visible
const DISPLAY_CANVAS_HEIGHT = AVAILABLE_HEIGHT;
const DISPLAY_CANVAS_WIDTH = DISPLAY_CANVAS_HEIGHT / ASPECT_RATIO;

// If width is still too large, constrain by width instead
const MAX_WIDTH = AVAILABLE_WIDTH;
const FINAL_CANVAS_WIDTH = Math.min(DISPLAY_CANVAS_WIDTH, MAX_WIDTH);
const FINAL_CANVAS_HEIGHT = FINAL_CANVAS_WIDTH * ASPECT_RATIO;

// Web canvas dimensions (for storage)
const WEB_CANVAS_WIDTH = 1860;
const WEB_CANVAS_HEIGHT = 2620;

// Scale factor to convert between display and web coordinates
const CANVAS_SCALE = DISPLAY_CANVAS_WIDTH / WEB_CANVAS_WIDTH;

interface ImageStepProps {
  images: { uri: string; x: number; y: number; scale: number }[];
  onChangeImages: (images: { uri: string; x: number; y: number; scale: number }[]) => void;
  onNext: () => void;
  onBack: () => void;
  location?: string;
  date?: Date;
  text?: string;
}

interface DraggableImageProps {
  uri: string;
  index: number;
  x: number;
  y: number;
  scale: number;
  onUpdate: (index: number, x: number, y: number, scale: number) => void;
  onRemove: () => void;
  canvasWidth: number;
  canvasHeight: number;
  isSelected: boolean;
  onSelect: () => void;
}

function DraggableImage({
  uri,
  index,
  x,
  y,
  scale,
  onUpdate,
  onRemove,
  canvasWidth,
  canvasHeight,
  isSelected,
  onSelect,
}: DraggableImageProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [lastPinchDistance, setLastPinchDistance] = useState(0);
  const imageSize = 150;

  // Calculate distance between two touches for pinch gesture
  const getTouchDistance = (touches: any) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    const dx = touch1.pageX - touch2.pageX;
    const dy = touch1.pageY - touch2.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: any) => {
    e.stopPropagation();
    onSelect();
    haptics.light();

    const touch = e.nativeEvent.touches[0];
    setTouchStart({ x: touch.pageX, y: touch.pageY });

    if (e.nativeEvent.touches.length === 2) {
      setLastPinchDistance(getTouchDistance(e.nativeEvent.touches));
      setIsPinching(true);
    }
  };

  const handleTouchMove = (e: any) => {
    e.stopPropagation();
    const touches = e.nativeEvent.touches;

    if (touches.length === 1 && !isPinching) {
      // Single touch - drag
      const touch = touches[0];
      const deltaX = touch.pageX - touchStart.x;
      const deltaY = touch.pageY - touchStart.y;

      if (!isDragging && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
        setIsDragging(true);
      }

      // Calculate new position with bounds checking (in DISPLAY coordinates)
      const newDisplayX = Math.max(0, Math.min(canvasWidth - imageSize * scale, x + deltaX));
      const newDisplayY = Math.max(0, Math.min(canvasHeight - imageSize * scale, y + deltaY));

      // Update in real-time (EXACT same as OG)
      onUpdate(index, newDisplayX, newDisplayY, scale);

      // Update touch start for smooth dragging
      setTouchStart({ x: touch.pageX, y: touch.pageY });
    } else if (touches.length === 2) {
      // Two touches - pinch to resize
      const currentDistance = getTouchDistance(touches);
      if (lastPinchDistance > 0) {
        const scaleChange = currentDistance / lastPinchDistance;
        const newScale = Math.max(0.5, Math.min(3, scale * scaleChange));

        // Update in real-time
        onUpdate(index, x, y, newScale);
      }
      setLastPinchDistance(currentDistance);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setIsPinching(false);
    setLastPinchDistance(0);
  };

  return (
    <View
      style={[
        styles.draggableImage,
        {
          left: x,
          top: y,
          width: imageSize * scale,
          height: imageSize * scale,
          zIndex: isSelected ? 100 : 1,
          transform: [{ scale: isDragging || isPinching ? 1.05 : 1 }],
        },
      ]}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Image source={{ uri }} style={styles.image} />

      {/* Selection border */}
      {isSelected && (
        <View style={styles.selectionBorder} />
      )}

      {/* Remove Button */}
      {isSelected && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => {
            haptics.heavy();
            onRemove();
          }}
        >
          <Text style={styles.removeText}>×</Text>
        </TouchableOpacity>
      )}
    </View>
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

export default function ImageStep({ images, onChangeImages, onNext, onBack, location = '', date = new Date(), text = '' }: ImageStepProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 400 });
    scale.value = withTiming(1, { duration: 400 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
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

      // Initialize images at center of display canvas
      const newImages = result.assets.map((asset, idx) => ({
        uri: asset.uri,
        x: (DISPLAY_CANVAS_WIDTH / 2 - 75) + (idx * 20),  // Center with slight offset
        y: (DISPLAY_CANVAS_HEIGHT / 2 - 75) + (idx * 20), // Center with slight offset
        scale: 1,
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
    const updated = images.filter((_, i) => i !== index);
    onChangeImages(updated);
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, animatedStyle]}>
        <Text style={styles.instruction}>
          Add <Text style={styles.specialChar}>&</Text> arrange your photos
        </Text>

        {/* Live Journal Preview with Canvas Overlay */}
        <View style={styles.canvas}>
          <View style={styles.journalPreview}>
            <LiveJournalCanvas
              date={formatDate(date)}
              location={location}
              text={text}
              locationColor="#3498DB"
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
                  <Ionicons name="camera-outline" size={32} color="#fff" />
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
                    onUpdate={updateImage}
                    onRemove={() => removeImage(index)}
                    canvasWidth={DISPLAY_CANVAS_WIDTH}
                    canvasHeight={DISPLAY_CANVAS_HEIGHT}
                    isSelected={selectedIndex === index}
                    onSelect={() => setSelectedIndex(index)}
                  />
                ))}
              </>
            )}
          </View>
        </View>

        {/* Helper Text */}
        <Text style={styles.helperText}>
          {images.length === 0
            ? 'Add photos to your journal'
            : 'Drag to move • Pinch to resize'}
        </Text>

        {/* Add More Button */}
        {images.length > 0 && (
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
        )}

        {/* Continue Button */}
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
          <Text style={styles.continueText}>
            {images.length === 0 ? 'Skip for now' : 'Continue'}
          </Text>
        </Pressable>

        {/* Back Button */}
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
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  instruction: {
    fontSize: 22,
    fontFamily: 'TitleFont',
    color: '#fff',
    marginTop: 80,
    marginBottom: 16,
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
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    alignSelf: 'center',
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
    backgroundColor: '#000',
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 12,
  },
  addPhotosButtonPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    transform: [{ scale: 0.98 }],
  },
  addPhotosText: {
    fontSize: 18,
    fontFamily: 'TitleFont',
    color: '#fff',
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
  removeButton: {
    position: 'absolute',
    top: -12,
    right: -12,
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
  removeText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  helperText: {
    fontSize: 11,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginBottom: 8,
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 8,
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
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 48,
    borderRadius: 100,
    marginBottom: 8,
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
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  backText: {
    fontSize: 16,
    fontFamily: 'TitleFont',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: -0.5,
  },
});
