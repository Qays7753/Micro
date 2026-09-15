# Old Brand Reference Inventory — `micro-mark` runtime assets

Scanned with repo-wide content search for `micro-mark` on work branch at baseline `c7dedad…`.

## A. Active runtime references (MUST be replaced)

| # | File | Line(s) | Current usage | Replacement plan |
| --- | --- | --- | --- | --- |
| A1 | `apps/prototype-web/client/src/components/layout/AppHeader.tsx` | 28 | `<img src="/micro-mark.svg" …>` direct logo reference in the brand lockup | Replace with centralized `<BrandMark />` component (theme-aware symbol-only mark) |
| A2 | `apps/prototype-web/client/index.html` | 16 | favicon PNG 192 (`/micro-mark-192.png`) | `/brand/favicon/favicon-32.png` + SVG field favicons (light/dark media queries) |
| A3 | `apps/prototype-web/client/index.html` | 17 | apple-touch-icon (`/micro-mark-192.png`) | `/brand/pwa/ios-android-180.png` (180×180 Apple touch size) |
| A4 | `apps/prototype-web/vite.config.ts` | 250 | `includeAssets: ["micro-mark.svg", "micro-mark-192.png", "micro-mark-512.png"]` (SW precache) | New brand asset set under `/brand/**` required for the app shell |
| A5 | `apps/prototype-web/vite.config.ts` | 265 | manifest icon 192 any | `/brand/pwa/ios-android-192.png` |
| A6 | `apps/prototype-web/vite.config.ts` | 266 | manifest icon 512 any+maskable | `/brand/pwa/ios-android-512.png` + `/brand/pwa/web-maskable-512.png` (separate maskable entry) |

## B. Old asset files in `client/public/` (deleted only at the migration gate, W2+)

| File | Status |
| --- | --- |
| `apps/prototype-web/client/public/micro-mark.svg` | old runtime logo — remove after A1–A6 are migrated |
| `apps/prototype-web/client/public/micro-mark-192.png` | old runtime icon — remove after A2/A3/A5 are migrated |
| `apps/prototype-web/client/public/micro-mark-512.png` | old runtime icon — remove after A4/A6 are migrated |

## C. Historical documentation references (evidence — NOT rewritten)

| File | Nature | Action |
| --- | --- | --- |
| `docs/quality/pwa-install-update-acceptance-v1.md` | acceptance procedure naming the then-current icon files | keep as historical evidence; add transition note pointing to the new brand paths |
| `docs/expansion/historical-source/README.md` | historical source register (coincidental `micro-mark` token match is part of prose) | no change — not a runtime reference |
| `planning/micro-standard-ui-aux-integration-2026-09/SOURCE_PROVENANCE.md` | prior-run provenance of files read | no change — historical evidence |
| `planning/micro-standard-ui-aux-integration-2026-09/W1_REPORT.md` | prior-run report describing old asset generation | no change — historical evidence |
| `planning/micro-standard-ui-aux-integration-2026-09/BASELINE_MANIFEST.json` | prior-run baseline hash manifest (git blob hash of old asset) | no change — historical evidence |

Rule applied: runtime references are migrated; historical evidence is preserved verbatim. `micro-mark` token matches inside prose that merely describe history are documented here, not edited.
