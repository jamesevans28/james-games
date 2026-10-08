// Development entrypoint: start the Express app for local development
// This intentionally uses a simple `app.listen` so `npm run dev` behaves
// like the old `local-server.ts` did during development.
import { config } from "./config/index.js";
import { app } from "./index.js";
import { log } from "./lib/log.js";

const port = Number(process.env.PORT || config.port || 8787);
app.listen(port, () => {
  log.info("server_listening", { port, url: `http://localhost:${port}` });
});

export {};
