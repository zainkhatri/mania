import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

import JournalForm from './components/JournalForm';
import Gallery from './components/Gallery';
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
  // For demo purposes, we'll just mock an authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // Mock user profile (in a real app, would come from auth provider)
  const [user, setUser] = useState<User | null>({
    uid: '123456',
    email: 'user@example.com',
    displayName: 'Journal User'
  });
  
  // Effect to check if user is logged in
  useEffect(() => {
    // In a real app, you'd check authentication status here
    // For demo, we'll just use mock state
  }, []);
  
  // Handle login
  const login = (token: string) => {
    console.log("Login with token:", token);
    setIsAuthenticated(true);
    setShowAuthModal(false);
    // In a real app, you would validate the token and fetch user data
  };
  
  // Handle logout
  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };
  
  // Auth context value
  const authContextValue = {
    isAuthenticated,
    user,
    login,
    logout
  };
  
  return (
    <AuthContext.Provider value={authContextValue}>
      <Router>
        <div className="min-h-screen bg-[#f8f5f0] flex flex-col">
          {/* Navigation */}
          <nav className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex">
                  <Link to="/" className="flex-shrink-0 flex items-center">
                    <div className="font-serif text-3xl font-bold text-[#1a1a1a]">
                      mania
                      <span className="absolute h-1.5 w-1.5 rounded-full bg-[#1a1a1a] ml-0.5 mt-1"></span>
                    </div>
                  </Link>
                </div>
                <div className="flex items-center gap-4">
                  <StreakIndicator />
                  <Link to="/gallery" className="px-3 py-2 rounded-md text-sm font-medium text-[#333333] hover:text-[#1a1a1a] hover:bg-[#f2efe9]">
                    Gallery
                  </Link>
                  {isAuthenticated ? (
                    <div className="ml-4 relative flex-shrink-0">
                      <div className="flex items-center">
                        <button 
                          onClick={logout}
                          className="ml-3 py-1.5 px-3 border border-[#d1cdc0] rounded-md text-sm font-medium text-[#333333] hover:bg-[#f2efe9]"
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  ) : (
                    <Link 
                      to="/login"
                      className="ml-4 py-1.5 px-3 border border-[#d1cdc0] rounded-md text-sm font-medium text-[#333333] hover:bg-[#f2efe9]"
                    >
                      Sign in
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </nav>
          
          {/* Main content */}
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route 
                path="/journal" 
                element={
                  isAuthenticated ? (
                    <JournalForm isAuthenticated={isAuthenticated} saveButtonText="Save to Gallery" />
                  ) : (
                    <Navigate to="/login" replace />
                  )
                } 
              />
              <Route 
                path="/gallery" 
                element={
                  isAuthenticated ? (
                    <Gallery />
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
              <p className="text-center text-sm text-[#8a8a8a]">
                © {new Date().getFullYear()} Create zain's journals without the pen in your hand.
              </p>
            </div>
          </footer>
        </div>
        
        {/* Toast notifications container */}
        <ToastContainer position="bottom-right" />
      </Router>
    </AuthContext.Provider>
  );
}

export default App;
