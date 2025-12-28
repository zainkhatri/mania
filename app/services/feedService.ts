import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebaseService';
import { FeedItem } from '../types/models';
import { getFriends } from './friendService';

// Get public feed (all public journals)
export const getPublicFeed = async (limitCount: number = 50): Promise<FeedItem[]> => {
  const db = getFirebaseDb();
  const journalsRef = collection(db, 'journals');

  const q = query(
    journalsRef,
    where('privacy', '==', 'public'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      userDisplayName: data.userDisplayName,
      userProfileImage: data.userProfileImage,
      date: data.date.toDate().toISOString(),
      location: data.location,
      title: data.title,
      text: data.text,
      colors: data.colors,
      prompt: data.prompt,
      images: data.images.map((img: any) => ({
        uri: img.publicUrl, // Use public URL for display
        storageUrl: img.storageUrl,
        publicUrl: img.publicUrl,
        x: img.x,
        y: img.y,
        scale: img.scale,
        width: img.width,
        height: img.height,
      })),
      privacy: data.privacy,
      likeCount: data.likeCount || 0,
      commentCount: data.commentCount || 0,
      createdAt: data.createdAt.toDate().toISOString(),
    } as FeedItem;
  });
};

// Get friends feed (public + friends-only from friends)
export const getFriendsFeed = async (
  userId: string,
  limitCount: number = 50
): Promise<FeedItem[]> => {
  const db = getFirebaseDb();

  // Get friend IDs
  const friends = await getFriends(userId);
  const friendIds = friends.map((f) => f.uid);

  if (friendIds.length === 0) {
    return [];
  }

  const journalsRef = collection(db, 'journals');

  // Due to Firestore limitations with 'in' queries (max 10 items),
  // we'll query in batches and combine results
  const allJournals: FeedItem[] = [];

  // Process friend IDs in batches of 10
  for (let i = 0; i < friendIds.length; i += 10) {
    const batchIds = friendIds.slice(i, i + 10);

    // Query 1: Public journals from friends
    const q1 = query(
      journalsRef,
      where('userId', 'in', batchIds),
      where('privacy', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    // Query 2: Friends-only journals from friends
    const q2 = query(
      journalsRef,
      where('userId', 'in', batchIds),
      where('privacy', '==', 'friends'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    const batchJournals = [...snapshot1.docs, ...snapshot2.docs].map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        userDisplayName: data.userDisplayName,
        userProfileImage: data.userProfileImage,
        date: data.date.toDate().toISOString(),
        location: data.location,
        title: data.title,
        text: data.text,
        colors: data.colors,
        prompt: data.prompt,
        images: data.images.map((img: any) => ({
          uri: img.publicUrl,
          storageUrl: img.storageUrl,
          publicUrl: img.publicUrl,
          x: img.x,
          y: img.y,
          scale: img.scale,
          width: img.width,
          height: img.height,
        })),
        privacy: data.privacy,
        likeCount: data.likeCount || 0,
        commentCount: data.commentCount || 0,
        createdAt: data.createdAt.toDate().toISOString(),
      } as FeedItem;
    });

    allJournals.push(...batchJournals);
  }

  // Remove duplicates and sort by date
  const uniqueJournals = Array.from(
    new Map(allJournals.map((journal) => [journal.id, journal])).values()
  );

  return uniqueJournals
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limitCount);
};

// Get user's own journals (all privacy levels)
export const getUserJournals = async (userId: string): Promise<FeedItem[]> => {
  const db = getFirebaseDb();
  const journalsRef = collection(db, 'journals');

  const q = query(journalsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      userDisplayName: data.userDisplayName,
      userProfileImage: data.userProfileImage,
      date: data.date.toDate().toISOString(),
      location: data.location,
      title: data.title,
      text: data.text,
      colors: data.colors,
      prompt: data.prompt,
      images: data.images.map((img: any) => ({
        uri: img.publicUrl,
        storageUrl: img.storageUrl,
        publicUrl: img.publicUrl,
        x: img.x,
        y: img.y,
        scale: img.scale,
        width: img.width,
        height: img.height,
      })),
      privacy: data.privacy,
      likeCount: data.likeCount || 0,
      commentCount: data.commentCount || 0,
      createdAt: data.createdAt.toDate().toISOString(),
    } as FeedItem;
  });
};
