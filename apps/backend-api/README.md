# Games4James Backend (Express on AWS Lambda)

This folder contains a minimal Express app deployed to AWS Lambda behind an API Gateway. It exposes:

- POST /scores — submit a high score
- GET /scores/{gameId}?limit=10 — fetch top scores for a game

Data is stored in DynamoDB.

## API

- POST /scores
  - Body: `{ "name": string, "gameId": string, "score": number }`
  - Response: saved item with createdAt
- GET /scores/{gameId}
  - Query: `limit` (default 10, max 50)
  - Response: array of `{ name, score, createdAt }` ordered by highest score first

## Local development

Install dependencies and build:

```bash
cd app
npm install
npm run build
npm start
```

Local server listens on http://localhost:8787

## Manual AWS setup (no IaC)

1. DynamoDB Table

- Name: `games4james-scores`
- Partition key (PK): `gameId` (String)
- Sort key (SK): `score` (Number)
- Capacity: On-demand (pay per request) is fine for low traffic
- This schema lets you Query by gameId and sort by score; set `ScanIndexForward=false` to get top scores

2. IAM Role for Lambda

- Create a role for Lambda service `lambda.amazonaws.com`
- Attach the following inline policy for table access (replace with your table ARN):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:GetItem",
        "dynamodb:DescribeTable"
      ],
      "Resource": "arn:aws:dynamodb:REGION:ACCOUNT_ID:table/games4james-scores"
    }
  ]
}
```

3. Lambda Function

- Runtime: Node.js 20.x
- Architecture: x86_64
- Handler: `dist/handler.handler` (after build)
- Upload code:
  - Build locally: `npm run build` to produce `dist/`
  - Zip contents of `dist/` and `node_modules/` and upload; or use a simple CI later
- Environment variables:
  - `TABLE_NAME=games4james-scores`
  - `AWS_REGION=ap-southeast-2` (or your region)

4. API Gateway (HTTP API)

- Create an HTTP API
- Integrations:
  - POST /scores -> Lambda integration (the Lambda above)
  - GET /scores/{gameId} -> Lambda integration
- CORS:
  - Enable CORS; Allow Origins: your site origin (e.g., `https://games4james.com`)
  - Allow Methods: GET, POST
  - Allow Headers: Content-Type

5. Test

- POST a score using curl or Postman to the Invoke URL
- GET top scores: `GET https://<api-id>.execute-api.<region>.amazonaws.com/scores/reflex-ring?limit=10`

6. Frontend config

- In the web app, set an environment variable:
  - Vite: create `.env.local` in the project root with:

```
VITE_API_BASE_URL=https://<api-id>.execute-api.<region>.amazonaws.com
```

- The app will use this to POST scores and fetch leaderboards.

## Project structure

- `src/index.ts` — Express app with routes
- `src/handler.ts` — Lambda handler via `serverless-http`
- `src/dynamo.ts` — DynamoDB helpers (AWS SDK v3)
- `src/local-server.ts` — local dev server (optional)
- `package.json` — build scripts and dependencies

## Notes

- This is a minimal "Phase 1" backend. Later we can add authentication, input validation, rate-limiting, and per-game leaderboards with time windows.
- Table schema can evolve to include a UUID PK and GSIs for different queries; current PK/SK keeps it simple and efficient for top-N by game.
