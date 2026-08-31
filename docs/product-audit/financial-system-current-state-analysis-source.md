# Micro — Current-State System Discovery and UX/Product Audit (Source Report)

| Field | Value |
|---|---|
| Repository | https://github.com/Qays7753/Micro |
| Analyzed baseline | Remote `main` @ **8ede6b2b93c9d55bba69f33548054313e332db41** (2026-08-31, "merge: the financial flow and operating model redesign") |
| Analysis date | 2026-08-31 |
| Analysis mode | Discovery, analysis, and documentation only — **no implementation** |
| Deliverables | `docs/product-audit/financial-system-current-state-analysis-ar.docx` (Arabic, primary review document) and this file (English, traceable source) |
| Companion document | This report mirrors the Arabic Word report. Findings, IDs, evidence, and recommendations are identical in both. |

```
Analysis baseline: current remote main only.
Historical comparison: explicitly disabled.
Implementation baseline: none; this is analysis and documentation only.
```

This cycle inspects the repository as it exists on `main` at the commit above. No older branch, PR, deployment, report, or prior design cycle was used as a hidden requirement, and nothing in this report judges the system by conformance to any earlier recommendation. Historical files that exist inside the current repository were inspected only where their current presence affects the current product (for example, stale guidance documents that could mislead future work). No application code, database schema, stored data, configuration, tests, dependencies, or assets were modified, and no commits, branches, or pull requests were created.

Evidence labels used throughout this report (exactly one per important conclusion):

- **CONFIRMED FROM CURRENT MAIN** — directly verifiable in the repository at the analyzed commit.
- **INFERRED FROM CURRENT EVIDENCE** — a logical conclusion drawn from current code/docs, not directly stated.
- **RECOMMENDED DESIGN** — a proposal from this audit, not yet a product decision.
- **RESEARCH HYPOTHESIS / SIMULATION** — a labeled hypothesis or simulated scenario, not field research.
- **OWNER DECISION REQUIRED** — a choice this audit deliberately does not make.

---

## 1. Executive Summary

Micro's current `main` is a substantial, financially disciplined, Arabic RTL, offline-first prototype for a single Jordanian micro-business owner, built as a React + Vite + TypeScript PWA with a clean layered architecture (UI → Application services → Domain core → local store port → IndexedDB, schema 29, export format version 21). The latest merge at the analyzed commit added a fourth bottom-nav destination "أدواتي / My Tools" with a fully independent cost calculator, an Amanah (entrusted money) effect dimension, explicit allocation of unallocated cash between wallets, a lightweight name-aggregated party ledger ("دفتر الناس"), till counting, credit-capable quick sales, and a verified-export gate before any reset. At the analyzed commit the system contains **38 routes, 35 page components, 13 domain modules, ~24 application services, 26 IndexedDB object stores, 8 financial event types, and 5 financial effect dimensions**, with a single authoritative effect table (`DELTA_TABLE`) that defines what every event does to cash, payables, owner capital, operating expenses, and Amanah.

The central question of this audit — does the product let an owner complete real business tasks quickly, clearly, and confidently, or must the owner first understand the system's internal structure? — now has a strong but uneven answer. **CONFIRMED FROM CURRENT MAIN:** the fastest daily acts (record a sale, record an expense, count the drawer) are achievable in ≤3 touches from Home through the FAB quick sheet, with receipts and honest cash totals; the unknown is never rendered as zero (opening-balance states, knowledge states, "not managed" inventory disclosures); and corrections are append-only, documented, and atomic (an edit is a reversal + replacement in one IndexedDB transaction; a deletion is a documented reversal; a deletion can be undone by re-recording). This is materially owner-oriented, not module-oriented, in the money core.

At the same time, the audit registers **19 findings** (none a confirmed build blocker; see §9). The most trust-sensitive is **F-001 (FINANCIAL-RISK)**: the till-counting screen divides the counted amount by 1000 in its note and success text while the canonical money formatter divides by 100, so the owner can be told "الصندوق صار 25 د.أ" on a screen whose headline number correctly reads 250.00 — in the single flow whose purpose is proving the system honest against the drawer. **D-001 (DATA):** direct-sale credit parties are identified by a note-extraction regex, and the quick sheet writes a suffix into the note, so the party ledger shows mangled names like "خالد — بيع آجل من ورقة الإضافة" instead of "خالد". **F-002 (FLOW):** if the owner skips the default wallet during setup, step 3 still asks the opening-position question and silently discards the answer. **Q-001 (QUALITY):** two "sources of truth" now coexist (the 2026-08-31 `docs/product-source-of-truth.md` vs the stale 2026-08-28 `docs/operations/current-state.md`, plus an `ARCHITECTURE.md` still describing schema 5). **O-001 (OFFLINE):** durability remains single-device; the verified-export gate and reminders reduce but do not remove total-loss risk.

Strategically, the product's value proposition is coherent and rare in this category: a money-honest companion whose statements are labeled by knowledge state rather than pretending to accounting finality. The remaining gap to a professional user experience is not more features; it is (a) repairing the trust-critical defects above, (b) adding a first-class customer field instead of note-based identity, (c) giving the owner one place to review everything that changed and why (a unified history surface), and (d) resolving the documented open decisions — money precision (2 vs 3 decimals), the fifth navigation seat, shared-device privacy, and cloud timing — deliberately, with the owner.

**Most important open decisions for the owner (full list in §10.10):** money-unit precision; adding a customer field to direct sales (schema change); whether to surface a global history/audit surface now; the bottom navigation's fifth seat; shared-device privacy protection; retroactive inventory import; and the Finance screen's density posture.

Counts at the analyzed commit: **1 repository commit baseline; 519 tracked files; 233 TS/TSX files (~38,199 non-test LOC); 250 markdown documents; 38 routes; 35 pages; 13 domain modules; 26 stores; 33 discovered capabilities (§4.6); 19 registered problems (§9); 19 audited critical flows (§6); 8 personas (§5.1); 11 journey stages (§5.2); 20 user stories; 12 simulated usability scenarios (§8.1).**

---

## 2. Scope, Method, and Evidence Discipline

### 2.1 Scope

In scope: the repository at remote `main` @ `8ede6b2`, read deeply — structure, stack, dependencies, entry points, routes, screens, forms, validation, domain types and policies, persistence and migrations, create/read/update/delete and correction behavior, financial formulas, transaction states, first-launch and onboarding, defaults, settings and feature toggles, all business modules, tests, TODOs, dead code, and hidden capabilities. Out of scope: any modification of the system, any comparison with prior states of the repository, and any invention of accounting, tax, legal, or regulatory rules. Where real user research evidence is unavailable, personas, journeys, and usability scenarios are explicitly labeled as hypotheses or simulations and never presented as field findings.

### 2.2 Method

The analysis proceeded in five passes. First, a structural pass mapped the repository (file counts, module boundaries, dependency direction, build setup). Second, a navigation pass traced every route in `apps/prototype-web/client/src/app/MicroRouter.tsx` and the route classifier, and read each page component's purpose, entry, actions, and states. Third, a domain pass read the 13 modules under `src/domain/` (types and policies), focusing on the financial-event effect table, reversal semantics, the craft-order lifecycle, and the cash-continuity model. Fourth, an application pass read the ~24 services under `apps/prototype-web/client/src/application/`, focusing on the position/period formulas in `projectFinancialService.ts`, the correction methods, the cost-estimate service, the party ledger, and the transfer (export/import/reset) service. Fifth, a documentation pass read the governing documents (`docs/product-source-of-truth.md`, `docs/operations/current-state.md`, `README.md`, `AGENTS.md`, `docs/08-glossary.md`, `docs/product/owner-decisions-v1.md`, `docs/reference/independent-flow-redesign.md`) to compare documented behavior with code behavior. A small RTL DOCX was generated and rendered before writing the reports to verify the delivery pipeline (attachment-verification gate); the application itself was not run, and no exploratory runtime observation is cited as evidence anywhere in this report.

### 2.3 Evidence label application

Findings cite exact file paths and symbols (e.g., `src/domain/financial-event/policies.ts` → `DELTA_TABLE`). Where documentation and code disagree, code wins and the disagreement is itself registered as a finding. Where a capability is documented but not implemented, the label is CONFIRMED FROM CURRENT MAIN for the *absence* (with evidence of the documented deferral) and never presented as an implemented feature.

### 2.4 Honest statement of what was not verified

This audit did not execute the test suite or the production build; test-count and gate claims (178 domain + 398 prototype tests, typechecks, lint ceiling, design guards, production build) are cited from `docs/product-source-of-truth.md` §16 as documentation, not as this audit's own execution. No real users were interviewed, no field pilot was run, and no device (Android/iOS) acceptance was performed — consistent with the repository's own explicit limits (`docs/operations/current-state.md` §5, `README.md`).

---

## 3. Repository Discovery — Structure, Stack, and Governing Documents

### 3.1 Shape and stack — CONFIRMED FROM CURRENT MAIN

The repository is a pnpm workspace whose only runnable app is `apps/prototype-web/` — a client-only React + Vite + TypeScript SPA using `wouter` for routing, a Tailwind-based custom semantic design system (`index.css`, guarded by `scripts/design-token-guards.py`), `lucide-react` icons, a bottom Drawer for quick sheets, and Vitest for tests. Root `package.json` and `pnpm-workspace.yaml` define the workspace; `vitest.config.ts` runs both root domain tests and prototype tests. The delivery discipline is branch → local checks → PR → CI + Cloudflare Pages → independent acceptance → merge (per `docs/operations/current-state.md` §1). The architecture path is strictly layered: React UI → Application services → Domain core (`src/domain/*`) → `PrototypeLocalStore` port → `IndexedDbLocalStore` adapter; UI components never import IndexedDB directly (enforced by convention and stated in `apps/prototype-web/ARCHITECTURE.md` "مسار المسؤولية").

Money is represented as integer minor units. **CONFIRMED FROM CURRENT MAIN:** the input boundary (`application/input/englishNumeric.ts`) parses money text with at most 2 decimals into `major * 100 + cents`, and the display formatter (`presentation/formatters.ts` → `formatMoneyMinor`) divides by 100 with 2 fraction digits — i.e., **money scale = 1/100 JOD (piasters)**, while quantities use milli-units (3 decimals, `parseEnglishQuantityText`). This is internally consistent everywhere except one screen (finding F-001, §9).

### 3.2 Counts — CONFIRMED FROM CURRENT MAIN

| Measure | Value | Evidence |
|---|---|---|
| Tracked files | 519 | `git ls-files` |
| TS/TSX files | 233 | glob count |
| Non-test TS/TSX LOC | ~38,199 | `wc -l` over non-test sources |
| Markdown documents | 250 | glob count |
| Routes | 38 entries (incl. one redirect) | `MicroRouter.tsx` |
| Page components | 35 | `pages/*.tsx` (excl. tests) |
| Bottom-nav destinations | 4 + central FAB | `navigation.ts`, `BottomNav.tsx` |
| Domain modules | 13 | `src/domain/*` |
| Application services | ~24 | `src/application/*` |
| IndexedDB object stores | 26 | `IndexedDbLocalStore.ts` store creation block |
| Local schema / export version | 29 / 21 (accepts 20 & 28 with migration) | `storage/local/types.ts`, `localTransferService` |
| Financial event types / effect dimensions | 8 / 5 | `financial-event/types.ts`, `DELTA_TABLE` |
| Craft-order statuses | 10 (+6 settlement statuses) | `craft-order/types.ts` |

### 3.3 Governing documents and their current status — CONFIRMED FROM CURRENT MAIN

- `docs/product-source-of-truth.md` — new at the analyzed merge (2026-08-31); declares itself the single source of truth for approved final behavior, documents the 26 final critical flows, the final navigation, the mandatory financial rules, and the acceptance state.
- `docs/operations/current-state.md` — "live operational state" per `README.md`, but its last update is 2026-08-28, **before** the analyzed merge; it does not mention My Tools, Amanah, allocations, the party ledger, till counting, schema 29, or export 21 (finding Q-001).
- `apps/prototype-web/ARCHITECTURE.md` — stale: still describes "Slice 0–5", `schemaVersion = 5`, and no PWA, while the current store is schema 29 and PWA runtime files exist (`pwa/register.ts`, `PwaInstallControl`, `PwaRuntimeNotice`).
- `README.md` — Arabic product overview; correctly points agents to `current-state.md` (which is now lagging, compounding Q-001).
- `docs/08-glossary.md` — binding UI dictionary (e.g., "متوقع" for G5 declarations, "نسخة التكلفة" for CostSnapshot, "تكلفة البيع المسجلة" for COGS); truth-over-smoothness rule.
- `docs/product/owner-decisions-v1.md` — 20+ closed owner decisions (groups أ–د) including "truth of numbers above all", "one-page foldable foundation", "opening balance may be backdated", "inventory activation dated today is enough", "old reports declare what was not managed".
- `docs/reference/independent-flow-redesign.md` — the design exercise referenced by the analyzed merge (concepts: الصندوق / دفتر الناس / الشغلات; cash counting as a repeated first-class flow; deferred classification; away-return experience).

### 3.4 Tests, TODOs, and dead/hidden code — CONFIRMED FROM CURRENT MAIN

Domain tests live in `tests/domain/*` (14 files) plus co-located prototype tests across services and pages (e.g., `unallocatedDistribution.test.ts`, `amanah-loss.test.ts`, `cash-allocation.test.ts`, `localTransferService.schema29.test.ts`, `costEstimateService.test.ts`). The root `todo.md` is a long execution checklist (all shown items checked). Leftover runtime artifacts exist in `apps/prototype-web/client/public/__manus__/` — a `debug-collector.js` that captures console/network/UI events and posts them to `/__manus__/logs`, plus `version.json`; these are git-tracked in the deployed public folder (finding Q-002). Hidden/conditional capabilities: the Amanah-release button appears only when Amanah is held (`Finance.tsx`), the Market/Delivery seat is explicitly "not available at this stage" in Tools module states, `/review` is a permanent redirect to `/finance`, and deep flows hide the bottom bar via `routeClassifier.ts`.

---
## 4. Discovery Table — Everything That Exists Now

### 4.1–4.5 How to read the table

Each row records what exists at `main` @ `8ede6b2`, the exact evidence, one confidence label, the user-facing impact, and the financial/operational impact. "User impact" is written from the owner's viewpoint (what they can do, or are blocked from doing); "financial/operational impact" states what the capability does to money or operations, including explicit no-effects (which are themselves important product guarantees).

### 4.6 Discovery table

| # | Item | What exists now | Exact evidence | Confidence | User impact | Financial/operational impact |
|---|---|---|---|---|---|---|
| 1 | App shell & bottom navigation | 4 permanent destinations (مشروعي الآن / العمل / مالي / أدواتي) + central FAB "إضافة"; header label + settings gear; global chrome hidden in deep flows and when keyboard open | `app/navigation.ts` (`primaryNavigation`), `components/layout/BottomNav.tsx`, `MicroAppShell.tsx`, `app/routeClassifier.ts` | CONFIRMED FROM CURRENT MAIN | Task-first nav; owners reach the 4 core questions in one touch; editors are distraction-free | None (navigation only) |
| 2 | First launch / setup | 3-step setup: project name (only mandatory field) → default wallet "الدرج" (skippable) → opening position (known / unknown / zero); "ما بعرف" is an explicit declared state, never zero; ends at optional Foundation page then Home | `pages/Setup.tsx`, `app/StartupGate.tsx` (routes to `/setup` when no profile) | CONFIRMED FROM CURRENT MAIN | First useful outcome achievable with one text field; honest unknowns | Opening position recorded as `openingStatus: known/unknown`; see flow defect F-002 |
| 3 | Foundation page | Permanent optional depth page "شو عندك هلق؟" with foldable sections (cash, capital/debts…) and a truth line; never closes after day one | `pages/Foundation.tsx`, owner decision 7 | CONFIRMED FROM CURRENT MAIN | Deep context available without blocking day one | Skipped sections produce "not available" reasons, never zeros |
| 4 | Home control center | Sections: "اليوم" (single today list; first item = priority), "ما هو مسجل حتى الآن؟" (4 local facts with roads), "مالي" unit, "منتجاتي وخدماتي" unit, optional modules, "ما تغير مؤخرًا" (max 5), away card after 7 days, truth line | `pages/Home.tsx`, `application/home/homeControlCenterModel.ts`, `homeControlCenterService.ts` | CONFIRMED FROM CURRENT MAIN | Answers "what do I do today?" before any feature noise | Facts show known/incomplete/not_initialized with roads, not zeros |
| 5 | Quick action sheet (FAB) | In-sheet sale (cash or credit with customer name + collected now) and in-sheet expense (amount + optional item), both with optional wallet attribution; order / estimate / collection entries start deeper paths; receipt mode shows amount + recorded cash | `components/layout/QuickActionSheet.tsx` | CONFIRMED FROM CURRENT MAIN | ≤3 touches from Home for the two most repeated daily acts | Sale/expense recorded with idempotency keys; wallet attribution is an explicit `allocation`, never silent |
| 6 | Direct sales | Own financial record: item, qty, revenue, collected, optional cost, credit status (collected_in_full / partial_debt / partial_needs_review), optional catalog reference, revisions (edit/cancel/price_cut) with original values preserved | `src/domain/direct-sale/types.ts`, `pages/DirectSaleEditor.tsx`, `application/direct-sales/directSaleService.ts` | CONFIRMED FROM CURRENT MAIN | Fast "sold for cash" or credit sale without order overhead | Collection ≠ profit; debt part shows in receivables and party ledger; cancel nulls both its collection and debt |
| 7 | Craft-order lifecycle | 10 statuses (draft → provisional_agreement → confirmed → in_progress → ready → delivered → settled, plus postponed/cancelled/needs_review), 6 settlement statuses, deposit settlement decisions, append-only order events, knowledge gaps, frozen cost snapshot at confirmation | `src/domain/craft-order/types.ts`, `policies.ts`, `pages/Orders.tsx`, `pages/OrderDetail.tsx` | CONFIRMED FROM CURRENT MAIN | Order tracking from intent to settlement with next-action field | Deposit is cash not profit; delivery doesn't inflate collected; debt registered only after delivery |
| 8 | Cost snapshots & price floor | Snapshot of materials/time/packaging/delivery/waste/safety-buffer per quantity; knowledge state (known/estimated/partial/incomplete/stale/variable) with mandatory/optional gap list; `priceFloorMinor` protects price | `craft-order/types.ts` (`CostSnapshot`), `calculateCostSnapshot`, `pages/CostEditor.tsx` | CONFIRMED FROM CURRENT MAIN | Owner sees "is my price safe?" with explicit missing knowledge | Snapshot frozen at agreement; historical values never silently rewritten |
| 9 | Agreements & deposits | Agreement source (instagram/whatsapp/referral/walk_in/other), agreed price, deposit collection with events, three-way deposit settlement (refund / retain / needs_review) | `pages/AgreementEditor.tsx`, `application/agreements/agreementService.ts`, `agreementPrice.ts` | CONFIRMED FROM CURRENT MAIN | Records what was agreed and where it came from | Deposit ≠ revenue; settlement is an explicit operation |
| 10 | Financial events (8 types) | owner_investment_cash, owner_withdrawal_cash, operating_expense_cash, operating_expense_payable, payable_settlement_cash, amanah_held_cash, amanah_released_cash, loss_non_cash; each with note, counterparty, occurredOn, idempotency key | `src/domain/financial-event/types.ts`, `pages/FinancialEventEditor.tsx` | CONFIRMED FROM CURRENT MAIN | Owner-facing "financial event" language, not journal entries | Effects computed solely from `DELTA_TABLE` (5 dimensions) |
| 11 | Expense classification | Relationship (project/shared), behavior (fixed/variable/mixed/unknown), purpose, knowledge, shared-share basis (agreed fixed / agreed % / owner estimate / needs review), allocated vs unallocated shared expense | `financial-event/types.ts` (`OperatingExpenseContext`), `FinancialEventEditor.tsx` | CONFIRMED FROM CURRENT MAIN | Classification is layered (secondary details), not blocking | Unallocated shared expense contributes 0 to period result until a share is declared |
| 12 | Cash wallets & continuity | Wallet kinds (cash_drawer/bank_account/digital_wallet/other), opening balance (dated, backdated allowed, `openingStatus unknown` supported), adjustments with mandatory reason, transfers (out/in pair), reversal of entries | `src/domain/cash-continuity/types.ts`, `pages/CashWallets.tsx`, `application/cash/cashContinuityService.ts` | CONFIRMED FROM CURRENT MAIN | "Where is my money?" answered by explicit places | Wallet balance = sum of its entries; corrections are full reversals with reason + idempotency |
| 13 | Unallocated cash + allocation | Unallocated cash formula (order collections + event cash − purchase payments + direct-sale collections − allocations); `allocation` entry moves value between unallocated and a wallet without changing the total; guards both directions | `projectFinancialService.ts` (`readPosition`, `distributeUnallocated`), `pages/CashDistribution.tsx`, domain `cash-continuity` (`allocation` entry type) | CONFIRMED FROM CURRENT MAIN | No cash is "stuck without a way out"; distribution is one explicit screen | Total recorded cash never changes by allocation; positive ≤ available, negative cannot underflow wallet |
| 14 | Till counting | Count a wallet, compare with recorded balance, record the difference as a documented `cash_adjustment` dated today, future-effect only; shows new balance and difference | `pages/CashCount.tsx`, `cashContinuityService.adjust` | CONFIRMED FROM CURRENT MAIN | The drawer is reconcilable with the system at any time | Adjustment changes balance from today only; no historical restatement (note: text-scale defect F-001) |
| 15 | Amanah (entrusted money) | Held/released as first-class event types; raises/lowers cash and an Amanah balance; never revenue, expense, or owner capital; release button appears only when holding | `financial-event/types.ts` (`amanah_held_cash`, `amanah_released_cash`, `amanahDeltaMinor`), `DELTA_TABLE`, `Finance.tsx` | CONFIRMED FROM CURRENT MAIN | "Money in my drawer that is not mine" is representable | 5th effect dimension; held cash includes Amanah without implying profit |
| 16 | Non-cash loss | `loss_non_cash` records spoilage/damage without payment; reduces period result; no cash/payable movement | `financial-event/policies.ts` DELTA_TABLE row `loss_non_cash` | CONFIRMED FROM CURRENT MAIN | Losses that never touched the drawer are still visible | Operating expense +1 only |
| 17 | Owner entitlement (O1) | Dated policies with successors (no history rewriting), records (withdraw/return/invest) with documented reversal, opening balances (positive/negative), unified withdrawal entry that asks intent | `src/domain/owner-entitlement/`, `pages/OwnerEntitlement.tsx`, `pages/OwnerWithdrawalEditor.tsx` | CONFIRMED FROM CURRENT MAIN | "What is mine vs the project's" separated | Owner money ≠ sales/expenses; movements write paired owner+cash entries atomically |
| 18 | Suppliers & purchases | Purchases with supplier name, total, paid, payable, payments list, due date, status; payments recorded against purchase | `src/domain/supplier-purchase/types.ts`, `pages/Suppliers.tsx`, `SupplierPurchaseEditor.tsx` | CONFIRMED FROM CURRENT MAIN | "What do I owe suppliers?" answered | Purchase ≠ COGS automatically; payables sum into position |
| 19 | Materials & inventory movements | Materials with units (piece/meter/kilogram/liter/other); movement types opening / purchase_receipt / consumption / waste / adjustment / reversal; quantity in milli; waste contexts (order/catalog/general/unallocated); movement linked to order or purchase | `src/domain/inventory-material/types.ts`, `pages/InventoryMaterials.tsx`, `InventoryMovementEditor.tsx` | CONFIRMED FROM CURRENT MAIN | Stock per material visible with movement log | Consumption evidence feeds period COGS; no automatic decrement on sale |
| 20 | Inventory activation (dated) | Explicit activation record with date; activation uses today's snapshot; reports before activation declare "not managed" | `storage/local/types.ts` (`InventoryActivation`), `inventoryMaterialService`, `projectFinancialService.readRecordedPeriodResult` (`inventoryManagedFrom`) | CONFIRMED FROM CURRENT MAIN | Late adoption without fake history | Pre-activation money untouched; no retroactive import (deferred owner decision) |
| 21 | Catalog (reference) | Catalog items with optional unit, measurement units within 6 dimensions (count/mass/volume/time/distance/area), direct conversions within dimension, templates with components and yield — planning only | `src/domain/catalog/types.ts`, `pages/Catalog.tsx` (1690 lines), `catalogService.ts` | CONFIRMED FROM CURRENT MAIN | Reusable product/service reference with quantities | No price, no purchase, no inventory effect by design |
| 22 | Schedule & recurrence | Delivery schedule entries per order (kind "delivery"), statuses, postpone reasons, event log; weekly/monthly recurrences; daily agenda view | `storage/local/types.ts` (`ScheduleEntry`), `pages/Schedule.tsx`, `ScheduleEditor.tsx`, `scheduleService.ts` | CONFIRMED FROM CURRENT MAIN | "When is what due?" answered | No financial effect (follow-up only) |
| 23 | Daily follow-ups | Follow-up dates per order with change events and reasons; today/upcoming lists feed Home | `agreements/followUpDate.ts`, `application/follow-up/dailyFollowUpService.ts` | CONFIRMED FROM CURRENT MAIN | Debt follow-up prompts where the owner looks | No cash movement |
| 24 | G5 declarations & decision | Short-cash declarations (expected collection/commitment, dated, reversible), contribution margin from final orders, break-even by unit or recorded mix, recorded short-cash reading | `src/domain/g5/types.ts`, `pages/G5DeclarationEditor.tsx`, `components/finance/G5DecisionPanel.tsx` | CONFIRMED FROM CURRENT MAIN | "Can I survive the near term?" with honest sources | Declaration changes no cash/payable/profit ("متوقع" per glossary) |
| 25 | Actual time tracking | Time records per order (minutes, rate), operating mode (material/time/mixed), tracking toggle | `src/domain/actual-time/`, `application/time/actualTimeService.ts` | CONFIRMED FROM CURRENT MAIN | Optional time visibility | Time is never wage/cost/revenue automatically |
| 26 | Margin allocation policies | Optional loading/allocation policies over work names; recurring-margin readings | `src/domain/recurring-margin/`, `application/recurring-work/recurringWorkService.ts` | CONFIRMED FROM CURRENT MAIN | Analytical layer only | No pricing recommendation; recorded readings |
| 27 | Party ledger ("دفتر الناس") | Read-only aggregation by trimmed name over order debts/collections, direct-sale debts (note-extracted), purchase payables/payments, payable events/settlements; both directions; search; movement detail links | `application/parties/partyLedgerService.ts`, `pages/Parties.tsx` | CONFIRMED FROM CURRENT MAIN | "Who owes me / whom do I owe?" in owner language | Read model only; nothing recorded from the ledger (name-quality defect D-001) |
| 28 | My Tools destination | Independent calculator (materials, optional time, quantity, packaging/delivery/waste/safety buffer) with live preview, price floor, knowledge state; saved estimates list (free delete); module states panel | `pages/Tools.tsx`, `application/estimates/costEstimateService.ts`, `storage/local/types.ts` (`CostEstimate`) | CONFIRMED FROM CURRENT MAIN | "Calculate before committing" without order/inventory/product | Zero effect on cash/balances/inventory/orders; estimates always labeled تقديري |
| 29 | Export / import / reset | Verified export (built then round-trip re-parsed before declared ready; `lastVerifiedExportAt`), import preview (file date, contents, what will be replaced), atomic replace, reset gate requiring verified export + typed "ابدأ من جديد" | `application/transfers/localTransferService.ts` (`createVerifiedExport`, `resetAll`), `pages/Settings.tsx` | CONFIRMED FROM CURRENT MAIN | Device migration and fresh start are safe | 26 stores in v21/29; accepts 20/28 with safe backfill (amanahDeltaMinor=0, costEstimates=[]) |
| 30 | Guided opening import | Fixture-based guided opening import (local) | `application/transfers/guidedOpeningImportService.ts`, `docs/fixtures/g82-guided-opening-import-fixtures.json` | CONFIRMED FROM CURRENT MAIN | Alternative assisted start path | Import validation before atomic write |
| 31 | PWA | Install control, runtime notice, register; install banner dismissible for 30 days | `pwa/register.ts`, `PwaInstallControl.tsx`, `PwaRuntimeNotice.tsx`, `preferences.installBannerDismissedAt` | CONFIRMED FROM CURRENT MAIN | Installable on phone browsers | No cloud/sync (explicitly out of scope) |
| 32 | Preferences & theme | Theme light/dark/system, schedule capacity minutes, operating work mode, actual-time toggle; browser persistence reading | `storage/local/types.ts` (`LocalPreferences`), `application/preferences/preferenceService.ts`, `contexts/ThemeContext.tsx` | CONFIRMED FROM CURRENT MAIN | Non-financial personalization | Preferences are not financial truth |
| 33 | Notifications/reminders surface | No push/notification system; attention items (follow-ups, overdue debts, backup age) surface inside their source screens and Home lists | `pages/Home.tsx` today items, away card; absence of any notification service | CONFIRMED FROM CURRENT MAIN | In-context prompts only | No external triggers |

### 4.7 Current system overview — the three financial layers — CONFIRMED FROM CURRENT MAIN

The current system cleanly separates into the three layers the product's own model describes (`docs/product/financial-operating-model-v1.md`, `docs/product-source-of-truth.md`):

1. **Financial core (permanent):** financial events (8 types, 5 effect dimensions), cash wallets + continuity entries (opening/adjustment/transfer/allocation/reversal), unallocated cash, project position (recorded cash, receivables, payables, owner capital, Amanah held), direct sales (cash/credit), order money lifecycle (deposit/agreed/collected/debt), owner entitlement, suppliers/payables, Amanah, till counting, verified export/reset.
2. **Operational modules (available, optional):** craft orders (the work pipeline), schedule + recurrence, daily follow-ups, materials & inventory movements (activation-dated), catalog reference, party ledger (read model), guided opening import.
3. **Analytical tools (estimation only):** cost calculator + saved estimates (My Tools), cost snapshots + knowledge states, period result (recorded revenue − effective direct cost − operating expenses, with exclusions and reasons), financial insights (work-name margins, cost composition, coverage/break-even, recorded liquidity), G5 declarations & short-cash reading, actual-time readings, allocation/margin policy readings.

The layering is real, not cosmetic: layer-2 modules never silently write layer-1 money (schedule and follow-ups have zero financial effect; catalog is reference-only), and layer-3 tools never write anything (the calculator disclaimer "هذا حساب تقديري. ما انحفظت أي حركة مالية ولا مخزون." is enforced structurally — `costEstimateService` only writes to the estimates store).

---
## 5. User Research (Repository-Grounded), Personas, and Journey

All personas and scenarios in this section are **RESEARCH HYPOTHESIS / SIMULATION** — analytical constructs grounded in the repository's own scenario work (`docs/scenarios/scenario-test-set-v1.md`, `docs/quality/persona-context-simulation-protocol-v1.md`, `docs/reference/independent-flow-redesign.md` §7) and in the confirmed product context (one owner, Arabic RTL, JOD, offline-first, home/micro business in Jordan). No real interviews or usability tests were conducted, and none are claimed.

### 5.1 Personas

**P1 — "Layan", home-business owner starting with minimal information.** Context: runs a small home craft workshop (e.g., customized cakes, embroidery); no records exist; heard about the app from a friend. Goals: start recording today's sales and expenses without a learning course; not be asked for things she does not have (capital, debts, inventory). Repeated tasks: quick sale, quick expense, look at drawer cash. Known/unknown: knows what she sold today; does not know opening balance or costs. Financial fears: entering a wrong number that "breaks" the app; seeing profit that is a lie. Terminology: understands بيع/مصروف/الدرج; does not understand ذمم/COGS/تعادل — the app's dictionary-level language (حدث مالي، دين، متوقع) is at her level. Trust factors: honest unknowns ("ما بعرف" state, "غير متاح" reasons); receipts after each quick action; ability to undo. Abandonment triggers: a mandatory wizard asking for sector/capital on day one; any screen where she cannot find the way back. Success criteria: reaches first saved sale in under 2 minutes; returns on day 2. Current fit: **CONFIRMED FROM CURRENT MAIN** — setup asks only a name; quick sheet records a sale with one mandatory field; F-002 (discarded step-3 answer when wallet skipped) is her most likely early friction.

**P2 — "Abu Mohammad", daily money in/out recorder.** Context: kiosk/food-cart style business; 30–80 tiny transactions a day; phone held in one hand; customers standing in front of him. Goals: record a sale in seconds; record purchases/expenses as they happen; at closing, see drawer cash and compare with the physical count. Known/unknown: knows totals roughly; does not itemize costs per sale. Fears: double-recording the same sale; the app being slower than the drawer. Trust factors: the receipt showing recorded cash; idempotent behavior on double-taps; the count flow matching his nightly habit. Abandonment triggers: >3 touches per sale; required typing beyond the amount. Success criteria: quick sale ≤3 touches; nightly count ≤1 minute. Current fit: **CONFIRMED FROM CURRENT MAIN** — the quick sheet's in-sheet sale + wallet attribution + receipt, and `/cash/count`, map directly to his rhythm.

**P3 — "Rana", owner selling existing products.** Context: sells pre-made products (jars of food, candles); the same items repeat daily. Goals: during a sale, pick the existing product and quantity rather than re-typing; see what that product usually earns. Known/unknown: knows the item name; cost knowledge varies (knowledge state exists for this). Fears: price/cost drift silently changing history. Current fit — **CONFIRMED FROM CURRENT MAIN, with a deliberate boundary:** direct sales can reference a `catalogItemId` (`DirectSaleEditor.tsx`), and the catalog stores names/units/conversions/templates. However, the catalog is a *reference* layer only: it stores no default selling price and no unit cost, sales do not decrement inventory, and nothing flows automatically (§7.4, finding P-002). Rana's expectation "select product → price fills in" is only partially met.

**P4 — "Khaled", order manager.** Context: craft workshop taking customer orders (furniture, tailoring) with delivery dates and deposits. Goals: track each order from draft to settlement; know what is due today; record collections without polluting profit. Fears: losing an agreed price; double-counting a deposit as profit. Current fit: **CONFIRMED FROM CURRENT MAIN** — the full order lifecycle, agreement snapshot, deposit events, follow-ups, schedule, and the party ledger give him a complete pipeline with honest money semantics.

**P5 — "Samir", owner who does not know the opening balance.** Context: existing drawer with unknown amount; starts recording from today. Goals: start without a number; later, declare a documented opening balance or just count the drawer. Fears: being forced to type 0 (a lie). Current fit: **CONFIRMED FROM CURRENT MAIN** — setup offers "ما بعرف الآن — يُحدَّد لاحقًا" (`openingStatus: unknown`), the wallet screen offers recording the opening later (`recordOpeningBalanceLater`), and the till count converts drift into a documented adjustment. This persona is first-class in the current design.

**P6 — "Nadia", multi-wallet owner.** Context: drawer + bank account + a digital wallet; money moves between them. Goals: see cash per place; move money without pretending income/expense. Fears: the "transfer" inflating revenue. Current fit: **CONFIRMED FROM CURRENT MAIN** — wallet kinds include bank/digital; transfers are out/in pairs under one transfer id; unallocated distribution exists; transfers carry no profit semantics. The main friction is that wallet attribution at input time is optional, so unallocated cash accumulates until she distributes it (an explicit, honest state — not a bug).

**P7 — "Omar", estimator before selling.** Context: quotes custom work; needs to know cost and a safe price before agreeing. Goals: run a quick estimate without creating an order; save it; revisit it. Fears: an estimate accidentally becoming a financial record. Current fit: **CONFIRMED FROM CURRENT MAIN** — the My Tools calculator is fully independent (no order/product/inventory required), saves labeled estimates with zero financial effect, and the disclaimer is structural, not cosmetic.

**P8 — "Huda", financial-core-only owner.** Context: wants money in/out and cash; does not want inventory, schedules, suppliers, or catalog. Goals: ignore everything optional. Fears: modules demanding configuration. Current fit: **CONFIRMED FROM CURRENT MAIN** — all modules beyond the core are reachable but never mandatory; Tools shows module states ("متاح — غير مفعّل") rather than forcing setup; Home shows optional modules only when they carry content.

### 5.2 User journey (11 stages) — RESEARCH HYPOTHESIS / SIMULATION grounded in confirmed screens

| Stage | Owner's goal | Mental question | Current experience (evidence) | Requested decision / friction | Misunderstanding risk | Recommendation |
|---|---|---|---|---|---|---|
| 1. First impression | Understand what this is | "هل هذا للتخزين أم لفهم مالي؟" | Setup heading "قرار البداية" + truth line "يُحفظ على هذا الجهاز فقط" (`Setup.tsx`) | None significant | Expecting cloud/account | Keep the local-only truth visible (already present) |
| 2. First launch | Minimal start | "شو المطلوب مني؟" | One mandatory name; 3 steps; skip wallet possible | F-002: skipped wallet still gets step-3 question whose answer is dropped | Believing the opening answer was saved | Fix F-002 (skip step 3 or persist the answer) |
| 3. Understanding value | See the point quickly | "شو بقدملي؟" | Foundation page explains current state; Home shows "ما هو مسجل حتى الآن؟" facts with roads | Facts show "غير مسجل" until first records | Reading not-initialized as zero | Keep roads-as-buttons ("سجّله") pattern |
| 4. Minimum setup | Not be blocked | "بدي أبدأ بدون أرقام" | Only name is mandatory; everything else optional | Wallet naming default "الدرج" is friendly | None major | Keep |
| 5. First useful result | First saved record | "سجّلت؟ شفت النتيجة؟" | FAB → تسجيل بيع → amount → receipt with cash total (`QuickActionSheet.tsx`) | None — the receipt is the aha moment | None | Keep receipt pattern; consider date display on receipt |
| 6. First transaction set | Daily rhythm | "هل أسرع من دفتري؟" | ≤3 touches per sale/expense; credit sale with customer name | Customer name lives in a note (D-001) | Ledger names mangled | Fix D-001 (customer field) |
| 7. Financial review | Trust the numbers | "هل الدرج مطابق؟ ووين ربحي؟" | Finance: cash decision first, position cards, truth section (Amanah, unallocated), period layers; count flow reconciles | Density (Y-001); profit only in period layer | Reading cash as profit | Keep cash-first ordering; maintain separation labels |
| 8. Repeated daily use | Habit | "هل بقدر أكمل كل يوم؟" | Today list, quick sheet, receipts, away card after 7 days | Thin away digest (U-002) | Missing what happened during absence | Extend away card with missed-days summary |
| 9. Optional capability discovery | Grow into the system | "شو في غير هي؟" | Tools module states; Home optional modules; Finance text links (D-002: no nav seat for Parties/Suppliers/Inventory/Schedule) | Discoverability by reading | Never finding e.g. suppliers | Consider seat/shortcut decision (owner) |
| 10. Correction / error recovery | Fix a mistake safely | "غلطت بالرقم — شو بصير؟" | Edit = atomic reversal+replacement; delete = documented reversal; undo restores values; guards (payable remaining, reversal-of-reversal) | Reason optional on plain edit (by design) | Worrying the history was "cheated" | Add unified history surface (U-001) to show the triple (original/reversal/replacement) in one place |
| 11. Trust & retention | Stay | "هل بثق فيه بعد شهر؟" | Append-only records, honest unknowns, verified export, count reconciliation | Single-device risk (O-001) | Data loss after browser wipe | Strengthen backup cadence affordances; future cloud decision |

---

## 6. Product Strategy, MVP, User Stories, and Critical Flows

### 6.1 Product value and positioning — CONFIRMED FROM CURRENT MAIN (current behavior) + INFERRED FROM CURRENT EVIDENCE (positioning)

Micro's differentiator is **money honesty at micro-business speed**: statements labeled by knowledge state, effects computed from one auditable table, corrections that preserve history, and an owner-language financial vocabulary. It competes not with accounting software but with the drawer + paper debt-book + memory (as the repository's own redesign reference argues). Non-goals visible in the current state: no SaaS/auth/sync/cloud data, no multi-user, no taxes/legal ledger, no forecasting/AI, no Market/Delivery implementation (documented as future expansion only).

### 6.2 MVP classification of discovered capabilities

| Class | Capabilities |
|---|---|
| **MVP financial core (visible first)** | Setup (name+wallet+opening), quick sale/expense sheet, direct sales (cash/credit), financial events (8 types), wallets + continuity + count + allocation, project position + Finance cash-first, party ledger read, owner investment/withdrawal, verified export/reset, Home today/facts |
| **Important but optional operational** | Craft orders pipeline (for order-based businesses), agreements/deposits, schedule + follow-ups, suppliers & purchases, materials + inventory movements (dated activation), catalog reference |
| **Analytical / estimation tools** | My Tools calculator + saved estimates, cost snapshots & knowledge states, period result + insights, G5 declarations & short-cash, actual time, allocation policies |
| **Future capability (documented, not built)** | Market/Delivery expansion (E-00 contracts only), sector Activity Profiles, cloud sync, shared-device privacy (PIN/amount hiding), retroactive inventory import |
| **Misplaced / unclear / duplicated (findings)** | `/orders/new` intent chooser duplicating FAB entries (F-003); note-based customer identity (D-001); two sources of truth (Q-001) |

The classification confirms the product does **not** equate more features with a better product: optional modules never block the first useful outcome, and analytical tools never write money.

### 6.3 User stories (format: As a [user type], I want to [action] so that I can [outcome])

| # | Story | Priority | Related flow | Required data | Acceptance criterion | Class |
|---|---|---|---|---|---|---|
| S1 | As a new owner, I want to start with only a project name so that I can begin recording immediately | P0 | First launch | Activity name | Profile saved; Foundation reachable; no other mandatory field | MVP |
| S2 | As an owner, I want to say "I don't know" my opening balance so that I am not forced to lie with 0 | P0 | Unknown opening | Choice only | Wallet state "unknown"; never rendered as zero | MVP |
| S3 | As an owner, I want to record a cash sale in ≤3 touches so that recording never blocks a waiting customer | P0 | Quick sale | Amount only | Receipt shows amount + recorded cash | MVP |
| S4 | As an owner, I want to record a credit sale with the customer's name so that the debt shows in the people ledger | P0 | Credit sale | Amount, name, collected now | Party appears with correct clean name; remainder = receivable | MVP |
| S5 | As an owner, I want to record an expense in the moment so that I don't forget it | P0 | Quick expense | Amount (note optional) | Event recorded; cash decreases | MVP |
| S6 | As an owner, I want to count the drawer and record the difference so that the system matches reality | P0 | Cash count | Wallet, counted amount | Adjustment documented today-only; message matches the displayed number (fails today: F-001) | MVP |
| S7 | As an owner, I want to see my cash split by place so that I know where money sits | P0 | Cash review | Wallets exist | Per-wallet balances + unallocated + total; no fake totals | MVP |
| S8 | As an owner, I want to distribute unallocated cash to a wallet so that no money is "stuck" | P1 | Distribution | Wallet + amount | Allocation entry; total unchanged; guards hold | MVP |
| S9 | As an owner, I want to hold Amanah so that trust money in my drawer is not my profit | P1 | Amanah | Amount, owner of money | Cash +, Amanah +, revenue untouched | MVP |
| S10 | As an owner, I want to edit an event so that a wrong amount is corrected without losing history | P0 | Edit | New values | Atomic reversal+replacement; net = replacement only | MVP |
| S11 | As an owner, I want to delete an event and undo it so that mistakes are reversible | P0 | Delete/undo | Reason (default "حذف") | Documented reversal; undo re-records original values | MVP |
| S12 | As an owner, I want to see who owes me and whom I owe by name so that I can collect/pay | P1 | Party ledger | Existing records | Both directions with clean names and movement links | MVP |
| S13 | As an owner, I want to withdraw money for myself so that personal drawings don't fake expenses | P0 | Owner money | Amount | Cash −, owner capital −, no expense | MVP |
| S14 | As an order-based owner, I want to track an order from draft to settlement so that nothing is forgotten | P1 | Order cycle | Customer, item, price | Status, next action, and money rules hold at each step | Optional |
| S15 | As an order-based owner, I want a frozen cost snapshot with knowledge state so that my price decision is honest | P1 | Cost snapshot | Materials/time | priceFloor + knowledge label; history preserved | Optional |
| S16 | As a product seller, I want to pick an existing product during a sale so that I don't retype it | P1 | Product sale | Catalog item | Sale references item; (price autofill is a future decision P-002) | Optional |
| S17 | As an estimator, I want to calculate cost/price without any record so that thinking is free | P0 | Calculator | Materials/time | Zero financial/inventory effect; disclaimer visible | MVP |
| S18 | As an estimator, I want to save estimates so that I can revisit quotes | P1 | Saved estimates | Title + inputs | Saved list labeled تقديري; free delete | MVP |
| S19 | As a stock-keeper, I want to activate inventory later so that I don't fake history | P2 | Inventory activation | Today's snapshot | Activation dated; old reports declare "not managed" | Optional |
| S20 | As a migrating owner, I want a verified export before reset so that starting fresh never destroys data | P0 | Export/reset | File | Round-trip verified file; typed confirmation; atomic reset | MVP |

### 6.4 Critical flows — documented against current code

The repository's own `docs/product-source-of-truth.md` §4 lists 26 final critical flows; this audit re-walked 19 of them against code and confirms their implementation points. Full field-by-field documentation (role, goal, entry, first decision, required data, steps, review, confirmation, success, failure, retry, cancel, back, draft/partial save, repeated submission, offline state, exit, next action):

**FL-1 First launch & setup.** Entry: `StartupGate` redirects to `/setup` when no profile. Steps: name → wallet (default "الدرج", skippable) → opening choice (known/unknown/zero). Required: name only. Confirmation: "احفظ وافتح صفحة الأساس". Success: profile + wallet saved atomically via services; navigates to Foundation then Home. Failure/retry: Arabic field errors; save errors shown inline. Cancel/back: "خطوة سابقة" per step. Draft/partial: none (typed name lost on interruption — U-003). Repeated submission: `operationKey: setup-wallet-${profileId}` guards duplicate wallet creation. Offline: local by definition. Exit: Foundation (optional) → Home. **Defect F-002** (step-3 answer discarded when wallet skipped). Next action: first quick sale (Home FAB).

**FL-2 Quick cash sale.** Entry: Home FAB → sheet → "تسجيل بيع". First decision: amount (only mandatory). Optional: item name, cost knowledge, credit toggle, wallet attribution. Review: receipt mode showing amount + current recorded cash. Success: `directSales.record` with idempotency key; optional `allocation` to wallet. Failure: validation errors in Arabic; invalid numbers rejected at input (ASCII-only 2-decimal money). Retry: sheet stays open with error. Cancel: X resets all fields. Repeated submission: idempotency key prevents double effect. Offline: all local. Exit: "تم" closes sheet; correction from العمل/مالي. Next: nothing forced.

**FL-3 Quick credit sale.** Same as FL-2 plus: "آجل" → customer name (required) + collected-now (must be < amount). Result: `collectionStatus: partial_debt`; remainder appears in receivables and (via note extraction) party ledger — **D-001 name mangling**. Guards: collected ≥ amount rejected with Arabic message.

**FL-4 Selecting an existing product during a sale.** Entry: `/direct-sales/new` (from العمل) → catalog select (`catalogItemId`). Data: catalog list. Behavior: reference only; no price/stock autofill (P-002, OWNER DECISION on adding default price). Exit: editor save.

**FL-5 Recording quantity, unit cost, actual selling price.** Direct sale: quantity (integer), revenue (actual), optional cost (with "لا أعرف" → profit "غير متاح", not zero). Craft order: cost snapshot carries materials/quantities/unit prices/confidence; agreed price is the actual price; the snapshot is frozen at confirmation. Historical values preserved on later product changes.

**FL-6 Order creation & tracking.** Entry: FAB "طلب من عميل" or العمل → draft editor (draft created on first real input, not on open — no empty drafts). Steps: draft (intent, customer, item, specs, qty) → cost snapshot (`/orders/draft/:id/cost`) → agreement (`/agreement`, price + deposit + source + follow-up) → confirm → in_progress → ready → delivered → collection or debt → settled. Each transition appends an order event (idempotent). Failure paths: invalid transitions rejected; cancelled orders with deposits start at `needs_review` settlement (no assumed refund policy). Review: OrderDetail timeline. Exit: back to العمل. Next action: shown per order (`nextAction`).

**FL-7 Expense entry.** Quick: sheet (amount + optional note; classified project/known/project_general/unknown by default — C-001). Full: `/finance/new/operating_expense_cash` with layered classification (relationship, behavior, purpose, knowledge, shared share with 4 modes incl. "defer" → unallocated). Payable variant records a due expense without cash movement; settlement later via `/finance/new/payable_settlement_cash` with remaining guard.

**FL-8 Money-in / money-out (owner).** In: `/finance/new/owner_investment_cash` (cash +, owner capital +). Out: `/finance/withdraw` — unified entry asking intent, writing to the correct path (owner movement + paired cash entry atomically). Guards: never treated as revenue/expense.

**FL-9 Cash & balance review.** Entry: مالي. Order: review pulse → G5 cash decision → owner card → position cards (recorded cash / receivables / payables / owner capital) → truth section (wallet cash, unallocated, wallet count, Amanah, operating expenses, purchase/event counts, distribution strip, no-wallet road, parties & count links) → collapsed layers (period result, insights, events, deposits). Cash-first ordering is deliberate and correct; density is the trade-off (Y-001).

**FL-10 Amanah record/review.** In: `/finance/new/amanah_held_cash` (counterparty = owner of the money). Review: Finance truth section shows held amount when > 0 with "ليس لك ولا يدخل الربح". Out: `/finance/new/amanah_released_cash` (button only when holding). Correction: standard event reversal. Semantics: cash ±, Amanah ±, nothing else (DELTA_TABLE).

**FL-11 Cost & expected profit estimation.** Entry: أدواتي. Data: title (optional), materials (name/qty/unit/unit price), optional time (minutes + hourly rate), quantity, optional packaging/delivery/waste/safety buffer. Live preview: unit cost, planned total, price floor (hidden when knowledge incomplete/partial), knowledge state label. Save: estimate store only. Delete: free. Zero financial/inventory effect — structurally enforced. Cross-linking to a real order is a separate explicit act from a draft (source-of-truth flow 12).

**FL-12 Editing a transaction (financial event).** Entry: Finance events layer → row → edit. Data: new amount/note/date/counterparty. Behavior: `editEvent` → `createFinancialReversal` + `createFinancialEvent` replacement → `commitFinancialEventReplacement` in **one** IndexedDB transaction. Guards: cannot edit a reversal; cannot edit an already-edited event (must edit the current version); settlement edits bounded by remaining payable (excluding the source itself). History: original + reversal + replacement all remain; net effect = replacement only.

**FL-13 Deleting a transaction.** `deleteEvent` = documented reversal with reason "حذف". Undo = `restoreEvent` re-records original values as a new event (never touches the past). No silent destruction anywhere.

**FL-14 Correcting a related transaction (settlement).** Editing a settlement previews impact on the payable's remaining; over-payment rejected. Reversing a settlement re-credits the payable (activeSettlements excludes reversed). Settlement sources that are themselves reversed are refused.

**FL-15 Activating inventory later.** Entry: materials screen. Behavior: activation record dated today; today's snapshot is sufficient; pre-activation money untouched; period reports for earlier ranges explicitly say "لم يكن المخزون مُدارًا"; no retroactive import (deferred decision); no deactivation (unnecessary — data is never deleted).

**FL-16 Handling an unknown opening balance.** Setup: "ما بعرف" → `openingStatus: unknown`, rendered "غير محدد" with a road to record a documented balance later (`recordOpeningBalanceLater` — removes the unknown flag atomically with the opening entry). Never zero.

**FL-17 Export / reset / restore.** Export: `createVerifiedExport` builds the file then re-parses it fully before declaring readiness; records `lastVerifiedExportAt`; filename dated. Import: file read without writing → validation → preview (date, contents, what current data will be replaced) → explicit confirm → atomic `replaceSnapshot`. Reset: requires verified export first; typed phrase "ابدأ من جديد"; failure stops everything. Corrupt/unsupported files never touch current data.

**FL-18 Till counting.** Entry: مالي → "عدّ الصندوق" (also from محافظ). Steps: choose wallet → enter counted amount → difference displayed live → settle → `cash_adjustment` (reason mandatory: surplus/shortage) dated today, future effect only → done screen with new balance. Zero difference → "العدّ يطابق الرصيد المسجل" (no entry). **F-001: note and success text divide by 1000 instead of 100.**

**FL-19 Distributing unallocated cash.** Entry: Finance unallocated strip or محافظ → `/cash/distribute`. Steps: direction + wallet + amount → guards (≤ available unallocated; wallet cannot go below zero for negative) → `allocation` entry → totals unchanged. Reversible as any cash effect.

---
## 7. Navigation, Information Architecture, Screens, Mobile UX, Onboarding

### 7.1 Current navigation evaluation — CONFIRMED FROM CURRENT MAIN

The bottom bar is task-oriented: مشروعي الآن (what do I do today?) / العمل (the pipeline) / [FAB إضافة] / مالي (money) / أدواتي (think before committing). Deep flows (all editors, transfer, distribute, count, schedule item, inventory movement) hide the bar via `routeClassifier.ts`, keeping forms distraction-free; the header keeps a context label and a settings gear; the keyboard hides the bar to protect content. `/review` redirects to `/finance` (no dead ends). **INFERRED FROM CURRENT EVIDENCE:** navigation is now organized around destinations the owner repeatedly needs rather than data tables — the redesign's central thesis is implemented. Remaining tension: five working modules (suppliers, inventory, schedule, catalog, parties) live *inside* surfaces as text links; their discoverability depends on reading (D-002).

### 7.2 Surface philosophy — CONFIRMED FROM CURRENT MAIN

The system uses: top-level destinations (5 bar seats incl. FAB), list/record surfaces (orders, parties, wallets, materials, suppliers, catalog, schedule), detail surfaces (OrderDetail, party details, estimate rows), full-screen editors for *commitment* actions (every money/movement write), a bottom sheet for *transient* actions (quick sale/expense — completed over the standing screen), inline `<details>` layers for progressive disclosure inside surfaces (Finance layers, party entries), drawers for short material edits in G19, dialogs avoided for money. A new full-screen surface is used when context, goal, data ownership, or risk changes — e.g., the quick sheet deliberately does *not* navigate for a sale, but an order agreement does. This matches the principle "a new surface when the user's context, goal, ownership of data, risk level, or return context changes — not merely because a label changes".

### 7.3 Proposed information architecture (target) — RECOMMENDED DESIGN

```
مشروعي الآن (Home)              — today, facts, roads, away, recent
العمل (Orders)                   — drafts, orders, direct sales, schedules (tabs/sections)
مالي (Finance)                   — cash decision, position, truth, layers (period/insights/events/deposits)
   └─ محافظ الكاش (/cash)        — wallets, transfers, adjust, distribute, count
   └─ دفتر الناس (/parties)      — name-level both-direction ledger (read)
   └─ حق المالك (/finance/owner-entitlement)
أدواتي (Tools)                   — calculator, saved estimates, module states
الإعدادات (header gear)          — info, preferences, appearance, sensitive data (export/import/reset)
Editors (deep, chrome-hidden)    — all create/edit/reverse forms
Future: السوق (Market) seat      — documented placeholder decision (E-00.14)
```

Changes vs current: keep the four seats; make the fifth seat an explicit owner decision (empty-by-design placeholder vs Parties shortcut); consider a persistent "السجل" (history) entry inside Finance layers or Settings (U-001); keep Tools independent.

### 7.4 Screen responsibilities and contracts (key screens) — current + recommended

Each contract: goal / entry / key information / primary action / secondary / hierarchy / above-the-fold / progressive disclosure / back / states / success / failure / exit.

**Home (`/`).** Goal: "what do I do today, and what is recorded?" Entry: bar. Key info: today list (first item = priority), 4 facts, finance/catalog units, optional modules, recent (≤5), away card. Primary: the FAB. Secondary: fact roads, unit actions. Above the fold: heading + today's first items. Disclosure: optional modules only when non-empty. Back: n/a (root). States: loading "جارٍ تجهيز مشروعك…", error with reload, quiet empty ("لا متابعات بعد"). Success: continuous. Exit: any seat. **RECOMMENDED:** add "ماذا فاتني" summary to the away card (U-002).

**Quick sheet (FAB).** Goal: record a transient money act in ≤3 touches. Modes: menu / sale-form / expense-form / receipt. Required data: amount only. Disclosure: cost + credit + wallet all optional selects. States: saving ("جارٍ التسجيل…"), Arabic field errors, receipt role=status. Cancel resets everything; no drafts. **RECOMMENDED:** show date on receipt; prefill wallet when only one wallet exists (OWNER DECISION).

**Finance (`/finance`).** Goal: what to do with cash now, then read the position. Hierarchy (current): review pulse → G5 cash decision → owner card → 4 position cards → truth section (incl. Amanah + unallocated strip + roads) → collapsed period layer → insights layer → events layer → deposits layer. Primary: the cash decision's CTA. States: loading/error/invalid-range (field error, last valid reading kept). Disclosure: everything analytical is collapsed. **RECOMMENDED (Y-001):** keep the top 3 blocks above the fold; move counts (purchases, events) into a collapsed "أرقام مسجلة" line; ensure the events layer exposes the full log (U-001).

**Tools (`/tools`).** Goal: think before committing. Contract as implemented: rule card ("هذا حساب تقديري. ما انحفظت أي حركة") always visible; calculator form; result with knowledge state; saved estimates (delete freely); module states with labels (غير متاح / متاح غير مفعّل / مفعّل / مفعّل جزئيًا / متوقف). Exit: back to Home via bar. **CONFIRMED:** the calculator satisfies the independence principle fully (no order/product/inventory prerequisite; no automatic financial or inventory movement; contextual links exist but nothing mandatory).

**Setup (`/setup`).** Goal: minimal honest start. 3 steps; only name mandatory; unknown is a declared state; local-truth line. **Defect F-002** in the skip path; **U-003** no partial persistence.

**Parties (`/parties`).** Goal: who owes whom. Read-only aggregation; search; per-party collapsible movements linking to sources; totals both directions; honest line "ما يُسجَّل منه شيء جديد". **RECOMMENDED (D-003):** add a per-party "قبضت/دفعت" shortcut that routes to the correct source flow.

**Cash wallets (`/cash`).** Goal: where the money is. Cards per wallet + unallocated + total; entries history; actions: transfer, adjust, distribute, count, new wallet. States incl. unknown opening ("غير محدد").

**Cash count (`/cash/count`).** Goal: reconcile drawer with record. Contract implemented; **F-001 text defect** in note/success strings.

**Financial event editor (`/finance/new/:type`).** Goal: record one of 8 event types with an effect disclosure ("يزيد/ينقص…" per type) before saving. Settlement requires selecting an existing active payable. Expense classification is layered. Guards produce Arabic field errors.

**Order detail (`/orders/:id`).** Goal: run one order. Shows status, settlement, cost truth (knowledge state + gaps), timeline events, deposit handling, collection/debt recording, material variance (explanatory only).

**Settings (`/settings`).** Goal: preferences + sensitive data. Sections: info, preferences (mode/capacity/tracking/theme), appearance, sensitive data (verified export, import preview, guided opening import, reset gate with typed phrase). Sensitive actions are never accidental.

### 7.5 Low-fidelity textual wireframes — RECOMMENDED DESIGN (delta over current)

```
Home                          Quick sheet (sale mode)
┌───────────────────────┐    ┌───────────────────────────┐
│ مشروعي الآن           │    │ سجّل بيعًا الآن            │
│ [activity · date]     │    │ ما الذي بعته؟ (اختياري)   │
│ ─ أثناء غيابك (7د+) ─ │    │ المبلغ المحصل (د.أ) ★     │
│ ─ سطر الحقيقة ──────── │    │ هل تعرف تكلفته؟ [لا/نعم] │
│ ▣ اليوم               │    │  └ التكلفة (إن نعم)       │
│  1. متابعة خالد … فتح │    │ هل بقي شيء عليه؟ [كامل/آجل]│
│  2. نتيجة طلب …  فتح  │    │  └ اسم الزبون ★ + المحصل ★ │
│ ▣ ما هو مسجل حتى الآن؟│    │ محفظة القبض (اختياري)     │
│  [كاش][لك][عليك][مالك]│    │ [ سجّل البيع ]            │
│ ▣ مالي      [افتح →]  │    └───────────────────────────┘
│ ▣ منتجاتي   [افتح →]  │    Receipt: سُجّل بيع X د.أ —
│ ▣ مسارات مرتبطة فقط   │    الكاش المسجل الآن Y د.أ [تم]
│ ▣ ما تغير مؤخرًا (≤5) │
└───────────────────────┘

Finance (top only)            Tools
┌───────────────────────┐    ┌───────────────────────────┐
│ مالي                  │    │ أدواتي — احسب قبل أن تلتزم│
│ ▣ نبضة المراجعة       │    │ قاعدة الأداة: تقديري بلا  │
│ ▣ قرار الكاش (G5)     │    │ أي حركة مالية/مخزون       │
│ ▣ حق المالك           │    │ ▣ حاسبة التكلفة والسعر    │
│ ▣ الوضع المالي:       │    │  مواد + وقت + بنود أخرى   │
│  [الكاش][لك][عليك]    │    │  ← سعر الحماية للقطعة     │
│  [مالك]               │    │  [احفظ التقدير]           │
│ ▣ ما نعرفه الآن       │    │ ▣ تقديراتي المحفوظة       │
│  أمانات… غير موزع…    │    │ ▣ حالة الوحدات            │
└───────────────────────┘    └───────────────────────────┘
 (طبقات مطوية: قراءة الفترة / المؤشرات / السجل / العربون)
```

### 7.6 Mobile UX, RTL, density — CONFIRMED FROM CURRENT MAIN (current) + RECOMMENDED DESIGN (judgments)

Phone-first is real: single continuous shell, portrait layout, `visualViewport` keyboard handling (bar hides, content stays), 44px touch targets guarded by design guards, ASCII/LTR numeric inputs inside RTL text via `bdi dir="ltr"` (money and quantities stay readable while labels are Arabic), Arabic plurals (`formatArabicPlural`: 0/1/2/3–10/11–99/100+), Amman timezone for all dates, month labels in Arabic with Latin digits, local long dates beside ISO where needed, light/dark/system themes, focus-visible support, aria labels on icon buttons, `role=status/alert` on loading/errors/receipts. Density: the repo runs a text-density guard (`scripts/text-density-count.py`) with caps (Home 29, Finance 122, CashWallets 67 labels — `docs/product-source-of-truth.md` §15); large surfaces (Catalog 1690 lines, OwnerEntitlement 1471, Schedule 999) are advanced-review screens where density is task-necessary, but first-use density on Finance remains the highest-risk surface (Y-001). **Judgment (RECOMMENDED DESIGN):** distinguish necessary task density (order detail, period layer) from accidental crowding (counts and meta-lines above the fold on Finance); do not apply one numeric law everywhere. Accessibility gaps not evidenced: no reduced-motion/voiceover audit on file; larger-phone/landscape behavior untested in the repo's QA notes.

### 7.7 Onboarding and defaults — current vs two-stage model

Current (CONFIRMED): a 3-step *decision* wizard (name → wallet → opening honesty) followed by an optional Foundation page (foldable sections, permanent access). Nothing asks for sector, capital, debts, or modules on day one; the "sector" is fixed to craft ("مشغل حرفي" badge) because the current profile is `activityType: "custom_craft"` — a hidden constraint for non-craft businesses (see P-003 in §9). Defaults: wallet name "الدرج", kind `cash_drawer`, today's date; `openingStatus` only set to unknown when chosen.

**RECOMMENDED DESIGN — two-stage onboarding model:**

- **Stage A (minimum for the financial core):** name → optional wallet with the three honest answers → first useful result (quick sale). Nothing else. (Current behavior already ≈ this, minus F-002.)
- **Stage B (optional customization, later):** a Foundation-based page asking per module with owner-language choices: "استخدمه الآن / قد أحتاجه لاحقًا / لا أحتاجه" — mapping to the existing module-state model (متاح غير مفعّل / مفعّل جزئيًا / مفعّل بتاريخ / متوقف). Module states are already richer than On/Off in Tools; Stage B only surfaces the same model as choices, never as blockers.

**Comparison:** the current single flow is faster but conflates day-one decisions (wallet) with optional context; a strict Stage B delayed by first value reduces abandonment risk for P1/P5 personas at the cost of one more surface later. **Recommendation:** keep Stage A as-is (after fixing F-002), and make Foundation the permanent Stage B home (it already is, per owner decision 7). **OWNER DECISION REQUIRED** only for whether Stage B should ever *prompt* itself (e.g., after the 5th sale) versus staying passive.

---

## 8. Financial Operating Model Analysis

### 8.1 The five-boundary discipline — CONFIRMED FROM CURRENT MAIN

The non-negotiable financial boundaries are structurally enforced (not just documented): collection ≠ profit (settlement status machinery; deposits don't recognize revenue), debt ≠ cash (receivables never enter cash until collected), purchase ≠ COGS (supplier purchases touch cash/payables only; COGS comes from evidenced consumption linked to final, non-reversed orders — `derivePeriodCogs`), owner money ≠ revenue/expense (entitlement dimension), missing ≠ zero (knowledge states, unknown opening, "not managed" inventory declarations, `resultStatus` gating the profit indicator). The single effect table (`DELTA_TABLE` in `src/domain/financial-event/policies.ts`) is the one place to audit what any event does — an architectural guarantee against divergent money logic.

### 8.2 Cash, wallets, unallocated cash, allocation, and Amanah — CONFIRMED FROM CURRENT MAIN

Recorded cash = declared wallet cash + unallocated cash. Unallocated cash = order collections + project event cash − purchase payments + active direct-sale collections − allocations. Allocations move value between "unallocated" and a specific wallet without changing the total; both directions guarded (≤ available unallocated; wallet cannot go negative on coverage spending). Transfers are out/in pairs under one transfer id (no profit semantics). Adjustments require a documented reason. Amanah: held/released events carry cash ± and Amanah balance ±, with zeros in revenue/expense/owner capital — physical cash in the drawer can include entrusted money without it being counted as business profit, revenue, or capital; the Finance truth section states this in owner language when a balance is held. **INFERRED FROM CURRENT EVIDENCE:** Amanah is *temporarily held* money (a liability-like holding), not business-owned; the system never nets it into owner capital — consistent with principle 13 (`financial-event/types.ts` comment). Amanah events cannot carry expense context or settlement links (domain guard). Corrections: standard event reversal; a held-then-released chain simply nets to zero when completed.

### 8.3 Products, sales, inventory, cost — CONFIRMED FROM CURRENT MAIN + boundaries

Products/services: catalog items exist as a *reference* layer (names, optional units, conversions, templates, yield) with **no unit cost, no default selling price, and no stock binding**. During a direct sale, the owner can reference a catalog item; quantity is entered per sale; revenue (actual selling price) is entered per sale; optional cost per sale. **Inventory is not decremented by sales** — consumption is recorded as explicit evidence (movement linked to an order), which then feeds COGS for final orders. Historical integrity: the cost snapshot is frozen at agreement; product/catalog changes never rewrite past transactions; inventory activation is dated; insufficient quantity is not enforced as a sale blocker (consumption is a separate recorded fact). **Distinctions held by the model:** unit cost (catalog — absent by design), default selling price (absent by design), actual selling price (per sale/order), estimated cost (snapshot/calculator with knowledge state), actual cost (evidenced consumption → COGS), confirmed transaction (order final / event), inventory movement (evidenced). **OWNER DECISION REQUIRED (P-002/P-003):** whether the catalog should grow price/cost fields and whether inventory should link to direct sales — the current reference-only contract is coherent but partially mismatches P3's mental model ("select product → price/stock fills").

### 8.4 Cost calculator and My Tools — CONFIRMED FROM CURRENT MAIN

The calculator is fully independent: works with no order, draft, inventory, or product registration; computes planned cost, unit cost, and price floor via the same `calculateCostSnapshot` policy as real orders (ceil protection on the floor); labels knowledge state; hides the price floor when knowledge is incomplete/partial; saving writes only to the estimates store (schema 29) with zero effect on cash/balances/inventory/orders (explicit test asserted in the repo's acceptance list); deletion is free. The disclaimer is displayed on the result card and after saving. Contextual conversion into a real operation (e.g., using an estimate inside a draft) is a separate explicit act. **Verdict:** the audit's principle for the calculator is met in full on current main.

### 8.5 Historical integrity and future activation — CONFIRMED FROM CURRENT MAIN

Activation dates: inventory activation is an explicit dated record; period results before/straddling activation declare the boundary ("لم يكن المخزون مُدارًا في هذه المدة" / "المخزون لم يكن مُدارًا قبل …"). Opening balances: wallet opening accepts backdated dates (declared as entered later); owner-entitlement opening balances dated; supplier purchases dated. Pre-activation transactions keep their money effects; post-activation consumption feeds COGS; backdated *events* are allowed (occurredOn free) with the period reading them when in range; till count and allocation are today-only by design. Importing historical information: supported via file import for whole snapshots (validated + atomic), while *retroactive inventory import* is a documented deferred owner decision. Disabling modules: not supported (and unnecessary — data is never deleted). Silent reinterpretation: none found — every re-reading is disclosed via status/reasons; **alternatives considered in the repo's decision log** (owner decisions 8–10) chose honesty-heavy options over convenience, which this audit endorses (RECOMMENDED DESIGN: keep).

### 8.6 Editing, deletion, correction, reversal — CONFIRMED FROM CURRENT MAIN

Owner-editable records and their correction model:

| Record | Edit | Delete | Reversal model | History protection |
|---|---|---|---|---|
| Financial event | `editEvent` (atomic reversal+replacement) | `deleteEvent` = documented reversal | `createFinancialReversal` (never reversible itself) | Original + reversal (+ replacement) all persist; net = latest |
| Cash continuity entry | — | — | Full reversal with reason + idempotency; transfers reversed as a pair | Entries append-only |
| Direct sale | Edit with revisions (kind edit/cancel/price_cut, before-values preserved) | Cancel (documented, cancels debt+collection effects) | Revision list on record | Original revenue preserved on price cut |
| Craft order | Transitions + specification revisions (events) | Cancel with three-way deposit settlement | Order events append-only | Snapshot history append-only |
| Inventory movement | — | — | Reversal movement (`reversesMovementId`) | Movements append-only |
| G5 declaration | — | — | Reversal declaration (`reversalOfId`) | Append-only |
| Owner entitlement record | — | — | Documented reversal | Successor policies without rewriting history |
| Cost estimate | `update` (recomputed, labeled) | Free delete | n/a (thinking tool) | n/a |

Warnings: Arabic, field-level, pre-write; every write carries an idempotency key; risky aggregates (settlement remaining, reversal-of-reversal, allocation bounds) guarded before storage. **What does not exist:** a unified history/audit *surface* (U-001) — the data for it exists (all corrections are recorded), but the owner must know where to look for each record type.

---
## 9. Usability Simulation Plan, Conversion, Retention, SaaS Readiness

### 9.1 Future usability-testing plan — RESEARCH HYPOTHESIS / SIMULATION (not a claim of testing)

Twelve scenarios are specified below for a *future* moderated usability test (5–8 owners, Jordan, Arabic, own device, 45–60 min each; success measured by unassisted completion, correct comprehension probes, and time-to-complete). No test has been run; all "likely failure" entries are analytical predictions from code reading.

| # | Scenario & goal | Start | Expected path | Likely failure (predicted) | Discoverability | Comprehension probe | Success criterion | Proposed improvement |
|---|---|---|---|---|---|---|---|---|
| U1 | Onboarding with unknown balance | Fresh install | name → skip wallet (or unknown) → Foundation → Home | Step-3 answer silently dropped when wallet skipped (F-002) | High | "What did the app record about your money?" | Reaches Home; states "nothing/unknown" correctly | Fix F-002 |
| U2 | Quick cash sale | Home | FAB → sale → amount → receipt | None core; wallet selector ignored | Very high | "Where did the money go?" (cash/unallocated) | ≤3 touches; receipt read aloud correctly | Show date on receipt |
| U3 | Quick expense | Home | FAB → expense → amount → receipt | Misread as "spent from wallet" when no wallet chosen | Very high | "Did this change your profit?" | Correct "expense recorded, cash down" | Same |
| U4 | Cash review | مالي | read position cards + truth | Density overload; reading wallet cash as profit (Y-001) | High | "Which money is yours to spend?" | Identifies recorded cash vs receivables | Keep cash-first; trim meta-lines above fold |
| U5 | Cost calculator | أدواتي | fill materials → see floor → save | Expecting it to "record" something | High (dedicated seat) | "Did anything get saved to your money?" | Says "no — estimate only" | Keep rule card |
| U6 | My Tools discoverability | Home | bar → أدواتي | None predicted (dedicated seat) | Very high | "What is this tab for?" | Names "thinking/calculation" purpose | Keep |
| U7 | Select existing product in sale | العمل → new direct sale | pick catalog item → qty → price | Expecting price/cost autofill (P-002) | Medium | "What did the catalog give you?" | Correct "reference only" answer or explicit unmet need reported | Owner decision on price fields |
| U8 | Edit a wrong expense amount | Finance → events layer → edit | new amount → save → triple visible | Worry "did I destroy history?" | Medium | "Can you show what it was before?" | Finds reversal+replacement | Unified history surface (U-001) |
| U9 | Delete + undo | Finance → events → delete → undo | reversal with reason → restore | Believing delete erases traces | Medium | "Is the old record still anywhere?" | Correct "documented reversal; undo re-records" | Same |
| U10 | Amanah comprehension | مالي → new أمانة قُبضت | amount + owner → finance truth | Reading held Amanah as income | Medium | "Is this money yours?" | Correct "no — held for someone" | Keep explicit line |
| U11 | Unknown opening balance → later declaration | wallet screen → record opening later | documented balance replaces unknown | Forgetting the wallet exists | Medium | "What does غير محدد mean?" | Correct explanation; never zero | Keep road link |
| U12 | Optional feature discovery (suppliers) | Home/مالي/أدواتي | text links → suppliers | Never finding it from the bar (D-002) | Low-medium | "How would you find supplier debts?" | Finds within 30s via any surface | Seat/shortcut decision |

### 9.2 Conversion (activation, not subscription) — INFERRED FROM CURRENT EVIDENCE

Activation = opening the app → understanding value → first useful outcome. The current funnel is short: install/first-open → 3-question setup → (optional Foundation) → Home with roads → FAB first sale → receipt. Friction points: F-002 (discarded answer), FAB discoverability is high but the *sheet's* optional fields (cost/credit/wallet) could confuse; nothing demands sector/capital. The "first value" moment is the receipt with the cash total. **RECOMMENDED DESIGN:** treat the first receipt as the activation event and measure (locally, later) time-to-first-sale; keep setup under 60 seconds.

### 9.3 Retention — INFERRED FROM CURRENT EVIDENCE + RESEARCH HYPOTHESIS

Daily/weekly value: today list, quick sheet, count flow, away card (after 7 days: last activity, overdue debts, backup age). Repeated low-effort actions are protected by idempotency and receipts. Trust recovery after errors: atomic edits + undo + documented reversals. Abandonment risks: single-device data loss (O-001), mangled ledger names eroding the party-book habit (D-001), density fatigue on Finance (Y-001), and no notification channel to pull the owner back (attention lives only inside the app — a deliberate, honest choice; **OWNER DECISION REQUIRED** if local reminders are ever wanted). Notifications as currently conceived are "useful, not annoying": in-source prompts only.

### 9.4 SaaS UX — future readiness only — CONFIRMED FROM CURRENT MAIN (absence) + RECOMMENDED DESIGN

No auth, accounts, workspaces, multi-tenant isolation, sync queue, or cloud data exist; the glossary already defines future terms (workspace, RLS, pending sync, conflict). Cloud readiness observations for later (not now): the port/adapter store boundary, idempotency keys on every write, append-only corrections, and atomic multi-store commits are sync-friendly foundations; the party ledger's note-derived identity (D-001) would become a *migration* problem under sync (names must be first-class before any merge logic). **No teams/roles/subscriptions are invented here**; those remain owner decisions with the future cloud cycle.

---

## 10. Problem Register

Categories: BLOCKER, FINANCIAL-RISK, FLOW, DATA, CONFIGURATION, HISTORY, OFFLINE-SYNC, DISCOVERABILITY, USABILITY, DENSITY, PRODUCT-STRATEGY, QUALITY. Severity reflects impact on owner trust and money truth, not implementation effort. All statuses "open" unless noted. IDs are stable for the roadmap.

| ID | Category / Severity | Finding (current-main evidence, exact location) | User scenario & impact | Financial/operational impact | Root cause | Required future behavior | Recommendation | Owner decision |
|---|---|---|---|---|---|---|---|---|
| **F-001** | FINANCIAL-RISK / High | Till-count text uses `countedMinor / 1000` while money scale is 1/100 (`pages/CashCount.tsx` lines 86, 101 vs `presentation/formatters.ts` `formatMoneyMinor` and `englishNumeric.ts` money parsing) — CONFIRMED | Owner counts 250.00 → success text and stored note say "25 د.أ" while the headline shows 250.00 | Stored amounts correct; note text (a financial record's note) wrong 10×; trust damage in the reconciliation flow | Copy-paste of quantity (milli) scale into money text | Count messages must use `formatMoneyMinor`/`MoneyValue` | Fix strings; add a formatter unit test forbidding raw division in messages | No (bug fix) |
| **D-001** | DATA / Medium | Direct-sale credit party derived from note regex `^(?:عميل|لـ|للعميل)\s*:\s*(.+)$` (`partyLedgerService.ts` `extractPartyFromNote`), while the quick sheet writes `عميل: NAME — بيع آجل من ورقة الإضافة` (`QuickActionSheet.tsx`) — CONFIRMED | The ledger shows "خالد — بيع آجل من ورقة الإضافة" as a person; search by "خالد" fails; debts split per note variant | Party aggregation (receivables by name) unreliable for quick credit sales | No customer field on DirectSale (agent decision #3 avoided a schema change) | First-class customer field (nullable, backfilled) + name normalization | Add `customerName` to DirectSale with schema 30 migration; keep note as fallback for old records | Yes (schema change timing) |
| **F-002** | FLOW / Medium | Setup: skipping the wallet (step 2) still shows step 3 (opening position); `submit()` only persists wallet+opening when `walletName.trim()` is non-empty (`pages/Setup.tsx`) — CONFIRMED | Owner answers "أعرف الرقم: 50" after skipping the wallet → answer silently discarded | Opening-position answer lost; owner believes a balance exists | Step machine doesn't branch on the skip action | Either skip step 3 when wallet skipped, or persist the answer as a pending unknown/documented choice | Skip step 3 (fastest, honest) | No |
| **U-001** | USABILITY / Medium | No unified history/audit surface; corrections recorded per-record (reversal events, revisions, order events) but visible only in each record's context; Finance events layer shows latest 3 (+ linked reversals) (`Finance.tsx` `visibleEventIds`, `EventsLayer.tsx`) — CONFIRMED | "Show me everything I changed and why" has no single answer | Audit data exists but is fragmented across stores | One history surface (or per-record expanded triple view) over existing append-only data | Add "السجل" layer listing all corrections with reasons, filtered by store | Yes (build now vs later) |
| **D-002** | DISCOVERABILITY / Medium | Suppliers / Inventory / Schedule / Catalog / Parties absent from bottom bar; reachable only via text links inside Home/Finance/Tools (`navigation.ts`, `Home.tsx` optionalModules, `Tools.tsx` moduleStates) — CONFIRMED | Infrequent users forget where suppliers live; find time > 30s | Module usage under-weighted | Navigation trade-off (4 seats + FAB per redesign) | Keep 4 seats but add a stable "المزيد/الوحدات" affordance or promote Parties — owner choice | Yes (fifth seat) |
| **Y-001** | DENSITY / Medium | Finance exposes up to 122 labels (documented cap; `Finance.tsx` 1011 lines; layers collapsed) — CONFIRMED (cap) + INFERRED (first-use load) | First reading of مالي can overwhelm; misreads possible | Decision latency on the primary money screen | Analytical breadth on one surface | Keep cash decision + position above fold; demote counts/meta to a collapsed layer; cap above-fold labels | Partially (design) |
| **Q-001** | QUALITY / Medium | Two coexisting sources of truth: `docs/product-source-of-truth.md` (2026-08-31) vs `docs/operations/current-state.md` (2026-08-28, pre-merge) + stale `apps/prototype-web/ARCHITECTURE.md` ("schemaVersion = 5", Slices 0–5) — CONFIRMED | User impact indirect; future agents may implement against stale rules | Drift risk for next slices (wrong schema/flow assumptions) | Update cadence broke on the big merge | current-state.md updated in the same PR as behavior changes (its own §7 rule) or explicitly demoted | Update both docs; mark ARCHITECTURE.md superseded sections | No |
| **Q-002** | QUALITY / Low-Medium | Debug-collector artifact shipped in public assets: `apps/prototype-web/client/public/__manus__/debug-collector.js` (captures console/network/UI events → `/__manus__/logs`) + `version.json`, git-tracked — CONFIRMED | Privacy-positioned local-first app ships a telemetry-style script (endpoint likely 404 in production, but present) | None at runtime verified; reputational/privacy review item | Production build excludes debug tooling unless explicitly enabled | Remove from tracked public/ or gate behind a build flag | Yes (keep-for-QA vs remove) |
| **O-001** | OFFLINE-SYNC / High (risk) | Single-device durability: all data in IndexedDB; no automated backup; export manual (verified) — CONFIRMED | Phone loss/browser wipe = total loss despite honest UX | Business record loss | Local-first choice; sync deferred | (a) Persistent-storage request exists; (b) verified export gate; (c) away-card reminder — add scheduled export reminder cadence decision, then future sync | Strengthen reminder copy; owner decides cloud timing | Yes (cloud timing) |
| **C-001** | CONFIGURATION / Low | Quick expense hard-codes classification (project / unknown behavior / project_general / knowledge "known") without asking (`QuickActionSheet.tsx` `submitExpense`) — CONFIRMED | Fast path is right for speed; but "known" is asserted without owner confirmation | Expense counted fully in period result (no needs-review flag) | Speed-first principle | Acceptable trade-off; consider knowledge "estimated" default for unclassified quick entries | Keep; revisit after field evidence | No |
| **P-001** | PRODUCT-STRATEGY / Medium | Money scale = 1/100 JOD (2 decimals; piasters). JOD officially uses 3 decimals (fils); money input rejects 3rd decimal (`englishNumeric.ts` `moneyPartial`) — CONFIRMED (behavior) | Prices like 12.375 impossible to enter exactly; rounding absorbed silently at entry | Sub-fils rounding differences vs cash reality at scale | Early simplification | Decide: keep 2 decimals (declare in UI) or move to 3 (schema-wide /1000) | Document the 2-decimal policy in-app, or migrate — owner decision | Yes |
| **P-002** | PRODUCT-STRATEGY / Medium | Catalog is reference-only: no unit cost / default selling price / stock binding; sale references item but nothing autofills (`src/domain/catalog/types.ts`, `DirectSaleEditor.tsx`) — CONFIRMED | P3 persona's "select product → price/stock fill" unmet (partially by design) | None (by design); expectation gap only | Deliberate contract (G4-A) | Either keep + explain in UI ("مرجع فقط") or add optional price/cost fields | UI explanation now; price fields as owner decision | Yes |
| **P-003** | PRODUCT-STRATEGY / Low | Profile is fixed to `activityType: "custom_craft"`; the setup badge says "مشغل حرفي" for every project (`storage/local/types.ts` `ActivityProfile`, `Setup.tsx` impact card) — CONFIRMED | Non-craft owners (food, services) see a wrong label on day one | None functional today; blocks future Activity Profiles | Current vertical slice choice | Either neutralize the label ("مشروعك") now or implement profiles per future plan | Neutral label now; profiles later | Yes (label change) |
| **H-001** | HISTORY / Low | No retroactive inventory import; activation dated today; pre-activation periods declare "not managed" (`projectFinancialService.ts`, owner decisions 8–10) — CONFIRMED | Owner with old stock cannot reconstruct history without a fresh start | Period results before activation correctly exclude COGS | Deliberate honesty decision | Keep; provide guided-opening-import alternative | Keep | Already decided (closed); reopen only with evidence |
| **U-002** | USABILITY / Low | Away card lists overdue-debt count and backup age only; no "what changed while away" digest (`Home.tsx` awaySection) — CONFIRMED | Returning owner gets a thin recap | None | Scope choice | Extend away card with counts (sales, expenses, orders) since last activity | Low-cost enhancement | No |
| **F-003** | FLOW / Low | `/orders/new` intent chooser duplicates FAB entries for the same outcome (`NewDraft.tsx` vs `MicroAppShell.handleQuickAction` → `/orders/draft/new?intent=…`) — CONFIRMED | Two paths to the same editor; chooser adds a screen | None | Historical entry point kept | Keep one path (FAB) and retire/redirect the chooser, or keep chooser as deep-link surface | Simplify (owner may keep both) | Yes |
| **D-003** | DATA / Low | Party ledger is read-only; collecting a direct-sale debt requires editing the sale; no per-party "قبضت/دفعت" action (`partyLedgerService.ts`, `Parties.tsx`) — CONFIRMED | Natural act "استلمت من خالد" not offered where the person is listed | Debt settlement stays correct but slow | Read-model purity decision | Route from party row to the correct collection flow (order collect / sale edit / purchase payment) | Add navigation shortcuts (no new writes from ledger) | No |
| **U-003** | USABILITY / Low | Setup keeps typed input in component state only; interruption loses the name (`Setup.tsx`) — CONFIRMED | Minor re-typing after interruption | None | Wizard simplicity | Persist draft locally on change (non-financial preference store) | Low priority | No |

**BLOCKER scan result: none confirmed on current main.** Build/test gates are documented green at the merge (`docs/product-source-of-truth.md` §16: 178 domain + 398 prototype tests, two typechecks, lint ≤ 37, design guards, production build); this audit did not execute them (§2.4). The two initially suspected code-level anomalies (a seeming destructuring error in `CashCount.tsx` and the `__manus__` artifacts) were byte-verified: the former was a display artifact of the analysis tooling (actual bytes correct), the latter is real and registered as Q-002.

---

## 11. Target-State Specification (A–Z), Roadmap, Validation, Open Decisions

### 11.1 Target-state specification — RECOMMENDED DESIGN (each item: problem → proposed behavior; current behavior is §4–§8)

**A. Product model.** Money-honest companion for one Jordanian micro-business owner; offline-first local prototype now, cloud-ready later. Problem: none structural; keep positioning. Target: unchanged core promise + repaired trust defects.

**B. User model.** Single owner, no auth. Target: keep; add optional shared-device privacy (PIN/amount hiding) only when the owner decides (privacy decision deferred in the repo).

**C. Personas.** All eight (§5.1) served; P3's product-selection gap is the only persona with an unmet expectation — resolved by P-002 decision.

**D. Journey.** Keep the 11-stage shape; fix stages 2 (F-002), 6 (D-001), and 10 (U-001).

**E. Flows.** All 19 audited flows stay; FL-18 gains corrected messages; FL-1 gains branch fix; FL-12/13 gain the unified history surface as a review point.

**F. Information architecture.** Four seats + FAB + gear; Finance keeps cash-first with collapsed analytics; Tools independent; parties/wallets under Finance; a "السجل" layer (U-001) inside Finance (and Settings for full export-based history).

**G. Navigation.** Keep bar hidden in deep flows and with keyboard; keep redirect `/review` → `/finance`; decide the fifth seat (D-002) — options: keep empty-by-design Market placeholder per E-00.14, or promote Parties.

**H. Screens.** Contracts in §7.4 stand; changes: Setup branch fix; CashCount formatter fix; Finance above-fold trim; Parties action shortcuts.

**I. Wireframes.** §7.5 deltas: receipt shows date; away card digest; events layer full log; Finance meta-line collapse.

**J. Density.** Policy: task density allowed on detail/period surfaces; first-use surfaces capped (Home ~29, Finance target ≤ ~60 above fold via collapse); catalog/entitlement screens remain advanced.

**K. States.** Keep the matrix (§4.7 states; module states; knowledge states; collection statuses; settlement triple). Add "pending opening declaration" state visuals when F-002 is fixed by persistence.

**L. Onboarding.** Two-stage model (§7.7): Stage A = current 3 questions (fixed); Stage B = Foundation with استخدمه الآن/قد أحتاجه لاحقًا/لا أحتاجه choices mapped to module states.

**M. Financial core.** Unchanged semantics; the eight event types and `DELTA_TABLE` remain the single authority; money-precision decision (P-001) resolved explicitly.

**N. Optional modules.** Same set; states surfaced in Tools; never mandatory; module states richer than on/off retained.

**O. My Tools.** Unchanged independence; saved estimates stay non-financial; module-state labels stay.

**P. Cost calculator.** Unchanged (meets the independence principle fully); optional future: contextual "استخدم هذا التقدير في مسودة" link already allowed but never automatic.

**Q. Products.** Catalog stays reference-only **or** gains optional default price/cost per owner decision (P-002); if added, historical preservation rules apply (price at sale time always the actual entered price).

**R. Sales.** Direct sales gain a first-class `customerName` (D-001 fix) with backfill from notes; credit statuses unchanged; revisions unchanged.

**S. Inventory.** Dated activation, evidenced consumption, append-only movements unchanged; retroactive import stays deferred; sale-driven decrement stays out (owner may revisit with evidence).

**T. Cash.** Recorded/wallet/unallocated model unchanged; allocation guards unchanged; count messages fixed (F-001).

**U. Wallets.** Kinds, opening (known/unknown, backdated), transfers, adjustments unchanged.

**V. Amanah.** Held/released dimension unchanged; always visible in Finance truth when held; release button conditional on holdings; comprehension line stays.

**W. Editing/deletion.** Atomic reversal+replacement; documented deletion; undo re-record; guards unchanged — plus the unified history surface (U-001) as the review point.

**X. Opening balance.** Known/unknown/zero honesty unchanged; later-declaration path unchanged; fix the discard path (F-002).

**Y. Historical protection.** Append-only + disclosures unchanged; no silent reinterpretation; old reports declare what was not managed.

**Z. Offline, cloud, accessibility, RTL, testing, MVP, conversion, retention, risks, open decisions.** Offline: local persistence + verified export + reset gate unchanged; add reminder cadence. Cloud: no change now; keep sync-friendly foundations (ports, idempotency, append-only); fix D-001 before any sync design. Accessibility: keep RTL/AR discipline; add a reduced-motion + screen-reader pass and larger-device/landscape QA to the future plan. Usability testing: run the §9.1 plan. MVP: §6.2 classification stands. Conversion: activation = first receipt; keep < 60s setup. Retention: away card digest + backup cadence. Risks: single-device loss (O-001), doc drift (Q-001), density fatigue (Y-001), expectation gaps (P-002/P-003). Open decisions: §11.4.

### 11.2 Roadmap (recommended, not implemented)

| Wave | Objective | Affected areas | Dependencies | Risks | Non-goals | Validation | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| R1 — Trust repairs | Fix F-001, F-002 | CashCount, Setup | None | Trivial | No schema change | Unit tests on messages; manual walkthrough | Count text matches MoneyValue; no discarded answers |
| R2 — Identity & data | D-001 customer field (+ backfill), Q-002 artifact removal decision | DirectSale domain, storage (schema 30), party ledger, export | Schema migration + import backfill | Migration correctness; old files | No new features | Migration tests; round-trip export test on mixed data | Ledger shows clean names; old notes still readable |
| R3 — Reading experience | U-001 history layer; Y-001 Finance trim; U-002 away digest; D-003 party shortcuts | Finance layers, Home, Parties | None (read models) | Density regressions | No semantic changes | Text-density guard; usability scenarios U4/U8/U12 | History visible in one place; above-fold labels ≤ target |
| R4 — Decisions package | Owner decisions on P-001 (precision), P-002 (catalog price), P-003 (label), D-002 (fifth seat), privacy | Docs + possibly schema | R2 if schema touched | Scope creep | No Market/Delivery/Auth/Cloud | Decision records (docs/decisions) | Each decision closed in writing |
| R5 — Field validation | Run §9.1 usability plan; device acceptance (Android/iOS, offline reload) per repo's own open gates | QA docs | R1–R3 | Field findings may reopen items | No new features before evidence | Moderated sessions; device matrix | Scenario success ≥ 80% unassisted; honest report of failures |
| R6 — Cloud readiness (future) | Sync design on the fixed foundations | Storage port, transfers | R2 + owner decision | Sync complexity | No multi-user now | Design doc + spike | Owner-approved sync contract |

### 11.3 Validation criteria (for the target state)

1. Every money string in every surface renders through the shared formatter (guard test). 2. Setup never discards a given answer (flow test). 3. Party ledger names match what the owner typed (field-level test + probe in usability test U7/U12). 4. The events/history layer shows every correction triple with reasons (data test over synthetic corrections). 5. Above-fold label counts within the density policy (existing script). 6. The five financial boundaries hold (existing domain tests stay green; add regression for each). 7. Export round-trip includes any new schema fields; reset gate still requires verified export. 8. All 12 usability scenarios pass ≥ 80% unassisted in a future moderated test.

### 11.4 Open decisions (OWNER DECISION REQUIRED)

1. **Money precision** — keep 2-decimal piasters (declare in UI) vs migrate to 3-decimal fils (P-001). 2. **Direct-sale customer field** — approve schema 30 migration timing (D-001). 3. **Unified history surface** — build now (U-001) vs per-record disclosure only. 4. **Fifth navigation seat** — Market placeholder (current E-00.14) vs Parties promotion vs empty-by-design (D-002). 5. **Shared-device privacy** — PIN/amount hiding now vs later (repo's deferred decision). 6. **Catalog price/cost fields** — keep reference-only vs optional defaults (P-002). 7. **Activity label** — neutralize "مشغل حرفي" now vs Activity Profiles later (P-003). 8. **Retroactive inventory import** — stay deferred (recommended) vs design (H-001, currently a closed owner decision — do not reopen without field evidence). 9. **Cloud/sync timing** — untouched until after R5 (O-001). 10. **Debug artifacts** — remove `__manus__` from public assets vs keep gated for QA (Q-002).

### 11.5 Limitations and confidence levels

- This audit is **static analysis + documentation synthesis**; it did not run the app, the tests, or the build, and did not conduct user research. Runtime-only behaviors (rendering quirks, keyboard behaviors, PWA install flows) are outside its evidence.
- Personas, journey predictions, and usability scenarios are labeled hypotheses/simulations.
- The strongest-confidence findings (F-001, D-001, F-002, Q-001, Q-002, O-001, D-002, Y-001, C-001, P-001..P-003) are CONFIRMED FROM CURRENT MAIN with cited symbols; judgments about density, discoverability burden, and persona expectations are INFERRED FROM CURRENT EVIDENCE or RECOMMENDED DESIGN as labeled.
- No accounting, tax, or legal rules were invented or applied; financial statements described are the system's own recorded readings, which the product itself labels as non-final.
- The two reports (this English source and the Arabic DOCX) were written from the same findings table; any discrepancy found later should treat this file as the traceable source of record.

---

## Appendix A — Evidence index (primary symbols cited)

`app/MicroRouter.tsx` (38 routes) · `app/navigation.ts` · `app/routeClassifier.ts` · `app/StartupGate.tsx` · `components/layout/MicroAppShell.tsx`, `BottomNav.tsx`, `AppHeader.tsx`, `QuickActionSheet.tsx` · `pages/Home.tsx`, `Setup.tsx`, `Foundation.tsx`, `Finance.tsx`, `Tools.tsx`, `Parties.tsx`, `CashWallets.tsx`, `CashCount.tsx`, `CashDistribution.tsx`, `FinancialEventEditor.tsx`, `DirectSaleEditor.tsx`, `Orders.tsx`, `OrderDetail.tsx`, `Settings.tsx`, `NewDraft.tsx` · `components/finance/EventsLayer.tsx` · `src/domain/financial-event/{types,policies}.ts` (8 types, `DELTA_TABLE`, reversal) · `src/domain/cash-continuity/{types,policies}.ts` (allocation) · `src/domain/craft-order/types.ts` (statuses, `CostSnapshot`) · `src/domain/direct-sale/types.ts` · `src/domain/{supplier-purchase,inventory-material,catalog,g5,owner-entitlement,actual-time,recurring-margin}/types.ts` · `application/finance/projectFinancialService.ts` (position, period, `editEvent`, `deleteEvent`, `restoreEvent`, `distributeUnallocated`) · `application/cash/cashContinuityService.ts` · `application/estimates/costEstimateService.ts` · `application/parties/partyLedgerService.ts` (`extractPartyFromNote`) · `application/transfers/localTransferService.ts` (`createVerifiedExport`, `resetAll`) · `application/input/englishNumeric.ts` · `presentation/formatters.ts` (`formatMoneyMinor`) · `storage/local/types.ts` (schema 29, export 21, `CostEstimate`) · `storage/local/IndexedDbLocalStore.ts` (26 stores) · `docs/product-source-of-truth.md` · `docs/operations/current-state.md` · `docs/08-glossary.md` · `docs/product/owner-decisions-v1.md` · `docs/reference/independent-flow-redesign.md` · `apps/prototype-web/ARCHITECTURE.md` · `apps/prototype-web/client/public/__manus__/debug-collector.js`.
