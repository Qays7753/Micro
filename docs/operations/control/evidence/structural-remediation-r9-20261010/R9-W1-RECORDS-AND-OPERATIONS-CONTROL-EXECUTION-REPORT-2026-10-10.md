# R9-W1 — Records and Operations Control Execution Report (2026-10-10)

**Program:** WS-216 / ARCH-007 — Structural Remediation R0–R10, wave R9 (W1).
**Executor:** Z AI (primary, single writer).
**Branch:** `refactoring/r9-complete-w1-w2-w3-20261010` from base
`8b3c9aeb09ca33ed66f0a929c157b668839d0463` (= live `origin/main` at claim time;
verified: `git fetch origin --prune`; `git rev-parse origin/main`).
**Wave type:** documentation / evidence / Operations Control only — **no code, test,
script, CSS, DOM, or product change** (verified by the diff inventory below).

---

## 1. Live baseline verification (before any write)

| Check | Result |
|---|---|
| `git fetch origin --prune` | exit 0; main advanced `1e267864` → `8b3c9aeb` in the fetch (R8 merge + reconciliation now visible) |
| `git rev-parse origin/main` | `8b3c9aeb09ca33ed66f0a929c157b668839d0463` — matches the expected baseline exactly |
| `git log -n 15 --oneline origin/main` | R8 merge `87274cf9` (parents `1e267864`+`7a928fac`) and reconciliation merge `8b3c9aeb` (PR #346, `5e40a610`) confirmed in sequence |
| Open PRs (GitHub API `GET /repos/Qays7753/Micro/pulls?state=open`) | exactly one: **#344** (docs/r8-zai-execution-prompt-20261010 → main, docs-only, untouched per instruction) |
| CI on `8b3c9aeb` (API `actions/runs?head_sha=…`) | run `38061919149` — completed/**success** on the exact SHA (push event) |
| CI on `87274cf9` | run `38060781329` — completed/**success** |
| Existing R9 branch | none (`git ls-remote --heads origin | grep -i r9` empty) |
| Protected UI branch | `docs/ux-ui-zed-handoff-20260921` present, untouched |
| Worktree | clean before W1 (`git status --short` empty) |

**No STATE_DRIFT.** The preflight was confirmed complete (not started before this
prompt's baseline) and the preflight artifacts (canonical findings + five-reviewer
package) were recovered from the preflight session's workspace and are now preserved
in-repo (see §3).

## 2. Gate A — five read-only reviewers (before W1, on `8b3c9aeb`)

| Reviewer | Verdict | Key output folded into W1 |
|---|---|---|
| 1 — Architecture & ownership | APPROVE | All N1/N2 facts reproduced live (52/57 keys-sites, 759 rows, 945 census, 488 ratchet, 8b3c9aeb vs stale pointers); extended scope adopted: extra unmarked duplicates (§159×2, §160×2, Entry 47×2), dead registry/register rows, README/CONTROL/base_sha pointers, precise domain-test counts (36+1+1). |
| 2 — Storage/domain/recovery | REJECT **as designed** → corrected & adopted | RB-1's poison-record injection is invalid (it exercises a real latent defect rather than rollback). Redesigned to an async request-error injection. **Discovered R9-GA-F1** (HIGH): `replaceIndexedDbSnapshot` never aborts the readwrite transaction on a synchronous queueing throw — queued clears/puts auto-commit and destroy prior state (proven experimentally on fake-indexeddb 6.2.5, spec-conformant clone). Scheduled for W2 root-fix + regression tests. Also verified: async request-error rollback is faithful; Q-i's existing cursor-error test is real upgrade-abort rollback; `migrateTransferSnapshot` is in-memory re-derivation only. |
| 3 — UI/runtime & test boundary | APPROVE with corrections | Per-page W3 test targets enumerated (validation gates, honest failures, navigation/notification contracts, idempotency, derived-reading updates); **four page-boundary defects found and classified PROTECTED_DECISION_REQUIRED** (CashReversalEditor/InventoryReversalEditor swallowed storage failures; InventoryReversalEditor hardcoded exit; G5DeclarationEditor idempotency key omits `knowledge`) — W3 tests must not enshrine them; wouter `useSearch` mock must be made configurable for returnPath assertions; SharePreview surface-only rationale confirmed defensible. |
| 4 — Tests/CI/security/operations | REJECT **as commanded** → corrected & adopted | From repo root, `pnpm exec vitest run apps/…` exits 1 (root config includes only `tests/**`,`src/**`,`scripts/**`); all app-suite focused runs must use `pnpm --filter @micro/prototype-web exec vitest run …`. Ratchet exempts `test`-category files; the W2 fix target is a ratcheted production file → reanchor ledger entry required for its growth. validate.py exit 0 with two expected warnings (WS-170 historical base; gh CLI absent). CI auto-runs on PRs; no Cloudflare deploy job in ci.yml (Pages builds via the provider hook). check-secrets PASS; askpass credential path verified outside the repo. |
| 5 — Hostile evidence | APPROVE | All live-baseline claims confirmed (branch/PR/UI-branch/counts spot-checked); conditions adopted: canonical preflight artifact committed first (done), 43-vs-52 composition defined precisely (done: 36+10+6), post-merge back-fill protocol for run URLs AND machine outputs recorded (in the WS-216 next_action + this report), "six journey pages vs five stateful targets" phrasing fixed (N9). |

**Reconciliation:** Gate A passes with the five corrections adopted into the wave
plans; the two REJECTs were design/command-form rejections (not baseline rejections)
and their corrections are binding for W2/W3.

## 3. W1 executed work (finding by finding)

- **Canonical preflight preservation (precondition):**
  `R9-PREFLIGHT-CONSOLIDATED-FINDINGS-CANONICAL-COPY-2026-10-10.md` (the accepted
  finding set N1–N10 + Q-h/Q-i + five-page obligation, with live re-derivations) and
  `preflight-review-package/` (the five preflight reviewer reports + five preflight
  command logs, preserved verbatim; reviewer-file SHA-256 recorded in the copy).
  No `R9-PREFLIGHT` file existed in the tree before (verified `git ls-tree -r
  origin/main`; `rg -l "R9-PF"` → empty) — no duplicate source of truth created.
- **R9-PF-N1 (FIX_NOW):** registry — doors row corrected to the live
  **52 keys / 57 sites** with the full chain (120→43 STR-615→42 R5/S1→43 R7-1→46
  R7-2→49 R7-3→52 R7-4/R7-5; composition 36 composition-root + 10 R7 view-model +
  3 R7-5 g5-swap + 3 presentation edges predating R7 — Gate-B corrected; the 7 frozen shims
  removed by R7-5 `bfa48d44`), doorless houses
  corrected to the live **7** (direct-sales, financial-analysis, formatting, identity,
  owner, profile, recurring), §3م wave-head house re-count paragraph appended
  (146 prod + 141 test across 36 houses; per-house deltas listed), version → v1.4.
  Register — §1 wave-head re-measurement block (§2 = **759 rows** @ true split
  682/49/13/8/3/4 — never re-summed after R7; full-scope live census **945 files**
  @ production 428/test 396/script 62/generated 7/fixture 30/config 22; git-tracked
  1,585; ratchet v2 **488** @ 413/52/14/9; the 945−759 delta governed by the ratchet
  per §6/STR-607), the eight dead R7-5-removed shim rows annotated (not deleted),
  **first §2 rows for the ten R7-created view-model files** (measured live:
  financeState 270, financialEventEditorModel 209, directSaleEditorModel 184,
  inventoryMovementEditorModel 136, orderDetailViewModel 128,
  supplierPurchaseEditorModel 106, ownerEntitlementViewModel 73, statementViewModel 70,
  scheduleViewModel 63, inventoryMaterialsViewModel 49 nbLOC), the R8-2 dated-note
  band split corrected to the live 413/52 (totals equal at 488), the craft-order
  card's stale line-refs superseded (live :1195/:1334/:1411/:1429/:1506). Test map —
  §1 corrected to the live **36** `tests/domain/` files + 1 root + 1 colocated and
  **331** adjacent `client/src` test files (+2 app scripts), v1.1.
- **R9-PF-N2 (FIX_NOW):** `WS-216.json` `verified_on_main_sha` repaired
  `74908e13…` → `87274cf9…` (the R8 implementation merge verified on main by CI
  `38060781329`; the R8 post-merge reconciliation `5e40a610` had updated
  `merge_sha`/`base_sha`/`pr` and missed this field — R7 precedent `86f8bec9` moves
  both). Workstream claimed for R9: `branch` =
  `refactoring/r9-complete-w1-w2-w3-20261010`, `base_sha` = `8b3c9aeb…`, `pr` = null
  (until the single PR is opened), `next_action`/`notes`/`evidence`/`updated_at`
  updated. `ARCH-007.json` `next_action` + `evidence` + `updated_at` updated. All
  generated views regenerated through the official generator (never hand-edited).
  `current-state.md` live fields: main pointer → `8b3c9aeb` + CI `38061919149`,
  status → R9 W1–W3 in progress, R8 bullet carries the #346 reconciliation merge
  (size-guarded: 20,414/20,480 B).
- **R9-PF-N3 (FIX_NOW, append-only):** state-log **§166** (enumerates the unmarked
  duplicates §159×2, §160×2, §161×2 with their canonical readings and the
  numbering-from-live-tail rule) and worklog **Entry 80** (same correction for
  Entry 47×2 / Entry 76×2 + the R9/W1 record). No history rewritten; next numbers
  are §167 / Entry 81.
- **R9-PF-N4 (FIX_NOW):** `R8-N1-CANONICAL-EVIDENCE-ANNEX-2026-10-10.md` committed
  under the R8 evidence directory — the exact final-head verification URLs (PR-head
  CI `38059908849`, Cloudflare check-run `114236114902`, post-merge runs
  `38060781329`/`38061919149` with their SHAs), the reproduced precache inventory
  (156/156/0 with category breakdown, regenerated from a real build at the W1 head),
  the before/after unique-set comparison (provenance-labeled from the PR body; the
  pre-fix build is not rebuildable without reverting the fix), the verbatim post-fix
  guard output, and the N7 bounded-preserve record. Added to the WS-216/ARCH-007
  evidence arrays.
- **R9-PF-N5 (FIX_NOW):** a new dated correction block appended under the migration
  plan's §23.8 (R7/R8 VERIFIED_ON_MAIN with merge SHAs; R9 accepted scope; the old
  addendum text untouched — F-026 precedent). Status lines advanced with dated
  corrections: successor plan (`R9_PREFLIGHT_GATE` → remediation in progress),
  execution contract (status + current-phase), refactoring README (status + phase),
  REFACTORING-CONTROL v1.19 (header + status + phase + §14 live step).
- **R9-PF-N6 (FIX_NOW):** §4.3.1 row `check-acceptance-value-anchors` updated to the
  live proven surface (4 consumption sites + 2 canonical lists + 6 GUARDED_UNION
  families double-pinned — 11 SITES entries).
- **R9-GA-F6 (FIX_NOW, same pass):** §4.3.1 row `check-bundle-surfaces` proves-column
  extended with the R8-N1 hard guarantee (zero duplicate precache URLs;
  `DUPLICATE_PRECACHE_URLS` fail-closed on every real build).
- **R9-PF-N7 (PRESERVE, bounded):** the theoretical precache completeness blind spot
  recorded with owner/trigger/evidence-format/exit condition in the N4 annex §5
  (plus the narrower revisionless-entry residual from the hostile review).
- **R9-PF-N8..N10 (informational, PRESERVE):** recorded with precise live values in
  the canonical copy (layer/test corpus counts; journey-depth facts incl. the
  CashWalletEditor read-back depth note addressed by W3; parity cautions — 9/16
  in-lens rejection depth, contract-39 req-4 UI location, EXE-014 backup handed to
  caller, forward-only upgrades, counting-convention drift).
- **R9-GA-F3 (reported, protected):** the four page-boundary defects found by Gate A
  are recorded in `R9-REPAIR-CARDS.md` as PROTECTED_DECISION_REQUIRED packages
  (exact change + reason each); W3 will not enshrine them.
- **R9-GA-F2 (PRESERVE by design):** generic Arabic failure message at transaction
  error time is intentional (AGENTS §10 rule 9 — no raw error text; `storage_error`
  code preserved).
- **R9-GA-F4 (adopted):** all focused-check command forms corrected to
  `pnpm --filter @micro/prototype-web exec vitest run …` for app suites.

## 4. Files changed (complete inventory)

Modified (15): `OWNERSHIP-AND-TRUTH-REGISTRY.md`,
`FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md`, `TEST-AND-DOCUMENTATION-MAP.md`,
`REFACTORING-PLAN-A-TO-Z.md`, `REFACTORING-ARCHITECTURE-AND-MIGRATION-PLAN.md`
(append-only §23.8 block — historical-record exception, F-026 precedent),
`STRUCTURAL-REMEDIATION-PLAN-20261007.md`,
`ZAI-STRUCTURAL-REMEDIATION-R0-R10-EXECUTION-CONTRACT-20261007.md`,
`REFACTORING-CONTROL.md`, `README.md`, `AGENT-SEQUENTIAL-WORKLOG.md` (Entry 80),
`current-state.md`, `current-state-log.md` (§166), `WS-216.json`, `ARCH-007.json`,
and the regenerated views (`generated/ACTIVE-WORK.md`, `generated/AGENT-BRIEF.md`,
`generated/MASTER-TRACKER.csv`, `generated/MASTER-TRACKER.xlsx.meta.json`).
Added: the R9 evidence directory (canonical copy, repair cards, this report,
`preflight-review-package/` = 5 reviews + 5 logs) and the R8 evidence annex.
**Explicitly not changed:** every file under `src/**`, `apps/**` (code/tests/config),
`scripts/**`, `.github/**`; PR #344; the protected UI branch; all ceilings and
versions.

## 5. Verification record (commands and exit codes)

| Command | Result |
|---|---|
| `python3 scripts/operations-control/generate_tracker.py` | views current (exit 0) |

> **Dated correction 2026-10-10 (Gate B, R9-W1-B):** the exit table above was recorded
> mid-wave, before the final JSON evidence-array additions; at the first committed W1
> head (`80a3c64b`) the Excel provenance digest was therefore stale — `validate.py`
> and `generate_tracker.py --check` exited **1**, and the five preserved `*.log.txt`
> files carried EOF blank lines (`git diff --check` exit 2). Gate B rejected the head
> on exactly these grounds. The correction commit re-refreshed the Excel meta from the
> final source state, trimmed the log EOFs, corrected the 52-key decomposition
> (36+10+3+3), and re-verified: `validate.py` exit 0, `generate_tracker.py --check`
> exit 0, `git diff --check` clean, test-map no drift. The corrected W1 head is the
> commit carrying this note; the record above stands as the mid-wave measurement with
> this correction as its completion.
| `python3 scripts/operations-control/generate_tracker.py --refresh-excel-meta` | Excel provenance refreshed (exit 0) |
| `python3 scripts/operations-control/validate.py` | exit 0 (warnings: WS-170 historical base_sha — expected; gh CLI unavailable — API used instead) |
| `python3 scripts/operations-control/generate_tracker.py --check` | exit 0 |
| `node scripts/check-doc-index-coverage.mjs` | catalog coverage complete (exit 0) |
| `node scripts/check-current-state-size.mjs` | live contract intact — 20,414/20,480 B (exit 0) |
| `git diff --check` | clean (exit 0) |
| `node scripts/generate-test-map.mjs` | wrote (pages 60, contracts 49) |
| `node scripts/generate-test-map.mjs --check` | no drift (exit 0) |
| `pnpm exec vitest run scripts/generate-test-map.test.mjs` | 1 file / 3 tests passed |
| `pnpm --filter @micro/prototype-web build` (W1 head, before commit) | exit 0 — guard chain PASS; entry 629,300/154,683; precache 156 (2,672,243 B); swRuntime 2 (26,170 B) — identical to the R8-N1 baseline (docs-only W1 diff; the build was run to reproduce the N4 annex inventory) |
| `node scripts/check-secrets.mjs` (via Gate-A reviewer + will re-run in full check) | PASS |

## 6. Counts reconciliation table (preflight shorthand → live, reproducible)

| Preflight number | Live value (command) |
|---|---|
| 43 keys (registry) | **52** (`python3 -c "import json;print(len(json.load(open('scripts/ui-application-import-baseline.json'))['allowed']))"`) |
| 47 sites | **57** (`node scripts/check-module-boundaries.mjs` output line) |
| 757 rows (register §1) | §1 historical at R6-W1; live §2 table = **759** (`awk '/^## 2\./,/^## 3\./' … \| rg -c "^\| \\\`"`) |
| (live census) | **945** scope files (git ls-files + ratchet `category()`; production 428 / test 396 / script 62 / generated 7 / fixture 30 / config 22) |
| 488 | **488** ratchet v2 measurements (`python3 -c "…file-size-ratchet-baseline.json…measurements"`) @ 413/52/14/9 |
| 51 (WATCH) | **52** WATCH (live baseline measurements; the register's R8-2 note said 51 — corrected with a dated note) |
| 34 domain tests (map doc) | **36** in `tests/domain/` + 1 root + 1 colocated (test-map `domainTestLocations`) |
| 298 adjacent (map doc) | **331** (`git ls-files 'apps/prototype-web/client/src' \| rg "\.test\.(ts\|tsx)$" \| wc -l`) |
| 55/5 page classes | **55 direct / 5 named-reference** (unchanged; `--check` no drift) |

## 7. Acceptance gate (W1)

- [x] N1–N6 root-fixed (live-reproducible counts; exact fields; append-only
      numbering; canonical annex; dated corrections; metadata rows) — N7–N10
      recorded precisely without inflating defect counts
- [x] N2 names the correct live fields and the R7-precedent convention; no future
      SHA faked (post-merge action recorded in `next_action`)
- [x] R8-N1 material evidence in a canonical repository path (annex + evidence arrays)
- [x] no historical evidence deleted or rewritten (append-only corrections; the diff
      shows additions only in the logs)
- [x] JSON source updated before generated views; views regenerated by the generator
- [x] validator / tracker-check / doc-index / size guard / `git diff --check` all pass
- [x] five reviewers recorded at Gate A on the exact pre-W1 SHA; corrections adopted
- [x] this report records files, counts, commands, exits, and rollback

## 8. Rollback boundary

Revert the W1 commit (docs/evidence only). No code, data, schema, export, or user-
facing impact; Operations Control views regenerate from the JSON sources.

## 9. Status

`R9-W1 COMPLETE — GATE B NEXT (five reviewers on the W1 head, then W2)`
