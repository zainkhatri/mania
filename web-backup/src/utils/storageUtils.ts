/**
 * Utility functions for managing localStorage
 */

/**
 * Clears all journal-related data from localStorage
 * This includes drafts, submitted journals, and their chunks
 */
export const clearJournalCache = (): void => {
  // Clear main items
  localStorage.removeItem('webjournal_draft');
  localStorage.removeItem('webjournal_submitted');
  
  // Clear metadata
  localStorage.removeItem('webjournal_draft_meta');
  localStorage.removeItem('webjournal_submitted_meta');
  
  // Clear chunks by iterating through all localStorage items
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith('webjournal_draft_chunk_') || 
      key.startsWith('webjournal_submitted_chunk_')
    )) {
      keysToRemove.push(key);
    }
  }
  
  // Remove all identified keys
  keysToRemove.forEach(key => localStorage.removeItem(key));
}; 