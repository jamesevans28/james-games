import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import { queryClient, invalidateAfterRun } from "./lib/queryClient";
import { onScoreSaved } from "./lib/api";
import { initAdapters } from "./platform/adapters";
import { startWebAnalytics } from "./lib/webAnalytics";
// Self-hosted brand fonts, latin only: no request to Google (privacy, and faster first paint).
import "@fontsource/baloo-2/latin-500.css";
import "@fontsource/baloo-2/latin-700.css";
import "@fontsource/baloo-2/latin-800.css";
import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-800.css";
import "@fontsource/patrick-hand/latin-400.css";
import "./index.css";

// A saved run changes boards, ratings, XP and the profile: refetch whatever is on screen.
onScoreSaved((result) => invalidateAfterRun(result.gameId));

// Inside the iOS/Android app, load native storage etc. before anything reads it (T10.1).
void initAdapters().then(() => {
  startWebAnalytics();
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>,
  );
});
