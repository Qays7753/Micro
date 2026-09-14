# FINAL TEST RESULTS — Completion Run (re-executed)

All results below were executed against the final pre-push tree (`db03aaf` + chore commits; `git status` clean). Commands and outputs are exact; nothing is inferred.

## Full pipeline — `pnpm check` (exit 0)

| Stage | Command | Result |
|---|---|---|
| Typecheck | `tsc --noEmit` (root + prototype) | PASS |
| Lint | `eslint … --max-warnings 37` | **0 errors, 36 warnings** (within budget; pre-existing warnings, none added by this run's code — the count was 36 before the completion run and 36 after) |
| Format | `prettier --check` | PASS (all files) |
| Text density (§10.1) | `python3 scripts/text-density-count.py` | **All 52 surfaces within caps** (Catalog 91/91 after regex-literal classification; loading labels excluded by design) |
| Design-token guards | `design-token-guards.py` + stylelint | **PASS — no raw hex, all values on scale**; hardened this run: rgb/hsl literals now checked in CSS outside token zones too |
| Secrets | `node scripts/check-secrets.mjs` | **PASS — 848 files, 0 secret patterns**; full-diff scan (`git log -p origin/main..HEAD`) for `github_pat_/ghp_/gho_/AKIA/-----BEGIN` = 0 hits |
| Test focus | `check-test-focus.mjs` | PASS — 205 test files, 0 `.only/.skip` |
| Entity touchpoints | `check-entity-touchpoints.mjs` | PASS |
| Runtime cycles | `check-runtime-cycles.mjs` | **PASS — 259 production files, 0 runtime cycles** |
| Root suite | `pnpm test` | **35 files / 391 tests PASS** |
| Client suite | `pnpm prototype:test` | **170 files / 1,233 tests PASS** (1,224 → 1,233 = +2 census guard, +6 primitive contracts incl. FeedbackNote, +1 state slot) |
| Build + PWA | `pnpm prototype:build` | PASS; PWA precache generated |
| Bundle budget | `check-bundle-budget.mjs` | **raw 633,666 / 650,000 · gzip 150,996 / 155,000 — PASS** |

## Legacy-class census (repo-wide, all source roots)

- `client/src/legacyClassCensus.test.ts` — **2/2 PASS** (non-test source scan of `pages/components/app/pwa/contexts` + CSS-definition absence; comment-stripped).
- Independent charter grep for all 10 retired classes (`micro-button-primary/-secondary/-danger/-quiet/-block`, `micro-save-cost`, `micro-full-action`, `micro-choice-row`, `micro-status-chip`, `micro-g5-choice`) across `client/src` non-test files: **0 hits**.
- `<Button>` usages in non-test source: **299** across 81 files; `<ChoiceButton>`: **8**.

## Route matrix

- `MIGRATION_MATRIX.csv`: **52 rows, 52/52 `migrated`**, legacy columns 0×52; page set matches the 52 filesystem pages 1:1.
- 12 routes carry `none-found` dedicated test files (AgreementEditor, CashAdjustmentEditor, CashOpeningLaterEditor, CashReversalEditor, CashWalletEditor, CashWallets, G5DeclarationEditor, InventoryReversalEditor, NotFound, Parties, SharePreview, Suppliers) — **declared, not claimed**; they are covered by typecheck/lint/the general suites.

## CSS integrity

- Brace balance verified programmatically (balanced; min depth 0).
- Exact-duplicate rule census after the 75-block removal: **0 remaining byte-identical duplicates**.
- `.micro-status-chip`, `.micro-g5-choice` (all copies incl. the duplicated survivors the Agent-5 audit caught), `.micro-button*` family: **absent from all CSS** (guard-enforced).

## Rollback boundary (verified in a clean worktree)

```
git worktree add /tmp/micro-rollback-final 295c87c
pnpm install --frozen-lockfile   # OK (2.5s)
pnpm typecheck                   # exit 0
pnpm test                        # 35 files / 391 tests PASS
git worktree remove …            # clean
```

The pre-run boundary is green and restorable; every wave is a revertible commit; global restore = `git checkout 295c87c`.

## Git hygiene

- Tree clean after every wave and at completion; `git diff --check 295c87c..HEAD` **clean** (exit 0).
- History: linear, 9 completion commits on top of the 12 foundation commits; push is a fast-forward (no force-push).
- Binaries in the diff: 2 PWA mark assets (foundation run) + 16 planning captures — all documented.
- `Micro/main` = `c0469e265f24c70427eb7826dee717be117cff87` and `Documents/main` = `f919982c692e5ba78cf3284a4240c45f66be91c6` — both re-verified after fetch: **unchanged**.
- Domain integrity: `git diff --stat 295c87c..HEAD -- src/domain apps/prototype-web/client/src/application apps/prototype-web/client/src/storage` — **empty** (zero bytes).

## Visual / runtime verification (executed)

- Production build via `vite preview`; fresh profile; 3-step first-run setup completed.
- **16 captures**: home/finance/orders/assets/inventory/catalog/tools/schedule/suppliers/parties/loans @320px; home/finance/orders/tools @390px; QuickActionSheet @390px — **0px horizontal overflow and 0 console errors everywhere** (`capture-log.json`).
- Width matrix: 320 / 360 / 390 / 430 — 0px overflow at every checked width.
- DOM checks: primitive action classes render per classification; **Escape closes the sheet**; finance renders **14 isolated `bdi[dir=ltr]` numeric slots**; the negative-capable correction-effect amount is isolated.
- Runtime smoke: `GET /` → 200; `GET /sw.js` → 200.

## Honestly NOT_RUN (never claimed)

- Physical-device testing (real Samsung/Android hardware).
- Screen-reader (TalkBack/VoiceOver) testing.
- Real hardware-keyboard and real-notch testing.
- OS-level 130% / 200% text-scaling captures (no OS scaling available in the headless environment; width matrix and DOM checks were the honest substitutes).
- Dark-mode visual parity (Dark Mode not activated by decision, ADR-007).
