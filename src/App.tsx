import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import JournalCanvas from './components/JournalCanvas';
import MobileJournalEditor from './components/MobileJournalEditor';
import { isMobile } from './utils/isMobile';
import { useMediaQuery } from 'react-responsive';

import JournalForm from './components/JournalForm';
import Login from './components/auth/Login';
import Home from './components/Home';
import StreakIndicator from './components/StreakIndicator';

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

// Create AuthContext
interface AuthContextProps {
  isAuthenticated: boolean;
  user: User | null;
  login: (token: string) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextProps>({
  isAuthenticated: false,
  user: null,
  login: () => {},
  logout: () => {}
});

// Layout component that conditionally renders header and footer
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, logout } = useContext(AuthContext);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [logoHighlight, setLogoHighlight] = useState(false);
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [typedText, setTypedText] = useState("");
  const fullText = "ania";
  
  // Exclude header/footer from both home and login pages
  const shouldHideNav = location.pathname === '/' || location.pathname === '/login';
  
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
      {/* Only show header and mobile menu on pages that aren't home or login */}
      {!shouldHideNav && (
        <>
          {/* Navigation */}
          <nav className="relative z-50 py-3 border-b border-white/20 bg-black/95 backdrop-blur-md">
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
                  {isAuthenticated && (
                    <div className="flex items-center">
                      <StreakIndicator />
                    </div>
                  )}
                  {isAuthenticated ? (
                    <button 
                      onClick={logout}
                      className="py-2 px-4 border border-white/30 rounded-lg text-base font-medium text-white hover:bg-white/10 transition-all duration-200 backdrop-blur-sm"
                    >
                      Sign out
                    </button>
                  ) : (
                    <Link 
                      to="/login"
                      className="py-2 px-4 border border-white/30 rounded-lg text-base font-medium text-white hover:bg-white/10 transition-all duration-200 backdrop-blur-sm"
                    >
                      Sign in
                    </Link>
                  )}
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
                  {isAuthenticated && (
                    <div className="px-3 py-2 border-b border-white/10">
                      <StreakIndicator />
                    </div>
                  )}
                  {isAuthenticated ? (
                    <button
                      onClick={() => {
                        logout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-base font-medium text-white hover:bg-white/10 transition-all duration-200"
                    >
                      Sign out
                    </button>
                  ) : (
                    <Link
                      to="/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block px-3 py-2 rounded-lg text-base font-medium text-white hover:bg-white/10 transition-all duration-200"
                    >
                      Sign in
                    </Link>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
      
      {/* Main content */}
      <main className="flex-grow relative z-10">
        {children}
      </main>
      
      {/* Only show footer on non-home, non-login pages */}
      {!shouldHideNav && (
        <footer className="bg-black/80 backdrop-blur-md py-3 border-t border-white/10 relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs sm:text-sm text-white/60">
              © {new Date().getFullYear()} Create zain's journals without the pen in your hand.
            </p>
          </div>
        </footer>
      )}
    </>
  );
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [date, setDate] = useState(new Date());
  const [location, setLocation] = useState('');
  const [images, setImages] = useState<(string | Blob)[]>([]);
  const [textSections, setTextSections] = useState<string[]>(['']);
  const isMobileView = useMediaQuery({ maxWidth: 767 });

  // Effect to check if user is logged in using Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName
        });
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  // Handle login
  const login = (token: string) => {
    // Note: actual login is handled by Firebase Auth
    console.log("Login with token:", token);
  };
  
  // Handle logout
  const logout = () => {
    auth.signOut().then(() => {
      setIsAuthenticated(false);
      setUser(null);
    }).catch((error) => {
      console.error("Error signing out:", error);
    });
  };
  
  // Auth context value
  const authContextValue = {
    isAuthenticated,
    user,
    login,
    logout
  };

  const handleMobileUpdate = (data: {
    date: Date;
    location: string;
    images: (string | Blob)[];
    textSections: string[];
  }) => {
    setDate(data.date);
    setLocation(data.location);
    setImages(data.images);
    setTextSections(data.textSections);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      <Router>
        <div className="min-h-screen flex flex-col bg-gray-50">
          {/* Only wrap in Layout if not on mobile journal */}
            <Routes>
              <Route path="/" element={<Home />} />
              <Route 
                path="/journal" 
                element={
                  isAuthenticated ? (
                  isMobileView ? (
                        <MobileJournalEditor
                          onUpdate={handleMobileUpdate}
                          initialData={{
                            date,
                            location,
                            images,
                            textSections,
                          }}
                        />
                      ) : (
                    <Layout>
                    <JournalForm isAuthenticated={isAuthenticated} />
                    </Layout>
                  )
                  ) : (
                    <Navigate to="/login" replace />
                  )
                } 
              />
              <Route 
                path="/login" 
                element={
                  isAuthenticated ? (
                    <Navigate to="/journal" replace />
                  ) : (
                    <Login />
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
    </AuthContext.Provider>
  );
}

export default App;
