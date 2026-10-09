/**
 * Bundles the API into one ESM file for Lambda (T9.3) and zips it:
 * apps/backend-api/bundle/lambda.mjs → apps/backend-api/bundle.zip (handler `lambda.handler`).
 * Replaces zipping node_modules (~19 MB) with a single minified file.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "bundle");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir);

const result = await build({
  entryPoints: [path.join(root, "src/lambda.ts")],
  outfile: path.join(outDir, "lambda.mjs"),
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  minify: true,
  sourcemap: true,
  sourcesContent: false,
  metafile: true,
  legalComments: "none",
  // The Lambda runtime ships the AWS SDK; pglite is only used by tests.
  external: ["@aws-sdk/*", "@electric-sql/pglite"],
  // Some CommonJS dependencies (firebase-admin) call require() and use __dirname.
  banner: {
    js: [
      'import { createRequire as __cr } from "node:module";',
      'import { fileURLToPath as __fu } from "node:url";',
      'import { dirname as __dn } from "node:path";',
      "const require = __cr(import.meta.url);",
      "const __filename = __fu(import.meta.url);",
      "const __dirname = __dn(__filename);",
    ].join(""),
  },
});

// Share cards (T11.5) read their fonts and the resvg WebAssembly next to lambda.mjs.
// Same list as SHARE_CARD_ASSETS in src/services/shareCardImage.ts.
const assets = {
  "share-display.woff": "@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff",
  "share-body.woff": "@fontsource/nunito/files/nunito-latin-800-normal.woff",
  "resvg.wasm": "@resvg/resvg-wasm/index_bg.wasm",
};
const requireFrom = createRequire(path.join(root, "package.json"));
for (const [name, specifier] of Object.entries(assets)) {
  copyFileSync(requireFrom.resolve(specifier), path.join(outDir, name));
}

const zip = path.join(root, "bundle.zip");
rmSync(zip, { force: true });
execFileSync("zip", [
  "-q",
  "-j",
  zip,
  path.join(outDir, "lambda.mjs"),
  path.join(outDir, "lambda.mjs.map"),
  ...Object.keys(assets).map((name) => path.join(outDir, name)),
]);
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log(
  `lambda.mjs ${mb(statSync(path.join(outDir, "lambda.mjs")).size)}, bundle.zip ${mb(statSync(zip).size)}, ` +
    `${Object.keys(result.metafile.inputs).length} inputs`,
);
