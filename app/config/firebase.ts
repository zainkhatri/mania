import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import Constants from 'expo-constants';

// Firebase config from environment variables
// Get from expo-constants for proper React Native support
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey || '',
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain || '',
  projectId: Constants.expoConfig?.extra?.firebaseProjectId || '',
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket || '',
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId || '',
  appId: Constants.expoConfig?.extra?.firebaseAppId || '',
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

export const initializeFirebase = () => {
  if (!app) {
    // Check if Firebase config is available
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.warn('⚠️ Firebase config not found. App will work in offline mode.');
      return { app: null, auth: null, db: null, storage: null };
    }
    
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app);
      console.log('🔥 Firebase initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing Firebase:', error);
      // Don't throw - allow app to work offline
      console.warn('⚠️ Continuing without Firebase. App will work in offline mode.');
    }
  }
  return { app, auth, db, storage };
};

export const getFirebaseAuth = (): Auth | null => {
  if (!auth) {
    initializeFirebase();
  }
  return auth;
};

export const getFirebaseDb = (): Firestore | null => {
  if (!db) {
    initializeFirebase();
  }
  return db;
};

export const getFirebaseStorage = (): FirebaseStorage | null => {
  if (!storage) {
    initializeFirebase();
  }
  return storage;
};
