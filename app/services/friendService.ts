import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  serverTimestamp,
  increment,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebaseService';
import { FriendRequest, Friendship, UserSearchResult } from '../types/models';

// Send friend request
export const sendFriendRequest = async (
  fromUserId: string,
  fromUserName: string,
  fromUserImage: string | null,
  toUserId: string
): Promise<void> => {
  const db = getFirebaseDb();

  // Check if friendship already exists
  const friendshipId = [fromUserId, toUserId].sort().join('_');
  const friendshipRef = doc(db, 'friendships', friendshipId);
  const friendshipDoc = await getDoc(friendshipRef);

  if (friendshipDoc.exists()) {
    throw new Error('Already friends');
  }

  // Check if request already exists
  const requestsRef = collection(db, 'friendRequests');
  const existingRequest = await getDocs(
    query(
      requestsRef,
      where('fromUserId', '==', fromUserId),
      where('toUserId', '==', toUserId),
      where('status', '==', 'pending')
    )
  );

  if (!existingRequest.empty) {
    throw new Error('Friend request already sent');
  }

  // Create friend request
  const requestRef = doc(requestsRef);
  await setDoc(requestRef, {
    fromUserId,
    fromUserName,
    fromUserImage,
    toUserId,
    status: 'pending',
    createdAt: serverTimestamp(),
    respondedAt: null,
  });
};

// Accept friend request
export const acceptFriendRequest = async (
  requestId: string,
  currentUserId: string
): Promise<void> => {
  const db = getFirebaseDb();
  const batch = writeBatch(db);

  // Get request
  const requestRef = doc(db, 'friendRequests', requestId);
  const requestDoc = await getDoc(requestRef);

  if (!requestDoc.exists()) {
    throw new Error('Friend request not found');
  }

  const request = requestDoc.data() as FriendRequest;

  if (request.toUserId !== currentUserId) {
    throw new Error('Not authorized');
  }

  // Update request status
  batch.update(requestRef, {
    status: 'accepted',
    respondedAt: serverTimestamp(),
  });

  // Create friendship
  const friendshipId = [request.fromUserId, request.toUserId].sort().join('_');
  const friendshipRef = doc(db, 'friendships', friendshipId);
  batch.set(friendshipRef, {
    user1Id: [request.fromUserId, request.toUserId].sort()[0],
    user2Id: [request.fromUserId, request.toUserId].sort()[1],
    status: 'active',
    createdAt: serverTimestamp(),
  });

  // Increment friend counts
  const user1Ref = doc(db, 'users', request.fromUserId);
  const user2Ref = doc(db, 'users', request.toUserId);
  batch.update(user1Ref, { friendCount: increment(1) });
  batch.update(user2Ref, { friendCount: increment(1) });

  await batch.commit();
};

// Reject friend request
export const rejectFriendRequest = async (
  requestId: string,
  currentUserId: string
): Promise<void> => {
  const db = getFirebaseDb();
  const requestRef = doc(db, 'friendRequests', requestId);
  const requestDoc = await getDoc(requestRef);

  if (!requestDoc.exists()) {
    throw new Error('Friend request not found');
  }

  const request = requestDoc.data();

  if (request.toUserId !== currentUserId) {
    throw new Error('Not authorized');
  }

  await setDoc(
    requestRef,
    {
      status: 'rejected',
      respondedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

// Get pending friend requests (received)
export const getPendingFriendRequests = async (userId: string): Promise<FriendRequest[]> => {
  const db = getFirebaseDb();
  const requestsRef = collection(db, 'friendRequests');

  const q = query(
    requestsRef,
    where('toUserId', '==', userId),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate().toISOString(),
  })) as FriendRequest[];
};

// Get friends list
export const getFriends = async (userId: string): Promise<UserSearchResult[]> => {
  const db = getFirebaseDb();

  // Query friendships where user is either user1 or user2
  const friendshipsRef = collection(db, 'friendships');

  const q1 = query(friendshipsRef, where('user1Id', '==', userId));
  const q2 = query(friendshipsRef, where('user2Id', '==', userId));

  const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  const friendIds = new Set<string>();

  snapshot1.docs.forEach((doc) => {
    friendIds.add(doc.data().user2Id);
  });

  snapshot2.docs.forEach((doc) => {
    friendIds.add(doc.data().user1Id);
  });

  // Fetch user details for all friends
  const friends = await Promise.all(
    Array.from(friendIds).map(async (friendId) => {
      const userRef = doc(db, 'users', friendId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          uid: friendId,
          displayName: userData.displayName,
          username: userData.username,
          email: userData.email,
          profileImageUrl: userData.profileImageUrl,
          isFriend: true,
        } as UserSearchResult;
      }
      return null;
    })
  );

  return friends.filter((f) => f !== null) as UserSearchResult[];
};

// Unfriend
export const unfriend = async (userId: string, friendId: string): Promise<void> => {
  const db = getFirebaseDb();
  const batch = writeBatch(db);

  // Delete friendship
  const friendshipId = [userId, friendId].sort().join('_');
  const friendshipRef = doc(db, 'friendships', friendshipId);
  batch.delete(friendshipRef);

  // Decrement friend counts
  const user1Ref = doc(db, 'users', userId);
  const user2Ref = doc(db, 'users', friendId);
  batch.update(user1Ref, { friendCount: increment(-1) });
  batch.update(user2Ref, { friendCount: increment(-1) });

  await batch.commit();
};

// Follow user
export const followUser = async (followerId: string, followingId: string): Promise<void> => {
  const db = getFirebaseDb();
  const batch = writeBatch(db);

  // Check if already following
  const followsRef = collection(db, 'follows');
  const existingFollow = await getDocs(
    query(
      followsRef,
      where('followerId', '==', followerId),
      where('followingId', '==', followingId)
    )
  );

  if (!existingFollow.empty) {
    throw new Error('Already following');
  }

  // Create follow
  const followRef = doc(followsRef);
  batch.set(followRef, {
    followerId,
    followingId,
    createdAt: serverTimestamp(),
  });

  // Update counts
  const followerRef = doc(db, 'users', followerId);
  const followingRef = doc(db, 'users', followingId);
  batch.update(followerRef, { followingCount: increment(1) });
  batch.update(followingRef, { followerCount: increment(1) });

  await batch.commit();
};

// Unfollow user
export const unfollowUser = async (followerId: string, followingId: string): Promise<void> => {
  const db = getFirebaseDb();
  const batch = writeBatch(db);

  // Find follow document
  const followsRef = collection(db, 'follows');
  const followQuery = query(
    followsRef,
    where('followerId', '==', followerId),
    where('followingId', '==', followingId)
  );

  const snapshot = await getDocs(followQuery);

  if (snapshot.empty) {
    throw new Error('Not following');
  }

  // Delete follow
  const followDoc = snapshot.docs[0];
  batch.delete(followDoc.ref);

  // Update counts
  const followerRef = doc(db, 'users', followerId);
  const followingRef = doc(db, 'users', followingId);
  batch.update(followerRef, { followingCount: increment(-1) });
  batch.update(followingRef, { followerCount: increment(-1) });

  await batch.commit();
};

// Search users
export const searchUsers = async (
  searchTerm: string,
  currentUserId: string
): Promise<UserSearchResult[]> => {
  const db = getFirebaseDb();
  const usersRef = collection(db, 'users');

  // Simple search by display name (starts with)
  // For production, use Algolia or similar for better search
  const q = query(
    usersRef,
    where('searchTerms', 'array-contains', searchTerm.toLowerCase())
  );

  const snapshot = await getDocs(q);

  // Get current user's friends
  const friends = await getFriends(currentUserId);
  const friendIds = new Set(friends.map((f) => f.uid));

  // Get following
  const followsRef = collection(db, 'follows');
  const followingQuery = query(followsRef, where('followerId', '==', currentUserId));
  const followingSnapshot = await getDocs(followingQuery);
  const followingIds = new Set(followingSnapshot.docs.map((doc) => doc.data().followingId));

  return snapshot.docs
    .filter((doc) => doc.id !== currentUserId)
    .map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        displayName: data.displayName,
        username: data.username,
        email: data.email,
        profileImageUrl: data.profileImageUrl,
        isFriend: friendIds.has(doc.id),
        isFollowing: followingIds.has(doc.id),
      } as UserSearchResult;
    });
};

// Get friend suggestions (mutual friends)
export const getFriendSuggestions = async (userId: string): Promise<UserSearchResult[]> => {
  const db = getFirebaseDb();

  // Get user's friends
  const friends = await getFriends(userId);
  const friendIds = friends.map((f) => f.uid);

  if (friendIds.length === 0) {
    return [];
  }

  // Get friends of friends (simplified - in production use Cloud Functions)
  const friendshipsRef = collection(db, 'friendships');
  const mutualFriendsMap = new Map<string, number>();

  for (const friendId of friendIds.slice(0, 10)) {
    // Limit to avoid too many queries
    const q1 = query(friendshipsRef, where('user1Id', '==', friendId));
    const q2 = query(friendshipsRef, where('user2Id', '==', friendId));

    const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    snapshot1.docs.forEach((doc) => {
      const otherUserId = doc.data().user2Id;
      if (otherUserId !== userId && !friendIds.includes(otherUserId)) {
        mutualFriendsMap.set(otherUserId, (mutualFriendsMap.get(otherUserId) || 0) + 1);
      }
    });

    snapshot2.docs.forEach((doc) => {
      const otherUserId = doc.data().user1Id;
      if (otherUserId !== userId && !friendIds.includes(otherUserId)) {
        mutualFriendsMap.set(otherUserId, (mutualFriendsMap.get(otherUserId) || 0) + 1);
      }
    });
  }

  // Fetch user details and sort by mutual friends count
  const suggestions = await Promise.all(
    Array.from(mutualFriendsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // Top 10 suggestions
      .map(async ([suggestedUserId, mutualCount]) => {
        const userRef = doc(db, 'users', suggestedUserId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          return {
            uid: suggestedUserId,
            displayName: userData.displayName,
            username: userData.username,
            email: userData.email,
            profileImageUrl: userData.profileImageUrl,
            isFriend: false,
            mutualFriends: mutualCount,
          } as UserSearchResult;
        }
        return null;
      })
  );

  return suggestions.filter((s) => s !== null) as UserSearchResult[];
};
