import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';

// Define the Journal type
interface Journal {
  id: string;
  date: string;
  location: string;
  text: string[];
  images: string[];
  textColors: {
    locationColor: string;
    locationShadowColor: string;
  };
  layoutMode: 'standard' | 'mirrored';
  createdAt: string;
  preview: string;
}

const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [journalToDelete, setJournalToDelete] = useState<string | null>(null);

  // Load journals from localStorage (or Firestore in a real implementation)
  useEffect(() => {
    const loadJournals = async () => {
      try {
        setLoading(true);
        // In a real implementation, you would fetch from Firestore:
        /*
        import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
        import { auth } from '../firebase';
        
        const db = getFirestore();
        const userId = auth.currentUser?.uid;
        
        const journalsQuery = query(
          collection(db, "journals"), 
          where("userId", "==", userId)
        );
        
        const querySnapshot = await getDocs(journalsQuery);
        const journalData = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        })) as Journal[];
        */
        
        // For now, load from localStorage
        const journalData = JSON.parse(localStorage.getItem('journals') || '[]') as Journal[];
        
        // Sort by creation date, newest first
        journalData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        setJournals(journalData);
        // Set the first journal as selected by default if available
        if (journalData.length > 0) {
          setSelectedJournal(journalData[0]);
        }
      } catch (error) {
        console.error('Error loading journals:', error);
        toast.error('Failed to load your journals');
      } finally {
        setLoading(false);
      }
    };
    
    loadJournals();
  }, []);

  // Format date for display
  const formatDate = (dateString: string): string => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Handle journal deletion
  const handleDeleteJournal = (journalId: string) => {
    setJournalToDelete(journalId);
    setShowDeleteModal(true);
  };

  // Confirm and complete deletion
  const confirmDeleteJournal = () => {
    if (!journalToDelete) return;
    
    try {
      // In a real implementation, you would delete from Firestore:
      /*
      import { getFirestore, doc, deleteDoc } from 'firebase/firestore';
      
      const db = getFirestore();
      await deleteDoc(doc(db, "journals", journalToDelete));
      */
      
      // For now, delete from localStorage
      const updatedJournals = journals.filter(journal => journal.id !== journalToDelete);
      localStorage.setItem('journals', JSON.stringify(updatedJournals));
      
      // If the deleted journal was selected, select another one
      if (selectedJournal && selectedJournal.id === journalToDelete) {
        setSelectedJournal(updatedJournals.length > 0 ? updatedJournals[0] : null);
      }
      
      setJournals(updatedJournals);
      setShowDeleteModal(false);
      setJournalToDelete(null);
      toast.success('Journal deleted successfully');
    } catch (error) {
      console.error('Error deleting journal:', error);
      toast.error('Failed to delete journal');
    }
  };

  // Handle journal selection
  const handleSelectJournal = (journal: Journal) => {
    setSelectedJournal(journal);
  };

  // Download journal as image
  const downloadJournalImage = (preview: string, journalId: string) => {
    if (!preview) return;
    
    const a = document.createElement('a');
    a.href = preview;
    a.download = `journal-${journalId}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#15803d]"></div>
      </div>
    );
  }

  if (journals.length === 0) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">Your Journal Gallery</h2>
          <Link
            to="/"
            className="px-4 py-2 bg-[#b5a890] text-white font-medium rounded-lg shadow-sm flex items-center gap-2 hover:bg-[#a39580] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            Create New Journal
          </Link>
        </div>
        
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
          </svg>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Journals Yet</h3>
          <p className="text-gray-500 mb-6">Create your first journal entry to see it here.</p>
          <Link
            to="/"
            className="px-6 py-3 bg-[#b5a890] text-white font-medium rounded-lg shadow-md inline-flex items-center gap-2 hover:bg-[#a39580] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            Create First Journal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">Your Journal Gallery</h2>
        <Link
          to="/"
          className="px-4 py-2 bg-[#b5a890] text-white font-medium rounded-lg shadow-sm flex items-center gap-2 hover:bg-[#a39580] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
          </svg>
          Create New Journal
        </Link>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Thumbnails */}
        <div className="w-64 border-r border-gray-200 bg-gray-100 overflow-y-auto">
          <div className="p-3 border-b border-gray-200 bg-white">
            <h3 className="text-sm font-medium text-gray-700">All Journals</h3>
          </div>
          
          <div className="py-2">
            {journals.map((journal, index) => (
              <motion.div
                key={journal.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className={`p-2 cursor-pointer border-l-4 ${selectedJournal?.id === journal.id ? 'border-[#b5a890] bg-white' : 'border-transparent hover:bg-white'}`}
                onClick={() => handleSelectJournal(journal)}
              >
                <div className="aspect-[4/3] mb-2 rounded-md overflow-hidden shadow-sm bg-white">
                  {journal.preview ? (
                    <img 
                      src={journal.preview} 
                      alt={`Journal #${index + 1}`} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                  )}
                </div>
                <p className="text-xs text-center text-gray-500">Journal #{index + 1}</p>
              </motion.div>
            ))}
          </div>
        </div>
        
        {/* Main content area */}
        <div className="flex-1 overflow-auto bg-gray-50">
          {selectedJournal ? (
            <div className="max-w-4xl mx-auto py-8 px-6">
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                {/* Journal header - simplified */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500">
                      Journal #{journals.findIndex(j => j.id === selectedJournal.id) + 1}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteJournal(selectedJournal.id)}
                      className="p-2 text-gray-500 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
                      title="Delete Journal"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => downloadJournalImage(selectedJournal.preview, selectedJournal.id)}
                      className="p-2 text-gray-500 hover:text-blue-500 transition-colors rounded-full hover:bg-blue-50"
                      title="Download as Image"
                      disabled={!selectedJournal.preview}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Journal content - Only show the image */}
                <div className="p-6">
                  {selectedJournal.preview && (
                    <div className="rounded-xl overflow-hidden shadow-md bg-[#f9f7f1]">
                      <img 
                        src={selectedJournal.preview} 
                        alt={`Journal #${journals.findIndex(j => j.id === selectedJournal.id) + 1}`} 
                        className="w-full h-auto"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-500">Select a journal from the sidebar to view it</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Delete Journal</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this journal? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setJournalToDelete(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteJournal}
                className="px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery; 