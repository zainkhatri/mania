import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  deleteDoc,
  doc,
  updateDoc,
  orderBy,
  serverTimestamp,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage } from '../firebase';

/**
 * Service class for handling journal operations with Firestore and Storage
 */
export interface Journal {
  id?: string;
  userId: string;
  date: string;
  location: string;
  text: string[];
  images: string[];  // Now stores URLs to images in Storage
  textColors: {
    locationColor: string;
    locationShadowColor: string;
  };
  layoutMode: 'standard' | 'mirrored';
  createdAt: any; // Firestore timestamp
  preview: string;  // Preview is still stored as a data URL for performance
}

/**
 * Utility function to convert a data URL to a Blob
 */
function dataURLToBlob(dataURL: string): Blob {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Save a journal to Firestore with images in Firebase Storage
 */
export const saveJournal = async (journalData: Omit<Journal, 'id' | 'userId' | 'createdAt'>): Promise<string> => {
  try {
    console.log("Starting journal save process");
    const user = auth.currentUser;
    if (!user) {
      console.error("Authentication error: No current user");
      throw new Error('User not authenticated');
    }

    // Generate a timestamp to use in image paths
    const timestamp = Date.now().toString();
    console.log(`Using timestamp: ${timestamp}`);
    
    // Keep original images but store them in Firebase Storage
    const { preview, images, ...mainJournalData } = journalData;
    console.log(`Starting to save journal with ${images.length} images`);

    // Process preview to a smaller size for Firestore
    let processedPreview = '';
    if (preview) {
      try {
        console.log("Processing preview");
        const img = new Image();
        img.src = preview;
        await new Promise((resolve, reject) => { 
          img.onload = resolve;
          img.onerror = () => {
            console.error("Error loading preview image");
            reject(new Error("Preview image load failed"));
          };
          // Add timeout to prevent hanging
          setTimeout(() => reject(new Error("Preview image load timeout")), 10000);
        });
        
        const canvas = document.createElement('canvas');
        // Use moderate dimensions for preview thumbnails
        const maxDimension = 600; 
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Use moderate compression for preview only
          processedPreview = canvas.toDataURL('image/jpeg', 0.7);
          console.log("Preview processed successfully");
        }
      } catch (error) {
        console.error("Failed to process preview:", error);
        // Continue without the preview
        processedPreview = '';
      }
    }

    // Create a retry function with exponential backoff for more reliability
    const retry = async <T>(fn: () => Promise<T>, maxRetries = 5, initialDelay = 500): Promise<T> => {
      let lastError;
      for (let i = 0; i < maxRetries; i++) {
        try {
          console.log(`Attempt ${i + 1}/${maxRetries}`);
          return await fn();
        } catch (error) {
          console.error(`Retry ${i + 1}/${maxRetries} failed:`, error);
          lastError = error;
          // Exponential backoff with jitter
          const delay = initialDelay * Math.pow(2, i) * (0.5 + Math.random());
          await new Promise(r => setTimeout(r, delay));
        }
      }
      throw lastError || new Error('Operation failed after retries');
    };

    console.log("Saving initial journal metadata to Firestore");
    // First save metadata to Firestore to get an ID
    const basicJournalData = {
      ...mainJournalData,
      userId: user.uid,
      createdAt: serverTimestamp(),
      hasPreview: Boolean(processedPreview),
      hasImages: images.length > 0,
      imageCount: images.length,
      images: [], // Will be populated with Storage URLs
      status: 'pending',
      saveStartTime: timestamp,
      retryCount: 0, // Add a retry counter for tracking
      networkErrors: 0, // Track network errors
      lastAttempt: serverTimestamp()
    };

    // Step 1: Create Firestore document for metadata
    console.log("Creating initial Firestore document");
    let docRef;
    try {
      docRef = await retry(() => addDoc(collection(db, 'journals'), basicJournalData));
      console.log(`Created document with ID: ${docRef.id}`);
    } catch (error) {
      console.error("Failed to create initial document after retries:", error);
      throw new Error(`Failed to create initial document: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    const journalId = docRef.id;

    // Update the document with its ID for easier reference
    try {
      await updateDoc(doc(db, 'journals', journalId), {
        journalId: journalId,
        status: 'uploading_images'
      });
    } catch (error) {
      console.warn("Failed to update document with ID, continuing anyway:", error);
    }

    // Step 2: Upload images to Firebase Storage with retries for each image
    console.log("Starting image uploads to Firebase Storage");
    const imageUploadResults = await Promise.allSettled(
      images.map(async (imageDataUrl, index) => {
        if (!imageDataUrl) {
          console.log(`Skipping empty image at index ${index}`);
          return { index, url: '', success: false };
        }
        
        return retry(async () => {
          console.log(`Uploading image ${index + 1}/${images.length}`);
          // Create a path for the image: journals/{userId}/{journalId}/image_{index}
          const imagePath = `journals/${user.uid}/${journalId}/image_${index}`;
          const storageRef = ref(storage, imagePath);
          
          // Upload the image to Storage (keeping original quality)
          await uploadString(storageRef, imageDataUrl, 'data_url');
          console.log(`Image ${index + 1} uploaded successfully`);
          
          // Get the public URL
          const imageUrl = await getDownloadURL(storageRef);
          console.log(`Got download URL for image ${index + 1}`);
          return { index, url: imageUrl, success: true };
        }, 4); // 4 retries per image
      })
    );

    // Extract successful uploads and handle failures
    const successfulUploads = imageUploadResults
      .filter((result): result is PromiseFulfilledResult<{index: number, url: string, success: boolean}> => 
        result.status === 'fulfilled' && result.value.success)
      .map(result => result.value.url);
      
    const failedUploads = imageUploadResults
      .filter((result): result is PromiseFulfilledResult<{index: number, url: string, success: boolean, error?: string}> => 
        result.status === 'fulfilled' && !result.value.success)
      .map(result => result.value);
      
    const rejectedUploads = imageUploadResults
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => result.reason);
    
    console.log(`Upload summary: ${successfulUploads.length} succeeded, ${failedUploads.length + rejectedUploads.length} failed`);
    
    if (failedUploads.length > 0 || rejectedUploads.length > 0) {
      console.warn("Some images failed to upload", { failedUploads, rejectedUploads });
    }

    // Step 3: Update Firestore document with Storage image URLs
    try {
      console.log("Updating Firestore with image URLs and completing journal");
      await retry(() => updateDoc(doc(db, 'journals', journalId), {
        images: successfulUploads,
        preview: processedPreview || '',
        status: 'complete',
        saveEndTime: Date.now().toString(),
        successfulImageCount: successfulUploads.length,
        failedImageCount: failedUploads.length + rejectedUploads.length,
        lastUpdateTime: serverTimestamp()
      }));
      console.log("Journal save completed successfully");
    } catch (error) {
      console.error("Failed to update journal with image URLs:", error);
      // Try a simpler update to mark as complete
      try {
        console.log("Attempting simplified completion update");
        await retry(() => updateDoc(doc(db, 'journals', journalId), {
          status: 'complete_partial',
          saveEndTime: Date.now().toString(),
          saveError: String(error),
          lastUpdateTime: serverTimestamp()
        }), 3);
      } catch (fallbackError) {
        console.error("Even simplified completion update failed:", fallbackError);
        // At this point we can't do much else, but at least the document is created
      }
    }

    return journalId;
  } catch (error) {
    console.error('Error saving journal to Firestore:', error);
    throw error;
  }
};

/**
 * Get all journals for the current user
 */
export const getUserJournals = async (): Promise<Journal[]> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Create query for user's journals
    const journalsQuery = query(
      collection(db, 'journals'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    // Execute query
    const querySnapshot = await getDocs(journalsQuery);
    
    if (querySnapshot.empty) {
      return []; // No journals found
    }
    
    // Map documents to Journal objects
    return Promise.all(querySnapshot.docs.map(async (doc) => {
      const data = doc.data();
      
      // Skip journals that are marked as pending and are older than 10 minutes
      if (data.status === 'pending') {
        const createdTime = data.createdAt instanceof Timestamp 
          ? data.createdAt.toDate().getTime()
          : 0;
          
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        if (createdTime < tenMinutesAgo) {
          console.warn(`Skipping incomplete journal ${doc.id} that appears abandoned`);
          return null;
        }
      }
      
      // Convert Firestore timestamp to string
      const createdAt = data.createdAt instanceof Timestamp 
        ? data.createdAt.toDate().toISOString()
        : new Date().toISOString();
      
      // Images are now URLs to Firebase Storage
      const images = Array.isArray(data.images) ? data.images : [];
      
      return {
        id: doc.id,
        ...data,
        images,
        createdAt,
        status: data.status || 'complete' // Default to complete for backward compatibility
      } as unknown as Journal;
    })).then(journals => 
      // Filter out any null journals (skipped incomplete ones)
      journals.filter((journal): journal is Journal => journal !== null)
    );
  } catch (error) {
    console.error('Error fetching user journals:', error);
    throw error;
  }
};

/**
 * Delete a journal and its associated images from Storage
 */
export const deleteJournal = async (journalId: string): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Verify ownership before deleting
    const journalRef = doc(db, 'journals', journalId);
    const journalSnap = await getDoc(journalRef);
    
    if (!journalSnap.exists()) {
      throw new Error('Journal not found');
    }
    
    const journalData = journalSnap.data();
    if (journalData.userId !== user.uid) {
      throw new Error('Not authorized to delete this journal');
    }

    // Delete associated images from Storage
    if (Array.isArray(journalData.images) && journalData.images.length > 0) {
      try {
        // Delete all images in the journal's folder
        const imageBasePath = `journals/${user.uid}/${journalId}`;
        const promises = [];
        
        // If we have image URLs, try to delete each one
        for (let i = 0; i < journalData.imageCount || 0; i++) {
          const imagePath = `${imageBasePath}/image_${i}`;
          const imageRef = ref(storage, imagePath);
          promises.push(
            deleteObject(imageRef).catch(error => {
              console.warn(`Failed to delete image ${i}, may not exist:`, error);
              // Continue even if deletion fails (image might not exist)
            })
          );
        }
        
        await Promise.all(promises);
      } catch (error) {
        console.warn('Error deleting journal images from Storage:', error);
        // Continue to delete Firestore doc even if image deletion fails
      }
    }

    // Delete the document from Firestore
    await deleteDoc(journalRef);
  } catch (error) {
    console.error('Error deleting journal:', error);
    throw error;
  }
};

/**
 * Check if a journal exists for the given date
 */
export const journalExistsForDate = async (dateISOString: string): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Extract just the date part for consistency (YYYY-MM-DD)
    const dateStr = dateISOString.split('T')[0];

    // Query for journals with this date
    const journalsQuery = query(
      collection(db, 'journals'),
      where('userId', '==', user.uid)
    );

    const querySnapshot = await getDocs(journalsQuery);
    
    // Check if any journal has a matching date (comparing only YYYY-MM-DD part)
    return querySnapshot.docs.some(doc => {
      const journalDate = doc.data().date.split('T')[0];
      return journalDate === dateStr;
    });
  } catch (error) {
    console.error('Error checking for journal with date:', error);
    throw error;
  }
}; 