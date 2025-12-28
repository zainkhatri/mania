import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { UserSearchResult } from '../types/models';
import { scaleFont, scaleHeight, scaleWidth, scaleSize } from '../utils/responsive';

interface UserCardProps {
  user: UserSearchResult;
  onPress?: () => void;
  actionButton?: React.ReactNode;
  showFollowCounts?: boolean;
}

export default function UserCard({
  user,
  onPress,
  actionButton,
  showFollowCounts = true,
}: UserCardProps) {
  const displayName = user.displayName || user.username || 'Anonymous User';
  const hasProfileImage = !!user.profileImageUrl;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* Profile Image */}
      <View style={styles.avatarContainer}>
        {hasProfileImage ? (
          <Image source={{ uri: user.profileImageUrl! }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* User Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.displayName} numberOfLines={1}>
          {displayName}
        </Text>

        {user.username && (
          <Text style={styles.username} numberOfLines={1}>
            @{user.username}
          </Text>
        )}

        {user.bio && (
          <Text style={styles.bio} numberOfLines={2}>
            {user.bio}
          </Text>
        )}

        {showFollowCounts && (
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{user.journalCount || 0}</Text>
              <Text style={styles.statLabel}>Journals</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{user.friendCount || 0}</Text>
              <Text style={styles.statLabel}>Friends</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{user.followerCount || 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
          </View>
        )}
      </View>

      {/* Action Button */}
      {actionButton && <View style={styles.actionContainer}>{actionButton}</View>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: scaleHeight(12),
    paddingHorizontal: scaleWidth(16),
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: scaleSize(12),
    borderWidth: scaleSize(1),
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: scaleWidth(12),
  },
  avatarContainer: {
    width: scaleSize(56),
    height: scaleSize(56),
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: scaleSize(28),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: scaleSize(28),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: scaleFont(24),
    fontFamily: 'TitleFont',
    color: '#fff',
  },
  infoContainer: {
    flex: 1,
    gap: scaleHeight(4),
  },
  displayName: {
    fontSize: scaleFont(17),
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
  },
  username: {
    fontSize: scaleFont(14),
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  bio: {
    fontSize: scaleFont(13),
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: scaleHeight(4),
    lineHeight: scaleHeight(18),
  },
  statsContainer: {
    flexDirection: 'row',
    gap: scaleWidth(16),
    marginTop: scaleHeight(8),
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: scaleFont(16),
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: scaleFont(11),
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: scaleHeight(2),
  },
  actionContainer: {
    justifyContent: 'center',
    marginLeft: scaleWidth(8),
  },
});
