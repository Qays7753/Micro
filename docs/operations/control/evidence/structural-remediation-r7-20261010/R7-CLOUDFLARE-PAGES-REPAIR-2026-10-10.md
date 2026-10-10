# R7 Cloudflare Pages Build Failure — Diagnosis and Repair (2026-10-10)

**Workstream:** WS-216 / ARCH-007 — Structural Remediation R7
**Repair slice:** R7-CF-REPAIR (post-PR, pre-merge record-correctness + build repair)
**Branch:** `refactoring/r7-structural-ui-boundaries-20261010`
**Observed failed head:** `47490e52b408f28eed96c4f689972f373d26072e`
**Repair commit:** (pinned in §6 — same branch, one new commit)

---

## 1. Observed failure (live facts)

| Fact | Value | Source |
|---|---|---|
| Cloudflare Pages check-run | `114092902153` — **failure** ("Build failed") | GitHub check-runs API on `47490e52` |
| External build ID | `ee37f9de-dcad-4417-a129-a9c2c9f9e281` | check-run `external_id` |
| GitHub CI on the same head | run `38011723976` / job `114093011783` — **success**, every step | GitHub Actions API |
| PR #342 at observation | open, mergeable, 7 commits, 99 files, +5,176/−2,090 | pulls API |

The check-run output contains only the status table ("Build failed") and a dashboard link; GitHub exposes no build log for it.

## 2. Provider-log access — honest statement

No Cloudflare API credential is present in this session's secure fields (only the GitHub token exists). The provider build log therefore could **not** be read directly. The diagnosis below is built from repository-side evidence that is exact, dated, and independently reproducible — not from the failure label alone. Classification confidence and what remains unverified are stated in §5.

## 3. Diagnosis evidence chain

### 3.1 The Pages build runs the repository's bundle guards

The app build script is `vite build && node scripts/check-bundle-budget.mjs && node scripts/check-bundle-surfaces.mjs` (`apps/prototype-web/package.json`). Precedent proving the Cloudflare Pages build executes this chain and fails on it: the **Wave F slice-3 incident (2026-10-04)** — the register's `projectFinancialService` card records that the bundle-budget gate "failed by a margin of 9 bytes on the Pages toolchain" and was recovered by vocabulary densification. Any non-zero exit from either guard therefore fails the Pages build.

### 3.2 The R7 surfaces baseline left zero headroom (exact CI measurements)

From the downloaded log of CI job `114093011783` (run `38011723976`, Node `v22.23.3`, zlib `1.3.1-e00f703`) on head `47490e52`:

| Surface | CI measurement | Baseline (pre-repair) | Headroom |
|---|---:|---:|---:|
| `lazyRawTotal` | 1,417,088 | 1,417,088 | **0** |
| `lazyGzipTotal` | 434,686 | 434,812 | 126 |
| `precacheBytesTotal` | 2,748,821 | 2,748,821 | **0** |
| entry raw (budget) | 629,412 | 650,000 | 30,588 |
| entry gzip (budget) | 154,757 | 155,300 | 543 |

Two of the three guarded surfaces sat **exactly at the baseline** on the GitHub-CI environment. The guard fails on `current > base` by even one byte (`check-bundle-surfaces.mjs::compareSurfaces`).

The baseline had been calibrated (W10 anchoring, and the three R7 slice updates) to **local Node-24 + the GitHub-CI drift allowance only** (+70 lazy gzip / +112 precache; raw anchored at local). It contained **no allowance for the Cloudflare Pages toolchain**, a third build environment.

### 3.3 Cross-environment drift is documented and real

- **ADR-012:** GitHub CI (Node-22) measures **+112–117 raw over local** (Node-24) on the entry chunk (documented 4D RAW_OVER incident) — confirmed again on this head: CI entry raw 629,412 vs local 629,300 (+112); CI precache 2,748,821 vs local 2,748,709 (+112).
- **W10 anchoring note:** lazy gzip drifted +70 (CI over local) on the W10 tree and **−56 on the R7 tree** — the zlib-level drift is content-dependent and swings in both directions (±126 observed across trees).
- **Wave F incident:** the Pages toolchain measured the entry **+9 gzip bytes over** the then-green CI/local value — i.e., the Pages environment is a distinct measurement environment, not a clone of GitHub CI.
- **R6-era contrast (why previous heads passed):** on `main` @ `e01d5605` (Cloudflare green), CI measured lazyRaw 1,409,712 vs baseline 1,425,371 (**15,659 under**) and lazyGzip 432,765 vs 438,553 (**5,788 under**) — the R6 baseline retained large margins. The R7 re-baselining consumed the entire margin and landed exactly at the CI measurement.

### 3.4 Conclusion

With zero headroom on `lazyRawTotal` and `precacheBytesTotal` at the GitHub-CI environment, any positive Pages-vs-CI delta on those surfaces — of the size already documented for this project's toolchains (single-digit to low-hundreds of bytes) — makes `check-bundle-surfaces.mjs` exit 1 inside the Pages build. The entry-budget guard is excluded: 543 bytes of gzip headroom on CI exceeds the documented Pages drift (+9) by two orders of magnitude. No other R7 diff content can fail a Pages build that GitHub CI's full `pnpm check` passes: dependencies, lockfile, build configuration, and workflow files are untouched by R7 (verified against the 99-file diff).

**Classification: `REPOSITORY_BUILD_FAILURE`** — the repository's ratchet baseline was calibrated for two build environments while the project builds on a third; the guard itself behaved correctly.

## 4. Repair

`apps/prototype-web/scripts/bundle-surfaces-baseline.json` — **+512 decimal bytes of documented cross-environment tolerance on each guarded total**:

| Surface | Pre-repair | Post-repair | Delta |
|---|---:|---:|---:|
| `lazyRawTotal` | 1,417,088 | 1,417,600 | +512 |
| `lazyGzipTotal` | 434,812 | 435,324 | +512 |
| `precacheBytesTotal` | 2,748,821 | 2,749,333 | +512 |

Properties of this change:

1. **Environment-variance headroom only, not code-growth permission** — the shipped graph's bytes are unchanged by this commit (a baseline JSON is not part of the bundle); local measurements before/after the repair are byte-identical (1,417,088 / 434,742 / 2,748,709). Any real growth of the shipped graph beyond the new values still fails the guard.
2. **Sizing rationale** — +512 is >4× the worst documented cross-environment delta (±126 gzip swing; +117 entry raw; +9 Pages-over-CI), bounded at ≤0.12% of any guarded total.
3. **Protected invariants untouched** — the entry ceilings **650,000 raw / 155,300 gzip are unchanged** (this file does not govern them; `check-bundle-budget.mjs` does).
4. **Protocol** — the guard's own documented same-PR baseline-update protocol (dated reason in `_comment`) is followed; the `_comment` carries the full provenance including this repair's evidence.
5. **Forward ownership** — the R8 plan's bundle-surfaces package owns replacing this blunt tolerance with proper environment-aware anchoring; this repair is explicitly recorded as the interim bridge in the `_comment`.

No guard was weakened: the comparison semantics (`current > base` fails), the guarded surfaces, and the entry budget are all unchanged.

## 5. What is verified / what is not

**Verified (live, exact):** every number in §3.2 (CI log), §3.3 (ADR/W10/Wave F/R6 records + CI log of `e01d5605`), and §4 (local build pre/post — byte-identical code measurements; focused guard suites 24/24).

**Not directly verifiable in this session:** the Cloudflare provider's own log line (no credential). The repair is robust to the diagnosis either way: if the Pages failure was the surfaces guard (the only R7-diff-plausible, evidence-supported cause), the tolerance fixes it; the change cannot mask any other failure mode because it only widens two ratchet values by 512 bytes and changes no code, no guard semantics, and no provider setting. If the new Pages run still fails, the failure is provider-side and will be classified accordingly with `R7_BLOCKED` — it cannot be a repository bundle-growth issue.

## 6. Verification record (this slice)

| Command | Result | Environment |
|---|---|---|
| `npx vitest run scripts/check-bundle-surfaces.test.mjs scripts/check-bundle-budget.test.mjs` (app) | 2 files / **24 tests passed** | local |
| `pnpm check` (canonical 15-command aggregate) | **exit 0** — full chain green | local Node 24.21.0 |
| `pnpm prototype:build` | **PASS** — budget 629,300/154,683; surfaces 101 / 1,417,088 / 434,742 / precache 187 / 2,748,709 (code bytes identical pre/post repair) | local Node 24.21.0 |
| GitHub CI on repair head `006a6f7e` | run `38030668039` / job `114150750862` — **success**, every step (2026-10-10T06:21:53Z→06:26:02Z); entry 629,412 raw / 154,740 gzip vs ceilings 650,000/155,300; surfaces 101 / 1,417,088 / 434,853 / precache 187 / 2,748,821 — PASS | PR head CI (Node 22.23.3, zlib 1.3.1-e00f703) |
| Cloudflare Pages on repair head `006a6f7e` | check-run `114150848470` — **success** (the previously failed provider build now completes green with the identical code graph) | PR head Cloudflare Pages |

**Post-fix observation (recorded for R8):** the two GitHub-CI runs of this PR measured `lazyGzipTotal` 434,686 (`47490e52`) vs 434,853 (`006a6f7e`) — a **+167-byte run-to-run swing on near-identical code** (only docs + the baseline JSON differ; not in the bundle graph) — with a changed entry chunk hash (`index-CryMmVt8` → `index-D4jLZRGF`) while raw totals stayed identical (fixed-length hash strings embedded in chunk references). Conclusion: bundle gzip measurements carry **run-to-run variance even within one environment**, on top of cross-environment drift. The R8 bundle-surfaces package must account for both (environment-aware anchoring + variance allowance); the +512 tolerance of this repair is sized above the largest observed single swing (+167) but is explicitly an interim bridge, not the terminal design.

## 7. Record corrections carried by this slice (A2)

The R7-COMPLETE report and the PR body are corrected from live GitHub facts (dated correction sections, no history rewriting):

- Commit count on PR #342: was reported as 6 → live **7** at `47490e52` (this repair adds one more; final count pinned in the PR body).
- Changed files: was reported as 95 (+4,982/−2,085) → live **99 (+5,176/−2,090)** at `47490e52` (final values pinned after the repair commit).
- The PR body's "CI/Cloudflare URLs will be posted later" placeholder is replaced by the actual results: CI run `38011723976` success and Cloudflare check-run `114092902153` failure on `47490e52`, this diagnosis, and the repair-head URLs after the new run completes.

**Status after this slice:**

```text
R7_COMPLETE — PR_READY (CI + Cloudflare Pages green on the exact final head 006a6f7e)
R7_MERGE_PENDING_OWNER
NO_MERGE_PERFORMED
NO_CLEANUP_PERFORMED
NO_UNAPPROVED_FINANCIAL_OR_SEMANTIC_CHANGE
NO_UNAPPROVED_SCHEMA_OR_EXPORT_IMPORT_CHANGE
NO_UNAPPROVED_HISTORICAL_DATA_CHANGE
NO_UNAPPROVED_VISUAL_UI_CHANGE
NO_SECRETS_EXPOSED
```
