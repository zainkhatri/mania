import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { haptics } from '../utils/haptics';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, logout, deleteUserAccount, isAuthenticated } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleDeleteAccount = () => {
    // First confirmation
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => haptics.light(),
        },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            haptics.medium();
            // Second confirmation with detailed warning
            Alert.alert(
              'Permanently Delete Account',
              'This will permanently delete:\n\n• Your account and profile\n• All your journals and images\n• All your friendships and social connections\n\nThis action is irreversible. Are you absolutely sure?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => haptics.light(),
                },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    haptics.medium();
                    setDeletingAccount(true);
                    try {
                      await deleteUserAccount();
                      haptics.success();
                      Alert.alert(
                        'Account Deleted',
                        'Your account has been permanently deleted.',
                        [
                          {
                            text: 'OK',
                            onPress: () => {
                              haptics.light();
                              (navigation as any).navigate('Gallery');
                            },
                          },
                        ]
                      );
                    } catch (error) {
                      haptics.error();
                      Alert.alert(
                        'Error',
                        'Failed to delete account. Please try again or contact support if the problem persists.'
                      );
                    } finally {
                      setDeletingAccount(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You will no longer have access to the community feed.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => haptics.light(),
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            haptics.medium();
            setLoggingOut(true);
            try {
              await logout();
              haptics.success();
              (navigation as any).navigate('Gallery');
            } catch (error) {
              haptics.error();
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const handleBack = () => {
    haptics.light();
    navigation.goBack();
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.notSignedIn}>
          <Ionicons name="person-outline" size={80} color="#fff" style={styles.icon} />
          <Text style={styles.notSignedInTitle}>Not Signed In</Text>
          <Text style={styles.notSignedInText}>
            Sign in to access your profile{'\n'}and community features
          </Text>
          
          <Pressable
            style={({ pressed }) => [
              styles.signInButton,
              pressed && styles.signInButtonPressed,
            ]}
            onPress={() => {
              haptics.medium();
              (navigation as any).navigate('SignIn');
            }}
          >
            <Text style={styles.signInButtonText}>Sign In with Apple</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle-outline" size={80} color="#fff" />
          </View>
          
          {user?.fullName && (
            <Text style={styles.userName}>{user.fullName}</Text>
          )}
          
          {user?.email && (
            <Text style={styles.userEmail}>{user.email}</Text>
          )}
          
          <View style={styles.userIdContainer}>
            <Text style={styles.userIdLabel}>User ID</Text>
            <Text style={styles.userId} numberOfLines={1} ellipsizeMode="middle">
              {user?.id}
            </Text>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              pressed && styles.menuItemPressed,
            ]}
            onPress={() => {
              haptics.light();
              Alert.alert(
                'Privacy',
                'Your journals are private by default. You can choose to share them with friends or make them public in the future.',
                [{ text: 'OK', onPress: () => haptics.light() }]
              );
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color="#fff" />
            <Text style={styles.menuItemText}>Privacy Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              pressed && styles.menuItemPressed,
            ]}
            onPress={() => {
              haptics.light();
              Alert.alert(
                'About',
                'Mania Journal App\nVersion 1.0.0\n\nA beautiful space for your thoughts and memories.',
                [{ text: 'OK', onPress: () => haptics.light() }]
              );
            }}
          >
            <Ionicons name="information-circle-outline" size={24} color="#fff" />
            <Text style={styles.menuItemText}>About</Text>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              styles.deleteMenuItem,
              pressed && styles.menuItemPressed,
            ]}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
          >
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            <Text style={[styles.menuItemText, styles.deleteMenuItemText]}>
              {deletingAccount ? 'Deleting Account...' : 'Delete Account'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="rgba(255, 59, 48, 0.5)" />
          </Pressable>
        </View>

        {/* Sign Out Button */}
        <Pressable
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.signOutButtonPressed,
          ]}
          onPress={handleSignOut}
          disabled={loggingOut}
        >
          <Text style={styles.signOutButtonText}>
            {loggingOut ? 'Signing Out...' : 'Sign Out'}
          </Text>
        </Pressable>

        <Text style={styles.footerText}>
          Signed in with Apple
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontFamily: 'TitleFont',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  userEmail: {
    fontSize: 16,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 16,
  },
  userIdContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  userIdLabel: {
    fontSize: 12,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.4)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  userId: {
    fontSize: 11,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.5)',
    maxWidth: 250,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'TitleFont',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuItemPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    transform: [{ scale: 0.98 }],
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'ZainCustomFont',
    color: '#fff',
    marginLeft: 12,
  },
  deleteMenuItem: {
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  deleteMenuItemText: {
    color: '#FF3B30',
  },
  signOutButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  signOutButtonPressed: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    transform: [{ scale: 0.98 }],
  },
  signOutButtonText: {
    fontSize: 17,
    fontFamily: 'TitleFont',
    color: '#FF3B30',
    letterSpacing: -0.5,
  },
  footerText: {
    fontSize: 13,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
  notSignedIn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  icon: {
    opacity: 0.3,
    marginBottom: 24,
  },
  notSignedInTitle: {
    fontSize: 24,
    fontFamily: 'TitleFont',
    color: '#fff',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  notSignedInText: {
    fontSize: 16,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  signInButton: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 100,
    backgroundColor: '#fff',
  },
  signInButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    transform: [{ scale: 0.98 }],
  },
  signInButtonText: {
    fontSize: 17,
    fontFamily: 'TitleFont',
    color: '#000',
    letterSpacing: -0.5,
  },
});

