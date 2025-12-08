/**
 * Service class for handling journal operations with local storage
 */
export interface Journal {
  id?: string;
  date: string;
  location: string;
  text: string[];
  images: string[];  // Store as data URLs
  textColors: {
    locationColor: string;
    locationShadowColor: string;
  };
  layoutMode: 'standard' | 'mirrored' | 'freeflow';
  createdAt: string;
  preview: string;  // Preview as data URL
}

/**
 * Save a journal to local storage
 */
export const saveJournal = async (journalData: Omit<Journal, 'id' | 'createdAt'>): Promise<string> => {
  try {
    console.log("Starting journal save process");
    
    // Generate a unique ID
    const journalId = `journal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create the journal object
    const journal: Journal = {
      ...journalData,
      id: journalId,
      createdAt: new Date().toISOString()
    };
    
    // Get existing journals from localStorage
    const existingJournals = JSON.parse(localStorage.getItem('local_journals') || '[]');
    
    // Add the new journal
    existingJournals.push(journal);
    
    // Save back to localStorage
    localStorage.setItem('local_journals', JSON.stringify(existingJournals));
    
    console.log(`Journal saved successfully with ID: ${journalId}`);
    return journalId;
  } catch (error) {
    console.error("Error saving journal:", error);
    throw new Error(`Failed to save journal: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Get all journals from local storage
 */
export const getUserJournals = async (): Promise<Journal[]> => {
  try {
    const journals = JSON.parse(localStorage.getItem('local_journals') || '[]');
    return journals.sort((a: Journal, b: Journal) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error("Error getting journals:", error);
    return [];
  }
};

/**
 * Delete a journal from local storage
 */
export const deleteJournal = async (journalId: string): Promise<void> => {
  try {
    const journals = JSON.parse(localStorage.getItem('local_journals') || '[]');
    const filteredJournals = journals.filter((journal: Journal) => journal.id !== journalId);
    localStorage.setItem('local_journals', JSON.stringify(filteredJournals));
    console.log(`Journal ${journalId} deleted successfully`);
  } catch (error) {
    console.error("Error deleting journal:", error);
    throw new Error(`Failed to delete journal: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Check if a journal exists for a specific date
 */
export const journalExistsForDate = async (dateISOString: string): Promise<boolean> => {
  try {
    const journals = JSON.parse(localStorage.getItem('local_journals') || '[]');
    const targetDate = new Date(dateISOString).toISOString().split('T')[0]; // Get YYYY-MM-DD format
    
    return journals.some((journal: Journal) => {
      const journalDate = new Date(journal.date).toISOString().split('T')[0];
      return journalDate === targetDate;
    });
  } catch (error) {
    console.error("Error checking journal existence:", error);
    return false;
  }
}; 