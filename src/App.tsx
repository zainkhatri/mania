import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1a1a1a]"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      <Router>
        <div className="min-h-screen bg-[#f8f5f0] flex flex-col">
          {/* Navigation */}
          <nav className="bg-white shadow-sm relative z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex">
                  <Link to="/" className="flex-shrink-0 flex items-center">
                    <div className="font-serif text-2xl md:text-3xl font-bold text-[#1a1a1a]">
                      mania
                      <span className="absolute h-1.5 w-1.5 rounded-full bg-[#1a1a1a] ml-0.5 mt-1"></span>
                    </div>
                  </Link>
                </div>

                {/* Desktop menu */}
                <div className="hidden md:flex items-center gap-4">
                  {isAuthenticated && <StreakIndicator />}
                  {isAuthenticated ? (
                    <button 
                      onClick={logout}
                      className="ml-3 py-1.5 px-3 border border-[#d1cdc0] rounded-md text-sm font-medium text-[#333333] hover:bg-[#f2efe9]"
                    >
                      Sign out
                    </button>
                  ) : (
                    <Link 
                      to="/login"
                      className="ml-4 py-1.5 px-3 border border-[#d1cdc0] rounded-md text-sm font-medium text-[#333333] hover:bg-[#f2efe9]"
                    >
                      Sign in
                    </Link>
                  )}
                </div>

                {/* Mobile menu button */}
                <div className="md:hidden flex items-center">
                  <button
                    onClick={toggleMobileMenu}
                    className="inline-flex items-center justify-center p-2 rounded-md text-[#333333] hover:text-[#1a1a1a] hover:bg-[#f2efe9] focus:outline-none"
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
                className="md:hidden absolute w-full bg-white shadow-lg"
              >
                <div className="px-2 pt-2 pb-3 space-y-1">
                  {isAuthenticated && (
                    <>
                      <div className="px-3 py-2">
                        <StreakIndicator />
                      </div>
                    </>
                  )}
                  {isAuthenticated ? (
                    <button
                      onClick={() => {
                        logout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-[#333333] hover:text-[#1a1a1a] hover:bg-[#f2efe9]"
                    >
                      Sign out
                    </button>
                  ) : (
                    <Link
                      to="/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block px-3 py-2 rounded-md text-base font-medium text-[#333333] hover:text-[#1a1a1a] hover:bg-[#f2efe9]"
                    >
                      Sign in
                    </Link>
                  )}
                </div>
            </motion.div>
            )}
          </AnimatePresence>
          
          {/* Main content */}
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route 
                path="/journal" 
                element={
                  isAuthenticated ? (
                    <JournalForm isAuthenticated={isAuthenticated} />
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
          </main>
          
          {/* Footer */}
          <footer className="bg-white py-4 border-t border-[#e6e0d8]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <p className="text-center text-xs sm:text-sm text-[#8a8a8a]">
                © {new Date().getFullYear()} Create zain's journals without the pen in your hand.
              </p>
            </div>
          </footer>
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
          theme="light"
        />
      </Router>
    </AuthContext.Provider>
  );
}

export default App;
