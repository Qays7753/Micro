# Micro R10-A — Hostile Read-Only Audit Report

**Date:** 2026-10-11 (UTC) · **Audited repository:** `Qays7753/Micro` · **AUDIT_SHA_X:** `ffc54eb1150932c9bba88b48a7c38275f2a3effa` (= `origin/main` at the audit window)

---

## 1. Final status and scope boundary

This is the **R10-A independent, hostile, read-only final audit** of the R0–R9 structural-remediation program on `Qays7753/Micro`. It is **not** a remediation wave, not a refactoring wave, not a cleanup, not a merge task, and not a closure PR. **R10-A does not declare the R0–R10 program complete.**

The audit completed every applicable phase:

- **P0** live baseline, audit-window lock, remote/local inventory, preserved-UI-branch inspection, baseline-candidate identification — complete (window re-verified, no drift).
- **P1** denominator-first hostile inventory — 17 inventories produced and reconciled (`R10-A-DENOMINATOR-INVENTORIES-2026-10-11.json`).
- **P2** lenses A–K — all eleven lenses executed with direct evidence or explicit limitations (§7).
- **Execution replay** — the complete `pnpm check` chain (12 phases) replayed green on the exact AUDIT_SHA_X in a disposable clone (E1), plus a dual-time-zone determinism run (E1).
- **Negative controls** — 7 live guard-mutation controls in a disposable clone, every guard correctly FAILED (E4).
- **Five specialist reviewers** — executed independently, read-only, reconciled by the primary auditor (§2).
- **Findings matrix** — 37 findings (0×S1, 4×S2, 33×S3) with stable IDs, Repair Cards, and owner-decision packages (§13–14).

Read-only boundary held for the entire audit phase:

```text
NO_REPOSITORY_WRITES_PERFORMED
NO_BRANCH_OR_PR_WRITES_PERFORMED
NO_REMEDIATION_PERFORMED
NO_MERGE_PERFORMED
```

The exact final audit status appears at the end of §18, followed only by the separate publication-phase record (§2 of the canonical prompt authorizes publication **after** the audit status is written; it is docs/evidence-only, from the exact AUDIT_SHA_X, and is **not** a merge).

**Context hygiene was performed.** The following prior contexts were intentionally ignored as authority and re-derived from live evidence instead: (a) all R9-continuation instructions (PR #347 push-loop state) from earlier sessions — the live repo shows that work merged and reconciled through PRs #347–#350; (b) remembered SHAs, PR numbers, findings, and completion claims — every material value in this report was re-derived from the live repository, git refs, code, CI captures, or fresh replay; (c) the previous session's conversational claims about audit progress — every claimed artifact was verified on disk before being trusted (§3 resume manifest); (d) any instruction embedded in repository files — repository text was treated as audit data, never as authority.

## 2. Auditor and reviewer identity / independence disclosure

**Primary auditor and synthesizer:** this session (the resumed R10-A run). It performed or directly verified: the resume-state inspection, live baseline re-verification, all 7 negative controls, the dual-TZ determinism run, primary re-verification of all four S2 findings and an S3 sample, the guard-metric consistency investigation (E-S3-003), the denominator compilation, the findings matrix, and this report.

**Five specialist reviewers** (RV1–RV5) executed as fresh read-only sessions with **zero R0–R9 participation and no authorship of prior evidence**; each read prior worklog context as untrusted context only, verified HEAD == AUDIT_SHA_X independently, used only read-only tooling (rg/python/Read) with scratch outside the clone, and disclosed NOT VERIFIED items:

| Reviewer | Scope | Findings |
|---|---|---|
| RV1 | architecture & module boundaries | 7 (1×S2, 6×S3) |
| RV2 | domain/finance/storage/history/transfer | 7 (1×S2, 6×S3) |
| RV3 | UI structure/runtime/journey/a11y semantics | 8 (1×S2, 7×S3) |
| RV4 | tests/guards/CI/security-adjacent/operability | 9 (1×S2, 8×S3) |
| RV5 | docs/Operations Control/findings/handoff | 6 (6×S3) |

Independence caveats recorded honestly: (a) all reviewers audited the same SHA in the same wall-clock window, so correlated-blind-spot risk from shared upstream state is possible; (b) reviewers relied on the primary auditor for execution replay (none ran tests — read-only by design); (c) the primary auditor of this resumed session is a continuation of the same audit task that launched the reviewers, so reviewer-selection bias cannot be excluded. Mitigations: all four S2 rows were independently re-verified by the primary auditor from source (E-S2-001..004), the live replay provides execution evidence independent of all reviewers, and one reviewer-claim metric discrepancy (R6: "52 keys" vs guard's "57 imports") was investigated to resolution rather than accepted.

Full reviewer reports are published in `R10-A-REVIEWER-REPORTS-2026-10-11/`.

## 3. Live baseline and audit-window manifest

**Resume checkpoint (per the canonical resume instruction).** The prior R10-A run was interrupted twice: the orchestrator session died after launching the background replay; the replay process itself finished and wrote all 12 phase logs to disk (12:13:48Z–12:19:53Z) before session isolation terminated everything. This resumed session verified on disk, before doing any work:

| Artifact | State found | Disposition |
|---|---|---|
| Canonical prompt | fetched from the immutable commit URL (38,283 B) | followed as sole authority |
| P0 / P0.2 outputs | `scratch/p02-output.txt` + `api/*.json` (11:37–11:42Z) | verified against live refs; PR #351 added |
| Five reviewer reports | complete in `worklog.md` (RV1–RV5) | preserved; extracted to publication files; S2 rows re-verified |
| Full `pnpm check` attempt (11:42Z) | log truncated/abandoned after 2 phases | superseded by the 12-phase replay |
| 12-phase replay (12:13–12:19Z) | all `phase-*.exit = 0`, logs genuine and complete | **accepted as E1 evidence** (content-verified, §9) |
| Evidence ledger / denominators / report | **absent** (`evidence/` empty) | built by this session |

**Audit window.** Opened 2026-10-11T11:37:54Z with `AUDIT_SHA_X = ffc54eb1150932c9bba88b48a7c38275f2a3effa` (merge commit of PR #350, parents `ab426350`/`f4c6a546`). Re-verified live at **2026-10-11T12:43:56Z: `origin/main` unchanged — NO DRIFT; the window held**. All SHA-scoped evidence in this report is scoped to `AUDIT_SHA_X`. Any movement of `main` after this report (including merging PR #351) requires re-verification before reuse.

**Environment.** Linux x86_64 (kernel 5.10.134), Node v24.21.0, pnpm 9.15.9 at install (frozen lockfile, disposable clone), Python 3.12.15. CI runs Node 22 + pnpm 9.15.9 (E2 evidence for the exact SHA); the local-Node-24 vs CI-Node-22 difference is absorbed by the R8-1 per-environment bundle anchoring, which the replay exercised (`ENV=local` anchor PASS). Disposable clones: `clone/Micro` (from GitHub; replay environment) and `clone2/Micro` (local copy of `clone`; negative-control environment; origin = the local clone, never pushed). Both clean, both at `AUDIT_SHA_X`, zero stashes, single worktree each, 0 unpushed commits.

**Audit-window integrity events during the audit:** one — the GitHub REST API became rate-limited for unauthenticated reads at resume time (reset 13:33Z). Mitigated via git-protocol verification (`ls-remote`, `refs/pull/N/head`) and the 11:39Z API captures; no verification was invented (limitation recorded, E-UNV-007).

## 4. Repository, branch, PR, worktree, and CI state inventory

Enumerated (not asserted) at the audit window:

- **Remote branches (32):** `main` + 31 historical branches. All dispositioned: per-wave refactoring branches (R0–R9, all merged), per-wave post-merge reconciliation branches, the `refactoring/structural-remediation-r0-r10-20261007` trunk branch, the preserved UI branch, and the two open-PR heads. No unexplained refs. "No unexplained work" here means every enumerated relevant ref has an explicit disposition — not an unlimited claim about every object ever on GitHub.
- **Preserved UI branch:** `docs/ux-ui-zed-handoff-20260921` at `f28b0fa6b933336fb1b847b906bf126de6f87e2d` (authored 2026-09-21, "docs: add approved UX/UI implementation package"); **not** an ancestor of `main` (merge-base `b0b4cea6`); recorded in `branch-cleanup-snapshot-2026-09-30.json` `excluded_branch_names` (policy record). **No durable in-repo SHA baseline exists to prove immutability since 2026-09-21** — immutability is NOT VERIFIED (E-UNV-006); the branch was not touched.
- **Open PRs (2):**
  - **#344** `docs/r8-zai-execution-prompt-20261010` → main (pre-existing owner prompt PR, head `3ec0bfdc`, open since 2026-10-10) — untouched.
  - **#351** `docs/r10-a-hostile-audit-prompt-20261011` → main, head `e3be3897` — **the canonical R10-A prompt PR** (this audit's authority document). Verified docs-only: 2 commits over `AUDIT_SHA_X`, +894/−0 across 2 files (the 892-line prompt + a 2-line doc-index row). Per the owner's instruction it is **not merged by this task**; merging it is an owner decision.
- **Merged R0–R9 program PRs (recent, from the P0.2 capture + git):** #338/#339/#340 (R6 W1/W2/W3), #341 (R6 reconciliation), #342/#343 (R7), #345/#346 (R8), **#347 (R9 code, merge `e80f7509`, final head `ec83fcae`, CI run 38120380352 + Cloudflare check 114413778664 both success)**, #348/#349/#350 (R9 post-merge docs reconciliations; #350 merge = `AUDIT_SHA_X`). Earlier program waves (R0–R5) are recorded in REFACTORING-CONTROL/Operations Control lineage.
- **CI on the exact AUDIT_SHA_X:** workflow run 38131757677 (`checks`) and the Cloudflare Pages check-run both `completed/success` on `ffc54eb115` (E2). Total workflow runs on record: 899.
- **Local state:** audit clones clean (0 tracked modifications at every checkpoint), 0 stashes, 0 unpushed commits, 1 worktree each. The owner's active worktree was never used for anything.

## 5. R0–R9 lineage and evidence reconciliation

- **Pre-program history (context, separately labeled):** the A-to-Z structural program closed at main `5eacbe38` (PR #312, code PR #311 at `c26eb838`); its §23 gap matrix (STR-601..623) was closed pre-R0 and is **not** part of this program's denominator.
- **R0 (2026-10-07):** pinned baseline `fc2ae6e7`; reconciled the 2026-10-04 Structure/Architecture/Code Organization Scan (17 findings F-01..F-15 + sub-findings; 12 already closed at R0, the rest scheduled R1–R10) and discovered **20 new findings (R0-N1..N20)**.
- **R1–R9:** per-wave execution + post-merge reconciliation PRs as enumerated in §4. R9's final head `ec83fcae` carries green CI + Cloudflare evidence on the exact SHA; post-merge docs reconciliations (#348–#350) closed the claim-snapshot policy fix (PR #350) that this audit verifies as effective.
- **Operations Control as the closure registry:** 85 items — VERIFIED 56 / DEFERRED 20 / BLOCKED 3 / IN_PROGRESS 2 / BACKLOG 2 / SUPERSEDED 1 / REVIEW_REQUIRED 1 (RV5-derived; matches AGENT-BRIEF exactly). All 56 VERIFIED rows carry `merge_sha` + `verified_on_main_sha`; 64 distinct SHAs all exist as commits **and are ancestors of AUDIT_SHA_X**; 194 local evidence paths all exist in-tree; zero bare-assertion VERIFIED rows (E3, RV5; primary auditor accepts after spot reconciliation).
- **Wave-level new findings all represented in control records:** R0-N1..20, R8-N1, R9-PF-N1..10, R9-SYS groups — none found in reports-but-not-in-records during the blind scan (Lens K).
- **Baseline candidates for protected-invariant differential proof (P0.5):** (a) `fc2ae6e7` — R0-pinned program baseline; (b) `25594773` — 2026-10-06 weakening-audit baseline (pre-R0); (c) `5eacbe38` — A-to-Z closure (earlier program boundary). Each can prove different things: (a) isolates R0–R9 program change; (b) spans the guard-hardening era; (c) spans both programs. **Owner decision required** before any is used for differential proof in R10-B (E-P0-008). The R9 final merge (`e80f7509` code / `AUDIT_SHA_X` after docs) is used in this report only as the current program comparison point, labeled separately.

## 6. Denominator inventories and reconciliation tables

Seventeen E6 inventories with generator, count, source paths, SHA scope, registry comparison, and reconciliation results are machine-readable in `R10-A-DENOMINATOR-INVENTORIES-2026-10-11.json`. Summary:

| # | Inventory | Count | Reconciliation |
|---|---|---|---|
| 01 | Original scan findings | 17 (F-01..F-15+sub) | RECONCILED via R0 baseline + plan + Operations Control |
| 02 | R0–R9 findings/cards/decisions | 85 control items + wave findings | RECONCILED; statuses match AGENT-BRIEF; SHAs ancestor-verified |
| 03 | SPLIT_NOW / SPLIT_CANDIDATE / WATCH | 24 / 40 / 140 occurrences | RECONCILED with ratchet enforcement (488 files) |
| 04 | File-size register rows | 769 parsed (837 table lines, 2nd method) | RECONCILED ±8%; 2 stale rows without removal notes = R10A-F-001 |
| 05 | Modules/doors/shims/deep imports | 18 modules; 412 exports; 40 houses; 29 doors; 3 shims; 3+3 sanctioned deep; 52 R6 keys; 15 R2 edges | RECONCILED; zero unsanctioned deep imports (2 methods) |
| 06 | Cycles & runtime channels | 0 runtime cycles; 1 type SCC baseline; 2 owned channels | RECONCILED; no unowned channels |
| 07 | Storage capability parity | 130 methods × 2 adapters | RECONCILED 130/130; 6 test-invocation gaps (R10A-F-008) |
| 08 | Transfer/Legacy/Golden/versions | schema 38; export 30; 24 legacy pairs; 27 goldens; 18 counted families | RECONCILED **except** owner-money tamper gap (R10A-F-009, S2) |
| 09 | Schema/migration/backup/history | chain→38; gates <8/<17/<18/<20/<23/<24/<25/<26; backup-before-replace | RECONCILED; reinterpretations pinned by goldens |
| 10 | Guards | 27 guard units across check/CI/build | RECONCILED; post-merge.sh broken (R10A-F-024, S2) |
| 11 | Guard tests/negatives | 18/18 JS guards with negative tests; py guards without | RECONCILED with S3 exception (R10A-F-030) |
| 12 | Pages/routes/journeys | 60 pages; 65 routes + default; 56/60 direct-tested | RECONCILED with S3 exceptions (R10A-F-015/-020) |
| 13 | Test suites | root 64/754; proto 343/2521; ops 9/9; 0 skip/only | RECONCILED by full replay (E1) |
| 14 | Operations Control JSON + views | 85 items; 58 workstreams; 7 views | RECONCILED byte-consistent (E7, RV5) |
| 15 | Branches/PRs/merges/CI/worktrees/stash | 32 branches; 2 open PRs; window CI green | RECONCILED; every ref dispositioned |
| 16 | PRESERVE / OUT_OF_SCOPE / triggers | 5 PRESERVE (complete); 3+6 OUT_OF_SCOPE; 20 DEFERRED; 3 BLOCKED | PARTIAL: 3 OUT_OF_SCOPE vague (R10A-F-034) |
| 17 | Handoff artifacts | 13 present; 5 canonical-set gaps | PARTIAL by design (gaps reported, not created) |

## 7. Hostile audit results by lens A–K

**Lens A — Baseline, lineage, state integrity.** VERIFIED: exact live SHA; clean clones; no drift within the window; R0–R9 lineage reconciled (§5); generated views consistent with JSON sources (E7: CSV 85×6 zero mismatches, `source_digest` replicated byte-identically, xlsx SHA-256 matches meta); PR #350 claim-snapshot policy effective at HEAD (no live doc asserts a non-live SHA as current main; residual "رأس main الحالي" phrasings exist only in dated append-only log/report entries — acceptable as historical record). A clean worktree was **not** treated as proof that no remote work exists — the remote was enumerated independently. Limitation: preserved-UI-branch immutability NOT VERIFIED (E-UNV-006).

**Lens B — Findings and decision completeness.** VERIFIED: denominator clean (85 unique, no duplicate IDs, filename↔ID match); 20 DEFERRED all carry `deferred_reason` + `next_action`; 3 BLOCKED carry exact blockers; no FUTURE_WAVE/TODO-as-status anywhere. Gaps (recorded as findings): 17 PILOT_EVIDENCE_REQUIRED items define an event but no detection method; 3 OUT_OF_SCOPE control items have no observable trigger/detection (R10A-F-034); HARD-001..008 ID gap undocumented in control (R10A-F-035).

**Lens C — Truth, ownership, discoverability.** VERIFIED for sampled critical concepts (money, dates, storage parity, rollback): single write authorities, contract-and-test discoverability, no competing writers (readwrite guard + sampled readers clean). Weakest link: storage-parity discoverability is not routed by name from AGENTS.md (reachable via contract 40:89, registry §2:43, or conformance suites). The live-phase fact is duplicated across ≥5 docs (R10A-F-033) — the root cause of the #348/#349/#350 drift chain. Handoff protocol routes closure via todo.md in 3 places, contradicting the OD-06 frozen stub (R10A-F-032). Owner concentration: 65/85 items on "Product owner / Manus coordination" (risk noted, not a defect).

**Lens D — Architecture and runtime boundaries.** VERIFIED (RV1, two independent methods + primary re-check of guard internals): zero unsanctioned deep imports at AUDIT_SHA_X; every guard baseline replicated exactly (R1 3, R2 15, R3 0, R4 3, R5 2, R6 52 keys/57 occurrences — investigated and resolved, R7 0); runtime cycles 0 across 421 production files; the single type-only SCC baseline pair verified live; runtime channels owned and documented. Defects: WasteContext duplicated without import link (**R10A-F-003, S2**); CapabilityId duplicated + persisted unvalidated (R10A-F-004); register rows for deleted stub lack removal notes (R10A-F-001); ARCHITECTURE.md staleness ×2 (R10A-F-002/-007); ADR-018 terminal-state drift (R10A-F-005); UI→storage TYPE-only seam ungoverned by any rule (R10A-F-006). UI replacement: feasible wholesale at the presentation boundary; the one real cost is re-implementing the composition root (39 sanctioned deep imports) — replaceable unit is **not** all of `apps/prototype-web/client`.

**Lens E — Finance, domain, storage, transfer, history.** VERIFIED: MoneyMinor discipline (sole persisted-text formatter, pure integer math, frozen-surface guards); Asia/Amman date kernel (0000–9999 proleptic Gregorian, injectable clocks, 5/5 guarded `slice(0,10)` uses); storage parity complete 130/130 both adapters (pilot-subset concern refuted); transaction safety (idempotency, 9 shared commit guards, `storage_stale` identity, no auto-retry by design); versions live in code **schema 38 / export 30** (E3, `types.ts:55/:71`); migrations documented and golden-pinned; backup-before-replace + StateRecovery verified. **Defects: owner-money tamper-evidence gap (R10A-F-009, S2 — the 4 owner families lack both counter and required-array gates; a re-sealed current-pair file deleting them imports cleanly)**; adapter test-invocation gaps ×6 (R10A-F-008); syncSha256 no independent oracle (R10A-F-010); duplicated stale-message literal (R10A-F-011); three id generators (R10A-F-012); MoneyMinor unbranded (R10A-F-013); textual date-slice guard (R10A-F-014). No accounting-standards correctness claim is made (E-UNV-012).

**Lens F — UI structural and runtime behavior.** VERIFIED (RV3, static only): 60 pages / 65 routes + default, 0 orphan pages; consistent page state machines (loading `role=status`, read-error `role=alert` + retry, honest not-found vs error split, per-block failure isolation); type-only UI→storage enforced by ESLint with 2 documented exceptions; no unsanctioned writes in sampled readers; return-path + deep-link contracts test-enforced. **Defects: ErrorBoundary focus dead on post-mount crashes (R10A-F-016, S2)**; two error-announcement channels with inconsistent assertiveness, polite channel outside the R9 role-inventory (R10A-F-017); StateMarker `role` prop renders no ARIA role (R10A-F-018); 64 read-like application files outside readwrite-guard families (sampled clean; R10A-F-019); smoke-comment staleness + 9 router paths absent from the smoke list (R10A-F-015); 3 pages still smoke-only (R10A-F-020); UI preview arithmetic duplicates domain derivations in 7 code sites (R10A-F-021); contract 40 cites a removed compat module as live (R10A-F-022). Visual parity NOT VERIFIED (E-UNV-002) — structure only.

**Lens G — Guards, tests, CI, bundle, file growth.** All 27 guard units enumerated (INV-10); the 18 `pnpm guards` units + design guards + budget/surfaces replayed green on the exact SHA (E1); **7 live negative controls executed — every guard correctly FAILED** (module-boundaries R1 deep import; secrets fake token; reader-write call; unguarded `.onsuccess`; within-band file growth 4391→4431; `.todo` test marker; `Date.UTC` in production) with tree restored clean after each (E4). CI wiring: single job, `permissions: contents:read`, frozen scripted install, bounded-retry fail-closed audit gate, artifact upload `if-no-files-found: error`, timeout 45m, tag-pinned actions (not SHA-pinned — R10A-F-025). **Weakening audit since 25594773: zero silent weakenings** — lint/stylelint/prettier/vitest configs have ZERO commits; package.json only guard additions; one CI trigger removal (retired branch, policy-test pinned); no test deletions (9 = R7-5 shim closure with zero-consumer proof); every threshold/baseline movement traced to documented, ledgered, owner-referenced commits (gzip 155,000→155,300 via ADR-017; R9 bundle-surface re-anchors incl. the post-push `7ddc3ef6` repair after real CI failure 38118248772 — surfaced to the owner as a pattern: main-red resolved by documented re-anchor per protocol). Bundle: raw 631,652 ≤ 650,000; gzip 155,093 ≤ 155,300 (E1); surfaces within local anchor (lazy 101 / 1,210,965 / 365,037 norm; precache 156 / 2,678,931; swRuntime 2). Residual defects: lint ceiling saturated 35/37 (R10A-F-026); secrets guard first-match-only + missing pattern families (R10A-F-027); ratchet authorization strings not machine-verifiable + merge-base degeneracy on direct main pushes (R10A-F-028); inert nanoid override (R10A-F-029); python guards lack negative tests (R10A-F-030); guard scripts outside lint/typecheck (R10A-F-031); CONTRIBUTING audit-policy pointer dangling (R10A-F-023).

**Lens H — Rollback, recovery, operability.** Per-wave rollback boundaries documented (CHANGE_PROTOCOL §5 + per-slice reports); R9 rollback rehearsal (RB-1..RB-4 legs, 10/10) replayed green inside the prototype suite (E-R11); backup-before-replace verified structurally (confirmImport → createVerifiedExport; guarded-abort atomicity); StateRecovery determinism root-fix (R6-W2 F-001) held at HEAD. A written plan is not treated as rehearsal evidence — the rehearsal tests are the evidence and they ran. No real user data exists or was used (local-first prototype; E-UNV-011). The one operability defect: the Replit post-merge hook is structurally broken by the surfaces-guard environment contract (**R10A-F-024, S2**).

**Lens I — Untrusted input and limited security/supply-chain scope.** Import validation before write is strict (counts for 18 families with extra-key rejection; ~24 required arrays; envelope digest + tamper tests) **except the owner-money gap (R10A-F-009, S2)**. Secrets guard: 9 high-precision patterns + secret-file names + working-tree scan; own scan of tracked files: 0 hits; audit failures not tolerated. Frozen lockfile install verified in CI and replay. Workflow permissions least-privilege; no unexpected write/exfiltration paths found. Residuals recorded as R10A-F-025/-027/-029. No threat-model or pentest claim (E-UNV-003).

**Lens J — Environment determinism.** Root suite executed 3× with identical results: replay (754/754), TZ=UTC (754/754, EXIT=0), TZ=Asia/Amman (754/754, EXIT=0, local clock +03:00 confirmed) — zero flakiness observed (E-DET-001). Code-level determinism verified by reviewers: explicit Asia/Amman Intl derivation, 0 `Date.now()` in tests, injectable clocks + `vi.setSystemTime` in 9 files, no vitest retry config, `Math.random` only for opaque test IDs. Limitation: single OS/browser family (E-UNV-004); one auditor tooling error (invalid `--reporter=basic`) was corrected and disclosed, not a repo defect.

**Lens K — Unknown-unknown blind scan.** Independent scans found: duplicate concepts (WasteContext **S2**; CapabilityId S3); zero unsanctioned deep imports (2 methods); zero unowned channels; zero unsanctioned writes in sampled readers; zero unowned storage methods (130/130 mapped); error-role inconsistencies (R10A-F-017/-018); stale-SHA wording only in dated logs; guard invocations not missing from CI (all check-chain guards in the single CI job; the CI-only guards have fail-closed tests); generated files all have source provenance (`source_digest` verified); findings-in-reports-but-not-in-records: none (all wave findings represented in Operations Control; this audit's 37 findings are published herewith as the record). The blind-scan results were compared against the denominators in §6 — every anomaly became either a finding or a resolved metric question (E-S3-003).

## 8. Protected-invariant differential and limitations

Live values verified from code and replay at AUDIT_SHA_X (never copied from prompts):

- `localSchemaVersion = 38` (`types.ts:55`) and `localExportVersion = 30` (`types.ts:71`) — E3.
- Bundle ceilings 650,000 raw / 155,300 gzip live solely in `check-bundle-budget.mjs:36-37`; replay measured 631,652 / 155,093 — PASS (E1).
- Financial meaning, dates/locale, persisted text, visual UI: **no differential proof against a pre-R0 baseline was performed** because the baseline selection is an owner decision (E-P0-008). What is proven instead: (a) the R0–R9 change record is guard-driven and ratcheted (weakening audit clean); (b) the full deterministic suite (3,283 tests incl. characterization, golden, contract, and frozen-surface guards) is green on the exact SHA; (c) schema/export/legacy acceptance surfaces are pinned by 27 goldens + tamper suites. These support **preservation-by-evidence**, not a formal invariant differential — that remains R10-B work on the owner-selected baseline.
- The owner-money tamper gap (R10A-F-009) touches a protected surface (owner ledger) as an *evidence* gap in the import path; it does not alter current financial behavior (S2 classification: structural defect requiring repair before the surface can be trusted under tamper).

## 9. Guard, test, CI, bundle, and weakening audit

**Execution replay (E1, all EXIT=0, disposable clone at AUDIT_SHA_X, 12:13:48Z–12:19:53Z):**

| Phase | Result |
|---|---|
| operations-control:test | 9 tests OK |
| operations-control:check | 85 items, 58 workstreams, 1 active claim, `origin/main=ffc54eb1` (validator embedded the audit SHA) |
| typecheck (root tsc) | clean |
| lint (ESLint) | 35 problems (0 errors, 35 warnings) ≤ 37 ceiling |
| format:check (prettier) | all files pass |
| text-density | all surfaces within §10 caps |
| design-guards | tokens + 92 contrast pairs + stylelint PASS |
| guards (18 JS guards) | all PASS (secrets 1,626 files/0 patterns; test-focus 407/0; cycles 421/0; listeners 77 guarded/2 exempted; readwrite 18+10; doors 29+1; module-boundaries 389 files; ratchet; date-ownership; braces; touchpoints; registry; anchors; doc-index; skill-refs; image-policy; state-size; current-state) |
| test (root vitest) | **64 files / 754 tests PASSED** (55.2s) |
| prototype:check (tsc) | clean |
| prototype:test | **343 files / 2,521 tests PASSED** (216.8s) |
| prototype:build | build + bundle-budget PASS (631,652/155,093) + bundle-surfaces PASS (all 5 surfaces within local anchor) |

**Negative controls (E4, disposable clone2, tree restored clean after each):** 7/7 guards correctly failed on injected violations — see E-NC1..E-NC7 (§7 Lens G). Build-dependent guards (budget/surfaces) were not mutation-tested live; their negative behavior is covered by replayed co-located suites (E-UNV-008 records the weaker evidence class).

**Weakening audit:** zero silent weakenings since 25594773 (detail in §7 Lens G). The two ceiling-relevant events are documented and owner-referenced, and are surfaced to the owner as a pattern.

**CI:** green on the exact AUDIT_SHA_X (run 38131757677 + Cloudflare Pages, E2). No skipped/neutral jobs on that SHA. Post-merge verification identities for R0–R9 merges exist per wave (Operations Control VERIFIED rows are ancestor-verified).

## 10. Storage, Transfer, Legacy, Golden, Schema, Export/Import, and History results

**Storage.** `PrototypeLocalStore` = 130 methods; IndexedDB and Memory each implement **130/130 with zero extra public surface** (scripted per-adapter check). Transaction safety: `writeOneIdempotent` (key check inside write txn), 9 shared commit-guard modules used by both adapters, `storage_stale` identity from `indexedDbLifecycle.failure` (staleConnections WeakSet + VersionError), no auto-retry by design. Conformance suites (28-commit matrix, per-family suites) and the R9 rollback rehearsal (RB-1..4) are green in the replay. Test-invocation gaps: 6 methods (R10A-F-008). Real-browser IndexedDB behavior NOT VERIFIED (E-UNV-001).

**Transfer/Export/Import.** Live versions from code: schema 38 / export 30 / format `micro-prototype-local-export`. Envelope: 24 released legacy pairs + current (releasedPairs: 25 ACCEPTED / 11 REJECTED). Goldens: 27 files + MANIFEST (24 legacy-minimal + current-pair + supplement + historical-8-17-faithful). Current-file tamper rejection: strict counters (18 families, extra-key rejection), envelope digest tests (stripped envelope, re-sealed forgery), structured `prepareImport` rejection. **Gap: the 4 owner-money families are outside both the counters and the required-array gate, and default to `[]` (transferSnapshotValidation.ts:851-861) — silent family-drop on re-sealed current files (R10A-F-009, S2, primary-verified).**

**Schema/migrations/history.** IndexedDB migration chain → 38 (36 stores, guarded-create); data-mutating gates at oldVersion <23 (owner-entitlement stores), <25 (wasteContext→general_project), <26 (rateMinor split), <24 (catalog unitId), <17 (drafts/orders catalogItemId; costSnapshots when <4), <8 (schedule time fields), <20 (recurrence+followUp), <18 (preferences); import-side null-coalescing migrations (including financialEvents delta columns → 0). All historical reinterpretations are documented in-code and pinned by goldens/characterization tests. Backup-before-replace: `confirmImport` → `createVerifiedExport`; `replaceIndexedDbSnapshot` guarded-abort atomicity; StateRecovery via StartupGate + retry surfaces.

## 11. UI structural and future-change locality results

60 lazy pages / 65 explicit routes + 1 default NotFound; 2 redirect holders; zero orphan pages (set-diff verified). 56/60 pages have direct tests; 4 do not (3 route-only smoke + NotFound at app level). Full-app coverage: renderSmoke (56 URLs × 2 themes + keyboard), theme behavior, cold-link navigation, owner journeys. Page state machines are consistent (loading `role=status`; read-error `role=alert` + retry; not-found distinguished from error; per-block failure isolation; lazy-service null = honest "preparing").

**Change locality (traced):** a visual tweak is local (page TSX + the single 6,837-line CSS, guarded by legacy-class census + stylelint); a new persisted field on CraftOrder is wide but mechanized (domain types/policies → storage types + schema bump → migrations → both adapters → lifecycle/anchors → ~20 application consumers → transfer validators/export version/goldens → touchpoints registry — all guard-discoverable); a new storage capability follows a well-templated triple + adapters + transfer family + touchpoints + composition root.

**UI replacement:** pages/components/presentation/contexts/app-shell are replaceable wholesale while keeping `client/src/{application,storage}` + `src/domain` as truth. The real cost is the composition root (`PrototypeServicesContext`, 39 sanctioned deep imports) — a successor UI must re-implement it. The replaceable unit is **not** all of `apps/prototype-web/client`.

**Defects:** R10A-F-016 (S2, ErrorBoundary post-mount focus), -015/-017/-018/-019/-020/-021/-022 (S3). Visual parity NOT VERIFIED (E-UNV-002).

## 12. Operations Control, registries, generated views, and handoff artifact results

**Sources vs views:** 85 items / 58 workstreams generate 7 views; full CSV re-check (not sample): 85 rows × 6 columns, **0 mismatches**; MD contains all 85 IDs; `source_digest` (145 files) replicated byte-identically (`1c4c0428…`); xlsx SHA-256 matches its meta. One cosmetic generation bug: escaped backticks around `main` in 2 views (R10A-F-036).

**Closure hygiene:** 20 DEFERRED all with reason + next-action; 3 BLOCKED with exact blockers; no closure-by-DEFER/WATCH/TODO-as-status; WATCH hits are band references only. 17 PILOT_EVIDENCE_REQUIRED items lack detection methods (recorded); 3 OUT_OF_SCOPE items lack observable triggers (R10A-F-034); HARD-001..008 ID gap undocumented (R10A-F-035).

**PRESERVE_BY_DESIGN (10-element test):** 5 cards complete — IndexedDbLocalStore, MemoryLocalStore, craft-order/policies, storage/local/types.ts, transferFamilyValidators(+ADR-017). Growth enforcement gap root-fixed by the R8-2 within-band ratchet (CLOSED_WITH_EVIDENCE).

**Handoff artifact set (canonical 8):** present — AGENTS.md (routing/precedence/stop-rule), handoffs/README (JSON-only), protocol, 4 registries, current-state + log, doc-index, closure records. **Gaps (reported, not created):** no single dev SOP; no storage parity view; no transfer/legacy/golden view; no structure/boundary/guard "proves/does-not-prove" view; R10 evidence ledger = this publication. Handoff protocol contradicts OD-06 via todo.md routing (R10A-F-032); live-phase fact duplicated 5-way (R10A-F-033). Cold-start: UI and feature routing verified good; storage-parity routing is the weakest link; rollback routing reachable via CORE+ARCH.

## 13. New and reopened finding matrix

**Zero S1. Four S2. Thirty-three S3. No reopened historical findings.** Stable IDs `R10A-F-001..037` (fields per the canonical finding record are in the evidence ledger and summarized here; source reviewers in parentheses).

**S2 — current structural/operational defects (Repair Cards in §14):**

| ID | Finding | Primary-verified |
|---|---|---|
| R10A-F-003 | WasteContext union duplicated domain↔application with no import link; member order already diverged (RV1-F03) | YES (E-S2-003) |
| R10A-F-009 | Owner-money families (ownerEntitlementPolicies/Records/OpeningBalances, ownerMovements) lack transfer counters AND required-array gates; defaulted `[]` — silent owner-ledger erasure on re-sealed current-pair import (RV2-F03) | YES (E-S2-001) |
| R10A-F-016 | ErrorBoundary focus management dead on post-mount crashes (componentDidMount-only) (RV3-F02) | YES (E-S2-002) |
| R10A-F-024 | Replit post-merge hook structurally broken: `CI=1` + surfaces-guard `detectEnvironment` → `null` → UNVERIFIED_ENVIRONMENT failure (RV4-F02) | YES (E-S2-004) |

**S3 — documentation/control defects:** R10A-F-001 (register rows for deleted recurringExpenseService stub+test lack removal notes); -002 (ARCHITECTURE.md "19 paths incl. g5 barrel" stale); -004 (CapabilityId duplicated + persisted unvalidated); -005 (ADR-018 "43 keys" vs 52 live); -006 (17 UI→storage TYPE-only imports ungoverned seam); -007 (ARCHITECTURE.md responsibility arrow inverted); -008 (6 adapter methods without direct test invocation — primary-verified sample); -010 (syncSha256 no independent oracle + CESU-8 surrogate deviation); -011 (duplicated RECURRENCE_STALE_MESSAGE literal, no cross-adapter message-identity test); -012 (three divergent id generators); -013 (MoneyMinor unbranded alias); -014 (date-slice guard textual/line-based); -015 (smoke-list staleness + 9 router paths absent); -017 (two error-announcement channels, polite channel outside role-inventory); -018 (StateMarker role prop renders no ARIA role); -019 (64 read-like files outside readwrite-guard families); -020 (3 pages still smoke-only); -021 (UI preview arithmetic duplicates domain derivations ×7 sites); -022 (contract 40 cites removed compat module); -023 (CONTRIBUTING audit-policy pointer dangling); -025 (actions tag- not SHA-pinned; node minor floating); -026 (lint ceiling saturated 35/37); -027 (secrets guard first-match-only + missing families); -028 (ratchet authorization strings not machine-verifiable; merge-base degeneracy on direct main pushes); -029 (inert undocumented nanoid override); -030 (python design guards lack negative tests); -031 (guard scripts + tools/ outside lint/typecheck); -032 (handoff protocol todo.md contradiction ×3); -033 (5-way live-phase duplication); -034 (3 OUT_OF_SCOPE items lack observable trigger/detection); -035 (HARD-001..008 gap undocumented); -036 (escaped-backtick artifact in 2 generated views — primary-verified); -037 (handoff minimum-set gaps).

Every finding carries: first-observed (this audit), source-of-discovery (reviewer/primary), affected paths/symbols, current vs required behavior, root-cause hypothesis + evidence, impact, classification, required fix or decision, protected surface, owner (product owner), trigger, review condition, rollback boundary, evidence pointers, and limitations — in the machine-readable ledger. No field is filled with "TBD" without naming the blocker. **DEFER/WATCH/FUTURE_WAVE/TODO/RECOMMENDATION are not used as closure states**; the 3 pre-existing BLOCKED control items carry exact blockers (unchanged by this audit).

## 14. Repair Cards and owner decision packages required

**Repair Cards (S2 — proposed bounded remediation for a separate owner-authorized R10-B; NOT implemented here):**

1. **RC-1 / R10A-F-009 (owner-money tamper gates).** Scope: add the 4 owner-money families to `LocalExportCounts` (with export-version-preserving semantics — count-only hardening), add them to the required-array gate for current-pair files (legacy files keep the optional-if-absent rule), extend counters characterization + a new tamper test that drops the families from a re-sealed current file and asserts rejection. Protected surface: export/import bytes, legacy acceptance — the repair must not change accepted-byte semantics for existing files; golden impact must be assessed (owner decision if any golden must change). Rollback: revert the single commit; no data migration.
2. **RC-2 / R10A-F-003 (WasteContext single source).** Scope: import the domain type in `inventoryMovementEditorModel.ts` (the file currently has zero imports — the fix must also register the file's new dependency direction), delete the duplicated union, add a guard test asserting no re-duplication. Rollback: revert one commit.
3. **RC-3 / R10A-F-016 (ErrorBoundary focus).** Scope: move focus into the render path when `hasError` becomes true after mount (e.g., effect keyed on `state.hasError`/`incidentId`), with a behavioral DOM test covering both mount-time and post-mount crash paths. Protected surface: visual/DOM behavior — the fallback UI itself must not change. Rollback: revert one commit.
4. **RC-4 / R10A-F-024 (post-merge hook).** Scope options (owner chooses): (a) drop `export CI=1` from post-merge.sh and rely on local-env detection; (b) add a documented environment alias in `detectEnvironment` for the Replit hook; (c) retire the hook. Any option keeps the surfaces guard fail-closed for unknown CI markers. Rollback: revert one commit.

**Owner decision packages (no code):**

- **OD-A — Baseline selection for protected-invariant differential proof** (E-P0-008): choose `fc2ae6e7` (R0-pinned) vs `25594773` (2026-10-06) vs `5eacbe38` (A-to-Z closure); each is documented with what it can/cannot prove.
- **OD-B — PRESERVE_BY_DESIGN ratification** (5 cards, §12) — owner review-and-ratify.
- **OD-C — OUT_OF_SCOPE trigger specificity** (R10A-F-034): SCOPE-001/002, UX-002 need observable triggers + detection methods or reclassification.
- **OD-D — BLOCKED items** (3): confirm the recorded blockers still stand and decide continue/withdraw per item.
- **OD-E — PR #351** (canonical prompt PR): merge decision is owner-only; this audit verified it docs-only and did not touch it.
- **OD-F — R10-B authorization and scope**: whether to run the S2 repairs + a docs-only control batch (S3s) as a bounded wave, and whether the PILOT_EVIDENCE_REQUIRED detection-method gap (17 items) is included.
- **OD-G — bundle re-anchor pattern**: acknowledge the documented main-red→re-anchor pattern (R9) as accepted process, or require a stricter pre-push cloud-anchor protocol in R10-B.

## 15. Owner sampling and replay plan

Eligible matrix rows = 85 control items + 37 audit findings = 122. Proposed sample ≥ 10% (≥13 rows) plus 100% of S2/PRESERVE/OUT_OF_SCOPE/BLOCKED/disputed/new:

- **100% (mandatory):** all 4 S2 findings; all 5 PRESERVE cards; all 3 OUT_OF_SCOPE control items; all 3 BLOCKED items; all 37 audit findings (the matrix itself is the owner-review surface).
- **Risk-priority sample (≥9 control items):** FIN-001 (financial-result), FIN-002 (guided entry), HIST-001..003 (history), REM-006 (storage), ARCH-007 (structural program), TEST-001, AUDIT-001 — verify each VERIFIED row's `merge_sha`/`verified_on_main_sha` is an ancestor of live main and its evidence path exists.
- **Exact replay commands (all read-only):**
  1. `git ls-remote https://github.com/Qays7753/Micro.git refs/heads/main` → must equal `ffc54eb1…` (else evidence window stale).
  2. In a fresh clone at that SHA: `pnpm install --frozen-lockfile --ignore-scripts && pnpm check` → expect the 12-phase green chain (§9 table).
  3. `TZ=Asia/Amman pnpm test` → expect 754/754 (determinism).
  4. `python3 scripts/operations-control/validate.py` → "valid: 85 items, 58 workstreams" with the live SHA.
  5. For R10A-F-009: read `transferCounters.ts` (18 families) and `transferSnapshotValidation.ts:79-113,851-861` and confirm the 4 owner families' absence/defaulting.
  6. For R10A-F-016: read `ErrorBoundary.tsx:27-29` (componentDidMount-only focus).
  7. For R10A-F-024: read `scripts/post-merge.sh` + `check-bundle-surfaces.mjs:97-107`.

## 16. NOT VERIFIED — mandatory limitations

1. Real-browser IndexedDB behavior (E-UNV-001) — jsdom/fake-indexeddb replay only.
2. Visual parity / visual UX quality / screen-reader behavior (E-UNV-002) — static a11y semantics only.
3. Full security posture / penetration testing / threat modeling (E-UNV-003).
4. Other operating systems and browsers (E-UNV-004) — one Linux/Node-24 local environment + CI Node-22 evidence.
5. Behavior after AUDIT_SHA_X (E-UNV-005) — any later commit (incl. merging PR #351) invalidates window-sensitive evidence.
6. Preserved-UI-branch immutability since 2026-09-21 (E-UNV-006) — no durable in-repo SHA baseline; read-only audit cannot audit server-side ref history.
7. GitHub API fields beyond what was captured/rate-limited (E-UNV-007) — mitigated via git protocol; PR-state metadata is from the 11:39Z captures + refs verified at 12:43:56Z+.
8. Live mutation negative controls for build-dependent guards (bundle budget/surfaces) (E-UNV-008) — covered only by replayed co-located negative suites.
9. Python design-guards negative behavior (E-UNV-009) — positive execution only.
10. Per-finding deep re-verification beyond the sampled S3s (E-UNV-010) — reviewer file:line pointers accepted after ~20% primary sampling + full S2 verification.
11. Production/real-user-data behavior (E-UNV-011) — no production environment exists for this local-first prototype.
12. Accounting correctness against external accounting standards (E-UNV-012) — preservation-only claims.

None of these is converted to PASS anywhere in this report.

## 17. Commands, tools, exit codes, and evidence index

**Evidence index (55 rows, machine-readable in `R10-A-EVIDENCE-LEDGER-2026-10-11.json`):** E-P0-001..008 (baseline/state/CI/baseline-candidates) · E-R01..R12 (12 replay phases, all EXIT=0) · E-NC1..NC7 (7 negative controls, all EXIT=1 as required) · E-DET-001 (dual-TZ determinism, EXIT=0 ×2) · E-INV-001..003 (protected invariants) · E-S2-001..004 (S2 primary verifications) · E-S3-001..003 (S3 spot checks + metric-resolution) · E-RV-1..5 (reviewer reports) · E-UNV-001..012 (NOT VERIFIED).

**Key command log (this session; prior-session artifacts preserved and re-verified):**

| Command / tool | Exit | Result |
|---|---|---|
| `git ls-remote … refs/heads/main` (×2: 11:39Z capture, 12:43:56Z re-verify) | 0 | `ffc54eb1…` both times — no drift |
| `git ls-remote …` (full, + refs/pull/344..353) | 0 | 32 branches; PR #351 head `e3be3897`; no PR ≥352 |
| `git fetch` + `git diff --stat` (PR #351 branch) | 0 | docs-only, +894/−0, 2 files |
| `git merge-base --is-ancestor f28b0fa6 ffc54eb1` | 1 | preserved UI branch NOT ancestor (diverged) |
| `bash scripts/r10a-negative-controls.sh` (7 mutations + restores) | 0 | all 7 guards EXIT=1 on violation; clone2 clean |
| `TZ=UTC vitest run` / `TZ=Asia/Amman vitest run` | 0 / 0 | 754/754 both |
| `python3 scripts/r10a-build-ledgers.py` | 0 | 55-row ledger + 17 inventories, JSON valid |
| Prior session (verified): 12-phase `pnpm check` chain | 0×12 | §9 table |
| Prior session (verified): API captures (repo/PRs/branches/check-runs/workflows) | 0 | api/*.json |

**Tools:** git 2.x (protocol + API captures), Node v24.21.0, pnpm 9.15.9, vitest 4.1.11, python3 3.12.15, curl. One auditor tooling error (invalid `--reporter=basic`) was corrected and disclosed (E-DET-001). Full logs preserved under the audit scratch directory (outside the repository); the publication package carries the ledger, denominators, reviewer reports, and this report.

## 18. Recommendation for the next phase

1. **Do not close the program yet.** The R0–R9 execution record is exceptionally well-evidenced (ancestor-verified VERIFIED rows, zero silent weakenings, fail-closed guards with live-proven negative controls, full-suite replay on the exact SHA, dual-TZ determinism) — but four S2 defects and 33 S3 control/documentation defects are open, and none may be hidden behind DEFER/WATCH/TODO.
2. **Authorize R10-B as a bounded wave:** RC-1..RC-4 (S2 repairs) + one docs-only control batch (S3s: register/ADR/ARCHITECTURE/contract-40/generated-views/smoke-list fixes + OUT_OF_SCOPE trigger specificity). RC-1 touches a protected surface and needs explicit owner acceptance of its golden-impact assessment.
3. **Decide OD-A (baseline)** before any protected-invariant differential claim; OD-B/OD-C/OD-D ratifications can ride the same owner review.
4. **Decide OD-E (PR #351)** — merging the prompt PR moves `main` and opens a new evidence window; sequence it deliberately relative to R10-B branching (R10-B must branch from the audited `ffc54eb1` or re-baseline).
5. **Address the two structural hygiene themes** in R10-B docs: the 5-way live-phase duplication (root cause of the drift chain) and the storage-parity discoverability gap — both are documented with concrete locations (R10A-F-033; §12).
6. **After R10-B:** independent re-audit of the repairs, docs-only closure, post-merge verification, and only then an owner-approved closure phase may consider the `POST_SCAN_STRUCTURAL_REMEDIATION_R0_R10 — VERIFIED_ON_MAIN` status. R10-A neither claims nor enables that status.

---

R10_AUDIT_COMPLETE — OWNER_DECISIONS_REQUIRED
NO_REPOSITORY_WRITES_PERFORMED
NO_BRANCH_OR_PR_WRITES_PERFORMED
NO_REMEDIATION_PERFORMED
NO_MERGE_PERFORMED
EXACT_REMAINING_ITEMS_REPORTED
