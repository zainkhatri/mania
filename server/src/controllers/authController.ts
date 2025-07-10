import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import config from '../config/config';

// Helper function to generate JWT token
const generateToken = (userId: string): string => {
  return jwt.sign({ id: userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

// Google OAuth callback handler
export const googleAuthCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    // The user profile will be attached to req.user by Passport
    if (!req.user) {
      res.status(401).json({ message: 'Authentication failed' });
      return;
    }

    const token = generateToken((req.user as any)._id);
    
    // Redirect to frontend with token
    res.redirect(`${config.cors.origin}/auth/callback?token=${token}`);
  } catch (error) {
    console.error('Google auth callback error:', error);
    res.status(500).json({ message: 'Server error during authentication' });
  }
};

// Apple OAuth callback handler
export const appleAuthCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    // The user profile will be attached to req.user by Passport
    if (!req.user) {
      res.status(401).json({ message: 'Authentication failed' });
      return;
    }

    const token = generateToken((req.user as any)._id);
    
    // Redirect to frontend with token
    res.redirect(`${config.cors.origin}/auth/callback?token=${token}`);
  } catch (error) {
    console.error('Apple auth callback error:', error);
    res.status(500).json({ message: 'Server error during authentication' });
  }
};

// Get current user profile
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    // req.user is set by the auth middleware
    const user = await User.findById((req.user as any).id).select('-password');
    
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}; 