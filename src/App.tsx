import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import './App.css';

// Import components
import LoadingSpinner from './components/LoadingSpinner';
import JournalForm from './components/JournalForm';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);

  const formVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.4,
        duration: 0.8,
        ease: "easeOut"
      }
    }
  };

  return (
    <main className="min-h-screen relative bg-[#f5f2e9]">
      {isLoading ? (
        <LoadingSpinner message="Loading your journal..." />
      ) : (
        <div className="relative z-10">
          {/* Hero Section */}
          <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            <div className="max-w-7xl mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="mb-12"
              >
                <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold mb-6 tracking-tight text-[#1a1a1a]">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#1a1a1a] to-[#4a4a4a]">mania</span>
                </h1>
                <p className="text-xl text-[#333333] max-w-xl mx-auto mb-8">
                 Create zain's journals without the pen in your hand.
                </p>
                
                <motion.button
                  className="px-8 py-4 bg-[#1a1a1a] text-[#f5f2e9] text-lg font-semibold rounded-xl shadow-lg flex items-center gap-2 mx-auto"
                  whileHover={{ 
                    scale: 1.05, 
                    boxShadow: "0 0 15px rgba(26, 26, 26, 0.3)"
                  }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const createSection = document.getElementById('create');
                    if (createSection) {
                      createSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z"></path>
                  </svg>
                  Start Journaling
                </motion.button>
              </motion.div>
            </div>
          </section>

          {/* Journal Form Section */}
          <section className="py-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#f5f2e9] to-[#e8e4d5]" id="create">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold mb-4 text-[#1a1a1a]">Create Your Journal</h2>
                <p className="text-xl text-[#333333] max-w-3xl mx-auto">Fill in the details below to create your elegant journal entry</p>
              </div>
              
              <motion.div
                initial="hidden"
                animate="visible"
                variants={formVariants}
              >
                <JournalForm />
              </motion.div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
