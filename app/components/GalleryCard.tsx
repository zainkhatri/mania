import React from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Journal } from '../services/journalService';
import { haptics } from '../utils/haptics';
import LiveJournalCanvas from './LiveJournalCanvas';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 16px padding on each side + 16px gap
const CANVAS_WIDTH = CARD_WIDTH * 2; // Render at 2x for better quality
const CANVAS_HEIGHT = CANVAS_WIDTH * (2620 / 1860); // Maintain aspect ratio

interface GalleryCardProps {
  journal: Journal;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
};

function GalleryCard({ journal, onPress }: GalleryCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    haptics.light();
    scale.value = withTiming(0.97, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const textPreview = journal.text.slice(0, 80) + (journal.text.length > 80 ? '...' : '');

  return (
    <AnimatedPressable
      style={[styles.card, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {/* Journal Thumbnail */}
      <View style={styles.thumbnail}>
        <View style={styles.canvasContainer}>
          <LiveJournalCanvas
            date={formatDate(journal.date).toUpperCase()}
            location={journal.location || ''}
            text={journal.text}
            locationColor={journal.colors.locationColor}
            images={journal.images}
            canvasWidth={CANVAS_WIDTH}
            canvasHeight={CANVAS_HEIGHT}
          />
        </View>
      </View>

      {/* Date Badge */}
      <View style={styles.dateBadge}>
        <Text style={styles.dateText}>{formatDate(journal.date)}</Text>
      </View>

      {/* Location Badge */}
      {journal.location && (
        <View style={[styles.locationBadge, { backgroundColor: journal.colors.locationColor + '40' }]}>
          <Ionicons name="location" size={12} color={journal.colors.locationColor} />
          <Text style={[styles.locationText, { color: journal.colors.locationColor }]} numberOfLines={1}>
            {journal.location}
          </Text>
        </View>
      )}

      {/* Bottom Gradient Overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0, 0, 0, 0.8)']}
        style={styles.gradientOverlay}
      >
        {/* Text Preview */}
        <Text style={styles.textPreview} numberOfLines={2}>
          {textPreview}
        </Text>

        {/* Photo Count */}
        {journal.images.length > 0 && (
          <View style={styles.photoCount}>
            <Ionicons name="image" size={14} color="#fff" />
            <Text style={styles.photoCountText}>{journal.images.length}</Text>
          </View>
        )}
      </LinearGradient>
    </AnimatedPressable>
  );
}

export default React.memo(GalleryCard);

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    aspectRatio: 1860 / 2620,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  canvasContainer: {
    transform: [{ scale: 0.5 }],
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    marginLeft: -(CANVAS_WIDTH / 2) + (CARD_WIDTH / 2),
    marginTop: -(CANVAS_HEIGHT / 2) + ((CARD_WIDTH * (2620 / 1860)) / 2),
  },
  dateBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dateText: {
    fontSize: 12,
    fontFamily: 'ZainCustomFont',
    color: '#fff',
    fontWeight: '600',
  },
  locationBadge: {
    position: 'absolute',
    top: 48,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: CARD_WIDTH - 24,
    gap: 4,
  },
  locationText: {
    fontSize: 10,
    fontFamily: 'ZainCustomFont',
    fontWeight: '600',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    justifyContent: 'flex-end',
    padding: 12,
  },
  textPreview: {
    fontSize: 11,
    fontFamily: 'ZainCustomFont',
    color: '#fff',
    lineHeight: 14,
    marginBottom: 4,
  },
  photoCount: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  photoCountText: {
    fontSize: 12,
    fontFamily: 'ZainCustomFont',
    color: '#fff',
    fontWeight: '600',
  },
});
