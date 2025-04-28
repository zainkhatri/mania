# Mania Backend

Backend server for the Mania journal application, providing APIs for authentication, books, and journal management.

## Features

- **Authentication**: OAuth with Google and Apple
- **User Management**: User profiles and authentication
- **Book Management**: Create, read, update, and delete journal books
- **Journal Management**: Create, read, update, and delete journal entries

## Technologies Used

- Node.js with Express
- TypeScript
- MongoDB with Mongoose
- JWT for authentication
- Passport.js for OAuth
- Google and Apple OAuth integration

## Prerequisites

- Node.js (v18 or later)
- MongoDB instance
- Google OAuth credentials
- Apple OAuth credentials

## Setup and Installation

1. Clone the repository
2. Install dependencies:
   ```
   cd server
   npm install
   ```
3. Create a `.env` file in the root directory based on the `config.example.ts` file:
   ```
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/mania
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRES_IN=7d
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
   APPLE_CLIENT_ID=your_apple_client_id
   APPLE_TEAM_ID=your_apple_team_id
   APPLE_KEY_ID=your_apple_key_id
   APPLE_PRIVATE_KEY_PATH=path_to_private_key
   APPLE_CALLBACK_URL=http://localhost:5000/api/auth/apple/callback
   FRONTEND_URL=http://localhost:3000
   ```
4. Start the development server:
   ```
   npm run dev
   ```

## API Endpoints

### Authentication

- `GET /api/auth/google` - Authenticate with Google
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/apple` - Authenticate with Apple
- `GET /api/auth/apple/callback` - Apple OAuth callback
- `GET /api/auth/me` - Get current user profile

### Books

- `GET /api/books` - Get all books for the current user
- `GET /api/books/:bookId` - Get a specific book
- `POST /api/books` - Create a new book
- `PUT /api/books/:bookId` - Update a book
- `DELETE /api/books/:bookId` - Delete a book

### Journals

- `GET /api/journals/book/:bookId` - Get all journals for a specific book
- `GET /api/journals/:journalId` - Get a specific journal
- `POST /api/journals` - Create a new journal
- `PUT /api/journals/:journalId` - Update a journal
- `DELETE /api/journals/:journalId` - Delete a journal

## Building for Production

To build the server for production, run:

```
npm run build
```

This will create a `dist` directory with the compiled JavaScript files.

To start the production server:

```
npm start
``` 