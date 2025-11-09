// Development entrypoint: start the Express app for local development
// This intentionally uses a simple `app.listen` so `npm run dev` behaves
// like the old `local-server.ts` did during development.
import { config } from "./config/index.js";
import { app } from "./index.js";

const port = Number(process.env.PORT || config.port || 8787);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Local API server listening on http://localhost:${port}`);
});

export {};
