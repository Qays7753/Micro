/**
 * Braces-elimination parity + invariants test.
 *
 * Two modes, detected from the installed graph (never assumed):
 *
 *  BASELINE MODE (original micromatch@4.0.8 + braces present):
 *    - verifies the committed fixtures still reproduce against the
 *      original stack (fixture integrity / no accidental edits);
 *    - elimination and hostile-bound assertions are NOT applicable yet.
 *
 *  SHIM MODE (micromatch replaced by the braces-free shim):
 *    - every battery must match the frozen fixtures byte-for-byte
 *      (exit codes, JSON findings, exact linted file sets, ordering,
 *      thrown-error types and messages, regex sources);
 *    - elimination invariants are enforced (no braces in lockfile,
 *      shim active, no production-graph leak);
 *    - hostile inputs must fail closed within bounds (no hang, no OOM,
 *      no silent success).
 *
 * Mutation tests prove the harness itself has teeth: a deliberately
 * corrupted comparison input and a deliberately violating stdin payload
 * MUST be reported as mismatches.
 */
import assert, { AssertionError } from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
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
  cleanSpawnEnv,
  effectiveArgs,
  normalizeOutput,
  runStylelint,
  stableStringify,
} from "./harness-lib.mjs";

const require = createRequire(path.join(REPO_ROOT, "package.json"));

/* ---------------------------------------------------------------- *
 * Resolve micromatch exactly as the real consumers do: through the  *
 * stylelint dependency edge (the edge the shim occupies).           *
 * ---------------------------------------------------------------- */
function loadMicromatch() {
  const rootRequire = createRequire(path.join(REPO_ROOT, "package.json"));
  const stylelintEntry = rootRequire.resolve("stylelint");
  const stylelintRequire = createRequire(stylelintEntry);
  const micromatchEntry = stylelintRequire.resolve("micromatch");
  /* Require BY ABSOLUTE PATH and read the package.json ADJACENT to the
   * entry — never via specifier from the shim's directory: under vitest's
   * CJS interop a bare specifier can be routed through the runner's own
   * resolver and land on a stale package instead of the active module. */
  const entryRequire = createRequire(micromatchEntry);
  const mod = entryRequire(micromatchEntry);
  const pkg = JSON.parse(fs.readFileSync(path.join(path.dirname(micromatchEntry), "package.json"), "utf8"));
  /* braces presence is decided on the FILESYSTEM (the original's virtual
   * store keeps braces as a sibling of the micromatch dir), not by a
   * require.resolve that vitest may redirect. */
  const bracesSibling = path.resolve(path.dirname(micromatchEntry), "..", "braces");
  const bracesInside = path.join(path.dirname(micromatchEntry), "node_modules", "braces");
  const hasBraces = fs.existsSync(bracesSibling) || fs.existsSync(bracesInside);
  console.log(
    `[harness] stylelintEntry=${stylelintEntry}\n[harness] micromatchEntry=${micromatchEntry}\n[harness] pkg=${pkg.name}@${pkg.version} hasBraces=${hasBraces}`,
  );
  return { pkg, mod, micromatchEntry, stylelintEntry };
}

const loaded = loadMicromatch();
const micromatch = loaded.mod;
const IS_SHIM = loaded.pkg.name !== "micromatch";
const MODE = IS_SHIM ? "SHIM (enforcement)" : "BASELINE (fixture integrity)";

function readFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"));
}

function captureFn(fn) {
  try {
    return { ok: JSON.parse(JSON.stringify(fn())) };
  } catch (err) {
    return { throw: `${err && err.constructor ? err.constructor.name : "Error"}: ${err && err.message ? err.message : String(err)}` };
  }
}

/* The single comparison primitive used for every battery — and by the
 * mutation tests to prove it detects differences. */
function assertMatches(label, actual, expected) {
  const a = stableStringify(actual);
  const e = stableStringify(expected);
  assert.equal(a, e, `${label} diverged from the frozen baseline fixture`);
}

test(
  `braces-elimination harness [${MODE}]: brace-expansion parity (fast-glob semantics)`,
  { timeout: 120_000 },
  () => {
    const fixture = readFixture("braces-expand.json");
    for (const record of fixture) {
      if (record.pattern.startsWith("SPECIAL:")) continue;
      const current = captureFn(() => micromatch.braces(record.pattern, FAST_GLOB_BRACES_OPTIONS));
      assertMatches(`micromatch.braces(${JSON.stringify(record.pattern)})`, current, record.micromatchBraces);
    }
    // Wrapper semantics (mode-independent).
    const specials = Object.fromEntries(fixture.filter((r) => r.pattern.startsWith("SPECIAL:")).map((r) => [r.pattern, r]));
    assertMatches(
      "micromatch.braces nobrace fast-path",
      captureFn(() => micromatch.braces("{a,b}", { ...FAST_GLOB_BRACES_OPTIONS, nobrace: true })),
      specials["SPECIAL:nobrace"].micromatchBraces,
    );
    assertMatches(
      "micromatch.braces non-string TypeError",
      captureFn(() => micromatch.braces(42, FAST_GLOB_BRACES_OPTIONS)),
      specials["SPECIAL:non-string"].micromatchBraces,
    );
    assertMatches(
      "micromatch.braceExpand",
      captureFn(() => micromatch.braceExpand("foo/{a,b}/bar", { nodupes: true, keepEscaping: true })),
      specials["SPECIAL:brace-expand"].micromatchBraces,
    );
  },
);

test(
  `braces-elimination harness [${MODE}]: micromatch API parity (list form, isMatch, makeRe, scan, misc)`,
  { timeout: 60_000 },
  () => {
    const fixture = readFixture("micromatch-api.json");

    for (const c of fixture.listForm) {
      assertMatches(
        `list form ${stableStringify(c.case)}`,
        captureFn(() => micromatch(c.case.list, c.case.patterns, c.case.options)),
        c.result,
      );
    }
    for (const [key, expected] of Object.entries(fixture.listFormSpecial)) {
      const argsMap = {
        failglob: () => micromatch(["x"], ["zzz"], { failglob: true }),
        nonull: () => micromatch(["x"], ["zzz"], { nonull: true }),
        nullglob: () => micromatch(["x"], ["zzz"], { nullglob: true }),
        unescapeNonull: () => micromatch(["x"], ["z\\z"], { nonull: true, unescape: true }),
      };
      assertMatches(`list-form special ${key}`, captureFn(argsMap[key]), expected);
    }
    for (const c of fixture.isMatch) {
      assertMatches(
        `isMatch ${stableStringify(c.case)}`,
        captureFn(() => micromatch.isMatch(c.case.str, c.case.patterns, c.case.options)),
        c.result,
      );
    }
    for (const c of fixture.misc) {
      if (c.results) {
        const current = c.then.map((item) => captureFn(() => micromatch[c.api](...c.args)(item)));
        assertMatches(`misc ${c.api} ${stableStringify(c.args)} (mapper)`, current, c.results);
      } else {
        assertMatches(`misc ${c.api} ${stableStringify(c.args)}`, captureFn(() => micromatch[c.api](...c.args)), c.result);
      }
    }
    for (const c of fixture.makeRe) {
      assertMatches(
        `makeRe source ${c.case.pattern}`,
        captureFn(() => String(micromatch.makeRe(c.case.pattern, c.case.options))),
        c.source,
      );
      for (const [subject, expected] of Object.entries(c.behavior)) {
        assertMatches(
          `makeRe behavior ${c.case.pattern} vs ${subject}`,
          captureFn(() => micromatch.makeRe(c.case.pattern, c.case.options).test(subject)),
          expected,
        );
      }
    }
    for (const c of fixture.scan) {
      assertMatches(`scan parts ${JSON.stringify(c.pattern)}`, captureFn(() => micromatch.scan(c.pattern, { parts: true }).parts), c.parts);
    }
  },
);

test(
  `braces-elimination harness [${MODE}]: stylelint behavioral parity (exact Micro invocation + corpus, run twice)`,
  { timeout: 300_000 },
  () => {
    const fixture = readFixture("stylelint-runs.json");
    /* fast-glob emits multi-file reports in async-stream completion order
     * (deep subdirectories can complete after later siblings) — an
     * interleaving of the walk, not a matching semantic. Compare the
     * per-case reports as SOURCE-SORTED sets: the exact file set, each
     * file's findings (rule/severity/text/line/column, compared verbatim
     * and in-file), and exit codes remain strictly compared. */
    const canon = (report) =>
      Array.isArray(report) ? [...report].sort((x, y) => String(x.source).localeCompare(String(y.source))) : report;
    const runBattery = () =>
      STYLELINT_CASES.map((c) => {
        const r = runStylelint(effectiveArgs(c), c.stdin || null);
        return { label: c.label, exitCode: r.exitCode, report: canon(r.report), raw: c.json ? undefined : r.raw };
      });
    const pass1 = runBattery();
    const pass2 = runBattery();
    assert.equal(stableStringify(pass1), stableStringify(pass2), "stylelint battery must be deterministic across 2 runs");
    const byLabel = Object.fromEntries(fixture.map((f) => [f.label, f]));
    for (const run of pass1) {
      const expected = byLabel[run.label];
      assert.ok(expected, `fixture missing for ${run.label}`);
      assert.equal(run.exitCode, expected.exitCode, `exit code changed for ${run.label}`);
      assertMatches(`stylelint report ${run.label}`, run.report ?? null, canon(expected.report) ?? null);
      if (expected.raw !== undefined) {
        /* Re-apply the (idempotent) normalizer to both sides: fixtures
         * were frozen with the normalizer of capture time, and later
         * legitimate additions (e.g. Node-internal stack-frame stripping
         * for cross-Node-version stability) must apply to both equally. */
        assert.equal(
          normalizeOutput(run.raw).trim(),
          normalizeOutput(expected.raw).trim(),
          `raw output changed for ${run.label}`,
        );
      }
    }
    // The exact production invocation must stay clean and complete —
    // asserted from the CURRENT run, not from the fixture.
    const actualGlob = pass1.find((r) => r.label === "micro-actual-glob-json");
    assert.equal(actualGlob.exitCode, 0, "the design-guards stylelint invocation must stay clean");
    assert.equal(actualGlob.report.length, 5, "the Micro CSS file set must be exactly 5 files");
    assert.ok(
      actualGlob.report.every((r) => r.warnings.length === 0 && r.errored === false),
      "no warnings or errors are acceptable on the production CSS set",
    );
  },
);

test(
  `braces-elimination harness [${MODE}]: CJS entrypoint parity (stylelint CommonJS API)`,
  { timeout: 120_000 },
  () => {
    const fixture = readFixture("cjs-api.json");
    const run = () =>
      spawnSync(process.execPath, [path.join(HARNESS_DIR, "cjs-api-probe.cjs")], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        timeout: 120_000,
        env: cleanSpawnEnv(),
      });
    const norm = (r) => ({ status: r.status, stdout: normalizeOutput(r.stdout), stderr: normalizeOutput(r.stderr) });
    const n1 = norm(run());
    const n2 = norm(run());
    assert.equal(stableStringify(n1), stableStringify(n2), "CJS probe must be deterministic across 2 runs");
    assert.equal(n1.status, fixture.status, "CJS probe exit status changed");
    assert.equal(n1.stdout, fixture.stdout, "CJS probe output changed");
    assert.equal(n1.stderr, fixture.stderr, "CJS probe stderr changed");
  },
);

test(
  "braces-elimination harness: consumer-surface pin (every micromatch call site in the installed graph is covered)",
  { timeout: 60_000 },
  () => {
    const covered = new Set([
      "default (list form)",
      "isMatch",
      "makeRe",
      "scan",
      "braces",
      "matcher",
      "any",
      "not",
      "contains",
      "matchKeys",
      "some",
      "every",
      "all",
      "capture",
      "parse",
      "braceExpand",
      "hasBraces",
    ]);
    const pnpmDir = path.join(REPO_ROOT, "node_modules", ".pnpm");
    const dirs = fs.readdirSync(pnpmDir);
    const consumers = [];
    for (const dir of dirs) {
      if (!dir.startsWith("fast-glob@") && !dir.startsWith("stylelint@")) continue;
      const pkgRoot = path.join(pnpmDir, dir, "node_modules", dir.split("@")[0]);
      if (!fs.existsSync(pkgRoot)) continue;
      const files = [];
      const walk = (d) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          if (entry.name.endsWith(".map")) continue;
          const full = path.join(d, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (/\.(m?js|cjs)$/.test(entry.name)) files.push(full);
        }
      };
      walk(pkgRoot);
      for (const file of files) {
        const text = fs.readFileSync(file, "utf8");
        const re = /micromatch(\.\w+|\()/g;
        let m;
        while ((m = re.exec(text))) {
          const member = m[1] === "(" ? "default (list form)" : m[1].slice(1);
          consumers.push(`${dir}: ${member}`);
        }
      }
    }
    assert.ok(consumers.length > 0, "expected to find micromatch call sites in fast-glob/stylelint");
    const used = new Set(consumers);
    for (const site of used) {
      const member = site.split(": ")[1];
      assert.ok(covered.has(member), `NEW micromatch API usage discovered: ${site} — the shim surface must be reviewed`);
    }
    // The pinned surface (any shrink also fails: coverage was load-bearing).
    for (const must of ["default (list form)", "isMatch", "makeRe", "scan", "braces"]) {
      assert.ok(
        [...used].some((s) => s.endsWith(`: ${must}`)),
        `expected micromatch usage ${must} to be present in the installed consumers (surface changed)`,
      );
    }
  },
);

test(
  "braces-elimination harness: mutation sensitivity (the comparison has teeth)",
  { timeout: 180_000 },
  () => {
    /* (a) API-level: a corrupted result MUST be reported as a mismatch. */
    const fixture = readFixture("micromatch-api.json");
    const case0 = fixture.isMatch[0].case;
    const truthy = captureFn(() => micromatch.isMatch(case0.str, case0.patterns, case0.options));
    const corrupted = { ok: truthy.ok === true ? false : true };
    assert.throws(
      () => assertMatches("mutation: flipped isMatch", corrupted, fixture.isMatch[0].result),
      AssertionError,
      "flipping an isMatch result must fail the comparator",
    );
    const bracesFixture = readFixture("braces-expand.json");
    const altCase = bracesFixture.find((r) => r.pattern === "{a,b}");
    assert.ok(altCase, "fixture case {a,b} present");
    const mutatedExpansion = { ok: ["a", "b", "EXTRA"] };
    assert.throws(
      () => assertMatches("mutation: extra expansion", mutatedExpansion, altCase.micromatchBraces),
      AssertionError,
      "adding a spurious expansion must fail the comparator",
    );

    /* (b) Rule coverage: a violating stdin payload MUST be detected as a
     * difference from the clean fixture (proves findings comparison is
     * live through the real binary, not vacuous). */
    const cleanRun = runStylelint(
      effectiveArgs({ args: ["--stdin-filename", "scripts/security/braces-elimination/corpus/stdin.css"], json: true }),
      ".stdin { z-index: 20; font-size: 1rem; }\n",
    );
    const mutatedRun = runStylelint(
      effectiveArgs({ args: ["--stdin-filename", "scripts/security/braces-elimination/corpus/stdin.css"], json: true }),
      ".stdin { z-index: 9999; font-size: 9px; }\n",
    );
    assert.equal(cleanRun.exitCode, 0, "clean stdin must pass");
    assert.notEqual(mutatedRun.exitCode, 0, "violating stdin must fail");
    assert.notEqual(
      stableStringify(mutatedRun.report),
      stableStringify(cleanRun.report),
      "violating payload must produce a different report",
    );
  },
);

/* ---------------------------------------------------------------- *
 * Elimination + hostile-input enforcement (SHIM MODE only).        *
 * ---------------------------------------------------------------- */

if (IS_SHIM) {
  test(
    "braces-elimination enforcement: braces is gone from the lockfile and the shim is active",
    { timeout: 60_000 },
    () => {
      const lock = fs.readFileSync(path.join(REPO_ROOT, "pnpm-lock.yaml"), "utf8");
      assert.ok(!/^\s*braces@/m.test(lock), "braces package entry must not exist in pnpm-lock.yaml");
      assert.ok(!/\/braces@|braces:\s*\d/m.test(lock), "no braces snapshot/dependency reference may remain in pnpm-lock.yaml");
      assert.equal(loaded.pkg.name, "micromatch-braces-free", "the active micromatch must be the braces-free shim");
      // Clean-subprocess resolution proof (immune to the test runner's
      // module interop): both real consumers resolve micromatch to the
      // shim, and braces is not resolvable from it.
      const probeScript = `
        const { createRequire } = require("node:module");
        const path = require("node:path");
        const rootRequire = createRequire(${JSON.stringify(path.join(REPO_ROOT, "package.json"))});
        const stylelintEntry = rootRequire.resolve("stylelint");
        const stylelintRequire = createRequire(stylelintEntry);
        const out = { stylelint: stylelintRequire.resolve("micromatch") };
        const fastGlobEntry = stylelintRequire.resolve("fast-glob");
        const fastGlobRequire = createRequire(fastGlobEntry);
        out["fast-glob"] = fastGlobRequire.resolve("micromatch");
        const shimRequire = createRequire(${JSON.stringify(loaded.micromatchEntry)});
        try {
          shimRequire.resolve("braces");
          out.braces = "RESOLVED";
        } catch {
          out.braces = "ABSENT";
        }
        process.stdout.write(JSON.stringify(out));
      `;
      const probe = spawnSync(process.execPath, ["-e", probeScript], {
        encoding: "utf8",
        timeout: 60_000,
        env: cleanSpawnEnv(),
      });
      assert.equal(probe.status, 0, `resolution probe must succeed (stderr: ${probe.stderr})`);
      const resolved = JSON.parse(probe.stdout);
      for (const consumer of ["fast-glob", "stylelint"]) {
        assert.ok(
          resolved[consumer].includes("micromatch-shim"),
          `${consumer} must resolve micromatch to the shim (got ${resolved[consumer]})`,
        );
      }
      assert.equal(resolved.braces, "ABSENT", "braces must not be resolvable from the shim context");
      // No production-graph leak: the shim appears only under the dev
      // importers (root "."), never under apps/prototype-web.
      const importersStart = lock.indexOf("importers:");
      const importersBlock = lock.slice(importersStart, lock.indexOf("\npackages:"));
      const appStart = importersBlock.indexOf("  apps/prototype-web:");
      assert.ok(appStart !== -1, "app importer must exist in the lockfile");
      const appBlock = importersBlock.slice(
        appStart,
        (() => {
          const next = importersBlock.slice(appStart + 1).search(/\n  [^\s]/);
          return next === -1 ? importersBlock.length : appStart + 1 + next;
        })(),
      );
      assert.ok(
        !/micromatch-braces-free|micromatch-shim/.test(appBlock),
        "the shim must not appear in the app importer (production graph)",
      );
      assert.ok(
        /micromatch-braces-free|micromatch-shim/.test(importersBlock),
        "the shim must be present in the dev importers (the override wiring)",
      );
    },
  );

  test(
    "braces-elimination enforcement: hostile inputs fail closed within bounds (no hang, no OOM, no silent success)",
    { timeout: 120_000 },
    () => {
      // (a) Exponential-width expansion must be refused by the output bound.
      const width64 = "x" + "{a,b}".repeat(64);
      assert.throws(
        () => micromatch.braces(width64, FAST_GLOB_BRACES_OPTIONS),
        (err) => /braces-free|expansion|bound/i.test(err.message),
        "width-64 sequential groups must throw the bounded-expansion error",
      );
      // (b) Ultra-deep nesting must be refused by the length guard
      // (same protective behavior as braces' own 10000-char limit).
      const depth6000 = "{a,".repeat(6000) + "b" + "}".repeat(6000);
      assert.throws(
        () => micromatch.braces(depth6000, FAST_GLOB_BRACES_OPTIONS),
        (err) => err instanceof SyntaxError || /exceeds max characters/i.test(err.message),
        "ultra-deep nesting must be refused by the length guard",
      );
      // (c) Fail-closed THROUGH the real tool: a hostile glob argument must
      // make stylelint exit non-zero (crash propagates; never silent success).
      const hostileGlob = "apps/**/" + "{a,b}".repeat(40) + ".css";
      const r = runStylelint([hostileGlob, "--formatter", "json"]);
      assert.notEqual(r.exitCode, 0, "hostile glob must not exit 0");
      assert.notEqual(r.exitCode, null, "hostile glob must not die by signal (OOM)");
      // (d) Legitimate deep nesting stays functional (no over-blocking).
      const legit = micromatch.braces("{a,".repeat(50) + "b" + "}".repeat(50), FAST_GLOB_BRACES_OPTIONS);
      assert.ok(Array.isArray(legit) && legit.length === 2, "legitimate depth-50 nesting must still expand (a, b)");
    },
  );
} else {
  test(
    "braces-elimination enforcement: SKIPPED (baseline stack active — enforcement begins when the shim lands)",
    { timeout: 10_000 },
    () => {
      console.log("BASELINE MODE: original micromatch@4.0.8 + braces active; elimination assertions inactive until the shim lands.");
      assert.equal(loaded.pkg.version, "4.0.8");
    },
  );
}
