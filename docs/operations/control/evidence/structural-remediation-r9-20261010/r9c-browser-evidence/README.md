# R9C — Out-of-band real-browser execution evidence (F7 + page surfaces + G5 identity)

**Date:** 2026-10-10 (Asia/Amman) · **Continuation:** PR #347 root-fix (F3.1–F3.5, W3-F1, F7)
**Code state exercised:** the continuation working tree = commit `0bb51d1e` content (the three fix commits `56c47a27` + `c1d294b1` + `0bb51d1e`, before the docs commit).

## Why out-of-band

The repository has **no real-browser test harness** (verified: no playwright/puppeteer/cypress/webdriver in any package.json or CI job; vitest uses jsdom + fake-indexeddb 6.2.5; `docs/quality/prototype-qa-v1.md:50` states no automated Playwright coverage exists; the Cloudflare Pages PR check is a provider-side build). The owner's continuation mandate for Fix Group E requires real-browser evidence where obtainable **without adding unrelated infrastructure to the repository**. This evidence was therefore produced by an out-of-band execution (agent-browser 0.39.0 / real Chromium) against the repository's own code, with the machine-readable artifacts preserved here (the PNG screenshots taken during the run were removed to honor the repository's image policy — owner decision 2026-10-01: no report visuals in-repo; the verdict JSON carries the exact observed messages and engine UA). Nothing below adds test infrastructure to the repository; the limitation that this is not a repeatable CI check is recorded as the standing trigger for a future in-repo harness (repair card R9-GA-F7).

## Environment

- Engine: `HeadlessChrome/155.0.0.0` (real Chromium via Playwright; UA in `f7-verdict.json`)
- Tool: agent-browser 0.39.0 CLI
- Serving: `python3 http.server` (harness) and a minimal SPA-fallback static server (app build) on localhost
- App build: the repository's own production build (`vite build` output of the continuation tree — the same pipeline CI/Pages run)

## Execution 1 — F7 hardened listener-failure paths on real IndexedDB (`f7-harness.mjs.txt`, `f7-verdict.json`)

A standalone page bundling the repository's own `IndexedDbLocalStore` (esbuild, type-imports erased; the exact committed adapter code) ran the RB-3 scenario against Chromium's native IndexedDB:

| Leg | Operation | Observed on real Chromium |
|---|---|---|
| B (Style A) | `commitFinancialEventCorrection` with a poisoned (uncloneable) reversal | `ok:false`, `code:"storage_error"`, message = **`Failed to execute 'put' on 'IDBObjectStore': () => "poison" could not be cloned.`** (the ORIGINAL DataCloneError payload, not a replacement AbortError, not a false success); events family afterwards = exactly the seeded record |
| A (primitive) | `saveDirectSale` (→ `writeOneIdempotent`) with a poisoned sale | `ok:false`, `code:"storage_error"`, original DataCloneError message; zero sales persisted |

All four verdict booleans `true` (`f7-verdict.json`). This verifies on a real engine that the fixed code path (in-listener catch → settle the original error → guarded abort → onabort delivery) behaves exactly as proven on fake-indexeddb in CI.

## Execution 2 — page surfaces on the real production build (recorded below; screenshots removed per the image policy)

First-run setup completed through the real UI, then:

- `/cash/entry/nonexistent-entry/reverse` → heading **«لم نجد أثر الكاش»** rendered, `.micro-route-loading` **absent** (loading ended) — R9-W3-F1/F3.1 not-found reachability on a real engine.
- `/inventory/movement/nonexistent-movement/reverse` → heading **«لم نجد حركة المادة»**, loading absent — same for F3.2.
- `/finance/g5/declaration` → editor renders (amount input, knowledge select, details layer all present).

## Execution 3 — G5 idempotency identity end-to-end through the real UI (`g5-after-two-saves.png`)

1. Save: amount 20 (→ 2,000 minor), source «بروفة المتصفح الحقيقية», note «ملاحظة بروفة موحدة», knowledge «مؤكد».
2. Retry with identical inputs → **reused** (still exactly one persisted record — honest dedupe on the real engine).
3. Save again differing **only** in knowledge («يحتاج مراجعة») → a **second** record persisted.
4. Direct IndexedDB read (browser eval) shows both records with the new-format keys:
   - `g5-ui:["collection","2026-10-11",2000,"بروفة المتصفح الحقيقية","ملاحظة بروفة موحدة","known",null,null]`
   - `g5-ui:["collection","2026-10-11",2000,"بروفة المتصفح الحقيقية","ملاحظة بروفة موحدة","needs_review",null,null]`

Before the F3.4 fix the second save would have hit the identical old key and been silently swallowed as `reused`. No page errors, no unhandled console errors during any execution.

## Honest boundary (what this does NOT prove)

- Not a repeatable CI check — a one-time out-of-band execution recorded here as evidence; reproducibility requires an in-repo harness (the standing R9-GA-F7 trigger).
- The read-error surfaces (F3.1/F3.2 failure path) were NOT browser-verified: no UI path can make a real storage read fail on demand (records are JSON-validated; the failure requires an engine-level fault). Their behavior is proven by the jsdom direct tests (fail-once store through the real service) — the browser verifies the render path only for loading/not-found/ready.
- The unsaved-changes guard, duplicate-reversal, and empty-reason gates are covered by the jsdom suite, not re-driven here.
