# ARCHITECTURE SCAN — W0 Re-verification (read-only)

**Subject:** Micro @ `c0469e265f24c70427eb7826dee717be117cff87` (branch point).
**Method:** Agent 1 (independent read-only auditor) re-verified the accepted scan (`audits/micro/structure-architecture-code-organization-scan-v1.md` @ `audit/micro-structure-architecture-scan-2026`) claim-by-claim against the live tree. No file was reorganized, moved, renamed, or edited in W0.

## 1. Verification verdict

The accepted scan **holds at this commit**. Claim-by-claim: 13 CONFIRMED exactly, 4 CONFIRMED with definitional deltas, 0 contradictions.

| Claim | Verdict | Evidence |
|---|---|---|
| 57 `<Route>` elements, wouter, flat Switch (~21 prefix families) | CONFIRMED | `app/MicroRouter.tsx:86-157` |
| navigation.ts contextual labels | CONFIRMED (17 branches, 4 primary items) | `app/navigation.ts:13-48`; formal contract in `navigationContract.ts` (34 canonical return fallbacks) |
| routeClassifier surface/deep/setup + `showsGlobalChrome` | CONFIRMED | `app/routeClassifier.ts:14,74-76` |
| 60 page TSX / 47 non-test components | DELTA (definition) | 60 `.tsx` in pages/ of which 8 are tests → **52 non-test pages**; components = 45 `.tsx` + 2 `.ts` |
| application layer zero UI imports | CONFIRMED | enforced by `eslint.config.js:197-215`; 2 textual hits are Arabic comments |
| domain purity (no React/CSS/storage) | CONFIRMED | enforced `eslint.config.js:26-120` |
| storage instantiation only at composition roots | CONFIRMED for app/ (STR-037); DELTA: `application/preferences/preferenceService.ts:2-7` and `application/suppliers/supplierPurchaseService.ts:10-11` hold runtime storage references behind injectable interfaces | `eslint.config.js:274,290` |
| V-1: 17 files type-import `@/storage/local/types` | CONFIRMED (exactly 17, all `import type`) | eslint allows type imports |
| V-2: 2 files touch `globalThis.localStorage` | CONFIRMED | `application/drafts/legacyFormDraftMigration.ts:32`, `application/diagnostics/localDiagnosticsService.ts:174` |
| V-3: single component→page edge | CONFIRMED | `components/finance/FinancePeriodResultSection.tsx:12` |
| index.css 6,962 lines; pulse ×3 @L1822/2074/2599; home-heading ×3; 35 `!important`; 4 reduced-motion blocks | CONFIRMED (all exact) | — |
| 5 guard scripts wired; 35+166 test files green | CONFIRMED | `package.json:11-12,22` |
| AUX: keyboard chrome hide (`[data-keyboard-open]` + visualViewport heuristic), bottom-nav, FAB, safe-areas, QuickActionSheet (761 L, 4 sub-sheets), UnsavedChangesGuard + dirtyRegistry | CONFIRMED | `index.css:775-776`, `MicroAppShell.tsx:62-69`, `QuickActionSheet.tsx:37` |
| presentation layer (formatters `formatMoneyWithUnit:57`, activityLabels, plurals; no own time logic) | CONFIRMED | `presentation/formatters.ts:57,143-144` |

## 2. Test-sensitivity census (decisive for the token wave)

**Zero tests assert palette values.** No hex colors, no `rgb(`, no `getComputedStyle`, no `toHaveStyle`, no `--color-*` assertions, no snapshots, no inline-style assertions anywhere in the 201 test files. The only CSS-reading test is `U09.css.test.ts` (3 geometry string assertions: `.micro-period-range-fields input` min-height 48px; `.micro-text-action` 44/48px; `.micro-button-quiet` min-height 44px — reads the FIRST matching rule). Therefore: palette re-binding breaks no test; the effective gates are `design-token-guards.py` + stylelint (structural ladders) + journey/DOM suites (copy, roles, aria, navigation).

## 3. New findings (beyond the accepted scan)

1. **Naming collision risk:** `SRC/components/ui/` already exists (shadcn-style `drawer.tsx`, `tooltip.tsx`). New primitives will live in `SRC/components/primitives/` to avoid two "ui" homes.
2. **eslint coverage gap:** boundary globs cover `pages|components|app|application|storage` only; new subdirectories inherit no rules automatically — `SRC/components/primitives/**` lands inside the existing `components/**` globs, so it inherits the correct rules by construction.
3. **Text-density gate:** `scripts/text-density-count.py` caps distinct Arabic at-rest literals per screen and counts transitive component imports — shared primitives must stay string-free (or moment-of-action) to avoid inflating every screen's cap.
4. **Entry-chunk budget (D-034):** anything statically imported by `MicroAppShell` lands in the entry chunk (QuickActionSheet is lazy for this reason); primitives must avoid heavy static imports.
5. **Runtime-cycle detector** walks all production sources; leaf-only primitives (no imports from pages/app) stay safe.
6. **`stylelint-declaration-strict-value` is installed but dormant** (not wired into `.stylelintrc.json`).
7. **Latent duplicate-rule override bug:** `.micro-header-context` defined at L241-246 (12px) then again at L2982-2986 (11px, wins globally); `.micro-wordmark` at L234-240 (18px) then L2978-2981 (20px, wins). Same family as the known triple-duplication defect.
8. **Docs-state tests** (`group*Docs.test.ts`) assert merge-state strings (e.g. "PR #159 مفتوح وغير مدموج") — unaffected by this run (no `main` merges happen here).

## 4. Boundary quality verdict

The downward layering (domain ← application ← UI) is disciplined and strategy-aligned. What the UI side lacks — the strategy's layers 2–5 as declared modules (token mapping, primitives, AUX module, feature patterns) — is exactly what waves W1–W5 add incrementally, without bulk moves. **W0 gate: PASS** — the repository is clean, the rollback restores the baseline (base commit recorded), the scan confirms the approved boundaries, and no unresolved new structural risk exists (findings above are registered as work items in the wave plan, not blockers).
