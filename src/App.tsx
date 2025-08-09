import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import JournalForm from './components/JournalForm';
import MobileJournal from './components/MobileJournal';
import Home from './components/Home';


// Extend Window interface for global functions
declare global {
  interface Window {
    handleHighQualityPDFExport?: () => void;
    handleReset?: () => void;
  }
}

// Layout component that conditionally renders header and footer
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [showGlitch, setShowGlitch] = useState(false);
  
  // Exclude header/footer from home page
  const shouldHideNav = location.pathname === '/';
  
  // Home screen style animation for the logo
  useEffect(() => {
    if (isLogoHovered && location.pathname === '/journal') {
      // Create dynamic title style cycling like home screen
      const styleInterval = setInterval(() => {
        // Pick a random letter to highlight instead of cycling sequentially
        // Only cycle through "ania" (4 letters), not "mania" (5 letters)
        const randomIndex = Math.floor(Math.random() * 4);
        setHighlightIndex(randomIndex);
      }, 200); // Fast random cycling
      
      const glitchInterval = setInterval(() => {
        // Random glitch effect
        if (Math.random() > 0.7) {
          setShowGlitch(true);
          setTimeout(() => setShowGlitch(false), 150);
        }
      }, 1200);
      
      return () => {
        clearInterval(styleInterval);
        clearInterval(glitchInterval);
      };
    } else {
      // Reset when not hovered
      setHighlightIndex(0);
      setShowGlitch(false);
    }
  }, [isLogoHovered, location.pathname]);
  

  
  // Render the logo with home screen style animation
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
          {isLogoHovered ? (
            <span 
              className="text-flicker"
              style={{ 
                filter: showGlitch ? 'hue-rotate(90deg) brightness(1.5)' : 'none',
                transition: 'filter 0.1s'
              }}
            >
              {renderTitle()}
            </span>
          ) : (
            <span className="logo-m">m</span>
          )}
        </div>
      );
    } else {
      return <span className="logo-m">m</span>;
    }
  };
  
  // Render the title with one highlighted letter at a time (like home screen)
  const renderTitle = () => {
    const word = "ania";
    
    return (
      <span className="title-container">
        <span className="logo-m">m</span>
        {word.split('').map((letter, index) => (
          <span 
            key={`letter-${index}-${highlightIndex}`}
            className={index === highlightIndex 
              ? "letter-highlight" 
              : "letter-normal"}
          >
            {letter}
          </span>
        ))}
      </span>
    );
  };
  
  return (
    <>
      {/* Only show header and mobile menu on pages that aren't home */}
      {!shouldHideNav && (
        <>
          {/* Navigation - Hidden on mobile */}
          <nav className="relative z-50 py-3 border-b border-white/20 bg-black/95 backdrop-blur-md hidden md:block">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-14">
                <div className="flex items-center">
                  <Link to="/" className="flex-shrink-0 flex items-center">
                    <div className="text-4xl md:text-5xl text-white font-light">
                      {renderLogo()}
                    </div>
                  </Link>
                </div>

                {/* Desktop menu */}
                <div className="hidden md:flex items-center gap-6">
                </div>

                {/* Desktop action buttons */}
                <div className="hidden md:flex items-center gap-2">
                  {/* Download Journal Button */}
                  <button
                    onClick={() => {
                      // We'll need to pass this function from JournalForm
                      if (window.handleHighQualityPDFExport) {
                        window.handleHighQualityPDFExport();
                      }
                    }}
                    className="inline-flex items-center justify-center p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white focus:outline-none transition-all duration-200"
                    title="Download Journal"
                  >
                    <svg className="block h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                  </button>
                  
                  {/* Clear Journal Button */}
                  <button
                    onClick={() => {
                      // We'll need to pass this function from JournalForm
                      if (window.handleReset) {
                        window.handleReset();
                      }
                    }}
                    className="inline-flex items-center justify-center p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white focus:outline-none transition-all duration-200"
                    title="Clear Journal"
                  >
                    <svg className="block h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </nav>
          

        </>
      )}
      
       {/* Main content */}
       <main className="flex-1 relative z-10 overflow-visible">
        {children}
      </main>
      
      {/* Footer removed */}
    </>
  );
};

function App() {
  const [isMobile, setIsMobile] = useState(false);

  // Check if device is mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-black overflow-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route 
            path="/journal" 
            element={
              isMobile ? (
                <MobileJournal />
              ) : (
                <Layout>
                  <JournalForm />
                </Layout>
              )
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
