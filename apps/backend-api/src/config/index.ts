// Centralized app configuration
// Minimal declarations for env without Node types wired in this workspace

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 8787),
  corsAllowedOrigins: (
    process.env.CORS_ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:3100"
  )
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean),
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:8787",
  // Firebase configuration
  firebase: {
    projectId: (process.env.FIREBASE_PROJECT_ID || "").trim(),
    clientEmail: (process.env.FIREBASE_CLIENT_EMAIL || "").trim(),
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").trim(),
  },
};
