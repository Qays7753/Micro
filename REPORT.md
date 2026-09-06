# Micro Repository Analysis Report

> **Generation context (verified):** this report was regenerated from `main` at merge commit
> `1601fd90028b45f307345520b700aed6fe82e4a3` (Merge pull request #156 —
> *Deep workflow, content, and product experience closure — continuation*), on the
> integration branch for the final continuation assignment (2026-09-06). It supersedes
> the report introduced by PR #157 (`docs: generate repository analysis report`,
> branch `jules-15390500015238590867-77e56821`, commit `72db7ab`), which was generated
> from the same merge base but whose CI failed on two time-dependent DOM tests
> (G2 `قبض البيع المباشر`, G5 `بنزين`) — the failure was a test-clock defect, not a
> product defect, and is fixed alongside this report (system time is now pinned in the
> affected tests). Every claim below was re-verified against the repository at the
> stated commit. No secrets and no machine-local paths appear in this report.

## 1. Executive Summary

Micro is a single-page, offline-first (local-first) financial and operational PWA for
home and micro-businesses in Jordan: an Arabic RTL, mobile-first web application in
which every financial fact lives in the browser (IndexedDB) — there is no backend, no
cloud sync, and no multi-tenant infrastructure in the current scope. The stack is
TypeScript throughout, with a strictly separated domain core (`src/domain`), an
application-service layer, and a React 19 prototype shell. Product rules are
deliberately codified in an extensive Markdown decision/contract registry inside the
repository (`docs/`), which functions as the product source of truth alongside the
code. Validation is enforced through a single gate command (`pnpm check`) plus CI on
every pull request.

## 2. Repository and Current-State Verification

- **Fact:** the repository uses `pnpm` `9.15.9` as its package manager.
  **Evidence:** `"packageManager": "pnpm@9.15.9"` in the root `package.json`.
  **Confidence:** High.
- **Fact:** the testing framework is `vitest`, run through workspace scripts.
  **Evidence:** `vitest` in dev dependencies; a root `vitest.config.ts` exists; test
  scripts are `test` (domain suite), `prototype:test`, `check`.
  **Confidence:** High.
- **Fact:** the analysis baseline commit is `1601fd9` (Merge pull request #156). The
  repository's integration branch is `main`; all feature work lands through pull
  requests into `main` (PRs #149–#156 form the recent transfer/closure chain).
  **Confidence:** High.
- **Fact:** CI runs on every pull request and on `main` (workflow
  `.github/workflows/ci.yml`): dependency install with frozen lockfile, a bounded
  `pnpm audit` retry (registry outages are retried, real findings fail), lint, and the
  full `pnpm check` gate (typecheck, format, text density, design-token guards, domain
  and prototype/DOM tests, production PWA build).
  **Confidence:** High.

## 3. System Architecture Map

- **Path/File:** `apps/prototype-web/ARCHITECTURE.md`, `src/domain/`.
- **Fact:** the architecture is offline-first React → application services → domain
  core → `LocalStore` port → IndexedDB adapter (with an in-memory twin used by tests).
- **Evidence:** `apps/prototype-web/ARCHITECTURE.md`; the layering is visible in the
  tree: `src/domain` (pure business logic), `apps/prototype-web/client/src/application`
  (services), `apps/prototype-web/client/src/storage` (IndexedDB port +
  `MemoryLocalStore`).
- **Confidence:** High.

## 4. Major Domains and Functional Areas

- **Path/File:** `src/domain/`.
- **Fact:** the domain core is split into: `actual-time`, `asset`, `cash-continuity`,
  `catalog`, `craft-order`, `direct-sale`, `financial-event`, `g5`,
  `inventory-material`, `loan`, `owner-entitlement`, `recurring-margin`,
  `supplier-purchase`, plus a `shared` module (money/numeric safety helpers).
- **Evidence:** subdirectories of `src/domain/`.
- **Confidence:** High.

## 5. Main UI Areas and Entry Points

- **Path/File:** `apps/prototype-web/client/src/app/MicroRouter.tsx`,
  `apps/prototype-web/client/src/app/navigation.ts`.
- **Fact:** routing uses `wouter`. The bottom navigation is exactly four tabs plus a
  center action (FAB): `/` «مشروعي الآن», `/orders` «العمل`, `/finance` «مالي»,
  `/tools` «أدواتي» — with a record FAB in the middle; settings and the owner profile
  are reachable from the header, not from a fifth tab (an explicit product rule).
- **Evidence:** `primaryNavigation` in `app/navigation.ts`; `MicroRouter.tsx` route
  table (50+ routes across orders, delivery review, finance, cash wallets,
  inventory, suppliers, parties, assets, loans, tools, backup, lock).
- **Confidence:** High.

## 6. Main Logic and Data Areas

- **Path/File:** `src/domain/financial-event/policies.ts`,
  `src/domain/craft-order/policies.ts`.
- **Fact:** business rules are decoupled from UI and persistence. `DELTA_TABLE` in
  `financial-event/policies.ts` encodes exact cash / payable / owner-capital /
  operating-expense / asset / amanah effects per event type; craft-order policies
  encode the order state machine (draft → agreement → confirmed → in_progress →
  ready → delivered/settled, plus needs_review and cancelled branches), deposit
  guards, revenue recognition at delivery only, and documented (atomic
  reverse-and-replace) correction rules.
- **Evidence:** pure factory functions and policy tables in the domain modules; the
  correction boundary decision `docs/decisions/general-financial-event-correction-c1-decision-v1.md`.
- **Confidence:** High.

## 7. State Management and Data-Flow Overview

- **Path/File:** `apps/prototype-web/client/src/app/PrototypeServicesContext.tsx`,
  `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.ts`.
- **Fact:** there is no external state library. React Context injects application
  services, which read/write through the `LocalStore` port; UI refreshes through a
  data-version bump (`notifyDataChanged`).
- **Evidence:** `PrototypeServicesContext` wiring; `createBrowserLocalStore` opens
  IndexedDB at schema version 35.
- **Confidence:** High.

## 8. Important Dependencies and Shared Modules

- **Path/File:** `apps/prototype-web/package.json`.
- **Fact:** the prototype app depends on React `^19.2.1`, Tailwind CSS `^4.1.14`
  (via the Vite plugin), Vite `^7.1.7`, lucide-react icons, `vaul`, and `wouter`
  routing. Money math is centralized in `src/domain/shared/numeric.ts`
  (safe-integer-bounded minor units).
- **Evidence:** dependency entries in `apps/prototype-web/package.json`.
- **Confidence:** High.

## 9. Existing Tests and Verification Commands

- **Path/File:** root `package.json` scripts.
- **Fact:** `pnpm check` is the single gate: TypeScript type checking (twice, for
  domain and app), ESLint with a hard 37-warning ceiling, Prettier format check,
  text-density guard (`scripts/text-density-count.py`), design-token/style guards,
  domain test suite, prototype + DOM test suite, and a production PWA build
  (Workbox generateSW). At the baseline commit the suites are 23 files / 278 domain
  tests and 125 files / 818 prototype tests, all green.
- **Evidence:** `scripts` in the root `package.json`; CI run history.
- **Confidence:** High.

## 10. Documentation and Source-of-Truth Assessment

- **Path/File:** `docs/product-source-of-truth.md`, `docs/operations/current-state.md`.
- **Fact:** documentation is exhaustive and normative: `docs/product-source-of-truth.md`
  holds accepted final behavior; `docs/decisions/` holds numbered approved decisions;
  `docs/contracts/` holds per-domain contracts; `docs/operations/current-state.md` is
  the operational log. Code comments cite the contract/decision IDs they implement.
- **Evidence:** content and cross-references in those files.
- **Confidence:** High.

## 11. High-Risk or High-Coupling Areas

- **Path/File:** `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.ts`.
- **Fact/Inference:** local schema migration and the export/import (backup) path are
  the highest-risk surfaces. The DB schema is at version 35 while the portable export
  envelope is at version 27; `replaceSnapshot` strictly replaces user data and a
  mismatch would mean data loss if migrated carelessly. The backup envelope now
  carries digest + counts integrity (AV-04) and current-version exports without the
  integrity envelope are rejected.
- **Evidence:** `localSchemaVersion = 35` / `localExportVersion = 27` in
  `storage/local/types.ts`; `replaceSnapshot` logic and envelope guards in
  `IndexedDbLocalStore.ts` / `localTransferService.ts`.
- **Confidence:** High.

## 12. Technical Debt Indicators

- **Path/File:** root `package.json` lint script.
- **Fact:** ESLint runs with a hard ceiling of 37 warnings (`--max-warnings 37`),
  concentrated in long domain policy functions and large test harnesses
  (`max-lines-per-function`). The ceiling is a deliberate ratchet: new code must not
  add warnings.
- **Evidence:** lint script; CI lint step output.
- **Confidence:** High.

## 13. Missing Information and Unverified Assumptions

- **Inference:** long-term IndexedDB quota behavior is assumed sufficient; quota
  errors are surfaced, but sustained very-large-dataset behavior was not stress
  tested in CI.
- **Confidence:** Medium.
- **Inference:** the >500 kB main JS chunk (gzip ~138 kB) is accepted for the
  offline-first precache trade-off; code-splitting remains a documented follow-up.
- **Confidence:** High.

## 14. Initial Problem Candidates

- **Fact:** the two CI failures that blocked PR #157 were diagnosed as
  time-dependent tests (default «هذا الأسبوع» ranges computed from the real clock
  vs. fixed seeded dates), fixed by pinning the system clock in those tests; no
  product defect was found behind them.
- **Inference:** no other open defects are known at the baseline commit; remaining
  work items are tracked as deferred findings (FC-06, AV-07, AV-08, AV-09, WF-04)
  in the continuation report and are being closed by the final continuation PR.
- **Confidence:** High.

## 15. Recommended Investigation Order

- **Recommendation:** before modifying features, read the domain policies in
  `src/domain/` and the matching contract in `docs/contracts/` — comments cite IDs.
- **Recommendation:** verify any storage/schema change with `pnpm test`,
  `pnpm prototype:test`, and the backup/restore tests in
  `localTransferService.*.test.ts`.
- **Recommendation:** run `pnpm check` locally before pushing; the text-density and
  design-token guards fail on rule violations, not on style preference.
- **Recommendation:** when adding DOM tests that render period-scoped surfaces
  (Statement, FinanceActivity, Finance period view), pin the system clock
  (`vi.useFakeTimers({ toFake: ["Date"] })`) or pin an explicit range — this is the
  class of defect that broke PR #157.
