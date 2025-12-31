# Firebase Authentication Setup Guide

This document provides step-by-step instructions for setting up Firebase Authentication for the James Games application.

## Overview

We're using Firebase Authentication with:

- **Anonymous authentication** for instant play (kids)
- **Username + PIN** for kid-friendly accounts (custom tokens)
- **Social sign-on** (Google, Apple) and email for account linking

The backend remains on AWS Lambda + DynamoDB. Firebase is used only for authentication.

---

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name it `james-games` (or your preferred name)
4. Disable Google Analytics (optional, simplifies setup)
5. Click "Create project"

---

## Step 2: Enable Authentication Methods

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable the following providers:

### Anonymous

- Click "Anonymous" → Enable → Save

### Email/Password (for future email linking)

- Click "Email/Password" → Enable → Save
- Optionally enable "Email link (passwordless sign-in)"

### Google (Optional, for social sign-on)

- Click "Google" → Enable
- Select your support email
- Save

### Apple (Optional, required for iOS App Store)

- Click "Apple" → Enable
- Configure Services ID and other settings per Apple's requirements
- Save

---

## Step 3: Register Web App

1. In Firebase Console, click the gear icon → "Project settings"
2. Scroll down to "Your apps" → Click the web icon `</>`
3. Register app with nickname: `james-games-web`
4. Copy the Firebase config object - you'll need this for the frontend

Example config:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "james-games.firebaseapp.com",
  projectId: "james-games",
  storageBucket: "james-games.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
};
```

---

## Step 4: Generate Service Account Key (for Backend)

1. In Firebase Console, click gear icon → "Project settings"
2. Go to "Service accounts" tab
3. Click "Generate new private key"
4. Download the JSON file
5. **Keep this file secure - never commit to git!**

The JSON file will look like:

```json
{
  "type": "service_account",
  "project_id": "james-games",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-...@james-games.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

---

## Step 5: Configure Environment Variables

### Backend (.env.local)

Add these to your backend environment:

```bash
# Firebase Admin SDK
FIREBASE_PROJECT_ID=james-games
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@james-games.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Or use the service account JSON file path (for local dev)
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

For AWS Lambda deployment, set these as environment variables in your Lambda configuration or use AWS Secrets Manager.

### Frontend (.env.local)

```bash
# Firebase Web Config
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=james-games.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=james-games
VITE_FIREBASE_STORAGE_BUCKET=james-games.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

## Step 6: Install Dependencies

### Backend

```bash
cd apps/backend-api
npm install firebase-admin bcryptjs
npm install -D @types/bcryptjs
```

### Frontend

```bash
cd apps/player-web
npm install firebase
npm uninstall aws-amplify  # Remove Cognito dependency
```

---

## Architecture Notes

### Why Keep AWS Lambda + DynamoDB?

1. **Existing infrastructure** - No migration needed for game data, scores, etc.
2. **Cost** - DynamoDB + Lambda is very cost-effective
3. **Flexibility** - Firebase Auth works with any backend
4. **Data locality** - Keep all data in one place (AWS)

Firebase is used ONLY for authentication tokens. All user data stays in DynamoDB.

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
├─────────────────────────────────────────────────────────────────┤
│  Firebase SDK                                                    │
│  ├── signInAnonymously() → Anonymous UID                        │
│  ├── signInWithCustomToken() → Username+PIN login               │
│  ├── signInWithPopup() → Google/Apple social login              │
│  └── linkWithCredential() → Upgrade anonymous account           │
├─────────────────────────────────────────────────────────────────┤
│  Every API call includes:                                        │
│  Authorization: Bearer <firebase-id-token>                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (AWS Lambda)                          │
├─────────────────────────────────────────────────────────────────┤
│  Firebase Admin SDK                                              │
│  ├── verifyIdToken() → Validates all requests                   │
│  ├── createCustomToken() → For username+PIN login               │
│  └── getUser() → Get Firebase user details                      │
├─────────────────────────────────────────────────────────────────┤
│  DynamoDB                                                        │
│  └── Users table stores: username, pinHash, screenName, etc.    │
└─────────────────────────────────────────────────────────────────┘
```

### Account Types

| Type         | Auth Method        | Email Required | Recovery          |
| ------------ | ------------------ | -------------- | ----------------- |
| Anonymous    | Firebase Anonymous | No             | None (link later) |
| Username+PIN | Custom Token       | No             | Link email/social |
| Linked       | Google/Apple/Email | Yes            | Built-in          |

### Security Considerations

1. **PIN Security**

   - Server-side hashing with bcrypt (cost factor 10+)
   - Rate limiting: 5 attempts per 15 minutes
   - Account lockout after 10 failed attempts

2. **Token Security**

   - Firebase ID tokens expire after 1 hour
   - Frontend refreshes automatically
   - Backend validates every request

3. **COPPA Compliance**
   - No email required for kids
   - No real names required
   - No public profiles by default
   - Parent email optional for recovery

---

## Removing Cognito

After Firebase is set up and working:

1. Remove from backend package.json:

   - `@aws-sdk/client-cognito-identity-provider`

2. Remove from frontend package.json:

   - `aws-amplify`

3. Delete old Cognito config from AWS Console (when ready)

---

## Testing Checklist

- [ ] Anonymous sign-in works
- [ ] Username+PIN registration works
- [ ] Username+PIN login works
- [ ] PIN rate limiting works
- [ ] Token refresh works
- [ ] Google sign-in works (if enabled)
- [ ] Account linking works (anonymous → username+PIN)
- [ ] Account linking works (anonymous → Google)
- [ ] Existing game data preserved after login
