import express from 'express';
import passport from 'passport';
import { googleAuthCallback, appleAuthCallback, getCurrentUser } from '../controllers/authController';
import { authenticate } from '../middleware/authMiddleware';

const router = express.Router();

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth/failure',
    session: false,
  }),
  googleAuthCallback
);

// Apple OAuth routes
router.get(
  '/apple',
  passport.authenticate('apple', {
    scope: ['name', 'email'],
    session: false,
  })
);

router.get(
  '/apple/callback',
  passport.authenticate('apple', {
    failureRedirect: '/auth/failure',
    session: false,
  }),
  appleAuthCallback
);

// Auth failure route
router.get('/failure', (req, res) => {
  res.status(401).json({ message: 'Authentication failed' });
});

// User profile route (protected)
router.get('/me', authenticate, getCurrentUser);

export default router; 