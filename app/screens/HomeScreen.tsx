import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Video, ResizeMode } from 'expo-av';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [highlightIndex, setHighlightIndex] = useState(0);

  // Random letter highlight animation
  useEffect(() => {
    const styleInterval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * 5);
      setHighlightIndex(randomIndex);
    }, 200);

    return () => {
      clearInterval(styleInterval);
    };
  }, []);

  const handleStart = () => {
    navigation.navigate('Journal');
  };

  const handleViewGallery = () => {
    navigation.navigate('Gallery');
  };

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
            {letter}
          </Text>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Static video background */}
      <Video
        source={require('../../assets/videos/static.webm')}
        style={styles.videoBackground}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />

      {/* Dark overlay for readability */}
      <View style={styles.overlay} />

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.textFlicker}>
          {renderTitle()}
        </View>

        <Text style={styles.subtitle}>
          Create zain's journals without the pen in your hand.
        </Text>

        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStart}
          activeOpacity={0.85}
        >
          <Text style={styles.arrow}>↓</Text>
          <Text style={styles.startButtonText}>Start Journaling</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.galleryButton}
          onPress={handleViewGallery}
          activeOpacity={0.9}
        >
          <Text style={styles.galleryButtonText}>View Gallery</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
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
    marginBottom: 24,
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
  subtitle: {
    fontSize: 20,
    fontFamily: 'TitleFont',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 48,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    maxWidth: 340,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 40,
    paddingVertical: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  arrow: {
    fontSize: 28,
    color: '#fff',
    marginRight: 12,
  },
  startButtonText: {
    fontSize: 28,
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
  },
  galleryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  galleryButtonText: {
    fontSize: 16,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.7)',
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(255, 255, 255, 0.4)',
  },
});
