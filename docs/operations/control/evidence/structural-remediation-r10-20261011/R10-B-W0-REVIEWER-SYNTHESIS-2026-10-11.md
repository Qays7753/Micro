# R10-B W0 — Reviewer Synthesis (RV1–RV5)

**Date:** 2026-10-11 · **R10B_BASE_SHA:** `ffc54eb1150932c9bba88b48a7c38275f2a3effa` (live `origin/main` at W0 preflight; identical to R10-A's AUDIT_SHA_X — no drift between the audit and this reconciliation)

---

## 1. Reviewer identities, scopes, independence

| Reviewer | Role (canonical prompt §6) | Report |
|---|---|---|
| RV1 | Architecture / module boundaries / sources of truth | `R10-B-W0-REVIEWER-REPORTS-2026-10-11/reviewer-1-architecture-module-boundaries.md` |
| RV2 | Domain / finance / storage / transfer / history | `.../reviewer-2-domain-finance-storage-transfer.md` |
| RV3 | UI structure / runtime / accessibility / journeys | `.../reviewer-3-ui-structure-runtime-a11y.md` |
| RV4 | Tests / guards / CI / security-adjacent operability | `.../reviewer-4-tests-guards-ci-operability.md` |
| RV5 | Documentation / Operations Control / SOP / handoff | `.../reviewer-5-docs-opscontrol-findings-handoff.md` |

All five executed read-only at the verified HEAD (`git rev-parse HEAD` == `ffc54eb1…` recorded in each report; clean tree verified before and after). No reviewer wrote to the repository, branch, PR, or generated tracker files; scratch remained outside the clone. Each report records commands executed, files/symbols/line-ranges inspected, confirmed/disproved/refined findings, related-pattern searches, unverified limits, recommended classifications, and a no-writes statement. The R10-A package was available to them only as untrusted claim input; every conclusion was re-derived from live source.

Independence caveats (recorded honestly): (a) all five reviewed the same SHA in the same wall-clock window (correlated-blind-spot risk); (b) none executed the test suite (read-only by design — execution evidence remains the R10-A replay at the same SHA plus the post-W0 wave testing to come); (c) the five were launched and synthesized by the primary executor, so selection bias cannot be excluded — mitigated by the primary's own re-verification of every disputed row (below).

## 2. Re-verification verdicts on the 37 R10-A findings

| Verdict | Count | IDs |
|---|---|---|
| CONFIRMED as stated | 27 | F-001, -002, -004, -005, -007, -009, -010(oracle), -011, -013, -015, -016, -017, -018, -020, -022, -024, -025, -028, -029, -030, -031, -032, -033, -034, -035, -036, -037 |
| CONFIRMED with material refinement | 6 | F-006 (scope precise), F-008 (denominator clarified), F-012 (**understated** — see §3), F-019 (62 not 64), F-021 (real family 18 files/45 lines, guard-frozen), F-027 (cannot mask pass/fail; inventory-only gap) |
| REFINED with corrected evidence | 3 | F-010 (CESU-8 deviation latent/unreachable — oracle gap stands), F-022 (contract 40:**18**, not ~89), F-026 (35/37 = 2 slots headroom; "saturated" imprecise) |
| DISPROVED | 1 | **F-023** (CONTRIBUTING audit-policy pointer does not exist at the SHA nor in its 2-commit history — FALSE_POSITIVE, retraction recorded in the matrix; the real dangling-pointer family became R10B-NF-031/-032) |

All four S2 findings (F-003, F-009, F-016, F-024) were re-confirmed from live source with sharpened evidence:
- **F-003**: exact member-order divergence verified; sibling file imports the canonical type (both patterns coexist in one house). RV1 assesses S3 (no runtime defect) — the R10-A S2 classification is retained in the matrix as the audit-of-record with the disagreement noted; disposition is FIX_NOW either way.
- **F-009**: the complete 31-array + 4-singleton family matrix was rebuilt; the 4 owner families are the ONLY full gaps; end-to-end exploit traced (re-seal → migration `[]` → gate pass → counts pass → replaceSnapshot clears owner stores → re-export launders); aggravating nuance: present-but-non-array owner values are silently coerced (unlike `inventoryShortages` which rejects) → R10B-NF-009 folds into RC-1; golden impact precisely enumerated (2 current-pair goldens + MANIFEST + counters characterization; legacy goldens unaffected).
- **F-016**: post-mount crash IS announced (new `<main role=alert>`) but focus falls to `<body>`; root-fix options A/B/C designed (A = componentDidUpdate transition, recommended), fallback visuals preserved in all.
- **F-024**: full chain verified (`.replit:17–19` → `post-merge.sh:4` → `check-bundle-surfaces.mjs:97–106` → `null` → FAIL `:418–423`); consumers inventoried; A/B/C decision package complete (§4 of RV4's report); broken since R8-1 (`c70d3eed`).

## 3. Conflicting conclusions and their resolution (evidence source retained)

1. **F-023 (RV5 DISPROVED vs R10-A CONFIRMED).** Resolution: DISPROVED. Two independent methods (RV5's full-history analysis; the primary reconciler's own re-read of all 31 lines + repo-wide search for any audit-policy doc) found no pointer. The original claim came from R10-A's RV4-F01 and was never primary-verified (outside the S3 sample). Retraction recorded in the canonical matrix (R10A-F-023 record) and in R10B-NF-034; owner asked to acknowledge during PR #352 review.
2. **F-012 severity/scope (RV1 "understated" vs R10-A "three generators").** Resolution: REFINED-UNDERSTATED. RV1's census (~19 application implementations + ~41 UI sites, ≥5 shapes) is retained as the family inventory; the actionable core is the 4 services with no insecure-context fallback (`assetService.ts:128`, `loanService.ts:88`, `receivedLoanService.ts:96`, `retainedDepositService.ts:65`) — FIX_NOW; the consolidation is an owner card.
3. **F-003 severity (RV1 S3 vs R10-A S2).** Resolution: S2 retained as audit-of-record (duplicate source of truth on a domain vocabulary with divergence already started); RV1's no-runtime-defect observation recorded in the matrix; FIX_NOW either way.
4. **F-019 count (RV3 62 vs R10-A 64).** Resolution: 62 (RV3's programmatic census); the matrix records the corrected count.
5. **F-022 location (RV3 line 18 vs R10-A "~:89").** Resolution: line 18 (verified); matrix corrected.
6. **PILOT_EVIDENCE_REQUIRED count (R10-A "17" vs live tracker 14).** Resolution: canonical = **14** (`gate_classification=PILOT_EVIDENCE_REQUIRED`: BE-004, BE-005, V-001..V-012). RV5's census is machine-derived from the live items; R10-A's 17 was most plausibly BE-001..003 counted by family (DUPLICATE_HISTORICAL). Recorded as R10B-NF-034(a).
7. **"3 BLOCKED carry exact blockers" (R10-A §7 Lens B vs RV5).** Resolution: refuted for 2/3 — LEGAL-001's cited blocker (FIN-007) has been VERIFIED since 2026-09-22; DEVICE-001's cited REL-001 VERIFIED since 2026-09-23. Dated corrections = R10B-NF-027/-028 (B1 batch). PILOT-001's blocker stands.
8. **INDEPENDENT-TRACKS attribution (R10-A §5/§12 vs RV5).** Resolution: the L-C/L-E/L-G/V7/V10/V12 comparison rows live in R0-LIVE-BASELINE §6.4 and plan A.6–A.7; INDEPENDENT-TRACKS-RECORD.md holds R/S/T/U/V/W/X. Citation slip corrected (R10B-NF-034(b)).
9. **RECURRENCE_STALE_MESSAGE ownership (RV1 NF-7 vs RV2 A4).** Resolution: assigned to RV2's domain (adapter message identity); consolidated as F-011 + R10B-NF-010 (family ≈45 literals, zero `.message` assertions).

## 4. Systemic search (W0-C) outcome per family

| Family searched | Result |
|---|---|
| Duplicated exported types/unions/interfaces | Only 2 real duplications repo-wide (WasteContext F-003; CapabilityId F-004) + 3 new smaller ones (NF-001 `'__unset__'`, NF-002 MaterialUnit labels, NF-003 ThemePreference); documented re-exports verified benign |
| Persisted families vs counters/required-arrays | Complete matrix: 4 owner families = only full gaps (F-009 + NF-009); 9 required-but-uncounted (NF-013, OD-8); `satisfies`-registry precedent identified as the RC-1 mechanism (RV2 design note) |
| ErrorBoundary / focus paths | 17 focus-path entries inventoried; F-016 confirmed; NEW: no route-change focus management + no per-route `document.title` (NF-015); AgreementEditor error branch (NF-016); S4 dialog/overlay residuals (NF-017/-018) |
| Error-announcement channels | 125 `role=alert` + polite channels (`Notice.tsx:52-66`, `Field.tsx:56`) both outside R9 inventory; 124 status + 17 aria-live; 54/54 loading = status (F-017 confirmed+extended) |
| Environment detection / CI markers | 8 callers inventoried with fail-open/closed classification; the only fail-open nuance is the ratchet's `CI="1"` handling (NF-021); Replit hook = F-024 (A/B/C package) |
| ID generators | ~19 app + ~41 UI sites, ≥5 shapes; 4 no-fallback services = FIX_NOW core (F-012 + NF-006) |
| Free-text money/date/error literals | ~45 duplicated adapter messages (NF-010); domain label vocabulary bypassed at 4 sites (NF-007); throw-message `/100` inclusions = 11 frozen sites (RV2, benign) |
| UI copies of domain derivations | 18 files / 45 lines frozen by `moneyLayerGuard.contract.test.ts:48-67`; all 7 R10-A sites verified; highest-drisk mirrors named (F-021 refined) |
| Read/write-like storage methods & test coverage | 130/130 parity re-verified programmatically; 6 corpus gaps (F-008 refined); 3 never-named-anywhere methods exercised indirectly |
| Guards with positive-only tests / textual detection | 27-unit trust matrix: negatives ranked (2 Python design guards = none → F-030; 5 positive-only JS guards listed; ratchet textual issues F-028); 12-baseline authorization verifiability matrix (systemic generalization of F-028) |
| Stale documentation pointers / generated-view drift | 732+1 relative links swept; 2 live dangling pointers (NF-031/-032); context.md live-state staleness (NF-029); generated views verified fresh by independent digest reimplementation (would pass `--check`) |
| Handoff/SOP/agent discovery gaps | F-032/-037 confirmed with exact locations; storage-parity routing weakest link re-confirmed |
| OUT_OF_SCOPE / BLOCKED / DEFERRED / PILOT completeness | F-034 confirmed; BLOCKED blockers 2/3 stale (NF-027/-028); 20 DEFERRED all carry reason+next-action (per-item assessment in RV5 §B.2); PILOT canonical 14, detection-method gap stands |
| Application-internal seams | NEW: 108 ungoverned cross-house deep imports inside the application layer (NF-005, OD-10) |
| Static-analysis boundaries | NEW: 226 prototype `*.test.ts` untypechecked (NF-020); vite.config + tsconfig.node.json dead wiring (NF-022); micromatch-shim unlinted (NF-023); Python skips unguarded (NF-024); `.fails(` missing (NF-026) |

## 5. New findings consolidated

34 stable new IDs (R10B-NF-001..034) were assigned from the reviewers' proposals, with overlaps folded (RV1-NF-7 → F-011; RV2-N4 → RC-1 design note; RV3 cosmetic nits → NF-019; RV4 hook-timeout → F-024 package; RV4 action-refs/persist-credentials → F-025; RV4 multi-match → F-027; RV5 N7 → NF-029). Every new finding carries the full canonical record in `R10-B-FINDINGS-MATRIX-2026-10-11.json`.

## 6. Synthesizer verification (primary)

The primary executor independently verified: the live baseline (fetch, `origin/main` == `ffc54eb1…`, PR #351/#352/#344 heads not ancestors of main, no branch-name collision), the F-023 disproof (full CONTRIBUTING.md read + repo-wide search), the three protected baselines (fc2ae6e7 / 25594773 / 5eacbe38 exist and are ancestors), the PILOT 14-vs-17 resolution (machine census), and spot-reads of every S2 evidence site cited by the reviewers. Conflicts in §3 were resolved by retaining the evidence source for each conclusion in the matrix records.

## 7. Unverified limits of the W0 review set

No test/guard/build execution (read-only W0); lint warning count 35 taken from in-repo evidence, not re-run; bundle surfaces not re-measured; real-browser/AT behavior not exercised (E-UNV-001/-002/-004 bounds); GitHub API rate-limited — PR metadata verified via git refs only (E-UNV-007); external Documents-repo instruments for V-items not reachable. None of these converts to a PASS claim anywhere in the W0 artifacts.
