// Clean server entry (refactored)

import express from "express";

import cors from "cors";

import routes from "./routes/index.js";
import { attachUser } from "./middleware/authGuards.js";
import { errorHandler } from "./lib/http.js";
import { config } from "./config/index.js";

export const app = express();

const allowedOrigins = config.corsAllowedOrigins;
// Browsers send Origin on cross-site requests; reject unknown ones with a clean 403
// (the cors package would otherwise throw and surface as a 500). Requests without
// an Origin (curl, server-to-server, same-origin) pass through.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: "origin_not_allowed" });
  }
  next();
});

const corsOptions: cors.CorsOptions = {
  origin: allowedOrigins,
  // Auth is a bearer token, never a cookie, so credentials stay off.
  credentials: false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(attachUser);
app.use(routes);
app.use((_req, res) => res.status(404).json({ error: "not_found" }));
app.use(errorHandler);
