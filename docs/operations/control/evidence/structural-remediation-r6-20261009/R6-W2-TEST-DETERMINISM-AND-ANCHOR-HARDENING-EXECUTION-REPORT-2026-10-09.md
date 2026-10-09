# R6-W2 — Test Determinism and Acceptance-Anchor Hardening — Execution Report

**Program:** WS-216 / ARCH-007 — Structural Remediation R0–R10, R6 records wave 2
**Mode:** Test / guard only. Zero production behavior change: no file under `src/` or `apps/` production paths changed except **one test file**; no CSS, tokens, package, lockfile, schema, export, financial, historical, rejection, security, or UI change.
**Execution date:** 2026-10-09 — **Executor:** Z AI (single primary executor; five read-only review gates before commit)
**Base:** the verified W1 final head `b3048f2aeda4d55e77801effb9d93a051263375c` (PR #338 open at the owner gate; stacked lineage `main fd92d7e8 ← W1 b3048f2a ← W2`)
**Branch:** `refactoring/r6-w2-tests-20261009`
**Authority inputs:** the canonical R6 scan report + owner decision package on `main` (SHA-256 `e06a27a4…` / `13387db9…`, verified byte-exact in R6-W1; unchanged by this wave — both files byte-untouched in this diff).

---

## 1. F-001 — StateRecovery.w44.dom.test.tsx determinism root fix (test-file-only)

**Defect (VERIFIED, scan report F-001):** the loading-state test resolved its read on a **real** `setTimeout(30)`; under CI load the timer could commit between the `role=status` await and the synchronous `.micro-prim-empty` null assertion, rendering the empty state before the assertion ran (documented failure: run `37894104251` at `43a0f12`, `StateRecovery.w44.dom.test.tsx:116:57`; identical app bytes green on three other runs — racy test, not an app defect).

**Root fix applied (test file only — `apps/prototype-web/client/src/StateRecovery.w44.dom.test.tsx`):** the accepted deferred-promise/read-gate direction, adapted from the repository's own deterministic precedent `Home.dom.test.tsx:157` (`releaseRead` gate — "لا سباق ولا نوم"):

1. the test constructs a `gate = new Promise<void>` whose resolver it holds (`releaseRead`);
2. the mocked `assets.overview()` returns `gate.then(() => realService.overview())` — the read **cannot** resolve until the test releases it;
3. the loading/intermediate state is proven **before** the release: `waitFor(() => getByRole("status"))` then `expect(document.querySelector(".micro-prim-empty")).toBeNull()` — now structurally deterministic (the empty state is unreachable while the gate is held; the component renders loading and empty as mutually exclusive branches, `Assets.tsx:52-73`);
4. the read is released (`releaseRead()`), the real completion boundary is awaited (`waitFor` on the final empty-state text), and the final state is proven;
5. the premature-empty-state protection assertion is kept **verbatim** — not weakened, deleted, inverted, or replaced by a sleep;
6. `Assets.tsx` and every other production file untouched; no financial/historical/schema/export/import/rejection/UI behavior change.

**Determinism evidence (VERIFIED):** focused file run **14 consecutive green runs** on the fix tree (4 explicit + 10 in a counted loop; every run 6/6 tests passed, ~117 ms test time each). Determinism is structural, not timing-based: the intermediate-state assertions run while the read is provably pending. Full app suite on the same tree: **323 files / 2,388 tests passed** (single full run locally; CI re-runs on the pushed head).

## 2. F-024 — precise site inventory (delivered BEFORE the implementation, per the owner decision package)

The scan report named six GUARDED_UNION acceptance sets held only by characterization/goldens, absent from both the Wave-3B drift-anchor crew (`domainTransferDriftAnchors.ts`, 10 families) and the acceptance-value-anchor guard (4 consumption sites + 2 canonical lists). The complete inventory, live-verified at the W2 base:

| # | Site ID | Canonical domain source (file:line at W2 base) | Consumption site (validator, file:line at W2 base) | Accepted values (expected set) | Existing coverage before W2 | Kind |
|---|---|---|---|---|---|---|
| 1 | `inventory-movement-type` | `src/domain/inventory-material/types.ts:34` — `type InventoryMovementType =` (type-only, **unexported**) | `isInventoryMovementType` — `apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts:1064-1070` (hand-copied literals) | `opening, purchase_receipt, consumption, waste, adjustment, reversal` | characterization file references the symbol only (`void isInventoryMovementType;` :329 — no direct acceptance assertions); NOT in the drift guard | domain=production type decl; validator=production; anchor=guard |
| 2 | `catalog-item-kind` | `src/domain/catalog/types.ts:1` — `export const catalogItemKinds = ["product","service"]` (**runtime list, exported**) | `validCatalogItem` inline `value.kind === …` — `transferFamilyValidators.ts:1207` | `product, service` | description tests only; NOT in the anchor guard | domain=production list; validator=production; anchor=guard |
| 3 | `schedule-status` | `apps/prototype-web/client/src/storage/local/types.ts:273` — `export type ScheduleStatus =` | `isScheduleStatus` — `transferFamilyValidators.ts:78-79` | `scheduled, postponed, completed, cancelled` | characterization :120-121; NOT in the drift guard | domain=production type decl; validator=production; anchor=guard |
| 4 | `yield-readiness` | `src/domain/catalog/types.ts:116` — `type CatalogTemplateYieldReadiness =` (type-only, **unexported**) | `isYieldReadiness` — `transferFamilyValidators.ts:363-364` | `not_configured, ready, needs_conversion` | indirect (via `validCatalogTemplate` :1311); NOT in the drift guard | domain=production type decl; validator=production; anchor=guard |
| 5 | `short-cash-declaration` | `src/domain/financial-analysis/types.ts:2-4` — `export type G5Knowledge =`; `type G5Direction =`; `type ShortCashDeclarationKind =` (two unexported) | `validShortCashDeclaration` inline kind/direction/knowledge — `transferFamilyValidators.ts:1355-1391` | kind `declaration, reversal`; direction `collection, commitment`; knowledge `known, estimated, needs_review` | roundtrip/goldens only; NOT in the drift guard | domain=production type decls; validator=production; anchor=guard |
| 6 | `expense-context` | `src/domain/financial-event/types.ts:30-33` — `type ExpenseRelationship/ExpenseBehavior/ExpensePurpose/ExpenseKnowledge =` (all four **unexported**) | `isExpenseContext` inline relationship/behavior/purpose/knowledge — `transferFamilyValidators.ts:440-463` | relationship `project, shared`; behavior `fixed, variable, mixed, unknown`; purpose `project_general, period, order, product, campaign, unallocated`; knowledge `known, estimated, needs_review` | characterization :193-220; NOT in the drift guard | domain=production type decls; validator=production; anchor=guard |

**Why each site is not already covered:** the existing `check-acceptance-value-anchors.mjs` anchored only the four R4-era canonical-consumption sites (agreementContext, agreementService, guided walletKinds + materialUnits) and the two canonical lists (cashWalletKinds, materialUnits); the Wave-3B drift guard (`domainTransferDriftGuard.test.ts`) anchors ten **other** families (craft-order quartet, direct-sale collection, cash-continuity pair, FinancialEventType, MaterialUnit, UnitDimension). The six families above were documented in `TRANSFER_ACCEPTANCE_SOURCES` (transferCompatibilityValues.ts:95-118) as GUARDED_UNION with the literal set living in the validator — "guarded" only by characterization/goldens/description tests, i.e., drift between the domain union and the validator literals would not fail any guard.

**Characterization/golden evidence proving the intended accepted set:** the domain unions themselves (six sources above, live-verified), `transferFamilyValidators.characterization.test.ts` (isScheduleStatus :120, isExpenseContext :193-220), export goldens under `docs/fixtures/export-goldens/`, and the roundtrip suites — all consistent with the inventoried expected sets.

**Rollback boundary:** revert the single guard/test commit — zero production effect (no production file in the diff).

## 3. F-024 — implementation (guard + test only)

`scripts/check-acceptance-value-anchors.mjs` extended with a fourth section: for each of the six families, a **double pin** — the domain union (extracted from the canonical source text) == the validator's literal acceptance set (extracted from the validator window) == the documented expected set. Any drift on either side (a domain value added/removed, or a validator literal changed) fails the guard with a named anchor (`inventory-movement-type`, `catalog-item-kind`, `schedule-status`, `yield-readiness`, `short-cash-declaration`, `expense-context`). New exported helper `extractValidatorLiterals(source, anchor, fields)`; the PASS message enumerates the six families.

`scripts/check-acceptance-value-anchors.test.mjs` extended: fixtures for all six new site files + **13 new tests** (1 positive + 12 negatives — one domain-side and one validator-side mutation per family), each asserting the named anchor fires. File total 23 tests, all green.

**Boundary held:** the root fix (exporting domain runtime lists for canonical consumption — the 4D/STR-302 track) remains **owner-gated**; this wave does not export anything new from domain packages, does not touch any validator, and does not broaden any acceptance set — it only pins what exists.

## 4. Register discipline (same-PR measurement, STR-607)

`scripts/check-acceptance-value-anchors.mjs` 221 → **363 nbLOC (+142)** — NORMAL band (WATCH threshold 400), ratchet green; dated note added to register §7. Test file 206 → 360 nbLOC (test asset, not baseline-tracked). No threshold raised, no band changed, no baseline file edited.

## 5. Commands, exit codes, and repetitions

| Command | Result |
|---|---|
| focused `vitest run client/src/StateRecovery.w44.dom.test.tsx` (app) | **14 consecutive green runs** (6/6 tests each) |
| focused `vitest run scripts/check-acceptance-value-anchors.test.mjs` (root) | 23/23 passed |
| root suite `pnpm test` | **723/723 passed** (710 base + 13 new F-024 tests) |
| app suite `pnpm prototype:test` | **323 files / 2,388 tests passed** |
| `pnpm typecheck` + `pnpm prototype:check` | clean / clean |
| `pnpm lint` | 0 errors, 35 warnings (cap 37) |
| `pnpm format:check` | clean |
| `pnpm text-density` | within §10 caps |
| `pnpm design-guards` | 92 pairs pass |
| `pnpm guards` (17-guard chain) | exit 0 (secrets 1551/0; test-focus 385/0; file-size ratchet green; acceptance-value-anchors PASS with the six new families) |
| `node scripts/generate-test-map.mjs --check` | no drift |
| `git diff --check` | clean |
| PR CI on the exact pushed head | recorded in the PR body (runs on the head pushed by this wave) |

## 6. Five-reviewer gate results (read-only, before commit)

1. **Architecture/boundary:** changes confined to one app test file + two guard/test scripts + records; no production path touched; the stacked W2 branch from the W1 head keeps the one-writer lineage. PASS.
2. **Data/storage/domain:** the six pinned families are type-level acceptance sets; no domain file changed; no acceptance broadened; schema 38 / export 30 untouched; the 4D root remains owner-gated. PASS.
3. **Runtime/UI/changeability:** no runtime or visual change (test + guard only); determinism improves CI signal without altering behavior. PASS.
4. **Tests/CI/security/operations:** 14× focused repetition + full suites green; negatives prove the guard can fail; no secrets; ratchet/register discipline held (same-PR measurement note); rollback = single-commit revert. PASS.
5. **Hostile:** verified the F-001 assertion was NOT weakened (kept verbatim; the gate replaces only the read-resolution mechanism); verified no production file in the diff; verified the guard's expected sets match the live domain unions (live smoke PASS); noted honestly that CI must re-run on the pushed head before readiness is claimed. PASS_WITH_NOTES (CI-on-head noted; no W2-blocking finding).

## 7. Changed paths (complete)

1. `apps/prototype-web/client/src/StateRecovery.w44.dom.test.tsx` — F-001 releaseRead gate (test only)
2. `scripts/check-acceptance-value-anchors.mjs` — F-024 six-family double pin (guard)
3. `scripts/check-acceptance-value-anchors.test.mjs` — F-024 fixtures + 13 tests (test)
4. `docs/architecture/refactoring/FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` — §7 dated growth note
5. `docs/operations/control/evidence/structural-remediation-r6-20261009/R6-W2-TEST-DETERMINISM-AND-ANCHOR-HARDENING-EXECUTION-REPORT-2026-10-09.md` — this report
6. `docs/operations/control/workstreams/WS-216.json` + `docs/operations/control/items/ARCH-007.json` — JSON-first records (next_action/evidence/notes, append-only)
7. `docs/operations/current-state.md` + `docs/operations/current-state-log.md` (§157) + `docs/architecture/refactoring/AGENT-SEQUENTIAL-WORKLOG.md` (Entry 66) + `docs/architecture/refactoring/REFACTORING-CONTROL.md` — live fields + append-only history
8. `docs/operations/control/generated/*` — regenerated from the corrected JSON by the official generator only

**Explicitly unchanged:** every file under `src/` (domain), every production file under `apps/prototype-web/client/src/` except the single test file above, `domainTransferDriftAnchors.ts`, `domainTransferDriftGuard.test.ts`, `transferFamilyValidators.ts`, `transferCompatibilityValues.ts`, all six domain/storage canonical sources, CSS/tokens/package/lockfile.

## 8. Schema/Export/financial/history/rejection/security/UI impact

**None.** No production behavior file changed. `localSchemaVersion=38` / `localExportVersion=30` untouched. Acceptance sets unchanged (pinned, not broadened). The F-001 change strengthens a test that protects the "no zeros before the read completes" contract.

## 9. Risks and rollback

Risk: a guard regex that mis-extracts a validator window could false-fail — mitigated by the live-repo smoke PASS + 13 negative/positive tests pinning the extraction behavior. Rollback: revert the W2 commit(s) — no code or data effect; the register note is dated and append-only.

---

R6_W2_EXECUTED_ON_BRANCH — PR_NEXT
TEST_AND_GUARD_ONLY
NO_PRODUCTION_CHANGE
NO_MERGE_PERFORMED
NO_CLEANUP_PERFORMED
