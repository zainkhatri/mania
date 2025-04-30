# Cloud Storage for Mania Journal App

## Overview

The Mania Journal app now supports cloud storage using Firebase Firestore. This allows users to access their journals from any device when signed in with the same Google account.

## How It Works

1. **Authentication**: Users sign in with their Google account.
2. **Journal Storage**: When a user saves a journal, it's stored in Firebase Firestore under a collection called "journals".
3. **User Association**: Each journal is associated with the user's unique ID (uid).
4. **Data Retrieval**: When a user views their gallery, journals are retrieved from Firestore based on their uid.

## Implementation Details

The cloud storage implementation includes:

### 1. Firebase Setup
- Firebase Authentication for user login
- Firestore Database for data storage

### 2. Data Models
- `Journal` interface that defines the structure of journal data
- Includes fields for content, styling, images, and metadata

### 3. Service Layer
- `journalService.ts` provides functions for:
  - Saving journals to Firestore
  - Retrieving journals from Firestore
  - Deleting journals from Firestore
  - Checking for existing journals by date

### 4. UI Components
- Updated Gallery component to fetch and display journals from Firestore
- Updated JournalForm component to save journals to Firestore

## Security

- Data is securely stored in Firestore
- Each user can only access their own journals
- Deletion operations verify ownership before proceeding

## Benefits

- **Cross-device access**: Access journals from any device
- **Data persistence**: Journals aren't lost when clearing browser data
- **Backup**: Data is backed up in the cloud
- **Synchronization**: Changes are reflected across all devices

## Technical Notes

- Images are stored as base64-encoded strings in Firestore
- Date checks use the YYYY-MM-DD portion of ISO strings for consistency
- Collections use appropriate indexes for efficient queries 