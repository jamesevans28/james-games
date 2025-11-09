# Backend (Express on Lambda) — Starter

This shows how to run an Express app in AWS Lambda behind API Gateway and integrate with Cognito (JWT authorizer) and DynamoDB.

## Stack

- API Gateway (HTTP API v2) with JWT authorizer (Cognito User Pool)
- Lambda (Node.js 20) running Express via `@vendia/serverless-express`
- DynamoDB tables already created: games4james-users, games4james-scores, games4james-ratings, games4james-follows

## Project layout (example)

```
backend/
  package.json
  src/
    app.ts
    auth.ts
    routes/
      me.ts
      scores.ts
      ratings.ts
      follows.ts
```

## package.json

```json
{
  "name": "g4j-backend",
  "type": "module",
  "scripts": {
    "build": "tsc -p .",
    "start": "node dist/app.js"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3",
    "@aws-sdk/lib-dynamodb": "^3",
    "@vendia/serverless-express": "^4.10.2",
    "express": "^4.19.2",
    "jose": "^5.9.6"
  },
  "devDependencies": {
    "typescript": "^5.7.2"
  }
}
```

## src/auth.ts (JWT verification helper)

```ts
import { createRemoteJWKSet, jwtVerify } from "jose";

const jwksCache: Record<string, ReturnType<typeof createRemoteJWKSet>> = {};

export async function verifyJwt(token: string, issuer: string, audience?: string) {
  const jwksUri = `${issuer}/.well-known/jwks.json`;
  const jwks = jwksCache[jwksUri] || (jwksCache[jwksUri] = createRemoteJWKSet(new URL(jwksUri)));
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience,
  });
  return payload as any; // contains `sub`, `email`, etc.
}
```

## src/app.ts (Express app + Lambda adapter)

```ts
import express from "express";
import serverlessExpress from "@vendia/serverless-express";
import { verifyJwt } from "./auth.js";

const app = express();
app.use(express.json());

// Auth middleware (Cognito hosted UI / Amplify supplies ID token in Authorization header)
app.use(async (req, res, next) => {
  (req as any).auth = null;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    try {
      const token = auth.slice(7);
      const issuer = process.env.COGNITO_ISSUER!; // e.g. https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_uKWR6BwZW
      const payload = await verifyJwt(token, issuer);
      (req as any).auth = { userId: payload.sub };
    } catch {
      // ignore; route can enforce auth if required
    }
  }
  next();
});

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// Protected helper
function requireAuth(req: any, res: any, next: any) {
  if (!req.auth?.userId) return res.status(401).json({ error: "unauthorized" });
  next();
}

// Example routes (fill in DynamoDB logic as needed)
app.get("/me", requireAuth, async (req: any, res) => {
  res.json({ userId: req.auth.userId, screenName: null, shareCode: null, stats: {} });
});

// Merge guest data to account (idempotent)
app.post("/merge-guest", requireAuth, async (req: any, res) => {
  const { deviceId } = req.body || {};
  if (!deviceId) return res.status(400).json({ error: "deviceId required" });
  // TODO: move any guest local scores into the user’s rows in Scores
  res.json({ ok: true });
});

// Submit score (auth required for global boards)
app.post("/scores", requireAuth, async (req: any, res) => {
  const { gameId, score } = req.body || {};
  if (!gameId || typeof score !== "number") return res.status(400).json({ error: "invalid" });
  // TODO: Upsert topScore & lastScore in DynamoDB for (userId, gameId)
  res.json({ ok: true, topScore: score });
});

export const handler = serverlessExpress({ app });
```

## API Gateway

- Create HTTP API, integrate Lambda, set CORS for your web origin.
- (Optional) Also add a JWT authorizer referencing your Cognito issuer if you prefer API-level auth.

## Environment for Lambda

- COGNITO_ISSUER=https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_uKWR6BwZW
- TABLE_USERS=games4james-users
- TABLE_SCORES=games4james-scores
- TABLE_RATINGS=games4james-ratings
- TABLE_FOLLOWS=games4james-follows

This gives you a working skeleton to deploy and extend for /me, /scores, /ratings, and follows. Add DynamoDB operations where indicated.
