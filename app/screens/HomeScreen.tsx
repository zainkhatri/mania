import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Video, ResizeMode } from 'expo-av';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [highlightIndex, setHighlightIndex] = useState(0);
  const videoRef = React.useRef<Video>(null);

  // Animation values
  const opacity = useSharedValue(0);

  useEffect(() => {
    console.log('🏠 Intro screen mounted');
    
    // Random letter highlight animation
    const styleInterval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * 5);
      setHighlightIndex(randomIndex);
    }, 200);

    // Intro animation sequence
    // Everything fades in together (0-1.5s)
    opacity.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) });

    // Navigate directly to journal creation after 4 seconds
    const navigationTimer = setTimeout(() => {
      navigation.replace('Journal', {} as any);
    }, 4000);

    return () => {
      clearInterval(styleInterval);
      clearTimeout(navigationTimer);
    };
  }, []);

  // Exact rendering from web app - letter-highlight vs letter-normal
  const renderTitle = () => {
    const word = "mania";

    return (
      <View style={styles.titleContainer}>
        {word.split('').map((letter, index) => (
          <Text
            key={`letter-${index}-${highlightIndex}`}
            style={index === highlightIndex ? styles.letterHighlight : styles.letterNormal}
          >
            {index === highlightIndex ? letter.toLowerCase() : letter.toUpperCase()}
          </Text>
        ))}
      </View>
    );
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {/* Static video background */}
      <Video
        ref={videoRef}
        source={require('../../assets/videos/static.mp4')}
        style={styles.videoBackground}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />

      {/* Dark overlay for readability */}
      <View style={styles.overlay} />

      {/* Content - Title */}
      <View style={styles.content}>
        <View style={styles.textFlicker}>
          {renderTitle()}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoBackground: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    position: 'relative',
    zIndex: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  // Normal letter style (ZainCustomFont equivalent)
  letterNormal: {
    fontSize: 96,
    color: '#ffffff',
    fontFamily: 'ZainCustomFont',
    fontWeight: '400',
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255, 255, 255, 0.1)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  // Highlighted letter style (Libre Baskerville equivalent)
  letterHighlight: {
    fontSize: 96,
    color: '#ffffff',
    fontFamily: 'LibreBaskerville',
    fontWeight: '400',
    textTransform: 'lowercase',
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  textFlicker: {
    // Text flicker animation
  },
});
