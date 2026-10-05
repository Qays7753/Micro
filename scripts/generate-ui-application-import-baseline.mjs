#!/usr/bin/env node
/**
 * Step 6 (STR-615 system-wide — PR #316 correction program, 2026-10-06):
 * generates scripts/ui-application-import-baseline.json — the R6 ratchet
 * baseline for UI deep imports into application house interiors.
 *
 * Regenerating this file DELIBERTELY (to grow it back) requires a documented
 * reason in the same PR; normal flow only shrinks it as doors land. Run:
 *   node scripts/generate-ui-application-import-baseline.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, resolveSpecifier } from "./check-runtime-cycles.mjs";
import { layerOf, collectAllImports } from "./check-module-boundaries.mjs";

const APP_PREFIX = "apps/prototype-web/client/src/application/";
const R6_LAYERS = new Set(["ui", "app-shell", "contexts", "lib", "presentation", "pwa"]);

const all = collectAllImports(ROOT);
const keys = new Set();
for (const imp of all) {
  if (!R6_LAYERS.has(imp.layer)) continue;
  const r = imp.resolved;
  if (!r || !r.startsWith(APP_PREFIX)) continue;
  const parts = r.slice(APP_PREFIX.length).split("/");
  if (parts.length < 2) continue; // top-level application file — not a house interior
  if (parts[parts.length - 1] === "index.ts") continue; // door import
  keys.add(`${imp.file} -> ${r}`);
}

const payload = {
  version: 1,
  description:
    "R6 ratchet baseline (check-module-boundaries.mjs): UI-layer deep imports into application house interiors. Generated from the live census at the start of Step 6 (127 sites); shrinks monotonically as Public Doors land (STR-615). Entries are removed in the same PR that migrates their sites; the terminal state is the documented retained-import set (frozen compat shims with owner/removal conditions). Adding or re-adding an entry requires a documented reason in the same PR.",
  allowed: [...keys].sort(),
};

const outPath = path.join(ROOT, "scripts", "ui-application-import-baseline.json");
fs.writeFileSync(outPath, JSON.stringify(payload, null, 1) + "\n", "utf8");
console.log(`wrote ${outPath} with ${keys.size} allowed deep-import keys`);
