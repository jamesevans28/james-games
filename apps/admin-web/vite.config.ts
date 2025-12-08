import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Simple Vite config for the admin console placeholder.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3100,
  },
});
