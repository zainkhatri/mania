import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

interface Journal {
  _id: string;
  title: string;
  content: string;
  createdAt: string;
  images?: string[];
  mood?: number;
  tags?: string[];
}

const JournalList: React.FC = () => {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState(0);
  
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  
  // Backend API URL - should be in env variable in a real app
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchJournals = async () => {
      try {
        setLoading(true);
        
        const token = localStorage.getItem('token');
        
        if (!token) {
          navigate('/login');
          return;
        }
        
        const response = await axios.get(`${API_URL}/api/journals/book/${bookId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        setJournals(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching journals:', err);
        setError('Failed to load journals');
        setLoading(false);
      }
    };
    
    fetchJournals();
  }, [bookId, navigate, API_URL]);

  const handleSwipe = (newDirection: number) => {
    if (
      (newDirection === -1 && currentIndex < journals.length - 1) ||
      (newDirection === 1 && currentIndex > 0)
    ) {
      setDirection(newDirection);
      setCurrentIndex(currentIndex - newDirection);
    }
  };

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700">{error}</p>
          <button
            onClick={() => navigate('/books')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Books
          </button>
        </div>
      </div>
    );
  }

  if (journals.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">No Journals Found</h2>
          <p className="text-gray-600 mb-4">Start writing your first journal entry.</p>
          <button
            onClick={() => navigate(`/books/${bookId}/new-journal`)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create New Journal
          </button>
        </div>
      </div>
    );
  }

  const currentJournal = journals[currentIndex];

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 flex justify-between items-center border-b">
        <button 
          onClick={() => navigate('/books')}
          className="text-gray-500 hover:text-gray-700"
        >
          &larr; Back
        </button>
        <div className="text-center">
          <span className="text-sm text-gray-500">
            {currentIndex + 1} of {journals.length}
          </span>
        </div>
        <button
          onClick={() => navigate(`/books/${bookId}/new-journal`)}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          + New
        </button>
      </div>
      
      {/* Journal Content */}
      <div className="flex-grow overflow-hidden relative">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentJournal._id}
            custom={direction}
            initial={{ 
              x: direction === 0 ? 0 : direction > 0 ? -1000 : 1000,
              opacity: 0 
            }}
            animate={{ 
              x: 0,
              opacity: 1
            }}
            exit={{ 
              x: direction < 0 ? -1000 : 1000,
              opacity: 0
            }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 p-6 overflow-y-auto"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = offset.x < -100 ? -1 : offset.x > 100 ? 1 : 0;
              if (swipe !== 0) {
                handleSwipe(swipe);
              }
            }}
          >
            <div className="max-w-2xl mx-auto">
              <div className="mb-2 text-gray-500 text-sm">
                {formatDate(currentJournal.createdAt)}
              </div>
              
              <h1 className="text-3xl font-bold mb-4">{currentJournal.title}</h1>
              
              {currentJournal.mood && (
                <div className="mb-4">
                  <span className="text-sm text-gray-600">Mood: </span>
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                    {currentJournal.mood}/10
                  </span>
                </div>
              )}
              
              {currentJournal.images && currentJournal.images.length > 0 && (
                <div className="mb-6">
                  <img
                    src={currentJournal.images[0]}
                    alt="Journal"
                    className="rounded-lg shadow-md w-full h-48 object-cover"
                  />
                </div>
              )}
              
              <div className="prose prose-lg max-w-none">
                {currentJournal.content.split('\n').map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
              
              {currentJournal.tags && currentJournal.tags.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {currentJournal.tags.map((tag, idx) => (
                    <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              
              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => navigate(`/books/${bookId}/edit-journal/${currentJournal._id}`)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Edit
                </button>
                
                <button
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to delete this journal?')) {
                      try {
                        const token = localStorage.getItem('token');
                        await axios.delete(`${API_URL}/api/journals/${currentJournal._id}`, {
                          headers: {
                            Authorization: `Bearer ${token}`
                          }
                        });
                        
                        // Remove the journal from state
                        const newJournals = [...journals];
                        newJournals.splice(currentIndex, 1);
                        
                        if (newJournals.length === 0) {
                          // If no journals left, go back to books
                          navigate('/books');
                        } else {
                          // Update state
                          setJournals(newJournals);
                          // Adjust currentIndex if needed
                          if (currentIndex >= newJournals.length) {
                            setCurrentIndex(newJournals.length - 1);
                          }
                        }
                      } catch (err) {
                        console.error('Error deleting journal:', err);
                        alert('Failed to delete journal');
                      }
                    }
                  }}
                  className="text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* Navigation Controls */}
      <div className="p-4 flex justify-between border-t">
        <button
          onClick={() => handleSwipe(1)}
          disabled={currentIndex === 0}
          className={`px-4 py-2 rounded ${
            currentIndex === 0
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
          }`}
        >
          Previous
        </button>
        
        <button
          onClick={() => handleSwipe(-1)}
          disabled={currentIndex === journals.length - 1}
          className={`px-4 py-2 rounded ${
            currentIndex === journals.length - 1
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default JournalList; 