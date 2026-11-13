#!/usr/bin/env node
/**
 * Build the network worker into the Pages output directory as `_worker.js`
 * (Cloudflare Pages advanced mode). Runs AFTER `vite build` so the client
 * service-worker precache manifest (generated during the client build) never
 * includes the worker. No values, IDs, or secrets are injected — binding and
 * secret NAMES are documented in worker/README.md.
 */
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const entry = path.join(appRoot, "worker", "index.ts");
const outfile = path.join(appRoot, "dist", "public", "_worker.js");

const result = await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  target: "es2022",
  platform: "neutral",
  /* EX-D20 (Phase B): postgres.js ships a dedicated workerd build
   * (cloudflare:sockets) — select it and keep node:/cloudflare: imports
   * external for the Workers runtime (resolved natively under the
   * nodejs_compat compatibility flag — see worker/README.md setup). */
  conditions: ["workerd"],
  external: ["cloudflare:sockets", "node:*"],
  minify: true,
  legalComments: "none",
  sourcemap: false,
  metafile: true,
  outfile,
  allowOverwrite: true,
});

const outputs = Object.values(result.metafile.outputs);
const bytes = outputs.reduce((total, output) => total + (output.bytes ?? 0), 0);
const LIMIT = 1024 * 1024; // Workers free-tier script size guard (1 MB).
if (bytes > LIMIT) {
  console.error(`build-worker: FAIL _worker.js bundle is ${bytes} bytes (limit ${LIMIT}).`);
  process.exit(1);
}
console.log(`build-worker: OK dist/public/_worker.js (${bytes} bytes, ${outputs.length} output(s))`);
