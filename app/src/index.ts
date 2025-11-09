// Clean server entry (refactored)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import express from "express";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import cors from "cors";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import { updateSettings } from "./controllers/usersController.js";
import { attachUser, requireAuth } from "./middleware/authGuards.js";
import { config } from "./config/index.js";

export const app = express();

const allowedOrigins = config.corsAllowedOrigins;
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);
app.use(routes);
