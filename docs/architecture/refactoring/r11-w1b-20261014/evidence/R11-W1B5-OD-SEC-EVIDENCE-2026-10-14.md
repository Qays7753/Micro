# R11 W1b-5 — OD-SEC Known-Limit Documentation and Recurring History-Scan Workflow — Evidence

**Artifact ID:** R11-W1B5-OD-SEC-EVIDENCE-2026-10-14 | **Slice:** W1b-5 | **Date:** 2026-10-14 (UTC) | **Executor:** ZAI (single W1b writer)
**Decision authority:** OD-SEC (`OWNER_APPROVED — A_PLUS_C — NON_BLOCKING_RECURRING`) in the R11 owner decision package; D-16 / R10B-NF-025 in the crosswalk; executed under the canonical W1b execution prompt slice W1b-5.
**Base SHA:** `0ede6e941a7ec276baf1594febb34e2d4ebf14ee` (branch base)

---

## 0. Status

```text
W1B5_OD_SEC — VERIFIED
PATTERN_TABLE — UNTOUCHED (15 content patterns + 6 file-name rules, shared mechanically)
S0_EVIDENCE — PRESERVED INTACT (referenced, not rerun for a new claim)
WORKFLOW_DRY_RUN — EXECUTED, ZERO_FINDINGS, exit 0 (command-shape proof)
FIRST_PLATFORM_RUN — NOT_EXECUTED (first scheduled/dispatched run on GitHub Actions; no claim)
```

## 1. The documented limitation (guard header + security reference)

- `scripts/check-secrets.mjs` — the F-027 header section now states explicitly that this guard scans **the live working tree only** and does not prove absence of secrets from Git history or packfiles, and points to the two approved history channels: the preserved one-time S0 scan (canonical evidence path) and the new recurring workflow. Comment-only change; the pattern table (15 content patterns + 6 file-name rules), first-match behavior, redaction, and output sanitization are byte-untouched (guard re-run PASS; the scanner's pattern-sharing test still pins the mechanical import). Ratchet ledger entry `R11-W1B5-OD-SEC-DOCUMENTED-LIMIT` (204→213 nbLoc, ocRef ARCH-009).
- `docs/quality/security-boundaries.md` §5 — the same limitation + both channels + the workflow's least-privilege properties and notification semantics, worded as the repo's security reference requires (implemented-and-tested behavior only).
- Note on the prompt's "nine-pattern scanner" phrasing: the live shared table counts **15 content patterns + 6 file-name rules** (21 rules); the operative mandate — preserve the table unchanged — is what this slice executes and verifies. The count is recorded here for future reconciliation.

## 2. The recurring workflow (`.github/workflows/history-secret-scan.yml`)

| Property | Value (as wired) |
|---|---|
| Triggers | `schedule` (monthly, 06:00 UTC on the 1st) + `workflow_dispatch` — **never** on pull_request/push (non-blocking by design) |
| Permissions | `contents: read` only — the single permission scope; no write token; `persist-credentials: false` |
| Actions | exactly one: `actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4` — the same full-SHA pin approved in `ci.yml` |
| Scan | fresh `git clone --mirror` of the public repo (anonymous read; all refs incl. `refs/pull/*`), bare-repo assertion, then the canonical scanner `node scripts/security/scan-git-history-secrets.mjs <mirror> --report <json>` |
| Output | fingerprint-only/count-only sanitized JSON (the scanner's own redaction assertion aborts on any leak); the report step prints the counts summary + the JSON, and runs `if: always()` so the report is visible after a failed scan too (informational only — the scan step already failed the run) |
| Failure semantics | the scanner's exit codes drive the job: 0 green / **1 findings → red** / **2 scanner error → red**; no step masks a failure as success (no continue-on-error anywhere — pinned by test) |
| Notification | the run status itself (red, visible to the owner, GitHub's default email for failed scheduled runs); **no** auto-issues, **no** PR comments — both would need write scopes this workflow deliberately does not hold |
| Concurrency/timeout | `history-secret-scan` group (no cancel-in-progress) + 20-minute timeout (mirrors repo conventions) |
| History/credentials | no history rewrite, no rotation, no working-tree guard change — read-only everywhere |

## 3. Adversarial self-tests

- **Existing scanner suite (14/14, unchanged, re-run green):** planted-then-removed secret (deleted files) with redaction; clean-repo ZERO_FINDINGS; sensitive blob paths (`id_rsa`); commit-message detection with runtime-built fake tokens; cat-file-framing-mimic content; redaction checker; non-reversible stable fingerprint; pattern-table sharing with the working-tree guard; CLI exit codes 0/1/2; the five R11-REV adversarial regressions (blob alias paths ×2; 0x1e/0x1f commit-message bytes ×2; framing-mimic messages).
- **New workflow-shape suite (`scripts/security/history-secret-scan-workflow.test.mjs`, 7/7):** non-blocking triggers (no pull_request/push); exactly one permission scope (`contents: read`), no `${{ secrets.* }}` consumption, no GITHUB_TOKEN manipulation; every `uses:` is the checkout action pinned by the exact SHA approved in ci.yml with `persist-credentials: false`; no continue-on-error anywhere and the canonical scanner invocation with `--report`; fresh `git clone --mirror` + bare assertion (and no `fetch-depth: 0` — the scanner checkout needs no history); no issue/PR/notification API calls; no pattern literals embedded in the workflow (the table is never copied).

## 4. Controlled dry run (workflow-proof execution — the contract's permitted case)

`evidence/R11-W1B5-OD-SEC-WORKFLOW-DRYRUN-2026-10-14.json` — the **exact workflow scan command** executed end-to-end on 2026-10-14 (node v24.21.0 / git 2.47.3, anonymous public clone):

- fresh `git clone --mirror https://github.com/Qays7753/Micro.git` → bare-repo assertion passed;
- `node scripts/security/scan-git-history-secrets.mjs <mirror> --report <out>` → **exit 0, `ZERO_FINDINGS`, `REDACTION_ASSERTED`**;
- scanned: **368 refs** (incl. the live W1b branch and PR #364/#365 head+merge refs), **1,590 commits**, **10,920 trees**, **10,942 blobs**, **11,096 blob-path entries**, 0 annotated tags;
- pattern source: the working-tree guard's shared table (mechanical import).

The S0 one-time evidence is preserved intact and referenced; this dry run creates **no new cleanliness claim beyond the command-shape proof** — the authoritative first platform execution is the workflow's first scheduled/dispatched run on GitHub Actions (`NOT_EXECUTED` here; honestly recorded in the artifact).

## 5. Verification matrix

| Check | Result |
|---|---|
| Scanner self-tests | **14/14 PASS** (unchanged) |
| Workflow-shape tests | **7/7 PASS** (new) |
| Working-tree secrets guard | PASS — 1,722 files, 0 patterns (table untouched) |
| File-size ratchet | PASS with documented ledger entry `R11-W1B5-OD-SEC-DOCUMENTED-LIMIT` |
| Dry run | **ZERO_FINDINGS, exit 0** (§4) |
| YAML sanity | the shape suite's structural pins + the dry run of the exact commands; GitHub's own workflow parser validates on the first platform run (recorded as the standing `NOT_EXECUTED` aspect) |
| Production behavior | **zero production lines** — this slice touches the guard header (comment), the security doc, the new workflow, the new test, and records only |
| Emitted JS | unchanged (no production file touched) |

## 6. Rollback boundary

Revert this slice's commit to remove the workflow, the shape tests, the documentation paragraphs, and the dry-run artifact; the guard returns to its prior header (the ledger entry travels with the revert). Nothing else depends on the workflow.
