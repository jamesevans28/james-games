# Project Overview

This project is a **mobile-friendly web game hub** built with **React (Vite)** and **Phaser 3**.  
Players can play lightweight, addictive games directly in their browsers, designed primarily for **mobile portrait mode**.  
The web app manages routing, analytics, ads, and player data while each game runs in its own modular Phaser environment.

---

# Core Technologies

**Frontend**

- React (with Vite) for fast builds, routing, and app structure.
- Phaser 3 for rendering and game logic.
- TailwindCSS for responsive, mobile-first styling.
- Redux Toolkit for state management (used where shared global state is needed).

**Backend**

- AWS backend (Lambda, API Gateway, DynamoDB, or S3) for APIs, data storage, and static asset hosting.
- AWS CloudFront for CDN and caching.
- AWS Cognito for authentication (if user accounts are added later).

**Other Integrations**

- Google Analytics for tracking gameplay metrics and engagement.
- Google AdSense for displaying in-game or interstitial ads.

---

# Development Goals

- Games must **load instantly**, run smoothly (60 FPS target), and handle **touch input** gracefully.
- Focus on **portrait mobile gameplay** and responsive scaling for tablets and desktops.
- Support **multiple mini-games**, each self-contained within its own folder.
- Shared UI components for menus, leaderboards, ads, and navigation.
- AWS backend integration for future user accounts, scoreboards, and stats.

---

# Folder Structure Guidelines

Each game should live in its own isolated folder under `/src/games`.  
The base app manages navigation, analytics, ads, and shared state.

/src
/games
/stack-tower
index.js # Exports Phaser config
StackTowerGame.js # Main Phaser.Scene
assets/
logic/
/jump-runner
index.js
JumpRunnerGame.js
/pages
index.jsx # Game hub page - lists all games
/games
[gameId].jsx # Loads individual games dynamically
/components
Navbar.jsx
GameCard.jsx
AdBanner.jsx
AnalyticsTracker.jsx
Leaderboard.jsx
/redux
store.js
gameSlice.js
userSlice.js
/lib
awsClient.js # For API calls, S3, or DynamoDB
/utils
analytics.js # Google Analytics helpers
ads.js # AdSense helper functions
/styles
globals.css
/assets
shared/ # Shared UI or audio assets

---

# Copilot Instructions

- Use **React functional components** and **hooks** (no class components).
- Prefer **Redux Toolkit slices** for global state; avoid overusing context.
- Always use **ES module syntax** (`import/export`).
- Use **async/await** instead of promise chains.
- In **Phaser scenes**, always extend `Phaser.Scene` and keep logic modular.
- Use TailwindCSS classes for layout and UI — avoid inline styles except for dynamic values.
- Phaser configuration should always include:
  - `type: Phaser.AUTO`
  - `scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }`
  - `backgroundColor: '#000000'`
- Optimize for **portrait orientation** (mobile-first design).
- Use `pointerdown` or `touchstart` for user input (not `click` or `mousedown`).
- Integrate Phaser with React using a `useEffect` hook:
  - Create and destroy the game instance on mount/unmount.
  - Mount the Phaser canvas to a container div (e.g., `#game-container`).
- Import Google Analytics using `react-ga4` and fire events on major game actions (start, game over, high score, etc.).
- Place AdSense ad components (e.g., `<AdBanner />`) within the UI layer, not inside Phaser.
- Use lazy loading (`React.lazy` + `Suspense`) for games to reduce initial load.

---

# Code Style

- Use **PascalCase** for React components and **camelCase** for functions/variables.
- Group related utilities into `/utils`.
- Comment core gameplay logic clearly.
- Write self-documenting, modular code — especially inside Phaser scenes.
- Keep asset paths relative to each game folder (avoid absolute URLs unless using AWS-hosted assets).
- Use environment variables for all AWS, Analytics, and AdSense keys.

---

# Game Design Guidelines

Each game should:

- Run smoothly on mobile (portrait, touch controls).
- Include clear states: **Menu**, **Play**, **Game Over**.
- Display current score and best score (localStorage for now, later backend).
- Provide restart and return-to-hub options.
- Run within 9:16 viewport.
- Include simple, reusable UI (e.g., `<GameHUD />`, `<ScoreDisplay />`).

Shared expectations:

- Target 60 FPS where possible.
- Keep initial load size under 2MB (lazy-load heavy assets).
- Include a short gameplay loop (< 60 seconds ideal).
- Reuse shared logic for scoring, ads, and analytics where applicable.

---

# Analytics and Ads

- Use Google Analytics 4 (via `react-ga4`) for pageviews and custom events.
- Example events:
  - `game_start`
  - `game_over`
  - `high_score`
  - `ad_view`
- Use AdSense `<ins class="adsbygoogle">` blocks in designated banner areas.
- Ensure ads comply with Google’s mobile-friendly requirements (no overlap on game canvas).

---

# AWS Integration Notes

- Use AWS SDK v3 modules (modular imports) to minimize bundle size.
- Store assets in **S3** and load via **CloudFront CDN**.
- Future expansions may include:
  - Leaderboards via **DynamoDB**.
  - Auth via **Cognito**.
  - Analytics via **AWS Pinpoint**.
  - Serverless game events via **AWS Lambda**.

---

# Notes for Copilot

- Prioritize **mobile performance** and **responsive design**.
- When writing new Phaser games, use existing ones in `/src/games` as reference.
- When writing new React components, prefer Tailwind for layout.
- When integrating backend logic, use AWS SDK helpers from `/lib/awsClient.js`.
- When in doubt, prioritize **simplicity, speed, and readability**.
