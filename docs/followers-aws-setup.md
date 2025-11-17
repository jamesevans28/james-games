# Followers & Presence AWS Setup

This document explains how to provision the AWS resources needed for the followers, presence, and profile features. It assumes you are extending the existing Express/Lambda stack under `/app`.

## Architecture Overview

- **Express API** (deployed via Lambda/Fargate) exposes `/followers`, `/users/:id`, and enhanced `/scores` endpoints.
- **DynamoDB** stores follower edges, real-time presence, and per-user-per-game stats used by profiles/leaderboards.
- **Cognito** already issues user identities; we only read `sub` (userId) and screen name/avatar snapshots.
- **CloudWatch Events** (optional) can periodically clean up stale presence entries, though Dynamo TTL already handles expiry.

## DynamoDB Tables

### 1. `games4james-follows`
| Field | Type | Notes |
| --- | --- | --- |
| `userId` | PK (string) | The follower (who is following someone).
| `targetUserId` | SK (string) | The followed account.
| `targetScreenName` | string | Snapshot for list rendering.
| `targetAvatar` | number | Snapshot of avatar.
| `createdAt` | string (ISO) | Timestamp of follow action.

- **GSI1** `FollowedBy`: `PK=targetUserId`, `SK=userId` to quickly list followers of a user.
- Provisioned or on-demand is fine; expect small, evenly distributed traffic.

```bash
aws dynamodb create-table \
  --table-name games4james-follows \
  --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=targetUserId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH AttributeName=targetUserId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes '[{"IndexName":"FollowedBy","KeySchema":[{"AttributeName":"targetUserId","KeyType":"HASH"},{"AttributeName":"userId","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]'
```

### 2. `games4james-presence`
| Field | Type | Notes |
| --- | --- | --- |
| `userId` | PK (string) |
| `status` | string | Enum: `home`, `game_lobby`, `playing`, `high_scores`, etc.
| `gameId` | string (optional) | Current game context.
| `context` | string | Human-readable string (e.g., `"Ready Steady Shoot"`).
| `updatedAt` | string | ISO timestamp.
| `expiresAt` | number | **TTL attribute** (epoch seconds). Records auto-expire after ~2 minutes of inactivity.

```bash
aws dynamodb create-table \
  --table-name games4james-presence \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

Once the table is active, enable TTL (required because the CLI no longer allows TTL during `create-table`):

```bash
aws dynamodb update-time-to-live \
  --table-name games4james-presence \
  --time-to-live-specification "Enabled=true, AttributeName=expiresAt"
```

### 3. `games4james-userGameStats`
Stores each user’s best score and last-played timestamp per game for the profile page.

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | PK |
| `gameId` | SK |
| `bestScore` | number |
| `lastScore` | number |
| `lastPlayedAt` | string |
| `recentKey` | string | `${lastPlayedAt}#${gameId}` for sorting in GSI.

- **GSI1** `GameStatsByGame`: `PK=gameId`, `SK=userId` for future “show everyone playing this game” views.
- **GSI2** `UserRecentGames`: `PK=userId`, `SK=recentKey` so we can fetch the latest games for a profile without scanning the table.

```bash
aws dynamodb create-table \
  --table-name games4james-userGameStats \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=gameId,AttributeType=S \
    AttributeName=recentKey,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH AttributeName=gameId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes '[
    {"IndexName":"GameStatsByGame","KeySchema":[{"AttributeName":"gameId","KeyType":"HASH"},{"AttributeName":"userId","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}},
    {"IndexName":"UserRecentGames","KeySchema":[{"AttributeName":"userId","KeyType":"HASH"},{"AttributeName":"recentKey","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}
  ]'
```

## IAM Policy Snippet
Attach to the Lambda role that runs the Express API.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
        "dynamodb:UpdateItem",
        "dynamodb:GetItem",
        "dynamodb:BatchGetItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:${Region}:${Account}:table/games4james-follows",
        "arn:aws:dynamodb:${Region}:${Account}:table/games4james-follows/index/FollowedBy",
        "arn:aws:dynamodb:${Region}:${Account}:table/games4james-presence",
        "arn:aws:dynamodb:${Region}:${Account}:table/games4james-userGameStats",
        "arn:aws:dynamodb:${Region}:${Account}:table/games4james-userGameStats/index/GameStatsByGame",
        "arn:aws:dynamodb:${Region}:${Account}:table/games4james-userGameStats/index/UserRecentGames"
      ]
    }
  ]
}
```

## Environment Variables / Config
Update `/app/src/config/index.ts` (done in code) with:

```
TABLE_FOLLOWS=games4james-follows
TABLE_PRESENCE=games4james-presence
TABLE_USER_GAME_STATS=games4james-userGameStats
```

Populate these in all environments (development `.env`, Lambda env vars, etc.).

## Deployment Steps
1. **Create tables** using CLI or AWS Console (see commands above).
2. **Update IAM** role with the policy snippet.
3. **Set env vars** for the API service (`TABLE_FOLLOWS`, `TABLE_PRESENCE`, `TABLE_USER_GAME_STATS`).
4. **Deploy backend** (e.g., `npm run deploy:lambda`), ensuring the new routes/controllers are included.
5. **Invalidate CloudFront**/redeploy frontend so UI can call the new endpoints.

## Operational Considerations
- Presence updates every 30 seconds; Dynamo TTL cleans stale records automatically. If you prefer faster cleanup, schedule a Lambda to delete expired rows.
- Follower lists use eventual consistency. If you need strictly consistent UI after a follow/unfollow, re-fetch using `ConsistentRead` on `games4james-follows` (code already does this).
- User-game stats update whenever a new score posts. If you import historical scores, run the provided migration script to seed stats (to be added).
- Monitor table usage with CloudWatch metrics; convert to provisioned capacity with autoscaling if needed.

## Outstanding Questions / Considerations
- **Regions:** Are all environments staying in `ap-southeast-2`, or do you need multi-region tables?
- **Retention:** Should we purge follower relationships for dormant accounts after X days?
- **Status granularity:** Do we need additional statuses (e.g., `matchmaking`)? Let me know so we can adapt the enum.
