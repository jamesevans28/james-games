// One ESLint flat config for the whole monorepo (T4.1).
// Type-aware rules run on each app's src (via the TypeScript project service);
// tests, scripts and config files get the faster syntax-only rules.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";
import globals from "globals";

const TS_SRC = ["apps/*/src/**/*.{ts,tsx}"];
const TESTS = ["**/*.test.{ts,tsx,mjs}", "**/test/**"];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/dev-dist/**",
      "**/.npm-cache/**",
      "apps/game-server/**",
      "apps/player-web/public/**",
      "coverage/**",
      "**/*.d.ts",
    ],
  },

  js.configs.recommended,

  // Type-aware rules for application code.
  {
    files: TS_SRC,
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // Fire-and-forget promises in event handlers are common in React/Phaser code.
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
    },
  },

  // Plain TS outside src (configs, Vite plugins) and all tests: syntax-only rules.
  {
    files: ["**/*.{ts,tsx,mts}"],
    ignores: TS_SRC,
    extends: [tseslint.configs.recommended],
  },
  {
    files: TESTS,
    extends: [tseslint.configs.disableTypeChecked],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },

  // Browser apps.
  {
    files: ["apps/player-web/**/*.{ts,tsx}", "apps/admin-web/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // React Compiler-era rules flag patterns (setState in effects, impure render,
      // ref reads during render) that are refactors, not bugs, in this codebase.
      // Warn for now; Phase 7's UX rework fixes them as screens are rebuilt.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // Node: backend, scripts, infra, root configs.
  {
    files: [
      "apps/backend-api/**/*.{ts,js,mjs}",
      "scripts/**/*.{js,mjs,mts}",
      "infra/**/*.{js,mjs}",
      "*.{js,mjs,ts}",
      "apps/*/vite.config.ts",
      "apps/*/vite/**/*.ts",
      "apps/*/*.config.{js,ts}",
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["scripts/**/*.{js,mjs,mts}"],
    rules: { "no-console": "off" },
  },
  // CloudFront Functions are plain scripts whose handler() is called by AWS.
  {
    files: ["infra/cloudfront/*.js"],
    languageOptions: { sourceType: "script" },
    rules: { "no-unused-vars": ["error", { varsIgnorePattern: "^handler$" }] },
  },

  // Games talk to the platform only through the host (Phase 4 SDK).
  {
    files: ["apps/player-web/src/games/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/utils/gameEvents", "**/utils/gameEvents.ts"],
              message: "Games report results through host.gameOver(), not the window event bus.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "Use host storage (host.best) instead." },
        { name: "sessionStorage", message: "Use host storage instead." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "localStorage", message: "Use host storage instead." },
        { object: "window", property: "location", message: "Games must not navigate." },
      ],
    },
  },

  prettier,
);
