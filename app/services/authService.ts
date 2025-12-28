import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { signInWithCredential, OAuthProvider, signOut as firebaseSignOut, deleteUser } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { ref, listAll, deleteObject } from 'firebase/storage';
import { getFirebaseAuth, getFirebaseDb, getFirebaseStorage } from './firebaseService';
import type { User } from '../types/models';
import { getUserJournals } from './journalService';
import { deleteJournalImages } from '../utils/imageStorage';

export type { User };

const USER_STORAGE_KEY = '@mania_user';

// Check if Apple Sign-In is available on this device
export const isAppleAuthAvailable = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    console.log('❌ Apple Auth not available: Not iOS');
    return false;
  }
  
  try {
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    console.log(`🍎 Apple Auth availability: ${isAvailable}`);
    return isAvailable;
  } catch (error) {
    console.error('❌ Error checking Apple Auth availability:', error);
    return false;
  }
};

// Sign in with Apple
export const signInWithApple = async (): Promise<User> => {
  try {
    console.log('🍎 Starting Apple Sign In...');

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    console.log('✅ Apple Sign In successful, credential received');

    // Create local user object
    const fullName = credential.fullName
      ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
      : null;

    const user: User = {
      id: credential.user,
      email: credential.email,
      fullName: fullName,
      identityToken: credential.identityToken || '',
    };

    // Sign in to Firebase with Apple credential
    try {
      const auth = getFirebaseAuth();
      if (!auth) {
        throw new Error('Firebase not configured');
      }
      const provider = new OAuthProvider('apple.com');
      const firebaseCredential = provider.credential({
        idToken: credential.identityToken!,
      });

      const userCredential = await signInWithCredential(auth, firebaseCredential);
      const firebaseUser = userCredential.user;

      console.log('🔥 Firebase sign-in successful, UID:', firebaseUser.uid);

      user.uid = firebaseUser.uid;

      // Create/update Firestore user document
      const db = getFirebaseDb();
      if (!db) {
        throw new Error('Firestore not configured');
      }
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        // New user - create document
        console.log('📝 Creating new user document in Firestore');
        await setDoc(userRef, {
          uid: firebaseUser.uid,
          appleId: credential.user,
          email: credential.email,
          displayName: fullName,
          username: null,
          bio: null,
          profileImageUrl: null,
          defaultPrivacy: 'private',
          profileVisibility: 'public',
          journalCount: 0,
          friendCount: 0,
          followerCount: 0,
          followingCount: 0,
          searchTerms: fullName ? fullName.toLowerCase().split(' ') : [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Existing user - update last login
        console.log('📝 Updating existing user document');
        await setDoc(
          userRef,
          {
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Load user data from Firestore
        const userData = userDoc.data();
        user.displayName = userData.displayName;
        user.username = userData.username;
        user.bio = userData.bio;
        user.profileImageUrl = userData.profileImageUrl;
        user.defaultPrivacy = userData.defaultPrivacy;
        user.journalCount = userData.journalCount;
        user.friendCount = userData.friendCount;
        user.followerCount = userData.followerCount;
        user.followingCount = userData.followingCount;
      }
    } catch (firebaseError) {
      console.error('⚠️ Firebase sign-in failed, continuing with local auth:', firebaseError);
      // Continue with local auth even if Firebase fails (offline mode)
    }

    // Store user data locally
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    console.log('✅ User data stored locally');

    return user;
  } catch (error: any) {
    if (error.code === 'ERR_REQUEST_CANCELED') {
      console.log('ℹ️ User canceled sign in');
      throw new Error('Sign in was canceled');
    }
    console.error('❌ Error signing in with Apple:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    throw error;
  }
};

// Get stored user data
export const getStoredUser = async (): Promise<User | null> => {
  try {
    const userData = await AsyncStorage.getItem(USER_STORAGE_KEY);
    if (userData) {
      return JSON.parse(userData);
    }
    return null;
  } catch (error) {
    console.error('Error getting stored user:', error);
    return null;
  }
};

// Sign out
export   const signOut = async (): Promise<void> => {
    try {
      // Sign out from Firebase
      try {
        const auth = getFirebaseAuth();
        if (auth) {
          await firebaseSignOut(auth);
          console.log('🔥 Firebase sign-out successful');
        }
      } catch (firebaseError) {
        console.error('⚠️ Firebase sign-out failed:', firebaseError);
        // Continue with local sign-out even if Firebase fails
      }

    // Remove local user data
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
    console.log('✅ Local user data removed');
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Delete account and all associated data
export const deleteAccount = async (userId: string): Promise<void> => {
  try {
    console.log('🗑️ Starting account deletion for user:', userId);
    const db = getFirebaseDb();
    const storage = getFirebaseStorage();
    const auth = getFirebaseAuth();

    if (!db || !storage || !auth) {
      throw new Error('Firebase services not available');
    }

    // Step 1: Delete all journals and their images from local storage
    console.log('📝 Deleting local journals...');
    const journals = await getUserJournals();
    const userJournals = journals.filter(j => j.userId === userId);

    for (const journal of userJournals) {
      const imageUris = journal.images.map(img => img.uri);
      await deleteJournalImages(imageUris);
    }

    // Step 2: Delete all journal images from Firebase Storage
    console.log('🖼️ Deleting images from Firebase Storage...');
    try {
      const userStorageRef = ref(storage, `journals/${userId}`);
      const storageList = await listAll(userStorageRef);

      // Delete all files in all subdirectories
      for (const folderRef of storageList.prefixes) {
        const folderContents = await listAll(folderRef);
        await Promise.all(
          folderContents.items.map(itemRef => deleteObject(itemRef))
        );
      }

      // Delete any files directly in the user folder
      await Promise.all(
        storageList.items.map(itemRef => deleteObject(itemRef))
      );
    } catch (storageError) {
      console.error('⚠️ Error deleting storage files:', storageError);
      // Continue with deletion even if storage cleanup fails
    }

    // Step 3: Delete all journals from Firestore
    console.log('📚 Deleting journals from Firestore...');
    const journalsRef = collection(db, 'journals');
    const journalsQuery = query(journalsRef, where('userId', '==', userId));
    const journalsSnapshot = await getDocs(journalsQuery);

    const batch1 = writeBatch(db);
    journalsSnapshot.docs.forEach(doc => {
      batch1.delete(doc.ref);
    });
    await batch1.commit();

    // Step 4: Delete all friendships
    console.log('👥 Deleting friendships...');
    const friendshipsRef = collection(db, 'friendships');
    const friendships1 = await getDocs(query(friendshipsRef, where('user1Id', '==', userId)));
    const friendships2 = await getDocs(query(friendshipsRef, where('user2Id', '==', userId)));

    const batch2 = writeBatch(db);
    [...friendships1.docs, ...friendships2.docs].forEach(doc => {
      batch2.delete(doc.ref);
    });
    await batch2.commit();

    // Step 5: Delete all follows (as follower and following)
    console.log('🔔 Deleting follows...');
    const followsRef = collection(db, 'follows');
    const followsAsFollower = await getDocs(query(followsRef, where('followerId', '==', userId)));
    const followsAsFollowing = await getDocs(query(followsRef, where('followingId', '==', userId)));

    const batch3 = writeBatch(db);
    [...followsAsFollower.docs, ...followsAsFollowing.docs].forEach(doc => {
      batch3.delete(doc.ref);
    });
    await batch3.commit();

    // Step 6: Delete all friend requests (sent and received)
    console.log('📨 Deleting friend requests...');
    const requestsRef = collection(db, 'friendRequests');
    const requestsSent = await getDocs(query(requestsRef, where('fromUserId', '==', userId)));
    const requestsReceived = await getDocs(query(requestsRef, where('toUserId', '==', userId)));

    const batch4 = writeBatch(db);
    [...requestsSent.docs, ...requestsReceived.docs].forEach(doc => {
      batch4.delete(doc.ref);
    });
    await batch4.commit();

    // Step 7: Delete user document from Firestore
    console.log('👤 Deleting user document...');
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);

    // Step 8: Delete Firebase Auth account
    console.log('🔐 Deleting Firebase Auth account...');
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === userId) {
      await deleteUser(currentUser);
    } else {
      console.warn('⚠️ Current user does not match userId, skipping auth deletion');
    }

    // Step 9: Clear all local storage
    console.log('💾 Clearing local storage...');
    await AsyncStorage.clear();

    console.log('✅ Account deletion completed successfully');
  } catch (error) {
    console.error('❌ Error deleting account:', error);
    throw error;
  }
};

// Check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  const user = await getStoredUser();
  return user !== null;
};

// Get credential state (check if user is still valid with Apple)
export const getCredentialState = async (userID: string): Promise<AppleAuthentication.AppleAuthenticationCredentialState> => {
  try {
    return await AppleAuthentication.getCredentialStateAsync(userID);
  } catch (error) {
    console.error('Error getting credential state:', error);
    return AppleAuthentication.AppleAuthenticationCredentialState.REVOKED;
  }
};

