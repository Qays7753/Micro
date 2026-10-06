/**
 * Capture the ORIGINAL (braces-graph) stack's behavior into golden fixtures.
 *
 * SAFETY: this script REFUSES to run unless node_modules contains the
 * original micromatch@4.0.8 WITH its braces dependency — i.e. it can only
 * ever freeze the baseline, never "refresh" fixtures from the shim and
 * silently bless a behavior change.
 *
 * Runs every battery TWICE and asserts byte-identical results between the
 * two passes (determinism proof), then writes:
 *   fixtures/braces-expand.json
 *   fixtures/micromatch-api.json
 *   fixtures/stylelint-runs.json
 *   fixtures/cjs-api.json
 *
 * Usage: node scripts/security/braces-elimination/capture-baseline.mjs
 * (must run from a checkout of the ORIGINAL dependency graph, e.g. the
 * parent commit of the shim change, after `pnpm install`.)
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  BRACES_CASES,
  FAST_GLOB_BRACES_OPTIONS,
  FIXTURES_DIR,
  HARNESS_DIR,
  IS_MATCH_CASES,
  LIST_FORM_CASES,
  MAKE_RE_CASES,
  MISC_API_CASES,
  REPO_ROOT,
  SCAN_CASES,
  STYLELINT_CASES,
  normalizeOutput,
  effectiveArgs,
  runStylelint,
  stableStringify,
} from "./harness-lib.mjs";

const require = createRequire(path.join(REPO_ROOT, "package.json"));

/* Anchor requires at the stylelint package — the exact dependency edge the
 * shim will occupy — so we capture what the real consumers load. The whole
 * anchor block is guarded (hostile-review correction 2026-10-06): on the
 * shim graph neither `micromatch` (the workspace link realpaths to
 * tools/micromatch-shim, whose name is micromatch-braces-free) nor `braces`
 * resolves from the anchor location, and previously that surfaced as an
 * uncaught MODULE_NOT_FOUND stack trace instead of the intended clean
 * REFUSING message. Behavior was fail-closed and write-free either way;
 * every write still happens only after the guards below. */
let stylelintEntry;
let stylelintRequire;
let micromatchEntry;
let mmRequire;
let micromatch;
let braces;
try {
  stylelintEntry = require.resolve("stylelint");
  stylelintRequire = createRequire(stylelintEntry);
  micromatchEntry = stylelintRequire.resolve("micromatch");
  mmRequire = createRequire(micromatchEntry);
  micromatch = mmRequire("micromatch");
  braces = mmRequire("braces");
} catch (err) {
  console.error(
    "REFUSING: the stylelint→micromatch(+braces) edge this script anchors to " +
      `does not resolve to the original stack (got ${err.code || err.message}). ` +
      "Fixtures may only be captured from the original (braces) dependency graph.",
  );
  process.exit(2);
}

/* ---------- original-stack guard (fail-closed) ---------- */

const mmPkg = mmRequire("micromatch/package.json");
if (mmPkg.version !== "4.0.8" || mmPkg.name !== "micromatch") {
  console.error(
    `REFUSING: stylelint's micromatch is ${mmPkg.name}@${mmPkg.version}, ` +
      `expected the original micromatch@4.0.8. Fixtures may only be captured ` +
      `from the original (braces) dependency graph.`,
  );
  process.exit(2);
}
let bracesResolved;
try {
  bracesResolved = mmRequire.resolve("braces");
} catch {
  bracesResolved = null;
}
if (!bracesResolved) {
  console.error("REFUSING: original micromatch is present but its `braces` dependency is not resolvable.");
  process.exit(2);
}
console.log(`original stack verified: micromatch@${mmPkg.version} + braces at ${bracesResolved.split(".pnpm")[1] || ""}`);

/* ---------- capture batteries ---------- */

function captureFn(fn) {
  try {
    return { ok: JSON.parse(JSON.stringify(fn())) };
  } catch (err) {
    return { throw: `${err && err.constructor ? err.constructor.name : "Error"}: ${err && err.message ? err.message : String(err)}` };
  }
}

function captureBracesMatrix() {
  const out = [];
  for (const pattern of BRACES_CASES) {
    const record = { pattern };
    record.braces = captureFn(() => braces(pattern, FAST_GLOB_BRACES_OPTIONS));
    record.micromatchBraces = captureFn(() => micromatch.braces(pattern, FAST_GLOB_BRACES_OPTIONS));
    out.push(record);
  }
  // wrapper semantics
  out.push({
    pattern: "SPECIAL:nobrace",
    micromatchBraces: captureFn(() => micromatch.braces("{a,b}", { ...FAST_GLOB_BRACES_OPTIONS, nobrace: true })),
  });
  out.push({ pattern: "SPECIAL:non-string", micromatchBraces: captureFn(() => micromatch.braces(42, FAST_GLOB_BRACES_OPTIONS)) });
  out.push({
    pattern: "SPECIAL:brace-expand",
    micromatchBraces: captureFn(() => micromatch.braceExpand("foo/{a,b}/bar", { nodupes: true, keepEscaping: true })),
  });
  out.push({
    pattern: "SPECIAL:no-keep-escaping",
    braces: captureFn(() => braces("{a,b}\\\\c", { expand: true, nodupes: true })),
  });
  return out;
}

function captureMicromatchApi() {
  return {
    listForm: LIST_FORM_CASES.map((c) => ({
      case: c,
      result: captureFn(() => micromatch(c.list, c.patterns, c.options)),
    })),
    listFormSpecial: {
      failglob: captureFn(() => micromatch(["x"], ["zzz"], { failglob: true })),
      nonull: captureFn(() => micromatch(["x"], ["zzz"], { nonull: true })),
      nullglob: captureFn(() => micromatch(["x"], ["zzz"], { nullglob: true })),
      unescapeNonull: captureFn(() => micromatch(["x"], ["z\\z"], { nonull: true, unescape: true })),
    },
    isMatch: IS_MATCH_CASES.map((c) => ({
      case: c,
      result: captureFn(() => micromatch.isMatch(c.str, c.patterns, c.options)),
    })),
    misc: MISC_API_CASES.map((c) => {
      if (c.then) {
        return {
          api: c.api,
          args: c.args,
          then: c.then,
          results: c.then.map((item) => captureFn(() => micromatch[c.api](...c.args)(item))),
        };
      }
      return { api: c.api, args: c.args, result: captureFn(() => micromatch[c.api](...c.args)) };
    }),
    makeRe: MAKE_RE_CASES.map((c) => ({
      case: { pattern: c.pattern, options: c.options },
      source: captureFn(() => String(micromatch.makeRe(c.pattern, c.options))),
      behavior: Object.fromEntries(c.test.map((t) => [t, captureFn(() => micromatch.makeRe(c.pattern, c.options).test(t))])),
    })),
    scan: SCAN_CASES.map((p) => ({
      pattern: p,
      parts: captureFn(() => micromatch.scan(p, { parts: true }).parts),
    })),
  };
}

function captureStylelintRuns() {
  /* fast-glob's multi-file reports follow async-stream completion order
   * (a walk interleaving, not a matching semantic) — canonicalize reports
   * to source-sorted order so fixtures are stable; the comparison test
   * applies the same canonicalization to live runs. */
  const canon = (report) =>
    Array.isArray(report) ? [...report].sort((x, y) => String(x.source).localeCompare(String(y.source))) : report;
  return STYLELINT_CASES.map((c) => {
    const r = runStylelint(effectiveArgs(c), c.stdin || null);
    return {
      label: c.label,
      args: c.args,
      exitCode: r.exitCode,
      report: canon(r.report),
      raw: c.json ? undefined : r.raw,
    };
  });
}

/* ---------- run everything twice, assert determinism ---------- */

const batteries = {
  "braces-expand.json": captureBracesMatrix,
  "micromatch-api.json": captureMicromatchApi,
  "stylelint-runs.json": captureStylelintRuns,
};

fs.mkdirSync(FIXTURES_DIR, { recursive: true });

let failures = 0;
for (const [name, capture] of Object.entries(batteries)) {
  const pass1 = capture();
  const pass2 = capture();
  const s1 = stableStringify(pass1);
  const s2 = stableStringify(pass2);
  if (s1 !== s2) {
    console.error(`NON-DETERMINISTIC battery: ${name} — refusing to write fixtures.`);
    failures += 1;
    continue;
  }
  fs.writeFileSync(path.join(FIXTURES_DIR, name), JSON.stringify(pass1, null, 1) + "\n");
  console.log(`captured ${name} (${s1.length} bytes, deterministic across 2 passes)`);
}

/* CJS API probe (twice) */
{
  const { spawnSync } = await import("node:child_process");
  const run = () =>
    spawnSync(process.execPath, [path.join(HARNESS_DIR, "cjs-api-probe.cjs")], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: 120_000,
    });
  const r1 = run();
  const r2 = run();
  const norm = (r) => ({ status: r.status, stdout: normalizeOutput(r.stdout), stderr: normalizeOutput(r.stderr) });
  const n1 = norm(r1);
  const n2 = norm(r2);
  if (stableStringify(n1) !== stableStringify(n2)) {
    console.error("NON-DETERMINISTIC battery: cjs-api.json — refusing to write fixtures.");
    failures += 1;
  } else {
    fs.writeFileSync(path.join(FIXTURES_DIR, "cjs-api.json"), JSON.stringify(n1, null, 1) + "\n");
    console.log(`captured cjs-api.json (exit ${n1.status}, deterministic across 2 passes)`);
  }
}

if (failures > 0) {
  console.error(`${failures} batteries were non-deterministic; no fixtures written for them.`);
  process.exit(1);
}
console.log("BASELINE CAPTURE COMPLETE");
