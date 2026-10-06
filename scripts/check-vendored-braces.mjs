#!/usr/bin/env node
/**
 * Guard: vendored braces@3.0.3 code inventory (post-merge toolchain PR — 2026-10-06).
 *
 * GHSA-vfj7-8cjw-p6xm eliminated braces from the pnpm-RESOLVABLE graph (PR #317),
 * but the braces@3.0.3 implementation code is also VENDORED (inlined/bundled) inside
 * four dev-toolchain packages' dist bundles, where it is invisible to pnpm overrides
 * and `pnpm audit` by construction. This guard makes the invisible continuously
 * visible and monitored:
 *
 *  - scans the installed node_modules (real files only — symlink entries are skipped,
 *    which both matches pnpm's layout and naturally excludes first-party workspace
 *    packages such as tools/micromatch-shim, whose bounded engine legitimately
 *    reproduces the same protective error-message shape);
 *  - matches the exact braces@3.0.3 code signature (`exceeds max characters`, the
 *    parse.js:39 length-guard template — verified unique to braces in the graph);
 *  - maps every hit to its owning package@version and compares against the committed
 *    baseline `scripts/vendored-braces-baseline.json`;
 *  - FAILS on drift in BOTH directions:
 *      * a NEW vendored copy appeared (a new/inlined toolchain dependency — investigate
 *        and either remediate or extend the baseline deliberately with documentation);
 *      * a baseline entry is no longer present (the tool was upgraded and the copy is
 *        gone — update the inventory in the same PR that upgraded the tool, and record
 *        the removal);
 *  - prints the full inventory on every run (never silent);
 *  - fails closed when node_modules or the baseline is missing/malformed.
 *
 * This is monitoring, NOT suppression: the vendored copies remain fully disclosed in
 * docs/quality/vendored-braces-inventory.md with the upstream-limitation evidence;
 * this guard only guarantees the disclosure cannot silently rot.
 *
 * Exit codes: 0 = inventory matches the documented baseline; 1 = drift or fail-closed.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BASELINE_PATH = path.join(ROOT, "scripts", "vendored-braces-baseline.json");
export const SIGNATURE = "exceeds max characters";
export const SCANNED_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);

/** Load and validate the baseline. Fail-closed on any malformation. */
export function loadBaseline(baselinePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.known_vendored_copies)) {
      return { ok: false, baseline: null, error: "baseline must be an object with a known_vendored_copies array" };
    }
    for (const [index, entry] of parsed.known_vendored_copies.entries()) {
      const missing = ["package", "version", "file"].filter(k => typeof entry?.[k] !== "string" || entry[k].length === 0);
      if (missing.length > 0) {
        return { ok: false, baseline: null, error: `known_vendored_copies[${index}] missing string keys: ${missing.join(", ")}` };
      }
    }
    return { ok: true, baseline: parsed, error: null };
  } catch (error) {
    return { ok: false, baseline: null, error: `cannot read/parse baseline: ${error?.message ?? String(error)}` };
  }
}

/** Find the nearest package.json at or above `dir`; returns { name, version, dir } or null. */
function owningPackage(dir, stopAt) {
  let current = dir;
  while (current && current.length > stopAt.length && current.startsWith(stopAt)) {
    const manifest = path.join(current, "package.json");
    if (fs.existsSync(manifest)) {
      try {
        const meta = JSON.parse(fs.readFileSync(manifest, "utf8"));
        if (typeof meta.name === "string" && typeof meta.version === "string") {
          return { name: meta.name, version: meta.version, dir: current };
        }
      } catch {
        /* unreadable manifest — keep walking up */
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

/**
 * Scan the installed tree for the braces@3.0.3 signature.
 * Walks WITHOUT following symlinks (pnpm layout: real content lives under
 * node_modules/.pnpm/**; top-level entries and workspace packages are symlinks).
 */
export function scanForSignature(root, signature = SIGNATURE) {
  const nodeModules = path.join(root, "node_modules");
  if (!fs.existsSync(nodeModules)) {
    return { ok: false, hits: null, scanned: 0, error: `node_modules not found at ${nodeModules} — run pnpm install (fail-closed)` };
  }
  const hits = [];
  let scanned = 0;
  const stack = [nodeModules];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue; /* unreadable dir — skip */
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue; /* alias/workspace link — the real file is scanned at its physical location */
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile() || !SCANNED_EXTENSIONS.has(path.extname(entry.name))) continue;
      scanned += 1;
      let source;
      try {
        source = fs.readFileSync(full, "utf8");
      } catch {
        continue; /* unreadable file — skip */
      }
      if (source.includes(signature)) {
        const owner = owningPackage(path.dirname(full), nodeModules);
        hits.push({
          package: owner?.name ?? "unknown",
          version: owner?.version ?? "unknown",
          file: owner ? path.relative(owner.dir, full).split(path.sep).join("/") : full,
          key: `${owner?.name ?? "unknown"}@${owner?.version ?? "unknown"}:${owner ? path.relative(owner.dir, full).split(path.sep).join("/") : full}`,
        });
      }
    }
  }
  hits.sort((a, b) => a.key.localeCompare(b.key));
  return { ok: true, hits, scanned, error: null };
}

/** Compare live hits to the baseline. Returns { exitCode, newCopies[], missingEntries[], matched[] }. */
export function evaluateInventory(hits, baseline) {
  const baselineKeys = new Set(baseline.known_vendored_copies.map(e => `${e.package}@${e.version}:${e.file}`));
  const hitKeys = new Set(hits.map(h => h.key));
  const newCopies = hits.filter(h => !baselineKeys.has(h.key));
  const missingEntries = baseline.known_vendored_copies
    .filter(e => !hitKeys.has(`${e.package}@${e.version}:${e.file}`))
    .map(e => ({ ...e, key: `${e.package}@${e.version}:${e.file}` }));
  return {
    exitCode: newCopies.length === 0 && missingEntries.length === 0 ? 0 : 1,
    newCopies,
    missingEntries,
    matched: hits.filter(h => baselineKeys.has(h.key)),
  };
}

function main() {
  const baselineLoad = loadBaseline(BASELINE_PATH);
  if (!baselineLoad.ok) {
    console.error(`check-vendored-braces: FAIL — ${baselineLoad.error}`);
    process.exit(1);
  }
  const scan = scanForSignature(ROOT);
  if (!scan.ok) {
    console.error(`check-vendored-braces: FAIL — ${scan.error}`);
    process.exit(1);
  }
  const verdict = evaluateInventory(scan.hits, baselineLoad.baseline);
  console.log(`check-vendored-braces: scanned ${scan.scanned} installed JS files for the braces@3.0.3 signature ("${SIGNATURE}")`);
  for (const hit of scan.hits) {
    console.log(`check-vendored-braces: vendored copy — ${hit.package}@${hit.version} :: ${hit.file}`);
  }
  for (const missing of verdict.missingEntries) {
    console.error(
      `check-vendored-braces: DRIFT — baseline entry ${missing.key} is no longer present; ` +
        `the tool was likely upgraded past the vendored code — update scripts/vendored-braces-baseline.json ` +
        `and docs/quality/vendored-braces-inventory.md in the same PR that upgraded it`,
    );
  }
  for (const extra of verdict.newCopies) {
    console.error(
      `check-vendored-braces: DRIFT — NEW vendored braces copy ${extra.key}; ` +
        `investigate the toolchain change and either remediate or extend the baseline + documentation deliberately`,
    );
  }
  if (verdict.exitCode === 0) {
    console.log(
      `check-vendored-braces: PASS — ${verdict.matched.length} vendored copy/copies, exactly matching the documented baseline ` +
        `(documented upstream limitation — see docs/quality/vendored-braces-inventory.md; the graph-level elimination is guarded separately)`,
    );
  } else {
    console.error(`check-vendored-braces: FAIL — inventory drift (${verdict.newCopies.length} new, ${verdict.missingEntries.length} missing)`);
  }
  process.exit(verdict.exitCode);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
