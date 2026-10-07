# R1 — Truth, Governance, Documentation, and Guard Hygiene — Execution Report — 2026-10-07

**Program:** `WS-216` / `ARCH-007` — Structural Remediation R0–R10 (successor)
**Wave:** R1 — الحقيقة والحوكمة والتوثيق ونظافة الحراس
**Contract:** `docs/architecture/refactoring/ZAI-STRUCTURAL-REMEDIATION-R0-R10-EXECUTION-CONTRACT-20261007.md` (§"R1 — Truth, governance, documentation, and guard hygiene")
**Plan:** `docs/architecture/refactoring/STRUCTURAL-REMEDIATION-PLAN-20261007.md` (قسم R1)
**Repair Cards:** `docs/operations/control/evidence/structural-remediation-r1-20261007/R1-REPAIR-CARDS.md` (R1-TG-01..04 + تعديلات المُصالِح الخمسية)
**Executor:** Z AI sequential repository executor · **Mode:** توثيقي محض (documentation-only) · **Report date:** 2026-10-07 (UTC)

---

## 1. Exact baseline and final source SHA

| Item | Value | Class |
|---|---|---|
| Verified baseline (`git fetch origin --prune` at wave start) | `origin/main` = `8bc51963b98c517f5cad03a5ee9d49c941ae17de` | VERIFIED |
| PR chain reconciled before start | PR #325 (R0 report, merge `a258287cdc606c58a91ed8ad9791b5837b341a54`), PR #326 (post-merge reconciliation, merge `b1359e598d78ac0f0e61b514cd874bb22f19bf5b`), PR #327 (final pointer, merge `8bc51963b98c517f5cad03a5ee9d49c941ae17de`) — all reachable from `main` (merge-base checks, exit 0) | VERIFIED |
| Open PRs at start | **0** (authenticated API) | VERIFIED |
| Active claim | exactly 1: `WS-216`/`ARCH-007` IN_PROGRESS (validate.py: 85 items / 58 workstreams / 1 active claim) | VERIFIED |
| Implementation branch | `refactoring/r1-truth-governance-20261007` from `8bc5196` (clean worktree, 0 unknown local work; all program remote branches verified merged ancestors; preserved UI branch `docs/ux-ui-zed-handoff-20260921` @ `f28b0fa` untouched) | VERIFIED |
| Final source SHA (this PR's head) | this report's own commit — the wave head (`refactoring/r1-truth-governance-20261007`); the exact SHA is cited in the PR body/Merge Manifest (a commit cannot contain its own hash) | VERIFIED |
| Environment | `NORMAL` (load 0.00, disk 8.0 GB free, Node v24 local / CI Node 22 — gzip figures ADR-012-drift labeled where cited) | VERIFIED |

**No `STATE_DRIFT`:** the live facts at wave start matched the prompt's checkpoints exactly; every later divergence found was classified stale-record (§4) and corrected with dated annotations, never by resetting or overwriting.

## 2. Five-role read-only review (pre-implementation and gate)

Five specialists reviewed the Repair Cards against the live tree at `8bc5196` **before** implementation (S1 architecture/ownership; S2 data/domain/storage safety; S3 dependencies/guards/CI; S4 tests/Operations-Control plumbing; S5 hostile independent). All were read-only: zero writes, zero competing reports. Their verdicts and the synthesizer's resolutions (all baked into the cards' amendment section before execution):

| Review | Verdict | Key contributions resolved by synthesizer |
|---|---|---|
| S1 | All 6 mandate items VERIFIED; 1 card sub-claim refuted | g5-shim test-consumer count corrected 5 → **15** (18 total consumers, matches FILE-register:341); found M1–M9 stale records (plan/contract "131-method" lines; FILE-register :31/:800/:806/:811; registry domain/g5 owner rows :63/:98; TEST-MAP §1 counts 33/343 → 34/298; WS-216 branch field) — all admitted to TG-01/TG-02 |
| S2 | All 7 mandate items VERIFIED — no stop-condition | Proved R1 cannot touch financial meaning/storage/schema/export/history (cards' file union is docs-only; invariants 38/30 live; F-04 consumers canonical; dead shims recorded-not-deleted; checker branches on status not owner text); flagged view-regen discipline + current-state byte budget |
| S3 | Core claims VERIFIED (F-05a/b/c genuinely closed live with tests; 14 guards green incl. vendored-braces) | Found **R1-D2**: `check-module-boundaries.mjs:7` header said "five rules" / test header "three rules" vs six implemented → comment-only correction authorized; **H3**: §4.3.1 row omitted R5/R6; **NEW-D**: `scripts/fixtures*` never existed in git (runtime-built samples) → unified rule worded to reality |
| S4 | All 8 mandate items VERIFIED | `status_history` self-transition is a validator error → progress recorded in `notes[]`; current-state headroom 1,349 B; R1 report needs a doc-index mention; full regen chain mandatory; audit-gate count 28 = 11+5+6+6 confirmed |
| S5 (hostile) | Protected-dimension claim SURVIVES; cards not implementable as-written — 11 findings | H1 consumer count (merged with S1); H2 the guard-header fix must be permitted (plan action #5 + file listed in plan); H4 R0-N6 was matrix-only → enumerated into card body; H5 shim counting rule fixed (8 = 6+2); **H6 RS-1 must be read literally — NO principles-layer edit** (canonical path = contract 39 + principles 17/18 + AGENTS §10; no second policy doc); H7 enumerated residual stale lines; H10 review clauses (owner-field before/after in PR body; PG-4 quotes old text; 4A cited as authority) |

**Disagreement resolution rule applied:** live evidence wins (e.g., S1 vs cards on consumer counts; S5 vs cards on the script-touch prohibition — resolved by the plan's own action list and the R1 write boundary which permits guard-script changes "only where required to correct a documented R1 contradiction" — R1-D2 is exactly that).

## 3. R1 finding and principle classification (complete, no omissions)

### 3.1 Structure findings in R1 scope

| ID | R0 class | R1 disposition | Evidence |
|---|---|---|---|
| F-01 | CLOSED | **VERIFIED STILL CLOSED** (no phase contradiction re-found) | S5 doc sweep; CONTROL/README/current-state now unified by this PR |
| F-02 | CLOSED (residual lag) | **RESIDUAL CLOSED** — pointers re-pinned from live fetch: current-state header/§1, WS-216 `base_sha`+`branch`, CONTROL §14, README | validate.py warning for WS-216 base_sha cleared (exit 0 output §8) |
| F-03 | CLOSED | **RESIDUAL CLOSED** — registry §3:86 now names `financialAnalysisService` as canonical (4A authority) with the g5 shim recorded as 11-line compat (3 production type-only + 15 test consumers); §2/:63 and §3-rules/:98 owner rows `domain/g5` → `domain/financial-analysis` (dated) | grep inventories in §5 |
| F-04 | CLOSED | **VERIFIED CLOSED, NO ACTION** — both production importers already canonical (`ownerEntitlementService.ts:27`, `projectFinancialEventWrites.ts:23` → `@/application/owner-money/withdrawalWalletGuard`); zero compat-path consumers repo-wide | consumer inventory §5.3 |
| F-05a | CLOSED | **VERIFIED CLOSED** — C4 implemented as a real warning (`check-skill-references.mjs:181-192`), retired skills excluded | S3 re-verification |
| F-05b | CLOSED | **VERIFIED CLOSED + RULE PINNED** — exact-path exclusions (`scripts/fixtures/secrets`, `scripts/fixtures`) with positive/negative boundary tests; the unified fixture-scope rule is now documented once in A-TO-Z §4.3.1 with the vacuous-on-live-tree reality (NEW-D) and the intentional per-guard differences recorded with owners | A-TO-Z §4.3.1 (this PR) |
| F-05c | CLOSED | **VERIFIED CLOSED, NO CI CHANGE** — `ci.yml` has no standalone lint step; `pnpm check` runs lint exactly once (S3 counted invocations); **`ci.yml` untouched in R1** | negative verification recorded |
| CON-1..CON-3 | CLOSED | verified as F-01/F-02/F-03 closures | §2/§3 |
| CON-4 | PARTIALLY_CLOSED | **RESIDUAL CLOSED** — the unreconciled items R0 named (registry status line, FILE-register §4, README v1.4 citation) all carry dated corrections now | §4 below |

### 3.2 Principles PA-1..PA-4 (instantiation, per plan)

| ID | R1 deliverable | Where instantiated | Class |
|---|---|---|---|
| PA-1 | write-path authority rule per fact | Registry §8-2 (formal rule + §2 write-guard columns as the executable map + forbidden bypasses) | VERIFIED (documentation instantiation) |
| PA-2 | runtime channels as owned public surfaces | Registry §8-1: 4 React contexts + `dataVersion` + `BroadcastChannel("micro-data-changed")` + browser-events class (verified local-only) + **verified-absent** channels (no production CustomEvent/EventTarget/storage-listener/second BroadcastChannel) — each with owner/producer/consumers/contract/admission rule/review trigger | VERIFIED (grep census §5.4) |
| PA-3 | feature retirement dispositions | Registry §8-3: counting rule pinned (8 application shims = 6 live + 2 dead); dispositions for live shims (Preserve→T), dead shims (Preserve now ← Migrate at R7, **trigger fired and recorded** — R0-N5), preserved UI branch, tombstoned todo.md, E-00; INDEPENDENT-TRACKS T-track updated | VERIFIED |
| PA-4 | locale/RTL/formatting owner | Registry §8-4: owner = application/formatting + application/input/englishNumeric + presentation (RTL); domain locale-independence re-affirmed (Q-c negative evidence); **R2 semantic work explicitly out of scope** | VERIFIED (designation only) |

### 3.3 Governance PG-1..PG-6

| ID | R1 deliverable | Disposition | Class |
|---|---|---|---|
| PG-1 | fresh dated registry reconciliation | Registry header v1.3: "آخر مصالحة 2026-10-07" with every correction direction (from ← to) listed | CLOSED (this PR) |
| PG-2 | guard metadata proves/does-not-prove/change-class | A-TO-Z §4.3.1 now covers **14** guards (14th row added — R0-N12; module-boundaries row fixed to R1..R6 — H3; title 13→14); all three columns present | CLOSED (this PR) |
| PG-3 | decision-rights map citable | verified live (CONTROL §12 standing-decisions table); no change needed | VERIFIED (was closed) |
| PG-4 | explicit precedence ladder | A-TO-Z §4.3 PG-4 extended to **six explicit rungs** (dated correction quoting the old five-rung text) + CONTROL §15-1 (conflict recording without history rewriting; AGENTS §3 stop rule remains the governing authority — the ladder is a referral to it) | CLOSED (this PR) |
| PG-5 | artifact owner/review-trigger/staleness | CONTROL §15-2: metadata table for all active governance artifacts (owner, review trigger, current status, retirement path) | CLOSED (this PR) |
| PG-6 | data rollback rule | rule live (unchanged in R1); rehearsal remains R9 (Q-i honest partial — unchanged) | VERIFIED (no action) |

### 3.4 Reference restructuring RS-1..RS-5 (layer separation, no second plan)

| ID | Disposition | Evidence |
|---|---|---|
| RS-1 | **Read literally (H6): no principles-layer edit.** The canonical unified reversibility/data-rollback path remains contract 39 + principles 17/18 (A-TO-Z §4) + AGENTS §10; no second policy document created; verified the three layers exist and interlink | A-TO-Z §4.4 RS-1; CONTROL §15-3 |
| RS-2 | verified: historical integrity separate from correction bounds; no blind append-only imposed in any live register | CONTROL §15-3 |
| RS-3 | verified: size bands/completion vocabulary live in policy/runbook layers (A-TO-Z §7.3/§9 + skill §5/§6/§8), review rule only in principles | CONTROL §15-3 |
| RS-4 | closed this PR: permanent guard metadata in governance (§4.3.1, 14 guards); changing inventory lives in `pnpm guards`/CI/skill | CONTROL §15-3 |
| RS-5 | verified: freeze/wave/handoff procedures live in the program plan + skill; principles carry none | CONTROL §15-3 |

**Layer map recorded:** Principles = A-TO-Z §4 · Governance policy = A-TO-Z §4.1–§4.4 + CONTROL §12/§15 · Program runbook = successor plan (waves/cards) + skill + CONTROL state sections. No competing architecture plan created.

### 3.5 Stale-record findings routed from R0 (all closed this PR unless noted)

| ID | Correction made | File |
|---|---|---|
| R0-N3 | status line «131/131» → «130/130» (dated) | registry |
| R0-N4 | BroadcastChannel falsehood → live channel owned; «ThemeContext الوحيدة» → 4 contexts; 155,000 → 155,300 (ADR-017); «no app barrels / 18 domain» → 29 doors (ADR-018) + 19 barrels; DEFER J/K → terminal doors state | FILE-register §4 |
| R0-N5 | dead-shim zero-consumer trigger **fired and recorded**; removal routed R7 (no deletion in R1) | registry §8-3, INDEPENDENT-TRACKS T |
| R0-N6 | blanket dated note superseding the 13 dangling «بطاقات الفجوة» promises (grep count 13; R0 estimated 15 — discrepancy recorded); live evidence = generated test map; completion R9 | FILE-register header |
| R0-N7 | founding-head SHA `a59eeb1` annotated as preserved via `refs/pull/299/head`; `8ba44555` annotated in CONTROL §2 (already carried its branch context) | registry header, CONTROL §2 |
| R0-N9 | README: v1.4/1,323 → v1.5/1,484; Entry 47 → 51; status header → successor R1; plan/contract row statuses | refactoring README |
| R0-N10 | Entry-47 gzip figure environment label recorded via a dated note in the new Entry 51 (append-only respected) | worklog |
| R0-N11 | live root suite **644 cases / 57 files** (re-measured `vitest list` at execution, both suites listed) recorded in §8 and Entry 51/§140; app 2,222/300 exact | report §8, worklog, state-log |
| R0-N12 | 14th guard added to the canonical table | A-TO-Z §4.3.1 |
| R0-N13 | all "13 guards" living-claims corrected to 14 (INDEPENDENT-TRACKS X-track; A-TO-Z-CLOSURE-RECORD dated annotation) | both files |
| R0-N14 | audit-gate test count 25 → **28** (11+5+6+6) recorded in the new dated entries | Entry 51, §140 |
| R0-N16 | security-register `owner` field wording reconciled with terminal `REMEDIATED_BY_ELIMINATION` (double-diff honored: JSON + prose note; checker branches on `status` only — verified read-only) | security-exceptions pair |
| **R1-D1 (new)** | TEST-MAP §1 (33/343 → 34/298) and §2 (49+5+6 → 55 direct + 5 named; six route rows reclassified) — discovered by R1's own census, generator drift-check green | TEST-AND-DOCUMENTATION-MAP |
| **R1-D2 (new)** | guard header rule-count contradictions (five/three vs six) — comment-only corrections; guard PASS + focused tests 15/15 | check-module-boundaries(.test).mjs |
| M1/M2/M3 | "131 طريقة" in successor plan (:721/:734), its contract (R3 §), and FILE-register rows (:31/:800/:806/:811 — incl. the internal «131 مصنفة 130/130» contradiction) — all dated | plan, contract, FILE-register |
| M5/M6/M7/M8/M9 | as enumerated above (TEST-MAP §1; INDEPENDENT-TRACKS :26/:50; A-TO-Z-CLOSURE-RECORD; WS-216 branch field) | respective files |

**Findings explicitly NOT acted on in R1 (routed):** R0-N1 guard filter fix + baseline re-anchor (R8 — ADR-018 already carries R0's dated correction); R0-N2 mixed-cycle guard (R8); R0-N8 craft-order card completion (R6); R0-N15 operability choices (R8, owner-informed); R0-N17 within-band growth (R8); R0-N18 resetAll review (R4); R0-N19 direct settlement test (R9); R0-N20 type-surface pinning (R5/R8).

## 4. Consumer inventories (live, commands recorded)

1. **g5 shim (`application/g5/g5Service.ts`, 11 lines, pure re-export):** production consumers = **3 files, all type-only** — `pages/Finance.tsx:33`, `pages/G5DeclarationEditor.tsx:11`, `components/finance/G5DecisionPanel.tsx:4-5` (+ type-position dynamic import at :55). Test consumers = **15 files** (13 `*.dom.test.tsx` + group1Surfaces + group2InventorySurfaces). Total 18 — matches FILE-register row :341. Command: `grep -rn "application/g5/g5Service" --include="*.ts" --include="*.tsx" apps/ src/`.
2. **Dead shims:** `finance/expenseRecordIntent.ts` + `finance/expenseCategorySuggestions.ts` — **zero consumers** of the shim paths repo-wide (import-specifier grep excluding the canonical `financial-records/` targets: 0 matches). Removal = R7.
3. **Owner Money (F-04):** `withdrawalWalletGuard` importers = `owner-money/ownerEntitlementService.ts:27` + `finance/projectFinancialEventWrites.ts:23` (both canonical `@/application/owner-money/` path) + colocated test. **No compat-path consumers exist → no import migration required in R1** (F-04 was closed by Wave E/ADR-016; R1 verifies and records).
4. **Runtime channels (PA-2):** census §3.2/§5.4 — `new BroadcastChannel` production hits = 1 (`PrototypeServicesContext.tsx:171`); `createContext` production = 4 (PrototypeServices :160, QuickRecording `quickRecording.tsx:23`, UnsavedChanges `UnsavedChangesGuard.tsx:15`, Theme `contexts/ThemeContext.tsx:18`); production `CustomEvent`/`EventTarget`/`storage`-listener = 0; `dataVersion` consumers = 60+ files via `usePrototypeServices`.
5. **Guard fixtures:** `scripts/fixtures` / `scripts/fixtures/secrets` = **0 tracked files ever** (`git log --all -- scripts/fixtures` empty) — exclusions are reserved documented paths whose samples are runtime-built inside guard tests.

## 5. Impact statements (protected dimensions)

| Dimension | Impact | Proof |
|---|---|---|
| Financial/semantic | **NONE** | zero production-code changes (diff = docs + JSON + 2 comment-only guard-header lines); S2's independent proof (cards file union + invariants + no migration); no formula/rounding/classification/message text touched |
| Schema/Export/Import/history | **NONE** | `localSchemaVersion=38` / `localExportVersion=30` live at `storage/local/types.ts:55,71` (unchanged); goldens/MANIFEST/transfer/commit-guards untouched (git diff file list) |
| UI/visual | **NONE** | no `apps/prototype-web/client/src` file in the diff except none; zero DOM/CSS/token/copy changes |
| Security/permissions | **NONE** (wording only) | security-register `owner` field text reconciled; `status`/`review_date`/triggers unchanged; checker logic branches on status (read-only verification); no credential/permission surface touched |
| Tests/guards logic | **NONE** (comments only) | `check-module-boundaries(.test).mjs`: header comments corrected; guard re-run PASS with identical baselines; focused tests 15/15 |
| Data | **NONE** | no runtime write path touched; docs only |

## 6. Generated-artifact provenance

All `docs/operations/control/generated/*` changes in this PR were produced **only** by the official chain after JSON-source edits: `python3 scripts/operations-control/generate_tracker.py` → `--refresh-excel-meta` → `--check` → `validate.py` (exit 0). No generated view was hand-edited. `generated/test-map.json` was **not** regenerated (no structural change to pages/tests/contracts; `generate-test-map.mjs --check` = no drift).

## 7. Files changed and commits (this wave)

| Commit | Slice (card) | Files |
|---|---|---|
| `c80ae10` | Repair Cards + five-review amendments (gate artifact) | `evidence/structural-remediation-r1-20261007/R1-REPAIR-CARDS.md` |
| `a55cc75` | Governance core (TG-01/03/04) | `REFACTORING-PLAN-A-TO-Z.md` (§4.3 PG-4 six rungs; §4.3.1 14th row + R1..R6 fix + title + fixtures rule), `REFACTORING-CONTROL.md` (v1.11, §14, new §15), `A-TO-Z-CLOSURE-RECORD.md` (dated note), successor plan (2 dated 131→130), successor contract (dated 131→130) |
| `cd0d667` | Stale-record reconciliation (TG-01) | `FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` (§4 three rows + 4 port-count rows + gap-cards note), `TEST-AND-DOCUMENTATION-MAP.md` (§1/§2), `INDEPENDENT-TRACKS-RECORD.md` (T-track trigger + counts + X-track), `security-exception-register.json` + `security-exceptions.md` (owner wording, double-diff), refactoring `README.md` (header + 4 rows), `REFACTORING-EXECUTION-REPORT.md` (appended §8) |
| `78239e1` | Ownership registry v1.3 (TG-02/TG-04) | `OWNERSHIP-AND-TRUTH-REGISTRY.md` (header v1.3 + PG-1 reconciliation; status line; :63/:98 owner rows; §3:86 canonical naming; §5 R6 baseline; new §8 PA-1..PA-4) |
| `4a0165a` | Guard-header contradiction (TG-03, R1-D2) | `scripts/check-module-boundaries.mjs` + `check-module-boundaries.test.mjs` (comment-only) |
| `ec87f27` | Operations Control pin (TG-04) | `WS-216.json`, `ARCH-007.json`, regenerated views (ACTIVE-WORK, AGENT-BRIEF, MASTER-TRACKER.csv, xlsx meta) |
| `<FINAL>` | Report + live state (all cards) | this report, `00-document-index.md` (successor paragraph), `current-state.md` (live fields), `current-state-log.md` (§140), `AGENT-SEQUENTIAL-WORKLOG.md` (Entry 51), `ARCH-007.json` (evidence += this report) + regenerated views |

**Total: 21 files (documentation + control JSON/views + 2 comment-only script lines).** Rollback boundary: each slice reverts independently as a single doc revert; the two comment lines revert with no behavioral consequence (guard re-verified before/after).

## 8. Verification battery (commands and exit codes, on the final head)

| # | Command | Exit | Result |
|---|---|---|---|
| 1 | `git fetch origin --prune` | 0 | no drift; `origin/main` unchanged from baseline |
| 2 | `python3 -m json.tool WS-216.json / ARCH-007.json` | 0/0 | valid JSON |
| 3 | `python3 scripts/operations-control/generate_tracker.py --check` | 0 | views current (regenerated from JSON only) |
| 4 | `python3 scripts/operations-control/validate.py` | 0 | 85 items / 58 workstreams / 1 active claim; origin/main=`8bc5196…`; WS-216 base_sha warning **cleared**; remaining warnings: WS-170 historical (pre-existing) + gh CLI unavailable (environment) |
| 5 | `node scripts/check-doc-index-coverage.mjs` | 0 | catalog coverage complete (this report indexed in the successor paragraph) |
| 6 | `pnpm lint` | 0 | 0 errors / 35 warnings (≤ 37 ceiling, unchanged) |
| 7 | `git diff --check` | 0 | no whitespace errors |
| 8 | `pnpm guards` (14-guard chain) | 0 | all PASS — secrets 1,485 files 0 hits · test-focus 357 · entity-touchpoints 40 · runtime-cycles 400/0 · doc-index · current-state-size **20,011**/20,480 · skill-refs 8 · image-policy 36 · module-boundaries 368 files baselines 3/15/0/3/2/47 · type-cycles 1/1 · registry-coverage 37+19 · anchors 4 · file-ratchet 462/407, 0 escalation · vendored-braces 12,665 files, 4 copies = baseline |
| 9 | `node scripts/generate-test-map.mjs --check` | 0 | no drift |
| 10 | `node scripts/check-module-boundaries.mjs` (focused, after comment fix) | 0 | PASS, identical baselines |
| 11 | `vitest run scripts/check-module-boundaries.test.mjs` (focused) | 0 | 15/15 |
| 12 | `python3 -m unittest discover -s scripts/operations-control` | 0 | 8/8 self-tests |
| 13 | Test inventory (`vitest list`, read-only) | 0 | root **644 cases / 57 files**; app **2,222 / 300** — full suites NOT re-executed locally (no code changed; CI on the exact PR head covers `pnpm check` — recorded in the PR body with run URLs and conclusions; **a green check on any other SHA is not claimed as evidence**) |

## 9. Limitations and not-executed checks

- Full root/app test suites, typecheck, build were **not re-executed locally**: R1 changed zero executable code (the only script change is two comment lines, proven behavior-neutral by re-running the guard + its 15 focused tests). The PR-head CI run is the authoritative execution record and is cited in the PR body with exact URLs and SHA. Class: NOT_EXECUTED-locally **by scope decision**, VERIFIED via focused runs + CI-on-head.
- `gh` CLI unavailable in the sandbox (API used for PR verification; validate.py cross-check skipped locally — known environment limitation, unchanged from R0).
- Local Node v24 vs CI Node 22 gzip drift (ADR-012): no new gzip figures were recorded in R1 (no bundle-affecting change); the Entry-47 historical figure got its environment label note (R0-N10) without re-measurement.
- The 13 dangling gap-cards references were superseded by a blanket dated note rather than 13 individual edits — a documented decision (the references live inside historical per-file rows; the note sits in the register's header where methodology lives; completion of actual gap cards remains R9).
- `pnpm audit` not re-run locally (no dependency/lockfile change; the audit gate runs in CI on the PR head and its conclusion is recorded in the PR body).

## 10. Rollback boundaries (per slice)

| Slice | Rollback |
|---|---|
| Repair cards | delete evidence file (no dependents) |
| Governance core (A-TO-Z/CONTROL/closure/plan/contract notes) | single doc revert; no code references the new sections |
| Stale-record corrections | single doc revert per file; all corrections are dated annotations, original texts preserved in history |
| Registry v1.3 | single doc revert; registry-coverage guard verified green with the new content (and with the old — no house was removed) |
| Guard-header comments | revert restores old comments; guard/test behavior identical either way (both states re-verified) |
| Operations Control | revert JSON + regenerate views (chain documented); `pr` field update post-PR is PR-body-only |
| Report/live-state | revert docs; log §140 and Entry 51 are append-only records that a revert removes with their commit |

## 11. Next wave

**R2 — المال والتنسيق والإدخال والتاريخ والرسائل** (money/formatting/input/date/messages): characterization first; byte-equal persisted notes; any financial output diff = `SEMANTIC_CHANGE_MANIFEST` stop. R2 starts **only after the owner accepts this R1 PR**. No R2–R10 work was started in this PR.

## 12. Final status

```text
R1_COMPLETE — PR_READY_FOR_OWNER_REVIEW
NO_R2_R10_IMPLEMENTATION_STARTED
NO_UNAPPROVED_FINANCIAL_OR_SEMANTIC_CHANGE
NO_UNAPPROVED_SCHEMA_OR_EXPORT_IMPORT_CHANGE
NO_UNAPPROVED_HISTORICAL_DATA_CHANGE
NO_UI_OR_VISUAL_CHANGE
OPERATIONS_CONTROL_RECONCILED
NO_REPOSITORY_WRITES_AFTER_PR_OPENED
NO_CLEANUP_PERFORMED
```

- Baseline `8bc51963b98c517f5cad03a5ee9d49c941ae17de` verified at start; no drift at end. PRs #325/#326/#327 verified merged and reachable; `WS-216` remains `IN_PROGRESS` (R1–R10 incomplete) with R1 recorded in `notes[]` (no illegal status transition).
- No merge, no branch/PR deletion, no `main` writes, no cleanup; the preserved UI branch is untouched. After PR open: only PR-body updates (CI evidence + merge manifest) — no further repository writes.
