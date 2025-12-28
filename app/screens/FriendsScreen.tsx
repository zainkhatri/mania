import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getStoredUser } from '../services/authService';
import { haptics } from '../utils/haptics';
import { useAuth } from '../contexts/AuthContext';
import {
  getFriends,
  getPendingFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  searchUsers,
  sendFriendRequest,
  unfriend,
  getFriendSuggestions,
} from '../services/friendService';
import { UserSearchResult, FriendRequest } from '../types/models';
import UserCard from '../components/UserCard';
import FriendRequestCard from '../components/FriendRequestCard';
import BottomNav from '../components/BottomNav';
import { scaleFont, scaleHeight, scaleWidth, scaleSize } from '../utils/responsive';

type TabType = 'friends' | 'requests' | 'search';

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [userId, setUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<UserSearchResult[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId, activeTab]);

  const loadUser = async () => {
    const user = await getStoredUser();
    if (user?.uid) {
      setUserId(user.uid);
    }
    // If no user, the UI will show the sign-in prompt via !isAuthenticated check
  };

  const loadData = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      if (activeTab === 'friends') {
        const friendsList = await getFriends(userId);
        setFriends(friendsList);
      } else if (activeTab === 'requests') {
        const requests = await getPendingFriendRequests(userId);
        setFriendRequests(requests);
      } else if (activeTab === 'search' && !searchQuery) {
        const suggestionsList = await getFriendSuggestions(userId);
        setSuggestions(suggestionsList);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!userId || !query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const results = await searchUsers(query, userId);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (targetUserId: string, targetUserName: string, targetUserImage: string | null) => {
    if (!userId) return;

    try {
      const user = await getStoredUser();
      const userName = user?.displayName || user?.fullName || 'User';
      const userImage = user?.profileImageUrl || null;

      await sendFriendRequest(userId, userName, userImage, targetUserId);
      Alert.alert('Success', 'Friend request sent!');

      // Update search results to show request sent
      setSearchResults(prev =>
        prev.map(u => (u.uid === targetUserId ? { ...u, friendshipStatus: 'pending' } : u))
      );
      setSuggestions(prev =>
        prev.map(u => (u.uid === targetUserId ? { ...u, friendshipStatus: 'pending' } : u))
      );
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Could not send friend request');
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    if (!userId) return;

    try {
      await acceptFriendRequest(requestId, userId);
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
      Alert.alert('Success', 'Friend request accepted!');
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Could not accept friend request');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!userId) return;

    try {
      await rejectFriendRequest(requestId, userId);
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      Alert.alert('Error', 'Could not reject friend request');
    }
  };

  const handleUnfriend = async (friendId: string, friendName: string) => {
    if (!userId) return;

    Alert.alert(
      'Unfriend',
      `Are you sure you want to unfriend ${friendName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: async () => {
            try {
              await unfriend(userId, friendId);
              setFriends(prev => prev.filter(f => f.uid !== friendId));
              Alert.alert('Success', `You are no longer friends with ${friendName}`);
            } catch (error) {
              console.error('Error unfriending:', error);
              Alert.alert('Error', 'Could not unfriend user');
            }
          },
        },
      ]
    );
  };

  const handleSignIn = () => {
    haptics.medium();
    (navigation as any).navigate('SignIn');
  };

  const renderFriendActionButton = (user: UserSearchResult) => {
    if (user.friendshipStatus === 'friends') {
      return (
        <TouchableOpacity
          style={styles.unfriendButton}
          onPress={() => handleUnfriend(user.uid, user.displayName || 'User')}
        >
          <Text style={styles.unfriendButtonText}>Unfriend</Text>
        </TouchableOpacity>
      );
    } else if (user.friendshipStatus === 'pending') {
      return (
        <View style={styles.pendingButton}>
          <Text style={styles.pendingButtonText}>Pending</Text>
        </View>
      );
    } else {
      return (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleAddFriend(user.uid, user.displayName || 'User', user.profileImageUrl || null)}
        >
          <Text style={styles.addButtonText}>Add Friend</Text>
        </TouchableOpacity>
      );
    }
  };

  const renderFriendsTab = () => (
    <FlatList
      data={friends}
      keyExtractor={(item) => item.uid}
      renderItem={({ item }) => (
        <UserCard
          user={item}
          actionButton={renderFriendActionButton(item)}
          showFollowCounts={true}
        />
      )}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No friends yet</Text>
          <Text style={styles.emptySubtext}>
            Search for users to connect with
          </Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#fff"
        />
      }
    />
  );

  const renderRequestsTab = () => (
    <FlatList
      data={friendRequests}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <FriendRequestCard
          request={item}
          onAccept={handleAcceptRequest}
          onReject={handleRejectRequest}
        />
      )}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No pending requests</Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#fff"
        />
      }
    />
  );

  const renderSearchTab = () => {
    const displayData = searchQuery ? searchResults : suggestions;

    return (
      <>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <FlatList
          data={displayData}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => (
            <UserCard
              user={item}
              actionButton={renderFriendActionButton(item)}
              showFollowCounts={true}
            />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {searchQuery ? (
                <>
                  <Text style={styles.emptyText}>No users found</Text>
                  <Text style={styles.emptySubtext}>
                    Try searching for a different name
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.emptyText}>Suggested users</Text>
                  <Text style={styles.emptySubtext}>
                    Search for users to connect with
                  </Text>
                </>
              )}
            </View>
          }
        />
      </>
    );
  };

  // Show sign-in prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Friends</Text>
        </View>

        <View style={styles.signInRequired}>
          <Ionicons name="people-outline" size={80} color="#fff" style={styles.icon} />
          <Text style={styles.signInTitle}>Sign in to connect with friends</Text>
          <Text style={styles.signInSubtext}>
            Find and connect with friends{'\n'}
            to share your journals
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

        <BottomNav activeTab="friends" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.simpleHeader}>
        <Text style={styles.simpleHeaderTitle}>Friends</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
            Friends {friends.length > 0 && `(${friends.length})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
            Requests {friendRequests.length > 0 && `(${friendRequests.length})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'search' && styles.tabActive]}
          onPress={() => setActiveTab('search')}
        >
          <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>
            Search
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : (
        <>
          {activeTab === 'friends' && renderFriendsTab()}
          {activeTab === 'requests' && renderRequestsTab()}
          {activeTab === 'search' && renderSearchTab()}
        </>
      )}

      <BottomNav activeTab="friends" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: scaleWidth(20),
    paddingVertical: scaleHeight(16),
    borderBottomWidth: scaleSize(1),
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: scaleFont(32),
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -1,
    textAlign: 'center',
  },
  simpleHeader: {
    paddingHorizontal: scaleWidth(20),
    paddingVertical: scaleHeight(16),
    borderBottomWidth: scaleSize(1),
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  simpleHeaderTitle: {
    fontSize: scaleFont(32),
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -1,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: scaleWidth(20),
    paddingTop: scaleHeight(16),
    gap: scaleWidth(8),
  },
  tab: {
    flex: 1,
    paddingVertical: scaleHeight(12),
    alignItems: 'center',
    borderRadius: scaleSize(10),
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  tabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  tabText: {
    fontSize: scaleFont(14),
    fontFamily: 'TitleFont',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: -0.5,
  },
  tabTextActive: {
    color: '#fff',
  },
  searchContainer: {
    paddingHorizontal: scaleWidth(20),
    paddingTop: scaleHeight(16),
  },
  searchInput: {
    height: scaleHeight(44),
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: scaleSize(12),
    paddingHorizontal: scaleWidth(16),
    fontSize: scaleFont(16),
    fontFamily: 'ZainCustomFont',
    color: '#fff',
    borderWidth: scaleSize(1),
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  listContent: {
    padding: scaleWidth(20),
    paddingBottom: scaleHeight(100),
  },
  separator: {
    height: scaleHeight(12),
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: scaleHeight(60),
  },
  emptyText: {
    fontSize: scaleFont(18),
    fontFamily: 'TitleFont',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: scaleHeight(8),
  },
  emptySubtext: {
    fontSize: scaleFont(14),
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    paddingVertical: scaleHeight(8),
    paddingHorizontal: scaleWidth(16),
    borderRadius: scaleSize(20),
    backgroundColor: '#fff',
  },
  addButtonText: {
    fontSize: scaleFont(14),
    fontFamily: 'TitleFont',
    color: '#000',
    letterSpacing: -0.5,
  },
  unfriendButton: {
    paddingVertical: scaleHeight(8),
    paddingHorizontal: scaleWidth(16),
    borderRadius: scaleSize(20),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: scaleSize(1),
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  unfriendButtonText: {
    fontSize: scaleFont(14),
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
  },
  pendingButton: {
    paddingVertical: scaleHeight(8),
    paddingHorizontal: scaleWidth(16),
    borderRadius: scaleSize(20),
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: scaleSize(1),
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  pendingButtonText: {
    fontSize: scaleFont(14),
    fontFamily: 'TitleFont',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: -0.5,
  },
  signInRequired: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(40),
  },
  icon: {
    opacity: 0.3,
    marginBottom: scaleHeight(24),
  },
  signInTitle: {
    fontSize: scaleFont(24),
    fontFamily: 'TitleFont',
    color: '#fff',
    marginBottom: scaleHeight(12),
    letterSpacing: -0.5,
  },
  signInSubtext: {
    fontSize: scaleFont(16),
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: scaleHeight(24),
    marginBottom: scaleHeight(32),
  },
  signInButton: {
    paddingVertical: scaleHeight(16),
    paddingHorizontal: scaleWidth(40),
    borderRadius: scaleSize(100),
    backgroundColor: '#fff',
  },
  signInButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    transform: [{ scale: 0.98 }],
  },
  signInButtonText: {
    fontSize: scaleFont(17),
    fontFamily: 'TitleFont',
    color: '#000',
    letterSpacing: -0.5,
  },
});
