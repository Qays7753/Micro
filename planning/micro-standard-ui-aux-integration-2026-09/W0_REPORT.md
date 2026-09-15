# WAVE 0 REPORT — Baseline, Branch, and Architecture Gate

**Wave:** W0 · **Branch:** `micro-standard-ui-aux-integration-20260914` · **Base:** `c0469e265f24c70427eb7826dee717be117cff87` (= origin/main at start)

## Scope and file boundary

Scope: create the run branch from the exact main HEAD; record baselines; re-run the read-only architecture scan; register rollback boundaries. **File boundary: only `planning/micro-standard-ui-aux-integration-2026-09/**` documents were created — zero product-source changes, zero reorganization, zero moves.**

## What was done

1. **Canonical-source verification.** Live SHAs recorded (Micro `c0469e2`, Documents `f919982c`); Standard package on `Documents/main` verified = 31 files and byte-identical to the promoted reconciliation-final package; all evidence branches (comparison / context / final / audit) exist and were read; the context pack is complete. Recorded in `SOURCE_PROVENANCE.md`.
2. **Branch created** from the exact main HEAD; working tree proven clean.
3. **Baseline manifests.** `BASELINE_MANIFEST.json` (base commit/tree SHA, 776 files, key source blob SHAs, check status) and `ROLLBACK_MANIFEST.json` (global + per-wave boundaries, restore/verify commands).
4. **Baseline test proof.** Full `pnpm check` green at branch point: typecheck, lint, format, text-density, design-guards, guards, 35 root test files / 391 tests, prototype check + 166 client test files / 1166 tests, production build, bundle budget PASS (633,197 raw vs 650,000; 150,606 gzip vs 155,000).
5. **Architecture re-scan (Agent 1, read-only).** The accepted scan holds at this commit: 13 claims confirmed exactly, 4 confirmed with definitional deltas (page counts: 60 TSX of which 52 non-test; 17 navigation label branches; runtime storage references behind interfaces in 2 application services), 0 contradictions. New registered findings: `components/ui/` naming collision (primitives will live in `components/primitives/`), eslint glob coverage, text-density caps for shared components, entry-chunk budget, dormant stylelint plugin, latent duplicate-rule overrides (`.micro-header-context` 12px→11px; `.micro-wordmark` 18px→20px).
6. **Decisive census result.** Zero tests assert palette values (no hex/rgb/getComputedStyle/toHaveStyle/snapshot assertions in 201 test files; `U09.css.test.ts` asserts only three geometry strings). Palette adoption therefore gates on structural guards + journey suites, not frozen values.
7. **Token consumer census (Agent 2, read-only).** Complete variable→consumer map for the token zones; dead tokens identified (`--space-7`, `--motion-in-out`, `--color-text-tertiary`, `--color-withdrawal-*`); warn-chip defect root-caused (`.micro-status-chip` has no tone variants — `data-status="warn"` ignored → success-green in InventoryMaterials/Orders/Schedule); scrim inventory (dialog literal vs drawer token-driven); PWA/logo twins recorded (`#CC785C`, `#079FA0` dot).

## Gate check (W0 exit criteria)

| Criterion | Status |
|---|---|
| Repository clean at branch point | ✅ (empty `git status`) |
| Rollback restores the baseline | ✅ by construction (base commit recorded; restore/verify commands in ROLLBACK_MANIFEST.json) |
| Scan confirms approved boundaries | ✅ (see ARCHITECTURE_SCAN.md §4) |
| No unresolved new structural risk | ✅ (all new findings registered as wave work items, none blocking) |

**W0 gate: PASS.** No safety condition was triggered; no stop condition occurred.

## Rollback boundary

This commit (run-folder documents only). `git revert <W0 commit>` removes the run folder; product sources are untouched by definition.

## Next

W1 — Runtime token mapping + State Adapter (single central mapping layer; legacy aliases preserved; no deletions).
