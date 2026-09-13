# IMPORT BOUNDARIES — verified baseline + rules for this run

## Verified baseline (Agent 1, W0)

```
src/domain/**            → imports: relative-only, no externals (eslint.config.js:26-120). Zero React/CSS/storage.
apps/.../application/**  → imports: domain types + storage interfaces. ZERO UI imports (enforced eslint.config.js:197-215).
apps/.../storage/local/**→ imports: domain types (downward). Instantiated ONLY at composition roots
                            (app/StartupGate.tsx, app/PrototypeServicesContext.tsx; eslint STR-037 with 2 documented exceptions).
apps/.../presentation/** → formatting/labeling only; re-exports domain time helpers; no time logic of its own.
apps/.../app/**          → router, route classifier, navigation contract, composition roots (AUX).
apps/.../pages/**        → screens; compose components + application services.
apps/.../components/**   → shared UI (47 non-test files); one component→page type edge (V-3, registered).
Alias edges: @/* → client/src/*; @micro-domain/* → src/domain/*. Zero relative layer escapes. Zero runtime cycles.
```

## Known registered violations (pre-existing, not introduced by this run)

| ID | Edge | Severity | Disposition in this run |
|---|---|---|---|
| V-1 | 17 files type-import `@/storage/local/types` (UI→storage, type-only) | Medium | NOT widened; primitives use domain/application types only. Full fix deferred (GAP-26) |
| V-2 | 2 application files touch `globalThis.localStorage` behind injectable interfaces | Low | untouched |
| V-3 | `components/finance/FinancePeriodResultSection.tsx:12` imports `type FinanceState` from `@/pages/Finance` | Low | NOT replicated; no new component→page edge added by this run |

## Rules enforced for every wave of this run

1. **No new import cycles** — `pnpm guards` (check-runtime-cycles) must stay green after every wave.
2. **Primitives are leaves** — `components/primitives/**` may import: domain/shared types, presentation utilities, sibling primitives. Never pages, never app/, never application/ runtime code, never storage.
3. **Patterns may depend on primitives + application/domain interfaces; primitives never depend on patterns or pages.**
4. **AUX shell exposes callbacks/interfaces; it does not own feature business policy.** Feature forms live in feature components; the shell dispatches.
5. **Domain/application/storage are never edited for presentation reasons.** (This run edits no file under `src/domain`, `application/`, or `storage/` at all.)
6. **New files have one responsibility and a documented owner** (see COMPONENT_CATALOG.md).
7. **No blind mass moves; no broad single-patch rewrites of index.css.** Feature CSS extraction happens only where a wave's tests cover the affected surfaces.
8. **eslint boundary globs keep covering everything added** — new code lives under existing covered globs (`components/**`, `app/**`, `pages/**`, `presentation/**`).
