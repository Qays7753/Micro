# CAPTURE_RUN_LOG — W5 full-screen visual verification

## Environment

- Production build (`pnpm build`, bundle budget PASS) served by `vite preview` at http://localhost:4173 (service worker active).
- Headless Chromium via agent-browser, device viewport 390×844 (canonical), 320×690 and 430×932 for responsive-risk extras.
- Profile: disposable local browser profile; fixtures created only through the product's own flows.

## Session timeline (resume run)

1. Workspace recovery and state verification (see RESUME_STATE_REPORT.md).
2. Continued W5 from the fixture-preparation point on the preserved session (project «مشروع النخبة», draft `c8962027…`, wallet «الدرج» `f1445930…`):
   - Material fixtures via /inventory/material/new: «جلبة شعار» (confirmed opening 12 / 24.00) and «قماش تغليف» (unconfirmed balance) — unlocked the confirm-balance journey (S37).
   - Movement editors receipt/consume/waste captured empty (S38/38b/38c) — submissions NOT triggered.
   - Estimate fixture «تقدير المجسم» saved via the calculator (thinking tool, no financial trace) → /tools/estimate/6753d619… (S43).
   - Remaining light screens: catalog, tools hub, integrity, assets, loans, suppliers (+safe states), parties, settings, profile, not-found.
   - AppLockGate (light): enabled 1-minute auto-lock → the gate engages on the app's real path (context freeze / idle → reopen). Captured engaged, then disabled.
   - Dark pass: theme toggled via the header control (persisted preference); every screen re-captured dark; dark AppLockGate captured with the same freeze-idle-reopen path on a fresh profile carrying project+dark+lock.
   - Final captures on a fresh disposable profile: setup steps 1–3 LIGHT (full-page re-captures replacing the interrupted run's viewport-only ones), dark splash, setup steps 1–3 DARK.
3. Responsive extras: 320px (home, finance, statement) and 430px (home, finance, orders).

## Method guarantees

- Every capture: `window.scrollTo(0,0)` → settle → full-page screenshot (`--full`).
- Filenames embed the exact live DOM `h1` text (UTF-8) + route slug + theme + viewport token.
- Console/page errors checked across the session: none observed (agent-browser `errors`/`console` empty; final overflow probe 390=390 — no horizontal overflow).
- No posting, reversal, deletion, transfer, distribution, or payment confirm was ever clicked. Reversal/payment/purchase screens were captured in their genuine safe states.

## Documented capture behaviors (honest notes, not defects)

- Chromium full-page stitching renders FIXED elements (bottom navigation, launch overlay, lock gate) at their viewport position inside the stitched image; the full page content is present in every capture.
- The 320/430 extras were taken on the fresh profile where the PWA install banner was still visible (genuine dismissible app surface); canonical 390 light captures come from the profile where it had been dismissed.
- /cash/entry/:id/reverse and /inventory/movement/:id/reverse render their route's genuine loading state ("جارٍ فتح الأثر…", "جارٍ فتح حركة المادة…") for unknown ids — captured as-is; the routes' not-found branches are storage-error paths, and real instances require posted records (not triggered).
- AppLockGate full-page captures show the gate covering the viewport region with the covered page visible below the fold (fixed overlay behavior); the gate surface itself is complete.

## Totals

- 131 original full-page PNG captures: 63 light + 62 dark + 6 responsive extras (320/430).
- Coverage matrix: 131 PASS, 2 NOT_RUN (the `/review` redirect — not a screen), 0 FAILED.
