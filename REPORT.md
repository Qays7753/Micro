# Micro Repository Analysis Report

## 1. Executive Summary
The Micro repository is a single-page, offline-first application (SaaS financial and operational tool for home and microbusinesses in Jordan). It is written in TypeScript and React, primarily operating inside the browser using IndexedDB. The backend is non-existent as it relies entirely on local storage. The project follows a strict domain-driven design, heavily documented in Markdown files detailing product source of truth, decisions, and system constraints. Currently, the main focus is on completing vertical slices of functionality without an actual cloud sync or multi-tenant backend infrastructure. Tests pass successfully in isolation, and the repository is well-maintained with clear architectural boundaries.

## 2. Repository and Current-State Verification
- **Path/File:** `/`
- **Fact:** The repository uses `pnpm` (v9.15.9) as its package manager.
- **Evidence:** `package.json` contains `"packageManager": "pnpm@9.15.9"`.
- **Confidence:** High.
- **Fact:** The testing framework is `vitest`.
- **Evidence:** `vitest` dependency in `package.json` and `vitest.config.ts`.
- **Confidence:** High.
- **Fact:** The active commit observed during this session is `1601fd9` (Merge pull request #156 from Qays7753/agent/deep-workflow-content-product-closure).
- **Evidence:** Output of `git log -1`.
- **Confidence:** High.
- **Fact:** The current branch is `jules-*` but the integration branch is `main`.
- **Evidence:** `git status` output and PR descriptions in documentation.
- **Confidence:** High.

## 3. System Architecture Map
- **Path/File:** `apps/prototype-web/ARCHITECTURE.md`, `src/domain/`
- **Fact:** The system is an offline-first React application. The architecture flows from React UI -> Application Services -> Micro Domain Core -> LocalStore Port -> IndexedDB Adapter.
- **Evidence:** Detailed extensively in `apps/prototype-web/ARCHITECTURE.md` and visually supported by the project structure where `src/domain` holds business logic, `apps/prototype-web/client/src/application` holds services, and `apps/prototype-web/client/src/storage` holds the IndexedDB port.
- **Confidence:** High.

## 4. Major Domains and Functional Areas
- **Path/File:** `src/domain/`
- **Fact:** The application consists of several distinct domains: `actual-time`, `asset`, `cash-continuity`, `catalog`, `craft-order`, `direct-sale`, `financial-event`, `g5`, `inventory-material`, `loan`, `owner-entitlement`, `recurring-margin`, and `supplier-purchase`.
- **Evidence:** Subdirectories in `src/domain/`.
- **Confidence:** High.

## 5. Main UI Areas and Entry Points
- **Path/File:** `apps/prototype-web/client/src/app/MicroRouter.tsx`
- **Fact:** The main routing uses `wouter`. The primary entry points (bottom navigation) are:
  - `/` (Home: What to do today)
  - `/orders` (Work: Drafts, cycles)
  - `/finance` (Finance: Cash, decisions)
  - `/tools` (Tools: Calculators)
- **Evidence:** Route definitions in `MicroRouter.tsx` and documented navigation rules in `docs/product-source-of-truth.md`.
- **Confidence:** High.

## 6. Main Logic and Data Areas
- **Path/File:** `src/domain/financial-event/policies.ts`
- **Fact:** Business logic and financial calculations are decoupled from the UI and persistence layers. For example, `DELTA_TABLE` manages the exact double-entry-like rules for cash, payables, owner capital, operating expenses, etc.
- **Evidence:** Pure functions like `createFinancialEvent` and the `DELTA_TABLE` constant in `policies.ts`.
- **Confidence:** High.

## 7. State Management and Data-Flow Overview
- **Path/File:** `apps/prototype-web/client/src/app/PrototypeServicesContext.tsx`, `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.ts`
- **Fact:** There is no global state library like Redux. State is managed via React Context injecting application services, which directly interact with the IndexedDB layer.
- **Evidence:** `PrototypeServicesContext` wraps the application and provides services. `createBrowserLocalStore` initiates `IndexedDbLocalStore`.
- **Confidence:** High.

## 8. Important Dependencies and Shared Modules
- **Path/File:** `apps/prototype-web/package.json`
- **Fact:** The app relies on React (v19), Tailwind CSS (v4), Vite, Lucide React (icons), Radix UI/Vaul (accessible components), and Wouter (routing).
- **Evidence:** Dependencies listed in `package.json`.
- **Confidence:** High.

## 9. Existing Tests and Verification Commands
- **Path/File:** `package.json`
- **Fact:** Verification is run via `pnpm check`. This executes TypeScript type checking (`tsc --noEmit`), linting (`eslint`), formatting checks, domain tests (`vitest`), UI tests (`vitest`), custom density guards (`scripts/text-density-count.py`), and a production build.
- **Evidence:** The `scripts` section of `package.json`.
- **Confidence:** High.

## 10. Documentation and Source-of-Truth Assessment
- **Path/File:** `docs/product-source-of-truth.md`, `docs/operations/current-state.md`
- **Fact:** Documentation is exhaustive and explicitly defines the product's rules. `docs/product-source-of-truth.md` holds the accepted final behavior, while `docs/operations/current-state.md` acts as an operational log.
- **Evidence:** The content and stated purpose inside these markdown files.
- **Confidence:** High.

## 11. High-Risk or High-Coupling Areas
- **Path/File:** `apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.ts`
- **Fact/Inference:** Data schema migrations (Export/Import) are high-risk. The DB schema is currently at v35, while the export format is v27. `replaceSnapshot` strictly replaces user data and any mismatch can lead to data loss if not carefully migrated.
- **Evidence:** `localSchemaVersion` and `localExportVersion` variables, and the `replaceSnapshot` logic in `IndexedDbLocalStore.ts`.
- **Confidence:** High.

## 12. Technical Debt Indicators
- **Path/File:** `.eslintrc.json` or `package.json` lint script
- **Fact:** `eslint` is configured with a strict ceiling of 37 max warnings (`--max-warnings 37`).
- **Inference:** These warnings are heavily related to cyclomatic complexity and function length in domain `policies.ts` files based on manual linting execution. This implies thick core logic that might need future refactoring.
- **Evidence:** Execution of `pnpm lint` yielded 37 warnings for complexity and max-lines-per-function.
- **Confidence:** High.

## 13. Missing Information and Unverified Assumptions
- **Inference:** Assumes that the browser's IndexedDB limits and behaviors are sufficient for long-term usage, given the lack of a backend sync. Testing edge cases for storage quota limits was not performed.
- **Confidence:** Medium.

## 14. Initial Problem Candidates
- **Inference:** No active bugs were immediately discovered. However, UI string density limits (checked via `scripts/text-density-count.py`) seem brittle. Adding new translations or text could inadvertently break CI.
- **Confidence:** Medium.

## 15. Recommended Investigation Order
- **Recommendation:** If modifying features, first consult the domain policies in `src/domain/`.
- **Recommendation:** Verify any schema changes in `IndexedDbLocalStore.ts` and test with `pnpm test`.
- **Recommendation:** Ensure changes don't exceed text density limits by running `pnpm text-density` locally before pushing.
