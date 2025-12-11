import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'mania_journals';

export interface JournalImage {
  uri: string;
  x: number;
  y: number;
  scale: number;
}

export interface Journal {
  id: string;
  date: string;
  location?: string;
  title?: string;
  text: string;
  images: JournalImage[];
  colors: {
    locationColor: string;
    locationShadowColor: string;
  };
  createdAt: string;
  prompt?: string;
}

export const saveJournal = async (
  journalData: Omit<Journal, 'id' | 'createdAt'>
): Promise<string> => {
  try {
    const journalId = `journal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const journal: Journal = {
      ...journalData,
      id: journalId,
      createdAt: new Date().toISOString(),
    };

    const existingJournals = await getUserJournals();
    const updatedJournals = [...existingJournals, journal];

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedJournals));

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

export const deleteJournal = async (journalId: string): Promise<void> => {
  try {
    const journals = await getUserJournals();
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
  updatedData: Omit<Journal, 'id' | 'createdAt'>
): Promise<void> => {
  try {
    const journals = await getUserJournals();
    const index = journals.findIndex(j => j.id === journalId);

    if (index === -1) {
      throw new Error('Journal not found');
    }

    journals[index] = {
      ...journals[index],
      ...updatedData,
      id: journalId, // Preserve original ID
      createdAt: journals[index].createdAt, // Preserve creation date
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(journals));
  } catch (error) {
    console.error('Error updating journal:', error);
    throw error;
  }
};
