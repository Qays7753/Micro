# R11-W0-NF-001 — Method-Recorded Evidence Addendum (Append-Only)

**Artifact ID:** R11-W1B0-NF-001-EVIDENCE-ADDENDUM-2026-10-14 | **Slice:** W1b-0 | **Date:** 2026-10-14 (UTC) | **Executor:** ZAI (single W1b writer)
**Decision authority:** OD-RECORD — Option A (`APPEND_ONLY_EVIDENCE_GOVERNANCE`), owner-approved in the R11 owner decision package §3 (OD-RECORD) and §7.1; executed here under the canonical W1b execution prompt (pinned head `2802d119d41dd5e5c7df509f6d487fb0d26a13e2`, PR #364).
**Classification:** documentation/record-quality gap remediation. **This is not a production-code change.**

---

## 0. Status

```text
W1B0_NF001_ADDENDUM — VERIFIED (reproduction complete; matrix preserved unchanged)
R10B_MATRIX_REWRITTEN — NO (zero edits to the historical matrix)
QUALITATIVE_FINDINGS — REMAIN_VALID (unchanged by this addendum)
```

## 1. Purpose and rule

`R11-W0-NF-001` (canonical description: owner package §7.1) records that two historical R10-B matrix quantities were not reproducible from the recorded evidence because their census methods were not recorded. The durable remediation is this append-only addendum: it preserves the historical values verbatim as `UNVERIFIED`, records the reproducible quantities with their exact method, scope, tool, command, base SHA, date, and raw-output hashes, and provides the durable census template for future waves. The R10-B matrix itself (`docs/operations/control/evidence/structural-remediation-r10-20261011/R10-B-FINDINGS-MATRIX-2026-10-11.json`) is **not edited** — historical records are never rewritten silently.

## 2. The two historical quantities (preserved verbatim, `UNVERIFIED`)

| Historical claim | Recorded location (verbatim) | Status |
|---|---|---|
| `R10A-F-013`: "59 files/326 references" rely on the unbranded `MoneyMinor` alias | R10-B findings matrix, finding `R10A-F-013` fields `current_behavior` ("…59 files/326 references rely on naming convention…") and `affected_files_and_symbols` ("…59 consumer files (326 refs)"), at matrix version `micro-r10b-findings-matrix/1`, base `ffc54eb1150932c9bba88b48a7c38275f2a3effa` | `UNVERIFIED` — no documented method reproduces 59/326 (Wave 0 §13: "no method yields 59/326") |
| `R10B-NF-005`: "108 edges" of ungoverned application-internal cross-house deep imports | R10-B findings matrix, finding `R10B-NF-005` fields `current_behavior` ("108 ungoverned cross-house deep imports…") and `affected_files_and_symbols` ("108 edges inventoried by RV1 B4"), same matrix | `UNVERIFIED` — the guard-mirroring census at the same base SHA measures 126 unique edges; the original 108 method was not recorded |

Both historical values are preserved above exactly as recorded. No matrix field was edited, and no silent correction was applied.

## 3. Reproducible Wave 0 quantities and this addendum's re-reproduction

The Wave 0 scan report (§11.2, §11.7, §13, §19.2) recorded the reproducible quantities. This addendum re-executed both censuses on 2026-10-14 at the three recorded SHAs with the methods in §4, confirming the Wave 0 measurements. Raw outputs: `R11-W1B0-NF-001-CENSUS-COUNTS-2026-10-14.json` (counts) and `R11-W1B0-NF-001-HOUSE-EDGE-LISTS-2026-10-14.json` (full edge lists, the material the SHA-256 digests commit to).

### 3.1 Family A — `R10A-F-013` MoneyMinor literal-token census

| Measurement point | Exact token `MoneyMinor` — production | Exact token — incl. tests | Broader `*Minor` family — production | Broader family — all |
|---|---|---|---|---|
| R10-B base `ffc54eb1` | 14 files / 142 line-refs | 15 / 144 | 212 files / 4,849 line-refs | 486 / 11,034 |
| Wave 0 head `31afaf39` | **15 files / 148 line-refs** | **16 / 150** | **214 files** / 4,869 line-refs | 496 / 11,170 |
| W1b base `0ede6e94` (live main when this addendum was produced) | 15 / 148 | 16 / 150 | 214 / 4,869 | 496 / 11,170 |
| Wave 0 report recorded value | 15 / 148 ✓ exact | 16 / 150 ✓ exact | 214 files ✓ exact / 4,868 refs (Δ = +1 line) | not recorded |

**Reconciliation:** every recorded figure reproduces exactly except the family line-ref count, which this method yields as 4,869 versus the recorded 4,868 — a single-line variance (0.02%). The file-level counts and the exact-token census reproduce exactly. The one-line difference is attributable to a line-level classification or tool-version detail in the Wave 0 scratch run whose exact cause is not recoverable (that is precisely the failure mode this addendum exists to eliminate: without a recorded method, ±1 sensitivity is unexplainable). The variance affects no qualitative conclusion: the family remains a several-hundred-file surface whose compensating controls (integer kernels, sole persisted formatter, frozen writer surface, D-02 monitor) are the live protections.

### 3.2 Family B — `R10B-NF-005` application-internal cross-house edges

| Measurement point | Unique (file → file) edges | Split (type-dominant per edge) | (source-house → target-file) pairs | Distinct target houses |
|---|---|---|---|---|
| R10-B base `ffc54eb1` | **126** | 78 value + 48 type | **89** | 27 |
| Wave 0 head `31afaf39` | **128** | 80 value + 48 type | 91 | 27 |
| W1b base `0ede6e94` | 128 | 80 + 48 | 91 | 27 |
| Wave 0 report recorded value | 126 at base ✓ / 128 at live ✓ | 80 + 48 at live ✓ | 89 at base ✓ | not recorded |

**Reconciliation:** all recorded figures reproduce exactly. The W1A D-07 guard (rule R9 in `scripts/check-module-boundaries.mjs`, merged on `main` before this wave) now enforces this census live at 128/80/48 against `scripts/application-house-edges-census.json` — the seam is no longer ungoverned, and the census is machine-reproduced on every guard run. The historical "108 edges" remains `UNVERIFIED` (method not recorded); the reproducible lineage is 126 (base) → 128 (Wave 0 head) → 128 (W1b base, enforced by R9).

## 4. Exact census methods (mechanical, re-runnable)

### 4.1 Family A method (git-grep line census)

```bash
# Exact token (word-boundary), distinct (file,line) pairs:
git grep -I -w -n -e MoneyMinor <SHA> -- '*.ts' '*.tsx'
# Broader family:
git grep -I -E -w -n -e '[A-Za-z0-9_]+Minor' <SHA> -- '*.ts' '*.tsx'
```

- **Counting unit:** distinct `(path, line-number)` pairs (a line with multiple matches counts once; lines, not occurrences — occurrences would give 152/154 for the exact token at `31afaf39`, which does not match the recorded 148/150).
- **Scope:** tracked `.ts`/`.tsx` at `<SHA>` (the whole tree).
- **Exclusions (production variant):** `tests/` root, `*.test.ts(x)`, `*.spec.ts(x)`, `__tests__` path segments. The incl-tests variant keeps them.
- **Word boundary:** `-w` (git's regexec word-constituent semantics). Tool version recorded in §5.

### 4.2 Family B method (guard-exact house-edge census)

The census reuses the live guard's own census functions — no re-derived logic:

1. Materialize the historical tree: `git ls-tree -r --name-only <SHA>` filtered to `src/` and `apps/prototype-web/client/src/`, each blob written via `git cat-file blob <SHA>:<path>`.
2. Copy `scripts/check-module-boundaries.mjs` and `scripts/check-runtime-cycles.mjs` from the executing tree (W1b branch) into the materialized tree's `scripts/`, and symlink a `node_modules` (for `typescript`).
3. Execute: `collectAllImports(<tree>)` then `collectHouseEdges(imports)` imported from the copied guard module.
4. Aggregate: unique-edge count, type-dominant split (`kind = type>0 ? "type" : "value"` per edge), (source-house → target-file) pair dedup, and the sorted edge list hashed with SHA-256.

Semantics (from the guard, authoritative): source layer `application`; resolved target inside `apps/prototype-web/client/src/application/`; target must be a house-interior file (depth ≥ 2, not a house root file, not `index.ts` — the house door); source must be a house-interior file; source house ≠ target house; all import kinds collected (static value, type-only, `export … from`, dynamic `import()`, `import x = require()`); specifiers resolved for `@/`, `@micro-domain/`, and relative forms.

## 5. Tool, runtime, and environment versions

- node `v24.21.0`; git `git version 2.47.3`; pnpm `9.15.9` (project pin; not used by the censuses themselves).
- Census harness executed from the ZAI workspace; the harness logic is fully described by §4 (the two git commands and the four-step guard-exact procedure). No repo files were modified while measuring historical SHAs (read-only `git grep`/`ls-tree`/`cat-file` + a temp directory outside the repo).

## 6. Base and live SHAs

| Role | SHA |
|---|---|
| R10-B matrix base (historical quantities' home) | `ffc54eb1150932c9bba88b48a7c38275f2a3effa` |
| Wave 0 scan live head (Wave 0 quantities' home) | `31afaf39` |
| W1b execution base (live `main` at W1b start; verified equal to the contract hint) | `0ede6e941a7ec276baf1594febb34e2d4ebf14ee` |

## 7. Raw-output digests (SHA-256)

Digests are over the sorted newline-joined edge list (`key [kind]`) of each measurement point; the verbatim lists are committed alongside this addendum in `R11-W1B0-NF-001-HOUSE-EDGE-LISTS-2026-10-14.json`:

| Measurement point | Edges | SHA-256 of edge list |
|---|---|---|
| R10-B base `ffc54eb1` | 126 | `c1d25f52ba3cbc94…` (full value in the counts JSON) |
| Wave 0 head `31afaf39` | 128 | `3cea0d00ef72dbc7…` (full value in the counts JSON) |
| W1b base `0ede6e94` | 128 | `3cea0d00ef72dbc7…` (identical list to Wave 0 head — production unchanged between them) |

## 8. Scope and exclusions of this addendum

- In scope: recording the methods, quantities, reconciliation, and template for the two NF-001 census families; committing the raw census outputs; updating Operations Control records (JSON sources first, then generated views) and the document index.
- Out of scope: editing the R10-B matrix or any historical report; changing any production code; altering guard logic or baselines; recalibrating any ceiling; W2–W5 work.
- Excluded from the censuses themselves: test files (production variant), non-`.ts/.tsx` files, and — for Family B — anything outside the guard's scan roots (`src`, `apps/prototype-web/client/src`), matching the guard's own production-file predicate.

## 9. Reviewer and reconciliation result

- **Executor self-verification (`VERIFIED_FROM_REPOSITORY`):** all counts in §3 were re-derived from the recorded commands on 2026-10-14; the edge-list digests were recomputed and match the committed lists; the exact-token census and both file-level counts reproduce the Wave 0 record exactly; the single ±1 family line-ref variance and the fully-reproduced Family B figures are recorded above without adjustment.
- **Five-reviewer W1b gate:** this addendum is reviewed by the W1b five-reviewer gate (RV1–RV5) as part of the W1b PR; their verdicts and any remediation are recorded in the canonical W1b execution report (see `R11-W1B-EXECUTION-REPORT-2026-10-14.md` §"Five-reviewer gate" at the final records head).

## 10. Durable census template (for future waves)

Any future quantitative claim recorded in a matrix, report, or Operations Control item MUST carry this block (fill every field; `UNVERIFIED` only for preserved historical values whose method is genuinely not recoverable):

```yaml
census_record:
  quantity: <what is counted, with the counting unit (files / line-refs / occurrences / edges / pairs)>
  value: <the number>
  method: <exact command(s) or the exact script + function names>
  scope: <paths, file extensions, layers included>
  exclusions: <test predicates, scan roots, binary skips, etc.>
  tool_versions: <git / node / script-guard version>
  base_sha: <tree the census ran against>
  date: <YYYY-MM-DD>
  raw_output_ref: <path to committed raw output, or its SHA-256 if bulky>
  reviewer: <who re-ran or verified it, and when>
  reconciliation: <match/mismatch against prior records, with exact deltas>
```

## 11. Qualitative findings remain valid

The two underlying findings are unaffected by the quantitative variance: `R10A-F-013`'s qualitative claim (MoneyMinor is an unbranded alias protected by compensating controls, not nominal typing) and `R10B-NF-005`'s qualitative claim (the application-internal cross-house seam was ungoverned and grew silently during R10-B) were both re-verified qualitatively by Wave 0, and the seam is now governed live by the W1A D-07/R9 ratchet at the 128-edge census this addendum reproduces. Future waves must cite the method-recorded quantities in §3 (and the guard's live census), not the unreproducible historical values in §2.
