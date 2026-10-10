# R9 Repair Cards (W1 + discovered findings — 2026-10-10)

**Program:** WS-216 / ARCH-007 — Structural Remediation R0–R10, wave R9.
**Classification vocabulary:** Relationship `NEW | DEEPENS | DUPLICATE | REOPENED | FALSE_POSITIVE | CONFIRMS`;
Disposition `FIX_NOW | PRESERVE | DEFER_WITH_EXACT_OWNER_TRIGGER | OUT_OF_SCOPE | PROTECTED_DECISION_REQUIRED | BLOCKED`.
Every card below carries: exact evidence, root cause, impact, minimum safe remediation, regression evidence, acceptance criteria, rollback boundary, and (after execution) the implementing commit or exact blocker.

---

## Preflight cards (accepted finding set)

### R9-PF-N1 — Registry/Register/Map counts lag live guard/census baselines
- **Severity:** HIGH · **Relationship:** CONFIRMS (R0-N9 lineage; deepens R6-SCAN-F-002 reconciliation debt) · **Disposition:** FIX_NOW (documentation-only).
- **Evidence (live, command-verified at 8b3c9aeb):** `OWNERSHIP-AND-TRUTH-REGISTRY.md` §5/§6 wording "43 مفتاحًا محتجزًا… 47 موقعًا حيًا" (with the 2026-10-09 R5/S1 correction "الأساس 42… المواقع 47") vs live `scripts/ui-application-import-baseline.json` `allowed` = **52 keys** and `node scripts/check-module-boundaries.mjs` = "**57** استيرادًا عميقًا واجهة→دواخل بيوت التطبيق". `FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` §1 = 757 rows (NORMAL 681/WATCH 47/SPLIT_CANDIDATE 13/SPLIT_NOW 9/PRESERVE 3/LARGE_TEST 4; categories config 21/fixture 29/generated 7/production 343/script 20/test 337; tracked 1,551) vs live §2 table = **759 rows** (its true band split 682/49/13/8/3/4 — never re-summed after the R7 row additions), live full-scope census (git ls-files + the ratchet's own `category()`) = **945 files** (production 428/test 396/script 62/generated 7/fixture 30/config 22; tracked 1,585), ratchet v2 baseline = **488** production+script measurements (NORMAL 413/WATCH 52/SPLIT_CANDIDATE 14/SPLIT_NOW 9). `TEST-AND-DOCUMENTATION-MAP.md` §1 = "34" domain tests vs live **36** in `tests/domain/` (+1 root +1 colocated; generated test-map `domainTestLocations`), adjacent `client/src` test files = **331** (doc says 298 + 2). Page map: 60 pages = 55 direct / 5 named-reference (doc matches live; no drift — `generate-test-map.mjs --check` exit 0).
- **Precise 43→52 reconciliation (Gate-B corrected):** R6/ADR-018 terminal state was 43 = 36 composition-root (`PrototypeServicesContext.tsx`) + 7 frozen compatibility shims. R7-5 removed all 9 shims (zero-consumer proof, commit `bfa48d44`); its four documented swaps are the three UI g5-consumer keys (G5DecisionPanel, G5DeclarationEditor, Finance-second — all → `financialAnalysisService`) plus one PSC→recurring swap inside the composition-root set (net unchanged). R7's packages added **10 view-model keys** (P01–P11: financeState, orderDetailViewModel, financialEventEditorModel, directSaleEditorModel, supplierPurchaseEditorModel, inventoryMovementEditorModel, inventoryMaterialsViewModel, ownerEntitlementViewModel, scheduleViewModel, statementViewModel). Three further non-root keys are **presentation edges predating R7** (activityLabels, formatters, orderAgreementPresentation). 36 + 10 + 3 + 3 = **52**. Live sites = 57 (the additional 5 are second/third imports within already-keyed files).
- **Root cause:** the R7 and R8 waves updated the *guard baselines* same-PR (as required) but the *canonical registry/register/map prose* was last reconciled at R6-W1 (`fd92d7e8`) and R1 respectively; the register's own rule defers sub-threshold row additions to the next wave-head re-measurement, which R9 now performs.
- **Impact:** documentation/records only; no code, guard, or financial impact. A future agent reading "43/47" or "757" could mis-audit the live ratchets or distrust honest guard output.
- **Remediation (FIX_NOW, this W1):** dated corrections in registry §3م (the doors row: 52 = 36 composition-root + 16 others — 10 R7 view-model keys + 3 presentation + 3 R7-5 swap keys — with the full history 120→43 STR-615→42 R5/S1→43 R7-1→46 R7-2→49 R7-3→52 R7-4/R7-5, and the R7-5 shim-removal status), registry §3م house counts (≥13 houses re-counted live), the doorless-houses row (7 live: direct-sales, financial-analysis, formatting, identity, owner, profile, recurring), registry §5/§6 wording (52 keys / 57 sites), register §1 (live wave-head re-measurement block: 945 tracked-scope files / 428/396/62/7/30/22 categories, §2 = 759 rows with its true band split 682/49/13/8/3/4, ratchet v2 = 488 with 413/52/14/9, tracked 1,585), the register's R8-2 dated-note band split (414/51 → live 413/52), register §7 money-message line references (craft-order policies :1195/:1334/:1411/:1429/:1506 with a dated supersession pointer), and test-map §1 (36 domain-suite files + 1 root + 1 colocated; 331 adjacent client/src test files). Dead/stale rows repaired: the eight R7-5-removed shim files' register rows (the ninth, `finance/withdrawalWalletGuard.ts`, already carried its Wave-E removal note) and the registry rows that still describe `application/g5/g5Service.ts`, `src/domain/g5/index.ts` barrel, and finance/ compat units as live (append-only dated corrections marking them removed by R7-5 `bfa48d44`, not deletions); the ten R7-created view-model files get their first §2 rows (measured live at the W1 head).
- **Regression evidence:** the counts are reproducible by the exact commands recorded in the W1 report (`python3` JSON counts, `node scripts/check-module-boundaries.mjs`, `node scripts/generate-test-map.mjs --check`, git ls-files + category census); `check-registry-coverage` and the ratchet remain green.
- **Acceptance:** all counts in the three canonical docs are reproducible from the live tree at the W1 head; no historical value is rewritten (dated from→to corrections only).
- **Rollback:** revert the W1 docs commit; no code/data impact.

### R9-PF-N2 — Stale live SHA/base/verified pointers (exact fields)
- **Severity:** HIGH · **Relationship:** NEW · **Disposition:** FIX_NOW (documentation/Operations Control JSON first, then generator).
- **Evidence:** `docs/operations/control/workstreams/WS-216.json`: `verified_on_main_sha` = `74908e1334098a51bb516aa3bbdcc898a4bedb1f` (the **R7** merge) while `merge_sha` = `87274cf9…` (the R8 merge, post-merge CI `38060781329` success on the exact SHA) — the R8 post-merge reconciliation `5e40a610` updated `merge_sha`/`base_sha`/`pr` but missed `verified_on_main_sha`. Convention (R7 precedent `86f8bec9`): both fields move together to the implementation merge SHA. `current-state.md` §1 live main pointer = `87274cf9` vs live `origin/main` = `8b3c9aeb` (PR #346 merge; CI run `38061919149` success on the exact SHA — verified live via the GitHub API before W1). README (refactoring) status line, `REFACTORING-CONTROL.md` v1.18 header/§14 live step, and the plan/contract status lines also say "R9 PREFLIGHT GATE / not started".
- **Root cause:** a reconciliation PR cannot contain its own future merge SHA, and the R8 reconciliation commit missed one of the four workstream SHA fields; the successor-status headers were written at the preflight gate and were not updated when the owner accepted the package.
- **Impact:** Operations Control/records only; a future agent could treat R7 (not R8) as the last verified wave or treat `87274cf9` as the live main head.
- **Remediation (FIX_NOW, this W1):** JSON source first — WS-216.json `verified_on_main_sha` → `87274cf91a9d27b9b5f9c3cee3f980218ae6aa0e`; claim R9 on the workstream (`branch` = `refactoring/r9-complete-w1-w2-w3-20261010`, `base_sha` = `8b3c9aeb09ca33ed66f0a929c157b668839d0463`, `pr` = null until the single PR is opened, `next_action`/`notes`/`evidence` extended, `updated_at` 2026-10-10); ARCH-007.json `next_action`/`evidence` extended the same way; regenerate all views through the official generator; `current-state.md` live fields updated to `8b3c9aeb` + CI `38061919149` with R9 in progress; README/CONTROL/plan/contract status lines updated with dated corrections (preflight accepted, W1–W3 authorized).
- **Post-merge follow-up (recorded, not faked):** the final R9 PR head SHA and its CI/Cloudflare run URLs will be pinned in the PR body and in the final report; the workstream's `merge_sha`/`verified_on_main_sha` move to the R9 merge SHA **only after it exists** (post-merge reconciliation, owner action).
- **Regression evidence:** `python3 scripts/operations-control/validate.py` exit 0; `generate_tracker.py --check` exit 0; `node scripts/check-current-state-size.mjs` PASS.
- **Acceptance:** every live pointer names an SHA that exists and is CI-verified; historical references remain historical; the workstream claim matches the actual branch/base.
- **Rollback:** revert the W1 commit; JSON source regenerates the previous views.

### R9-PF-N3 — Duplicate historical numbering (append-only correction)
- **Severity:** MEDIUM · **Relationship:** NEW · **Disposition:** FIX_NOW (append-only).
- **Evidence:** `current-state-log.md` `## §161` ×2 (R7 pre-merge reconciliation at ~2161 [canonical for R7]; R8 waves at ~2175 [mislabeled — sequentially between §161 and §162]); Gate-A review additionally found `## §159` ×2 and `## §160` ×2 (R6-post-merge/§159+§160 numbering collision around the R7 gate entries) and `AGENT-SEQUENTIAL-WORKLOG.md` `Entry 76` ×2 (R7 pre-merge [canonical]; R8 execution mislabeled between Entry 77 and 78) plus `Entry 47` ×2 (historical, earlier program).
- **Root cause:** two writer sessions numbered new sections from stale tails during the R7/R8 same-day sequence.
- **Impact:** navigation/interpretation only; no data impact. A reader following "§161" or "Entry 76" can land on the wrong record.
- **Remediation (FIX_NOW, this W1):** **no renumbering, no deletion.** Append new dated sections — `current-state-log.md` **§166** and worklog **Entry 80** (the actual next correct numbers from the live tails §165 / Entry 79) — that enumerate every duplicate pair, name the canonical reading for each, and fix the numbering rule going forward (number from the live tail only).
- **Regression evidence:** the W1 report records the exact duplicate line numbers and the new section numbers.
- **Acceptance:** an agent following any duplicated number has one authoritative dated correction explaining it; the append-only property is preserved (verified by git diff showing additions only in these files).
- **Rollback:** revert the W1 commit.

### R9-PF-N4 — R8-N1 material evidence externalized in PR-body context
- **Severity:** MEDIUM · **Relationship:** NEW · **Disposition:** FIX_NOW (canonical in-repository annex).
- **Evidence:** the in-repo `R8-N1-PWA-PRECACHE-ROOT-FIX-EXECUTION-REPORT-2026-10-10.md` §4 ("recorded in the PR evidence"), §6 ("guard output recorded verbatim in the PR evidence"), §8 ("run URLs pinned in the PR body … code-head and final-head URLs live in the PR body") defer three material artifacts to PR #345's body: (1) the machine-verified before/after unique-URL set comparison (lost/gained output), (2) the verbatim guard output of Builds A/B/C, (3) the exact final-head CI run `38059908849` and Cloudflare Pages check-run `114236114902` URLs (on final head `7a928fac`). PR bodies are editable and are not versioned tree artifacts.
- **Root cause:** the R8 precedent deliberately pinned run URLs in the PR body because a commit cannot contain the URL of a run triggered by its own push; the machine outputs followed the same channel by convenience.
- **Impact:** evidence durability; the R8-N1 acceptance would survive a PR-body edit only through the in-repo report's summary numbers.
- **Remediation (FIX_NOW, this W1):** canonical annex `docs/operations/control/evidence/structural-remediation-r8-20261010/R8-N1-CANONICAL-EVIDENCE-ANNEX-2026-10-10.md` carrying: the exact final-head verification URLs with SHAs (provenance-labeled as reproduced from the PR body and the GitHub API), the reproduced unique-URL inventory of the current tree's real build (156 URLs, category breakdown, command), and the A/B/C build comparison table with provenance. The annex designates itself the canonical artifact for the machine outputs and links the PR body as provenance only (no second source of truth). Added to `docs/00-document-index.md` and to the WS-216/ARCH-007 evidence arrays.
- **Regression evidence:** the annex's reproduced inventory is regenerable by the recorded command (`pnpm build` then parse `dist/public/sw.js` precache manifest).
- **Acceptance:** every R8-N1 material fact is reachable from a versioned repository path; the PR body is provenance, not the only carrier.
- **Rollback:** revert the W1 commit (the PR body remains as historical provenance).

### R9-PF-N5 — Stale §23.8 addendum and successor status wording
- **Severity:** MEDIUM · **Relationship:** DEEPENS (R0-N4/N9 lineage; F-026 precedent) · **Disposition:** FIX_NOW (dated corrections).
- **Evidence:** `REFACTORING-ARCHITECTURE-AND-MIGRATION-PLAN.md` §23.8's R6-W1 dated addendum (2026-10-09) says "R7 (لم يبدأ — بقرار مالك)" and "R8 (لم يبدأ)" — both waves are now VERIFIED_ON_MAIN (R7 `74908e13`; R8 `87274cf9`). The successor `STRUCTURAL-REMEDIATION-PLAN-20261007.md` status line says `OWNER_ACCEPTED — R0–R8_VERIFIED_ON_MAIN; R9_PREFLIGHT_GATE`; the execution contract says "R9 has not started… no R9 implementation write starts before the scoped package is owner-accepted" — superseded by the owner's acceptance and W1–W3 authorization.
- **Root cause:** §23.8's addendum was true when written (R6-W1); the successor status lines were written at the preflight gate and not yet advanced.
- **Impact:** a reader could conclude R7/R8 are unstarted or that R9 writes are still gated.
- **Remediation (FIX_NOW, this W1):** a **new** dated block appended under §23.8 (the old addendum text untouched — append-only, F-026 precedent, the historical-record exception required for unambiguous live interpretation) recording R7/R8 VERIFIED_ON_MAIN with their merge SHAs and the R9 accepted scope; dated status-line corrections in the successor plan + execution contract (preflight accepted → W1–W3 authorized on the named branch); README/CONTROL live lines updated in the same W1.
- **Regression evidence:** W1 report records the exact from→to wording.
- **Acceptance:** no live-interpretable text claims R7/R8 unstarted or R9 unaccepted.
- **Rollback:** revert the W1 commit.

### R9-PF-N6 — Guard metadata row under-claims a proven guarantee (acceptance-value-anchors)
- **Severity:** LOW (doc refresh) · **Relationship:** NEW · **Disposition:** FIX_NOW (dated correction to the canonical metadata row).
- **Evidence (preflight Reviewer 4, VERIFIED):** `REFACTORING-PLAN-A-TO-Z.md` §4.3.1 row `check-acceptance-value-anchors` (:205) proves-column still says anchored values "match between their two registered sites" with a deferral-era does-not-prove column — the live implementation pins **4 consumption sites + 2 canonical lists** (since R4-B2/R4-REC-5) **and 6 GUARDED_UNION families** (since R6-W2/F-024), i.e. 11 SITES entries (`scripts/check-acceptance-value-anchors.mjs:36-50`). The inverse of the Q-b over-claim class: the row claims LESS than the guard proves.
- **Root cause:** the row was last touched when the anchor guard covered only two sites; the R4-B2 and R6-W2 extensions updated the guard and its tests but not the §4.3.1 metadata row.
- **Impact:** canonical metadata drift only; no soundness defect.
- **Remediation (FIX_NOW, this W1):** dated correction inside the row: proves-column updated to the 4-sites + 2-lists + 6-GUARDED_UNION-families surface; does-not-prove column updated from the deferral-era wording to the current boundary (literal-equality completeness beyond the pinned sites).
- **Regression evidence:** the guard's 23 tests remain green; metadata now matches the implementation.
- **Acceptance:** §4.3.1 row matches the guard's verified surface exactly; no guard code/test change (metadata correction only — no guard broadening).
- **Rollback:** revert the W1 commit.

### R9-GA-F6 — Second guard metadata under-claim found at Gate A (bundle-surfaces)
- **Severity:** LOW (doc refresh) · **Relationship:** NEW (distinct from N6; same class) · **Disposition:** FIX_NOW (same W1 pass).
- **Evidence:** `REFACTORING-PLAN-A-TO-Z.md` §4.3.1 row `check-bundle-surfaces` (added R8-3/R8-F-021, before the R8-N1 fix) does not document the R8-N1 hard guarantee: the live guard **fails closed on any duplicate precache URL** (`DUPLICATE_PRECACHE_URLS`, `apps/prototype-web/scripts/check-bundle-surfaces.mjs:87,342-343`) on every real build (local chain, CI `pnpm check`, Pages build), with 22 deterministic tests.
- **Remediation (FIX_NOW, this W1):** dated correction inside the row's proves-column: add "صفر عناوين مكررة في المخزن المسبق (فشل صادق DUPLICATE_PRECACHE_URLS في كل بناء فعلي — R8-N1)".
- **Acceptance / Rollback:** as N6 (metadata-only; revert the W1 commit).

### R9-PF-N7 — Theoretical precache blind spot (bounded preserve)
- **Severity:** LOW (theoretical) · **Relationship:** NEW · **Disposition:** PRESERVE (bounded theoretical risk with exact trigger — not a generic defer).
- **Evidence:** `check-bundle-budget` proves the entry ceilings; `check-bundle-surfaces` proves per-surface budgets, environment anchoring, normalized-gzip parity, and (since R8-N1) zero duplicate precache URLs. Neither guard proves **intended-set completeness**: the intended offline asset set is defined by `vite.config.ts` `workbox.globPatterns` (`**/*.{js,css,html,ico,png,svg,woff2}`) — a future public asset with an extension outside that list (e.g. `.webp`, `.mp4`) would be silently not precached while every guard stays green. The R8-N1 report documents the boundary honestly ("`brand/motion/micro-assembly.json` remains outside the precache exactly as before").
- **Owner:** the guards owner (bundle/growth guards, R8 charter) with the product owner as asset-class decision maker.
- **Reason to preserve:** the intended set is a product decision, not a mechanical invariant; machine-defining it would require a second intended-set manifest (a new source of truth) for zero current defect.
- **Growth/trigger condition:** any new public asset class or any change to `globPatterns`/`publicDir`.
- **Review trigger (mandatory same-PR evidence):** the changing PR must include the before/after unique-URL set comparison (the R8-N1 `lost/gained` machine output) proving the intended coverage — the exact format now canonicalized by the N4 annex.
- **Exit condition:** an owner decision that defines the intended offline set as a checked artifact (e.g., a coverage fixture the guard compares against).
- **Rollback boundary:** none needed (documentation-only card); if the exit condition is ever implemented, that slice carries its own rollback.
- **Regression evidence:** this card + the N4 annex command make the audit reproducible.

### R9-PF-N8..N10 — Informational counting/journey-depth facts (recorded, no defect invented)
- **Severity:** informational · **Relationship:** CONFIRMS · **Disposition:** PRESERVE (record precisely; do not inflate defect counts).
- **N8 (counting):** the test-location census is now **37** files in `tests/domain/` + 1 root `tests/owner-entitlement.test.ts` + 1 colocated `src/domain/direct-sale/policies.test.ts`, and **331** test files adjacent under `client/src` (+2 in `apps/prototype-web/scripts`); the map doc's "34/298" was true at R1 and is corrected with a dated note (part of N1). No defect: the growth is R7/R8 test additions in the canonical locations; the two historical exceptions remain as documented.
- **N9 (journey depth):** the six W7 journeys (`SmokeOnlyPagesJourneys.dom.test.tsx`) are single-happy-path evidence shared across six pages; the five stateful pages get per-page direct behavioral files in W3 (this is the W3 mission, not a defect); `SharePreview` stays surface-only with the recorded rationale (W3 evidence).
- **N10 (page map integrity):** 60 pages = 55 direct / 5 named-reference, zero pages without evidence (`withoutDirectEvidence: []`), `generate-test-map.mjs --check` = no drift at the W1 head. Recorded as the live baseline for W3's classification updates.

---

## Findings discovered during Gate A (before W1) — owned in this same wave set

### R9-GA-F1 — `replaceIndexedDbSnapshot` non-atomic on synchronous queueing failure
- **Severity:** HIGH (latent data-destruction defect in the recovery path) · **Relationship:** NEW · **Disposition:** FIX_NOW in W2 (within the authorized "root-fix of any current recovery defect" boundary).
- **Evidence (executed proof by the independent Gate-A storage reviewer, fake-indexeddb 6.2.5, spec-conformant clone):** in `apps/prototype-web/client/src/storage/local/indexedDbSnapshot.ts` the `onerror`/`onabort`/`oncomplete` handlers are attached at lines 423–427 **after** the `clear()`/`put()` queueing loop (349–422). A synchronous `put()` throw (DataCloneError/DataError) exits the Promise executor before the handlers exist; the executor throw rejects the promise, the outer `catch` (429) returns an honest `failure()` — but **no `transaction.abort()` is ever called**, so IndexedDB auto-commits the already-queued `clear()`+earlier-`put()` requests and **destroys the previous state** (experiment: durable state after the failed replace = cleared + partial `[{id:"b"}]`).
- **Reachability:** the owner import path (`localTransferService.prepareImport` → `validateSnapshot` per-family `isString(id)` checks over JSON-derived data) cannot currently produce an uncloneable record — **latent**, reachable by any other `replaceSnapshot` caller or a validator regression. `readSnapshot` is readonly and unaffected. The same latent pattern exists in principle in the adapter's other write methods (single-record blast radius vs whole-store); audited in W2 and recorded there.
- **Impact:** recovery-path integrity (contract 39's atomic-replacement promise) — the exact Q-h concern.
- **Minimum safe remediation:** wrap the queueing loop in `try/catch`; on throw, `transaction.abort()` (best-effort, guarded) and resolve `failure(error, database)`; attach the handlers before queueing. Add a deterministic regression test: poison record → honest failure → previous state fully intact (read-back + stable hash) → restore-from-backup succeeds.
- **Regression evidence:** the new W2 RB-1 test (sync-throw leg) + the existing async request-error rollback leg; ratchet reanchor ledger entry for the guard-file growth (`indexedDbSnapshot.ts` is a ratcheted production file).
- **Acceptance:** no path — sync or async — can leave a half-replaced durable store while reporting failure.
- **Rollback:** revert the W2 fix commit; the latent behavior returns (documented), no data migration involved.

### R9-GA-F2 — Error-identity at transaction failure time (generic message)
- **Severity:** LOW · **Relationship:** NEW · **Disposition:** PRESERVE (by design, documented).
- **Evidence:** at `transaction.onerror` time `transaction.error` can still be `null` (the abort default action fires after), so `failure(null)` yields the generic Arabic message. The generic user-facing message is **intentional** (AGENTS §10 rule 9: no raw exception text in errors/diagnostics; the `storage_error` code is preserved; the stale-connection mapping at `indexedDbLifecycle.ts` is the documented G6-P4-2 behavior). Preserved with: owner = storage owner; reason = no-raw-error-leak rule; consumers = all callers of `failure()`; tests = existing failure-path tests; review trigger = any future machine-readable failure-cause requirement (diagnostics field); exit = owner decision; rollback = none (no change).

### R9-GA-F3 — Page-boundary defects in the five W3 targets (found by read-review; NOT fixed in W3)
- **Severity:** HIGH/MED · **Relationship:** NEW · **Disposition:** PROTECTED_DECISION_REQUIRED (each with an exact package; W3 tests do not enshrine them).
  1. **CashReversalEditor.tsx:30–37,99–114 (HIGH):** a storage failure sets `message` but the `!entry` branch renders the not-found UI — the honest failure text is never displayed (failure misreported as "record missing"). Exact fix shape: render the error surface when `message` is set before the not-found fallback. Protected because it changes what the page renders (visual UI behavior on the failure path).
  2. **InventoryReversalEditor.tsx:27–35,62–81 (MED):** identical swallowed-failure defect. Same protected shape.
  3. **InventoryReversalEditor.tsx:59 (MED):** save-exit hardcodes `navigate("/inventory")` instead of `returnPath` — inconsistent with the S1-07 contract (عقد ٢٦ قاعدة ٣) that the sibling CashReversalEditor follows. Protected: navigation behavior change.
  4. **G5DeclarationEditor.tsx:91 (MED):** the idempotency key derivation omits `knowledge`, so two saves differing only in the knowledge field produce the same key; the service returns `reused` and the page navigates as success — a content-differing correction is silently dropped. Protected: idempotency/dedup semantics of a financial-adjacent write.
  5. **Role inconsistency (LOW):** error paragraphs use `role="status"` (CashWalletEditor:115, InventoryReversalEditor:114) vs `role="alert"` elsewhere. Protected: DOM attribute/copy class.
  6. **ReceivedLoanDetail.tsx:20 (LOW/informational):** the top-level value import of `ReceivedLoanService` is used only in type position (the service is genuinely loaded dynamically at :57 and tree-shaking removes the static binding from the bundle — no runtime/bundle effect). Disposition: OUT_OF_SCOPE for W3 (tests-only); exact trigger = any future edit of this import block (align to `import type` then).
- **Acceptance for this card:** each protected item carries its exact change and reason in the final report's protected-decision section; the W3 tests assert only the non-defective boundary behaviors.

### R9-GA-F4 — Focused-check command forms (execution correctness)
- **Severity:** execution-blocking if uncorrected · **Relationship:** NEW · **Disposition:** FIX_NOW (adopted into every wave's check set).
- **Evidence:** from the repo root, `pnpm exec vitest run apps/prototype-web/...` exits 1 ("No test files found") — the root vitest config includes only `tests/**`, `src/**`, `scripts/**/*.test.mjs`. The app suites are selected with `pnpm --filter @micro/prototype-web exec vitest run client/src/...` (verified by the Gate-A ops reviewer; 291 + 289 tests collected).
- **Adopted commands:** W2 suites and W3 suites use the `--filter` forms recorded in the W1/W2/W3 reports; substitutions and exit codes recorded verbatim.

### R9-GA-F5 — PR-body-only evidence class (systemic)
- **Severity:** MEDIUM (process) · **Relationship:** DEEPENS (R9-PF-N4) · **Disposition:** FIX_NOW (protocol recorded).
- **Evidence:** the R8 pattern of pinning final-head CI/Pages URLs only in the PR body (a commit cannot contain the URL of a run triggered by its own push).
- **Remediation:** recorded protocol — the R9 final report records the exact final PR head SHA and instructs the post-merge reconciliation (owner action) to back-fill the run URLs **and** the machine outputs into the canonical evidence directory; the PR body remains provenance. The N4 annex demonstrates the pattern for R8-N1.

### R9-GA-F7 — Engine-divergent false-success in put-inside-onsuccess write methods (found at Gate B)
- **Severity:** MEDIUM (latent; single-record blast radius) · **Relationship:** NEW (same class neighborhood as R9-GA-F1) · **Disposition:** DEFER_WITH_EXACT_OWNER_TRIGGER.
- **Evidence (Gate-B storage reviewer, empirical on fake-indexeddb 6.2.5 + spec reading):** the adapter's put-inside-onsuccess methods (`commitOrderUpdate` :277, `commitFinancialEventCorrection` :1423, `writeOneIdempotent`, `commitDepositRefundSettlement/Replacement`) queue their `put()` inside a request `onsuccess` listener. If that `put()` throws synchronously (DataCloneError/DataError), **fake-indexeddb aborts the transaction** (listener exception → `_abort`) — but **real IndexedDB reports the exception without aborting**; the transaction then auto-commits empty → `oncomplete` → the adapter resolves `ok:true` with a value that was never written (false success). Latent (JSON-validated data cannot currently be uncloneable), single-record blast radius, no prior-state destruction.
- **Owner:** storage owner. **Trigger (exact):** any future change that makes a queued record reachable-uncloneable, OR the introduction of a real-browser test harness (Playwright) in which case the divergence becomes directly testable and must be fixed with the R9-GA-F1 pattern extended into these methods. **Boundary:** fix shape = try/catch inside the listener + guarded `transaction.abort()` + honest failure; requires a real-browser harness to prove (fake-indexeddb cannot reproduce the false-success leg). **Exit condition:** the harness lands and the methods are hardened. **Rollback:** per-slice revert.

### R9-W1-B — Gate B corrections applied to W1 (2026-10-10)
- **Severity:** records-integrity (no code impact) · **Relationship:** NEW · **Disposition:** FIX_NOW (this correction commit).
- **Evidence:** Gate B (five reviewers on W1 head `80a3c64b`) found: (1) `MASTER-TRACKER.xlsx.meta.json` source digest stale at the committed head (final JSON evidence-array edits postdated the refresh) → `validate.py`/`generate_tracker.py --check` exit 1 — the W1 report's exit table was recorded mid-wave and was false at the head; (2) the five preserved `*.log.txt` files carried EOF blank lines → `git diff --check` exit 2 (a CI whitespace blocker for the PR); (3) the 52-key decomposition said "+6 swap keys" — the three presentation edges (activityLabels, formatters, orderAgreementPresentation) predate R7 and are not swaps (corrected everywhere to 36+10+3+3); (4) repair-card residual "37"→36 and "nine"→eight dead-row count; (5) canonical-copy §3 wording ("no per-page test files exist" — nine exist for other pages; none for the five targets) and the SharePreview coverage statement made exact.
- **Corrections applied:** Excel meta re-refreshed from the final source state; log EOFs trimmed; decomposition corrected in the registry (both sites), the canonical copy, the repair cards, and the W1 report (dated correction appended to §5); the wording fixes applied. All re-verified: validate exit 0, --check exit 0, `git diff --check` clean, test-map no drift.

---

## Disposition summary

| Card | Severity | Relationship | Disposition | Wave |
|---|---|---|---|---|
| R9-PF-N1 | HIGH | CONFIRMS | FIX_NOW | W1 |
| R9-PF-N2 | HIGH | NEW | FIX_NOW | W1 |
| R9-PF-N3 | MEDIUM | NEW | FIX_NOW (append-only) | W1 |
| R9-PF-N4 | MEDIUM | NEW | FIX_NOW (annex) | W1 |
| R9-PF-N5 | MEDIUM | DEEPENS | FIX_NOW (dated corrections) | W1 |
| R9-PF-N6 | MEDIUM | NEW | FIX_NOW (metadata row) | W1 |
| R9-PF-N7 | LOW | NEW | PRESERVE (bounded trigger) | W1 |
| R9-PF-N8..N10 | info | CONFIRMS | PRESERVE (recorded) | W1 |
| R9-GA-F1 | HIGH | NEW | FIX_NOW | W2 |
| R9-GA-F2 | LOW | NEW | PRESERVE (by design) | W1 |
| R9-GA-F3.1–.5 | HIGH/MED | NEW | PROTECTED_DECISION_REQUIRED | reported |
| R9-GA-F3.6 | LOW | NEW | OUT_OF_SCOPE (exact trigger) | reported |
| R9-GA-F4 | exec | NEW | FIX_NOW (adopted commands) | all waves |
| R9-GA-F5 | MEDIUM | DEEPENS | FIX_NOW (protocol) | W1/final |
| R9-GA-F6 | LOW | NEW | FIX_NOW (metadata row) | W1 |
| R9-GA-F7 | MEDIUM | NEW | DEFER_WITH_EXACT_OWNER_TRIGGER | recorded |
| R9-W1-B | records | NEW | FIX_NOW (Gate B corrections) | W1 |
