import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withTiming 
} from 'react-native-reanimated';
import MinimalGalleryIcon from './MinimalGalleryIcon';
import MinimalFeedIcon from './MinimalFeedIcon';
import MinimalFriendsIcon from './MinimalFriendsIcon';
import { haptics } from '../utils/haptics';

interface BottomNavProps {
  activeTab: 'journal' | 'gallery' | 'feed' | 'friends';
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const journalScale = useSharedValue(1);
  const galleryScale = useSharedValue(1);
  const feedScale = useSharedValue(1);
  const friendsScale = useSharedValue(1);

  const handleJournalPress = () => {
    if (activeTab === 'journal') return;
    haptics.light();
    journalScale.value = withSpring(0.9, { damping: 10 }, () => {
      journalScale.value = withSpring(1, { damping: 10 });
    });
    (navigation as any).navigate('Journal');
  };

  const handleGalleryPress = () => {
    if (activeTab === 'gallery') return;
    haptics.light();
    galleryScale.value = withSpring(0.9, { damping: 10 }, () => {
      galleryScale.value = withSpring(1, { damping: 10 });
    });
    (navigation as any).navigate('Gallery');
  };

  const handleFeedPress = () => {
    if (activeTab === 'feed') return;
    haptics.light();
    feedScale.value = withSpring(0.9, { damping: 10 }, () => {
      feedScale.value = withSpring(1, { damping: 10 });
    });
    (navigation as any).navigate('Feed');
  };

  const handleFriendsPress = () => {
    if (activeTab === 'friends') return;
    haptics.light();
    friendsScale.value = withSpring(0.9, { damping: 10 }, () => {
      friendsScale.value = withSpring(1, { damping: 10 });
    });
    (navigation as any).navigate('Friends');
  };

  const journalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: journalScale.value }],
  }));

  const galleryAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: galleryScale.value }],
  }));

  const feedAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: feedScale.value }],
  }));

  const friendsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: friendsScale.value }],
  }));

  return (
    <View style={[styles.bottomNav, { paddingBottom: insets.bottom || 34 }]}>
      <TouchableOpacity
        style={styles.navTab}
        onPress={handleJournalPress}
        activeOpacity={1}
      >
        <Animated.View style={journalAnimatedStyle}>
          <View style={styles.navIconContainer}>
            <Text style={[styles.navIconText, activeTab === 'journal' && styles.navIconActive]}>✎</Text>
          </View>
          <Text style={[styles.navLabel, activeTab === 'journal' ? styles.navLabelActive : styles.navLabelInactive]}>
            Journal
          </Text>
        </Animated.View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navTab}
        onPress={handleGalleryPress}
        activeOpacity={1}
      >
        <Animated.View style={galleryAnimatedStyle}>
          <View style={styles.navIconContainer}>
            <MinimalGalleryIcon 
              size={24} 
              color={activeTab === 'gallery' ? '#fff' : 'rgba(255,255,255,0.5)'} 
            />
          </View>
          <Text style={[styles.navLabel, activeTab === 'gallery' ? styles.navLabelActive : styles.navLabelInactive]}>
            Gallery
          </Text>
        </Animated.View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navTab}
        onPress={handleFeedPress}
        activeOpacity={1}
      >
        <Animated.View style={feedAnimatedStyle}>
          <View style={styles.navIconContainer}>
            <MinimalFeedIcon
              size={24}
              color={activeTab === 'feed' ? '#fff' : 'rgba(255,255,255,0.5)'}
            />
          </View>
          <Text style={[styles.navLabel, activeTab === 'feed' ? styles.navLabelActive : styles.navLabelInactive]}>
            Feed
          </Text>
        </Animated.View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navTab}
        onPress={handleFriendsPress}
        activeOpacity={1}
      >
        <Animated.View style={friendsAnimatedStyle}>
          <View style={styles.navIconContainer}>
            <MinimalFriendsIcon
              size={24}
              color={activeTab === 'friends' ? '#fff' : 'rgba(255,255,255,0.5)'}
            />
          </View>
          <Text style={[styles.navLabel, activeTab === 'friends' ? styles.navLabelActive : styles.navLabelInactive]}>
            Friends
          </Text>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 12,
    paddingHorizontal: 20,
    justifyContent: 'space-around',
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconContainer: {
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconText: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  navIconActive: {
    color: '#fff',
  },
  navLabel: {
    fontSize: 11,
    fontFamily: 'TitleFont',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  navLabelActive: {
    color: '#fff',
  },
  navLabelInactive: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
});

