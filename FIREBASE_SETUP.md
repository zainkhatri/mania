# Firebase Authentication Setup Guide

This guide will walk you through setting up Firebase Authentication for your Mania journal app.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter a project name (e.g., "mania-journal")
4. Choose whether to enable Google Analytics (recommended)
5. Complete the setup process

## Step 2: Register Your Web App

1. On the Firebase project dashboard, click the web icon (</>) to add a web app
2. Give your app a name (e.g., "mania-web")
3. Register the app
4. Copy the Firebase configuration object shown

## Step 3: Update Your Code

1. Open `src/firebase.ts` in your project
2. Replace the placeholder configuration with your actual Firebase configuration

```typescript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Step 4: Enable Google Authentication

1. In Firebase Console, go to "Authentication" in the left sidebar
2. Click "Get started" if you haven't enabled Authentication yet
3. Click on the "Sign-in method" tab
4. Enable Google as a sign-in provider
5. Click on Google, then toggle the "Enable" switch
6. Add a support email (your email)
7. Click "Save"

## Step 5: Run Your Application

1. Start your React application with:
```
npm start
```

2. Test Google sign-in by clicking the "Continue with Google" button
3. You should see a Google sign-in popup
4. After successful authentication, you'll be redirected to the home page

## Troubleshooting

If you encounter issues:

1. **Google Sign-In Errors**: Make sure you've enabled Google as a sign-in provider in Firebase Authentication settings
2. **Domain Errors**: You may need to add your domain (like localhost) to the authorized domains list in Firebase Authentication settings
3. **Console Errors**: Check browser console for specific error messages
4. **Firebase Documentation**: Refer to [Firebase Auth Documentation](https://firebase.google.com/docs/auth) for more help 