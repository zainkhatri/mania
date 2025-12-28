import { initializeFirebase, getFirebaseAuth, getFirebaseDb, getFirebaseStorage } from '../config/firebase';

// Initialize Firebase on app startup
export const initFirebase = () => {
  try {
    initializeFirebase();
    console.log('🔥 Firebase services initialized');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw error;
  }
};

// Export Firebase instances
export { getFirebaseAuth, getFirebaseDb, getFirebaseStorage };
