import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, getStoredUser, signInWithApple, signOut, isAppleAuthAvailable, deleteAccount } from '../services/authService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAppleAuthSupported: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  deleteUserAccount: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAppleAuthSupported, setIsAppleAuthSupported] = useState(false);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      // Check if Apple Auth is available
      const isAvailable = await isAppleAuthAvailable();
      setIsAppleAuthSupported(isAvailable);

      // Try to load stored user
      const storedUser = await getStoredUser();
      if (storedUser) {
        setUser(storedUser);
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async () => {
    try {
      console.log('📝 AuthContext: Starting sign in...');
      const newUser = await signInWithApple();
      console.log('📝 AuthContext: Sign in successful, user:', newUser.id);
      setUser(newUser);
    } catch (error) {
      console.error('📝 AuthContext: Sign in error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const deleteUserAccount = async () => {
    try {
      if (!user?.uid) {
        throw new Error('No user to delete');
      }
      await deleteAccount(user.uid);
      setUser(null);
    } catch (error) {
      console.error('Delete account error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAppleAuthSupported,
        signIn,
        logout,
        deleteUserAccount,
        isAuthenticated: user !== null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

