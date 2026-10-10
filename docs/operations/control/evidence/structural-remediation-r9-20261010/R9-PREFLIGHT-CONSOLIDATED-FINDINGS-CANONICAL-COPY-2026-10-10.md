# R9 Preflight — Consolidated Findings Canonical Copy (2026-10-10)

**Purpose and provenance.** The R9 preflight was executed as a read-only evidence
reconciliation on the live tree at main `8b3c9aeb09ca33ed66f0a929c157b668839d0463`
(2026-10-10) and delivered to the owner in the Z AI conversation as
`R9-PREFLIGHT-CONSOLIDATED-REPORT-2026-10-10.md`. The owner reviewed and accepted
the findings and authorized the R9 complete remediation (W1 + W2 + W3) in a single
controlled execution. The full preflight report text was delivered outside Git; this
canonical copy preserves, verbatim in substance, the accepted finding set (the ten
preflight findings, the two open verification questions, and the five-page direct-test
obligation) exactly as restated in the owner's accepted execution authorization, so
that the repository carries the authoritative record of what R9 was authorized to fix.
It does not invent a different scope and does not duplicate any in-repository report
(no `R9-PREFLIGHT` file exists anywhere in the tree — verified with
`git ls-tree -r origin/main | grep -i r9` → empty and `rg -l "R9-PF"` → empty).
The **complete preflight five-reviewer package** (the review outputs the consolidated
report was built from) is preserved verbatim under
[`preflight-review-package/`](preflight-review-package/) in this directory — five
read-only reviewer reports (architecture/ownership, storage/data-integrity,
UI/boundaries, tests/guards/CI, hostile evidence) plus the preflight focused-command
logs (capabilities, root/app guards, journeys, transfers). SHA-256 of the five
reviewer files at preservation time: reviewer-1 `b3155bf6…`, reviewer-2 `b9f26d55…`,
reviewer-3 `91d601b6…`, reviewer-4 `0d08fbba…`, reviewer-5 `a2d11b77…` (full digests
recordable via `sha256sum preflight-review-package/reviewer-*.md`).

**External provenance:** Z AI conversation delivery (2026-10-10), owner acceptance
recorded in the R9 execution authorization; SHA-256 of the owner's execution
authorization file as supplied to the executor:
`51438a6b9a3d6c448d8d5835c4770d30c6c4edccd036630600d1fe9898a6f6af`
(computed over the prompt file supplied to the executor workspace; the file is the
authorization, not the preflight report itself).

---

## 1. Accepted finding set (R9-PF-N1..N10)

| ID | Finding (as accepted) | Live re-derivation at W1 (command-verified) |
|---|---|---|
| R9-PF-N1 | Live Registry/File Register counts and row coverage lag the live guard/census baselines | VERIFIED live: registry documents "43 keys / 47 sites" (§5/§6 wording) vs live `ui-application-import-baseline.json` = **52 allowed keys** and `check-module-boundaries` output = **57 live sites**; register §1 documents 757 rows (681/47/13/9/3/4) vs live §2 table = **759 rows**, live full-scope census = **945 files** (production 428 / test 396 / script 62 / generated 7 / fixture 30 / config 22; git-tracked 1,585), ratchet v2 = **488** production+script measurements (NORMAL 413 / WATCH 52 / SPLIT_CANDIDATE 14 / SPLIT_NOW 9); test-map doc says 34 domain tests vs live **36** `tests/domain/*.test.ts` files (+1 root `tests/owner-entitlement.test.ts` +1 colocated `src/domain/direct-sale/policies.test.ts` = 38 domain-test files), adjacent `client/src` tests = **331** vs documented 298(+2). Precise key reconciliation: 52 = 36 composition-root (ADR-018) + 10 R7 view-model keys + 6 R7-5 swap keys (the 7 frozen shim keys of the R6 terminal state 43 = 36+7 were removed by R7-5). |
| R9-PF-N2 | Live SHA/base/verified pointer wording is stale or misidentified; use the actual fields, not the report's shorthand | VERIFIED live: `WS-216.json` carries `base_sha`, `pr`, `merge_sha`, `verified_on_main_sha` — **no `verified_on_main_sha` on the workstream was updated by the R8 post-merge reconciliation**: `verified_on_main_sha` still `74908e13` (R7 merge) while `merge_sha` = `87274cf9` (R8 merge; post-merge CI `38060781329` success). `ARCH-007.json` `next_action` correctly narrates R8 VERIFIED_ON_MAIN at `87274cf9`. `current-state.md` live main pointer says `87274cf9` while live `origin/main` = `8b3c9aeb` (PR #346 post-merge reconciliation merge; CI run `38061919149` success on the exact SHA). Convention (R7 precedent `86f8bec9`): a post-merge reconciliation updates **both** `merge_sha` and `verified_on_main_sha` to the implementation merge SHA. |
| R9-PF-N3 | Duplicate historical numbering around §161 / Entry 76 needs an append-only correction | VERIFIED live: `current-state-log.md` has two `## §161` sections (R7 pre-merge reconciliation; R8 waves — mislabeled, sits between §161 and §162); `AGENT-SEQUENTIAL-WORKLOG.md` has two `Entry 76` (R7 pre-merge reconciliation; R8 execution — mislabeled). Gate-A review additionally found unmarked duplicates `## §159` ×2, `## §160` ×2, and `Entry 47` ×2. Log tails: §165 / Entry 79 → next correct numbers are **§166 / Entry 80**. |
| R9-PF-N4 | Material R8-N1 inventory/evidence is externalized in PR-body context and needs a canonical in-repository evidence location | VERIFIED live: the in-repo `R8-N1-PWA-PRECACHE-ROOT-FIX-EXECUTION-REPORT-2026-10-10.md` §4/§6/§8 explicitly defers the machine-verified unique-URL set comparison, the verbatim guard output, and the exact final-head CI/Cloudflare run URLs to "the PR evidence"/"the PR body" — PR bodies are not versioned repository artifacts. Repair: canonical annex under the R8 evidence directory. |
| R9-PF-N5 | Stale plan §23.8/addendum wording needs a dated correction | VERIFIED live: `REFACTORING-ARCHITECTURE-AND-MIGRATION-PLAN.md` §23.8 dated addendum (R6-W1, 2026-10-09) says "R7 (لم يبدأ)" and "R8 (لم يبدأ)" — both are VERIFIED_ON_MAIN (74908e13 / 87274cf9). Also the successor plan/contract/README/CONTROL status lines say "R9 PREFLIGHT GATE / implementation not started" — superseded by the owner's acceptance of the preflight and authorization of W1+W2+W3. |
| R9-PF-N6 | One guard metadata row under-claims the guard's actual verified surface | VERIFIED live (preflight Reviewer 4): `REFACTORING-PLAN-A-TO-Z.md` §4.3.1 row `check-acceptance-value-anchors` (:205) still says it proves anchored values "match between their two registered sites" with a deferral-era does-not-prove column — but the implementation has pinned **4 consumption sites + 2 canonical lists since R4-B2/R4-REC-5 and 6 GUARDED_UNION families since R6-W2/F-024** (11 SITES entries, `check-acceptance-value-anchors.mjs:36-50`). The inverse of the Q-b over-claim class: metadata claims LESS than the guard proves — a refresh candidate, not a soundness defect. (Gate A additionally found a second, distinct under-claim: the `check-bundle-surfaces` row does not yet document the R8-N1 `DUPLICATE_PRECACHE_URLS` fail-closed guarantee — tracked as R9-GA-F6 in the repair cards and corrected in the same W1 pass.) |
| R9-PF-N7 | Theoretical precache blind spot: preserve with a bounded trigger, not a generic defer | Preserved as a bounded theoretical risk (see repair card R9-PF-N7): the guard proves no duplicates and per-surface budgets, but the *intended* offline asset set is not machine-defined — a future public asset class outside `globPatterns` extensions would be silently not-precached. Bounded trigger recorded. |
| R9-PF-N8 | Informational counting facts (layer/test corpus) | Recorded precisely, no defect invented: port 130 methods (types.ts:429-884); 16 capability groups (48 files) covering 107/130, 23 uncovered by documented KEEP; 9 commit guards symmetric in both adapters (110 unit tests); 37 object stores / 35 snapshot families; 25 accepted version pairs + 27 sha256-pinned goldens with 25/25 pair coverage; domain tests 36 in `tests/domain/` + 1 root + 1 colocated; application 146 prod + 141 test files across 36 houses (29 doors, 7 doorless); storage 55 prod + 47 test; 60 pages + 13 page test files + 74 root dom journeys; 66 routes covering all 60 pages (2 documented redirects); 49 contract docs (5 literal / 40 curated / 9 documented-reason links); 19 guards documented == 19 live. |
| R9-PF-N9 | Informational journey-depth facts | The six W7 journeys are single-happy-path, shared-file evidence (real page + real service + read-back through a second service instance; navigation mocked, notification spied); the five stateful pages get per-page direct behavioral files in W3 (mission, not defect); `SharePreview` stays surface-only (rationale recorded); preflight Reviewer 3 noted the CashWalletEditor read-back asserts the wallet name but not the declared opening balance (75 → 7,500 minor) — an INFO depth note addressed by the W3 direct tests, not a defect. |
| R9-PF-N10 | Informational parity/caution facts | Behavioral parity is asserted in-lens for 9/16 capability contract tests (rejection/stale paths); the other 7 (actualTime, asset, costEstimate, directSale, inventoryMaterial, schedule, supplierPurchase) carry success/reuse-only lenses with equivalent rejection evidence in guard unit tests + dual-adapter deep suites (a documentation/expectation question, not a missing-safety question). Contract-39 requirement 4 (post-restore MIC display) lives at the UI layer. EXE-014's pre-replace backup is returned to the caller (not persisted by the store). IndexedDB upgrades are forward-only (export/restore is the documented recovery path). R3-era counting-convention drift ("54 tests" = runtime instances vs 53 live `it(` declarations in the 9 newer capability files). check-secrets/test-focus recorded file counts are point-in-time evidence, not live assertions. |

## 2. Open verification questions carried into W2

- **Q-h (durable snapshot replacement):** mechanisms and artifacts exist
  (`readSnapshot`/`replaceSnapshot`, contract 39 atomic envelope, existing single-
  transaction and rollback tests), but no direct rehearsal record proves the full
  **backup → failed replace → previous state intact → restore** cycle end-to-end.
- **Q-i (migration/re-derivation failure paths):** the existing cursor-error test
  proves upgrade-abort rollback for one legacy family; no rehearsal record proves the
  full **pre-migration capture → migration failure → no partial durable state →
  recovery → compare** cycle, and the imported-snapshot re-derivation failure path is
  only covered in memory (mock), not as a durable-recovery cycle.

## 3. Five-page direct-test obligation (W3)

`CashWalletEditor`, `CashReversalEditor`, `G5DeclarationEditor`,
`InventoryReversalEditor`, `ReceivedLoanDetail` — previously represented by
named-reference or adjacent evidence (the shared `SmokeOnlyPagesJourneys.dom.test.tsx`
single-happy-path W7 journeys; no per-page direct test files exist — verified
`git ls-files 'apps/prototype-web/client/src/pages/*.test.tsx'`).
`SharePreview` is not silently included: it remains a documented surface-only
presentation case (draft body display, copy/share outcome, empty state — all already
exercised by the W7 journey; no stateful page journey exists to add).

## 4. Owner acceptance

The owner accepted these findings and authorized R9 complete remediation W1+W2+W3 on a
single branch with one PR, no merge, and the protected invariants
(`localSchemaVersion=38`, `localExportVersion=30`, bundle ceilings 650,000/155,300,
lint ceiling 37, protected UI branch) unchanged. Acceptance provenance: the R9
execution authorization supplied to the executor (2026-10-10).
