import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import passport from 'passport';
import path from 'path';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/authRoutes';
import bookRoutes from './routes/bookRoutes';
import journalRoutes from './routes/journalRoutes';

// Import passport configuration
import './config/passport';

// Import config
import config from './config/config';

// Initialize express app
const app = express();
const PORT = config.server.port;

// Middleware
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Connect to MongoDB
mongoose
  .connect(config.database.uri)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/journals', journalRoutes);

// Serve static assets in production
if (config.server.env === 'production') {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../../build')));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../../build', 'index.html'));
  });
}

// Default route
app.get('/', (req, res) => {
  res.send('Mania API is running');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${config.server.env} mode`);
}); 