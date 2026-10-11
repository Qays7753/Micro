# R10-B W0 — Repair Cards (owner-gated; NO code remediation performed in W0)

**Date:** 2026-10-11 · **R10B_BASE_SHA:** `ffc54eb1150932c9bba88b48a7c38275f2a3effa` ·
**Status:** all cards below are PROPOSALS for the owner-gated waves R10-B1..R10-B6. Nothing in this document has been implemented. The four S2 cards (RC-1..RC-4) are the mandatory minimum; every other FIX_NOW finding is grouped into coherent waves. DEFER cards carry the full trigger/detection/review/exit set in the findings matrix.

---

## RC-1 / R10A-F-009 (+NF-009, NF-013) — Owner-money tamper-evidence gates [S2, Wave R10-B2]

**Scope.** Add the 4 owner-money families (`ownerEntitlementPolicies`, `ownerEntitlementRecords`, `ownerEntitlementOpeningBalances`, `ownerMovements`) to: (a) `LocalExportCounts` + `exportCountsOf` (count-only hardening; export version stays 30 — counts are additive keys); (b) the required-array gate for **current-pair** files with present-must-be-array semantics (mirroring `inventoryShortages` :91-93 — this also closes NF-009's silent coercion); (c) a new tamper test that drops the families from a re-sealed current-pair file and asserts rejection; (d) counters characterization extension. **Legacy acceptance unchanged** (24 legacy pairs keep optional-if-absent — pinned by `ownerEntitlementTransfer.test.ts:257-294`).

**Protected surface.** Export/import bytes, legacy acceptance, owner-ledger evidence. Financial meaning untouched (count/gate only).

**Golden impact (owner must accept — OD-8).** 2 current-pair goldens + MANIFEST regenerate via `GOLDEN_UPDATE=1`; `transferCounters.migrations.characterization.test.ts:32-36,66` updates. Legacy goldens unaffected (no counts blocks).

**Scope decision (OD-8).** Minimal: 4 owner families (the only full gaps). Uniform: also count the 9 required-but-uncounted families (NF-013) for symmetric tamper evidence — larger golden churn, one-time.

**Mechanism option (RV2-N4).** Derive counters/required-arrays from a `satisfies Record<keyof LocalStoreSnapshot, …>` registry (the `influentialSnapshotFamilies.ts:22-114` precedent) so "forgot the counters" becomes a compile error. Recommended if uniform scope is chosen; optional under minimal scope.

**Tests.** New drop-and-reseal tamper test; present-but-non-array rejection test; legacy-pair acceptance suite; counters characterization; full transfer/golden/tamper suites; dual-adapter parity.

**Acceptance.** Re-sealed current-pair file missing any owner family → REJECTED; non-array owner value → REJECTED; legacy files still import; new exports carry the 4 count keys; 38/30 unchanged.

**Rollback.** Single commit revert (gates + goldens re-pinned); no data migration.

---

## RC-2 / R10A-F-003 — WasteContext single source of truth [S2, Wave R10-B3]

**Scope.** `import type` the domain union in `inventoryMovementEditorModel.ts`, delete the local re-declaration (:114-119), add a duplication-guard test; note the new dependency direction (application→domain type import — the sanctioned pattern; sibling `inventoryMaterialModel.ts:14` already does it).
**Tests.** Editor-model unit tests; module-boundaries guard; typecheck; duplicate-symbol scan.
**Acceptance.** Single declaration; guard green; zero behavior change (type-only).
**Rollback.** Single commit revert.

## RC-3 / R10A-F-016 — ErrorBoundary post-mount focus [S2, Wave R10-B4]

**Scope.** Move focus into the render/transition path when `hasError` becomes true after mount — recommended option A: `componentDidUpdate` transition keyed on `state.hasError` (RV3 evaluated options A/B/C; C (incidentId-keyed) rejected — steals focus / fails when recorder fails). Add a behavioral DOM test covering BOTH mount-time and post-mount crash paths.
**Protected surface.** Fallback visual design byte-identical (DOM structure of the fallback unchanged except focus management).
**Tests.** New post-mount-crash jsdom test (focus lands inside fallback) + existing mount-time test; component suite.
**Acceptance.** Both crash paths move focus; no visual/CSS/copy change.
**Rollback.** Single commit revert.

## RC-4 / R10A-F-024 — Replit post-merge hook [S2, Wave R10-B5; owner picks A/B/C — OD-9]

**Complete A/B/C comparison** (full table in RV4 report §4/F-024): 
- **A — drop `export CI=1`:** nothing else in the hook reads CI; guard stays fail-closed; FP risk: Replit Node-20 gzip vs local anchor unproven (convergence proven only Node 22/24); `timeoutMs=180000` suspect (RV4-N4).
- **B — documented Replit alias in `detectEnvironment` + anchored `replit` baseline:** strongest if the hook is load-bearing; marker choice (`REPL_ID`/`REPLIT_DEV_DOMAIN`) not statically provable; permanent external coupling; unit tests + `ANCHOR_RECORD` bootstrap path exist.
- **C — retire hook + `[postMerge]` + register/ratchet rows (RECOMMENDED DEFAULT):** broken since R8-1 (`c70d3eed`, 2026-10-10); zero current documentation; zero in-repo consumers besides `.replit`; CI + Cloudflare Pages anchor all real verification; Replit remains a dev workspace served by its Project workflows.
**Invariants (all options).** Unknown CI markers remain fail-closed.
**Rollback.** Single small commit revert (8-line hook + 3-line `.replit` + 2 doc rows if C).
**Tests.** B: `detectEnvironment` unit tests for the marker. C: grep-verify no dangling references; guard suite green.

---

## Wave R10-B1 — Tracker, evidence, and documentation closure (docs/control-only; no application behavior change)

**Cards:** F-001 (register removal notes), F-002 (ARCHITECTURE count), F-005+NF-008 (ADR-018 dated correction), F-007 (direction line), F-022 (contract 40:18), F-032 (todo.md routing ×3), F-033+NF-029 (phase-fact single-source + context.md pointers), F-034 (OUT_OF_SCOPE triggers ×3 — OD-3), F-035 (HARD gap note), F-036 (generator escaping fix + regen), F-037 (SOP + storage-parity view + transfer/legacy/golden view + guard proves/does-not-prove view), NF-027/-028 (BLOCKED reasons), NF-030 (PILOT-001 deps), NF-031/-032 (dangling pointers), NF-033 (BE phrasing), NF-034 (R10-A record corrections — effected by the matrix).
**Also in B1 (owner-approved additions):** PILOT detection-method specifications for the 14 canonical items (docs-only; OD-13).
**Checks:** `generate_tracker.py --refresh-excel-meta`, `--check`, `validate.py`, `check-doc-index-coverage.mjs`, `git diff --check`, `check-current-state-size.mjs`, plus the repository's canonical doc guards.
**Rollback:** docs-only commits; revert per commit.

## Wave R10-B2 — Protected import/export and data-integrity (RC-1 + test-coverage cards)

**Cards:** RC-1 (F-009 + NF-009 + OD-8 scope), F-008 (6 adapter direct invocations — test-only), F-010 (syncSha256 FIPS vectors + node:crypto cross-check + CESU-8 latent note).
**Protected invariants:** Schema 38 / Export 30 / legacy acceptance / financial meaning — verified by the full transfer/golden/tamper/parity suites after the change.
**Rollback:** per-commit revert; goldens re-pinned through the official path.

## Wave R10-B3 — Source-of-truth and module boundaries

**Cards:** RC-2 (F-003), F-004 (CapabilityId link + honest casts), F-011+NF-010 (message identity: conformance assertions + single-sourcing where bounded; NF-007 label vocabulary rides this scoping decision), F-012+NF-006 (4 insecure-context guards + DEFER card for consolidation), NF-001 (`'__unset__` consolidation), NF-002 (MaterialUnit label helper), NF-003 (ThemePreference import).
**Boundary guards:** door-surface baseline updates in the same PR as any door change; module-boundaries suite; duplicate-symbol scan.
**Rollback:** per-commit revert.

## Wave R10-B4 — Runtime, UI semantics, and journey coverage

**Cards:** RC-3 (F-016), F-015 (smoke/router reconcile), F-017 (error-channel inventory + consistency), F-018 (StateMarker role), F-020 (3 page tests), F-021 (bounded consolidation of highest-drift UI mirrors + moneyLayerGuard contract update), NF-015 (route focus + titles — OD-12 owner visibility), NF-016 (AgreementEditor state machine).
**Protected invariants:** no visual redesign, no navigation/copy/token changes; a11y-semantics changes only, each with tests.
**Rollback:** per-commit revert.

## Wave R10-B5 — Guards, CI, security-adjacent operability

**Cards:** RC-4 (F-024 per OD-9), F-025 (+RV4-N9 tripwire, RV4-N10 persist-credentials), F-027 (+RV4-N6 multi-match), F-028 (+NF-021 CI-semantics unification + direct-main drift policy + machine-verifiable authorization), F-029 (override removal), F-030 (Python guard negatives), F-031 (+NF-022 vite.config wiring), NF-020 (226 test files — own slice, expect surfaced type errors), NF-023 (tools/ lint), NF-024+NF-026 (test-focus Python + `.fails(`).
**Also scheduled here (from E-UNV research):** the E-UNV-008 live mutation drill for build-dependent guards (design ready).
**Rollback:** per-commit revert (guard changes individually revertible).

## Wave R10-B6 — Final systemic sweep

Repeat the W0-C family searches on the final tree; verify: no unclassified finding; no FIX_NOW item without implementation or explicit blocker; no untracked new defect; no stale generated view; no second source of truth introduced; no protected invariant silently changed; every changed file tested or justified; rollback possible at every wave boundary. Then the final execution report + PR-ready status.

---

## DEFER cards (precise, per the no-generic-defer rule — full fields in the matrix)

| ID | Item | Blocker/owner | Trigger | Detection | Exit |
|---|---|---|---|---|---|
| F-006 | type-only UI→storage ratchet | owner guard-policy scoping | next guards wave | type-import count vs baseline | ratchet + negatives landed |
| F-013 | MoneyMinor branding | owner decision (OD-11) | owner decision | n/a (policy) | ADR/registry decision recorded |
| F-014 | semantic date-slice exemption | owner-scheduled strengthening | next guards wave | negative fixtures | AST exemption landed |
| F-019 | readwrite-family extension | owner guard-policy | next guards wave | guard coverage diff | families extended |
| F-026 | lint-ceiling reduction plan | owner (ceiling governance verified live) | next lint-touching wave | CI lint count vs 37 | reduced or re-ceilinged via double-diff |
| NF-004 | PeriodRange rename | routine | next touch of either file | `rg PeriodRange` | renamed |
| NF-005 | application-internal seam policy | owner decision (OD-10) | OD-10 | edge census | policy + enforcement or documented open graph |
| NF-007 | domain label vocabulary adoption | B3 scoping decision | R10-B3 | `rg` label strings | labels imported |
| NF-011 | data-level extra-key rejection (strict mode) | owner (version-gated design) | next transfer wave | re-sealed extra-key test | strict mode live |
| NF-012 | confirmImport contract documentation | routine | next transfer API change | code review | documented/branded |
| NF-013 | counters uniformity (9 families) | OD-8 scope decision | with RC-1 | counts blocks | scope decided |
| NF-014 | app-layer ambient-time allowlist | owner guard-policy | next guards wave | `rg Date.now` | allowlist or documented boundary |
| NF-017/-018/-019 | dialog/overlay/cosmetic a11y residuals | UI track | next UI wave | census lists | contract applied / cleaned |
| NF-025 | secrets history scan | owner (documented limit now) | owner request / security review | one-off `git log -p` scan | tool or accepted documented limit |

No DEFER card lacks blocker, owner, trigger, detection, review, and exit. No finding is closed by documentation alone; the F-023 retraction is closed by disproof evidence, and its record correction is effected by this W0 publication.
