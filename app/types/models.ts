import { Timestamp } from 'firebase/firestore';

// Privacy levels
export type PrivacyLevel = 'private' | 'friends' | 'public';
export type ProfileVisibility = 'public' | 'friends_only';

// User model (local + Firebase)
export interface User {
  // Local (from Apple Sign-In)
  id: string;                      // Apple user ID (legacy)
  email: string | null;
  fullName: string | null;
  identityToken: string;

  // Firebase extensions
  uid?: string;                    // Firebase UID
  displayName?: string | null;
  username?: string | null;
  bio?: string | null;
  profileImageUrl?: string | null;
  defaultPrivacy?: PrivacyLevel;
  profileVisibility?: ProfileVisibility;

  // Stats
  journalCount?: number;
  friendCount?: number;
  followerCount?: number;
  followingCount?: number;

  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

// Journal image (enhanced)
export interface JournalImage {
  uri: string;                     // Local file path OR Cloud Storage URL
  storageUrl?: string;             // Firebase Storage gs:// URL
  publicUrl?: string;              // HTTPS download URL
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
}

// Journal model (enhanced)
export interface Journal {
  id: string;
  date: string;
  location?: string;
  title?: string;
  text: string;
  images: JournalImage[];
  colors: {
    locationColor: string;
    locationShadowColor: string;
  };
  createdAt: string;
  prompt?: string;

  // Social features
  userId?: string;                 // Firebase UID of owner
  userDisplayName?: string;
  userProfileImage?: string | null;
  privacy?: PrivacyLevel;          // Default: 'private'

  // Engagement (future)
  likeCount?: number;
  commentCount?: number;

  // Sync status
  syncStatus?: 'local' | 'syncing' | 'synced' | 'error';
  lastSynced?: string;
}

// Friend request
export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserImage: string | null;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  respondedAt?: string | null;
}

// Friendship
export interface Friendship {
  id: string;
  user1Id: string;
  user2Id: string;
  status: 'active';
  createdAt: string;
}

// Follow
export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

// User search result
export interface UserSearchResult {
  uid: string;
  displayName: string;
  username: string | null;
  email: string | null;
  profileImageUrl: string | null;
  isFriend?: boolean;
  isFollowing?: boolean;
  mutualFriends?: number;
}

// Feed item (journal with author info)
export interface FeedItem extends Journal {
  userId: string;
  userDisplayName: string;
  userProfileImage: string | null;
}
