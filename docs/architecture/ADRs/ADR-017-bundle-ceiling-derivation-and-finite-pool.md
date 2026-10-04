# ADR-017: Program-level bundle ceiling derivation — general estimator, finite remaining pool, and the Wave F slice 3 adoption

**Status:** Accepted (Wave F slice 3 policy gate — owner directive 2026-10-04)
**Owner:** Micro owner (directive-approved one-time adoption); ceiling arithmetic and pool below.
**Supersedes in part:** ADR-012's ceiling-value statement (155,000 gzip) — only the value; ADR-012's profile-first / reduce-first / last-resort-raise policy remains fully in force. D-034's raw ceiling (650,000) is untouched.

**Context:** Wave F slice 3 (`inventoryMaterialService` internal split, ADR-014/STR-612) measured **630,510 raw / 155,088 gzip** — 88 bytes over the 155,000 gzip ceiling after all evidence-based behavior-preserving reductions available to the slice (raw is 376 bytes BELOW HEAD). Attribution (Wave F slice 3 session, preserved artifacts) proved the overage is compression-locality loss from module-boundary fragmentation, not added content and not a split defect: zero cycles, zero external importers of split siblings, 24-export public surface preserved, star import graph, import-order permutations byte-identical. The owner therefore approved a controlled program-level policy correction: keep the valid split, and derive — not negotiate — the ceiling from measured evidence over the finite remaining production-affecting pool.

**Decision:**

## 1. The general estimator (comparability classes, not a transfer-only exception)

Every remaining production-affecting slice is classified by its actual structural shape, and only landed slices of a genuinely comparable shape supply its rate:

| Comparability class | Shape | Landed observations |
|---|---|---|
| **S-STAR** | Service-class internal split: orchestrator + family siblings, star import graph (siblings → shared model; orchestrator → siblings), clean family boundaries | Wave F slice 1 (`integrityCheckService`), Wave F slice 3 (`inventoryMaterialService`) |
| **S-INTERLEAVED** | Service-class split where external dependency modules interleave between family fragments, degrading compression locality | Wave F slice 2 (`projectFinancialService`) |
| **Class B** | Flat function-collection split: dense 1–3-line predicate exports, shared micro-predicate fan-in into every family file, no orchestrator (barrel re-export required) | none landed |
| **Micro import-edge** | Canonicalization of local literal sets to existing entry-chunk modules; no new exports | none landed (below landed granularity) |

Rules:

1. The estimate for a slice uses **the highest observed landed positive rate among comparable slices** in its class.
2. The `max(bytes-per-non-blank-LOC, bytes-per-export)` rule is retained **only where both units are semantically comparable**. The per-export term is valid only when the slice's exports are the same kind as the landed slice's exports. Wave F slice 3's export basis (24 = 23 type declarations + 1 service class) is an API-surface module; its derived 12.5417 B/export is **not comparable** to a dense collection of 1–3-line runtime predicates (75 functions + 1 type). For such shapes the export term is **excluded for that slice only**, with this written rationale, while the general rule stands for comparable slices.
3. **Negative or zero landed deltas are never a negative allowance.** F1 (−26) and F2 (−30 net) landed negative only because massive simultaneous densification accompanied the splits (F2: 421-site failure-builder collapse, −10,474 raw); the densification toolbox is now largely exhausted (F3 evidence: same-class reductions yielded −271 raw → −3 gzip). The conservative rule therefore selects the highest observed **landed positive** rate in the class.
4. A class with **no landed observation** (Class B, micro) cannot be silently estimated at another class's rate: a Class-B slice takes the S-INTERLEAVED landed-split-alone rate (0.5409) as floor evidence and goes to the **review lane** if that makes the cap unprovable; a micro import-edge change is conservatively proxied by the S-STAR landed rate (0.2108).
5. Every input is labeled **MEASURED**, **ESTIMATED**, **ZERO_PRODUCTION_EFFECT**, or **UNKNOWN**. An UNKNOWN slice is reported, never hidden; if it makes the cap unprovable, execution stops.

## 2. Highest-observed-rate evidence (all values re-verified live 2026-10-04)

| Slice | Source | nbLOC | Landed Δgzip | Landed rate | Split-alone Δgzip | Split-alone rate | Class |
|---|---|---|---|---|---|---|---|
| F1 `integrityCheckService` | `dc66881` | 1,430 | −26 | −0.0182 | −26 (no densification) | −0.0182 | S-STAR |
| F2 `projectFinancialService` | `ec6d821`+`c8ba74e` | 1,503 | −30 | −0.0200 | +813 (155.63 kB, preserved build log, ±5 B) | +0.5409 | S-INTERLEAVED |
| F3 `inventoryMaterialService` | staged (this adoption) | 1,428 | +301 | **+0.2108** | +330 (preserved artifact 631,279/155,117) | +0.2311 | S-STAR |

Earlier landed slices are not comparable structural splits and supply no rate: Wave B (result-code consolidation) and Wave D (default-copy collapse) were densification slices with no split LOC basis; Waves C/E were byte-identical; the pre-program Group-6→Wave-G delta (+4,696 gzip) aggregates non-slice changes. The F-family is the complete comparable set. F1/F2 landed rates are negative — lower than the F3 reference 0.2108 — so the highest observed landed positive rate is **0.2108 gzip bytes per non-blank LOC** (F3, S-STAR class; its split-alone peak 0.2311 and the S-INTERLEAVED 0.5409 are documented as class evidence).

## 3. `transferFamilyValidators` disposition — PRESERVE (architecture-first, budget-independent)

Live evidence (all MEASURED/VERIFIED 2026-10-04): `application/transfers/transferFamilyValidators.ts`, 1,718 nbLOC, 76 exports (75 runtime predicates/validators + 1 type), 7 imports, 8 direct consumers — **all eight inside `application/transfers/`** (the `localTransferService` facade, `transferSnapshotValidation`, `transferSnapshotMigrations`, `transferCounters`, `transferEnvelope`, and the three governing tests).

**Disposition: PRESERVE — documented keep; not a planned production split; not counted in the finite Bundle pool.**

- **Cohesion:** one responsibility — runtime shape validation of imported transfer payloads (file header: "per-family shape guards moved verbatim from localTransferService… pure unknown→boolean predicates with the same literal contracts"). The per-family validators are data-parallel slices of one validation pass (prepareImport → validate → replaceSnapshot): they change together (snapshot format versions), are consumed together through one facade, and are tested together by one characterization suite. Contrast: F1/F2/F3 were confirmed *mixed*-responsibility services (the plan's §6 table lists their distinct coexisting responsibilities); this file's §6 entry lists one responsibility.
- **Root cause mismatch:** the register's truth role is "DUPLICATE (risk): current-value acceptance sets duplicated from Domain unions — drift trap". The risk is knowledge duplication, not responsibility mixing. A structural split scatters the duplicated knowledge across more files and leaves the duplication intact. The plan's named remediation is 4D source-of-truth completion (consume Domain runtime guards — the STR-104/211/509 retrofit), an owner-gated cross-cutting production change outside this program's boundary. The register's preconditions ("Wave 3A characterization + Wave 3B drift guard BEFORE any move") are delivered and govern the drift risk (drift guard + compatibility registry + export goldens).
- **Contract gate:** the execution contract's Wave F step 1 is "confirm whether it is cohesive or mixed", and "do not split merely to reduce line count". A cohesive file with delivered drift governance takes the documented keep.
- **Split mechanics are the adverse bundle class:** no orchestrator exists (a split needs a 76-name barrel); the composite validators all consume the same shared micro-predicates, so any family split fans them into every family file — the S-INTERLEAVED pattern (0.5409 B/nbLOC split-alone), the worst observed class; rollback impact is HIGH ("rejection behavior is data-compat" — a data-compatibility contract with 21 released legacy pairs).
- **Budget independence:** the disposition rests on the evidence above alone. It was not kept to make the budget pass, and it would not be split even if the budget permitted (the split would not address the root cause and would be line-count-driven).

Keep record:
- **Owner:** the transfers subsystem (`application/transfers/` home; `localTransferService` facade; domain-drift relationship owned by `domainTransferDriftGuard.test.ts` + `transferCompatibilityValues.ts` registry).
- **Reason:** cohesion + contained consumer topology + drift-risk governance delivered + root cause is duplication (not mixing) + split mechanics in the adverse gzip class + HIGH data-compat rollback impact.
- **Growth bound:** ratchet-pinned at 1,718 nbLOC / 76,500 bytes — no growth; any addition escalates the ratchet and reopens this decision.
- **Review trigger:** any new entity family in the transfer snapshot format; any new hand-rolled status union (drift-guard failure); ratchet escalation; the STR-104/211/509 Domain-guard retrofit decision.
- **Exit condition (split reopening):** after the Domain exports runtime guards for the status unions (owner-gated retrofit) and this file consumes them, if it still exceeds its band, the internal-split card reopens as a fresh owner decision priced with the Class-B estimator (S-INTERLEAVED floor 0.5409) — never as an automatic size-driven split.

## 4. Formula, cap, and the finite remaining pool

```
G = 155,088                [MEASURED — staged Wave F slice 3 tree; guard method zlib level 9;
                            2× byte-identical; entry SHA-256 3b11e43d…; raw 630,510]
E_i (remaining production-affecting pool):
    E_STR-623 = 0.2108 × 13 = 2.7404 ≈ 2.74  [ESTIMATED]
        (basis: agreementContextService.ts:17,38–47 + guidedOpeningImportService.ts:78–79;
         0 new exports → export term not applicable; S-STAR landed rate proxy)
    E_transferFamilyValidators = EXCLUDED — PRESERVE disposition (§3), not a planned production split
    G2 / H-guards / R1 / I / Y / Z = ZERO_PRODUCTION_EFFECT
        (tests, scripts and docs outside the app build graph — build-manifest evidence,
         contract wave definitions; Z's true-down edits the guard constant only)
ΣE = 2.7404
P = 1.25 × ΣE = 3.4255
m = 200
C = ceil_to_100(G + P + m) = ceil_to_100(155,291.4255) = 155,300
```

- `G` already contains the Wave F slice 3 cost (+301 vs HEAD); it is never added twice.
- `C = 155,300 ≤ 156,000` → adoptable. **`GZIP_BYTE_LIMIT` is set to 155,300 exactly once** (single source of truth: `apps/prototype-web/scripts/check-bundle-budget.mjs`; doc pins updated same-commit; historical rows untouched).
- Counterfactual arithmetic (had the transfer validator been split at the S-STAR rate): `E = 0.2108 × 1,718 = 362.1544`; `ΣE = 364.8948`; `P = 456.1185`; total `155,744.1185` → `C = 155,800`, which satisfies the required interval `329.6 < ΣE ≤ 409.6`. At the split-alone rate 0.2311: `ΣE = 399.77` — also within the interval. At the Class-B floor 0.5409: `ΣE = 932.04 > 409.6` → `C = 156,500` → over-cap → review lane. No arithmetic mismatch in any branch.
- RAW ceiling unchanged: 650,000 (measured 630,510; margin 19,490).

## 5. Standing rules after adoption

1. **No later ceiling increase during this program.** Any slice that cannot fit goes to the **review lane** (consolidated owner package with the per-wave measurements), never to the constant.
2. **Per-wave rule:** record raw/gzip before and after every wave; focused tests, full required suites, guards, bundle check, and CI where access permits; push and verify the exact remote SHA before declaring a remotely verified wave.
3. **At Z — mandatory downward true-up:** `GZIP_BYTE_LIMIT = ceil_to_100(final measured gzip + 200)`, voiding any unused allowance. The ceiling may only move DOWN at closure.
4. The finite pool is closed: any NEW production-affecting work discovered later is UNKNOWN-labeled, reported, and stops execution if it makes the cap unprovable.

**Consequences:** Wave F slice 3 lands under the derived ceiling; STR-623 canonicalization remains budgeted within it; `transferFamilyValidators` stays whole under drift governance and its ratchet pin. STR-608's ledger gains the derived-adoption record; D-034's raw ceiling and ADR-012's policy are otherwise untouched. Rollback: revert the adoption commit (ceiling returns to 155,000 and slice 3 returns to staged-blocked state); the slice-3 commit reverts independently as a normal wave commit.

**Z true-up executed (2026-10-04, Wave Z):** `GZIP_BYTE_LIMIT = ceil_to_100(final measured gzip + 200) = ceil_to_100(155,088 + 200) = 155,300` — identical to the adopted value (the finite-pool allowance P = 3.4255 fell inside the same 100-byte window), so the constant is unchanged while its basis is now the final measurement alone; the deferred STR-623 unification remains gated on the resulting 212-byte margin. Closure record: `docs/architecture/refactoring/A-TO-Z-CLOSURE-RECORD.md`.

**Evidence class:** VERIFIED for G, all rates, export/LOC counts, consumer topology, and artifact byte-identities (re-measured live 2026-10-04); ESTIMATED for E_STR-623 (no landed micro-slice observation); the F2 split-alone figure is MEASURED at preserved-log precision (±5 B, state never committed).
