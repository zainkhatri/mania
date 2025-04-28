import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as AppleStrategy } from 'passport-apple';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import User from '../models/User';
import config from './config';

// Configure JWT Strategy
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: config.jwt.secret,
};

passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const user = await User.findById(payload.id);
      if (user) {
        return done(null, user);
      }
      return done(null, false);
    } catch (error) {
      return done(error, false);
    }
  })
);

// Configure Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: config.oauth.google.clientId as string,
      clientSecret: config.oauth.google.clientSecret as string,
      callbackURL: config.oauth.google.callbackUrl,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          // If user doesn't exist, create a new one
          user = new User({
            googleId: profile.id,
            email: profile.emails?.[0]?.value || `${profile.id}@google.com`,
            name: profile.displayName || 'Google User',
            authType: 'google',
            avatar: profile.photos?.[0]?.value,
          });
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error, false);
      }
    }
  )
);

// Configure Apple OAuth Strategy
passport.use(
  new AppleStrategy(
    {
      clientID: config.oauth.apple.clientId as string,
      teamID: config.oauth.apple.teamId as string,
      keyID: config.oauth.apple.keyId as string,
      privateKeyLocation: config.oauth.apple.privateKeyPath as string,
      callbackURL: config.oauth.apple.callbackUrl,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, idToken, profile, done) => {
      try {
        // Apple doesn't provide profile info on subsequent logins
        // So we need to extract from the first login and then rely on the ID
        const appleId = profile.id || req.body.user?.id;
        
        if (!appleId) {
          return done(new Error('No Apple ID provided'), false);
        }

        // Check if user already exists
        let user = await User.findOne({ appleId });

        if (!user) {
          // Extract user info from first login
          const name = req.body.user?.name?.firstName 
            ? `${req.body.user.name.firstName} ${req.body.user.name.lastName || ''}`.trim()
            : 'Apple User';
            
          const email = profile.email || req.body.user?.email || `${appleId}@apple.com`;

          // Create new user
          user = new User({
            appleId,
            email,
            name,
            authType: 'apple',
          });
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error, false);
      }
    }
  )
);

export default passport; 