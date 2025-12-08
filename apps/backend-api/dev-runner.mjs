#!/usr/bin/env node
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register ts-node ESM loader using the recommended register() API
register("ts-node/esm", pathToFileURL("./"));

(async () => {
  try {
    // Import the TypeScript ESM entry point
    await import("./src/local-server.ts");
  } catch (err) {
    console.error("Failed to start local server", err);
    process.exit(1);
  }
})();
