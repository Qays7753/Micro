/**
 * Tests for scripts/check-vendored-braces.mjs — the vendored braces@3.0.3
 * inventory guard (post-merge toolchain PR — 2026-10-06).
 *
 * Pins the three load-bearing properties:
 *  1) the scan maps hits to owning packages and skips symlinked (workspace)
 *     entries — the first-party shim's own copy of the message shape is
 *     excluded BY DESIGN, not by accident;
 *  2) drift fails closed in BOTH directions (new vendored copy / removed copy);
 *  3) the live installed tree matches the committed baseline exactly.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BASELINE_PATH,
  ROOT,
  evaluateInventory,
  loadBaseline,
  scanForSignature,
  SIGNATURE,
} from "./check-vendored-braces.mjs";

function makeFixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vendored-braces-"));
  const nm = path.join(root, "node_modules");
  return { root, nm };
}

function writePkgFile(nm, name, version, relFile, content) {
  const pkgDir = path.join(nm, ".pnpm", `${name.replace("/", "+")}@${version}`, "node_modules", name);
  fs.mkdirSync(path.dirname(path.join(pkgDir, relFile)), { recursive: true });
  fs.writeFileSync(path.join(pkgDir, "package.json"), JSON.stringify({ name, version }), "utf8");
  fs.writeFileSync(path.join(pkgDir, relFile), content, "utf8");
  return pkgDir;
}

const SIG_FILE = `const parse = (input) => { if (input.length > 10000) throw new SyntaxError(\`Input length (\${input.length}), exceeds max characters (10000)\`); };\n`;
const CLEAN_FILE = "const noop = () => {};\n";

describe("check-vendored-braces — scan (fixture-based)", () => {
  it("maps a signature hit to its owning package@version and relative file", () => {
    const { root, nm } = makeFixtureRoot();
    writePkgFile(nm, "fake-tool", "1.2.3", "dist/bundle.js", SIG_FILE);
    const result = scanForSignature(root);
    expect(result.ok).toBe(true);
    expect(result.scanned).toBe(1);
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]).toMatchObject({ package: "fake-tool", version: "1.2.3", file: "dist/bundle.js" });
    expect(result.hits[0].key).toBe("fake-tool@1.2.3:dist/bundle.js");
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("does not flag files without the signature", () => {
    const { root, nm } = makeFixtureRoot();
    writePkgFile(nm, "clean-tool", "1.0.0", "dist/index.js", CLEAN_FILE);
    const result = scanForSignature(root);
    expect(result.ok).toBe(true);
    expect(result.hits).toHaveLength(0);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("skips symlinked entries (workspace packages are excluded by design)", () => {
    const { root, nm } = makeFixtureRoot();
    // A physical first-party source dir OUTSIDE node_modules containing the signature
    const shimSource = path.join(root, "tools", "shim", "lib", "engine.js");
    fs.mkdirSync(path.dirname(shimSource), { recursive: true });
    fs.writeFileSync(shimSource, SIG_FILE, "utf8");
    // Symlinked into node_modules like pnpm links workspace packages
    const linkDir = path.join(nm, "shim-link");
    fs.mkdirSync(nm, { recursive: true });
    fs.symlinkSync(path.join(root, "tools", "shim"), linkDir, "dir");
    const result = scanForSignature(root);
    expect(result.ok).toBe(true);
    expect(result.hits).toHaveLength(0); /* the only real copy lives outside node_modules; the link is skipped */
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("fails closed when node_modules is missing", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "vendored-braces-"));
    const result = scanForSignature(root);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/node_modules not found/);
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe("check-vendored-braces — baseline + evaluation", () => {
  it("rejects a malformed baseline (fail-closed)", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "vendored-braces-"));
    const bad = path.join(root, "bad-baseline.json");
    fs.writeFileSync(bad, JSON.stringify({ nope: true }), "utf8");
    const loaded = loadBaseline(bad);
    expect(loaded.ok).toBe(false);
    expect(loaded.error).toMatch(/known_vendored_copies/);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("flags a NEW vendored copy as drift (exit 1)", () => {
    const baseline = {
      known_vendored_copies: [{ package: "known-tool", version: "1.0.0", file: "dist/a.js" }],
    };
    const hits = [
      { package: "known-tool", version: "1.0.0", file: "dist/a.js", key: "known-tool@1.0.0:dist/a.js" },
      { package: "sneaky-tool", version: "2.0.0", file: "dist/b.js", key: "sneaky-tool@2.0.0:dist/b.js" },
    ];
    const verdict = evaluateInventory(hits, baseline);
    expect(verdict.exitCode).toBe(1);
    expect(verdict.newCopies).toHaveLength(1);
    expect(verdict.newCopies[0].key).toBe("sneaky-tool@2.0.0:dist/b.js");
    expect(verdict.missingEntries).toHaveLength(0);
  });

  it("flags a REMOVED copy as drift (exit 1) — an upgrade that drops the code must update the inventory", () => {
    const baseline = {
      known_vendored_copies: [
        { package: "known-tool", version: "1.0.0", file: "dist/a.js" },
        { package: "gone-tool", version: "1.0.0", file: "dist/x.js" },
      ],
    };
    const hits = [{ package: "known-tool", version: "1.0.0", file: "dist/a.js", key: "known-tool@1.0.0:dist/a.js" }];
    const verdict = evaluateInventory(hits, baseline);
    expect(verdict.exitCode).toBe(1);
    expect(verdict.missingEntries).toHaveLength(1);
    expect(verdict.missingEntries[0].key).toBe("gone-tool@1.0.0:dist/x.js");
    expect(verdict.newCopies).toHaveLength(0);
  });

  it("passes when the live set exactly equals the baseline", () => {
    const baseline = {
      known_vendored_copies: [{ package: "known-tool", version: "1.0.0", file: "dist/a.js" }],
    };
    const hits = [{ package: "known-tool", version: "1.0.0", file: "dist/a.js", key: "known-tool@1.0.0:dist/a.js" }];
    const verdict = evaluateInventory(hits, baseline);
    expect(verdict.exitCode).toBe(0);
    expect(verdict.matched).toHaveLength(1);
  });
});

describe("check-vendored-braces — live tree (reproducibility pin)", () => {
  it("the committed baseline is well-formed", () => {
    const loaded = loadBaseline(BASELINE_PATH);
    expect(loaded.ok).toBe(true);
    expect(loaded.baseline.known_vendored_copies.length).toBeGreaterThanOrEqual(4);
  });

  it("the live installed tree matches the committed baseline exactly", () => {
    const { ok, baseline } = loadBaseline(BASELINE_PATH);
    assert.ok(ok);
    const scan = scanForSignature(ROOT);
    expect(scan.ok).toBe(true);
    const verdict = evaluateInventory(scan.hits, baseline);
    if (verdict.exitCode !== 0) {
      console.error("new:", verdict.newCopies.map(c => c.key), "missing:", verdict.missingEntries.map(c => c.key));
    }
    expect(verdict.exitCode).toBe(0);
    /* the documented six copies, pinned by name */
    const keys = scan.hits.map(h => h.key).sort();
    expect(keys).toContain("prettier@3.9.6:index.mjs");
    expect(keys).toContain("rollup@4.62.4:dist/es/shared/watch.js");
    expect(keys).toContain("rollup@4.62.4:dist/shared/index.js");
    expect(keys).toContain("tsx@4.23.12:dist/cli.cjs");
    expect(keys).toContain("tsx@4.23.12:dist/cli.mjs");
    expect(keys).toContain("vite@7.3.6:dist/node/chunks/config.js");
  });

  it("the signature is the braces@3.0.3 length-guard template", () => {
    expect(SIGNATURE).toBe("exceeds max characters");
  });
});
