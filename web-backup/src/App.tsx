import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import './App.css';
import JournalForm from './components/JournalForm';
import MobileJournal from './components/MobileJournal';
import Home from './components/Home';
import Particles from './components/Particles';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


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
            <div className="w-full px-4 lg:px-6">
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

                {/* Desktop action buttons - removed, moved to journal preview */}
                <div className="hidden md:flex items-center gap-2">
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

// AppContent component to use useLocation inside Router
const AppContent: React.FC = () => {
  // Compute isMobile once on mount - no flapping
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const location = useLocation();

  // Throttle resize detection to prevent layout shift
  useEffect(() => {
    let rafId = 0;
    const onResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const nextMobile = window.innerWidth <= 768;
        // Only update if value CHANGED (crosses breakpoint)
        setIsMobile(prev => prev === nextMobile ? prev : nextMobile);
      });
    };

    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Memoize the journal element to prevent unnecessary re-renders
  const journalElement = useMemo(() => {
    return isMobile ? (
      <div key="mobile-journal-wrapper" className="mobile-journal-wrapper">
        <MobileJournal key="mobile-journal-form" />
      </div>
    ) : (
      <Layout key="desktop-layout">
        <JournalForm key="desktop-journal-form" />
      </Layout>
    );
  }, [isMobile]);

  return (
    <>
      <div
        className="min-h-dvh w-full flex flex-col bg-black overflow-x-clip"
        data-debug-component="appcontent-wrapper"
        style={{
          boxSizing: 'border-box',
          position: 'relative'
        }}
      >
        {/* Particles Background */}
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}>
          <Particles
            particleColors={['#ffffff', '#ffffff']}
            particleCount={1000}
            particleSpread={10}
            speed={2}
            particleBaseSize={100}
            moveParticlesOnHover={false}
            alphaParticles={true}
            disableRotation={false}
          />
        </div>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/journal"
            element={journalElement}
          />
        </Routes>
      </div>

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
    </>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
