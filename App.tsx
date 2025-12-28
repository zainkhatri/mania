import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AppNavigator from './app/navigation/AppNavigator';
import useFonts from './app/hooks/useFonts';
import { AuthProvider } from './app/contexts/AuthContext';
import { initFirebase } from './app/services/firebaseService';

export default function App() {
  const fontsLoaded = useFonts();

  useEffect(() => {
    // Initialize Firebase when app starts
    initFirebase();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <AppNavigator />
      <StatusBar style="light" />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
