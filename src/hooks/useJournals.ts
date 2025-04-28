import { useState, useEffect } from 'react';
import { collection, query, where, addDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  date: string;
  userId: string;
  userEmail: string | null;
  userDisplayName: string | null;
  createdAt: number;
  updatedAt: number;
}

export const useJournals = () => {
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setJournals([]);
      setLoading(false);
      return;
    }

    const journalsRef = collection(db, 'journals');
    const q = query(
      journalsRef, 
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const journalData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as JournalEntry));
      
      // Sort journals by creation date, newest first
      journalData.sort((a, b) => b.createdAt - a.createdAt);
      
      setJournals(journalData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const addJournal = async (title: string, content: string) => {
    if (!user) return;

    try {
      const timestamp = Date.now();
      await addDoc(collection(db, 'journals'), {
        title,
        content,
        date: new Date().toISOString(),
        userId: user.uid,
        userEmail: user.email,
        userDisplayName: user.displayName,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    } catch (error) {
      console.error('Error adding journal:', error);
      throw error; // Propagate error to handle it in the UI
    }
  };

  const deleteJournal = async (journalId: string) => {
    if (!user) return;
    
    try {
      const docRef = doc(db, 'journals', journalId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting journal:', error);
      throw error; // Propagate error to handle it in the UI
    }
  };

  return {
    journals,
    loading,
    addJournal,
    deleteJournal
  };
}; 