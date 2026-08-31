# Micro — Deep UX/Product Analysis After Phase-1 Verified Repairs (Source Report)

| Field | Value |
|---|---|
| Repository | https://github.com/Qays7753/Micro |
| Phase-1 baseline (original `main`) | `8ede6b2b93c9d55bba69f33548054313e332db41` (2026-08-31, "merge: the financial flow and operating model redesign") |
| Phase-1 correction branch | `phase1/confirmed-corrections` — fix commit `2b998cfc890c6a5d720f08ad9916af36a373fee8`, merge commit `f7c14303ff13b96cdedd56725ce83497b843e1a1` |
| Phase-2 analyzed baseline | Remote `main` @ **`f7c14303ff13b96cdedd56725ce83497b843e1a1`** (local == remote verified after merge; working tree clean; no secrets) |
| Analysis date | 2026-08-31 |
| Analysis mode | Phase 2 = analysis and recommendations only — **no implementation, no commits, no data changes** |
| Deliverables | `docs/product-audit/financial-system-deep-ux-product-analysis-ar.docx` (Arabic, primary review document) and this file (English, traceable source) |
| Companion input | The prior current-state report (`financial-system-current-state-analysis-source.md`, baseline `8ede6b2`) was read completely; every finding was independently re-verified against current `main` before Phase-1 changes. |

```
Analysis baseline: current remote main only (@ f7c1430, i.e., after the Phase-1 merge).
Historical comparison: explicitly disabled.
Implementation baseline in Phase 2: none; analysis and documentation only.
Phase 1 (repairs) was implemented, pushed, merged, and verified clean before Phase 2 began.
```

Evidence labels used throughout (exactly one per important conclusion):

- **CONFIRMED FROM CURRENT MAIN** — directly verifiable in the repository at `f7c1430`.
- **INFERRED FROM CURRENT EVIDENCE** — a judgment grounded in confirmed code behavior.
- **RECOMMENDED DESIGN** — a target-state proposal, not an owner-approved decision.
- **RESEARCH HYPOTHESIS / SIMULATION** — simulated user behavior; no field research was conducted.
- **OWNER DECISION REQUIRED** — a product decision this report explicitly does not make.

---

## 1. Executive Summary

Micro is an Arabic, RTL, phone-first, offline-first financial and operating companion for one Jordanian micro-business owner. At `f7c1430` it is a financially **serious** system: eight financial event types with a five-dimension effect table, append-only corrections with documented reversals, unknown-vs-zero discipline enforced in domain code (not just copy), JOD minor units at 1/100 with integer half-up rounding, idempotent writes everywhere, and a verified-export round-trip gate. This report does not ask whether the core is honest — it is — but whether a non-technical owner can *reach* that honesty quickly, understand it, correct mistakes without fear, and keep coming back daily.

**Phase 1 (implemented, merged, verified).** Six confirmed defects were repaired on branch `phase1/confirmed-corrections` and merged into `main` as `f7c1430`: the till-count money-scale text bug (F-001), the setup path that asked an opening-position question and then discarded the answer when the wallet was skipped (F-002), the credit-sale customer identity buried in note text (D-001), a **newly discovered critical defect** in which any owner holding a credit sale or a documented price cut could not produce a verified backup at all (the export guard rejected legitimate domain records — F-004), stale operating/architecture documentation (Q-001), and telemetry-style debug artifacts shipped in production public assets (Q-002). No product decision was silently implemented; all deferred decisions remain open in §21.

**Phase 2 (this report).** Deep analysis from the repaired `main` surfaced **8 new open findings** beyond the 12 carried forward from the prior audit — most importantly: direct-sale revenue never enters the period result, so a cash-heavy seller sees "النتيجة" of zero revenue (F-005, owner decision with recommendation); the amanah release path has no guard against releasing more than held, allowing negative holdings (F-006, integrity defect); the "unknown opening balance" promise has no UI road to completion (D-004); and saved cost estimates are write-only with no reuse path (U-004). The products-and-sales gap analysis presents three viable product-model options and recommends a reference-plus-defaults model (Option A) that preserves the system's truth-over-smoothness principles. The target onboarding keeps the repaired three-question Stage A and makes Foundation a true Stage B with honest module choices. The roadmap sequences integrity hardening before reading experience before product decisions, and field validation before any cloud work.

**The single most important open decision** (§21, D-01): how direct sales should be recognized in the period result — the current order-only recognition is defensible but silently misleading for the most common micro-business pattern (immediate cash sales), and it is the root of several downstream UX confusions (profit per sale exists but never aggregates).

---

## 2. Scope, Method & Phase-1 Repair Record

### 2.1 Scope

Phase 2 inspects the repository as it exists on `main` at `f7c1430`. No older branch, PR, deployment, or report was used as a hidden requirement; the prior current-state report was used only as a *diagnostic input* whose every claim was re-verified in code before Phase-1 acted on it. During Phase 2, **no application code, data, schema, configuration, tests, dependencies, assets, or documentation were modified**, and no commits were created. The application was not run; all evidence is repository evidence (build/test gates were executed only during Phase 1, before the merge).

### 2.2 Method

Four deep evidence passes over the repaired `main` covered: (1) navigation/IA/screen inventory (all 38 routes, nav seats, per-screen structure), (2) products/catalog/sales/orders/inventory/estimates, (3) the financial domain model (event effects, position composition, period result, corrections), and (4) mobile UX/density/RTL/accessibility/PWA. Findings below cite exact files and symbols. Personas, journey predictions, and usability scenarios are labeled hypotheses/simulations.

### 2.3 Phase-1 verified issue list and outcomes

Every candidate finding was confirmed in current code before any change (per the verification-first rule). One candidate proved **more severe** than the prior report registered (the export guard), one was intentionally **not** implemented (U-003, setup draft persistence — requires a new persistence surface, a design decision deferred to Phase 2), and everything confirmed as a defect was fixed.

| Finding | Confirmed? (evidence at `8ede6b2`) | User / financial impact | Required target behavior | Implementation decision (actual) |
|---|---|---|---|---|
| **F-001** Till-count money text | YES — `pages/CashCount.tsx` L86/L101 divided minor units by 1000 (quantity scale) and L89–90 printed raw minor units in the reason | Counted 250.00 stored a note saying "25 د.أ"; reconciliation trust damage at the exact moment of truth-telling | All money strings through the shared formatter (1/100) | Extracted `presentation/cashCountMessages.ts` (note/reason/success builders); CashCount uses them; 3 regression tests lock the scale (25000 → "250.00", never "/1000", never raw minor) |
| **F-002** Setup asks-then-discards | YES — skip button cleared `walletName` then went to step 3; `submit()` persisted wallet+opening only when `walletName.trim()` non-empty | Owner answers "أعرف الرقم: 50" after skipping the wallet → answer silently lost | Never ask a question whose answer is discarded | Skip now saves the project directly and never shows the opening question; wallet+opening are recorded later from «مالي» exactly as the button copy states; 2 UI tests cover skip and keep paths |
| **D-001** Credit-party identity from note | YES — `DirectSale` had no customer field; `QuickActionSheet.tsx` L181 wrote "عميل: NAME — بيع آجل من ورقة الإضافة" into the note; `partyLedgerService.extractPartyFromNote` regex captured the whole rest-of-note as the "name" | Ledger showed "خالد — بيع آجل من ورقة الإضافة" as a person; search-by-name fails; debts fragment per note variant | First-class optional customer field; legacy notes as read-time fallback only | Added `customerName` to `DirectSale` + create/update inputs (undefined keeps original, explicit null clears); quick sheet and full editor save it structurally; ledger prefers the field and strips the source descriptor in the legacy fallback (records untouched); sales list shows the customer |
| **F-004** Verified export rejects legitimate sales — **discovered during Phase-1 verification, not in the prior report** | YES — `localTransferService.isDirectSale` required `collectedMinor === revenueMinor` and `isDirectSaleRevision` rejected `kind:"price_cut"`; both are normal domain outputs (X-06 credit sales, `applyPriceCut`) | **Any owner with one credit sale or price-cut sale could not create a verified backup — and the reset gate requires a verified export.** Data-durability and financial-risk defect | Guard accepts what the domain legitimately produces | Guard now accepts `0 ≤ collected ≤ revenue` with the three collection statuses and `price_cut` revisions (structural checks only); 2 full round-trip tests (credit sale with customer; price-cut sale) |
| **Q-001** Stale governing docs | YES — `docs/operations/current-state.md` last updated 2026-08-28 (pre-merge: no My Tools/Amanah/allocations/party ledger/till counting/schema 29/export 21); `apps/prototype-web/ARCHITECTURE.md` claimed `schemaVersion = 5`, "Slices 0–5", "no PWA" | Future work implemented against wrong schema/flow assumptions | Docs match current reality | `current-state.md` updated (§16 added per its own update rule; header/main-row/§3.1 corrected to schema 29/export 21); `ARCHITECTURE.md` rewritten to current architecture |
| **Q-002** Debug artifacts in public assets | YES — `public/__manus__/debug-collector.js` (24.8 KB telemetry-style script) + `version.json` git-tracked; Vite copies `public/` into production builds (only SW precache ignored them); the repo's own ops file says these must not be tracked | Privacy-positioned local-first app ships a collector script in production assets | Production never ships dev tooling | Collector moved to `apps/prototype-web/dev-tools/`, served **dev-only** via a Vite middleware; unreferenced `version.json` removed; production build verified free of `__manus__` |
| U-003 Setup draft persistence | YES (real but minor) — typed name lives in component state only | Name re-typed after interruption | Persist draft | **Intentionally not implemented**: needs a new persistence surface (design decision); carried to §18/§21 |

**Gates at merge:** 180 domain tests (+2) and 408 prototype tests (+10) all green; both typechecks clean; lint at the 37-warning baseline; text-density within all caps (DirectSaleEditor cap raised 42→43 for the single mandated customer label, documented in the script); design-token guards pass; production build with PWA succeeds and contains no `__manus__` artifacts. **No schema/export version change** — `customerName` is an optional JSON field, and 21/29 files cross cleanly in both directions (round-trip tested). **No historical record was rewritten anywhere.** Token hygiene was verified by scanning all history for the actual token value (clean).

### 2.4 What was deliberately NOT decided in Phase 1

Per the phase discipline, none of the following was implemented: money precision (2 vs 3 decimals), catalog default prices/unit costs, sale-driven inventory decrement, fifth bottom-nav seat, unified history surface, Activity Profiles, shared-device privacy, cloud sync, and the treatment of direct-sale revenue in the period result (discovered in Phase 2). All appear in §21 with options and recommendations.

---

## 3. Current State After Repairs — Module Map, Hidden Capabilities

### 3.1 Shape and stack — CONFIRMED FROM CURRENT MAIN

React + Vite + TypeScript PWA (pnpm workspace; `vite-plugin-pwa`, registerType `prompt`), one continuous Android-like shell with 38 routes and lazy pages, 35 page components, 13 domain modules under `src/domain`, ~28 application services composed in `PrototypeServicesContext`, `PrototypeLocalStore` port over IndexedDB (schema 29, export 21, 26 object stores). RTL is asserted at document, shell, sheet, and dialog level; numerics are ASCII/LTR isolated inside RTL. Offline-first: 54 precache entries, update waits for user consent, offline notice card, persistent-storage request at boot.

### 3.2 The three financial layers — CONFIRMED

1. **Records of truth** (append-only, correctable only by documented reversal): craft orders (+cost snapshots), direct sales (+revisions), financial events (8 types, 5-dimension deltas), supplier purchases, inventory movements, G5 declarations, owner-entitlement records, cash-continuity entries, cost estimates.
2. **Read models** (pure derivations): position, period result, insights (margins/break-even/liquidity), party ledger, cash overview, catalog margins — none of them write.
3. **Decision surfaces**: Home, Finance (cash decision first), Tools (estimation + module states), Parties, Orders, Settings (export/import/reset gates).

### 3.3 Hidden and embedded capabilities — CONFIRMED

- **Service capabilities with no UI caller** (dead surfaces): `projectFinancialService.editEvent`, `deleteEvent`, `restoreEvent` (only `reverse` is reachable from `EventsLayer`); `cashContinuityService.recordOpeningBalanceLater` (PA-007 later-dated documented opening — the promised completion road for "unknown" openings); `openingUnknown`/`unknownOpeningCount` computed in the cash overview but rendered nowhere.
- **Mounted-but-dead capability:** the sonner `Toaster` is mounted (z-index 70, RTL, safe-area offsets) but `toast()` is never called — all feedback is inline `role="status"`/`role="alert"`.
- **Declared-but-unused state:** Tools declares a «متوقف مؤقتًا» (paused) module state that no code path ever produces; three module rows hard-code `available_not_enabled` regardless of data (e.g. «دفتر الناس» shows "متاح — غير مفعّل" even when the ledger has parties and balances).
- **Conditional surfaces:** the Amanah release button exists only when holdings > 0 (`Finance.tsx`); the Market/Delivery seat is explicitly "غير متاح في هذه المرحلة"; `/review` is a permanent redirect into Finance («المراجعة اندمجت نبضة داخل مالي»); deep flows hide bottom nav + FAB via `routeClassifier.ts`.
- **Hidden asymmetry:** order detail (`/orders/:id`) keeps the nav bar (surface) while sale detail (`/direct-sales/:id`) is classified deep and hides it — two "detail" screens, two treatments.
- **Implicit route alias:** `/suppliers/purchase/new` is not a declared route; it rides `/suppliers/purchase/:id` with the magic id `"new"`.

### 3.4 The product surface at a glance — CONFIRMED

Bottom bar: «مشروعي الآن» (Home) · «العمل» (Orders) · FAB «إضافة» · «مالي» (Finance) · «أدواتي» (Tools). The fifth seat is an intentionally declared vacant placeholder (E-00.14: market seat). Header: brand, contextual label, theme toggle, gear → Settings. Quick sheet (FAB): transient sale/expense forms inside the sheet; order/estimate/collection start deep routes. Everything else — suppliers, inventory, schedules, catalog, parties, cash wallets, till counting, foundation — is reached through text links, collapsed Finance layers, Tools module rows, or conditional Home cards (§8.4 audits each).

---

## 4. User Research, Personas, Journey

### 4.1 Research hypotheses — RESEARCH HYPOTHESIS / SIMULATION (no field research was conducted)

- **H1 (activation).** The owner's activation moment is the first *receipt* ("وصل التسجيل"), not setup completion. Repository grounding: the quick sheet ends every save with a receipt mode echoing the post-save cash total (`QuickActionSheet.tsx` receipt mode), and setup itself is three decisions with one mandatory field. Hypothesis: owners who record their first sale within 60 seconds of finishing setup will return the next day at a materially higher rate.
- **H2 (correction fear).** The single biggest trust risk is not wrong numbers (the domain prevents that) but *fear of touching saved records*. Every correction is append-only and documented, yet the UI language around reversal ("لا يُسمح بتراجع ثانٍ") may read as prohibition rather than protection. Hypothesis: explicit "corrections are safe here" affordances raise correction usage and reduce abandoned drafts.
- **H3 (period-result mismatch).** Cash-heavy sellers (direct sales only) will read «نتيجة الفترة» as "my profit" and be confused when it shows zero revenue while cash grew (F-005, §17.2). Hypothesis: the confusion is model-level, not copy-level; a copy note alone will not fix it.
- **H4 (unknown-opening demand).** A meaningful share of owners genuinely does not know their opening drawer balance; the honest "unknown" state exists, but with no visible road to completion (D-004) it becomes a permanent silent gap. Hypothesis: a later-dated documented-opening road (PA-007 surfaced in UI) would be used within the first month by most of that share.
- **H5 (density ceiling).** Finance's 122 at-rest strings and OrderDetail's 127 sit far above the design system's §10.1 aspiration; owners will not read the layers on first visit, only the top decision card. Hypothesis: comprehension of the cash decision card is high while layer content comprehension is near zero on first exposure — which is acceptable *only* if every layer is reachable again later by intent.

### 4.2 Personas — RESEARCH HYPOTHESIS / SIMULATION (clearly labeled hypothetical; grounded in confirmed screens)

| # | Persona (Arabic frame) | Context | Primary jobs | Evidence of fit in current main |
|---|---|---|---|---|
| P1 | أم ربة منزل — home micro-business | Sells from home, mixed cash/card, phone-only | Record sales fast; know what's in the drawer; separate her money from the business | Quick sheet sale path; owner capital vs expense boundary (`owner_investment_cash` ≠ revenue); Amanah for money held for others |
| P2 | مسجّل الكاش اليومي — daily cash recorder | Records money in/out daily; no products | Money in/out; till counting; wallet balance truth | `operating_revenue_cash`-style order collections vs direct sales; `CashCount` (repaired); wallet overview truth line |
| P3 | بائع منتجات — product seller | Repeated items (coffee, boxes, trays) | Select an existing product at sale time; know per-item margins | Catalog exists (reference-only, §6); per-sale profit exists (`profitMinor`); **no selection-driven autofill** — P3's core expectation is unmet (by design, owner decision open) |
| P4 | صاحب الطلبات — order-based owner | Custom work with agreements, deposits, delivery | Draft → cost → agreement → execute → deliver → collect; debt tracking | Full order lifecycle incl. 10 statuses, deposits, registered debt; party ledger aggregates order debts by customer name |
| P5 | لا يعرف الرصيد الافتتاحي — unknown-opening owner | Starting mid-life with an unknown drawer | Start honestly without inventing a number; declare the opening later | `openingStatus:"unknown"` exists in domain + Setup option; **completion road missing in UI** (D-004) |
| P6 | صاحب محافظ متعددة — multi-wallet owner | Drawer + bank + digital wallet | Know per-location cash; move money between locations; allocate unallocated cash | Wallet kinds; transfer pairs; allocation guards (`distributeUnallocated`); unallocated strip in Finance |
| P7 | مقدّر التكلفة — estimator | Quotes before committing | Estimate materials/time/buffer; save estimates; later turn one into a draft | Cost calculator on Tools (independent, non-financial — fully compliant); saved estimates exist but are **write-only** (U-004) |
| P8 | النواة المالية فقط — financial-core-only owner | Wants money in/out/cash/record only | Minimal setup; honest balances; nothing else | Setup asks 3 decisions; everything else optional; Tools/Finance layers collapsed; My Tools independent |

### 4.3 User journey (11 stages) — grounded in confirmed screens; post-repair status noted

| Stage | Owner moment | Current experience (confirmed) | Post-Phase-1 status | Remaining risk |
|---|---|---|---|---|
| 1 | First impression | Arabic RTL native-feeling shell, no login, local-first truth line | unchanged | none material |
| 2 | First launch & setup | 3 decisions: name → wallet (skippable) → honest opening choice | **repaired (F-002)**: skip no longer asks-then-discards | typed name lost on interruption (U-003) |
| 3 | Understanding value | Home truth lines + "ما هو مسجل حتى الآن؟" four facts with "غير مسجل — سجّله" roads | unchanged | four-facts card is quiet; value comprehension depends on H1 receipt moment |
| 4 | Minimum setup | Foundation page (optional, foldable, permanent) | unchanged | Foundation is honest but text-dense; Stage B model (§10) unclaimed |
| 5 | First useful outcome | FAB → quick sale/expense → receipt with post-save cash | unchanged; **credit sales now record the customer structurally (D-001)** | receipt is a dead end (no "سجّل آخر" repeat action) |
| 6 | First transaction | Sale with cost known/unknown; difference panel (X-06) three honest choices | unchanged; export guard now accepts all of them (F-004) | quick sheet hard-codes quantity 1 (§6.4) |
| 7 | Financial review | Finance cash decision card; layers; period reading | unchanged; count text scale honest (F-001) | period result excludes direct sales (F-005) |
| 8 | Daily repetition | FAB muscle memory; Home "اليوم" section; away card after 7 days | unchanged | away card is thin (U-002); backup reminder cadence owner decision |
| 9 | Optional discovery | Tools module states; Finance action layer (11 actions, collapsed) | unchanged | discoverability burden (D-002); hard-coded module states (D-006) |
| 10 | Correction & recovery | Reversal with required reason; revisions preserved; unsaved-changes guard | unchanged; verified export now safe for all sale shapes (F-004) | no unified history surface (U-001); event edit/delete services unreachable (D-005) |
| 11 | Trust & retention | Persistent-storage request, install prompt (30-day dismissal), update-consent card, offline notice | unchanged | single-device durability (O-001); reminders un-designed |

---

## 5. User Stories & Critical Flows

### 5.1 User stories — format "As a [user type], I want to [action] so that I can [outcome]" (priority: M = MVP core, O = important optional, A = analytical, F = future; data = required; flow = §5.2 reference; acceptance = verifiable criterion)

| # | Story | Pri | Data required | Flow | Acceptance criteria |
|---|---|---|---|---|---|
| S-01 | As any owner, I want to record a cash sale in under 15 seconds from anywhere so that I never skip recording | M | amount (required); item name, cost, wallet optional | FL-A | FAB → sheet → receipt ≤ 4 taps; receipt shows post-save cash; offline-safe |
| S-02 | As any owner, I want to record a credit sale with the customer's name so that the debt lands in «دفتر الناس» under that name | M | amount, collected-now, customer name | FL-A | ledger row = exactly the typed name; sale detail shows customer; **implemented in Phase 1 (D-001)** |
| S-03 | As any owner, I want the till-count messages to match what I counted so that the record of the reconciliation is trustworthy | M | wallet, counted amount | FL-D | note/reason/success strings render the same number as the screen; **implemented in Phase 1 (F-001)**; guarded by unit tests |
| S-04 | As a setup-skipping owner, I want skipping the wallet to not ask me questions whose answers are thrown away | M | project name only | FL-G | skip → save → foundation; no opening question shown; **implemented in Phase 1 (F-002)** |
| S-05 | As any owner, I want a verified backup file I can trust so that a lost phone does not erase my business record | M | none (one action) | FL-H | verified export succeeds with credit/price-cut sales present (**guard fixed in Phase 1, F-004**); import round-trips; reset gate refuses without it |
| S-06 | As P3 (product seller), I want to pick a product when recording a sale so that I don't retype names and prices | O | catalog item (optional), actual price | FL-A / §6 | selection offers existing items; autofill proposal clearly labeled; actual entered price always authoritative (owner decision D-05) |
| S-07 | As P3, I want per-item margin over time so that I know which items earn | A | catalog binding + final orders (today) or direct sales (D-01) | FL-F | margins read-model exists for orders today; direct-sales margins need D-01 decision |
| S-08 | As P4 (order owner), I want one screen per lifecycle step so that I always know the next action | M | order + snapshot + agreement | FL-B | OrderDetail shows exactly one contextual primary CTA per status; deposit/debt truths never mislabel profit |
| S-09 | As P4, I want to record a deposit and later the remaining collection so that cash and debt stay separate | M | amounts + dates | FL-B | collections increase cash only; registered debt appears in receivables; no double revenue |
| S-10 | As P5 (unknown opening), I want to declare my opening balance later with its own date so that history stays honest | O | later count + date + reason | FL-D2 | PA-007 service exists; **UI road missing (D-004)**; target: from wallet row, documented later opening lifts the unknown stamp |
| S-11 | As P6 (multi-wallet), I want to allocate unallocated cash to a wallet so that each location's balance is real | O | wallet + amount + direction | FL-C | guards: no overdraft of unallocated, no overdraw of wallet; total cash unchanged |
| S-12 | As P6, I want transfers between wallets so that moving money doesn't look like income or expense | O | source, target, amount | FL-C | paired entries; reversal reverses both legs; no net-cash change |
| S-13 | As P7 (estimator), I want to save an estimate and reuse it as a draft later so that quoting turns into work | O | estimate (non-financial) | FL-E | **currently impossible (U-004)**; target: saved estimate row → "ابدأ مسودة من هذا التقدير" — estimate stays untouched |
| S-14 | As any owner, I want to see everything I corrected and why in one place so that I trust the ledger | O | existing reversal data | FL-F | history surface lists corrections with reasons across stores (U-001); today data exists but surfaces are fragmented |
| S-15 | As any owner, I want my unknowns shown as unknown so that the system never invents my numbers | M | none | all | `missing ≠ zero` verified at 10 sites (§17.1); regression-tested in domain suites |
| S-16 | As P2 (daily recorder), I want a weekly nudge to count the drawer so that drift never accumulates | F | cadence choice | FL-D | reminder cadence = owner decision (§21 D-11); count flow already first-class |
| S-17 | As any owner, I want corrections to be safe so that I fix mistakes instead of hiding them | M | reason (required) | FL-B/FL-F | every correction append-only + documented; one-level reversals; unsaved-changes guard on editors |
| S-18 | As any owner, I want the app installed and working offline so that I can record without connectivity | M | PWA install | FL-I | prompt-based install (30-day dismissal); offline card; 54-entry precache; **device acceptance still open** |
| S-19 | As P1 (home business), I want to separate my own money from the business so that profit isn't overstated | M | owner investment/withdrawal | FL-F | `owner_investment_cash`/`owner_withdrawal_cash` never touch revenue/expense; X-05 unified withdrawal picks path by entitlement policy |
| S-20 | As any owner holding Amanah, I want held money visible but excluded from my wealth so that I don't spend what isn't mine | M | amanah events | FL-F | cash includes it; capital/revenue/profit exclude it; comprehension line in Finance; release button conditional |
| S-21 | As any owner, I want the period reading to include my direct sales so that "النتيجة" matches how I actually sell | O | direct-sale recognition policy | FL-F | **currently excluded (F-005)** — owner decision D-01 with options in §17.2 |
| S-22 | As any owner, I want my data to survive a browser wipe so that local-first doesn't mean fragile | F | persistent storage + export habit | FL-H | persist() requested at boot (honest 3-state copy in Settings); export reminder cadence = owner decision (O-001) |

### 5.2 Critical flows — complete field set (entry, intent, decisions, data, steps, review, confirmation, success, failure, retry, cancel, back, saving, offline, next action, exit) — CONFIRMED for current paths; RECOMMENDED DESIGN for target deltas

**FL-A — Quick sale (cash or credit) from anywhere.** Entry: FAB on any surface route. Intent: record what just happened. Decisions: full vs credit (X-06 toggle); cost known/unknown; wallet attribution optional. Data: amount (required); item name, customer name (required when credit), collected-now (< full), cost, wallet. Steps: FAB → sheet menu → «تسجيل بيع» → form → «سجّل البيع». Review: difference panel appears only in the full editor (sheet enforces collected < full for credit). Confirmation: idempotency key per sheet instance. Success: receipt mode with post-save recorded cash; «تم» closes. Failure: validation messages inline (Arabic, field-level); storage failure leaves the form filled. Retry: same key de-duplicates. Cancel: sheet close resets silently (nothing saved). Back: sheet is transient over the standing screen (no navigation). Saving: atomic single write (+ optional wallet allocation write). Offline: fully local. Next action: none offered (target: «سجّل بيعًا آخر» repeat action — RECOMMENDED DESIGN). Exit: «تم». Target deltas: quantity > 1 and product selection (§6, D-05); repeat-action CTA.

**FL-B — Order lifecycle (draft → cost → agreement → execution → delivery → collection).** Entry: FAB «طلب من عميل» or `/orders/new` chooser. Intent: run a custom job honestly. Decisions: specs; cost knowledge; price + deposit; start/ready/delivered; remaining = collect now vs register as debt; cancel (with deposit settlement: refund / retain / review). Data: item name + specs; snapshot (materials/time/packaging/delivery/waste/buffer); agreed price, date, deposit; collection amounts. Steps: DraftEditor → CostEditor («حفظ نسخة التكلفة» unlocks «تسجيل الاتفاق») → AgreementEditor → OrderDetail (status taps) → collection panel. Review: knowledge gating (profit null unless final; X-06 choices never auto). Confirmation: each transition is explicit; cancellations require a reason. Success: settled order with result card (or needs_review, honestly). Failure/retry: conflict guard (و۶) when two windows edit; idempotency keys per action. Cancel: order cancel with three-way deposit settlement. Back: deep flows hide nav; unsaved-changes guard fires on browser/system back. Saving: atomic per step (draft+order commit in one transaction). Offline: local. Next action: OrderDetail always shows the next CTA. Exit: back to «العمل». Confirmed asymmetry: nav stays visible here (U-005).

**FL-C — Wallets: opening, allocation, transfer, adjustment.** Entry: Finance actions layer / truth links; Home four-facts roads. Intent: make per-location cash real. Decisions: wallet kind; opening known/unknown/zero; allocate into wallet vs cover payment; transfer source/target. Data: name, kind, opening amount + status; direction, amount, note. Steps: CashWalletEditor → wallet list → distribute/transfer/adjust editors. Review: overview truth line ("هذه المحافظ تسجل فقط…"). Confirmation: guards (no overdraft, no overdraw, paired transfer legs). Success: balances update; entries append. Failure: honest Arabic storage failures; nothing half-written. Retry: operationKey idempotency. Cancel/back: deep editors with unsaved guard. Saving: atomic (transfer = one transaction, both legs). Offline: local. Next action: unallocated strip re-check. Exit: «محافظ الكاش». Gap: unknown stamp has no visible completion road (D-004 — target: wallet row → «سجّل رصيدًا موثقًا لاحقًا» using PA-007).

**FL-D — Till counting (reconciliation).** Entry: **single entry point** — Finance text link «عدّ الصندوق». Intent: make the drawer match the record. Decisions: wallet; counted amount. Data: counted physical cash. Steps: select wallet → count → «سجّل التسوية». Review: difference card explains direction with honest copy ("غالبًا قبضات ما انسجّلت…"). Confirmation: zero difference = no write at all. Success: in-place success card; **money text at correct scale (F-001 repaired)**; adjustment is future-effect-only. Failure/retry: operationKey per count. Cancel: back to `/cash`. Saving: one documented adjustment entry. Offline: local. Next action: «محافظ الكاش». Exit: back. Target: second entry from wallet row (RECOMMENDED DESIGN).

**FL-E — Cost estimation before commitment (My Tools).** Entry: nav seat «أدواتي». Intent: think before promising a price. Decisions: materials (each with confidence); time optional; buffer; quantity. Data: estimate inputs. Steps: calculator form → live preview («سعر الحماية للقطعة») → «احفظ التقدير لمراجعته لاحقًا». Review: knowledge states mirror the order snapshot model. Confirmation: saving never creates financial/inventory effects (domain-tested). Success: saved estimate listed. Failure: none (pure read). Retry: free. Cancel: page exit. Saving: own store (schema 29). Offline: local. Next action: **none — estimates are write-only (U-004)**; target: «ابدأ مسودة من هذا التقدير» (RECOMMENDED DESIGN, keeps estimate untouched). Exit: nav.

**FL-F — Financial review (cash now / period / corrections).** Entry: nav seat «مالي». Intent: know the truth of my money. Decisions: which layer to open; period range. Data: none (reads). Steps: decision card → 4 position cards → truth lines (amanah, unallocated) → collapsed layers (period reading, G5, actions, deposits, events). Review: exclusions surfaced («فتح مصدر الاستبعاد»); EventsLayer shows last 3 + reversal partners with full-effect toggle. Confirmation: reads only. Success: honest numbers incl. «غير متاح» for unknowns. Failure: invalid period range → status "invalid", result null. Retry: n/a. Cancel/back: surface. Saving: none. Offline: local. Next action: layer CTAs (11 actions behind a fold). Exit: nav. Gaps: period result excludes direct sales (F-005); no unified history (U-001); event edit/delete unreachable (D-005).

**FL-G — First launch (setup).** Entry: StartupGate (no profile → `/setup`). Intent: start. Decisions: name (required); wallet now or skip; opening known/unknown/zero. Data: as decided. Steps: 3 steps → save → Foundation → Home. Review: impact card + honesty lines. Confirmation: save with idempotency. Success: profile + optional wallet; foundation offered. Failure: honest save errors. Retry: safe. Cancel: n/a (first run). Back: step back. Saving: profile write (+ wallet write). Offline: local. Next action: Foundation or Home. Exit: «ادخل إلى مشروعي». Post-repair: skip path never asks-then-discards (F-002). Remaining: typed-name draft persistence (U-003).

**FL-H — Backup, restore, reset (Settings).** Entry: gear → Settings. Intent: protect or restart. Decisions: export now; import (preview → replace); reset (requires verified export + typed exact confirmation). Data: full snapshot file. Steps: «تصدير» → verified file; «استيراد» → preview → «استبدال البيانات المحلية»; «ابدأ من جديد» → export gate → typed «ابدأ من جديد» → danger button. Review: preview shows counts; reset warning panel. Confirmation: exact-match typing enables the destructive button; cancel always available («إلغاء — بياناتي تبقى»). Success: verified export (**now valid for all sale shapes — F-004 repaired**); atomic replace. Failure: corrupt/partial files never touch current data. Retry: safe. Back: sections. Saving: atomic transactions. Offline: local. Next action: persistence truth row. Exit: gear. Remaining: export reminder cadence (O-001, D-11).

**FL-I — Install & offline (PWA).** Entry: install card (beforeinstallprompt; 30-day dismissal persisted); runtime notice cards. Intent: own the app; keep working offline. Decisions: install now/later; update now/later (consent). Data: none. Steps: card → browser prompt / manual iOS instructions. Review: honest offline copy ("لا توجد مزامنة أو نسخة سحابية"). Success: standalone launch; offline card when disconnected. Failure: SW registration failure falls back gracefully with Arabic copy. Offline: by design. Exit: n/a. Gap: viewport-fit=cover missing → safe-area insets inert in browser tabs (P-004); device acceptance open.

**FL-J — Party ledger (دفتر الناس).** Entry: Finance truth link; Tools module row; Home away card (conditional). Intent: who owes me / whom do I owe. Decisions: search; which party to open. Data: none (read model). Steps: totals → search → party details → movement row → source screen. Review: footer truth ("قراءة مجمّعة… ما يُسجَّل منه شيء جديد"). Success: per-party receivable/payable with movement trail. Failure: none. Retry: n/a. Back: `/finance`. Saving: none. Offline: local. Next action: movement href (order/sale/purchase). Exit: back. Post-repair: credit-sale parties now structured names (D-001). Remaining: no per-party collection shortcut (D-003).

---

## 6. Products & Sales Gap Analysis

### 6.1 What the code says a "product" is today — CONFIRMED FROM CURRENT MAIN

A `CatalogItem` (`src/domain/catalog/types.ts:7-19`) is: `id`, `kind ("product"|"service")`, `name`, `unitLabel` (legacy free text), `unitId` (optional organized unit), `active`, timestamps, `createdOperationKey`. **It carries no unit cost, no default selling price, and no stock/quantity.** Organized units, exact-rational conversions, and component templates with yield exist as *planning references* — "القالب للتذكر والتخطيط فقط. لا يسجب مخزونًا ولا يغيّر تكلفة قديمة" (`Catalog.tsx:1013`). The service offers create/deactivate only — **no rename/edit of items exists at all**, which makes "product changes alter historical sales" impossible by construction.

### 6.2 The five gap questions answered from code

| Question | Answer (evidence) |
|---|---|
| Can a sale select an existing item? | Yes — `catalogItemId` optional binding on `DirectSale` and drafts; dropdown in `DirectSaleEditor.tsx:363-376`; quick sheet has no binding |
| Does selection autofill anything? | **No.** The `onChange` only stores the id; no service reads the catalog on the sale path; copy admits it ("الربط لا يغيّر السعر ولا يفرض الكتالوج") |
| Is quantity captured? | Plain positive integer, unitless, on the full editor; **hard-coded 1** in the quick sheet |
| Unit cost vs selling price distinguished? | Yes — `costMinor: null` (unknown → profit null, never zero) vs `revenueMinor` actual agreed total; price floor concept exists in snapshots/estimates |
| Does a sale change inventory? | **No.** Consumption requires an `orderId`; no sale context exists; the only movement writers are manual editors; delivering an order consumes nothing automatically |
| Insufficient quantity handling? | N/A — no stock binding anywhere (inventory is a separately managed, dated-activation material ledger) |
| Do product changes alter history? | Impossible today (no edit operation; deactivation only removes from new-selection) |
| Is the cost calculator independent? | Fully — "a thinking tool before any commitment. Saving an estimate never creates a financial event, an inventory movement, or an order" (service header), domain-tested |
| Catalog margins analytics? | `readRecordedMargins` derives margins from **final orders'** bindings only; direct-sale bindings feed nothing |
| MVP classification of selection | Important optional, currently reference-only (owner decision D-05) |

### 6.3 The expectation gap — INFERRED + RESEARCH HYPOTHESIS

P3's mental model ("أختار المنتج فيتعبّى السعر والكمية") is unmet by design. The system's contract is honest and stated in UI copy, but honesty alone does not close a *reasonable* expectation; it only documents its absence. The persona-level cost is speed (typing name + price every sale) and analytics (per-item reading exists only for order-based work). The gap is a **product decision**, not a defect.

### 6.4 Product-model options (owner decision D-05; each fully specified)

**Option A — Reference + defaults (recommended).**
- *User behavior:* selecting a catalog item in the sale/draft form prefills *proposals*: item name, a default selling price (if set), an optional unit cost (if set), and the item's unit label next to quantity; everything stays editable; the actual entered price is always authoritative and is what gets saved.
- *Data model:* add optional `defaultPriceMinor: number | null` and `unitCostMinor: number | null` (+ optional `unitId` display) to `CatalogItem`; no stock fields; optional JSON fields, no store/index change (same pattern as `customerName`).
- *Financial implications:* defaults are proposals, never amounts; revenue/cost saved per sale remain the owner's actuals; margins stay honest; no COGS effect (COGS remains evidenced consumption).
- *Historical implications:* defaults are snapshot-at-sale-time by construction (values copied into the sale record at save); later default changes never rewrite past sales — same guarantee the system already gives prices.
- *Inventory implications:* none (decoupled; inventory stays a dated, evidenced, manual ledger).
- *UX implications:* +1–2 fields in catalog editor; sale form gains an item picker row; quick sheet optionally gains a "من منتجاتي" chip row; copy must keep the "السعر الفعلي هو المعتمد" line.
- *Risks:* defaults silently becoming *expected* prices (mitigate: label "مقترح"); stale defaults (mitigate: show last-updated date); density (+2 strings in DirectSaleEditor — cap ratchet decision).
- *Acceptance criteria:* selecting an item prefills name/price/cost/unit as proposals; editing any proposal is free; saved sale stores actuals + binding; changing a default later leaves all past sales byte-identical; margins read-model gains a direct-sales source once D-01 is decided; unit tests lock "defaults never auto-write".

**Option B — Full product-led selling (heavy).**
- *User behavior:* sale starts by picking a product; price/cost/unit/stock come from the item; optional per-item stock decrement on sale; insufficient-quantity warning.
- *Data model:* `CatalogItem` + price/cost + `stockMilli` + sale→stock coupling; new movement context for sales; schema bump; migration.
- *Financial implications:* still safe if decrements are recorded as movements (not silent), but couples cash records to reference data and invites "system says I have 3 but I count 5" reconciliation burden on a micro owner.
- *Historical implications:* safe by the same snapshot discipline, but every coupling multiplies correction paths (cancel a sale → restore stock? price cut → partial restore?).
- *Inventory implications:* duplicates the evidenced-consumption model with a second, weaker path; contradicts the repo's closed owner decision (inventory activation dated today; consumption evidenced; sale-driven decrement explicitly out).
- *UX implications:* bigger forms; more states; more warnings.
- *Risks:* model conflict with the existing inventory philosophy; correction complexity; owner confusion between "reference" and "truth".
- *Acceptance criteria:* (only if owner overrides the closed decision) full documented contract for decrement/reversal semantics, insufficiency handling, and per-item activation.
- *Verdict:* **not recommended now** — it re-litigates a closed, defensible decision and adds reconciliation load to the exact person least able to absorb it.

**Option C — Pure UX bridge (lightest).**
- *User behavior:* sale form gains a "آخر ما بعته" quick-name chip row (recent item names + last actual price as a *hint only*); no catalog changes at all.
- *Data model:* none (reads recent sales).
- *Financial/Historical/Inventory implications:* none.
- *UX implications:* +1 row; solves typing, not price memory.
- *Risks:* minimal; recent names may drift from catalog names.
- *Acceptance criteria:* chips insert text only; no persistence changes.
- *Verdict:* viable as a standalone interim step if the owner defers D-05.

**Recommendation (labeled, not an owner-approved decision): Option A**, because it buys P3's speed and analytics expectations without touching the system's three load-bearing guarantees (actual price authoritative; history immutable; inventory evidenced). If the owner wants zero schema-adjacent change this cycle, do C now and A later. B is not recommended.

### 6.5 Related confirmed findings feeding this decision

- **Direct-sale revenue is excluded from the period result** (`readRecordedPeriodResult` reads orders/events/movements only — §17.2, F-005). Any product analytics built on sales needs D-01 resolved first, otherwise "margins" will read as zero for cash-heavy sellers.
- **Quick sheet hard-codes quantity 1** (`QuickActionSheet.tsx` — `quantity: 1`): the two sale surfaces disagree about what "a sale" is (full editor has quantity; sheet doesn't).
- **Estimates are write-only (U-004):** the "استخدم هذا التقدير في مسودة" bridge does not exist at `f7c1430`; the closest analogues are the order's own price-floor button and the FAB "مسودة تصميم" route. The estimator persona's loop is broken at its most valuable step.
- **Direct-sale bindings feed nothing** (no display, no analytics, type-only export validation) while order bindings feed margins — an asymmetry that Option A would naturally resolve by making both bindings useful.

---

## 7. Target Onboarding

### 7.1 What the owner must / may not know before starting — CONFIRMED + INFERRED

Must know: nothing technical. May not know: opening balance (explicitly supported), costs (explicitly supported), whether they need wallets/modules (explicitly optional). The current setup asks exactly three decisions with one required field — this is already the Stage-A minimum. What is missing is (a) a *later* road for the unknown opening (D-004), (b) an explicit module-choice moment (Stage B) beyond Foundation's links, and (c) draft persistence across interruption (U-003).

### 7.2 Target onboarding — RECOMMENDED DESIGN (screens, decisions, states, skip, back, validation, empty states, conversion)

**Stage A — minimum financial core (current, repaired; keep).**
1. `/setup` step 1: project name (only required input). Validation: non-empty; error «حط اسم لمشروعك أولًا».
2. Step 2: default wallet «الدرج» — edit, keep, or **skip** (skip = wallet + opening recorded later from «مالي»; button copy already says exactly this; F-002 repair guarantees no discarded questions).
3. Step 3 (only when wallet kept): opening position — known (number) / unknown («ما بعرف الآن — يُحدَّد لاحقًا») / zero (documented). Unknown never renders as zero, anywhere.
4. Save → `/foundation`. **Target delta:** persist name/wallet drafts locally (non-financial preference surface — U-003) so interruption loses nothing; on restore, land on the exact step with values intact.
5. Conversion moment: Foundation's exit is «ادخل إلى مشروعي» → Home → the very first FAB sale ends in a receipt. **Target delta (recommended):** after setup, Home's first-visit state shows one primary card «سجّل أول بيع الآن» (the H1 activation hypothesis) with the FAB highlighted — no tour, no coach marks.

**Stage B — optional customization, later, never blocking (Foundation evolved).**
- Where: `/foundation`, permanently reachable (Home finance-unit link). Already foldable `<details>` sections: cash, owner capital, standing debts, materials, import-from-file. **Target delta (recommended):** each section gains the three owner-language choices mapped to the existing module-state model — «استخدمه الآن» (→ immediate create flow), «قد أحتاجه لاحقًا» (→ module stays available-not-enabled, surfaces in Tools), «لا أحتاجه» (→ hides from Home's optional modules; Tools still lists it as stopped — the unused «متوقف مؤقتًا» state finally gets a real producer, resolving D-006 partially).
- Skip/back: any order; no gating; every section independently skippable; back returns to Home.
- Validation: only per-item forms (existing editors).
- Empty states: each section's empty state is a one-line honest explanation + one action (current pattern, keep).
- Interruption recovery: Foundation is stateless by design (each action is an independent flow) — keep.

**Unknown-opening completion road (closes D-004 with PA-007).**
- Where: wallet row in `/cash` for wallets with unknown opening. Action: «سجّل رصيدًا موثقًا لاحقًا» → later-dated documented opening (occurredOn = the count's real date, recordedAt = now, reason required) → unknown stamp lifts, history untouched. Entry points: Home four-facts road, Finance wallet road. This converts a permanent silent gap into a first-class honest loop.

### 7.3 Conversion definition — INFERRED + RECOMMENDED DESIGN

Conversion = first receipt within the first session (activation, not subscription). Success metric for the target state: ≥ 80% of simulated first sessions (§9.3 scenarios S-01/S-04) reach a receipt without assistance, in under 60 seconds from app open. The funnel today is already short (setup → foundation → home → FAB); the two leak points are Foundation's text density (mitigated by Stage B choices) and the sheet's dead-end receipt (add «سجّل بيعًا آخر»).

---

## 8. Information Architecture, Navigation, Screens & Wireframes

### 8.1 Current navigation evaluation — CONFIRMED

Strengths: a stable 4-seat + FAB model that matches the owner's top intents (now / work / money / tools); transient actions live in a sheet over the standing screen; deep flows hide chrome; keyboard hides chrome; `/review` redirect removed a redundant destination. Weaknesses: every capability beyond the four seats is a text link or a collapsed-layer action (§8.4); the fifth seat is a declared vacancy; OrderDetail vs DirectSaleEditor nav treatment is asymmetric (U-005); the `/orders/new` chooser duplicates FAB intents and is itself classified deep (F-003).

### 8.2 Target IA by owner intent — RECOMMENDED DESIGN

Top level stays 4 seats + FAB (no fifth seat without the owner's explicit decision — D-07). Organize *inside* seats by repeated intent:
- **مشروعي الآن (Home):** now (today + away + what changed), truth facts, roads to everything not in the bar (keep; add first-visit activation card).
- **العمل (Orders):** sales, orders, drafts, schedules preview (keep; unify sale detail nav treatment with order detail — both surface).
- **مالي (Finance):** cash decision → position → truth → layers (keep; lift «الموردون» and «دفتر الناس» out of the collapsed action layer into the truth-line row where parties/cash-count already live — they are reading intents, not recording intents).
- **أدواتي (Tools):** estimation + module states (keep; make module states data-derived, D-006).
- **الإعدادات:** data protection, operating preferences, appearance, import/restore (keep).

### 8.3 Screen responsibilities — current + target contracts for the key screens

Each contract: goal / entry / exit / primary action / secondary actions / above-the-fold / states / validation / back / success / failure / next.

**Home.** Goal: "what needs me now + what's true". Entry: nav seat, install/open. Exit: any seat. Primary: none global (today-section rows are the primaries). Secondary: four-facts roads, optional-module links, foundation link, away-card actions. Above fold: activity name, today section, away card (conditional), four facts. States: first-visit (target activation card), regular, 7-day-away, empty-data. Validation: n/a. Back: n/a. Success: n/a. Failure: storage error state. Next: FAB. *Target deltas: activation card; away digest (U-002); module-state-driven optional links (D-006).*

**Finance.** Goal: "what do I do with cash now, and what is true". Entry: nav. Exit: nav/back. Primary: «أعلن تحصيلًا أو التزامًا قريبًا» (G5). Secondary: unallocated distribute, source-of-difference review, owner ledger, 11-action layer, parties/count links. Above fold: decision card (4 metrics), 4 position cards, truth lines (amanah, unallocated, wallets, parties/count links). States: all-known, unallocated-negative (with cause + review CTA), amanah-held (comprehension line + conditional release), empty (wallet road). Validation: period range. Back: Home. Success: reads. Failure: invalid-range status. Next: layer CTAs. *Target deltas: D-005 (event edit/delete surfaces in the events layer), F-005 resolution changes the period layer's meaning, U-001 (history layer).*

**Tools (My Tools).** Goal: "calculate before committing + know my modules' states". Entry: nav. Exit: nav. Primary: «احفظ التقدير». Secondary: saved-estimates list (delete only today; target: start-draft action), module-state rows. Above fold: calculator entry, rule card, saved estimates. States: empty estimates, partial knowledge (price floor hidden), module rows (data-derived target). Validation: live. Back: n/a. Success: save + list refresh. Failure: n/a. Next: (target) «ابدأ مسودة من هذا التقدير». *Target deltas: U-004 reuse bridge; D-006 data-derived states.*

**Parties (دفتر الناس).** Goal: "who owes whom, with a trail". Entry: Finance link / Tools row / Home away card. Exit: back. Primary: search. Secondary: party details, movement rows → sources. Above fold: totals, search. States: empty, populated, single-party. Validation: n/a. Back: `/finance`. Success: n/a. Failure: n/a. Next: movement href. *Target deltas: D-003 per-party collection shortcuts (navigation only, no writes from the read model).*

**Orders (العمل).** Goal: "run today's work". Entry: nav. Exit: nav. Primary: DecisionPanel priority + orders. Secondary: sales list, drafts, schedules preview, new draft. Above fold: priority panel, sales list. States: empty (points to FAB), populated. Validation: n/a. Back: n/a. Success: n/a. Failure: n/a. Next: rows. *Target deltas: unify sale-detail nav (U-005); retire or redirect the `/orders/new` chooser (F-003).*

**DirectSaleEditor.** Goal: "record or correct one sale honestly". Entry: sales list / sheet correction path. Exit: back to العمل. Primary: save (with X-06 difference panel when partial). Secondary: price cut / debt / review choices; cancel (documented); reference binding; customer field (shown when debt or existing customer). Above fold: form fields. States: create, edit, cancelled (locked), conflict (و۶). Validation: amount required; collected ≤ agreed; reason required on cancel. Back: unsaved guard. Success: navigate to العمل. Failure: field-level Arabic errors. Next: (target) «سجّل بيعًا آخر». *Post-Phase-1: customer structured (D-001). Target: Option A autofill proposals (D-05).*

**CashCount.** Goal: "make the drawer match the record". Entry: Finance link (target: + wallet row). Exit: back. Primary: «سجّل التسوية». Above fold: wallet select, counted input, difference card. States: no wallets, matching (no write), over, under. Validation: non-negative integer money. Back: `/cash`. Success: in-place card (scale-correct text — F-001 repaired). Failure: storage error, form intact. Next: «محافظ الكاش». *Target: second entry point; weekly cadence reminder (D-11).*

**CashWallets.** Goal: "per-location cash truth". Entry: Finance. Exit: back. Primary: «محفظة ورصيد بداية». Secondary: transfer (≥2 wallets), adjust per row, entry log (last 8) with reversals. Above fold: decision card, facts, primary. States: empty, single, multi. Validation: editors'. Back: `/finance`. Success: balance updates. Failure: honest errors. Next: row CTAs. *Target: D-004 unknown-opening road on unknown rows.*

**Settings.** Goal: "protect data, shape daily work". Entry: gear. Exit: gear. Primary: export. Secondary: import (preview), reset (gated), operating preferences, appearance. Above fold: local-data warning, data section. States: default, import-preview, reset-gate (typing exact match). Validation: reset typing; import file structure. Back: sections. Success: verified file / atomic replace. Failure: corrupt file never touches data. Next: persistence row. *Target: export reminder cadence (D-11/O-001).*

**Foundation.** Goal: "optional depth, on my terms". Entry: post-setup / Home link. Exit: skip-or-enter (both to Home). Primary: section actions. Above fold: cash + owner capital (open), rest collapsed. States: per-section empty. *Target: Stage B choices (§7.2).*

**Setup.** Goal: "minimum honest start". (Contract in FL-G.) *Post-Phase-1: skip path honest (F-002). Target: draft persistence (U-003).*

### 8.4 Discoverability audit (confirmed) — where non-seat capabilities actually live

| Capability | Reachable only via |
|---|---|
| Suppliers | Finance actions layer (collapsed, 2 taps deep) · Tools module row · Foundation (editor alias) |
| Inventory | Finance actions layer (collapsed) · Tools row · OrderDetail material panel · Foundation |
| Schedules | Home optional modules (conditional) · Orders text link · Tools row |
| Catalog | Home block primary · Tools row · DraftEditor secondary |
| Parties | Finance truth-line link · Home away card (conditional ≥7d + overdue) · Tools row |
| Till counting | **single entry**: Finance text link |
| Cash wallets | Finance actions layer (collapsed) + conditional difference CTA |
| Foundation | Home finance-unit text link + setup completion |
| Estimates | nav seat (only audited capability with a seat) |

### 8.5 Low-fidelity textual wireframes — RECOMMENDED DESIGN (deltas over current; "—" = unchanged)

**Home (first visit) — delta**
```
[مشروعي الآن]
  (NEW) بطاقة تفعيل واحدة: «سجّل أول بيع الآن — الفلوس بدها دقيقة»
        [زر أساسي: افتح ورقة التسجيل]  ← FAB highlighted
  اليوم: … —
  أثناء غيابك: … — (delta: ملخص ما تغيّر: مبيعات/مصاريف/طلبات منذ آخر نشاط — U-002)
  ما هو مسجل حتى الآن؟: … —
  وحدات عند الحاجة: (delta: rows driven by real module states — D-006)
```

**Finance truth-line row — delta (promote reading intents out of the collapsed layer)**
```
ما نعرفه الآن
  أمانات بحوزتك (د.أ): … —
  كاش غير موزع: … —
  محفظة: … —
  (PROMOTED) دفتر الناس — مين عليه إلَي وعليّ لمين          [افتح]
  (PROMOTED) عدّ الصندوق — طابق الدرج مع السجل              [افتح]
  (NEW)     الموردون والمشتريات — قراءة الذمم والدفعات       [افتح]   ← reading entry; recording stays in layer
```

**Tools — saved estimates row — delta (U-004)**
```
تقديراتي المحفوظة
  ▸ تقدير كيكة شوكولاتا · سعر الحماية 12.50 د.أ · 2026-08-30
        (NEW) [ابدأ مسودة من هذا التقدير]  [حذف]
  …
حالة الوحدات (delta: data-derived — دفتر الناس: مفعّل (لديك ٣ أطراف وأرصدة) لا «متاح غير مفعّل»)
```

**CashWallets — unknown-opening road — delta (D-004)**
```
محافظ الكاش
  ▸ الدرج — المسجل 250.00 د.أ · الحالة: رصيد غير محدد
        (NEW) [سجّل رصيدًا موثقًا لاحقًا] ← PA-007: later-dated documented opening
  ▸ البنك — … —
```

**DirectSaleEditor — product selection (Option A) — delta (D-05)**
```
ما الذي بعته؟
  (NEW) أقترح من «منتجاتي وخدماتي»: [كوب قهوة ٢.٥٠ ▾]      ← proposal chips/select
  السعر المتفق عليه: [2.50]  (NEW small: مقترح من المرجع — السعر الفعلي هو المعتمد)
  …remaining fields —
```

**Quick sheet receipt — delta**
```
وصل التسجيل
  سُجّل بيع 12.50 د.أ — الكاش المسجل الآن 262.50 د.أ.
  (NEW) [سجّل بيعًا آخر]   [تم]
```

**Events layer (Finance) — delta (D-005 + U-001)**
```
السجل والأثر — آخر ثلاثة أحداث
  ▸ حدث 2026-08-30 · مصروف نقدي · 5.00 د.أ · [عرض الأثر الكامل]
        (delta) [صحّح] ← opens edit/reverse choice: تعديل القيم (reversal+replacement) أو تراجع فقط أو (delta) حذف موثق
  (NEW) [افتح السجل الكامل — كل التصحيحات وأسبابها]  ← U-001 unified history surface
```

---

## 9. Mobile UX, Density & Usability Plan

### 9.1 Mobile UX evidence — CONFIRMED (strengths) + gaps

**Strengths.** Phone-first with 4px spacing rhythm, 12/16/20px radii, IBM Plex Sans Arabic + mono numerics with `tabular-nums`; touch targets 44–64px everywhere except two quiet-action classes (32/28px); logical CSS properties throughout (direction-agnostic); numbers isolated LTR inside RTL at 24 sites with `unicode-bidi: isolate`; keyboard hides header+nav via `visualViewport` heuristic; unsaved-changes guard with popstate sentinel, focus trap, escape-as-stay, focus return; focus-visible rings; reduced-motion global kill; hover gated behind `(hover: hover) and (pointer: fine)`; dark theme as a full second token set; z-index ladder (0/1/20/30/40/50/60/70) enforced by a build guard; PWA prompt-based install with 30-day dismissal persisted, update consent card, offline card; persistent-storage request at boot with honest 3-state copy.

**Gaps — CONFIRMED.**
- **P-004:** no `viewport-fit=cover` → all 14 `env(safe-area-inset-*)` calculations are inert in normal browser tabs (standalone behavior varies by OS; iOS notch requires the opt-in); no landscape CSS at all (manifest locks portrait; landscape phones stretch the portrait column); large screens get only a centered 640px column — no tablet/desktop layout.
- **Body text skews small:** 12px (×108 uses) and 13px (×75) dominate, with 11px labels ×35 — deliberate density philosophy, but a readability consideration for tired eyes at the drawer.
- **U-005:** sale detail hides nav; order detail keeps it.
- **Dead Toaster (Q-003):** mounted sonner, zero `toast()` calls — either remove or use for transient confirmations.

### 9.2 Density — CONFIRMED + INFERRED

The §10.1 guard measures *whole-screen distinct at-rest strings* with per-screen ratchets: Home 29, Finance 122, OrderDetail 127, Orders 73, CashWallets 67, Schedule 98, Catalog 84, DirectSaleEditor 43 (raised +1 in Phase 1, documented), others 30 default. The design doc's aspiration (Home 15 / any 30) is openly acknowledged as not met — the ratchet locks current reality and requires an owner decision record to rise. **Judgment (INFERRED):** the *policy* is sound (task density allowed on detail/period surfaces; first-use surfaces capped; collapsed `<details>` content excluded from at-rest counts; moment-of-action strings excluded). The *absolute numbers* on Finance/OrderDetail mean first-visit comprehension will center on the top cards only — acceptable under H5 only because layers are re-reachable by intent. The risk is not the counts; it is that the *cap table itself* drifts from the philosophy as it ratchets upward (Y-001 carried). Recommendation: an explicit density decision record per raise (already script-enforced practice — keep), plus a periodic reading pass over the two 100+ screens.

### 9.3 Usability-testing plan — RESEARCH HYPOTHESIS / SIMULATION (12 scenarios; simulated users are not real users)

| # | Scenario (task) | Persona | Measures | Pass criteria |
|---|---|---|---|---|
| S-01 | First open → setup → skip wallet → first sale receipt | P5/P8 | completion unassisted; time-to-receipt; errors | ≤ 60s to receipt; zero discarded answers; 80% unassisted |
| S-02 | Setup with known opening 250.00; verify never rendered as zero or unknown | P2 | correctness of states | 100% correct state recognition |
| S-03 | Credit sale 15.00, collected 10.00, customer «خالد» → find the debt in دفتر الناس | P3 | task time; search behavior | debt under «خالد» exactly; ≤ 45s; finds ledger unaided or via one hint |
| S-04 | Count the drawer: physical 240.00 vs recorded 250.00 → settle; read back the note | P2 | comprehension of future-effect; trust wording | note says 240.00 د.أ; explains "no old number changed"; 80% correct recall |
| S-05 | Expense 7.50 paid now from a specific wallet | any | attribution understanding | allocation explicit; total cash math correct |
| S-06 | Create estimate (2 materials + time + buffer) → save → (target) start draft from it | P7 | loop completion | estimate saved with zero financial effects; (target) draft created from it |
| S-07 | Order: draft → cost → agreement 50.00 + deposit 20.00 → deliver → collect 30.00 | P4 | steps; truth questions | cash +50 net; profit only at final; deposit never called profit |
| S-08 | Correct a recorded expense (wrong amount) via the events layer | any | correction confidence; reason given | reversal+replacement understood; reason entered; no fear language |
| S-09 | Cancel a credit sale with outstanding debt; observe what happens to the ledger | P3/P4 | model comprehension | debt removed with documentation; sale stays visible as cancelled |
| S-10 | Produce a verified backup with a credit sale and a price-cut sale present; then import to a fresh profile | any | backup trust | export verified; round-trip equal; (regression guard for F-004) |
| S-11 | Find: suppliers, inventory, schedules, catalog, parties, till counting — unaided | any | discoverability time | each ≤ 30s via any path; note path chosen (audit §8.4) |
| S-12 | Offline: airplane mode → record 2 sales → reopen app offline → data intact | any | offline trust | zero data loss; offline card seen; no sync complaints |

Moderation notes: run on a real Android and an iOS device (the repo's own open gates), portrait, first session recording + think-aloud; comprehension probes after each task; confidence Likert before/after; error-recovery observed silently. Success bar for the target state: ≥ 80% unassisted per scenario.

---

## 10. Product Strategy, MVP, Conversion, Retention, SaaS Readiness

### 10.1 MVP classification — CONFIRMED (current behavior) + judgment labels

- **MVP core (visible first, honest):** quick sale/expense; wallets + opening honesty; till counting; order lifecycle; party ledger (read); position truth (cash/amanah/receivables/payables/owner); verified export/import/reset; unsaved-changes guard; unknown ≠ zero everywhere.
- **Important optional:** catalog reference + binding; schedules; suppliers/purchases; inventory (dated activation); G5 declarations; owner entitlement; multi-wallet allocation; period reading; saved estimates.
- **Analytical tools:** cost calculator (Tools); margins/break-even/liquidity readings; catalog margins.
- **Future:** cloud sync (foundations already sync-friendly: idempotency keys, append-only, ports), multi-device, shared-device privacy, Activity Profiles, Market/Delivery (documented contracts only).
- **Misplaced/unclear (judgment):** nothing is *misplaced*; the unclear items are the *dead surfaces* (D-004/D-005, Q-003) — capabilities whose domain half exists without a UI half, which read as unfinished promises rather than scope errors.

### 10.2 Conversion — INFERRED + RECOMMENDED DESIGN

Defined as activation (first receipt), §7.3. The current funnel is minimal; the leaks are Foundation density and the receipt dead-end. The two target deltas (activation card; «سجّل بيعًا آخر») are the highest-leverage, lowest-risk conversion moves. No onboarding tour, no forced module choices — the product's restraint is an asset; conversion should come from the first receipt's *content* (cash total + correction safety line).

### 10.3 Retention — INFERRED + RESEARCH HYPOTHESIS

Daily return is driven by recording friction (solved), reconciliation trust (F-001 repaired; count flow first-class), and debt visibility (ledger + away card). Weekly return is driven by the away card (thin today — U-002 digest) and backup habit (reminder cadence = owner decision D-11). Abandonment risks: silent drift between drawer and record (mitigate: weekly count nudge), fear of correction (H2 — mitigate: correction-safety copy + unified history), and the F-005 confusion for cash-heavy sellers (period reading contradicting cash reality). Trust restoration after errors: documented reversal visibility + honest failure messages are already strong; the unified history surface (U-001) completes the loop.

### 10.4 Future SaaS/cloud readiness — CONFIRMED (absence) + RECOMMENDED DESIGN (future)

No sync, no multi-user, no accounts — correct for this stage. The architecture is already sync-friendly: `PrototypeLocalStore` port (swap/extend the adapter), idempotency keys on every write (safe replay), append-only corrections (conflict-free merging of *new* records), verified export (backup contract), and a single-owner model (no sharing semantics to design). Before any sync work: resolve D-01 (sale recognition), D-02 (party identity is now structured — Phase 1), and run the field validation wave (§20 W4). Recommended future order: device-pair export/import → cloud mirror of the verified-export format → live sync.

---

## 11. Financial Integrity Analysis

### 11.1 The distinctions, verified in code — CONFIRMED

| Distinction | Verdict | Key evidence |
|---|---|---|
| Cash vs revenue | Holds | revenue lives only in order/sale records; events carry no revenue dimension; collections are cash-only |
| Revenue vs profit | Holds | profit null unless final + full cost knowledge; «التحصيل ليس ربحًا» in editors |
| Receivables vs cash | Holds | `partial_debt` only (owner-decided) enters receivables; needs_review stays out |
| Payables vs expenses | Holds | payable settlement «لا يسجل المصروف مرة ثانية»; payables dimension separate |
| Owner money vs business money | Holds | investment/withdrawal touch capital, never revenue/expense; X-05 unified path by entitlement policy |
| Amanah vs business cash | Holds (with F-006 gap) | cash+, never revenue/capital/profit; comprehension line; conditional release |
| Estimated cost vs actual cost | Holds | snapshot knowledge states; floor ≠ price; margins from recorded readings only |
| Default price vs actual selling price | Holds today (no defaults exist) | Option A must preserve "actual entered price authoritative" |
| Confirmed transaction vs analytical estimate | Holds | G5 declarations non-cash; estimates non-financial (domain-tested) |
| Inventory reference vs movement | Holds | catalog/templates reference-only; movements evidenced, dated activation |
| Current data vs historical data | Holds | append-only + one-level reversals everywhere; no record ever rewritten |
| Unknown vs zero | Holds (10 sites) | §17 enumeration; «غير متاح»/«—» renderings; regression-tested |

### 11.2 Integrity gaps found in Phase 2 (open)

- **F-005 — Direct-sale revenue excluded from the period result.** CONFIRMED: `readRecordedPeriodResult` recognizes only final orders (delivered in-period, resultStatus final); direct sales feed position cash/receivables only, and direct-sale `costMinor` never enters COGS. For a cash-heavy owner, «نتيجة الفترة» shows zero revenue while cash grows — a correct-by-construction reading that is misleading-by-reading. **This is an owner decision with options** (§21 D-01): (a) recognize direct sales at sale date (`occurredOn`), cancelled excluded, cost optional → consistent with order recognition; (b) cash-basis recognition at collection; (c) keep exclusion but add an explicit «هذه القراءة للطلبات فقط — بيعك المباشر غير داخل» line + a separate direct-sales period summary. **Recommendation: (a)** — it matches the product's own definition of revenue (agreed price at the honest moment), keeps cancelled sales out, and makes the analytics in §6 coherent. Financial semantics of (a): recognizedRevenue += Σ active sales' revenueMinor in period; effective cost: either costMinor (known) or excluded with a needs-review count (unknown cost stays unknown — never zero).
- **F-006 — Amanah release unguarded.** CONFIRMED: nothing validates `amanah_released_cash` ≤ current held balance; a typo can drive `amanahHeldMinor` negative. Defect-class (fix candidate, small): guard in `record()` like the payable-settlement cap, with an honest error. No owner decision needed on *whether* (only scheduling — recommend W1).
- **D-005 — Event corrections half-unreachable.** `editEvent` (atomic reversal+replacement), `deleteEvent`, `restoreEvent` exist with guards and tests but no UI; only `reverse` is exposed. The owner's real-world correction ("دخلت 5 بدل 4") currently requires reverse + manual re-entry. Fix candidate: an edit path in EventsLayer (owner timing decision; recommend W2).
- **D-004 — Unknown opening without a road** (§7.2): domain promise (`recordOpeningBalanceLater`, PA-007) with no UI. Fix candidate W1/W2.
- **C-001 carried** — quick-expense knowledge "known" default (acceptable trade-off, revisit with field evidence).

### 11.3 Amanah semantics — end-to-end verification — CONFIRMED

Held: `[+cash, 0, 0, 0, +amanah]`; released: `[−cash, 0, 0, 0, −amanah]`; both reversible, never carry expense context; holdings surface in Finance only when > 0 with the comprehension line; release button conditional. Legacy pre-field records read as zero (documented schema evolution). The one gap is F-006 above.

---

## 12. Problem Register

IDs are stable and carried from the prior audit where applicable. Every entry below follows the 16-field quality standard (Problem / Evidence / Classification / User scenario / Journey location / Current flow / Target flow / Screens / IA / Navigation / Data behavior / Financial effect / Alternatives / Recommendation / Risks / Acceptance criteria / Priority). Severity reflects impact on owner trust and money truth.

### 12.1 Resolved in Phase 1 (verified at `f7c1430`) — summary

| ID | Problem | Resolution (evidence) | Status |
|---|---|---|---|
| F-001 | Till-count money text at wrong scale (10×) + raw minor units in reason | `presentation/cashCountMessages.ts` + 3 regression tests; CashCount uses builders | **RESOLVED** |
| F-002 | Setup asked opening question then discarded the answer on wallet skip | Skip saves directly; both paths UI-tested | **RESOLVED** |
| D-001 | Credit-party identity extracted from note text | Structured `customerName` end-to-end; ledger prefers field; legacy fallback strips descriptor; records untouched | **RESOLVED** |
| F-004 | Verified export rejected partial-collection and price-cut sales → no backup possible, reset gate blocked | Guard widened to domain-legal shapes; 2 round-trip tests | **RESOLVED** (discovered in Phase 1) |
| Q-001 | Stale `current-state.md` + `ARCHITECTURE.md` | Both updated to schema 29/export 21 reality + Phase-1 section | **RESOLVED** |
| Q-002 | Telemetry-style artifacts in production public assets | Moved to `dev-tools/` served dev-only; `version.json` removed; dist verified clean | **RESOLVED** |

### 12.2 Open register — full 16-field entries

**F-005 — Direct-sale revenue excluded from the period result.** Priority: Critical (owner decision).
Problem: «نتيجة الفترة» recognizes final orders only; direct sales (the most common micro pattern) contribute zero revenue and zero cost, so cash-heavy owners read a false "no result". Evidence: `projectFinancialService.readRecordedPeriodResult` (orders/events/movements only); direct sales appear solely in `readPosition`. Classification: CONFIRMED (behavior) + OWNER DECISION REQUIRED (policy). User scenario: P3 records 40 direct sales in August; Finance period layer shows revenue 0 while cash grew 400. Journey location: stage 7 (financial review). Current flow: Finance → قراءة الفترة → zero revenue. Target flow: recognition policy applied + explicit scope line naming what's included. Screens: Finance period layer. IA: period layer gains a direct-sales line + scope note. Navigation: unchanged. Data behavior: read-model only (no record changes; recognition derived). Financial effect: revenue/cost recognition policy — the biggest semantics decision open. Alternatives: (a) recognize at sale date (recommended); (b) cash-basis at collection; (c) exclusion + explicit scope line + separate summary. Recommendation: (a), cancelled sales excluded, unknown costs stay unknown (needs-review count). Risks: (a) mixes recognition bases if orders stay delivery-based (mitigate: document both in the scope line); (b) understates period profit for credit sales; (c) leaves the confusion. Acceptance: period result includes direct sales per chosen policy; scope line names both bases; domain + service tests cover cancellation exclusion and unknown-cost honesty.

**F-006 — Amanah release can drive holdings negative.** Priority: High (defect, small fix).
Problem: no guard that `amanah_released_cash` ≤ held balance. Evidence: `record()` validates only payable settlements; nothing else caps releases. Classification: CONFIRMED (defect). User scenario: P1 releases 50 against 30 held → holdings −20, cash understated vs truth. Journey: stage 10 (correction). Current flow: editor accepts any amount. Target flow: guard with honest error «المبلغ المُسلَّم يتجاوز الأمانات بحوزتك — راجع الرصيد أولًا». Screens: FinancialEventEditor (amanah released). IA/Navigation: unchanged. Data: guard only; old records untouched. Financial effect: protects amanah dimension integrity. Alternatives: warn-only (rejected — silent negative states violate missing ≠ zero). Recommendation: fix in W1. Risks: owner legitimately holding un-recorded amanah gets blocked (mitigate: record the held first). Acceptance: service test rejects over-release; existing amanah tests stay green.

**D-004 — "Unknown opening" has no completion road in UI.** Priority: High.
Problem: domain offers later-dated documented openings (PA-007) and computes `openingUnknown`, but no surface uses either. Evidence: `recordOpeningBalanceLater` has no UI caller; `openingUnknown` never rendered. Classification: CONFIRMED (gap) + RECOMMENDED DESIGN (fix). User scenario: P5 chose "unknown" at setup; a month later still unknown, silently. Journey: stages 2→7. Current: promise in setup copy, then dead end. Target: wallet row on unknown wallets → «سجّل رصيدًا موثقًا لاحقًا» (later date + reason; stamp lifts; history untouched); unknown badge visible in wallet list. Screens: CashWallets (+ Finance road). Data: PA-007 exists; additive UI only. Financial effect: honest completion instead of permanent gap. Alternatives: force a count flow (rejected — heavier); leave (rejected — silent gap). Risks: minimal. Acceptance: UI test: unknown wallet → later opening → stamp lifts, entries append, no rewrites.

**D-005 — Event corrections (edit/delete/restore) unreachable from UI.** Priority: Medium-High.
Problem: only reversal is exposed; the atomic edit (reversal+replacement), documented delete, and restore services have guards+tests but no buttons. Evidence: `editEvent`/`deleteEvent`/`restoreEvent` UI-caller grep = none. Classification: CONFIRMED (gap). User scenario: owner mistypes an expense amount; today: reverse + re-enter manually. Journey: stage 10. Current: reverse-only. Target: EventsLayer row actions → edit (pre-filled replacement form, reason required), with reverse and delete as explicit alternates; restore visible on reversed events. Screens: EventsLayer. IA: history surface (U-001) becomes the home of corrections. Data: services exist; atomic. Financial effect: safer corrections (less manual re-entry error). Alternatives: keep reverse-only (rejected: the error-prone path is the common one). Recommendation: W2 with U-001. Risks: more actions per row (density +2–3 strings — ratchet decision). Acceptance: UI flows for edit/delete/restore with reasons; conflict guard (و۶) honored; service tests already green.

**U-001 — No unified history/audit surface.** Priority: Medium-High.
Problem: corrections exist per-store but no single place lists "everything I changed and why". Evidence: reversal data across 8 record types; EventsLayer shows latest 3. Classification: CONFIRMED (gap) + RECOMMENDED DESIGN. User scenario: "show me my corrections this month" → impossible. Journey: stages 10–11. Current: fragmented per-record. Target: «السجل» layer in Finance (and Settings full export) listing corrections across stores with reasons, filtered, deep-linking to records. Screens: Finance + Settings. Data: read-only over existing data. Financial effect: none (visibility only). Alternatives: per-record disclosure only (weaker). Recommendation: W2. Risks: density (own collapsed layer — excluded from at-rest counts by §10.1). Acceptance: synthetic corrections test lists all kinds with reasons.

**D-002 — Discoverability of non-seat capabilities.** Priority: Medium (owner decision D-07).
Problem: suppliers/inventory/schedules/catalog/parties live behind text links, conditional cards, and a collapsed Finance layer. Evidence: §8.4 audit. Classification: CONFIRMED (structure) + OWNER DECISION REQUIRED (fifth seat). User scenario: infrequent owner forgets where suppliers live; find time > 30s (S-11 measures). Journey: stage 9. Current: text links. Target: (recommended) keep 4 seats; promote the two *reading* intents (parties, suppliers) into Finance's truth row; make Tools module rows data-derived; add a stable «المزيد» affordance only if S-11 fails. Screens: Finance/Tools/Home. Data: none. Financial effect: none. Alternatives: fifth seat = parties (rejected by default: E-00.14 documents a deliberate market-seat vacancy; changing it is a positioning decision), «المزيد» sheet (adds a mode). Risks: nav churn vs. discoverability. Acceptance: S-11 ≤ 30s per capability for 80% of participants.

**U-004 — Saved estimates are write-only.** Priority: Medium.
Problem: no path from a saved estimate to a draft; the estimator loop breaks at its most valuable step. Evidence: exhaustive search — no reuse link; list offers delete only. Classification: CONFIRMED (gap) + RECOMMENDED DESIGN. User scenario: P7 estimates a cake, saves, quotes, wins the job — then re-types everything into a draft. Journey: stage 5→6 bridge. Current: save/list/delete. Target: estimate row → «ابدأ مسودة من هذا التقدير» → new draft prefilled (as *proposals*, editable; estimate untouched). Screens: Tools. Data: draft create reads estimate; estimate immutable. Financial effect: none (estimate stays non-financial; draft is a draft). Alternatives: keep write-only (rejected); auto-convert (rejected — creates silent commitments). Recommendation: W3 (with D-05 if selected). Risks: prefill-as-authoritative confusion (mitigate: proposals labeled editable). Acceptance: UI test: estimate → draft exists, estimate unchanged, prefills match, everything editable.

**Y-001 — Density drift on 100+ ratchets.** Priority: Medium (policy).
Problem: Finance 122 / OrderDetail 127 at-rest strings; first-visit comprehension concentrates on top cards; the ratchet table can normalize creeping prose. Evidence: cap table + §9.2. Classification: CONFIRMED (numbers) + INFERRED (impact). User scenario: first Finance visit = read decision card, ignore layers. Journey: stage 7. Current: capped-but-high. Target: (a) keep the ratchet discipline; (b) trim Finance's above-fold meta to ≤ ~60 via collapse (prior recommendation, restated); (c) periodic reading pass. Screens: Finance/OrderDetail. Data: none. Financial effect: none. Risks: over-trimming hides truths (reject trimming truth lines). Acceptance: above-fold label count target met; text-density guard green.

**O-001 — Single-device durability.** Priority: High (risk) / owner decision D-11.
Problem: all data in IndexedDB; export manual; persist() requested; no sync. Evidence: storage layer; reset gate; away-card backup age. Classification: CONFIRMED. User scenario: phone loss = total loss despite honest UX. Journey: stage 11. Current: verified export + persist + reminders. Target: export reminder cadence (owner choice: weekly nudge vs. away-card only), then device-pair transfer, then cloud (D-12). Data: export contract exists. Financial effect: none directly; existential risk mitigation. Alternatives: immediate cloud sync (rejected — before field validation). Recommendation: cadence decision W3; sync after W4. Acceptance: chosen cadence shipped; S-12 + backup-age surfaces verified.

**P-001 — Money precision 2 decimals (piasters) vs 3 (fils).** Priority: Medium (owner decision D-02).
Problem: JOD officially uses 3 decimals; input rejects the third; rounding absorbed silently at entry. Evidence: `englishNumeric.moneyPartial` (2 decimals); formatters 2 decimals. Classification: CONFIRMED (behavior) + OWNER DECISION REQUIRED. User scenario: price 12.375 impossible to enter exactly. Journey: stage 6. Current: 2-decimal domain-wide. Target: either declare the 2-decimal policy in-app (cheapest) or migrate to milli-JOD (schema-wide /1000: inputs, formatters, domain constants, export migration). Data (if migrated): full money-scale migration + export/import back-compat. Financial effect: rounding differences at scale; sub-fils reality. Alternatives: declare-in-UI (recommended now) vs full migration (recommended only with field evidence of need). Risks: migration touches every money site; silent 10×-class bugs (F-001's lesson). Acceptance (if declared): UI line states piaster precision; (if migrated): full round-trip tests + old-file migration tests.

**P-002 — Catalog carries no default price/cost; binding is inert.** Priority: Medium (owner decision D-05).
Full analysis in §6; entry kept here for register completeness. Recommendation: Option A. Priority: Medium. Acceptance: §6.4 Option A criteria.

**P-003 — Fixed "مشغل حرفي" identity label.** Priority: Low-Medium (owner decision D-06).
Problem: every project is labeled a craft workshop; setup badge + profile fixed `activityType:"custom_craft"`. Evidence: `storage/local/types.ts` ActivityProfile; Setup impact card. Classification: CONFIRMED. User scenario: food/services owner sees a wrong label day one. Journey: stage 2. Current: fixed label. Target: neutral label «مشروعك» now, Activity Profiles later (per future plan). Data: one string + optional profile model later. Financial effect: none. Alternatives: profiles now (rejected: vertical slicing cost). Recommendation: neutral label in W3. Acceptance: label no longer asserts a sector.

### 12.3 Minor open entries (compact)

| ID | Problem (evidence) | Classification | Target | Priority |
|---|---|---|---|---|
| U-002 | Away card lists only overdue debts + backup age; no digest of what changed | CONFIRMED | digest counts (sales/expenses/orders since last activity) | Low |
| U-003 | Setup draft (typed name) lost on interruption | CONFIRMED | persist draft on non-financial preference surface | Low |
| F-003 | `/orders/new` chooser duplicates FAB intents and is itself deep-classified | CONFIRMED | retire/redirect to FAB path or keep as deep-link surface | Low (owner) |
| D-003 | Party ledger read-only; collecting requires editing the source record | CONFIRMED | per-party navigation shortcuts to the correct collection flow (no ledger writes) | Low |
| C-001 | Quick-expense asserts knowledge "known" without asking | CONFIRMED | keep; revisit with field evidence | Low |
| Q-003 | sonner Toaster mounted, `toast()` never called; «متوقف مؤقتًا» state never produced | CONFIRMED | remove Toaster or use for transient confirmations; give the state a producer or remove it | Low |
| P-004 | No `viewport-fit=cover` (safe-area inert in tabs); no landscape support; 640px large-screen cap; 12/13px-dominant body text | CONFIRMED | add viewport-fit=cover; define landscape fallback; consider 14px body option for accessibility | Low-Medium |
| D-006 | Tools module states hard-code `available_not_enabled` regardless of data | CONFIRMED | data-derived states (parties row reflects real usage) | Low |
| U-005 | Sale detail hides nav; order detail keeps it | CONFIRMED | unify (both surface) | Low |
| H-001 | No retroactive inventory import (pre-activation "not managed" declarations) | CONFIRMED (closed owner decision) | keep closed; reopen only with field evidence | Closed |

**BLOCKER scan at `f7c1430`: none.** All gates green at the Phase-1 merge (§2.3); Phase 2 did not execute gates (analysis only).

---

## 13. Target-State Specification (A–Z) — RECOMMENDED DESIGN (each item: problem → proposed behavior; current behavior is §3–§12)

- **A. Product model.** Money-honest local-first companion for one Jordanian micro-business owner; cloud-ready later. Keep positioning; complete the loops (estimates → drafts; unknown → documented).
- **B. User model.** Single owner, no auth; optional shared-device privacy only on owner decision (D-09).
- **C. Personas.** All eight served; P3 (selection) and P7 (estimate reuse) close with D-05/U-004; P5 (unknown opening) closes with D-004.
- **D. Journey.** Keep 11 stages; stages 5/7/10 gain: repeat-action receipt; period scope line; correction edit paths + unified history.
- **E. Flows.** FL-A gains repeat + (if D-05) product proposals; FL-D gains a second entry; FL-E gains the draft bridge; FL-F gains event edit/delete/restore + history layer.
- **F. Information architecture.** 4 seats + FAB + gear; reading intents promoted in Finance's truth row; Tools module states data-derived; «السجل» layer inside Finance.
- **G. Navigation.** Keep bar-hiding in deep flows and with keyboard; unify detail-screen treatment; fifth seat stays vacant pending D-07; `/review` redirect stays.
- **H. Screens.** Contracts in §8.3; deltas: activation card (Home), truth-row promotion (Finance), reuse action (Tools), unknown road (CashWallets), edit paths (EventsLayer), repeat CTA (receipt), product proposals (DirectSaleEditor — D-05).
- **I. Wireframes.** §8.5 deltas stand.
- **J. Density.** Policy unchanged (whole-screen at-rest ratchets; moment-of-action excluded); Finance above-fold trim ≤ ~60; every raise = decision record.
- **K. States.** Matrix unchanged (known/unknown/needs_review everywhere); «متوقف مؤقتًا» gains a producer or is removed; unknown-opening gets its completion road.
- **L. Onboarding.** Stage A repaired (keep); Stage B = Foundation with استخدمه الآن/قد أحتاجه لاحقًا/لا أحتاجه mapping to module states; draft persistence; activation card after setup.
- **M. Financial core.** Eight event types + DELTA_TABLE stay the single authority; F-006 guard added; F-005 policy decided and documented in the period layer's scope line.
- **N. Optional modules.** Same set; states data-derived; never mandatory.
- **O. My Tools.** Independence unchanged; saved estimates gain the start-draft bridge (non-financial, immutable estimate).
- **P. Cost calculator.** Unchanged; optional future: estimate→draft prefill as proposals only.
- **Q. Products.** Reference-only **or** Option A defaults (D-05) — never silent amounts; actual price always authoritative; history immutable by construction.
- **R. Sales.** Quick sheet gains (if D-05) a product chip row and (target) quantity; full editor gains proposals; both keep X-06 choices; customer structured (done).
- **S. Inventory.** Dated activation, evidenced consumption, append-only movements, sale-driven decrement stays out (closed decision; B rejected).
- **T. Cash.** Recorded/wallet/unallocated model unchanged; count text honest (done); count gains second entry + optional weekly cadence (D-11).
- **U. Wallets.** Kinds/openings/transfers/adjustments unchanged; unknown openings gain the documented-later road (PA-007 surfaced).
- **V. Amanah.** Semantics unchanged; release guarded (F-006).
- **W. Editing/deletion.** Atomic reversal+replacement, documented delete, restore — surfaces added to UI (D-005); one-level reversals stay.
- **X. Opening balance.** Known/unknown/zero honesty unchanged; the later-declaration road completes the promise (D-004).
- **Y. Historical protection.** Append-only + disclosures unchanged; no module activation ever rewrites history; period layers declare scope (F-005 scope line).
- **Z. Offline, cloud, accessibility, RTL, testing, MVP, conversion, retention, risks, decisions.** Offline: local persistence + verified export + reset gate + reminder cadence (D-11). Cloud: no change now; sync-friendly foundations kept (ports, idempotency, append-only); pair transfer before live sync. Accessibility: keep RTL/AR discipline + focus/reduced-motion; add a 14px body option evaluation and landscape fallback (P-004). Usability testing: run §9.3 before further product waves. MVP: §10.1 classification stands. Conversion: activation card + repeat receipt. Retention: away digest + backup cadence + weekly count nudge option. Risks: single-device loss (O-001), F-005 confusion, density fatigue, expectation gaps (P-002/P-003). Decisions: §14 list.

---

## 14. Implementation Roadmap (recommended, not implemented) — future cycle

| Wave | Objective | Items | Dependencies | Non-goals | Acceptance criteria |
|---|---|---|---|---|---|
| W1 — Integrity hardening | Close money-truth gaps | F-006 guard; D-004 unknown road; F-005 policy decision + implementation per D-01; density decision record for any +labels | F-005 decision first | No new surfaces | Service tests for over-release + later-opening UI; period tests include direct sales per policy; scope line present |
| W2 — Correction & reading experience | Make fixing and reviewing safe and findable | D-005 edit/delete/restore surfaces; U-001 history layer; Y-001 Finance trim; U-002 digest; D-003 shortcuts; U-005 unify; Q-003 cleanup | none (read models + existing services) | No semantic changes | S-08/S-11/S-14-style checks; density guard green; corrections listed with reasons in one surface |
| W3 — Decisions & product package | Owner-approved product moves | D-02 precision (declare or migrate); D-05 Option A (if approved) + U-004 bridge; D-06 neutral label; D-07 fifth seat (or promote reading rows); D-11 cadence; D-09 privacy (if approved) | W1 for F-005 | No Market/Delivery/Auth/Cloud | Each decision closed in writing; per-item acceptance from §6/§12 |
| W4 — Field validation | Evidence before expansion | Run §9.3 plan on real devices (Android+iOS); offline reload; install flows | W1–W3 | No new features before evidence | ≥ 80% unassisted per scenario; honest report of failures |
| W5 — Product-led selling (conditional) | Option A rollout | Catalog defaults + sale proposals + margins read-model extension | D-05 approved + W4 | No inventory coupling (B stays rejected) | §6.4 acceptance |
| W6 — Cloud readiness (future) | Sync design on fixed foundations | Pair transfer via verified export; cloud mirror; live sync spike | W4 + D-12 | No multi-user | Owner-approved sync contract doc |

---

## 15. Owner Decisions Required Before the Next Implementation Cycle

| # | Decision | Options | Recommendation (labeled, not approved) |
|---|---|---|---|
| D-01 | Direct-sale recognition in the period result (F-005) | (a) at sale date · (b) at collection · (c) exclusion + scope line | **(a)** — matches the product's own revenue definition; document both bases in the scope line |
| D-02 | Money precision (P-001) | declare 2-decimal policy in UI · migrate to 3-decimal fils | **declare now**; migrate only with field evidence (migration risk is F-001-class) |
| D-05 | Catalog default price/cost + sale selection (P-002) | A reference+defaults · B full product-led · C recent-items chips | **A** (C as interim if deferring) |
| D-06 | Activity label (P-003) | neutral «مشروعك» now · Activity Profiles later · both | neutral now, profiles later |
| D-07 | Fifth navigation seat (D-002/E-00.14) | keep market-seat vacancy · promote Parties · «المزيد» sheet · promote reading rows instead | promote reading rows; keep vacancy; revisit after S-11 |
| D-08 | Retroactive inventory import (H-001) | keep closed · design guided import | keep closed (repo's own closed decision) |
| D-09 | Shared-device privacy | later · now (PIN/amount hiding) | later (after field validation) |
| D-11 | Backup/count reminder cadence (O-001) | weekly count nudge + export reminder · away-card only · none | weekly nudge opt-in + away-card backup age |
| D-12 | Cloud/sync timing | after W4 · later | after W4 |
| D-10 | Correction surfaces timing (D-005) | W2 with history layer · later | W2 |

---

## 16. Limitations, Confidence & Evidence Index

**Limitations.** This is static repository analysis plus executed Phase-1 gates; the app was not run in Phase 2; no user research was conducted; personas/journey/scenarios are hypotheses/simulations. Runtime-only behaviors (keyboard quirks, PWA install flows on specific OS versions, rendering performance) are outside this evidence. Financial statements described are the system's own recorded readings, which the product itself labels non-final.

**Confidence.** Highest-confidence: all CONFIRMED items citing files/symbols (F-005, F-006, D-004, D-005, U-004, Q-003, P-004, D-006, U-005, plus the resolved Phase-1 set). Medium: discoverability burden magnitude, density impact, retention drivers (INFERRED). Explicitly labeled: all RECOMMENDED DESIGN items and the §6 options/§15 recommendations.

**Primary symbols cited (Phase 2 additions):** `app/MicroRouter.tsx` (38 routes) · `app/routeClassifier.ts` · `app/StartupGate.tsx` · `components/layout/{MicroAppShell,BottomNav,AppHeader,QuickActionSheet}.tsx` · `pages/{Home,Foundation,Finance,Tools,Parties,Settings,Orders,NewDraft,OrderDetail,CashWallets,CashCount,CashDistribution,DirectSaleEditor}.tsx` · `components/finance/EventsLayer.tsx` · `src/domain/financial-event/{types,policies}.ts` (8 types, DELTA_TABLE, `createFinancialReversal`, `activeSettlementsMinor`) · `src/domain/cash-continuity/{types,policies}.ts` + `application/cash/cashContinuityService.ts` (`recordOpeningBalanceLater` PA-007) · `src/domain/craft-order/types.ts` (10 statuses, CostSnapshot) · `src/domain/direct-sale/types.ts` (`customerName`) · `src/domain/catalog/types.ts` (reference-only) · `src/domain/{inventory-material,supplier-purchase,g5,owner-entitlement}/` · `application/finance/projectFinancialService.ts` (`readPosition`, `readRecordedPeriodResult`, `derivePeriodCogs`, `editEvent`, `deleteEvent`, `restoreEvent`, `distributeUnallocated`) · `application/catalog/catalogService.ts` (`readRecordedMargins`) · `application/estimates/costEstimateService.ts` · `application/parties/partyLedgerService.ts` · `application/transfers/localTransferService.ts` (`isDirectSale`, `createVerifiedExport`) · `presentation/{formatters,cashCountMessages}.ts` · `scripts/text-density-count.py` · `apps/prototype-web/vite.config.ts` + `dev-tools/debug-collector.js` · `index.css` (design tokens, z-ladder, RTL isolation sites) · `pwa/register.ts` + `PwaInstallControl` + `PwaRuntimeNotice`.

*This report and its Arabic companion are derived from the same findings tables; if a discrepancy is ever found, this English source file is the traceable record. Phase 2 created no commits and modified no repository content.*
