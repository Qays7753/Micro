/**
 * CI audit-gate fail-closed test (security/eliminate-braces-20261006; adapted
 * to the script-based audit step after PR #317 merged into this branch).
 *
 * History: the pre-fix audit step captured `code=$?` after a falsy `if` with
 * no `else`, so `$?` held the if-STATEMENT's exit status (0) instead of the
 * audit command's — three failing attempts still exited the step with 0 (a
 * failing audit appeared green; independently confirmed by the audit of
 * PR #316 Step 2 and byte-verified against origin/main).
 *
 * PR #317 fixed the inline step; PR #316's correction program extracted the
 * same logic to `scripts/ci-audit-step.sh` (a fail-closed superset: bounded
 * retry + the documented security-exception register via
 * `scripts/ci-audit-check.mjs`). After the two PRs converged on main, this
 * test pins the MERGED architecture:
 *   - the live workflow wires the script-based audit step (by step name);
 *   - the script keeps the else-capture, quoted verbatim exit, and the
 *     defensive fall-through (the actual original bug fix);
 *   - the script's failure propagation is re-proven behaviorally here with a
 *     stub audit command (in addition to scripts/ci-audit-step.test.mjs);
 *   - the default audit command is the register-aware checker (no silent
 *     suppression path; OWNER_ACCEPTED exceptions print, PROPOSED/REJECTED
 *     block, unknown statuses block);
 *   - no continue-on-error anywhere; the push filter stays a valid list;
 *     frozen install and the full `pnpm check` verification are preserved
 *     (lint is enforced inside `pnpm check` since F-05c — never dropped).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const WORKFLOW = path.join(REPO_ROOT, ".github", "workflows", "ci.yml");
const STEP_SCRIPT = path.join(REPO_ROOT, "scripts", "ci-audit-step.sh");
const CHECKER = path.join(REPO_ROOT, "scripts", "ci-audit-check.mjs");

function readWorkflow() {
  return fs.readFileSync(WORKFLOW, "utf8");
}

function readScript() {
  return fs.readFileSync(STEP_SCRIPT, "utf8");
}

/** Extract the audit step block from the live workflow (name through its run line). */
function extractAuditStep(text) {
  const nameIdx = text.indexOf("Audit dependencies (bounded retry for registry outages)");
  assert.ok(nameIdx !== -1, "audit step must exist in the workflow");
  const nextStepIdx = text.indexOf("- name:", nameIdx);
  return text.slice(nameIdx, nextStepIdx === -1 ? undefined : nextStepIdx);
}

/** Run the audit-step script with a stub audit command (no pnpm/network involved). */
function runStepScript(maxAttempts, stubCommand) {
  const res = spawnSync(
    "bash",
    [STEP_SCRIPT, "sh", "-c", stubCommand],
    {
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, CI_AUDIT_MAX_ATTEMPTS: String(maxAttempts), CI_AUDIT_RETRY_SLEEP: "0" },
    },
  );
  return res;
}

describe("ci audit gate (script-based step; post-#317-merge adaptation)", () => {
  it("wires the audit step to the fixed, testable script (live workflow)", () => {
    const step = extractAuditStep(readWorkflow());
    assert.match(step, /run:\s*bash scripts\/ci-audit-step\.sh/, "the audit step must invoke the script");
  });

  it("the script keeps the original bug fix: else-capture, quoted verbatim exit, defensive fall-through", () => {
    const script = readScript();
    // The pre-fix bug shape: `fi` immediately followed by `code=$?`.
    assert.doesNotMatch(script, /fi\s*\n\s*code=\$\?/, "the un-captured $? pattern must stay fixed (capture inside else)");
    assert.match(script, /else\s*\n\s*code=\$\?/, "the else branch must capture the audit exit code");
    assert.match(script, /exit "\$\{?code\}?"/, "the terminal exit must use the captured code");
    assert.match(
      script, /defensive/i,
      "the defensive fall-through must be documented in the script",
    );
    assert.match(script, /exit 1\s*$/m, "the defensive fall-through must exit non-zero");
  });

  it("propagates a distinctive failure code verbatim (behavioral re-proof)", () => {
    const res = runStepScript(1, "exit 7");
    assert.equal(res.status, 7, "a distinctive audit failure code must be preserved, not masked to 0 or 1");
  });

  it("succeeds after retry-then-pass (behavioral re-proof)", () => {
    const stateFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "audit-gate-")), "attempts");
    const res = runStepScript(2, `n=$(cat ${JSON.stringify(stateFile)} 2>/dev/null || echo 0); n=$((n+1)); echo $n > ${JSON.stringify(stateFile)}; [ "$n" -ge 2 ]`);
    fs.rmSync(path.dirname(stateFile), { recursive: true, force: true });
    assert.equal(res.status, 0, "retry then pass must succeed");
    assert.match(res.stdout + res.stderr, /audit passed on attempt 2/);
  });

  it("the default audit command is the register-aware checker (never a silent suppression path)", () => {
    const script = readScript();
    assert.match(script, /ci-audit-check\.mjs/, "the default command must apply the documented exception register");
    const checker = fs.readFileSync(CHECKER, "utf8");
    assert.match(checker, /OWNER_ACCEPTED/, "the checker must print owner-accepted exceptions (never silent)");
    assert.match(checker, /PROPOSED|REJECTED/, "the checker must block on pending/rejected exceptions");
    // No advisory allowlist / suppression flags in the audit gate chain
    // (scoped to the audit step + script: the install step's legitimate
    // --ignore-scripts flag is not an audit suppression).
    const step = extractAuditStep(readWorkflow());
    for (const [label, text] of [["audit step", step], ["step script", script]]) {
      assert.doesNotMatch(text, /--ignore|--allow(?:list)?\s/, `no advisory allowlist or suppression flags may exist in the ${label}`);
    }
  });

  it("static shape: no continue-on-error anywhere; triggers, frozen install, and full verification preserved", () => {
    const text = readWorkflow();
    assert.doesNotMatch(text, /continue-on-error/, "no step may continue on error");
    assert.ok(text.includes("- main"), "the push filter must remain a valid branch list containing main");
    assert.ok(text.includes('tags: ["v*"]'), "tag triggers must be preserved");
    assert.ok(text.includes("pull_request:"), "pull_request trigger must be preserved");
    assert.ok(text.includes("pnpm install --frozen-lockfile --ignore-scripts"), "frozen install must be preserved");
    assert.ok(text.includes("pnpm check"), "the full verification step must be preserved (lint is enforced inside pnpm check — F-05c)");
  });
});
