import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { useAuth } from '../contexts/AuthContext';
import { haptics } from '../utils/haptics';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, isAppleAuthSupported } = useAuth();
  const [loading, setLoading] = useState(false);

  // Animation values
  const titleOpacity = useSharedValue(0);
  const titleTranslate = useSharedValue(-20);
  const subtitleOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(0.8);

  React.useEffect(() => {
    // Staggered entrance animations
    titleOpacity.value = withTiming(1, { duration: 800 });
    titleTranslate.value = withSpring(0, { damping: 20, stiffness: 90 });

    subtitleOpacity.value = withDelay(200, withTiming(1, { duration: 800 }));

    buttonOpacity.value = withDelay(400, withTiming(1, { duration: 800 }));
    buttonScale.value = withDelay(400, withSpring(1, { damping: 20, stiffness: 90 }));
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslate.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ scale: buttonScale.value }],
  }));

  const handleSignIn = async () => {
    console.log('🍎 Sign In button pressed');

    haptics.medium();
    setLoading(true);

    try {
      await signIn();
      console.log('✅ Sign In successful');
      haptics.success();
    } catch (error: any) {
      console.error('❌ Sign In failed:', error);
      haptics.error();
      if (error.message !== 'Sign in was canceled') {
        Alert.alert('Sign In Failed', 'Unable to sign in with Apple. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        {/* Title */}
        <Animated.View style={[styles.titleSection, titleStyle]}>
          <Text style={styles.title}>Welcome to</Text>
          <Text style={styles.brandName}>mania</Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View style={[styles.subtitleSection, subtitleStyle]}>
          <Text style={styles.subtitle}>
            Sign in to share your journals, connect with friends, and explore the community feed
          </Text>
        </Animated.View>

        {/* Sign In Button */}
        <Animated.View style={[styles.buttonSection, buttonStyle]}>
          {isAppleAuthSupported ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={100}
              style={styles.appleButton}
              onPress={handleSignIn}
              disabled={loading}
            />
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.fallbackButton,
                pressed && styles.fallbackButtonPressed,
                loading && styles.fallbackButtonDisabled,
              ]}
              onPress={handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.fallbackButtonText}>Sign In with Apple</Text>
              )}
            </Pressable>
          )}

          <Text style={styles.disclaimer}>
            By signing in, you agree to share your journals with friends and the community
          </Text>
        </Animated.View>

        {/* Skip for now */}
        <Animated.View style={[styles.skipSection, buttonStyle]}>
          <Text style={styles.skipText}>
            You can explore your personal journals without signing in
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontFamily: 'TitleFont',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  brandName: {
    fontSize: 72,
    fontFamily: 'ZainCustomFont',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  subtitleSection: {
    marginBottom: 60,
    paddingHorizontal: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonSection: {
    width: '100%',
    alignItems: 'center',
  },
  appleButton: {
    width: '100%',
    height: 56,
    marginBottom: 20,
  },
  fallbackButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  fallbackButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    transform: [{ scale: 0.98 }],
  },
  fallbackButtonDisabled: {
    opacity: 0.6,
  },
  fallbackButtonText: {
    fontSize: 17,
    fontFamily: 'TitleFont',
    color: '#000',
    letterSpacing: -0.5,
  },
  disclaimer: {
    fontSize: 12,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  skipSection: {
    marginTop: 40,
    paddingHorizontal: 8,
  },
  skipText: {
    fontSize: 13,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },
});

