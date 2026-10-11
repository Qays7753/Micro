# R9C — Real-browser execution evidence (F7 + F7.1 listener families)

**Date:** 2026-10-11 (Asia/Amman) · **Continuation:** PR #347 systemic root-fix (R9-GA-F8 artifact-completeness closure; F7 hardening re-verified, F7.1 included in the exercised bundle)
**Code state exercised:** the committed adapter bundle `adapter-entry.js`, built from the repository tree at the git head recorded in `f7-manifest.json` (the F7 listener hardening + the F7.1 listAll read guard + all storage commits of this PR).

## Why out-of-band

The repository has **no real-browser test harness** (verified: no playwright/puppeteer/cypress/webdriver in any package.json or CI job; vitest uses jsdom + fake-indexeddb 6.2.5; `docs/quality/prototype-qa-v1.md:50` states no automated Playwright coverage exists; the Cloudflare Pages PR check is a provider-side build). The owner's continuation mandates require real-browser evidence where obtainable **without adding unrelated infrastructure to the repository**. This package is therefore an execution-evidence chain: every file needed to reproduce the exact run is committed here, and nothing adds test infrastructure to the repository's own pipelines. The standing recommendation for an in-repo CI harness remains (repair card R9-GA-F7 — now for CI reproducibility, not for defect closure).

## The reproducible chain (R9-GA-F8 closure)

| File | Role |
|---|---|
| `build-adapter-entry.mjs.txt` | The deterministic builder: bundles the repository's own `IndexedDbLocalStore.ts` (with its whole relative-import graph; the aliased `@micro-domain/*` imports are type-only and erased) through the repository lockfile's pinned esbuild 0.28.2. Run from the repository root after `pnpm install`. |
| `adapter-entry.js` | **The exact bundle the browser executed** — committed, 246,768 bytes, SHA-256 in `adapter-entry.sha256` and `f7-manifest.json`. |
| `f7-harness.mjs.txt` | The harness module — imports `./adapter-entry.js` (the committed bundle), runs the RB-3 legs A + B scenario (mirrors `rollbackRehearsal.r9.test.ts`), writes the JSON verdict into `#result` and flips the title to `DONE`. |
| `f7-page.html` | The host page (`#result` + the module script). |
| `f7-manifest.json` | The content-addressed manifest: source blob SHAs (adapter + primitives), the git head, esbuild version + exact command + options, output size + SHA-256, every artifact's SHA-256, the recorded run's engine + verdict, and the ordered reproduction steps. |
| `f7-verdict.json` | The machine-readable verdict from the recorded run. |
| `f7-run.json` | The full run record: serving URL, served-bundle SHA-256, per-leg results and exact messages, state-integrity read-backs, console lines. |

### Reproducing exactly

1. `pnpm install` (the lockfile pins esbuild 0.28.2).
2. `node docs/operations/control/evidence/structural-remediation-r9-20261010/r9c-browser-evidence/build-adapter-entry.mjs.txt` — regenerates `adapter-entry.js` + `adapter-entry.sha256`; the digest must match `f7-manifest.json`.
3. Serve this directory over localhost and open `f7-page.html` in a real browser. The README's recorded run used the playwright runner preserved verbatim in the section below (any static file server + a real Chromium works; the harness is self-contained).
4. The page title flips to `DONE`; `#result` carries the JSON verdict; `f7-verdict.json` records the result of the committed run.

### The recorded run's runner (verbatim, out-of-band)

`node <runner>` from the repository root, where `<runner>` is a script that: copies `f7-harness.mjs.txt` to `f7-harness.mjs` in this directory, serves the directory on an ephemeral localhost port, launches real Chromium via playwright (`chromium.launch()`), waits for the `DONE` title (bounded 30s), reads `#result` and `navigator.userAgent`, and writes `f7-verdict.json` + `f7-run.json`. The full runner used for the recorded run is preserved in the R9 systemic execution report's evidence annex (the run record in `f7-run.json` captures everything it produced: URL, served-bundle SHA-256, per-leg results, console).

## Execution 1 — F7 hardened listener-failure paths on real IndexedDB

The committed bundle (which contains the F7 hardening: 73 write-queueing listeners wrapped in `guardedSuccessListener` + the locally-guarded `writeOneIdempotent` + the F7.1 `listAll` read guard) runs the RB-3 scenario against Chromium's native IndexedDB:

| Leg | Operation | Observed on real Chromium (`HeadlessChrome/156.0.8078.4`) |
|---|---|---|
| B (Style A) | `commitFinancialEventCorrection` with a poisoned (uncloneable) reversal | `ok:false`, `code:"storage_error"`, message = **`Failed to execute 'put' on 'IDBObjectStore': () => "poison" could not be cloned.`** (the ORIGINAL DataCloneError payload, not a replacement AbortError, not a false success); events family afterwards = exactly the seeded record |
| A (primitive) | `saveDirectSale` (→ `writeOneIdempotent`) with a poisoned sale | `ok:false`, `code:"storage_error"`, original DataCloneError message; zero sales persisted |

All four verdict booleans `true` (`f7-verdict.json`); zero console errors (`f7-run.json`). This verifies on a real engine that the fixed code paths (in-listener catch → settle the original error → guarded abort → onabort delivery) behave exactly as proven on fake-indexeddb in CI.

## Execution 2 — page surfaces on the real production build (2026-10-10 run, unchanged by this closure)

The 2026-10-10 out-of-band run (agent-browser 0.39.0 / HeadlessChrome/155) verified on the real production build: `/cash/entry/<unknown>/reverse` renders «لم نجد أثر الكاش» with loading absent; `/inventory/movement/<unknown>/reverse` renders «لم نجد حركة المادة»; the G5 editor renders fully. Those observations belong to the first continuation's report (§5 there) and are not re-claimed here — this package's chain covers the storage legs; the page-surface legs remain covered by the jsdom direct tests through the real service layer plus that recorded run.

## Honest boundary (what this does NOT prove)

- Not a repeatable CI check — a recorded run with a reproducible committed chain; CI reproducibility still requires the in-repo harness (the standing R9-GA-F7 trigger, now for CI only).
- The read-error surfaces (F3.1/F3.2/F3.7 failure paths) were NOT browser-verified: no UI path can make a real storage read fail on demand (records are JSON-validated; the failure requires an engine-level fault). Their behavior is proven by the jsdom direct tests (fail-once stores through the real services) — the browser verifies the render path only for loading/not-found/ready.
- The unsaved-changes guard, duplicate-reversal, and empty-reason gates are covered by the jsdom suite, not re-driven here.
