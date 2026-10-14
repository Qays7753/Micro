# R11 W1A-1 — Pure Guards Wave Evidence (D-01 / D-04 / D-05 / D-07)

**Wave ID:** R11-W1A-1 | **Branch:** `refactoring/r11-s0-w1a-20261013` | **Base:** `5ef4ce08841bcd4ff7c5fb185a0fe2eeef6852fd` (verified live, no drift)
**Wave head at gate:** `c160f8ae` | **Gate date:** 2026-10-14 (UTC)
**Decision authority:** OD-GUARD Option A + OD-10 Option A (owner-approved 2026-10-13)

---

## 1. Commits in this wave

| Commit | Scope |
|---|---|
| `49f8968a` | Governance claim: ARCH-008 item + WS-217 workstream (CLAIMED) + regenerated OC views; validate.py green |
| `288db0a1` | S0 (documented separately in the S0 evidence file) |
| `aa84fd6b` | D-01 — rule R8 (type-only UI→storage ratchet, baseline 19) + ImportEqualsDeclaration collection |
| `6709c0b9` | D-04 — read-like corpus membership + property guard (baseline 63) |
| `6d3351a1` | D-05 — exact lint warning tripwire (35 = 18+17; ceiling 37 untouched) + guards-chain registration |
| `b134d3d8` | D-07 — rule R9 (house-pair ratchet on the full census 128/80/48) + census artifact |
| `c160f8ae` | test-map regeneration (generated view; never hand-edited) |

## 2. Baseline verification matrix (every number with its reproduction method)

| Guard | Baseline | Reproduction method | Live result at wave head |
|---|---|---|---|
| D-01 (R8) | 19 keys | `collectAllImports` (the guard's own collector): UI_LAYERS ∩ kind=type ∩ resolved→storage; all 19 keys pinned in `UI_TO_STORAGE_TYPE_BASELINE`; the 17-key historical subset (`UI_TO_STORAGE_TYPE_BASELINE_HISTORICAL_17`) verified a strict subset (tests pin the exact 2-key app-shell delta) | **19/19 live edges, zero violations** — `node scripts/check-module-boundaries.mjs` PASS |
| D-04 | 63 files | recorded predicate: non-test `.ts` under `application/`, house ∉ {finance, owner-money, financial-records, budgets, transfers}, text free of `/(save\|commit\|delete\|replace\clear)[A-Z][A-Za-z0-9_]*\s*\(/` — the exact method reproducing the owner-approved lineage (62 at R10-B base ffc54eb1 → 63 live; the two method-boundary files `preferences/preferenceService.ts` + `drafts/legacyFormDraftMigration.ts` are TEXT-classified writers because they define save/clear methods) | **63/63 corpus files, zero violations** — `node scripts/check-application-readwrite.mjs` PASS |
| D-05 | 35 warnings | `node scripts/check-lint-warning-baseline.mjs` (spawns eslint with the exact pnpm-lint targets, `--format json`, no `--max-warnings`) | **35 exactly = 18 max-lines-per-function + 17 complexity, 0 errors** — PASS; ceiling 37 byte-identical in package.json `lint` |
| D-07 (R9) | 128 edges = 80 value + 48 type; 42 governed pairs (21v+42t); 65 exempt-target; SCC 2 value + 1 type | `collectHouseEdges` over `collectAllImports` (type-dominant classification: any type-only site ⇒ edge is type); census artifact `scripts/application-house-edges-census.json` (schema `micro-application-house-edges-census/1`) with provenance (base SHA, method, authority) | **128/80/48 live, exact census match, all exemption invariants hold, SCC exact match** — PASS |

### D-07 census details (recorded in the artifact, reproduced by the guard every run)

- Exempt leaf modules (OD-10): `application/time/clock.ts` (49 inbound edges; allowlist `["@micro-domain/shared/index.js"]`), `application/formatting/formatters.ts` (14; same allowlist), `application/identity/buildIdentity.ts` (2; zero imports). Root file `application/resultCodes.ts` legal-by-definition (its single import = ADR-012 single-sourcing of two pure string constants from `@/storage/local/resultCodes`, recorded as a dated allowance).
- House-level SCC baselines (the full 128-edge graph): value `{finance, financial-analysis}` + `{preferences, time}`; type `{collections, finance, financial-analysis, fulfillment, recurring}` — exact-match enforced in both directions (new OR resolved cycles fail until same-PR re-anchor).
- Review candidate (reported, not moved, not exempted): `inventory/materialUnitLabels` — pure MaterialUnit label vocabulary (R10-B3), target of 1 cross-house edge.
- Root files are out of R9 scope on both sides (shared-by-definition); verified zero root-file→house-interior edges live.
- The two dual-kind pairs (`finance/index.ts → recurring/recurringExpenseService.ts`, `fulfillment/fulfillmentService.ts → scheduling/scheduleService.ts`) classify TYPE under the type-dominant rule — the only arithmetic reproducing the recorded 80/48.

## 3. Test matrix (focused per commit, full gate at the wave head)

| Commit | Focused tests | Result |
|---|---|---|
| `aa84fd6b` (D-01) | `npx vitest run scripts/check-module-boundaries.test.mjs` | 27/27 green (9 new R8 fixtures: growth, mixed=value, all-type list, export-type, import()-type, relative spelling, require() spelling, stale, swap; live 19/19; historical-17 subset invariant) |
| `6709c0b9` (D-04) | `npx vitest run scripts/check-application-readwrite.test.mjs` | 16/16 green (7 new D-04 fixtures: live 63/63, growth, property (definition counts), stale, swap, text-writer exclusion, scope predicate) |
| `6d3351a1` (D-05) | `npx vitest run scripts/check-lint-warning-baseline.test.mjs` | 10/10 green (synthetic +1/−1/rule-mix drills with distinct messages; JSON parsing; target parity; CLI usage) |
| `b134d3d8` (D-07) | `npx vitest run scripts/check-module-boundaries.test.mjs` | 38/38 green (11 new R9 fixtures: live 128/80/48, census fail-closed ×2, matching tree, new pair, cap growth, stale edge, exempt drift, 3 exemption revocations, new+resolved cycles, type-dominant classification) |
| Wave head `c160f8ae` | **full `pnpm check` chain** | **exit 0** — OC tests 9/9 + validate; typecheck; lint 35≤37; format; text-density; design-guards; **all 20 guards** (18 prior + lint tripwire + [money monitor pending W1A-2]); root vitest **850/850** (71 files); app typecheck; app vitest suite green; `prototype:build` → bundle-budget **PASS raw 631,903/650,000 + gzip 155,290/155,300**; check-bundle-surfaces **PASS** (lazy 102, initial 2, dynamic roots 70, precache 157, swRuntime 2 — all at recorded baselines) |

## 4. Diff-scope verification (no protected surface touched)

- `git diff --stat 5ef4ce08..c160f8ae` touches **only**: `scripts/**` (guard code + tests + census + ratchet data), `docs/**` (evidence + doc-index + OC records + generated views), `package.json` (guards chain +2 commands; `lint` line byte-identical).
- **Zero production files** under `src/` or `apps/prototype-web/client/src/` — the emitted JS cannot change (build inputs identical); verified by the build itself passing at the recorded surfaces.
- Schema 38 / Export 30 / Legacy 24 / Goldens 27 + MANIFEST / 130 store methods / transaction semantics / rejection precedence: untouched (no storage or domain file in the diff).
- Ceilings: lint 37 (untouched), raw 650,000 + gzip 155,300 (untouched, PASS with 10-byte gzip margin locally; CI is the authoritative environment and runs the identical no-production-change diff).
- File-size ratchet: every growth ledgered in the same commit (`R11-W1A1-D01-…`, `R11-W1A1-D04-…`, span entry `R11-W1A1-D0X-…-R8-R9-SPAN` 431→822 with the honest SPLIT_CANDIDATE band escalation documented, census artifact 891 nbLoc ledgered); the D-05 script and S0 scanner seeded with NORMAL baseline rows.

## 5. Reviewer amendments folded (traceability)

All five read-only reviewer reports (RV1–RV5, pre-implementation) are recorded with the execution report. W1A-1-relevant amendments folded: RV1's corrected D-07 figures (42 pairs/21v+42t; SCC 2v+1t), ImportEqualsDeclaration bypass closure, pinned exemption allowlists, syntactic purity proxy wording; RV2's corpus footnote (localDiagnosticsService `localStorage.setItem` — recorded as R11-W1A-NF-001) and store-port write-vocabulary coverage note; RV4's per-commit ledger mechanics, census fail-closed loading, guards-count correction, CLI exit-code tests; RV5's same-commit doc-index row for evidence files.

## 6. Known limitations

- D-04's text predicate classifies a file defining write-vocabulary methods as a writer even if it never calls them (strict direction; documented, intentional — it is what reproduces the owner-approved 63).
- D-05 adds ~10 s to the guards chain (a second eslint execution inside `pnpm check`; the `lint` script and ceiling are untouched).
- The module-boundaries guard crossed the 800-nbLoc SPLIT_CANDIDATE band with R9 — an honest band escalation recorded in the ledger; splitting guards into helpers is explicitly out of W1A scope (owner decision OD-GUARD boundaries), so the disposition (owner review at PR time) is recorded rather than acted on.
- The R9 census requires same-PR bookkeeping rows for new exempt-target edges (deliberate strictness: the exact silent-growth failure mode R10-B3 demonstrated).
