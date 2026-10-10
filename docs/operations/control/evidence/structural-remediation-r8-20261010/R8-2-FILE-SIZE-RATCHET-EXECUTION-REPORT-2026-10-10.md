# R8-2 — Within-Band File-Growth Ratchet v2 (Execution Report)

**Program:** WS-216 / ARCH-007 — Structural Remediation R8, slice R8-2
**Date:** 2026-10-10 · **Executor:** Z AI · **Findings closed:** R8-F-005, R8-F-006
**Commit:** this slice's commit on `refactoring/r8-bundle-file-growth-guards-20261010`

---

## 1. What changed

| File | Change |
|---|---|
| `scripts/check-file-size-ratchet.mjs` | v2: exact-metric baseline, within-band growth rejection, re-anchor ledger coverage, merge-base drift audit, fail-closed schema validation incl. duplicate-path detection (190 → 391 nbLOC; growth documented in the seed provenance and register §7) |
| `scripts/check-file-size-ratchet.test.mjs` | Replaced: 20 deterministic tests covering the full R8-2 contract |
| `scripts/file-size-ratchet-baseline.json` | v1 bands (400 entries) → v2 exact census (488 files: 414 NORMAL / 51 WATCH / 14 SPLIT_CANDIDATE / 9 SPLIT_NOW) with binding provenance |
| `scripts/file-size-ratchet-reanchors.json` | New: the single documented authorization path for baseline value increases (starts empty; bounded per-path entries with chained from/to values and owner-review references) |
| `docs/architecture/refactoring/FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` | Dated §7 note: migration, protocol, and guard self-growth measurement |

## 2. Policy (band definitions, scope, and metric unchanged)

- Bands stay exactly `NORMAL <400`, `WATCH 400–799`, `SPLIT_CANDIDATE 800–1199`, `SPLIT_NOW ≥1200`; the metric stays `nbLOC` (register methodology); the production+script scope and documented exclusions stay literal (category function unchanged). The guard's own data files (baseline + reanchor ledger) are excluded from measurement as guard data, mirroring the pre-existing self-exclusion rationale.
- **Any growth fails** — within a band or across one — with the precise file, old metric, new metric, bands, and remediation path. Shrinkage passes (with lock-it guidance). A new file passes only as NORMAL; entering WATCH+ directly fails. Deleted files stay in the baseline without effect (`removed` stat) until an explicit same-PR cleanup.
- **Authorization path:** a baseline value may increase only via a re-anchor ledger entry whose `from` chain-matches the prior baseline value and whose `authorization.ownerReview` references an owner review. Authorized growth is *reported* as `REANCHORED (documented)` — never silently passed. A `PRESERVE_BY_DESIGN` card grants no exemption beyond its bounded ledger entry.
- **Same-PR concealment prevention:** the drift audit loads the baseline at the merge base (with `main`; CI's `fetch-depth: 0` guarantees availability — an unresolvable base fails in CI and warns locally) and rejects (a) any value increase not covered by a chain-valid ledger entry, and (b) any removed entry for a file still alive in the tree. Proven by direct negative tests: grow+bump-silently passes the tree check but fails the audit; the documented ledger version passes and reports; entry deletion fails.
- **Migration honesty:** with a v1 baseline at the merge base, the audit switches to migration verification — the v2 seed must equal the live census (mismatch fails with details). The seed's provenance binds the historical-growth evidence (R6-SCAN-F-005/F-006 register §7 dispositions with their dated commits) so documented history is represented, not reopened and not silently copied.
- **Fail-closed schema:** version/schema checks, integer metrics, band-must-equal-bandOf(nbLoc) consistency, and duplicate-path detection via raw-text key scan (JSON.parse alone silently keeps the last duplicate — the scan rejects it).

## 3. Tests (20, deterministic, offline)

Band thresholds; unchanged-passes; shrinkage-passes; within-band growth fails with `300 -> 320 nbLOC (NORMAL -> NORMAL)`; band crossing fails as `band-escalation`; new-NORMAL passes; new-WATCH+ fails; deleted-file explicit; excluded categories; schema rejections (version/schema/measurements/band-vs-metric/negative-metric/unknown-band/null); duplicate-path raw-text detection (hand-built duplicate JSON — `JSON.stringify` cannot produce one); live baseline validity (v2 census > 450 files, provenance cites R6-SCAN-F-005); ledger coverage (chain match, owner-review requirement, wrong-chain and no-authorization rejections); drift audit (silent-bump fails, ledger-authorized passes + reports, live-entry removal fails, v1-base migration verified/mismatch, unresolvable-base CI-fails/local-warns); CLI smoke on the live tree.

**Result:** `npx vitest run scripts/check-file-size-ratchet.test.mjs` — **20/20 passed** (local, Node 24.21.0). The guard demonstrably caught its own 1-line post-seed growth during development (re-seeded with the documented provenance before commit).

## 4. Verification record

| Command | Result | Environment |
|---|---|---|
| `npx vitest run scripts/check-file-size-ratchet.test.mjs` | 20/20 passed | local |
| `node scripts/check-file-size-ratchet.mjs` | PASS — 488 files, migration-verified note, zero unauthorized growth/drift | local |
| Focused neighbor suites (`check-module-boundaries`, `check-runtime-cycles`, `check-type-cycles`) | PASS (unchanged by this slice) | local |

## 5. Exit-criteria status

- [x] The ratchet rejects unjustified within-band growth (old/new values in the violation).
- [x] Current documented historical growth is represented accurately (seed provenance binds the R6 register evidence; not reopened).
- [x] No baseline update can hide same-PR code growth (drift audit + chain-validated ledger — proven by tests).
- [x] Focused file-size tests pass (20/20).
- [x] Register, baseline provenance, and guard agree (dated §7 note; guard header; seed provenance).
- [x] R8-F-005 and R8-F-006 closed with evidence (this report + tests + live-tree PASS).

**Status after R8-2:**

```text
R8_2_COMPLETE — WITHIN_BAND_RATCHET_V2_VERIFIED
NO_BASELINE_WEAKENED
NO_HISTORICAL_GROWTH_REOPENED
NO_UNAPPROVED_FINANCIAL_OR_SEMANTIC_CHANGE
NO_UNAPPROVED_SCHEMA_OR_EXPORT_IMPORT_CHANGE
NO_UNAPPROVED_VISUAL_UI_CHANGE
```
