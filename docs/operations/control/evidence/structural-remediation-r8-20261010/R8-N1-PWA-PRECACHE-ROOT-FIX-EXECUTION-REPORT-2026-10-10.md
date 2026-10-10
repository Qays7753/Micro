# R8-N1 — PWA Precache Root-Fix Execution Report (2026-10-10)

**Finding:** R8-N1 — duplicate precache URLs in the generated `sw.js`
**Owner decision:** `FIX_NOW` (2026-10-10 continuation review) — not a deferred/separate track
**Result:** `CLOSED_WITH_EVIDENCE` — the generated production artifact now carries each intended precache URL exactly once, proven on real builds, with a deterministic fail-closed regression class

---

## 1. Exact scope anchors

| Anchor | Value |
|---|---|
| Repository | `Qays7753/Micro` |
| PR | #345 (open, unmerged; base `main` @ `1e2678645d3c41beb448da2a0d8d2b5d817a18fe`) |
| Branch | `refactoring/r8-bundle-file-growth-guards-20261010` |
| Pre-fix PR head | `0ddba665c0578621a472a40e5e9e3665fedff3a2` (R8 final head; this fix resumes from it) |
| Code head (root fix) | `7341f91195a59100a4b9111b1d81c21f0f184368` (commit `fix(r8-n1)`) |
| Final PR head | The documentation/closure commit that carries this report (pinned in the PR body; `current-state.md` records it as `final_pr_head` distinct from `code_head`) |
| Toolchain (local) | node v24.21.0 · zlib 1.3.2.1-motley-8002e91 · linux/x64 · pnpm 9.15.9 · vite 7.3.6 · vite-plugin-pwa 1.3.0 · workbox 7.4.1 |

## 2. Root-cause analysis (before → after)

**Before (defect):** the generated `dist/public/sw.js` contained **187 precache entries for 156 unique URLs — 31 duplicate URLs**, each duplicated entry byte-identical to its twin (`{url, revision}` with the same MD5 revision). The R7-era bundle guard double-counted those duplicates (+76,466 B); the R8-1 rewrite already measured unique URLs truthfully and reported the duplicates every run, but the artifact itself kept generating them.

**Mechanism (proven from the vite-plugin-pwa 1.3.0 source, `dist/index.js`, `configureStaticAssets`):** the plugin globs `includeAssets` patterns against the **public directory** and pushes the matches into `workbox.additionalManifestEntries`; separately, Workbox `generateSW` globs `globPatterns` against the **build output**, which contains the verbatim copies of all public assets. Workbox does not deduplicate `additionalManifestEntries` against the `globPatterns` results — every file matched by both selectors is emitted twice.

**Both overlapping selectors (the second was found by differential experiment, not by the original finding):**

1. `includeAssets: [brand/mark/*.svg, brand/motion/*.svg, brand/motion/light/*.svg, brand/motion/dark/*.svg, brand/favicon/*, brand/pwa/*]` — **31 files**, every one an svg/png/ico already matched by `globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"]` over the build output → 31 duplicate URLs.
2. `includeManifestIcons` — **defaults to `true`** and adds the three `manifest.icons[].src` paths (`brand/pwa/ios-android-192.png`, `brand/pwa/ios-android-512.png`, `brand/pwa/web-maskable-512.png`) to the same public-dir glob → 3 duplicate URLs that would survive a naive `includeAssets`-only fix.

**Attribution evidence (observable in the artifact):** in the pre-fix `sw.js`, entries 0–154 are the Workbox `globPatterns` region (sorted: `index.html`, `fonts/*`, `brand/splash/*`, `assets/*`) and entries 155–185 are the appended `additionalManifestEntries` tail — exactly the 31 `includeAssets` matches in selector order — followed by entry 186 `manifest.webmanifest` (the plugin's own managed entry). Entry 186 is **not** a duplicate (`.webmanifest` is not in `globPatterns`), which is why the duplicate count is 31 and not 32.

**Differential build experiments (real production builds, official path `pnpm build`):**

| Build | Configuration | Entries | Unique | Duplicates |
|---|---|---|---|---|
| A (pre-fix, head `0ddba66`) | `includeAssets` (6 patterns) + `includeManifestIcons` default `true` | 187 | 156 | **31** |
| B (experiment, not committed) | `includeAssets` removed only | 159 | 156 | **3** (exactly the 3 manifest icons) |
| C (root fix, head `7341f911`) | `includeAssets` removed + `includeManifestIcons: false` | **156** | **156** | **0** |

Build B is the proof that the fix is not the naive one: removing only `includeAssets` leaves the second overlapping selector live.

**After (root fixed):** one canonical precache-selection path exists — Workbox `globPatterns` over the build output. `includeAssets` is removed entirely (not narrowed) and `includeManifestIcons` is explicitly `false`. Every intended asset class remains covered by that single path: svg/png/ico brand assets **including the six `brand/splash/*` references that were never in `includeAssets`**, woff2/css fonts, js/css/html shell chunks; `manifest.webmanifest` keeps its own plugin-managed entry. Each intended URL is selected exactly once by exactly one path, so the duplicate condition is structurally impossible, not merely filtered.

## 3. Exact configuration change and why it is canonical

`apps/prototype-web/vite.config.ts` (the only production-configuration change):

```diff
-  includeAssets: [
-    "brand/mark/*.svg",
-    "brand/motion/*.svg",
-    "brand/motion/light/*.svg",
-    "brand/motion/dark/*.svg",
-    "brand/favicon/*",
-    "brand/pwa/*",
-  ],
+  includeManifestIcons: false,
```

plus a dated comment documenting the single-path design (W2 brand rationale preserved: mark, favicon, install icons, splash motion layers, and platform-ready splash references all still precache with the shell — now via the one canonical path). `workbox.globPatterns`, `globIgnores`, `maximumFileSizeToCacheInBytes`, `navigateFallback`, the manifest, and every other option are untouched.

**Why canonical:** the alternative designs were evaluated and rejected —
- *Keep `includeAssets`, add `globIgnores: ["brand/**"]`*: two selectors that must mirror each other forever; the `includeManifestIcons` overlap would still need a third fix; any future public asset outside the ignored set re-duplicates. Rejected (fragile multi-path).
- *Deduplicate inside the guard only*: explicitly rejected by the owner decision — the artifact, not the measurement, must be correct.
- *Chosen design*: `globPatterns` over the build output is the only selector that already covered **every** intended class (the `includeAssets` set was a strict subset by extension), so removing the redundant selectors loses nothing and leaves exactly one path.

## 4. Intended-asset coverage proof (before/after set comparison)

Machine-verified comparison of the full unique-URL sets from Build A (pre-fix) and Build C (root fix), recorded in the PR evidence:

- **lost = [] ; gained = [] ; sets identical = true** (156 URLs before and after).
- Duplicate URL count in the generated `sw.js`: **31 → 0**.

Category breakdown of the 156 intended offline URLs (identical before/after):

| Category | Count | Selection path (after fix) |
|---|---|---|
| `assets/*` build outputs (js/css chunks incl. workbox-window) | 105 | `globPatterns` |
| `brand/favicon/*` (png/ico/svg) | 6 | `globPatterns` |
| `brand/mark/*` (svg) | 3 | `globPatterns` |
| `brand/motion/*` direct (svg) | 2 | `globPatterns` |
| `brand/motion/light/*` (svg) | 4 | `globPatterns` |
| `brand/motion/dark/*` (svg) | 4 | `globPatterns` |
| `brand/pwa/*` (png/svg incl. the 3 manifest icons) | 12 | `globPatterns` |
| `brand/splash/*` (svg — never in `includeAssets`) | 6 | `globPatterns` |
| `fonts/*` (11 woff2 + fonts.css) | 12 | `globPatterns` |
| `index.html` (app shell) | 1 | `globPatterns` |
| `manifest.webmanifest` | 1 | plugin-managed entry |

No unintended asset category is present (no dev tools, no `__manus__`, no `_headers`/`_redirects`/`.gitkeep` — exactly as before the fix; `globIgnores` unchanged). The largest precached file is 59,800 B (`fonts/Alexandria-VF.woff2`), far under the 2 MiB Workbox cap. `brand/motion/micro-assembly.json` remains outside the precache exactly as before (it was never selected by either path; changing that would alter the intended set, which this fix explicitly does not).

## 5. Guard regression class (deterministic, fail-closed)

`apps/prototype-web/scripts/check-bundle-surfaces.mjs` now treats any duplicate precache URL as a hard integrity failure — new failure code `DUPLICATE_PRECACHE_URLS` listing every duplicated URL and count — instead of measuring over duplicates and printing a report line. The guard executes in the app `build` chain (`vite build && check-bundle-budget && check-bundle-surfaces`), i.e. on **every real production build in every environment** (local, CI `pnpm check`, Cloudflare Pages build), so the duplicate condition cannot return silently anywhere. Path-escape/missing-file fail-closed behavior and all baseline/tolerance semantics are untouched (guard strengthening only; no ceiling, tolerance, or baseline rule changed).

Tests (`check-bundle-surfaces.test.mjs`, 19 → **22**, all deterministic, no network): single-duplicate fixture fails with `DUPLICATE_PRECACHE_URLS` + exact count + URL list; multi-duplicate fixture lists **all** duplicates (not just the first); clean manifest measures the unique count and passes; the CLI exits 1 on a real duplicate (end-to-end). The remaining 18 tests of the suite are unchanged and green.

## 6. Bundle-surface measurements (before → after, with explanation of every changed value)

Real production builds on the official path; guard output recorded verbatim in the PR evidence:

| Surface | Before (Build A) | After (Build C) | Explanation |
|---|---|---|---|
| entry raw / gzip | 629,300 / 154,683 | 629,300 / 154,683 | unchanged — entry chunk untouched; ceilings 650,000/155,300 (check-bundle-budget) untouched and PASS |
| initial companions raw / gzipNorm | 224,687 / 70,716 | 224,687 / 70,716 | unchanged — JS graph untouched |
| lazy raw / gzipNorm | 1,206,629 / 363,974 | 1,206,629 / 363,974 | unchanged |
| precache unique bytes | 2,672,243 (local) | 2,672,243 | unchanged — the guard already measured unique URLs; the artifact now matches the measurement |
| precache unique entry count | 156 | 156 | unchanged (187 raw entries → 156) |
| **swRuntime raw (sw.js + workbox)** | **28,885** | **26,170** | **the only changed value: sw.js loses the 31 duplicate `{url,revision}` manifest entries (−2,715 B); workbox runtime unchanged; reduction locked in this PR by re-anchoring all three environment records** |

`bundle-surfaces-baseline.json`: `swRuntimeRawTotal` 28,885 → 26,170 in `local`, `github-actions`, and `cloudflare-pages` (same-PR lock-the-reduction protocol). The `local` record is anchored at the actual local production build of code head `7341f911`. The two cloud records are same-tree re-anchors with the environment-invariance argument (sw.js byte size cannot vary across environments: revision digests are fixed-length hex, and all three environments measured identical 28,885 pre-fix at the R8-1 anchor); they are verified by the CI and Cloudflare Pages runs on the final PR head (URLs pinned in the PR body). Superseded anchors are preserved inside the dated method strings (Pages production fetch of `1e267864`; CI bootstrap dispatch run `38046254527` on `a69f1e14`) — old → new, nothing rewritten silently. The file stays at 108 nbLOC (ratchet measurement data unchanged in size). A dated correction in `provenance.seed_note` closes the old "separate track" language.

File-size ratchet v2: the guard grew 457 → 467 nbLOC (WATCH), authorized by ledger entry `R8-N1-ROOT-FIX` in `scripts/file-size-ratchet-reanchors.json` (chained from/to values, owner-review reference) with the ratchet baseline updated in the same PR — the R8-3 precedent followed exactly. `node scripts/check-file-size-ratchet.mjs` → PASS (488 files, zero unjustified growth, migration seed verified).

## 7. Protected invariants (verified)

- `localSchemaVersion=38`, `localExportVersion=30` — untouched (no domain/storage/schema/export file changed; the diff is vite.config.ts + two guard scripts + guard data).
- No financial, domain, semantic, historical, rejection, or storage behavior touched; no `client/src/**` or `src/**` production code changed.
- No visual-UI redesign: the PWA manifest, icons, theme, and every precached brand/splash asset are byte-identical; the only artifact change is the removal of duplicate manifest entries inside `sw.js` (runtime-precaching behavior is unchanged — Workbox deduplicated identical entries at runtime anyway; the fix removes wasted bytes and the ambiguous manifest).
- Bundle ceilings 650,000 raw / 155,300 gzip unchanged and passing.
- The preserved UI branch `docs/ux-ui-zed-handoff-20260921` untouched.
- No secrets exposed; no guard weakened (the surfaces guard was strengthened; the ratchet authorized guard growth through its documented ledger).

## 8. Verification record (commands, exit codes, environments)

Local (linux/x64, node v24.21.0) on the root-fix tree — focused first, then the canonical aggregate:

| Command | Result |
|---|---|
| `pnpm --filter @micro/prototype-web exec vitest run scripts/check-bundle-budget.test.mjs scripts/check-bundle-surfaces.test.mjs` | 2 files, **40/40 passed** (18 budget + 22 surfaces) |
| `pnpm exec vitest run scripts/check-file-size-ratchet.test.mjs` | **20/20 passed** |
| `pnpm --filter @micro/prototype-web check` (tsc --noEmit) | exit 0 |
| `pnpm lint` | 0 errors (35 warnings — verified identical to the pre-fix tree: zero new) |
| `pnpm format:check` | all files match |
| `node scripts/check-file-size-ratchet.mjs` | PASS (exit 0) |
| `node apps/prototype-web/scripts/check-bundle-surfaces.mjs apps/prototype-web/dist/public` | PASS (exit 0; parity against the re-anchored baseline) |
| `pnpm build` (app, official path; Builds A/B/C) | exit 0 ×3 — A: 187 entries/31 dups; B: 159/3; C: **156/0** |
| `pnpm check` (canonical aggregate, final tree) | recorded in the closure commit and the PR body |
| `node scripts/check-doc-index-coverage.mjs` + current-state size guards | recorded in the closure commit |

CI (`github-actions`) and **Cloudflare Pages** on the exact final PR head: run URLs pinned in the PR body after the final push (the committed file cannot contain the URL of a run triggered by its own push — the R8 precedent: code-head and final-head URLs live in the PR body). The CI run is also the verification of the re-anchored `github-actions` baseline record (expected 26,170); the Pages check-run verifies the `cloudflare-pages` record.

## 9. Files changed / explicitly not changed

**Changed (7 + docs):** `apps/prototype-web/vite.config.ts` (root fix); `apps/prototype-web/scripts/check-bundle-surfaces.mjs` (fail-closed duplicates); `apps/prototype-web/scripts/check-bundle-surfaces.test.mjs` (22 tests); `apps/prototype-web/scripts/bundle-surfaces-baseline.json` (swRuntime re-anchor ×3 + dated provenance); `scripts/file-size-ratchet-baseline.json` (457→467); `scripts/file-size-ratchet-reanchors.json` (ledger `R8-N1-ROOT-FIX`); this report; plus the Operations Control/docs reconciliation (WS-216.json, ARCH-007.json, regenerated views, `current-state.md`, `current-state-log.md`, `AGENT-SEQUENTIAL-WORKLOG.md`, register §7 dated note, R8-1/R8-COMPLETE reports dated corrections).

**Explicitly not changed:** all `client/src/**` and `src/**` production code; `.github/workflows/ci.yml`; package scripts (the build chain already runs the guard); every other guard; the PWA manifest content, icons, and theme; `globPatterns`/`globIgnores`/`maximumFileSizeToCacheInBytes`/`navigateFallback*`; the preserved UI branch; any provider setting.

## 10. Rollback boundary

Revert the two commits on this branch (code head `7341f911` + the closure/docs commit) — or, minimally, revert `vite.config.ts` to restore the previous selectors and revert the baseline `swRuntimeRawTotal` to 28,885. The rollback restores the pre-fix artifact (187 entries/31 duplicates) and the pre-fix measurements; no data, schema, or storage migration is involved (the service-worker precache is rebuilt from configuration on every deploy; `cleanupOutdatedCaches` handles stale caches on update).

## 11. Disposition

- **R8-N1 — FIX_NOW — CLOSED_WITH_EVIDENCE** (supersedes the R8-1-era `SEPARATE_TRACK_OPENED_WITH_EXACT_TRIGGER`, closed by the owner's FIX_NOW decision; dated corrections applied in the R8-1 execution report, the R8-COMPLETE report §6/§15/§23, the register §7 note, and the baseline provenance).
- **No merge performed, no cleanup performed, no secrets exposed.** PR #345 remains open for owner review; merging is owner-only.
