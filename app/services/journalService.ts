import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebaseDb, getFirebaseStorage } from './firebaseService';
import { saveImageToFileSystem, deleteJournalImages } from '../utils/imageStorage';
import { Journal, JournalImage, PrivacyLevel } from '../types/models';

// Re-export types for backward compatibility
export type { Journal, JournalImage };

const STORAGE_KEY = 'mania_journals';

// Upload image to Firebase Cloud Storage
const uploadImageToStorage = async (
  imageUri: string,
  userId: string,
  journalId: string,
  imageIndex: number
): Promise<{ storageUrl: string; publicUrl: string }> => {
  try {
    const storage = getFirebaseStorage();
    const imagePath = `journals/${userId}/${journalId}/image_${imageIndex}.jpg`;
    const imageRef = ref(storage, imagePath);

    // Fetch image as blob
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // Upload to Cloud Storage
    await uploadBytes(imageRef, blob);

    // Get download URL
    const publicUrl = await getDownloadURL(imageRef);
    const storageUrl = `gs://${storage.app.options.storageBucket}/${imagePath}`;

    return { storageUrl, publicUrl };
  } catch (error) {
    console.error('Error uploading image to storage:', error);
    throw error;
  }
};

// Sync journal to Firestore
const syncJournalToFirebase = async (journal: Journal, userId: string): Promise<void> => {
  try {
    const db = getFirebaseDb();

    // Upload images to Cloud Storage if not already uploaded
    const uploadedImages = await Promise.all(
      journal.images.map(async (img, index) => {
        // If already uploaded (has publicUrl), skip
        if (img.publicUrl && img.storageUrl) {
          return img;
        }

        // Upload to storage
        const { storageUrl, publicUrl } = await uploadImageToStorage(
          img.uri,
          userId,
          journal.id,
          index
        );

        return {
          ...img,
          storageUrl,
          publicUrl,
        };
      })
    );

    // Save to Firestore
    const journalRef = doc(db, 'journals', journal.id);
    await setDoc(journalRef, {
      id: journal.id,
      userId: userId,
      userDisplayName: journal.userDisplayName || '',
      userProfileImage: journal.userProfileImage || null,
      date: Timestamp.fromDate(new Date(journal.date)),
      location: journal.location || null,
      title: journal.title || null,
      text: journal.text,
      colors: journal.colors,
      prompt: journal.prompt || null,
      images: uploadedImages.map((img) => ({
        storageUrl: img.storageUrl,
        publicUrl: img.publicUrl,
        x: img.x,
        y: img.y,
        scale: img.scale,
        width: img.width,
        height: img.height,
      })),
      privacy: journal.privacy || 'private',
      likeCount: 0,
      commentCount: 0,
      createdAt: Timestamp.fromDate(new Date(journal.createdAt)),
      updatedAt: serverTimestamp(),
    });

    console.log(`✅ Journal ${journal.id} synced to Firebase`);
  } catch (error) {
    console.error('Error syncing journal to Firebase:', error);
    throw error;
  }
};

// Delete journal from Firebase
const deleteJournalFromFirebase = async (journalId: string, userId: string): Promise<void> => {
  try {
    const db = getFirebaseDb();
    const storage = getFirebaseStorage();

    // Delete journal document
    const journalRef = doc(db, 'journals', journalId);
    await deleteDoc(journalRef);

    // Delete images from Cloud Storage
    // Note: In production, use Cloud Functions to clean up storage automatically
    try {
      const imagesFolderRef = ref(storage, `journals/${userId}/${journalId}`);
      // Firebase doesn't support folder deletion directly
      // In production, implement this in Cloud Functions
      console.log('⚠️ Storage cleanup should be handled by Cloud Functions');
    } catch (storageError) {
      console.error('Error deleting images from storage:', storageError);
    }

    console.log(`✅ Journal ${journalId} deleted from Firebase`);
  } catch (error) {
    console.error('Error deleting journal from Firebase:', error);
    throw error;
  }
};

export const saveJournal = async (
  journalData: Omit<Journal, 'id' | 'createdAt'>
): Promise<string> => {
  try {
    const journalId = `journal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Save images to file system and get file paths
    const savedImages = await Promise.all(
      journalData.images.map(async (image) => ({
        ...image,
        uri: await saveImageToFileSystem(image.uri),
      }))
    );

    const journal: Journal = {
      ...journalData,
      images: savedImages,
      id: journalId,
      createdAt: new Date().toISOString(),
      privacy: journalData.privacy || 'private',
      syncStatus: 'local',
    };

    // Save to AsyncStorage (local cache)
    const existingJournals = await getUserJournals();
    const updatedJournals = [...existingJournals, journal];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedJournals));

    // Sync to Firebase if user is authenticated
    if (journalData.userId) {
      try {
        journal.syncStatus = 'syncing';
        await syncJournalToFirebase(journal, journalData.userId);
        journal.syncStatus = 'synced';
        journal.lastSynced = new Date().toISOString();

        // Update local storage with sync status
        const updatedJournalsWithSync = updatedJournals.map((j) =>
          j.id === journalId ? journal : j
        );
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedJournalsWithSync));
      } catch (firebaseError) {
        console.error('⚠️ Firebase sync failed, saved locally:', firebaseError);
        journal.syncStatus = 'error';
      }
    }

    return journalId;
  } catch (error) {
    console.error('Error saving journal:', error);
    throw error;
  }
};

export const getUserJournals = async (): Promise<Journal[]> => {
  try {
    const journalsJson = await AsyncStorage.getItem(STORAGE_KEY);
    return journalsJson ? JSON.parse(journalsJson) : [];
  } catch (error) {
    console.error('Error getting journals:', error);
    return [];
  }
};

export const deleteJournal = async (journalId: string, userId?: string): Promise<void> => {
  try {
    const journals = await getUserJournals();
    const journalToDelete = journals.find((journal) => journal.id === journalId);

    if (journalToDelete) {
      // Delete images from file system
      const imageUris = journalToDelete.images.map((img) => img.uri);
      await deleteJournalImages(imageUris);

      // Delete from Firebase if user is authenticated
      if (userId) {
        try {
          await deleteJournalFromFirebase(journalId, userId);
        } catch (firebaseError) {
          console.error('⚠️ Firebase delete failed:', firebaseError);
        }
      }
    }

    const filteredJournals = journals.filter((journal) => journal.id !== journalId);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filteredJournals));
  } catch (error) {
    console.error('Error deleting journal:', error);
    throw error;
  }
};

export const journalExistsForDate = async (dateISOString: string): Promise<boolean> => {
  try {
    const journals = await getUserJournals();
    const targetDate = new Date(dateISOString).toISOString().split('T')[0];

    return journals.some((journal) => {
      const journalDate = new Date(journal.date).toISOString().split('T')[0];
      return journalDate === targetDate;
    });
  } catch (error) {
    console.error('Error checking journal existence:', error);
    return false;
  }
};

export const getJournalById = async (journalId: string): Promise<Journal | null> => {
  try {
    const journals = await getUserJournals();
    return journals.find(j => j.id === journalId) || null;
  } catch (error) {
    console.error('Error getting journal by ID:', error);
    return null;
  }
};

export const updateJournal = async (
  journalId: string,
  updatedData: Omit<Journal, 'id' | 'createdAt'>,
  userId?: string
): Promise<void> => {
  try {
    const journals = await getUserJournals();
    const index = journals.findIndex((j) => j.id === journalId);

    if (index === -1) {
      throw new Error('Journal not found');
    }

    const oldJournal = journals[index];

    // Save new images to file system
    const savedImages = await Promise.all(
      updatedData.images.map(async (image) => {
        // If the image URI already starts with file://, it's already saved
        if (image.uri.startsWith('file://')) {
          return image;
        }
        // Otherwise, save it to the file system
        return {
          ...image,
          uri: await saveImageToFileSystem(image.uri),
        };
      })
    );

    // Find and delete removed images
    const oldImageUris = oldJournal.images.map((img) => img.uri);
    const newImageUris = savedImages.map((img) => img.uri);
    const removedImageUris = oldImageUris.filter((uri) => !newImageUris.includes(uri));
    if (removedImageUris.length > 0) {
      await deleteJournalImages(removedImageUris);
    }

    const updatedJournal = {
      ...journals[index],
      ...updatedData,
      images: savedImages,
      id: journalId, // Preserve original ID
      createdAt: journals[index].createdAt, // Preserve creation date
      syncStatus: 'local' as const,
    };

    journals[index] = updatedJournal;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(journals));

    // Sync to Firebase if user is authenticated
    if (userId) {
      try {
        updatedJournal.syncStatus = 'syncing';
        await syncJournalToFirebase(updatedJournal, userId);
        updatedJournal.syncStatus = 'synced';
        updatedJournal.lastSynced = new Date().toISOString();

        // Update local storage with sync status
        journals[index] = updatedJournal;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(journals));
      } catch (firebaseError) {
        console.error('⚠️ Firebase sync failed:', firebaseError);
        updatedJournal.syncStatus = 'error';
      }
    }
  } catch (error) {
    console.error('Error updating journal:', error);
    throw error;
  }
};
