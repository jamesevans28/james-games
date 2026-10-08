# Firebase Authentication Setup Guide

How Firebase Authentication is set up for Games4James. The live Firebase project id is `flingo-fun` (a leftover name; it stays, because changing a project id means a new project and a user migration). Steps 1–6 below are the original from-scratch setup; the section straight after this one is what to do now for the games4james.com domain.

## Overview

We're using Firebase Authentication with:

- **Anonymous authentication** for instant play (kids)
- **Username + PIN** for kid-friendly accounts (custom tokens)
- **Social sign-on** (Google, Apple) and email for account linking

The backend remains on AWS Lambda + DynamoDB. Firebase is used only for authentication.

---

## Games4James domain setup (plan T3.5): MANUAL (James)

Goal: the Google and Apple sign-in screens say **Games4James**, and the sign-in redirect goes through `auth.games4james.com` rather than `flingo-fun.firebaseapp.com`. Nothing here needs a secret in the repo.

| Setting                    | Value                                                                            |
| -------------------------- | -------------------------------------------------------------------------------- |
| Firebase project           | `flingo-fun`                                                                     |
| Site origin                | `https://games4james.com`                                                        |
| Custom auth domain         | `auth.games4james.com`                                                           |
| OAuth handler URL          | `https://auth.games4james.com/__/auth/handler`                                   |
| App name on consent screen | `Games4James`                                                                    |
| App logo                   | `apps/player-web/public/brand/icon-512.png` (upload the file)                    |
| Home page                  | `https://games4james.com`                                                        |
| Privacy policy             | `https://games4james.com/privacy` (placeholder page, live after the next deploy) |

### 1. Authorised domains (2 minutes)

Firebase console → project `flingo-fun` → **Authentication** → **Settings** → **Authorised domains**.

- Add `games4james.com`, and `auth.games4james.com` once step 2 is done.
- Keep `localhost` (local dev).
- Remove `flingo.fun` and `www.flingo.fun` if present.
- Leave `flingo-fun.firebaseapp.com` and `flingo-fun.web.app` until step 2 works end to end, then they can stay (harmless).

### 2. Custom auth domain via Firebase Hosting (15 minutes plus DNS time)

Firebase only serves its sign-in helper pages (`/__/auth/...`) from Hosting, so the custom auth domain is a Hosting custom domain. Hosting is free on the Spark plan, and nothing needs deploying: the `/__/` pages are built in.

1. Firebase console → **Hosting** → **Get started**. Click through the wizard; skip the CLI and deploy steps.
2. **Add custom domain** → `auth.games4james.com` → don't tick "redirect".
3. Firebase shows DNS records (a TXT record to verify, then A records or a CNAME). Add them wherever games4james.com's DNS lives (Route 53: Hosted zones → games4james.com → Create record). Wait until Firebase says **Connected**; SSL can take up to a day.
4. Check: `https://auth.games4james.com/__/auth/handler` loads (a blank or "missing parameters" page is fine; a certificate error is not).
5. Set `VITE_FIREBASE_AUTH_DOMAIN=auth.games4james.com`:
   - GitHub → repo → Settings → Secrets and variables → Actions → **Variables** → `VITE_FIREBASE_AUTH_DOMAIN`.
   - Your local `apps/player-web/.env.local`.

### 3. Google sign-in consent screen (10 minutes)

[Google Cloud console](https://console.cloud.google.com/) → pick project `flingo-fun` → **APIs & Services**.

1. **OAuth consent screen** (or _Google Auth Platform → Branding_): app name `Games4James`, user support email (yours), logo `icon-512.png`, home page `https://games4james.com`, privacy policy `https://games4james.com/privacy`, authorised domain `games4james.com`. Save.
2. **Credentials** → the OAuth 2.0 client named _Web client (auto created by Google Service)_:
   - Authorised JavaScript origins: add `https://games4james.com` and `https://auth.games4james.com`.
   - Authorised redirect URIs: add `https://auth.games4james.com/__/auth/handler`. Keep the existing `flingo-fun.firebaseapp.com` one.
   - Save.

### 4. Apple sign-in (only if Apple sign-in is turned on)

[Apple Developer](https://developer.apple.com/account/resources/identifiers/list/serviceId) → Identifiers → Services IDs → the Services ID used in Firebase's Apple provider → **Sign In with Apple → Configure**:

- Domains and subdomains: add `auth.games4james.com`.
- Return URLs: add `https://auth.games4james.com/__/auth/handler`.
- Save, then Continue → Save.

### 5. Check it (after the next deploy, T3.6)

1. Open `https://games4james.com/login` in a private window → **Continue with Google**.
2. The Google screen should say "to continue to **Games4James**" (or `auth.games4james.com`), not `flingo-fun.firebaseapp.com`.
3. Finish sign-in. You should land back on games4james.com, signed in.
4. Repeat with Apple if enabled.

If sign-in fails with `auth/unauthorized-domain`, step 1 is missing a domain. If it fails with `redirect_uri_mismatch`, step 3.2 is missing the handler URL.

---

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name it (the live project is `flingo-fun`)
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
3. Register the web app (any nickname)
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
```

---

## Architecture Notes

### Why Keep AWS Lambda + DynamoDB?

> Superseded: plan Phase 6 moves the data layer to Supabase Postgres. Firebase Auth stays. See docs/plan/06-sql-data-layer-supabase.md.

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
