/**
 * CI audit-gate fail-closed test (security/eliminate-braces-20261006).
 *
 * The pre-fix audit step captured `code=$?` after a falsy `if` with no
 * `else`, so `$?` held the if-STATEMENT's exit status (0) instead of the
 * audit command's — three failing attempts still exited the step with 0
 * (a failing audit appeared green; independently confirmed by the audit
 * of PR #316 Step 2 and byte-verified against origin/main).
 *
 * This test executes the EXACT run block from the live workflow file
 * (only the sleep constant is neutralized for speed — the exit-code
 * logic runs verbatim) against a stubbed `pnpm`, and pins the static
 * shape of the step:
 *   - a failing audit fails the step (exit code propagated verbatim);
 *   - retry-then-pass succeeds; a passing audit succeeds;
 *   - no continue-on-error anywhere in the workflow;
 *   - no advisory allowlist / suppression flags;
 *   - the else-capture and the defensive fall-through stay in place.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const WORKFLOW = path.join(REPO_ROOT, ".github", "workflows", "ci.yml");

function readWorkflow() {
  return fs.readFileSync(WORKFLOW, "utf8");
}

/** Extract the audit step's run block (indented under `run: |`). */
function extractAuditRun(text) {
  const nameIdx = text.indexOf("Audit dependencies (bounded retry for registry outages)");
  assert.ok(nameIdx !== -1, "audit step must exist in the workflow");
  const runIdx = text.indexOf("run: |", nameIdx);
  assert.ok(runIdx !== -1, "audit step must have a run block");
  const lines = text.slice(runIdx + "run: |".length).split("\n");
  const block = [];
  for (const line of lines.slice(1)) {
    // The block ends at the first line that is not blank and not indented
    // at least as deeply as the first body line (10 spaces).
    if (line.trim() !== "" && !/^ {10}/.test(line)) break;
    block.push(line);
  }
  return block.join("\n");
}

/** Run the extracted audit step with a stub `pnpm` and neutralized sleep. */
function runAuditStep(stubBehavior) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "audit-gate-"));
  const binDir = path.join(tmp, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  const stateFile = path.join(tmp, "attempts");
  const stub = `#!/bin/sh\nattempts_file="${stateFile}"\nn=\$(cat "$attempts_file" 2>/dev/null || echo 0)\nn=\$((n + 1))\necho "$n" > "$attempts_file"\n${stubBehavior}\n`;
  fs.writeFileSync(path.join(binDir, "pnpm"), stub, { mode: 0o755 });
  const script = extractAuditStepScript();
  const env = { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH}` };
  delete env.NODE_PATH;
  const res = spawnSync("sh", ["-c", script], { encoding: "utf8", env, timeout: 60_000 });
  fs.rmSync(tmp, { recursive: true, force: true });
  return res;
}

let cachedStepScript = null;
function extractAuditStepScript() {
  if (cachedStepScript) return cachedStepScript;
  const text = readWorkflow();
  const block = extractAuditRun(text);
  // Neutralize ONLY the retry sleep for test speed; the exit-code logic
  // under test runs verbatim.
  cachedStepScript = block.replace(/sleep 60/g, "sleep 0");
  return cachedStepScript;
}

describe("ci audit gate (security/eliminate-braces-20261006)", () => {
  it("fails the step when pnpm audit fails (the pre-fix bug exited 0)", () => {
    const res = runAuditStep("exit 1");
    assert.notEqual(res.status, 0, "a failing audit must fail the step");
    assert.equal(res.status, 1, "the audit failure code must propagate");
    assert.match(res.stdout + res.stderr, /audit attempt 3 failed/);
  });

  it("propagates a distinctive failure code verbatim (not masked to 0 or 1)", () => {
    const res = runAuditStep("exit 7");
    assert.equal(res.status, 7, "a distinctive audit failure code must be preserved");
  });

  it("succeeds after retry-then-pass", () => {
    const res = runAuditStep('if [ "$n" -ge 3 ]; then exit 0; else exit 1; fi');
    assert.equal(res.status, 0, "retry then pass must succeed");
    assert.match(res.stdout + res.stderr, /audit passed on attempt 3/);
  });

  it("succeeds immediately when the audit passes", () => {
    const res = runAuditStep("exit 0");
    assert.equal(res.status, 0);
    assert.match(res.stdout + res.stderr, /audit passed on attempt 1/);
  });

  it("static shape: else-capture, quoted exit, defensive fall-through, exact command", () => {
    const text = readWorkflow();
    const block = extractAuditRun(text);
    assert.match(block, /pnpm audit --audit-level high/, "the audit command must be exactly the high-level audit");
    assert.doesNotMatch(block, /--ignore|--allow|GHSA|CVE|advisory/i, "no advisory allowlist or suppression may exist in the audit step");
    // The pre-fix bug shape: `fi` immediately followed by `code=$?`.
    assert.doesNotMatch(block, /fi\s*\n\s*code=\$\?/, "the un-captured $? pattern must stay fixed (capture inside else)");
    assert.match(block, /else\s*\n\s*code=\$\?/, "the else branch must capture the audit exit code");
    assert.match(block, /exit "\$code"/, "the terminal exit must quote and use the captured code");
    assert.match(block, /done\s*\n\s*#\s*Defensive fall-through[\s\S]*\n\s*exit 1/, "the defensive fall-through must follow the retry loop");
  });

  it("static shape: no continue-on-error anywhere; branches filter intact", () => {
    const text = readWorkflow();
    assert.doesNotMatch(text, /continue-on-error/, "no step may continue on error");
    // Byte-safe structural pins (avoid reformatting ambiguity).
    assert.includes = undefined; // placeholder no-op
    assert.ok(text.includes("branches: [main]"), "the push filter must remain the valid [main] list");
    assert.ok(text.includes('tags: ["v*"]'), "tag triggers must be preserved");
    assert.ok(text.includes("pull_request:"), "pull_request trigger must be preserved");
    assert.ok(text.includes("pnpm install --frozen-lockfile --ignore-scripts"), "frozen install must be preserved");
    assert.ok(text.includes("pnpm check"), "the full verification step must be preserved");
    assert.ok(text.includes("pnpm lint"), "the lint step must be preserved");
  });
});
