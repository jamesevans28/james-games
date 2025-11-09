// Centralized app configuration
// Minimal declarations for env without Node types wired in this workspace
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 8787),
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean),
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:8787",
  region: process.env.COGNITO_REGION || process.env.AWS_REGION || "ap-southeast-2",
  cognito: {
    userPoolId: process.env.COGNITO_USER_POOL_ID || "",
    clientId: process.env.COGNITO_CLIENT_ID || "",
    clientSecret: process.env.COGNITO_CLIENT_SECRET || "",
    domain: process.env.COGNITO_DOMAIN || "",
  },
  tables: {
    // SCORES_TABLE allows switching to the new table name (e.g. games4james-scores)
    scores: process.env.SCORES_TABLE || process.env.TABLE_NAME || "games4james-gamescores",
    users: process.env.TABLE_USERS || "games4james-users",
    usernames: process.env.TABLE_USERNAMES || "",
    scoreGsi: process.env.SCORE_GSI_NAME || "GameScoresByScore",
  },
};
