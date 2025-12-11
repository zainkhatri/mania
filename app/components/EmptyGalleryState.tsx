import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function EmptyGalleryState() {
  return (
    <View style={styles.container}>
      <Ionicons name="book-outline" size={80} color="#fff" style={styles.icon} />
      <Text style={styles.title}>No journals yet</Text>
      <Text style={styles.subtitle}>
        Tap + to create your{'\n'}first journal
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    opacity: 0.3,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'TitleFont',
    color: '#fff',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 24,
  },
});
