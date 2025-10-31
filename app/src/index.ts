// Use type-less imports to avoid workspace type resolution issues
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import express from "express";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import cors from "cors";
import { putScore, getTopScores } from "./dynamo.js";

export const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req: any, res: any) => res.json({ ok: true }));

app.post("/scores", async (req: any, res: any) => {
  try {
    const { name, gameId, score } = req.body || {};
    if (!name || !gameId || typeof score !== "number") {
      return res.status(400).json({ error: "name, gameId, score are required" });
    }
    if (String(name).length > 32) return res.status(400).json({ error: "name too long" });
    const item = await putScore({ name: String(name), gameId: String(gameId), score });
    res.json(item);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/scores/:gameId", async (req: any, res: any) => {
  try {
    const gameId = req.params.gameId;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const rows = await getTopScores(gameId, limit);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});
