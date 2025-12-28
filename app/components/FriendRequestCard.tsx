import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { FriendRequest } from '../types/models';
import { scaleFont, scaleHeight, scaleWidth, scaleSize } from '../utils/responsive';

interface FriendRequestCardProps {
  request: FriendRequest;
  onAccept: (requestId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
}

export default function FriendRequestCard({
  request,
  onAccept,
  onReject,
}: FriendRequestCardProps) {
  const [isAccepting, setIsAccepting] = React.useState(false);
  const [isRejecting, setIsRejecting] = React.useState(false);

  const displayName = request.fromUserName || 'Anonymous User';
  const hasProfileImage = !!request.fromUserImage;

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await onAccept(request.id);
    } catch (error) {
      console.error('Error accepting friend request:', error);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onReject(request.id);
    } catch (error) {
      console.error('Error rejecting friend request:', error);
    } finally {
      setIsRejecting(false);
    }
  };

  const timeAgo = (date: string) => {
    const now = new Date();
    const requestDate = new Date(date);
    const diffInMs = now.getTime() - requestDate.getTime();
    const diffInMinutes = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInDays > 0) {
      return `${diffInDays}d ago`;
    } else if (diffInHours > 0) {
      return `${diffInHours}h ago`;
    } else if (diffInMinutes > 0) {
      return `${diffInMinutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  return (
    <View style={styles.container}>
      {/* Profile Image */}
      <View style={styles.avatarContainer}>
        {hasProfileImage ? (
          <Image source={{ uri: request.fromUserImage! }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Request Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.displayName} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.timeText}>{timeAgo(request.createdAt)}</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.acceptButton, isAccepting && styles.buttonDisabled]}
          onPress={handleAccept}
          disabled={isAccepting || isRejecting}
        >
          {isAccepting ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.acceptButtonText}>Accept</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.rejectButton, isRejecting && styles.buttonDisabled]}
          onPress={handleReject}
          disabled={isAccepting || isRejecting}
        >
          {isRejecting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.rejectButtonText}>Decline</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaleHeight(12),
    paddingHorizontal: scaleWidth(16),
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: scaleSize(12),
    borderWidth: scaleSize(1),
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: scaleWidth(12),
  },
  avatarContainer: {
    width: scaleSize(48),
    height: scaleSize(48),
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: scaleSize(24),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: scaleSize(24),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: scaleFont(20),
    fontFamily: 'TitleFont',
    color: '#fff',
  },
  infoContainer: {
    flex: 1,
    gap: scaleHeight(2),
  },
  displayName: {
    fontSize: scaleFont(16),
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
  },
  timeText: {
    fontSize: scaleFont(12),
    fontFamily: 'ZainCustomFont',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: scaleWidth(8),
  },
  acceptButton: {
    paddingVertical: scaleHeight(8),
    paddingHorizontal: scaleWidth(16),
    borderRadius: scaleSize(20),
    backgroundColor: '#fff',
    minWidth: scaleWidth(70),
    alignItems: 'center',
  },
  rejectButton: {
    paddingVertical: scaleHeight(8),
    paddingHorizontal: scaleWidth(16),
    borderRadius: scaleSize(20),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: scaleSize(1),
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: scaleWidth(70),
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  acceptButtonText: {
    fontSize: scaleFont(14),
    fontFamily: 'TitleFont',
    color: '#000',
    letterSpacing: -0.5,
  },
  rejectButtonText: {
    fontSize: scaleFont(14),
    fontFamily: 'TitleFont',
    color: '#fff',
    letterSpacing: -0.5,
  },
});
