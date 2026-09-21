# Micro — Zed AI Implementation Package for UX/UI Reports 1–2

## Document status

| Field | Value |
|---|---|
| Purpose | Official implementation handoff for Z1 and Z2 only |
| Repository | `Qays7753/Micro` |
| Required implementation baseline | `b0b4cea66a06c295c65eb895dc2b9067c8b732cf` |
| Historical audit baseline | `16b4c8afafb4b091bdb6e1ce5f8208bff39f5145` |
| Current audit branch | `audit/replit-ux-ui-refresh-20260921` |
| Source of truth | Current `main` behavior at `b0b4cea`, including OPS-003 |
| Historical reports | Context only; their OPS-003 impact is superseded by the Delta Refresh |
| Implementation waves | Z1, then Z2 |
| Language and layout | Arabic-first, RTL-first, phone-first, portrait-first |

> **Baseline preflight:** the audit branch may contain documentation-only commits after `b0b4cea`. Zed must start its implementation branch from `b0b4cea` or from a later owner-approved `main` after producing a fresh delta. It must not silently implement against an unreviewed functional baseline.

---

# 1. Executive Scope Lock

## 1.1 Objective

Implement two contained UX/UI waves:

1. **Z1 — Home and daily decision:** make “مشروعي الآن” a clearer daily decision surface inside the existing five-destination structure.
2. **Z2 — Work and operation clarity:** clarify the order journey, affected sale/expense/contextual-collection flows, and the grammar of outcomes, recovery, correction, and reversal.

The implementation must improve comprehension, hierarchy, next-action clarity, and truthful feedback without changing financial meaning, stored data, system architecture, or product navigation.

## 1.2 Fixed product decisions

These are owner-approved and must not be reopened:

- Bottom Navigation remains, in this order:
  - `مشروعي الآن`
  - `العمل`
  - `المالية`
  - `أدواتي`
  - `السوق`
- No sixth destination.
- No standalone navigation destinations for cash, debt, expense, collection, inventory, or reports.
- “أدواتي” remains an independent destination.
- “السوق” remains in place and is not activated or removed.
- Micro must not become a finance-management app or a financial dashboard.
- The fixed Home actions are:
  - sale
  - expense
  - order
- Collection is contextual, not a fourth fixed Home action.
- Recurring expense is not added to Home, Quick Actions, or Home KPIs.
- Visual identity remains open; this package does not establish a final palette, typography, radius, shadow, or motion system.
- Dark Mode is outside this package.

## 1.3 In scope

### Z1

- Home hierarchy and composition.
- Daily status.
- One primary priority when present.
- A CTA tied to that priority.
- Upcoming/overdue operational items.
- The three fixed actions: sale, expense, order.
- Contextual collection only when the current state requires it.
- Natural-day, empty-day, incomplete-data, loading, error, safe retry, and relevant success states.
- Moving numbers, details, and activity below state and actions.
- Removing duplicate information and reducing Card overload in Home only.
- Preserving links to the five existing destinations and legal `returnTo`.

### Z2

- Visible order stage, completed work, missing work, and next action.
- Flexible order journey:
  - create/price
  - agree
  - execute
  - deliver
  - settle collection
  - review impact
- Review impact as a follow-up loop, not a blocking stage.
- Contextual collection as a separate operation linked to an order or party.
- Affected sale, expense, collection, order, party, product/service, material, supplier/purchase, and finance-read touchpoints only.
- Shared operation grammar:
  - minimum input
  - expected effect when needed
  - confirmation
  - execution
  - truthful outcome
  - next action
  - correction or reversal
- Success, Partial Success, Save Error, Retry, Incomplete Data, Reversal, Correction, and Delete Draft.
- Clear language separating back, cancel, delete draft, reversal, and correction.
- OPS-003 non-regression and its result grammar where it intersects manual expense.

## 1.4 Out of implementation scope

- Rebuilding all of Micro.
- Changing Bottom Navigation, its labels, order, or destination count.
- Full redesign of Finance.
- Full redesign of Tools or Market.
- Activating Market.
- Full redesign of Catalog, Parties, Inventory, Suppliers, reports, or settings.
- Full redesign of OPS-003 recurring-expense screens.
- Adding recurring expense to Home.
- Tablet or desktop design.
- Final visual identity.
- Palette, typography, radius, shadow, or motion tokens.
- Charts, Goals, or Gamification.
- Dark Mode.
- Architecture changes, refactoring programs, file moves, or module reorganization.
- Database, API, Storage, Auth, permissions, schema, migrations, snapshots, or export changes.
- Business Logic, calculations, accounting rules, event meaning, or financial policies.
- Vite, Replit Workflow, package, dependency, or toolchain repair.

## 1.5 Scope-separation rule

Z1 and Z2 are UX/UI waves over existing contracts. If a desired visual behavior appears to require a new domain state, storage field, writer, calculation, financial interpretation, or route family, Zed must stop and report a blocked owner decision. It must not implement a hidden functional expansion.

## 1.6 No-expansion rule

No change may be justified merely because it is adjacent, visually inconsistent, or convenient to refactor. A change is allowed only when it directly satisfies a requirement in Z1 or Z2 and remains inside the allowlist and protected-boundary protocol below.

---

# 2. Current Implementation Map

## 2.1 Z1 implementation

### Main Home surface

- `apps/prototype-web/client/src/pages/Home.tsx`
  - Home state: loading, error, ready.
  - Priority block: “الأهم الآن”.
  - Daily list: “اليوم”.
  - Period numbers and facts.
  - Current Quick Actions.
  - Insights, finance links, activity, and return-aware navigation.

### Home view model

- `apps/prototype-web/client/src/application/home/homeControlCenterModel.ts`
  - `HomeTodayItem`
  - `HomeControlCenterViewModel`
  - priority selection and de-duplication
  - limits for recent activity and insights

### Home reader

- `apps/prototype-web/client/src/application/home/homeControlCenterService.ts`
  - reads existing operational and financial facts
  - produces current priorities, daily items, facts, numbers, and links
  - **must remain a reader; no new writes or financial meaning**

### Home action wiring

- `apps/prototype-web/client/src/app/quickRecording.tsx`
  - opens the existing sale and expense quick forms
- `apps/prototype-web/client/src/components/layout/QuickActionSheet.tsx`
  - hosts existing quick sale and quick expense forms
  - protected unless a direct Z1/Z2 requirement cannot be fulfilled without a contained presentation change

### Navigation contracts

- `apps/prototype-web/client/src/app/navigation.ts`
  - fixed five destinations; protected
- `apps/prototype-web/client/src/app/navigationContract.ts`
  - legal `returnTo` creation and resolution; protected
- `apps/prototype-web/client/src/app/useReturnNavigation.ts`
  - contextual return behavior; protected
- `apps/prototype-web/client/src/app/MicroRouter.tsx`
  - route table; protected

## 2.2 Z2 implementation

### Work and order surfaces

- `apps/prototype-web/client/src/pages/Orders.tsx`
  - work list, drafts, stage/status, next action
- `apps/prototype-web/client/src/pages/OrderDetail.tsx`
  - order state, fulfillment, delivery, collection, correction, reversal, stale conflict
- `apps/prototype-web/client/src/pages/NewDraft.tsx`
- `apps/prototype-web/client/src/pages/DraftEditor.tsx`
- `apps/prototype-web/client/src/pages/AgreementEditor.tsx`
- `apps/prototype-web/client/src/pages/CostEditor.tsx`
- `apps/prototype-web/client/src/pages/DeliveryReview.tsx`

Only presentation, stage communication, next-action composition, and relevant feedback are in scope. Existing transition legality and domain policies are protected.

### Sale

- `apps/prototype-web/client/src/components/finance/QuickSaleForm.tsx`
- `apps/prototype-web/client/src/pages/DirectSaleEditor.tsx`
- `apps/prototype-web/client/src/components/layout/QuickActionSheet.tsx`

### Expense

- `apps/prototype-web/client/src/components/finance/QuickExpenseForm.tsx`
- `apps/prototype-web/client/src/pages/FinancialEventEditor.tsx`
- `apps/prototype-web/client/src/components/layout/QuickActionSheet.tsx`

`FinancialEventEditor.tsx` is protected because it contains OPS-003 overlap and canonical financial-entry behavior. A change is allowed only under the protected-file protocol.

### Contextual collection

- `apps/prototype-web/client/src/pages/Collect.tsx`
- collection actions exposed from `OrderDetail.tsx` and party context

### Shared result feedback

- `apps/prototype-web/client/src/app/resultFeedback.ts`
- existing Notices, Inline Errors, completion feedback, effect previews, and primitive Buttons/Fields

### Directly affected supporting surfaces

These may be touched only when a Z2 flow demonstrably requires a presentation change:

- `apps/prototype-web/client/src/pages/Parties.tsx`
- `apps/prototype-web/client/src/pages/Catalog.tsx`
- `apps/prototype-web/client/src/pages/InventoryMaterials.tsx`
- `apps/prototype-web/client/src/pages/MaterialEditor.tsx`
- `apps/prototype-web/client/src/pages/Suppliers.tsx`
- `apps/prototype-web/client/src/pages/SupplierPurchaseEditor.tsx`
- `apps/prototype-web/client/src/pages/Finance.tsx`
- `apps/prototype-web/client/src/pages/FinanceActivity.tsx`
- `apps/prototype-web/client/src/pages/Statement.tsx`

Do not redesign these domains as standalone work.

## 2.3 Existing reusable components

Prefer existing primitives and contracts:

- `Button`
- `Field`
- `Row` / `RowList`
- `ChoiceRow` / `ChoiceButton`
- `EmptyState`
- `Notice`
- `QuietCompletion`
- `InlineError`
- `FeedbackNote`
- `EventEffectPreview`
- `LocalDateField`
- `EnglishNumberInput`
- shared formatted display values
- existing Drawer/Sheet behavior

Use open Sections and operational Rows by default. Use a Card only for an independent decision, entity, priority, or receipt.

## 2.4 Routes that must remain valid

### Core routes

- `/`
- `/orders`
- `/orders/new`
- `/orders/draft/new`
- `/orders/draft/:id`
- `/orders/:id`
- `/orders/:id/deliver`
- `/direct-sales/new`
- `/direct-sales/:id`
- `/finance`
- `/finance/new/:type`
- `/collect`
- `/parties`
- `/catalog`
- `/inventory/materials`
- `/suppliers`
- `/tools`
- `/market`

### OPS-003 protected routes

- `/finance/more`
- `/finance/recurring`
- `/finance/recurring/new`
- `/finance/recurring/:id`
- `/finance/recurring/:id/edit`

## 2.5 Existing tests most relevant to Z1

- `apps/prototype-web/client/src/Home.dom.test.tsx`
- `apps/prototype-web/client/src/HomeRedesign.w43.dom.test.tsx`
- `apps/prototype-web/client/src/application/home/homeControlCenterModel.test.ts`
- `apps/prototype-web/client/src/application/home/homeControlCenterService.test.ts`
- `apps/prototype-web/client/src/application/follow-up/dailyFollowUpService.test.ts`
- `apps/prototype-web/client/src/app/navigation.test.ts`
- `apps/prototype-web/client/src/app/navigationContract.test.ts`
- `apps/prototype-web/client/src/app/routeClassifier.test.ts`
- `apps/prototype-web/client/src/app/routeKnowledgeSync.test.ts`
- `apps/prototype-web/client/src/app/routeParamRegistry.exe016.test.ts`
- `apps/prototype-web/client/src/Nav001.dom.test.tsx`
- `apps/prototype-web/client/src/Nav003.exe016.dom.test.tsx`
- Quick Action Sheet tests
- Arabic, RTL, accessibility, responsive, and state-recovery tests listed in Section 7

## 2.6 Existing tests most relevant to Z2

- `apps/prototype-web/client/src/pages/Orders.ui.test.tsx`
- `apps/prototype-web/client/src/G3.dom.test.tsx`
- `apps/prototype-web/client/src/G3Hardening.dom.test.tsx`
- `apps/prototype-web/client/src/G3Delivery.dom.test.tsx`
- `apps/prototype-web/client/src/OrdJourneys.dom.test.tsx`
- `apps/prototype-web/client/src/R1.orderDetailVoid.test.tsx`
- `apps/prototype-web/client/src/R2.financeActivityVoid.test.tsx`
- `apps/prototype-web/client/src/ReversalSurfacesExe010.dom.test.tsx`
- `apps/prototype-web/client/src/pages/DirectSaleEditor.ui.test.tsx`
- `apps/prototype-web/client/src/pages/FinancialEventEditor.ui.test.tsx`
- `apps/prototype-web/client/src/pages/FinancialEventEditor.guided.test.tsx`
- `apps/prototype-web/client/src/QuickExpenseSource.dom.test.tsx`
- Quick Action Sheet and Quick Form tests
- collection, correction, reversal, and stale-result service tests

## 2.7 OPS-003 protected implementation

Read and protect; do not redesign:

- `apps/prototype-web/client/src/pages/FinanceMore.tsx`
- `apps/prototype-web/client/src/pages/FinanceRecurring.tsx`
- `apps/prototype-web/client/src/pages/RecurringExpenseDetail.tsx`
- `apps/prototype-web/client/src/pages/RecurringExpenseEditor.tsx`
- `apps/prototype-web/client/src/components/finance/RecurringConfirmPanel.tsx`
- `apps/prototype-web/client/src/application/finance/recurringExpenseService.ts`
- `src/domain/recurring-expense/`
- recurring-expense storage, migrations, snapshots, validators, and commit guards
- `docs/contracts/41-recurring-expense-reminders-contract.md`

---

# 3. Target Behavior Specification

## 3.1 Z1: Home

### Current condition

Home already contains a priority block, away summary, period numbers, facts, several Quick Actions, insights, finance links, daily items, and activity. The content is individually useful but requires the user to process several models before identifying the daily decision.

### Target contract

Home has one purpose:

> Tell the owner what needs attention now and let them begin the appropriate action with minimal reading.

### Target order

1. Project/time context.
2. Daily status.
3. One main priority when present.
4. CTA tied to that priority.
5. Short upcoming/overdue operational summary.
6. Fixed daily actions: sale, expense, order.
7. Numbers and financial facts.
8. Insights.
9. Finance depth and activity.

The exact fold position requires visual QA, but state, priority, and the three fixed actions must precede extended metrics and activity.

### Daily states

| State | Required behavior |
|---|---|
| Normal day | Say there is no urgent item, show nearest relevant work, then the fixed actions |
| Priority day | Show one priority, its reason/effect, and one primary CTA |
| Incomplete data | State what cannot be concluded, what remains known, and one safe completion action |
| Empty day | Do not invent insight; explain that nothing is recorded and offer the fixed actions |
| Loading | Preserve understandable structure and announce loading |
| Error | Explain the failed read, preserve existing content when safely available, and offer safe Retry |
| First use | Confirm setup, make first recording obvious, and keep Foundation optional |

### Home actions

Fixed:

- Record sale.
- Record expense.
- Create customer order.

Contextual:

- Collection appears as the CTA of a due/overdue item, order, or party; it is not a fixed fourth action.

Secondary references:

- Products/services remain discoverable but do not carry the same daily-action weight.
- Planned-design or other less-frequent entries must not compete with the three fixed actions.

### Information rules

- One priority at a time.
- Do not repeat the same amount or fact in adjacent Home regions.
- Do not convert unknown or incomplete values to zero.
- Do not add recurring-expense information.
- Do not add financial KPIs.
- Do not add navigation destinations.
- Do not make Home look like a finance dashboard.

## 3.2 Destination ownership

| Destination | Owns | Does not own |
|---|---|---|
| مشروعي الآن | Daily status, priority, fixed actions, contextual next actions, concise pulse | Full registers, full reports, settings, all tools |
| العمل | Order commitments, stage, execution, delivery, next operational action | Full financial analysis |
| المالية | Financial effect, period, receivables/payables, evidence, events, correction | Product identity or all daily entry actions |
| أدواتي | Independent supporting tools | Orders, ledgers, recurring operational records |
| السوق | Honest unavailable/future state | Fake marketplace, sample transactions, activation work |

Z1 may clarify the relationship through Home composition and links but must not redesign the destination pages.

## 3.3 Z2: order journey

The journey is flexible, not a mandatory Wizard:

1. Create or price when needed.
2. Agree.
3. Execute.
4. Deliver.
5. Settle collection when applicable.
6. Review impact.

Every affected work surface must communicate:

- Current stage.
- Completed work.
- Missing information or decision.
- Next action.
- Whether a value is estimated or final.
- Whether collection is complete, partial, or still due.

Review impact is a follow-up link or summary; it must not block operational closure.

Collection remains a separate operation linked to an order or party and may occur in several parts.

## 3.4 Shared operation grammar

Every affected operation must follow:

1. Minimum input.
2. Expected effect when the effect is not obvious or carries risk.
3. Explicit confirmation when required.
4. Busy state with duplicate-submit protection.
5. Truthful outcome.
6. One logical next action.
7. Correction or reversal route when legally available.

### Outcome grammar

| Outcome | Meaning | Required presentation |
|---|---|---|
| Success | The intended operation completed | What happened, what changed, next action |
| Partial Success | The canonical operation completed but a dependent step did not | Separate completed and incomplete parts; retry only the dependent part |
| Save Error | No confirmed save | Preserve input, explain failure, offer safe Retry |
| Incomplete Data | The system cannot conclude or complete | Name missing data; do not show zero or final success |
| Reused | The event already existed; no duplicate was created | Neutral successful protection; not Error and not Partial Success |
| Result Unknown | Outcome cannot be observed | Neutral state; no success/error claim and no blind resubmission |
| Reversal | A separate reversing event exists; original remains | Explain effect and retained history |
| Correction | A documented correction exists | Explain corrected fact and history |
| Delete Draft | Only a non-final draft is removed | Do not use for completed financial history |

### Vocabulary boundaries

- **Back:** navigation only.
- **Cancel:** stop before commitment or stop future behavior as the specific contract permits.
- **Delete draft:** remove an uncommitted draft only.
- **Reverse:** create a documented opposite effect while retaining the original.
- **Correct:** record an authorized correction with history.

## 3.5 Sale

- Keep the quick path fast.
- Preserve cash/credit meaning and optional context.
- Show expected effect where needed.
- Disable duplicate submission while saving.
- On Success, state the recorded sale and relevant cash/receivable effect.
- On Partial Success, do not repeat the sale; retry only the failed dependent attribution.
- Keep correction/reversal language distinct from navigation.

## 3.6 Expense

- Keep manual expense directly available.
- Do not turn the expense action into a manual/recurring chooser.
- Preserve minimum fields and progressive disclosure.
- If an untreated recurring occurrence exists, show a visible non-blocking warning.
- Do not infer that the manual expense resolves the recurring occurrence.
- Preserve the distinction between reminder due date and actual expense occurrence date.
- On failure, retain input and expose safe Retry.

## 3.7 Contextual collection

- Enter from the specific order, party, or priority.
- Keep debt/receivable identity and remaining amount clear.
- Support partial collection without presenting it as complete.
- On Success, state cash effect and remaining amount.
- Preserve return context.
- Reversal remains documented and does not delete history.

## 3.8 Supporting touchpoints

- Party: clarify which party and relationship the operation affects; do not expand into a full party redesign.
- Product/service: use as work context, not a fixed daily action.
- Material/inventory: communicate only the directly affected availability or movement; do not redesign inventory.
- Supplier/purchase: distinguish purchase, payment, receipt, and remaining payable where the affected journey exposes them.
- Finance read: show concise impact and evidence; do not add a dashboard or new finance entry menu.

## 3.9 OPS-003 boundaries

The following are mandatory protections:

- A recurring reminder is not an expense.
- Overdue attention is not debt.
- A suggested amount is not final.
- Manual expense remains allowed with a warning.
- No recurring-expense action, Card, CTA, or KPI is added to Home.
- `recorded`, `reused`, `record_failed`, and `result_unknown` remain distinct.
- `reused` is neither Error nor Partial Success.
- `record_failed` means no confirmed recording and permits safe retry of the failed operation.
- `result_unknown` makes no success/error claim and forbids blind resubmission.
- Zed must not create a new `result_unknown` state, writer, storage field, migration, or functional flow. If the current contract exposes it, improve its presentation only; if a path does not expose it, do not invent it.
- A successful financial record with failed dependent wallet attribution is Partial Success; do not record the event again.
- `dueOn` and `occurredOn` remain distinct.
- Reversal preserves the original and does not automatically reopen the recurring occurrence.
- All protected recurring routes, `returnTo`, and unsaved-input guards remain valid.

---

# 4. File Allowlist and Protected Files

## 4.1 Allowed files

Zed may edit only files needed by an approved step. A file being listed does not authorize unrelated cleanup.

### Z1 allowed

| File | Allowed reason |
|---|---|
| `apps/prototype-web/client/src/pages/Home.tsx` | Recompose Home hierarchy, actions, states, and Card/Section usage |
| `apps/prototype-web/client/src/application/home/homeControlCenterModel.ts` | Presentation-model ordering/de-duplication only |
| `apps/prototype-web/client/src/application/home/homeControlCenterService.ts` | Only if existing reads cannot express an approved Home state; no new writes or financial meaning |
| `apps/prototype-web/client/src/index.css` | Home-specific selectors only; no token/theme overhaul |
| `apps/prototype-web/client/src/Home.dom.test.tsx` | Update/add Home contract coverage |
| `apps/prototype-web/client/src/HomeRedesign.w43.dom.test.tsx` | Update/add hierarchy, action, and navigation assertions |
| `apps/prototype-web/client/src/application/home/homeControlCenterModel.test.ts` | View-model contract tests |
| `apps/prototype-web/client/src/application/home/homeControlCenterService.test.ts` | Reader-state tests only when service behavior is intentionally changed |

### Z2 allowed

| File | Allowed reason |
|---|---|
| `apps/prototype-web/client/src/pages/Orders.tsx` | Stage and next-action clarity in work list |
| `apps/prototype-web/client/src/pages/OrderDetail.tsx` | Stage, completion, missing data, next action, and result clarity |
| `apps/prototype-web/client/src/pages/NewDraft.tsx` | Journey entry clarity if directly required |
| `apps/prototype-web/client/src/pages/DraftEditor.tsx` | Draft state, delete-draft, next-step clarity |
| `apps/prototype-web/client/src/pages/AgreementEditor.tsx` | Estimated/final and agreement-stage clarity |
| `apps/prototype-web/client/src/pages/CostEditor.tsx` | Estimated/final and missing-cost clarity |
| `apps/prototype-web/client/src/pages/DeliveryReview.tsx` | Delivery-stage and post-delivery action clarity |
| `apps/prototype-web/client/src/components/finance/QuickSaleForm.tsx` | Sale operation feedback and minimum-input clarity |
| `apps/prototype-web/client/src/components/finance/QuickExpenseForm.tsx` | Expense operation feedback and minimum-input clarity |
| `apps/prototype-web/client/src/pages/DirectSaleEditor.tsx` | Full sale flow feedback where directly affected |
| `apps/prototype-web/client/src/pages/Collect.tsx` | Contextual collection and partial-collection feedback |
| `apps/prototype-web/client/src/app/resultFeedback.ts` | Shared truthful outcome grammar |
| `apps/prototype-web/client/src/index.css` | Selectors directly used by approved Z2 surfaces only |
| Existing Z2 DOM/UI test files | Update/add assertions corresponding to changed behavior |

### Conditional supporting files

The following require a written necessity note before editing:

- `apps/prototype-web/client/src/pages/Parties.tsx`
- `apps/prototype-web/client/src/pages/Catalog.tsx`
- `apps/prototype-web/client/src/pages/InventoryMaterials.tsx`
- `apps/prototype-web/client/src/pages/MaterialEditor.tsx`
- `apps/prototype-web/client/src/pages/Suppliers.tsx`
- `apps/prototype-web/client/src/pages/SupplierPurchaseEditor.tsx`
- `apps/prototype-web/client/src/pages/Finance.tsx`
- `apps/prototype-web/client/src/pages/FinanceActivity.tsx`
- `apps/prototype-web/client/src/pages/Statement.tsx`

The note must name the Z2 acceptance criterion that cannot be satisfied without the change. No standalone redesign is allowed.

Writing the necessity note does not authorize the edit. Zed must stop after recording the note and wait for separate owner approval before changing any conditional supporting file.

## 4.2 Protected files

| Protected area | Files/examples | Reason |
|---|---|---|
| Five destinations | `app/navigation.ts`, `components/layout/BottomNav.tsx` | Owner-locked navigation |
| Router | `app/MicroRouter.tsx` | Existing route contract; no new route required |
| Return contract | `app/navigationContract.ts`, `app/useReturnNavigation.ts` | Legal deep-link and return behavior |
| Capability gate | `app/CapabilityRouteGate.tsx` | Existing feature gating |
| Quick-action shell | `app/quickRecording.tsx`, `components/layout/QuickActionSheet.tsx` | Existing shell and guards; modify only through exception protocol |
| Manual event editor | `pages/FinancialEventEditor.tsx` | Canonical entry plus OPS-003 intersection |
| OPS-003 UI | `FinanceMore.tsx`, `FinanceRecurring.tsx`, `RecurringExpenseDetail.tsx`, `RecurringExpenseEditor.tsx`, `RecurringConfirmPanel.tsx` | Explicitly not redesigned |
| OPS-003 internals | recurring service/domain/storage/migrations/snapshots/guards | Non-regression only |
| Domain | `src/domain/**` | Business meaning and transition legality |
| Application services | finance, order, direct-sale, collection, supplier, inventory services | Business Logic and writers |
| Storage | `apps/prototype-web/client/src/storage/**` | Storage and migration boundary |
| Global visual system | token, theme, font, dark-mode, and global shell files | Final identity is deferred |
| Package/tooling | `package.json`, lockfile, Vite, workflow config | Outside task |

## 4.3 Protected-file exception protocol

Before changing a protected file, Zed must record:

1. The exact file.
2. The Z1/Z2 requirement that cannot otherwise be satisfied.
3. Why an allowed file cannot solve it.
4. The minimal intended diff.
5. The tests that protect the contract.
6. The regression risk.

If the change touches Domain, Storage, migration, financial policy, route count, or destination ownership, stop and request owner approval. Do not use the exception protocol to authorize it.

---

# 5. Z1 Implementation Plan

Complete these steps in order. Do not begin Z2 until Z1 passes its gate.

## Z1.0 — Preflight and baseline lock

- **Goal:** confirm the implementation branch and clean scope.
- **Allowed files:** none.
- **Action:** create an independent implementation branch from the approved baseline; record `git status`, baseline SHA, and current route/navigation tests.
- **Must not change:** any workspace file.
- **Test:** existing targeted Z1 tests before editing.
- **Success:** clean baseline or documented pre-existing failure; no functional delta beyond the approved baseline.
- **Rollback:** discard the branch if the baseline is wrong.

## Z1.1 — Lock Home contract in tests

- **Goal:** encode the approved hierarchy and fixed actions before composition changes.
- **Allowed files:** Home DOM/model tests.
- **Visible behavior:** none yet.
- **Must not change:** source behavior during this step.
- **Tests to add/update:**
  - one daily status region
  - at most one priority
  - priority CTA
  - fixed actions are sale, expense, order
  - collection is absent from fixed actions and remains reachable contextually
  - recurring expense is absent
  - five destinations remain unchanged
  - numbers/activity occur after state/actions in DOM order
- **Success:** new assertions fail only where current composition differs from target.
- **Rollback:** revert test-only diff.

## Z1.2 — Recompose Home hierarchy

- **Goal:** make Home a daily decision surface.
- **Allowed files:** `Home.tsx`, Home-specific `index.css`, corresponding tests.
- **Visible change:** daily status, priority, upcoming/overdue, and fixed actions precede extended numbers and activity.
- **Must not change:** data sources, calculations, priority legality, destination routes.
- **Test:** Z1 Home tests and model tests.
- **Success:** target DOM order and one-priority contract pass without new data logic.
- **Rollback:** revert this step without affecting later steps.

## Z1.3 — Fix Home actions and contextual collection

- **Goal:** establish three fixed actions and contextual collection.
- **Allowed files:** `Home.tsx`; model/service only if an existing contextual item cannot express collection.
- **Visible change:**
  - sale, expense, and order are the fixed action cluster
  - collection appears only on relevant priority/daily rows
  - products/services and planned design do not compete as fixed daily actions
- **Must not change:** the actual sale, expense, order, collection, or catalog flows.
- **Tests:** Home action assertions, legal `returnTo`, navigation contract tests.
- **Success:** no fourth fixed collection action; contextual collection retains source return.
- **Rollback:** revert action composition only.

## Z1.4 — Normalize Home states

- **Goal:** make normal, empty, incomplete, loading, error, first-use, and safe-retry behavior explicit.
- **Allowed files:** Home source/model/reader and their tests, subject to no new business meaning.
- **Visible change:** each state states what is known, what is missing, and what the user can do.
- **Must not change:** unknown-to-zero behavior, financial meaning, setup completion, Foundation optionality.
- **Tests:** state-specific Home tests and state-recovery tests.
- **Success:** states are distinct, truthful, and do not invent metrics.
- **Rollback:** revert state composition and tests together.

## Z1.5 — Reduce Home Card overload

- **Goal:** use open Sections and Rows for sequential information.
- **Allowed files:** `Home.tsx`, Home-specific CSS, Home tests.
- **Visible change:** fewer visually equal containers; Card remains only for an independent priority/decision/receipt.
- **Must not change:** final visual identity or global Card styles.
- **Tests:** semantic structure and existing CSS/design guards.
- **Success:** no loss of action, label, status, or accessibility semantics.
- **Rollback:** revert Home markup/CSS only.

## Z1.6 — Z1 gate

- **Goal:** verify wave completion before Z2.
- **Action:** run targeted Z1 tests, prototype typecheck, relevant RTL/accessibility tests, then the full project gate.
- **Success:** all required tests pass; diff contains only Z1 allowlisted files; no navigation/route change.
- **Rollback:** return to the Z1 preflight checkpoint if failures require protected or out-of-scope changes.

---

# 6. Z2 Implementation Plan

## Z2.0 — Wave checkpoint and contract tests

- **Goal:** preserve accepted Z1 and encode Z2 journey/outcome contracts.
- **Allowed files:** Z2 test files.
- **Must not change:** Z1 source during test setup.
- **Tests to establish:**
  - stage and next action
  - estimated versus final
  - contextual collection
  - Success/Partial Success/Error/Retry
  - back/cancel/delete draft/reversal/correction vocabulary
  - OPS-003 warning and result distinctions
- **Success:** tests identify only approved Z2 gaps.
- **Rollback:** revert test-only diff.

## Z2.1 — Clarify work-list stage and next action

- **Goal:** make each order row understandable without opening it.
- **Allowed files:** `Orders.tsx`, its UI tests, directly scoped CSS.
- **Visible change:** current stage, one relevant qualifier, and next action.
- **Must not change:** sorting/business state, order transitions, cancellation rules.
- **Tests:** Orders UI, G3 journey/hardening tests.
- **Success:** each actionable row exposes a valid next step; no new state is invented.
- **Rollback:** revert list presentation only.

## Z2.2 — Clarify order detail journey

- **Goal:** communicate completed work, missing work, next action, and estimated/final status.
- **Allowed files:** OrderDetail and directly affected existing editors/tests.
- **Visible change:** a consistent stage/next-action presentation across the existing flexible journey.
- **Must not change:** transition legality or force a Wizard.
- **Tests:** order journey, delivery, reversal, void, stale-result, and share tests.
- **Success:** the user can identify stage and next step; review impact does not block closure.
- **Rollback:** revert order-detail/editor presentation without touching domain/service code.

## Z2.3 — Align quick sale outcome grammar

- **Goal:** make save, dependent failure, retry, and next action truthful.
- **Allowed files:** QuickSaleForm, DirectSaleEditor, QuickActionSheet only through protected exception, result feedback, tests.
- **Visible change:** explicit effect and outcome; no duplicate-submit ambiguity.
- **Must not change:** sale calculation, cash/credit policy, event identity.
- **Tests:** sale UI/service/round-trip and Quick Form tests.
- **Success:** event is never re-recorded to retry a dependent action.
- **Rollback:** revert presentation/feedback changes only.

## Z2.4 — Align expense and OPS-003 intersection

- **Goal:** preserve fast manual expense while applying shared result grammar.
- **Allowed files:** QuickExpenseForm and tests; `FinancialEventEditor.tsx` only via protected exception if its current warning needs presentation integration.
- **Visible change:**
  - visible non-blocking recurring-occurrence warning
  - manual expense remains directly available
  - retained input on failure
  - safe Retry
  - distinct canonical save and dependent attribution result
- **Must not change:** recurring pages, recurring lifecycle, financial writer, due-date logic, occurrence resolution.
- **Tests:** manual expense, guided editor, OPS-003 surface, idempotency, and period-result tests.
- **Success:** warning neither blocks nor silently resolves recurring occurrence; no duplicate event.
- **Rollback:** revert expense presentation while keeping OPS-003 implementation intact.

## Z2.5 — Clarify contextual collection

- **Goal:** connect collection to its source and accurately present partial/complete settlement.
- **Allowed files:** Collect, OrderDetail, result feedback, directly related tests.
- **Visible change:** source identity, amount, remaining amount, cash effect, next action, and return context.
- **Must not change:** collection calculations or reversal policy.
- **Tests:** collection and sale-collection reversal tests plus relevant DOM tests.
- **Success:** partial collection is never presented as complete; contextual return is preserved.
- **Rollback:** revert collection UI only.

## Z2.6 — Unify correction, reversal, and delete-draft language

- **Goal:** prevent destructive-term ambiguity.
- **Allowed files:** only affected Z2 surfaces and result feedback.
- **Visible change:** consistent labels and explanations matching existing contracts.
- **Must not change:** correction or reversal implementation and eligibility.
- **Tests:** correction history, reversal surfaces, void, delete-draft, and domain correction tests.
- **Success:** completed history is never described as deletable; draft deletion remains limited to drafts.
- **Rollback:** revert copy/composition changes only.

## Z2.7 — Verify supporting touchpoints

- **Goal:** ensure directly linked party/product/material/supplier/finance surfaces preserve context.
- **Default:** read-only verification and non-regression only. No supporting surface may be edited by default.
- **Edit gate:** an edit is blocked unless a specific Z2 acceptance criterion cannot pass without it, a necessity note identifies the exact file and minimal diff, and the owner separately approves that edit.
- **Allowed files:** conditional supporting allowlist only after the edit gate passes.
- **Visible change:** only the minimum label, return, or result clarification required by a Z2 flow.
- **Must not change:** standalone destination composition.
- **Tests:** existing touchpoint tests for the changed file.
- **Success:** no secondary-domain redesign and no broken deep link.
- **Rollback:** revert each optional touchpoint independently.

## Z2.8 — Z2 gate

- **Goal:** verify Z2 and full non-regression.
- **Action:** run targeted Z2 tests, OPS-003 protection tests, prototype typecheck, RTL/accessibility tests, and full project gate.
- **Success:** all required tests pass; Z1 remains intact; diff remains allowlisted; OPS-003 is unchanged except an explicitly approved warning presentation if necessary.
- **Rollback:** revert Z2 to its checkpoint without reverting Z1.

---

# 7. Tests and CI

## 7.1 Exact project commands

Run from repository root:

- Root tests: `pnpm test`
- Prototype tests: `pnpm prototype:test`
- Root typecheck: `pnpm typecheck`
- Prototype typecheck: `pnpm prototype:check`
- Repository guards: `pnpm guards`
- Design guards: `pnpm design-guards`
- Full gate: `pnpm check`

Targeted prototype tests:

`pnpm --filter @micro/prototype-web exec vitest run <client/src/test-file> [additional files]`

Do not change these commands, install packages, or repair the environment as part of Z1/Z2.

## 7.2 Z1 targeted gate

Run at minimum:

- `client/src/Home.dom.test.tsx`
- `client/src/HomeRedesign.w43.dom.test.tsx`
- `client/src/application/home/homeControlCenterModel.test.ts`
- `client/src/application/home/homeControlCenterService.test.ts`
- `client/src/app/navigation.test.ts`
- `client/src/app/navigationContract.test.ts`
- `client/src/app/routeClassifier.test.ts`
- `client/src/app/routeKnowledgeSync.test.ts`
- `client/src/ArabicRtlContent.w44.dom.test.tsx`
- `client/src/Accessibility.w44.dom.test.tsx`
- `client/src/U09.css.test.ts`
- `client/src/StateRecovery.w44.dom.test.tsx`

Then run:

1. `pnpm prototype:check`
2. `pnpm design-guards`
3. `pnpm check`

## 7.3 Z2 targeted gate

Run affected tests from:

### Orders and work

- `client/src/pages/Orders.ui.test.tsx`
- `client/src/G3.dom.test.tsx`
- `client/src/G3Hardening.dom.test.tsx`
- `client/src/G3Delivery.dom.test.tsx`
- `client/src/OrdJourneys.dom.test.tsx`
- `client/src/R1.orderDetailVoid.test.tsx`
- relevant order stale-result and commit-guard tests

### Sale and quick forms

- `client/src/pages/DirectSaleEditor.ui.test.tsx`
- `client/src/application/direct-sales/directSaleService.test.ts`
- Quick Action Sheet tests
- `client/src/QuickFormsEnter.w43.dom.test.tsx`
- `client/src/QuickFormsNotify.dom.test.tsx`

### Expense

- `client/src/pages/FinancialEventEditor.ui.test.tsx`
- `client/src/pages/FinancialEventEditor.guided.test.tsx`
- `client/src/QuickExpenseSource.dom.test.tsx`
- `client/src/application/finance/expenseRecordIntent.test.ts`
- applicable project financial service tests

### Collection, correction, reversal

- collection service and reversal tests
- `client/src/ReversalSurfacesExe010.dom.test.tsx`
- `client/src/application/finance/correctionHistoryService.test.ts`
- `client/src/R2.financeActivityVoid.test.tsx`
- affected domain correction tests

## 7.4 OPS-003 non-regression gate

Run at minimum:

`pnpm --filter @micro/prototype-web exec vitest run client/src/RecurringExpenseSurfaces.dom.test.tsx client/src/pages/FinancialEventEditor.ui.test.tsx client/src/pages/FinancialEventEditor.guided.test.tsx client/src/application/finance/recurringExpenseService.test.ts client/src/application/finance/periodResultCanonical.test.ts`

If an OPS-003 test fails, do not “fix” recurring Domain, Storage, lifecycle, or pages inside Z2. Determine whether Z2 broke a protected contract. If not, stop and report the pre-existing or external blocker.

## 7.5 Failure policy

When a test fails:

1. Stop the current step.
2. Identify whether the failure is:
   - caused by the current diff
   - pre-existing
   - environmental
   - outside the wave
3. Fix only failures caused by the current allowlisted diff.
4. Do not broaden scope to make the suite green.
5. If a protected-file change appears necessary, use the exception protocol.
6. Do not move to the next wave with a failing required test.
7. Record blocked tests with command, output summary, reason, and impact.

---

# 8. Visual and Manual QA

## 8.1 Current limitation

The audit environment previously lacked a runnable Vite command. Z1/Z2 must not repair Vite or Replit Workflow. If Zed’s approved implementation environment already runs safely, perform visual QA. Otherwise mark visual checks `Blocked` with the exact environment reason after automated tests.

## 8.2 Required Home scenarios

- First use after setup.
- Normal day with no urgent item.
- Empty day.
- One urgent priority.
- Incomplete financial data.
- Loading.
- Error and Retry.
- Long Arabic project name.
- Large amount.
- Fixed actions show only sale, expense, order.
- Contextual collection appears only with relevant state.
- No recurring-expense Card, CTA, action, or KPI.
- Numbers and activity follow state/actions.
- No duplicate amount or repeated action.

## 8.3 Required Z2 scenarios

- Draft order.
- Order needing agreement.
- Order in execution.
- Order ready for delivery.
- Delivered order with full collection.
- Delivered order with partial collection.
- Missing or estimated cost.
- Sale success.
- Sale dependent-step partial success.
- Expense success.
- Expense save failure with retained input.
- Manual expense with recurring-occurrence warning.
- Collection success and partial collection.
- Delete draft.
- Correction.
- Reversal.
- Result Unknown where the existing contract exposes it.

## 8.4 Viewports

When Preview is safely available, test portrait at:

- 320px
- 360px
- 390px
- 430px

Verify:

- no unintended horizontal overflow
- Arabic wrapping
- long names and amounts
- primary action visibility
- a single main scroll owner
- Bottom Navigation does not cover content
- sticky actions do not compete with Bottom Navigation
- Sheets and dialogs respect Safe Area

## 8.5 Keyboard, focus, and touch

Verify:

- focused field remains visible
- keyboard does not cover the primary action
- Sheet/Dialog focus trap
- focus returns to its trigger
- first validation error can be found
- visible focus state
- all interactive targets are at least 44–48px where required
- text actions inside paragraphs are usable

## 8.6 RTL and mixed content

Verify:

- directional icons
- leading/trailing order
- numbers and currency isolation
- dates
- mixed Arabic/Latin names
- native date/month controls
- Back behavior
- Sheet/Dialog alignment

## 8.7 Visual-product checks

- Micro does not look like a financial dashboard.
- Home is not a Card grid.
- Cards are reserved for independent decisions/entities.
- Rows and open Sections carry sequential information.
- Color is not the only status signal.
- no final visual-identity redesign was introduced
- no Dark Mode work was added
- `dueOn` and `occurredOn` are not conflated

---

# 9. Acceptance Criteria

## 9.1 Z1 acceptance

- [ ] Bottom Navigation still has exactly five existing destinations in the existing order.
- [ ] No destination label or route ownership changed.
- [ ] Home communicates daily status before extended metrics.
- [ ] Home shows at most one primary priority.
- [ ] The priority has one primary CTA.
- [ ] The fixed Home actions are sale, expense, and order.
- [ ] Collection is contextual, not a fixed fourth action.
- [ ] Products/services do not compete as a fixed daily action.
- [ ] No recurring-expense action, Card, CTA, or KPI appears.
- [ ] Normal, empty, incomplete, loading, error, first-use, and safe-retry states are distinct.
- [ ] Unknown/incomplete values are not shown as zero.
- [ ] Numbers and activity appear after state and actions.
- [ ] Duplicate numbers/actions were removed from Home.
- [ ] Card overload was reduced in Home without global visual-system changes.
- [ ] Home links preserve legal `returnTo`.
- [ ] Tools and Market remain untouched.
- [ ] No financial Dashboard, Chart, or navigation action was added.
- [ ] Z1 targeted and full gates pass, or environmental blockers are documented.
- [ ] Diff contains only approved Z1 files.

## 9.2 Z2 acceptance

- [ ] Work list shows current stage and next action.
- [ ] Order detail shows completed, missing, and next work.
- [ ] Estimated and final values are distinguishable where already supported.
- [ ] Journey remains flexible and is not converted to a mandatory Wizard.
- [ ] Review impact does not block order closure.
- [ ] Collection remains a separate contextual operation.
- [ ] Partial collection is not presented as complete.
- [ ] Sale, expense, and collection follow the shared operation grammar.
- [ ] Success explains what happened and what changed.
- [ ] Partial Success separates completed and incomplete parts.
- [ ] Save Error preserves input and offers safe Retry.
- [ ] Incomplete Data is not converted to zero or final success.
- [ ] Reversal and Correction preserve history.
- [ ] Delete applies only to eligible drafts.
- [ ] Back, cancel, delete draft, reversal, and correction are not used interchangeably.
- [ ] Manual expense remains directly available.
- [ ] Existing recurring-occurrence warning is visible and non-blocking.
- [ ] `recorded`, `reused`, `record_failed`, and `result_unknown` remain distinct.
- [ ] `reused` is neither Error nor Partial Success.
- [ ] `result_unknown` does not claim success/failure or permit blind resubmission.
- [ ] A dependent attribution failure does not re-record the financial event.
- [ ] `dueOn` and `occurredOn` remain distinct.
- [ ] Reversal does not reopen a recurring occurrence automatically.
- [ ] OPS-003 routes, `returnTo`, and unsaved-input guards remain valid.
- [ ] Recurring-expense pages were not redesigned.
- [ ] No financial calculation, rule, writer, Domain, Storage, or migration changed.
- [ ] Z1 remains accepted.
- [ ] Z2 targeted, OPS-003, and full gates pass, or environmental blockers are documented.
- [ ] Diff contains only approved Z2 files and explicitly approved conditional files.

---

# 10. Rollback Boundaries

## 10.1 Checkpoints

Create independent checkpoints/commits:

1. Baseline branch point.
2. Z1 contract tests.
3. Z1 implementation complete.
4. Z1 verified.
5. Z2 contract tests.
6. Z2 implementation complete.
7. Z2 verified.

Do not mix Z1 and Z2 source changes in one commit.

## 10.2 Reverting Z1

Z1 can be reverted by reverting Z1 commits before Z2 begins. Z1 must not modify order, sale, expense, collection, finance, recurring, Domain, or Storage files.

If Z2 has already begun, revert only after identifying Z2 dependencies on the accepted Home contract. Do not manually roll back shared history without a clean checkpoint.

## 10.3 Reverting Z2

Revert Z2 commits only. Z1 Home files and accepted tests must remain unchanged unless Z2 explicitly added a test-only non-regression assertion.

## 10.4 Expected diff

### Z1

Expected:

- Home source.
- Home model/reader only when justified.
- Home-specific CSS selectors.
- Home/model/reader tests.

Unexpected:

- Router/navigation.
- secondary destination pages.
- finance/order/recurring services.
- Domain/Storage.

### Z2

Expected:

- affected order/work surfaces.
- quick sale/expense surfaces.
- contextual collection surface.
- result-feedback composition.
- directly corresponding tests.
- narrowly scoped CSS selectors.

Unexpected:

- navigation destinations.
- Router.
- recurring pages.
- Domain/Storage/migrations.
- unrelated secondary-domain redesign.
- global identity/token changes.

## 10.5 Scope violations

Any of the following is a scope violation:

- New destination or route family.
- Changed Bottom Navigation.
- Added recurring action/KPI/Card on Home.
- Changed financial calculation, writer, event meaning, or transition legality.
- Changed Domain, Storage, migration, schema, export, Auth, API, or database.
- Activated Market.
- Removed or merged Tools.
- Added Chart, Goal, Gamification, Dark Mode, tablet, desktop, or final identity work.
- Refactored, moved, or reorganized files without direct necessity.
- Modified a protected file without the exception record.
- Added a dependency or repaired Vite/Workflow.
- Changed unlisted files for cleanup.

## 10.6 Undocumented dependency

If implementation reveals an undocumented dependency:

1. Stop the current step.
2. Record the dependency and affected acceptance criterion.
3. Determine whether it is presentation-only or functional.
4. If protected or functional, request owner approval.
5. Do not silently add it to the allowlist.

---

# 11. Zed Operating Contract

Zed AI must follow these rules:

This package is the complete implementation scope for this task. Any proposal mentioned in the historical reports but absent from the explicit Z1/Z2 scope, acceptance criteria, and protected-boundary rules is not approved and is automatically deferred. Zed must not infer additional requirements or convert general observations into implementation.

1. Do not work directly on `main`.
2. Create an independent implementation branch from the approved baseline.
3. Confirm baseline SHA and clean status before editing.
4. Do not add features outside Z1/Z2.
5. Do not alter Architecture or move/reorganize files.
6. Do not change Business Logic, calculations, Domain, Database, API, Storage, Auth, schema, migrations, snapshots, or export.
7. Do not repair Vite or Replit Workflow.
8. Do not install or upgrade dependencies.
9. Do not redesign OPS-003 recurring-expense screens.
10. Do not add recurring expense to Home.
11. Do not add Quick Actions or navigation destinations.
12. Do not change Tools or Market ownership.
13. Do not establish a final visual identity.
14. Follow the file allowlist.
15. Use the protected-file exception protocol before any protected edit.
16. Keep Z1 and Z2 commits separate.
17. Review the full diff before each commit.
18. Run required tests after each step and full gates after each wave.
19. Do not continue to Z2 if Z1 is failing.
20. Do not hide a failed test by weakening or deleting it.
21. Do not change an existing financial/state contract to fit a visual design.
22. Preserve Arabic, RTL, ASCII/LTR financial-number isolation, and phone-first behavior.
23. Produce a report after each wave containing:
    - files changed
    - visible behavior changed
    - contracts preserved
    - tests and commands run
    - results and blockers
    - protected-file exceptions
    - deferred work
24. Stop for owner input when a required decision is not specified here.

---

# 12. Final Definition of Done

The complete task is done only when:

- [ ] Implementation used an approved independent branch and baseline.
- [ ] Z1 is complete and accepted.
- [ ] Z1 targeted tests pass.
- [ ] Z1 full gate passes or an environmental blocker is documented without hidden code fixes.
- [ ] Z2 is complete and accepted.
- [ ] Z2 targeted tests pass.
- [ ] OPS-003 non-regression tests pass.
- [ ] Z2 full gate passes or an environmental blocker is documented.
- [ ] Diff is limited to the approved allowlist and documented exceptions.
- [ ] Bottom Navigation remains unchanged.
- [ ] No new destination, route family, or finance navigation action exists.
- [ ] Home fixed actions are sale, expense, and order.
- [ ] Collection is contextual.
- [ ] Tools and Market remain in place and unchanged in ownership.
- [ ] Home is clearer without becoming a financial dashboard.
- [ ] Order stage and next action are visible and truthful.
- [ ] Operation outcomes distinguish Success, Partial Success, Error, Retry, Incomplete Data, Reused, Result Unknown, Reversal, Correction, and Delete Draft where applicable.
- [ ] No financial or operational history was made deletable.
- [ ] No financial meaning, calculation, or business rule changed.
- [ ] OPS-003 remains protected.
- [ ] Manual expense remains allowed with a non-blocking warning.
- [ ] No automatic recurring recording, duplicate event, or history deletion was introduced.
- [ ] Arabic, RTL, phone-first, and portrait-first constraints are preserved.
- [ ] Visual QA was completed at 320/360/390/430 or marked Blocked with exact reason.
- [ ] Keyboard, Safe Area, Focus, Touch, Contrast, Motion, and state checks were completed or documented as Blocked.
- [ ] Z1 and Z2 delivery reports are complete.
- [ ] Deferred work is listed and no deferred work was implemented implicitly.

---

# Blocked / Owner Decision

No additional owner decision is required to begin Z1 and Z2 as specified.

Stop and request owner input if implementation requires any of the following:

- changing the fixed five destinations
- adding a fixed Home action
- adding recurring-expense information to Home
- changing the legal meaning or order of an operation
- adding a new state not available from current contracts
- changing a protected functional file
- selecting a final visual identity
- expanding a secondary domain into a standalone redesign

---

# Deferred to later waves

- Final visual identity.
- Final palette.
- Final typography.
- Final radius, shadow, elevation, and motion systems.
- Dark Mode.
- Tablet and desktop.
- Charts.
- Goals.
- Gamification.
- Full Finance redesign.
- Full Tools redesign or relocation.
- Market activation or redesign.
- Full Catalog redesign.
- Full Parties redesign.
- Full Inventory redesign.
- Full Suppliers/Purchases redesign.
- Full report/search/filter redesign.
- Detailed OPS-003 recurring-expense redesign.
- Recurring-expense Home reminders.
- Full-screen design for `result_unknown`.
- Changing recurring entry placement inside Finance.
- Arbitrary recurrence engines or push notifications.
- Architecture, refactoring, file moves, and module reorganization.
- Database, API, Storage, Auth, permissions, schema, migrations, snapshots, or export changes.
- Business Logic, financial calculations, or accounting-policy changes.
- Vite, Replit Workflow, dependency, or toolchain repair.
- Any topic not explicitly included in Z1 or Z2 above.
