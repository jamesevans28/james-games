# User Accounts System — Architecture & AWS Setup

This document describes how to introduce a real user account system while keeping the games playable without login. It covers architecture, data model, backend APIs, AWS setup (Cognito, API Gateway, Lambda, DynamoDB), and frontend integration plan.

## Goals

- Unique users tied to all high-score records
- Users can change their screen name — reflected everywhere (leaderboards, profile, ratings)
- Rate a game once per user; ratings stored in backend
- User Profile page: most played games, top score per game, global rank per game
- Friend groups (follow by share code) to view a private friends leaderboard
- Kids-first auth: username+password, optional email, Google sign-in; no email required
- Anonymous play stays; prompts encourage sign-up

---

## High-level Architecture

- Auth: Amazon Cognito User Pool (username sign-in + Google IdP). Optional Identity Pool only if you need AWS resource access from the browser.
- API: Amazon API Gateway (HTTP API) + AWS Lambda (Node.js) with Cognito Authorizer
- Data: DynamoDB tables with GSIs to power leaderboards and queries
- Static frontend remains on your current hosting; it calls API Gateway

User identity source of truth is Cognito. The user id is the stable `sub` claim from the ID token.

---

## Data Model (DynamoDB)

Use 4 tables with on-demand capacity.

1. Users (PK: userId)

- userId (string; Cognito sub)
- screenName (string; mutable)
- createdAt (ISO string)
- shareCode (string, unique short code)
- stats: { gamesPlayed: number, totalPlays: number }

GSI: screenName-lower (PK: screenNameLower) for admin tools if needed.

2. Scores (PK: userId, SK: gameId)

- userId
- gameId
- topScore (number)
- lastScore (number)
- updatedAt (ISO)

GSI: leaderboard (PK: gameId, SK: topScore DESC, with a projection of userId, screenName, topScore). Use inverted sign or sort key hack to support descending sort in queries.

3. Ratings (PK: gameId, SK: userId)

- gameId
- userId
- rating (1–5)
- updatedAt (ISO)

GSI: userRatings (PK: userId, SK: gameId) for profile page.

4. Follows (PK: userId, SK: followerId) — or vice versa depending on list direction

- userId (the person being followed)
- followerId (the person who follows)
- createdAt (ISO)

GSI: following (PK: followerId, SK: userId) to list who I follow; base table lists my followers.

Notes:

- Denormalize current `screenName` on leaderboard records for read performance, but always resolve to latest by joining with Users when necessary. On screenName change, update Users only; leaderboards can be eventually consistent or re-hydrate names on read.

Tables created:
created the following tables:

games4james-follows
games4james-ratings
games4james-scores
games4james-users

---

## API Endpoints (API Gateway + Lambda)

All endpoints except public GETs are protected by Cognito Authorizer.

Auth & user

- GET /me → returns { userId, screenName, shareCode, stats }
- PATCH /me → { screenName? } (validates uniqueness-ish via case-insensitive check; acceptable to allow duplicates if preferred)
- POST /me/share-code → rotates shareCode and returns it

Scores

- POST /scores → { gameId, score }
  - Upserts user’s topScore for the game if higher; always records lastScore
- GET /scores/:gameId?limit=100 → public global leaderboard (reads from GSI)
- GET /scores/:gameId/friends → friends-only leaderboard (requires auth; uses following GSI)

Ratings

- POST /ratings → { gameId, rating } (1–5). Idempotent per user/game (PK-SK enforce uniqueness)
- GET /ratings/:gameId/summary → { avg, count, histogram }

Follow

- POST /follow/by-code → { code } follows the user with that share code
- POST /follow/:userId → follow directly by id (optional)
- GET /follow → { followers: [...], following: [...] }

Profile

- GET /profile/:userId → { topScoresByGame: [...], mostPlayed: [...], ranks: [...] }

Anonymous support

- No login required for gameplay; only gated features (submit score, rate, follow) require login. Before calling protected endpoints, the frontend prompts to sign in or sign up.

---

## AWS Setup — Step by Step

### 1) Cognito User Pool

1. Open Amazon Cognito → Create user pool
2. Sign-in options: Username

- Alias attributes: none (don’t allow email/phone/preferred_username as sign-in)

3. Required attributes for sign-up: Email address (Cognito requires email or phone with username sign-in)
4. Password policy: min length 8; require at least numbers OR symbols (kid-friendly)
5. Self-service sign-up: Enabled
6. Verification & MFA: Disable auto email verification for now; MFA off
7. App client (no secret): Create a Web app client

- Allowed callback URLs: http://localhost:5173/ (dev), https://games4james.com/ (prod)
- Allowed sign-out URLs: http://localhost:5173/, https://games4james.com/
- Allowed OAuth flows: Authorization code grant (recommended, PKCE)
- Allowed OAuth scopes: openid, email, profile

8. Hosted UI: enable for the app client (you’ll get a domain like your-domain.auth.ap-southeast-2.amazoncognito.com)
9. Social IdP: Google (optional but recommended)

- In Google Cloud, create OAuth credentials; add Client ID/Secret in Cognito
- Use the same callback/sign-out URLs

10. Triggers (recommended): Pre sign-up

- Auto-confirm users and inject a placeholder email if missing (see snippet below)

Capture:

- User Pool ID, Web Client ID, Region
- Hosted UI domain (e.g., your-domain.auth.ap-southeast-2.amazoncognito.com)

Pre sign-up Lambda (Node.js 20)

Use this to allow kids to sign up without providing an email while still satisfying Cognito’s required email attribute.

```js
export const handler = async (event) => {
  // Auto-confirm so kids don’t need to verify email
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = false;

  const attrs = event.request.userAttributes || {};
  if (!attrs.email) {
    const uid = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2))
      .replace(/-/g, "")
      .slice(0, 16);
    event.request.userAttributes.email = `kid-${uid}@noemail.games4james`;
    event.request.userAttributes.email_verified = "false";
  }
  return event;
};
```

### 2) API Gateway + Lambda

1. Create an HTTP API (API Gateway v2)
2. Authorizers → Add Cognito user pool authorizer
3. Create Lambda functions (Node.js 20) for each endpoint group; attach IAM role with access to DynamoDB tables
4. Integrations: Connect each route to its Lambda, with the Cognito authorizer for protected routes
5. CORS: Allow your web origin

### 3) DynamoDB Tables

Create 4 tables exactly as defined above. Add GSIs:

- Scores: GSI `leaderboard` — PK: gameId, SK: negTopScore (store as -topScore for DESC)
- Ratings: GSI `userRatings` — PK: userId, SK: gameId
- Follows: GSI `following` — PK: followerId, SK: userId
- Users: optional GSI for screenNameLower

### 4) Lambda Implementation Notes

- Use the Cognito authorizer JWT: `event.requestContext.authorizer.jwt.claims.sub` as userId
- Validate input (gameId in known list, rating 1–5)
- Upsert patterns with DynamoDB `UpdateExpression` and `ConditionExpression` to only raise `topScore` when higher
- For friends leaderboard, resolve the list of followed userIds from the `following` GSI, then batch-get their Scores rows for the given gameId
- For global ranks, query `leaderboard` GSI and compute the rank index client-side; for a specific user rank, use a `Count` query of scores with higher `topScore` (approximate) or maintain a rank cache
- Screen name updates: update Users only; for leaderboards, prefer joining (batch-get) to show current name

### 5) IAM Policies (example)

Attach to Lambda role with least privilege, e.g.:

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:BatchGetItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:REGION:ACCOUNT:table/Users",
        "arn:aws:dynamodb:REGION:ACCOUNT:table/Scores",
        "arn:aws:dynamodb:REGION:ACCOUNT:table/Scores/index/leaderboard",
        "arn:aws:dynamodb:REGION:ACCOUNT:table/Ratings",
        "arn:aws:dynamodb:REGION:ACCOUNT:table/Ratings/index/userRatings",
        "arn:aws:dynamodb:REGION:ACCOUNT:table/Follows",
        "arn:aws:dynamodb:REGION:ACCOUNT:table/Follows/index/following"
      ]
    }
  ]
}
```

### 6) Environment Variables for Frontend

Add to your deployment environment (or `.env` for dev):

```
VITE_API_BASE_URL=https://your-api-id.execute-api.REGION.amazonaws.com
VITE_COGNITO_USER_POOL_ID=...
VITE_COGNITO_CLIENT_ID=...
VITE_COGNITO_REGION=...
VITE_COGNITO_HOSTED_UI_DOMAIN=your-domain.auth.REGION.amazoncognito.com
```

---

## Frontend Integration Plan

1. Auth client

- Use AWS Amplify Auth v6 or amazon-cognito-identity-js (Amplify recommended)
- Build an `AuthProvider` React context exposing: currentUser, signUp(username, password, email?), signIn, signOut, federatedSignIn("Google"), updateScreenName
- Persist session; read ID token for `sub`

2. Gradual prompts

- Keep gameplay fully accessible
- Gated actions prompt login: submitting high score to global boards, rating, following
- If not logged in, show dialog: "Save your scores and add friends — create a free account"

3. API calls

- Add Authorization header: `Bearer <idToken>` on protected calls
- Extend `src/lib/api.ts` with functions:
  - getMe, updateMe, getLeaderboard, postScore, getFriendsLeaderboard, postRating, getRatingSummary, followByCode, getProfile

4. Profile page

- New route `/profile` shows:
  - Your screen name (editable)
  - Top score per game and your current global rank
  - Most played games (from stats)
  - Share code + Copy Link button

5. Friends

- On home screen, add "Follow a friend" input (share code) and a "My share code" button
- Deep link `/follow/:code` to auto-follow after confirmation when authenticated

6. Privacy & Safety

- Profiles are private by default; no public directory or search
- Following requires a share code or direct link
- No emails required; if provided, treat as private
- Content moderation optional for screen names (basic bad-word filter)

---

## Minimal Contract Examples

POST /scores (auth):

- Input: { gameId: string, score: number }
- Output: { ok: true, topScore: number }
- Errors: 400 invalid gameId/score, 401 unauthenticated

POST /ratings (auth):

- Input: { gameId: string, rating: 1..5 }
- Output: { ok: true }
- Errors: 400 invalid rating, 401 unauthenticated

PATCH /me (auth):

- Input: { screenName?: string }
- Output: { ok: true, screenName }

---

## Rollout Strategy

1. Ship frontend with prompts and new Profile UI hidden behind feature flag
2. Deploy backend (API + Cognito + DynamoDB)
3. Enable login, ratings and friend follows first
4. Migrate high-score submissions to require auth (or allow anonymous local-only until signed in)
5. Monitor usage and costs; enable DynamoDB auto-scaling if needed

---

## Next Steps Checklist

- [ ] Create Cognito User Pool + Google IdP
- [ ] Create API Gateway + Lambdas with Cognito authorizer
- [ ] Provision DynamoDB tables and GSIs
- [ ] Add frontend AuthProvider and API client extensions
- [ ] Build Profile and Follow UI
- [ ] Gate leaderboard submit/rate/follow behind login prompts

If you want, I can scaffold the AuthProvider and API method stubs next without affecting the current build.
