# FINAL LIMITATIONS — Micro Brand Assets, Motion & Launch Splash (resume run)

## Honest scope boundaries

1. **No physical device was tested.** All visual verification ran in headless Chromium (agent-browser) at 390×844 / 320×690 / 430×932 against the production build. Samsung S25, iOS device, notch/safe-area hardware, and OS text-scaling behaviors were NOT_RUN — browser captures do not prove physical-device rendering.
2. **`prefers-reduced-motion` verified at two levels, not on-device:** deterministic component tests (static mark immediately, no animation classes) and the CSS media-query safety net. No OS-level assistive-tech session was run.
3. **Native system splash screens are NOT active.** The repository contains no Android/iOS native wrapper; `brand/splash/*` SVGs are preserved as platform-ready source references only. The visible, verified splash is the in-app Web/PWA `BrandLaunchSplash` component.
4. **Screens requiring posted financial records were captured in their genuine safe states.** Per the capture policy (no posting/reversal/deletion triggered merely for screenshots): `/orders/:id` (posted-order detail), `/direct-sales/:id`, `/cash/entry/:id/reverse`, `/inventory/movement/:id/reverse`, `/suppliers/purchase/:id`(+`/payment`), `/assets/:id`, `/loans/:id`, and the financial event submissions were not exercised end-to-end with real posted records. Each is documented in `SCREENSHOT_COVERAGE_MATRIX.csv` with its captured state (route recovery/loading states are the routes' real behavior for unknown ids).
5. **Two routes render a perpetual loading state for unknown ids** (`/cash/entry/:id/reverse` → «جارٍ فتح الأثر…», `/inventory/movement/:id/reverse` → «جارٍ فتح حركة المادة…»): the recorded behavior of the current code is preserved as-is — flagged here as an observation, deliberately NOT "fixed" (no product changes beyond the brand scope were allowed).
6. **In-session auto-lock quirk observed (pre-existing):** with the heartbeat alternation, the engaged-lock path is the product's documented scenario (return from hidden/closed after idle). Deliberately not modified — security logic is outside the brand scope.
7. **Fixed elements inside Chromium full-page stitching** (bottom nav, splash overlay, lock gate) render at their viewport position in the stitched image. Complete page content is present in every capture; noted in CAPTURE_RUN_LOG.md.
8. **Screenshot set is 131 original PNGs (~9 MB)** uploaded in full to Documents — no contact-sheet substitution.
9. **The launch splash's minimum visible duration (~1.15 s)** is bounded by the 900 ms one-shot motion + 240 ms release fade, with a 4 s hard cap; on very fast devices the shell may appear before the motion visually completes (release never blocks readiness).
10. **Documents archive is review-only.** Nothing was merged; Micro/main and Documents/main are untouched.

## Not done (explicit)

- No lockup/wordmark asset anywhere in the runtime (owner-rejected assets never imported).
- No brand color translated into financial state, success/error, or product-area colors.
- No new animation dependency (the one-shot motion uses the supplied per-layer SVGs + CSS).
- No network calls, analytics, or external font/image dependencies added.
