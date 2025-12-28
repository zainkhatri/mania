import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Pressable,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getPublicFeed, getFriendsFeed } from '../services/feedService';
import { FeedItem } from '../types/models';
import LiveJournalCanvas from '../components/LiveJournalCanvas';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { haptics } from '../utils/haptics';
import { scaleFont, scaleHeight, scaleWidth, scaleSize } from '../utils/responsive';

const { width } = Dimensions.get('window');
// Detect if device is a tablet (iPad)
const isTablet = width >= 768;
// For tablets, cap the card width to maintain readable size
const CARD_WIDTH = isTablet ? Math.min(width * 0.7, 400) : 340;
const CARD_HEIGHT = CARD_WIDTH * (2620 / 1860);

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

type FeedTabType = 'friends' | 'public';

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = useState<FeedTabType>('friends');
  const [journals, setJournals] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFeed = async () => {
    try {
      if (activeTab === 'friends' && user?.uid) {
        const friendsFeed = await getFriendsFeed(user.uid);
        setJournals(friendsFeed);
      } else {
        const publicFeed = await getPublicFeed();
        setJournals(publicFeed);
      }
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadFeed();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, activeTab]);

  const handleTabChange = (tab: FeedTabType) => {
    haptics.light();
    setActiveTab(tab);
    setLoading(true);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadFeed();
  };

  const handleSignIn = () => {
    haptics.medium();
    (navigation as any).navigate('SignIn');
  };

  const handleProfilePress = () => {
    haptics.light();
    (navigation as any).navigate('Profile');
  };

  const renderJournalCard = ({ item }: { item: FeedItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {(item.userDisplayName || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>{item.userDisplayName || 'Anonymous'}</Text>
        </View>
        <View style={styles.privacyBadge}>
          <Text style={styles.privacyText}>
            {item.privacy === 'public' ? '🌍' : item.privacy === 'friends' ? '👥' : '🔒'}
          </Text>
        </View>
      </View>
      <LiveJournalCanvas
        date={formatDate(new Date(item.date))}
        location={item.location || ''}
        text={item.text}
        locationColor={item.colors.locationColor}
        images={item.images}
        canvasWidth={CARD_WIDTH}
        canvasHeight={CARD_HEIGHT}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading feed...</Text>
      </View>
    );
  }

  // Show sign-in prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        <View style={[styles.titleContainer, { top: insets.top + scaleHeight(20) }]}>
          <Text style={styles.title}>What's happening?</Text>
        </View>

        <View style={[styles.signInRequired, { paddingTop: insets.top + 70 }]}>
          <Ionicons name="people-outline" size={80} color="#fff" style={styles.icon} />
          <Text style={styles.signInTitle}>Sign in to see the feed</Text>
          <Text style={styles.signInSubtext}>
            Connect with friends and share{'\n'}
            your journals with the community
          </Text>
          
          <Pressable
            style={({ pressed }) => [
              styles.signInButton,
              pressed && styles.signInButtonPressed,
            ]}
            onPress={handleSignIn}
          >
            <Text style={styles.signInButtonText}>Sign In with Apple</Text>
          </Pressable>
        </View>

        <BottomNav activeTab="feed" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Title - Matching Journal Screen Style */}
      <View style={[styles.titleContainer, { top: insets.top + scaleHeight(20) }]}>
        <Text style={styles.title}>What's happening?</Text>
        {isAuthenticated && (
          <TouchableOpacity
            onPress={handleProfilePress}
            style={styles.profileButton}
            activeOpacity={0.7}
          >
            <Ionicons name="person-circle-outline" size={32} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Feed Tabs */}
      <View style={[styles.tabsContainer, { top: insets.top + 60 }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
          onPress={() => handleTabChange('friends')}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
            Friends
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'public' && styles.tabActive]}
          onPress={() => handleTabChange('public')}
        >
          <Text style={[styles.tabText, activeTab === 'public' && styles.tabTextActive]}>
            Public
          </Text>
        </TouchableOpacity>
      </View>

      {/* Feed List */}
      {journals.length === 0 ? (
        <View style={[styles.emptyState, { paddingTop: insets.top + 120 }]}>
          <Text style={styles.emptyText}>
            {activeTab === 'friends' ? 'No posts from friends' : 'No public posts yet'}
          </Text>
          <Text style={styles.emptySubtext}>
            {activeTab === 'friends'
              ? 'Connect with friends to see their journals'
              : 'Be the first to share your journal!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={journals}
          renderItem={renderJournalCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: insets.top + 120, paddingBottom: 100 }
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#fff"
            />
          }
        />
      )}

      {/* Bottom Navigation */}
      <BottomNav activeTab="feed" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 16,
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: scaleFont(32),
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -1,
    textAlign: 'center',
  },
  profileButton: {
    padding: 4,
  },
  tabsContainer: {
    position: 'absolute',
    left: 24,
    right: 24,
    zIndex: 10,
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  tabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'TitleFont',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: -0.5,
  },
  tabTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 20,
  },
  card: {
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f5f2e9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontFamily: 'TitleFont',
    color: '#000',
  },
  userName: {
    fontSize: 15,
    fontFamily: 'TitleFont',
    color: '#000',
    letterSpacing: -0.5,
  },
  privacyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  privacyText: {
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 24,
    fontFamily: 'TitleFont',
    color: '#fff',
    marginBottom: 12,
  },
  emptySubtext: {
    fontSize: 16,
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  signInRequired: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  icon: {
    opacity: 0.3,
    marginBottom: 24,
  },
  signInTitle: {
    fontSize: 24,
    fontFamily: 'TitleFont',
    color: '#fff',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  signInSubtext: {
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

