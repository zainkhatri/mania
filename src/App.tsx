import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import JournalCanvas from './components/JournalCanvas';
import JournalForm from './components/JournalForm';

// Layout component that conditionally renders header and footer
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [logoHighlight, setLogoHighlight] = useState(false);
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [typedText, setTypedText] = useState("");
  const fullText = "ania";
  
  // Typewriter effect for the logo
  useEffect(() => {
    // Only animate when hovered and on journal page
    if (isLogoHovered && location.pathname === '/journal') {
      let currentIndex = 0;
      const typingInterval = setInterval(() => {
        if (currentIndex < fullText.length) {
          setTypedText(fullText.substring(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(typingInterval);
        }
      }, 100); // Speed of typing
      
      return () => {
        clearInterval(typingInterval);
      };
    } else if (!isLogoHovered) {
      setTypedText("");
    }
  }, [isLogoHovered, location.pathname]);
  
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };
  
  // Render the logo with typewriter animation
  const renderLogo = () => {
    const isJournalPage = location.pathname === '/journal';
    
    if (isJournalPage) {
      return (
        <div 
          className="flex items-center"
          onMouseEnter={() => setIsLogoHovered(true)}
          onMouseLeave={() => setIsLogoHovered(false)}
          style={{ minWidth: "200px" }}
        >
          <span className="logo-m">m</span>
          <span className="logo-m">{typedText}</span>
        </div>
      );
    } else {
      return <span className="logo-m">m</span>;
    }
  };
  
  return (
    <>
      {/* Navigation */}
      <nav className="relative z-50 py-3 border-b border-white/20 bg-black/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center">
              <Link to="/journal" className="flex-shrink-0 flex items-center">
                <div className="text-4xl md:text-5xl text-white font-light">
                  {renderLogo()}
                </div>
              </Link>
            </div>

            {/* Desktop menu */}
            <div className="hidden md:flex items-center gap-6">
              {/* Navigation content can be added here if needed */}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={toggleMobileMenu}
                className="inline-flex items-center justify-center p-2 rounded-lg text-white hover:bg-white/10 focus:outline-none transition-all duration-200"
              >
                <span className="sr-only">Open main menu</span>
                {!isMobileMenuOpen ? (
                  <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                ) : (
                  <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden absolute w-full bg-black/90 backdrop-blur-md shadow-lg border-b border-white/20 z-40"
          >
            <div className="px-4 py-3 space-y-2">
              {/* Mobile menu content can be added here if needed */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Main content */}
      <main className="flex-grow relative z-10">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="hidden md:block bg-black/80 backdrop-blur-md py-3 border-t border-white/10 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs sm:text-sm text-white/60">
            © {new Date().getFullYear()} Create zain's journals without the pen in your hand.
          </p>
        </div>
      </footer>
    </>
  );
};

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Routes>
          <Route path="/" element={<Navigate to="/journal" replace />} />
          <Route 
            path="/journal" 
            element={
              <Layout>
                <JournalForm />
              </Layout>
            } 
          />
        </Routes>
      </div>
      {/* Toast notifications container */}
      <ToastContainer 
        position="bottom-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </Router>
  );
}

export default App;
