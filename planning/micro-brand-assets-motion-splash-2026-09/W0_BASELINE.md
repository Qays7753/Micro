# W0 — Baseline and Inventory (Micro Brand Assets, Motion & Launch Splash)

Date: 2026-09-15 (UTC+8 session) · Agent: ZAI Flash (lead; five specialist roles performed sequentially with the same evidence artifacts)

## 1. Repository and baseline verification

| Item | Value |
| --- | --- |
| Remote | `https://github.com/Qays7753/Micro` |
| Remote `main` HEAD at start | `c7dedadc669a9c1a918a107e206d8a0ddff73e5f` |
| Expected baseline | `c7dedadc669a9c1a918a107e206d8a0ddff73e5f` |
| Match | ✅ EXACT — no reconciliation needed |
| Local clone baseline commit | `c7dedadc669a9c1a918a107e206d8a0ddff73e5f` |
| Work branch | `micro-brand-assets-motion-splash-20260915` (created from verified `main`, HEAD = baseline) |
| Bridge branch | `micro-brand-assets-motion-splash-bridge-20260915` (created at the same commit; to be fast-forwarded to the verified work state before push) |
| `git status` at branch creation | clean (no uncommitted files) |

## 2. Rollback boundary

- Rollback boundary = baseline commit `c7dedad…` on `main` plus the two freshly created branches above, before any source change.
- All implementation commits happen only on `micro-brand-assets-motion-splash-20260915`.
- The bridge branch is a review mirror and is only updated by fast-forward to verified work-branch commits.
- No history rewrite, no force push, no direct commits to `main`, no merge.

## 3. Asset package availability

- The ZAI workspace did NOT contain `micro_brand_assets_unpacked/assets/` at session start (searched the full filesystem).
- The approved package was recovered from the owner's own archive: Documents branch `micro-standard-v2-zai-execution-handoff-20260913`, path `planning/micro-standard-v2-execution-handoff-2026-09/reference/brand-assets/#MicroFinancialLogoSystem.zip`.
- Verification of the recovered package:
  - 79 asset files under `assets/` — matches the stated package size.
  - Every filename required by the task contract is present (symbol marks, motion light/dark layers, splash sources, PWA/favicon PNGs and SVGs, favicon.ico).
  - `BRAND_REFERENCE_CLASSIFICATION.md` in the same handoff branch documents this archive as the Micro identity reference evidence (logo fidelity preserved, no UI-token translation) — consistent with the task's brand boundary rules.
- Conclusion: NOT BLOCKED. Implementation proceeds from the owner's archived approved package, byte-for-byte as supplied.

## 4. Baseline health checks (before any change)

- `pnpm check` (tsc --noEmit): PASS
- `pnpm test` (vitest run): 175 files / 1258 tests — all PASS
- Runtime logo references found (see OLD_BRAND_REFERENCE_INVENTORY.md):
  - Runtime code/config: `AppHeader.tsx`, `client/index.html`, `vite.config.ts`
  - Old assets in `client/public/`: `micro-mark.svg`, `micro-mark-192.png`, `micro-mark-512.png`
  - Historical documentation: 5 further files (docs/, planning/) — evidence preserved, not rewritten

## 5. Environment

- Node v24.19.0, pnpm 9.15.9 (installed), Playwright-class headless browser via agent-browser 0.37.1 for W5 capture.
- Capture baseline build: production build + `vite preview` (PWA service worker active).
