import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCpu-kfpn20-IOQC-QmGiOdm8cy9NtMkQo",
  authDomain: "mania-65325.firebaseapp.com",
  projectId: "mania-65325",
  storageBucket: "mania-65325.firebasestorage.app",
  messagingSenderId: "194788144457",
  appId: "1:194788144457:web:fa6de7b299abb27c249698",
  measurementId: "G-5EDN5LE9D4"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firebase Analytics
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { analytics };

// Google signin
export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

// Logout user
export const logoutUser = async () => {
  try {
    await signOut(auth);
    return true;
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

export default app; 