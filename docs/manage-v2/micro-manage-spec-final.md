# Micro Manage — Financial Core Implementation Spec

**Version 1.1 — approved on 25/11/2026.** (1.1 = component boundaries + architecture rules §14; no financial logic changed.)

**Status:** Binding implementation specification.
**Derived from:** `micro-manage-concept-final.md` (Arabic product concept). Product-owner decisions made after the concept (R-17 … R-28) are recorded here and are binding. **This spec is the single binding reference for implementation**; the concept explains the product. If anything here conflicts with the concept, this spec wins and the conflict is reported to the product owner.
**Audience:** Implementing agents.
**Out of scope here:** programming language, framework, physical storage engine, UI layout.

**⚠️ Money unit (fixed decision):** JOD with **3 decimals**. Minor unit = **fils = 1/1000 JOD**. All amounts are stored as integer fils. Qirsh (1/100) must not be used as a storage unit anywhere. See R-1, R-1a.

**⚠️ Display & platform (fixed decisions):** Western digits only (0–9); thousands separator `,` and decimal point `.` (`1,250.000`); dates `dd/mm/yyyy` everywhere, never month names; currency JOD only, symbol «د» after the amount (`1,250.000 د`); the **Micro app** runs online only on a Cloudflare-hosted database with Google sign-in (**app-level, not built by this spec**, see §0.1). See R-20 … R-28 and §14.

**Golden rule:** Every financial number is computed from ledger postings. Nothing else may change a financial number.

---

## 0.1 Context: Micro Manage is one component of the Micro app

The Micro app has several components: **Micro Manage** (this spec), **Micro Delivery**, **Micro Market**, and **Tools** (أدواتي). The bottom navigation is app-level: المالية · الطلبات · مشروعي الآن · التوصيل · السوق.

| Concern | Owner | What Manage does |
|---|---|---|
| Sign-in (Google), account, session, session expiry, sign-out | **App** | Uses the app's signed-in account id. **Manage builds no sign-in, no account table, no session logic** |
| Account deletion and data deletion | **App** (roadmap item) | Must expose a way for the app to delete all Manage data of a project (see §14.6) |
| Online platform, database hosting, connection handling, the "no connection" screen | **App** | Uses the app's database and server; shows `E-OFFLINE` only when a Manage save fails |
| Bottom navigation, app shell, global settings screen | **App** | Provides the content of the tabs المالية · الطلبات · مشروعي الآن, and its own settings section (project name) |
| Number, date and currency display (R-20 … R-22) | Manage rules; **if the app has a shared formatter, Manage uses it and it must follow these rules** | — |
| Everything financial in this spec (ledger, operations, sales, products, boxes, reconciliation, reports, screens of the three tabs) | **Manage** | Owns and builds it |

**Rule:** anything marked *App* must be reused from the existing app, or added at app level for all components, never built inside Manage.

## 0. How to use this spec

1. Implement in the order of §12.
2. Every rule has an ID (`R-…`, `OP-…`, `E-…`, `INV-…`, `T-…`). Reference IDs in code comments, commits and tests.
3. **Do not improvise.** Any case not covered here: stop and escalate. Do not invent accounting behaviour.
4. User-visible Arabic text must come **only** from §10 (UI strings) and §11 (error messages). Do not write new Arabic copy.
5. Acceptance = all tests in §13 pass, and `INV-1` holds at the end of every test.

---

## 1. Glossary (use these identifiers everywhere)

| Code identifier | Arabic (UI) | Meaning |
|---|---|---|
| `Box` | الصندوق | A place where money is held. Kinds: `cash` (نقد), `account` (حساب) |
| `Product` | منتج (منتجاتي) | A sellable item with price and cost components |
| `Sale` | بيع / طلب | One sale. Future planned date = order (طلب); same day = direct sale (بيع مباشر) |
| `SaleLine` | بند | One line in a sale |
| `Tracker` | متتبّع الطلبات | Calendar/list view of tracked sales |
| `BalanceLine` | مستحق / التزام | An open amount owed to or by the owner |
| `Receivable` (direction `to_me`) | مستحق لك | Owed to the owner |
| `Payable` (direction `by_me`) | التزام عليك | Owed by the owner |
| `Prepayment` | دفعة مقدمة | Money received for a sale before delivery |
| `Delivery` | التسليم | The moment a sale becomes revenue |
| `Collection` | تحصيل | Receiving money against a receivable |
| `Payment` | سداد | Paying money against a payable |
| `Expense` | مصروف أو شراء | Any cost. No inventory |
| `OwnerDeposit` | إيداع شخصي | Owner puts personal money in |
| `Borrow` | مبلغ مستدان من شخص | Money borrowed from a person (no interest) |
| `OwnerWithdrawal` | سحب شخصي | Owner takes money for personal use |
| `Lend` | سلفة لشخص | Money lent to a person |
| `Transfer` | تحويل | Between the two boxes |
| `Return` | مرتجع | Return after delivery |
| `WriteOff` | لن يُحصَّل | A receivable that will not be collected |
| `Overpayment` | زيادة محصَّلة | Customer paid more than owed on a sale; kept as revenue |
| `Reconciliation` | المطابقة | Comparing recorded vs actual box balances |
| `UnexplainedDifference` | فرق غير مفسَّر | Residual after reconciliation questions |
| `Absence` | انقطاع | ≥14 days without any operation |
| `Operation` | حركة (في سجل الحركات) | A user action; produces 0..n ledger entries |
| `LedgerEntry` | قيد (internal) | Immutable accounting entry; never shown by this name |
| `ExpectedProfit` | ربح متوقع | Sale price − expected cost − sale delivery cost. Never part of actual profit |
| `NetProfit` | صافي الربح | Actual profit from the ledger |
| `NetWorth` | صافي قيمة المشروع | Boxes + receivables − payables − prepayments |
| `Incomplete` | بيانات غير مكتملة | Flag on a period affected by absence or unknown opening balance |

---

## 2. Global rules

| ID | Rule |
|---|---|
| R-1 | Currency is JOD only. Money is stored as **integer minor units: fils = 1/1000 JOD** (ISO 4217 minor unit for JOD = 3 decimals), type 64-bit integer. Floating point is forbidden for money anywhere (storage, computation, transport). |
| R-1a | Display: inputs, activity log, sale details and reports always show 3 decimals (`12.350`, `25.000`). Dashboard sentences (§10.5) show whole amounts without decimals (`700`) and fractional amounts with 3 decimals. Formatting never changes stored values. |
| R-2 | Rounding: half-up to the nearest fils, applied **once** at the end of each multiplication/division. Line value = `round_half_up(quantity × unit_price)`. |
| R-3 | Quantities: positive, max 3 decimals, stored as integer **milli-units** (`2.5` → `2500`). |
| R-4 | Time zone: `Asia/Amman`. All business dates are local dates (`DATE`). |
| R-5 | Week = Sunday→Saturday. Month and year = Gregorian. "Since start" = from the earliest operation's effective date. |
| R-6 | Absence threshold: 14 days since the last operation's `created_at`. *App open* = launching the app, or returning to it after at least 60 minutes in the background. |
| R-7 | Overdue receivable: open receivable whose `origin_on` is ≥14 days ago. |
| R-8 | Reconciliation due: ≥7 days since last reconciliation (or project creation) **and** ≥1 money operation since then. A *money operation* = any operation with at least one `BOX` posting. «لاحقاً» hides the reminder until the next app open. |
| R-9 | Max 2 boxes per project: at most one `cash`, at most one `account`. |
| R-10 | Expense categories (fixed enum): `materials_packaging` (مواد وتغليف), `utilities` (كهرباء ومياه), `gas` (غاز), `rent` (إيجار), `transport` (تنقّل), `ads` (إعلانات), `tools` (أدوات), `equipment` (معدات), `other` (أخرى). Internal-only category: `sale_delivery` (توصيل طلب), created only from a sale's delivery-cost field; never offered in the expense form. |
| R-11 | No financial record is ever deleted or updated in place. Corrections are reversals + new entries. |
| R-12 | Every operation is atomic: all its entries are written, or none. After applying, all balance lines and prepayments must be ≥ 0 (`INV-2`), else the whole operation is rejected. |
| R-13 | Money operations cannot have a future effective date. (A sale's planned delivery date may be in the future; it is not a money operation.) |
| R-14 | Counterparty names are free text, trimmed. No customer/supplier entities. Name matching is exact after trimming. The UI offers suggestions from previously used names. |
| R-15 | Expected cost/profit never enters revenue or expense. |
| R-16 | Single user per project. No roles, no multi-user concurrency requirements. |
| R-17 | Non-financial edits (project name, sale fields before delivery, customer name, tracker flags, notes, registered date, products) are plain updates, not operations. |
| R-18 | "From my personal money" (`personal`) always posts on the **cash** box (Q10 + the paying entry on cash), whether the project has one or two boxes. |
| R-19 | Age display for balance lines and overdue items (Arabic number agreement): 0 days «اليوم» · days: 1 «منذ يوم» · 2 «منذ يومين» · 3–10 «منذ {n} أيام» · 11–13 «منذ {n} يوماً»; 14–55 days in weeks (floor(days/7)): 2 «منذ أسبوعين» · 3–7 «منذ {n} أسابيع»; ≥ 56 days in months (floor(days/30)): 1 «منذ شهر» · 2 «منذ شهرين» · 3–10 «منذ {n} أشهر» · ≥ 11 «منذ {n} شهراً». |
| R-20 | **Digits & separators:** Western digits only. Thousands separator `,`, decimal point `.`. Inputs, activity log, details, reports and reconciliation: always 3 decimals (`1,250.000`). Dashboard sentences (§10.5) **and every figure shown on «مشروعي الآن»** (including the reconciliation reminder and paid indicators there): whole amounts without decimals (`1,250`), fractional amounts with 3 decimals. The per-10 ratio `{x}` is not an amount: one decimal, no currency symbol. |
| R-21 | **Dates:** `dd/mm/yyyy` everywhere (lists, details, pickers, reports, messages). No month names, no Hijri dates. Weekday names are allowed only as calendar column headers. Period labels: day `25/11/2026`; week `22/11/2026 – 28/11/2026`; month `11/2026`; year `2026` (calendar header, profit bars, report period). |
| R-22 | **Currency symbol:** «د» only, after the amount with one space (`25.000 د`, `1,250 د`). Shown wherever an amount is displayed; amount inputs show it as a fixed suffix. No other currency code or symbol anywhere. |
| R-23 | **Online only (app-level platform).** Manage data lives in the app's Cloudflare-hosted database (engine confirmed at implementation, §14.7). Manage has no offline mode: if a Manage save cannot reach the server, nothing is saved and `E-OFFLINE` is shown. The "no connection" screen at app start, session expiry and sign-out are **app-level** (§0.1). The server is the single source of truth; per-entry balance (§3.8), INV-2 and all validations are enforced server-side inside one database transaction per operation (R-12). |
| R-24 | **Identity (app-level).** Sign-in is done by the Micro app (Google). Manage reads the signed-in **app account id** and never implements authentication. In v1, one app account owns at most one Manage project. The first time a signed-in user opens Manage without a project, Manage onboarding (P-01) starts; otherwise the app opens on «مشروعي الآن». |
| R-25 | **Idempotency:** every save carries a client-generated request id; the server applies a request at most once (safe retries after timeouts). |
| R-26 | **Effective dates:** every money operation accepts `effective_on` (default today, ≤ today, R-13) unless stated otherwise. Exceptions: OP-ADD-BOX, OP-MERGE-BOXES, OP-SPLIT-BOXES, OP-RECONCILE and the «حُصِّل أو سُدِّد» action of the return flow use today; the immediate collection inside OP-DELIVER (and inside a same-day sale) uses the actual delivery date and has no separate date field. |
| R-27 | **Defaults:** dashboard period = month; activity-log period filter = since start; tracker view = calendar (week, Sunday→Saturday). |
| R-28 | **Activity grouping (display only).** Fixed groups, created by one user action: (1) **same-day sale** = SALE_CREATE + DELIVER + COLLECT (+ SALE-DELIVERY-COST, + WRITE-OFF/overpayment) → label `op.sale`, amount = final price; (2) **new order** = SALE_CREATE + PREPAYMENT (+ SALE-DELIVERY-COST) → label `op.sale`, amount = final price or blank; (3) **delivery with collection** = DELIVER + COLLECT (+ WRITE-OFF/overpayment) → label `op.deliver`, amount = price. A grouped row matches the type filter of **any** of its parts. Its details list each operation with its own edit/cancel actions (§5.0 rules). No other operations are grouped. |

---

## 3. Data model (logical schema)

Relational logical model. Types: `UUID`, `TEXT`, `BIGINT` (money in fils), `INT`, `BOOLEAN`, `DATE` (Amman local date), `TIMESTAMPTZ`. All tables carry `project_id UUID NOT NULL` (omitted below for brevity) and are scoped by it. Storage is a Cloudflare-hosted relational database (R-23); the logical tables map directly to physical tables. Immutability (§3.8) must be enforced in the database layer as well (no UPDATE/DELETE paths for ledger tables).

### 3.1 `project`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| name | TEXT | NOT NULL, non-empty. Editable at any time (no financial effect) |
| owner_account_id | TEXT | NOT NULL, UNIQUE. The **app account id** provided by the Micro app's identity (R-24). Manage has no users table |
| created_at | TIMESTAMPTZ | NOT NULL |

### 3.2 `box`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| kind | TEXT | `cash` \| `account`; UNIQUE (project_id, kind) |
| status | TEXT | `active` \| `merged` |
| opening_status | TEXT | `known` \| `unknown` |
| created_on | DATE | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |

Balance is **not stored**. `opening_status` changes `unknown → known` only via first reconciliation (§7.3).

### 3.3 `product` and `product_component`
| `product` | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| unit_label | TEXT | NULL (e.g. قطعة، كغ، صحن) |
| unit_price_minor | BIGINT | NOT NULL, ≥ 0 |
| archived | BOOLEAN | NOT NULL default false |
| created_at / updated_at | TIMESTAMPTZ | |

| `product_component` | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| product_id | UUID | FK product |
| name | TEXT | NOT NULL |
| cost_minor | BIGINT | NOT NULL, ≥ 0 |
| position | INT | ordering |

Product unit cost = Σ components; if zero components → **unknown** (NULL), not 0. Products are mutable; sales keep their own snapshot. Validation: name required (`E-NAME-REQUIRED`), unit price required (`E-UNIT-PRICE-REQUIRED`); a component row needs both name and cost or is discarded. Archived products are excluded from line suggestions and can be unarchived.

### 3.4 `sale`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| customer_name | TEXT | NULL. Required (non-empty) when planned_delivery_on > today, or when an amount remains open after a same-day sale |
| registered_on | DATE | NOT NULL, default today, editable (no financial effect) |
| planned_delivery_on | DATE | NOT NULL |
| final_price_minor | BIGINT | NULL; > 0 when set; required before delivery |
| cancelled_on | DATE | NULL (set by OP-CANCEL-SALE) |
| tracked | BOOLEAN | NOT NULL. Default: `true` if planned_delivery_on > today at creation, else `false` |
| hidden_from_tracker | BOOLEAN | NOT NULL default false |
| note | TEXT | NULL |
| created_at / updated_at | TIMESTAMPTZ | |

Delivery state is **not a column**: a sale is delivered iff it has an active (non-reversed) `DELIVERY` entry; `delivered_on` = that entry's `effective_on`. Status is derived (§6).

Editable fields before delivery: lines, quantities, final price, planned date, customer name, note. After delivery: lines, quantities and planned date are **locked**; price changes only via OP-PRICE-CORRECTION. `customer_name`, `tracked`, `hidden_from_tracker`, `note`, `registered_on` are always editable and have no financial effect (a renamed customer carries the sale's open remainder/refund lines with it, since those lines take the name from the sale).

**Sale edits are not operations (R-17).** Editing a sale's non-financial fields before delivery updates the `sale` row directly; it creates no operation, no ledger entry, and no "معدَّلة" label. The sale shows its last edit time.

### 3.5 `sale_line` (snapshot)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| sale_id | UUID | FK sale |
| position | INT | |
| product_id | UUID | NULL (NULL = free-text line) |
| description | TEXT | NOT NULL (product name at time of sale, or free text) |
| quantity_milli | INT | NOT NULL, > 0, default 1000 |
| unit_price_minor | BIGINT | NULL for free text until entered |
| unit_cost_minor | BIGINT | NULL = unknown (free text, or product without components) |
| components_snapshot | JSON | NULL; per-sale edited components `[{name, cost_minor}]` |

A sale must have ≥1 line. Default final price = Σ `round_half_up(quantity × unit_price)` over lines with a price.

### 3.6 `balance_line`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| direction | TEXT | `to_me` \| `by_me` |
| kind | TEXT | to_me: `sale_remainder`, `prior_receivable`, `loan_given` · by_me: `supplier`, `prior_payable`, `borrowed`, `customer_refund` |
| counterparty_name | TEXT | NULL only for `sale_remainder`/`customer_refund` (then taken from sale) |
| origin_on | DATE | NOT NULL |
| sale_id | UUID | NULL; set for `sale_remainder`, `customer_refund` |
| origin_operation_id | UUID | FK operation |

Outstanding amount is **not stored**; it is Σ postings on account `AR`/`AP` referencing the line.

### 3.7 `operation` (what the activity log shows)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| kind | TEXT | One of §5 operation kinds |
| effective_on | DATE | NOT NULL; ≤ today for money operations |
| status | TEXT | `active` \| `reversed` |
| corrects_operation_id | UUID | NULL; set on the replacement of a corrected operation |
| reversed_by_operation_id | UUID | NULL |
| box_id | UUID | NULL |
| sale_id | UUID | NULL |
| balance_line_id | UUID | NULL |
| counterparty_name | TEXT | NULL |
| category | TEXT | NULL (expense category) |
| amount_minor | BIGINT | NULL (display amount) |
| delivery_cost_minor | BIGINT | NULL (expense: delivery portion shown as "منها توصيل") |
| payload | JSON | operation-specific inputs |
| note | TEXT | NULL |
| created_at | TIMESTAMPTZ | NOT NULL |

### 3.8 `ledger_entry` and `ledger_posting` (immutable)
| `ledger_entry` | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| operation_id | UUID | FK operation, NOT NULL |
| entry_type | TEXT | `Q1`…`Q20` (§4) |
| effective_on | DATE | NOT NULL |
| reverses_entry_id | UUID | NULL; set only on Q20 |
| created_at | TIMESTAMPTZ | NOT NULL |

| `ledger_posting` | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| entry_id | UUID | FK ledger_entry |
| account | TEXT | `BOX`, `AR`, `AP`, `PRE`, `REV`, `EXP`, `OPEN`, `OWN_IN`, `OWN_OUT`, `UNEXP` |
| ref_id | UUID | BOX→box.id · AR/AP→balance_line.id · PRE→sale.id · REV→sale.id (nullable) · others NULL |
| category | TEXT | EXP only (R-10) |
| rev_kind | TEXT | REV only: `delivery`, `kept_prepayment`, `overpayment`, `return`, `write_off` |
| delta_minor | BIGINT | signed, ≠ 0 |

**Per-entry balance rule (enforced on write):**
`ΣBOX + ΣAR − ΣAP − ΣPRE = ΣOPEN + ΣOWN_IN − ΣOWN_OUT + ΣREV − ΣEXP + ΣUNEXP` over the entry's postings. Reject any entry that violates it.

**Immutability:** no UPDATE/DELETE on `ledger_entry`, `ledger_posting`. `operation` rows may only change `status` and `reversed_by_operation_id`.

### 3.9 `absence_event`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| started_on | DATE | date of last operation before absence |
| ended_on | DATE | return date |
| complete | BOOLEAN | NULL until return flow ends; then true/false (§7.2) |

### 3.10 `reconciliation` and `reconciliation_box`
| `reconciliation` | Type |
|---|---|
| id | UUID PK |
| performed_on | DATE |
| context | TEXT `routine` \| `return_after_absence` \| `first_unknown_opening` |
| created_at | TIMESTAMPTZ |

| `reconciliation_box` | Type |
|---|---|
| reconciliation_id | UUID FK |
| box_id | UUID FK |
| recorded_minor | BIGINT (recorded balance at start) |
| counted_minor | BIGINT |

### 3.11 Derived values (compute, never store as source of truth)
Box balance, balance-line outstanding, prepayment per sale, sale status, all report figures. Caching is allowed only if a full recomputation yields identical results (`INV-3`).

---

## 4. Ledger entry types (the only way numbers change)

`a`, `p`, `m`, `r`, `e` are positive amounts in fils unless noted. Postings listed as `ACCOUNT[ref] ±amount`.

| Type | Name | Postings |
|---|---|---|
| Q1 | Opening box balance (k, a ≥ 0) | `BOX[k] +a`, `OPEN +a` |
| Q2 | Prior receivable (new line L, a) | `AR[L] +a`, `OPEN +a` |
| Q3 | Prior payable (new line L, a) | `AP[L] +a`, `OPEN −a` |
| Q4 | Prepayment (sale s, box k, a) | `BOX[k] +a`, `PRE[s] +a` |
| Q5 | Delivery (sale s, price P) | see Q5 |
| Q6 | Collection (line L, box k, a) | `BOX[k] +a`, `AR[L] −a` |
| Q7 | Payment (line L, box k, a) | `BOX[k] −a`, `AP[L] −a` |
| Q8 | Paid expense (category c, box k, a) | `BOX[k] −a`, `EXP[c] +a` |
| Q9 | Credit expense (category c, new line L kind supplier, a) | `AP[L] +a`, `EXP[c] +a` |
| Q10 | Owner deposit (k, a) | `BOX[k] +a`, `OWN_IN +a` |
| Q11 | Borrow (k, new line L kind borrowed, a) | `BOX[k] +a`, `AP[L] +a` |
| Q12 | Owner withdrawal (k, a) | `BOX[k] −a`, `OWN_OUT +a` |
| Q13 | Lend (k, new line L kind loan_given, a) | `BOX[k] −a`, `AR[L] +a` |
| Q14 | Transfer (k1→k2, a) | `BOX[k1] −a`, `BOX[k2] +a` |
| Q15 | Cancel sale with prepayments (s, kept m) | see Q15 |
| Q16 | Return (s, r) | see Q16 |
| Q17 | Write-off (line L, a) | see Q17 |
| Q18 | Overpayment kept (s, k, e) | `BOX[k] +e`, `REV[s] +e` (rev_kind `overpayment`) |
| Q19 | Reconciliation adjustment (k, diff ≠ 0, signed) | `BOX[k] +diff`, `UNEXP +diff` |
| Q20 | Reversal of entry q | every posting of q with negated delta; `effective_on` = q.effective_on; `reverses_entry_id` = q.id |

**Q5 — Delivery (s, P):** let `p = PRE[s]` (current).
1. `REV[s] +P` (rev_kind `delivery`), effective on actual delivery date.
2. `PRE[s] −p` (if p > 0).
3. If `P > p`: create line L (`to_me`, `sale_remainder`) and `AR[L] +(P − p)`.
4. If `p > P`: create line L (`by_me`, `customer_refund`) and `AP[L] +(p − P)`.

**Q15 — Cancel with prepayments (s, m):** `p = PRE[s]`, `0 ≤ m ≤ p`, `r = p − m`.
1. If m > 0: `PRE[s] −m`, `REV[s] +m` (rev_kind `kept_prepayment`), effective on cancel date.
2. If r > 0 and refund now (box k): `BOX[k] −r`, `PRE[s] −r`.
3. If r > 0 and refund later: `PRE[s] −r`, new line L (`by_me`, `customer_refund`), `AP[L] +r`.

**Q16 — Return (s, r):** s delivered; `r ≤ net_sale_revenue(s)` (§8).
1. `REV[s] −r` (rev_kind `return`), effective on return date.
2. `x = min(r, outstanding(sale_remainder of s))`; if x > 0: `AR[L_rem] −x`.
3. `y = r − x`; if y > 0: refund now (k) → `BOX[k] −y`; refund later → new line L (`by_me`, `customer_refund`), `AP[L] +y`.

**Q17 — Write-off (L, a):** `a ≤ outstanding(L)`. `AR[L] −a`, then by L.kind:
- `sale_remainder`: `REV[s] −a` (rev_kind `write_off`), effective today.
- `prior_receivable`: `OPEN −a`.
- `loan_given`: `OWN_OUT +a`.

All entry types satisfy the per-entry balance rule (§3.8).

---

## 5. Operations (contracts)

Each operation: **inputs → validation → entries → errors**. All operations are atomic (R-12). Error codes refer to §11.

### 5.0 Operation kinds (activity log names and filter groups)
| Operation | Row label (key) | Filter group | Row amount |
|---|---|---|---|
| OP-SETUP / OP-ADD-BOX with known balance | `rep.opening` | `rep.opening` | opening amount |
| OP-ADD-PRIOR-BALANCE | `f.prior_receivable` / `f.prior_payable` | `rep.opening` | amount |
| OP-SALE-CREATE | `op.sale` + sale status | `op.sale` | final price, blank if none |
| OP-PREPAYMENT | `a.prepayment` | `op.sale` | amount |
| OP-DELIVER | `op.deliver` | `op.sale` | price |
| OP-CANCEL-SALE | `op.cancel_sale` | `op.sale` | kept amount, blank if none |
| OP-RETURN | `a.return` | `op.sale` | amount |
| OP-PRICE-CORRECTION | `a.price_correction` | `op.sale` | new price |
| OP-UNDO-DELIVERY | `a.undo_delivery` | `op.sale` | price |
| OP-COLLECT | `op.collect` | `op.collect` | amount |
| OP-WRITE-OFF | `f.short_writeoff` | `op.collect` | amount |
| OP-PAY | `op.pay` | `op.pay` | amount |
| OP-EXPENSE | category (§10.2) | `op.expense` | total |
| OP-SALE-DELIVERY-COST | `sale_delivery` (§10.2) | `op.expense` | amount |
| OP-OWNER-DEPOSIT | `op.deposit` / `f.source_borrowed` | `op.deposit` | amount |
| OP-OWNER-WITHDRAWAL | `f.withdraw_personal` / `f.withdraw_loan` | `op.withdraw` | amount |
| OP-TRANSFER | `op.transfer` | `op.transfer` | amount |
| OP-MERGE-BOXES / OP-SPLIT-BOXES | `a.merge` / `a.split` | `op.transfer` | amount moved |
| OP-RECONCILE (Q19, and Q1 of a first unknown-opening reconciliation) | `op.reconcile` | `op.reconcile` | adjustment |

Operations created by reconciliation answers keep their own kind (expense, withdrawal…).

### OP-SETUP — Project setup
- Inputs: `project_name`; `boxes`: `cash_only` | `cash_and_account`; per box: `opening_minor` or `unknown`.
- Validation: name non-empty; opening ≥ 0.
- Entries: Q1 per box with known opening (effective today). Unknown → no entry, `opening_status = unknown`.

### OP-ADD-BOX
- Inputs: `kind` (the missing kind), `opening_minor` or `unknown`.
- Validation: R-9. Error `E-BOX-LIMIT`.
- Entries: as OP-SETUP for that box.

### OP-SALE-CREATE — Create sale/order (no money)
- Inputs: lines[≥1] {product_id | description, quantity (default 1), unit_price?, edited components?}, planned_delivery_on, final_price?, customer_name?, tracked? (default per §3.4), note?, registered_on (default today).
- Optional in the same user action: prepayment {amount, box} → OP-PREPAYMENT; sale delivery cost {amount, source box | personal} → OP-SALE-DELIVERY-COST; and for same-day sales "delivered now" → OP-DELIVER.
- Validation: ≥1 line (`E-NO-LINES`); quantity > 0 (`E-QTY`); customer name required for future sales (`E-NAME-REQUIRED`).
- Entries: none (unless combined operations).
- Product line snapshot: copy product name, unit price, unit cost (or NULL if unknown), components.

### OP-PREPAYMENT
- Inputs: sale_id, amount, box, effective_on (≤ today).
- Validation: sale not delivered, not cancelled (`E-SALE-STATE`).
- Entries: Q4.
- The UI option «المبلغ كاملاً» is available only when a final price exists (then amount = final price − PRE). Without a final price only «جزء» is offered.
- Any money received on an undelivered sale is a prepayment.

### OP-SALE-DELIVERY-COST
- Inputs: sale_id, amount, source: box k | `personal`, effective_on.
- Allowed in any sale state except `cancelled`; multiple entries per sale are allowed.
- Entries: box → Q8 (category `sale_delivery`, linked to sale). personal → Q10(cash, a) + Q8(cash, `sale_delivery`, a) (R-18).

### OP-DELIVER
- Inputs: sale_id, actual delivery date (default: today; if planned_delivery_on < today then the **later** of planned_delivery_on and the latest active prepayment date; always ≤ today), optional immediate collection {amount, box} (effective on the actual delivery date).
- Validation: final price set (`E-PRICE-REQUIRED`); not delivered/cancelled (`E-SALE-STATE`); actual delivery date ≥ the latest effective date of the sale's active prepayments (`E-DATE-ORDER`). Same-day sale without customer name must collect the full remaining (`E-NAME-REQUIRED-FOR-DEBT`).
- Entries: Q5; then collection per OP-COLLECT targeting this sale's remainder line.
- **Delivery and the immediate collection are two separate operations**, created together atomically and **shown as one grouped row (R-28)**; each stays correctable on its own.
- A same-day sale created with "delivered now" = OP-SALE-CREATE + OP-DELIVER (+ OP-PREPAYMENT is not used; the money is an immediate collection) in one user action.
- After delivery: lines locked.

### OP-COLLECT — Collection
- Inputs: either `balance_line_id` (from a sale or a line) **or** `counterparty_name`; amount; box; effective_on.
- Allocation by name: open `to_me` lines with that exact name, ordered by `origin_on`, then `created_at`, oldest first.
- Shortfall (amount < outstanding): if the collection targets **a single line** (explicit line, or the name has exactly one open line), ask: [يبقى مستحقاً] → nothing more; [لن يُحصَّل] → Q17 on that line for the rest. Otherwise the rest stays open (no question).
- Excess (amount > total outstanding): allowed only if the **last allocated line** is `sale_remainder` → Q18 for the excess on that sale; show message `S-OVERPAY-KEPT`. Otherwise reject `E-OVERPAY`.
- Prior receivable not yet recorded: option "مستحق سابق" → Q2 (new line, origin today) then Q6.
- Name with no open `to_me` lines and not marked "مستحق سابق" → `E-NO-OPEN-BALANCE` (checked **before** the overpayment rule).
- Entries: Q6 per allocated line; optional Q17 / Q18.

### OP-PAY — Payment
- Inputs: `balance_line_id` or `counterparty_name`; amount; box; effective_on.
- Allocation by name: open `by_me` lines with that name, oldest first.
- Validation: amount ≤ total outstanding (`E-OVERPAY`).
- Prior payable not yet recorded: option "التزام سابق" → Q3 then Q7.
- Entries: Q7 per allocated line.

### OP-EXPENSE
- Inputs: amount (> 0), delivery_cost (≥ 0, default 0), category (R-10, not `sale_delivery`), payment: `full` | `credit` | `partial(m)`, source (box k | `personal`) when something is paid, supplier name when something is on credit, effective_on, note.
- Total `t = amount + delivery_cost`.
- Validation: `0 < m < t` for partial (`E-AMOUNT`); supplier name required if credit part > 0 (`E-NAME-REQUIRED`).
- Entries:
  - full + box: Q8(c, k, t)
  - full + personal: Q10(cash, t) + Q8(c, cash, t) (R-18)
  - credit: Q9(c, new supplier line, t)
  - partial + box: Q9(c, L, t) + Q7(L, k, m)
  - partial + personal: Q9(c, L, t) + Q10(cash, m) + Q7(L, cash, m)
- `operation.delivery_cost_minor` keeps the delivery portion for display only.

### OP-OWNER-DEPOSIT
- Inputs: amount, box, source: `personal` | `borrowed(name)`.
- Entries: personal → Q10; borrowed → Q11 (new `borrowed` line).

### OP-OWNER-WITHDRAWAL
- Inputs: amount, box, type: `personal` | `loan_given(name)`.
- Entries: personal → Q12; loan_given → Q13 (new `loan_given` line).
- A loan given never counts as a personal withdrawal unless written off (Q17).

### OP-WRITE-OFF — available on any open `to_me` line
- Inputs: balance_line_id, amount (default full outstanding).
- Validation: 0 < amount ≤ outstanding (`E-OVERPAY`).
- Entries: Q17.

### OP-ADD-PRIOR-BALANCE — record a prior receivable/payable for tracking only
- Inputs: direction (`to_me` | `by_me`), counterparty_name, amount, origin_on (default today, ≤ today).
- Entries: Q2 (to_me) or Q3 (by_me). No money moves.
- The same line can later be collected/paid via OP-COLLECT / OP-PAY.

### OP-TRANSFER
- Inputs: from box, to box, amount.
- Validation: both boxes active (`E-BOX-STATE`).
- Entries: Q14.

### OP-CANCEL-SALE
- Inputs: sale_id; if `PRE[s] > 0`: kept amount m (default = PRE[s]); refund: `now(box)` | `later`.
- Validation: not delivered (`E-CANCEL-DELIVERED`), not already cancelled; 0 ≤ m ≤ PRE[s] (`E-OVERPAY`). Effective on the cancellation date (R-26).
- A cancellation is final: there is no undo. To restore the order, the user creates a new sale.
- Entries: if PRE = 0 → none; else Q15. Set `sale.cancelled_on`.

### OP-RETURN
- Inputs: sale_id, amount r, refund: `now(box)` | `later`, effective_on.
- Validation: delivered (`E-SALE-STATE`); `r ≤ net_sale_revenue(s)` (`E-RETURN-AMOUNT`).
- Entries: Q16.

### OP-PRICE-CORRECTION — after delivery (recording mistake only)
- Inputs: sale_id, new final price (> 0).
- Validation: delivered; new price ≥ total returns on the sale (`E-RETURN-AMOUNT`).
- Entries (atomic): Q20 of the active Q5; new Q5 with the new price, **same effective date** as the original delivery. If the sale-remainder line outstanding would become negative (−x): add posting `AR[L_rem] +x` and create `customer_refund` line with `AP +x` (same entry, balanced).
- Discounts after delivery are **not** price corrections: use OP-WRITE-OFF (customer pays less) or OP-RETURN (money returned).

### OP-UNDO-DELIVERY
- Validation: no active returns on the sale and no payments on its `customer_refund` lines (`E-UNDO-DELIVERY-BLOCKED`).
- Entries (atomic): Q20 of Q5; Q20 of every active Q6, Q17, Q18 tied to the sale; for each reversed Q6 **and each reversed Q18**: Q4 with the same box, amount and effective date (the money stays in the box as a prepayment).
- Result: sale back to `scheduled`/`overdue`; lines unlocked; box balances unchanged.

### OP-CORRECT — edit any operation
- Inputs: operation_id, corrected inputs.
- Entries (atomic): Q20 for every active entry of the original operation; then the entries of the corrected operation, **with the original effective date** (unless the user changes the date itself). Original operation → `reversed`; new operation → `corrects_operation_id`.
- Validation: final state must satisfy INV-2; otherwise reject with `E-CORRECTION-BREAKS-BALANCES` (message names the dependent operations to fix first).
- A prepayment of a delivered sale cannot be corrected directly (it would make PRE negative) → `E-CORRECTION-BREAKS-BALANCES`; user must undo delivery first.
- **Activity log display:** the log lists the current version of each operation. A corrected operation's current version carries «معدَّلة» (`l.edited`); its earlier versions are reachable from its details only. A cancelled operation stays in the log with «ملغاة» (`l.cancelled_op`). The current version of a corrected operation can itself be corrected again.
- Operations created by reconciliation answers can be corrected or cancelled like any other; this does not reopen the reconciliation (the next reconciliation will reflect any new difference).
- **Correctable / cancellable kinds:** PREPAYMENT, COLLECT, PAY, EXPENSE, SALE-DELIVERY-COST, OWNER-DEPOSIT, OWNER-WITHDRAWAL, TRANSFER, WRITE-OFF, RETURN, ADD-PRIOR-BALANCE.
- **Not correctable by the generic edit:** SALE_CREATE (edit the sale itself, R-17; cancel = OP-CANCEL-SALE), DELIVER (use OP-UNDO-DELIVERY or OP-PRICE-CORRECTION), UNDO-DELIVERY, PRICE-CORRECTION (apply a new price correction), CANCEL-SALE (final), SETUP/ADD-BOX opening balances (fixed only through reconciliation), RECONCILE adjustments, MERGE/SPLIT.
- **Correcting a collection** reverses its Q17/Q18 together with its Q6 entries, then re-applies OP-COLLECT rules to the new inputs (the shortfall question and the overpayment rule apply again).

### OP-CANCEL-OPERATION
- Entries: Q20 for every active entry. Same validation as OP-CORRECT. Q20 entries cannot be reversed (`E-REVERSE-REVERSAL`).
- Cancelling a `SALE_CREATE` operation from the activity log runs **OP-CANCEL-SALE** (with its prepayment questions). On a delivered sale → `E-CANCEL-DELIVERED`.

### OP-MERGE-BOXES / OP-SPLIT-BOXES
- Merge: Q14 that brings the account balance to zero (balance b > 0: account → cash b; b < 0: cash → account |b|; b = 0: no entry); then account `status = merged`. Merged box accepts no operations (`E-BOX-STATE`). Not allowed while any box's opening balance is unknown (`E-MERGE-UNKNOWN`).
- Split: account `status = active`; Q14 (cash → account, amount entered by user). Validation: 0 ≤ amount ≤ cash balance (`E-SPLIT-AMOUNT`); amount 0 → no ledger entry; not allowed while the cash opening balance is unknown (`E-MERGE-UNKNOWN`).

### OP-TRACKER-HIDE / OP-TRACKER-ADD
- Hide: `hidden_from_tracker = true`. Add: `tracked = true`, `hidden_from_tracker = false`. **No ledger effect.**
- Status changes from the tracker call the same operations (OP-DELIVER, OP-CANCEL-SALE…).

### OP-RECONCILE — see §7.1
### OP-RETURN-AFTER-ABSENCE — see §7.2

---

## 6. Sale status (derived)

| Status | Code | Condition |
|---|---|---|
| ملغى | `cancelled` | `cancelled_on` set |
| مجدول | `scheduled` | not delivered, not cancelled, planned_delivery_on ≥ today |
| متأخر | `overdue` | not delivered, not cancelled, planned_delivery_on < today |
| مُسلَّم – بانتظار الدفع | `delivered_unpaid` | delivered, outstanding(sale_remainder) > 0 |
| مكتمل | `completed` | delivered, outstanding(sale_remainder) = 0 or no remainder line |

**Paid indicator "المدفوع X من Y":**
- Before delivery: `X = PRE[s]`, `Y = final_price`. If no final price yet: show `l.paid_only` («المدفوع {X}»).
- After delivery: `Y = net_sale_revenue(s)`, `X = Y − outstanding(sale_remainder)`. If an open `customer_refund` line exists for the sale, also show `S-REFUND-DUE` with its outstanding.

**Transitions:** scheduled/overdue → (OP-DELIVER) → delivered_unpaid | completed · scheduled/overdue → (OP-CANCEL-SALE) → cancelled · delivered_* → (OP-UNDO-DELIVERY) → scheduled/overdue · delivered_unpaid ↔ completed via collections/write-offs. No other transitions.

---

## 7. Special flows

### 7.1 Reconciliation (OP-RECONCILE)
1. For each active box: `recorded = BOX[k]`. User enters `counted` or taps "مطابق" (counted = recorded). **For a box with unknown opening balance, "مطابق" is not offered; the counted amount must be entered.**
2. `Δk = counted − recorded`. If one Δ > 0 and the other < 0: propose Q14 of `min(|Δ1|, |Δ2|)` from the negative box to the positive box (`S-RECON-TRANSFER`). On confirm, apply and recompute Δ.
3. For each box with Δ ≠ 0 (boxes handled one after another, cash first): show questions (§10.4). Δ < 0 → "less" questions; Δ > 0 → "more" questions. Each answer runs its operation **on that box, effective on the reconciliation date**, then Δ is recomputed. Question visibility: «هل سددت التزاماً؟» only if open `by_me` lines exist; «هل حصّلت مبلغاً من أحد؟» always (it includes the prior-receivable option). **Answer amount:** the opened form is prefilled with |Δ| and is editable to any positive amount; after saving, Δ is recomputed, and if its sign flips the other question set is shown. `r.all_places` is a reminder line, not a question; there is no "لا أعرف" button — the user simply taps «إنهاء».
4. "Finish": Q19 per box with remaining Δ.
5. Persist `reconciliation` + `reconciliation_box`.

### 7.2 Return after absence
1. On app open, if last operation `created_at` ≥ 14 days ago: create `absence_event` (started_on = last operation date, ended_on = today).
2. Overdue sales: per sale [تم التسليم] (OP-DELIVER, ask price if empty; collection optional) / [أُلغي] (OP-CANCEL-SALE) / [ما زال قائماً].
3. Open balance lines: [حُصِّل / سُدِّد] (full outstanding via OP-COLLECT / OP-PAY) / [ما زال قائماً].
4. OP-RECONCILE (context `return_after_absence`).
5. `complete = true` iff the reconciliation ended with all Δ = 0 at step 1 **and** no operation was created from its difference questions and no Q19 was posted; else `false`. Deliveries, cancellations and collections answered in steps 2–3 do not affect completeness.
- Never ask for estimated sales or expenses for the absence period.
- The return flow starts from a card at the top of «مشروعي الآن» (the app always opens on «مشروعي الآن»). Leaving midway keeps the card until the flow is finished; until then `complete` stays NULL and the period counts as incomplete.
- Leaving a reconciliation midway: operations already saved from answers stay; the reconciliation itself is not saved.

### 7.3 Unknown opening balance
- Box accepts operations normally. No negative-balance warning for it.
- Box balance and net worth display "غير معروف حتى المطابقة".
- First reconciliation for that box: `computed_opening = counted − Σ(BOX[k] postings since start)`.
  - ≥ 0 → Q1(computed_opening) **effective on the box's created_on**; no questions; no Q19.
  - < 0 → Q1(0) effective on created_on; then treat `Δ = computed_opening` (negative) with "less" questions and Q19 as in §7.1.
- Then `opening_status = known`.

---

## 8. Computed figures (exact formulas)

`f` = selected period (week, month, year, since start). "in f" = postings whose entry `effective_on` ∈ f. Only active entries and their reversals both count (a reversal nets its original to zero).

| Figure | Formula |
|---|---|
| Box balance k | Σ `BOX[k]` all postings to today. Unknown opening → display unknown |
| Total balance | Σ over active boxes; displayed as unknown (`l.unknown_balance`) if any active box has an unknown opening balance (never show a partial total) |
| Receivables | Σ outstanding of `to_me` lines |
| Payables | Σ outstanding of `by_me` lines + Σ `PRE`; display Σ PRE separately ("منها … دفعات مقدمة") |
| Sales (f) | Σ `REV` with rev_kind ∈ {delivery, kept_prepayment, overpayment} in f |
| Returns & discounts (f) | −Σ `REV` with rev_kind ∈ {return, write_off} in f |
| Net sales (f) | Sales − Returns & discounts |
| Expenses (f) | Σ `EXP` (all categories incl. sale_delivery) in f |
| **Net profit (f)** | Net sales − Expenses |
| Equipment (f) | Σ `EXP[equipment]` in f |
| Personal withdrawals (f) | Σ `OWN_OUT` in f |
| Per-10 ratio (f) | `round(net_profit × 10 / net_sales, 1 decimal)`; hidden if net_sales ≤ 0; if net_profit < 0 show `S-LOSS` **instead of** the ratio sentence, with `c.withdrawals_only` under it |
| Biggest expense (f) | category with max Σ EXP in f |
| Materials alert (f) | show if Σ `EXP[materials_packaging]` in f > 50% of net sales in f |
| net_sale_revenue(s) | Σ `REV[s]` (all rev_kinds, active) |
| Expected profit (s) | `final_price − Σ round_half_up(qty × unit_cost) − Σ EXP[sale_delivery] linked to s`; NULL if any line cost unknown or no final price |
| Top sellers (f) | product lines of sales delivered in f, excluding sales with any active return; group by product_id; rank by Σ line value; also show Σ quantity |
| Top profit (f) | same set, products with known cost only; Σ(line value − qty × unit_cost); rank by total; show total ÷ Σ qty per unit. Order-level discount and delivery not allocated |
| Unexplained difference (f) | Σ `UNEXP` in f; show only if ≠ 0; wording by sign |
| Profit bars | Net profit per: last 8 weeks (week) / last 12 months (month) / each year since start (year, since start). Incomplete periods visually marked |
| **Net worth** | Σ BOX + Σ AR − Σ AP − Σ PRE (unknown if any active box has unknown opening) |
| **Net worth sources** | Σ OPEN + Σ OWN_IN − Σ OWN_OUT + net profit since start + Σ UNEXP |
| Overdue receivables | open `to_me` lines with origin_on ≤ today − 14 |
| Incomplete flag (f) | f overlaps an `absence_event` whose complete ≠ true (false **or** NULL), **or** any active box has opening_status = unknown |

### 8.2 Entity-level derived values (allowed in the UI)
| Value | Formula |
|---|---|
| Line outstanding | Σ `AR[L]` or `AP[L]` postings for line L |
| Sale prepayment | `PRE[s]` |
| Paid indicator | §6 |
| Product / line unit cost | Σ component costs; unknown if none |
| Reconciliation difference Δ | counted − recorded (§7.1) |
| Remaining after a collection | outstanding − collected amount |
| «المبلغ كاملاً» | final price − `PRE[s]` (prepayment), or final price − `PRE[s]` at delivery (collection) |
| Merge result | total balance |
| Expenses by category (f) | Σ `EXP[c]` in f, per category c (incl. `sale_delivery`) |
| What you have | Σ BOX + Σ AR |
| What you owe | Σ AP + Σ PRE, with breakdown by `by_me` line kind and Σ PRE |
| Today & tomorrow / overdue sales (مشروعي الآن) | all sales not delivered and not cancelled, by planned date, **regardless of tracker flags** |
| New user (`c.empty`) | no operation exists other than OP-SETUP / OP-ADD-BOX |
| Per-10 ratio hidden (net sales ≤ 0) | show `c.withdrawals_only` alone |
| Net worth sources with an unknown box | opening and net worth show `l.unknown_balance` |

**No figure outside §8 and §8.2 may be displayed.**

---

## 9. Invariants (assert in tests and, where cheap, at runtime)

| ID | Invariant |
|---|---|
| INV-1 | Net worth = Net worth sources, at all times |
| INV-2 | Every balance line outstanding ≥ 0; every `PRE[s]` ≥ 0 |
| INV-3 | Any cached figure equals full recomputation from postings |
| INV-4 | Ledger is append-only; entry + its reversal = 0 on every account |
| INV-5 | Q1, Q2, Q3, Q4, Q6, Q7, Q10, Q11, Q12, Q13, Q14, Q19 and the refunded part of Q15 never change net profit; neither do product edits or tracker changes |
| INV-6 | Expected cost/profit never posts to REV/EXP |
| INV-7 | Editing a product never changes an existing sale line |
| INV-8 | Correcting an operation changes only the periods of the affected effective dates |
| INV-9 | `registered_on` and `planned_delivery_on` have no financial effect |
| INV-10 | Every ledger entry satisfies the per-entry balance rule (§3.8) |

**INV-1 proves balance, not correctness.** A wrong but balanced entry passes INV-1. The numeric tests in §13 are the primary acceptance criteria.

---

## 10. UI strings (Arabic, use verbatim)

### 10.1 Operations and fields
| Key | Arabic |
|---|---|
| op.sale | بيع أو طلب |
| op.collect_pay | تحصيل أو سداد |
| op.collect | تحصيل |
| op.pay | سداد |
| op.expense | مصروف أو شراء |
| op.owner | إيداع أو سحب شخصي |
| op.deposit | إيداع |
| op.withdraw | سحب |
| op.transfer | تحويل |
| op.reconcile | المطابقة |
| f.lines | البنود |
| f.add_line | إضافة منتج |
| f.quantity | الكمية |
| f.planned_date | تاريخ التسليم المخطط |
| f.actual_date | تاريخ التسليم الفعلي |
| f.final_price | السعر النهائي |
| f.customer | اسم العميل |
| f.prepayment_q | هل استلمت دفعة؟ |
| f.prepayment_full | المبلغ كاملاً |
| f.prepayment_part | جزء |
| f.no | لا |
| f.sale_delivery | تكلفة التوصيل التي دفعتها |
| f.track | إضافة إلى متتبّع الطلبات |
| f.registered | تاريخ التسجيل |
| f.note | ملاحظة |
| f.amount | المبلغ |
| f.box | الصندوق |
| f.cash | نقد |
| f.account | حساب |
| f.personal_money | من مالي الشخصي |
| f.category | التصنيف |
| f.delivery_cost | تكلفة التوصيل |
| f.pay_full | مدفوع بالكامل |
| f.pay_credit | آجل |
| f.pay_partial | مدفوع جزئياً |
| f.supplier | اسم المورد |
| f.source_personal | من مالي الشخصي |
| f.source_borrowed | مبلغ مستدان من شخص |
| f.withdraw_personal | سحب شخصي |
| f.withdraw_loan | سلفة لشخص |
| f.prior_receivable | مستحق سابق |
| f.prior_payable | التزام سابق |
| f.keep_amount | كم المبلغ الذي ستحتفظ به؟ |
| f.refund_now | رددته الآن |
| f.refund_later | لاحقاً |
| f.short_remain | يبقى مستحقاً |
| f.short_writeoff | لن يُحصَّل |
| a.edit | تعديل |
| a.cancel | إلغاء |
| a.deliver | تم التسليم |
| a.undo_delivery | إلغاء التسليم |
| a.return | مرتجع |
| a.hide_tracker | حذف من المتتبّع |

### 10.2 Categories
`materials_packaging` مواد وتغليف · `utilities` كهرباء ومياه · `gas` غاز · `rent` إيجار · `transport` تنقّل · `ads` إعلانات · `tools` أدوات · `equipment` معدات · `other` أخرى · `sale_delivery` توصيل طلب

### 10.3 Statuses and labels
| Key | Arabic |
|---|---|
| st.scheduled | مجدول |
| st.overdue | متأخر |
| st.delivered_unpaid | مُسلَّم – بانتظار الدفع |
| st.completed | مكتمل |
| st.cancelled | ملغى |
| l.paid_of | المدفوع {X} من {Y} |
| l.expected_profit | ربح متوقع |
| l.edited | معدَّلة |
| l.cancelled_op | ملغاة |
| l.incomplete | بيانات غير مكتملة |
| l.unknown_balance | غير معروف حتى المطابقة |

### 10.4 Reconciliation
| Key | Arabic |
|---|---|
| r.prompt | رصيدك المسجَّل {total} ({breakdown}). هل يطابق الموجود فعلاً؟ |
| r.match | مطابق |
| r.mismatch | غير مطابق: الموجود ___ |
| S-RECON-TRANSFER | هل حوّلت {amount} من {from} إلى {to}؟ |
| r.less.expense | هل دفعت مصروفاً لم تسجّله؟ |
| r.less.withdraw | هل سحبت مبلغاً لنفسك؟ |
| r.less.pay | هل سددت التزاماً؟ |
| r.less.lend | هل أعطيت سلفة لأحد؟ |
| r.more.collect | هل حصّلت مبلغاً من أحد؟ |
| r.more.sale | هل بعت شيئاً لم تسجّله؟ |
| r.more.deposit | هل أودعت من مالك الشخصي؟ |
| r.more.borrow | هل استدنت مبلغاً من أحد؟ |
| r.all_places | هل راجعت كل أماكن المال؟ |
| r.finish | إنهاء |
| r.unexplained_less | يوجد نقص {amount} غير مفسَّر |
| r.unexplained_more | توجد زيادة {amount} غير مفسَّرة |
| r.absence_intro | مرّ {days} يوماً على آخر تسجيل. لنبدأ من وضعك الحالي. |
| r.still_open | ما زال قائماً |
| r.settled | حُصِّل أو سُدِّد |
| r.cancelled | أُلغي |

### 10.5 Screens and cards
| Key | Arabic |
|---|---|
| s.now | مشروعي الآن |
| s.dashboard | لوحة المؤشرات |
| s.activity | الحركات |
| s.tracker | متتبّع الطلبات |
| s.products | منتجاتي |
| s.balance | رصيدك {amount} |
| s.receivables | المستحقات لك {amount} |
| s.payables | الالتزامات عليك {amount} (منها {pre} دفعات مقدمة لطلبات قادمة) |
| s.today_orders | طلبات اليوم والغد |
| s.overdue_orders | الطلبات المتأخرة |
| s.overdue_receivable | {name}: {amount} منذ {age} |
| p.week / p.month / p.year / p.all | أسبوع / شهر / سنة / منذ البداية |
| c.profit | صافي ربحك {amount} |
| c.networth | إذا حصّلت مستحقاتك وسددت التزاماتك، يتبقى لك {amount} |
| c.top_sales | {product}: {amount} ({qty} {unit}) |
| c.top_profit | {product}: {amount} ربح متوقع ({per_unit} للوحدة) — حسب تكلفة منتجاتك |
| c.biggest_expense | {category}: {amount} من أصل {total} |
| c.ratio | من كل 10 دنانير مبيعات يتبقى لك {x} ربحاً. سحوباتك الشخصية {w} |
| S-LOSS | مصاريفك في هذه الفترة أكبر من مبيعاتك |
| c.equipment | منها معدات بقيمة {amount} |
| c.materials_alert | مشتريات المواد في هذه الفترة {amount}، وقد تكفي لفترات قادمة |
| c.empty | سجّل أول عملية بيع، وستظهر مؤشراتك هنا |
| S-OVERPAY-KEPT | تم احتساب الزيادة {amount} لصالحك |
| S-REFUND-DUE | مستحق للعميل {amount} |
| w.negative_box | أصبح رصيدك بالسالب، قد تكون هناك عملية غير مسجّلة |

### 10.6 Reports
| Key | Arabic |
|---|---|
| rep.income | قائمة الدخل |
| rep.sales | المبيعات |
| rep.returns | المرتجعات والخصومات |
| rep.net_sales | صافي المبيعات |
| rep.expenses | المصاريف |
| rep.net_profit | صافي الربح |
| rep.position | المركز المالي |
| rep.have | ما لديك |
| rep.owe | ما عليك |
| rep.networth | صافي قيمة المشروع |
| rep.sources | مصادر صافي القيمة |
| rep.opening | الرصيد الافتتاحي |
| rep.deposits | الإيداعات الشخصية |
| rep.withdrawals | السحوبات الشخصية |
| rep.profit_since | صافي الربح منذ البداية |
| rep.unexplained | الفرق غير المفسَّر |

---

### 10.7 Additional strings (approved with the UX map)
| Key | Arabic |
|---|---|
| l.paid_only | المدفوع {X} |
| l.age_day1 | منذ يوم |
| l.age_day2 | منذ يومين |
| l.age_days | منذ {n} أيام |
| l.age_days_many | منذ {n} يوماً |
| l.age_week2 | منذ أسبوعين |
| l.age_weeks | منذ {n} أسابيع |
| l.age_month1 | منذ شهر |
| l.age_month2 | منذ شهرين |
| l.age_months | منذ {n} أشهر |
| l.age_months_many | منذ {n} شهراً |
| l.last_edit | آخر تعديل {date} |
| l.no_name | بدون اسم |
| l.unit_cost_unknown | غير معروفة |
| l.archived | مؤرشفة |
| l.prior_no_profit | لا يؤثر على ربح الفترة |
| l.previous_versions | النسخ السابقة |
| a.save | حفظ |
| a.back | رجوع |
| a.confirm | تأكيد |
| a.ok | حسناً |
| a.next | التالي |
| a.start | ابدأ |
| a.later | لاحقاً |
| a.show_more | إظهار المزيد |
| a.view_all | عرض الكل |
| a.deliver_now | حفظ وتم التسليم |
| a.add_product | إضافة منتج |
| a.add_component | إضافة مكوّن |
| a.archive | أرشفة |
| a.unarchive | إلغاء الأرشفة |
| a.add_to_tracker | إضافة إلى متتبّع الطلبات |
| a.add_prior | إضافة مستحق سابق |
| a.add_prior_payable | إضافة التزام سابق |
| a.add_box | إضافة صندوق |
| a.merge | دمج الصندوقين |
| a.split | فصل الصندوقين |
| a.open_sale | فتح الطلب |
| a.collect_now | تحصيل |
| a.prepayment | دفعة مقدمة |
| a.price_correction | تصحيح السعر |
| a.today | اليوم |
| t.calendar | تقويم |
| t.list | قائمة |
| t.new_order | طلب جديد |
| t.collected_now | هل حصّلت مبلغاً الآن؟ |
| t.date_today | التاريخ: اليوم |
| t.boxes_q | كم صندوقاً تستخدم؟ |
| t.cash_only | نقد فقط |
| t.cash_account | نقد + حساب |
| t.unknown_hint | يمكنك تحديده لاحقاً من المطابقة |
| t.project_name | اسم المشروع |
| t.settings | الإعدادات |
| t.archived_section | المنتجات المؤرشفة |
| t.description | وصف نصي |
| t.search | بحث بالاسم |
| t.filter_type | النوع |
| t.filter_period | الفترة |
| t.prepayments_group | الدفعات المقدمة لطلبات قادمة |
| t.to_me / t.by_me | لك / عليك |
| t.since_unit | للوحدة |
| d.undo_delivery | سيُلغى الإيراد ويعود الطلب «مجدولاً»، وتتحول المبالغ المحصَّلة إلى دفعات مقدمة. لن يتغير رصيد الصندوق. |
| d.hide_tracker | سيُخفى الطلب من المتتبّع، وتبقى حركاته المالية كما هي. |
| d.archive_product | سيختفي المنتج من الاقتراحات. الطلبات السابقة لا تتأثر. |
| d.writeoff_sale | سيُخصم {amount} من إيراد الطلب. |
| d.writeoff_prior | سيُخصم {amount} من الرصيد الافتتاحي. |
| d.writeoff_loan | سيُحتسب {amount} سحباً شخصياً. |
| d.cancel_op | سيتم إلغاء هذه الحركة بحركة عكسية، وتبقى ظاهرة في السجل. |
| d.merge | سيصبح رصيد النقد {amount}. |
| d.recon_done | اكتملت المطابقة |
| d.recon_later | لاحقاً |
| e.empty_orders_day | لا توجد طلبات في هذا اليوم |
| e.empty_activity | لا توجد حركات في هذه الفترة |
| e.empty_receivables | لا توجد مستحقات لك |
| e.empty_payables | لا توجد التزامات عليك |
| e.empty_products | لا توجد منتجات بعد. أضف منتجاً ليُقترح عليك عند البيع |
| e.empty_search | لا توجد نتائج |
| e.empty_period | لا توجد بيانات لهذه الفترة |
| t.unknown_now | لا أعرف الآن |
| a.start_recon | ابدأ المطابقة |
| a.save_only | حفظ فقط |
| t.split_amount | مبلغ الحساب |
| d.short_remaining | بقي {amount} |
| d.price_hint | لتسجيل خصم، استخدم «لن يُحصَّل» أو «مرتجع» |
| d.cancel_sale | سيُلغى الطلب. |
| r.diff_less | يوجد نقص {amount} |
| r.diff_more | توجد زيادة {amount} |

### 10.8 Strings approved with the final UX map
| Key | Arabic |
|---|---|
| tab.finance | المالية |
| tab.orders | الطلبات |
| s.boxes | الصناديق |
| s.balances | المستحقات والالتزامات |
| s.overdue_receivables | المستحقات المتأخرة |
| a.tomorrow | غداً |
| t.date_value | التاريخ: {date} |
| f.name | الاسم |
| f.paid_amount | المبلغ المدفوع |
| f.unit_price | سعر البيع للوحدة |
| f.unit_label | الوحدة |
| f.component_name | المكوّن |
| f.component_cost | التكلفة |
| f.unit_cost | تكلفة الوحدة |
| a.delete_line | حذف البند |
| l.delivery_part | منها توصيل {amount} |
| s.sale_history | السجل المالي |
| t.all | الكل |
| op.deliver | تسليم |
| t.from_to | من {from} إلى {to} |
| c.title_top_sales | الأعلى مبيعاً |
| c.title_top_profit | الأعلى ربحاً |
| c.title_biggest_expense | أكبر بند مصروف |
| c.title_ratio | الربح والسحوبات |
| rep.expenses_by_category | المصاريف حسب التصنيف |
| s.payables_no_pre | الالتزامات عليك {amount} |
| l.kind_sale_remainder | متبقٍ على طلب |
| l.kind_supplier | مورد |
| l.kind_customer_refund | رد لعميل |
| c.networth_unknown | صافي قيمة المشروع: غير معروف حتى المطابقة |
| r.prompt_single | رصيدك المسجَّل {total}. هل يطابق الموجود فعلاً؟ |
| c.withdrawals_only | سحوباتك الشخصية {w} |
| e.empty_tracker | لا توجد طلبات في المتتبّع |
| t.line_search | اسم المنتج أو الوصف |
| l.line_only_this | التعديل لهذا الطلب فقط |
| op.cancel_sale | إلغاء طلب |
| s.balance_unknown | رصيدك غير معروف حتى المطابقة |
| l.currency | د |
| rep.income_open | قائمة الدخل |

## 11. Error messages (Arabic, use verbatim)

| Code | Arabic |
|---|---|
| E-NO-LINES | أضف بنداً واحداً على الأقل |
| E-QTY | الكمية يجب أن تكون أكبر من صفر |
| E-AMOUNT | المبلغ يجب أن يكون أكبر من صفر |
| E-NAME-REQUIRED | أدخل الاسم |
| E-NAME-REQUIRED-FOR-DEBT | أدخل اسم العميل، لأن جزءاً من المبلغ لم يُحصَّل |
| E-PRICE-REQUIRED | أدخل السعر النهائي قبل التسليم |
| E-SALE-STATE | لا يمكن تنفيذ هذا الإجراء على الطلب في حالته الحالية |
| E-CANCEL-DELIVERED | لا يمكن إلغاء طلب مُسلَّم. استخدم «مرتجع» أو «إلغاء التسليم» |
| E-RETURN-AMOUNT | مبلغ المرتجع أكبر من قيمة الطلب |
| E-OVERPAY | المبلغ أكبر من المتبقي |
| E-FUTURE-DATE | لا يمكن تسجيل حركة مالية بتاريخ مستقبلي |
| E-BOX-LIMIT | الحد الأقصى صندوقان |
| E-BOX-STATE | هذا الصندوق غير متاح |
| E-LINES-LOCKED | لا يمكن تعديل البنود بعد التسليم. يمكنك تعديل السعر فقط |
| E-UNDO-DELIVERY-BLOCKED | ألغِ المرتجعات ومبالغ الرد على هذا الطلب أولاً |
| E-CORRECTION-BREAKS-BALANCES | لا يمكن تنفيذ هذا التعديل، لأنه يتعارض مع حركات أخرى. عدّلها أولاً (and the dependent operations are listed under the message as activity rows) |
| E-REVERSE-REVERSAL | لا يمكن إلغاء عملية ملغاة |
| E-DATE-ORDER | تاريخ التسليم لا يمكن أن يسبق تاريخ دفعة مسجّلة على الطلب |
| E-SPLIT-AMOUNT | المبلغ أكبر من رصيد النقد |
| E-MERGE-UNKNOWN | طابق أرصدة الصناديق أولاً، ثم أكمل |
| E-UNIT-PRICE-REQUIRED | أدخل سعر البيع للوحدة |
| E-NO-OPEN-BALANCE | لا يوجد مستحق مفتوح بهذا الاسم. اختر «مستحق سابق» إذا كان من قبل |
| E-OFFLINE | لا يوجد اتصال بالإنترنت. لم يُحفظ شيء، حاول مرة أخرى |



---

## 12. Implementation order

| Phase | Scope | Done when |
|---|---|---|
| 1 | Schema §3, ledger §4 with per-entry balance check, invariants §9, operations without UI: SETUP, ADD-BOX, EXPENSE, OWNER-*, TRANSFER, COLLECT, PAY, WRITE-OFF, CORRECT, CANCEL-OPERATION | Tests S2, S5, S6, S9, T5, T7, T8, T13, T15, T16, T25, T26, T27, T29, T30 pass |
| 2 | Sales: CREATE, PREPAYMENT, DELIVER, SALE-DELIVERY-COST, CANCEL-SALE, RETURN, PRICE-CORRECTION, UNDO-DELIVERY; status §6; products | S1, S3, S4, T1, T2, T3, T6, T11, T12, T14, T17–T24 |
| 3 | Boxes merge/split, reconciliation §7.1, absence §7.2, unknown opening §7.3 | S7, S8, T4, T9, T10, T28, T33, T34 |
| 4 | Figures §8, screens (now, dashboard, reports, activity log, tracker) with strings §10–§11 | Every displayed number matches §8; INV-1 visible in reports; T31, T32 |
| 5 | Full regression | All §13 tests pass; INV-1 asserted after each |

---

## 13. Acceptance tests

Amounts in JOD (implement as fils: 1 JOD = 1000). Every test ends with `assert INV-1` and `assert INV-2`. Unless stated, one cash box with a known opening balance of 0.

### 13.1 Scenarios

**S1 — Full order**
- Given: cash 200, account 100. Product منسف: price 25, cost 18.
- When: day 1 sale to محمد, line منسف × 10 (price 250, expected cost 180), planned day 4, prepayment 50 cash · day 2 expense materials_packaging 170 cash · day 4 sale delivery cost 5 cash, deliver, collect 150 account.
- Then: net profit 75 (REV 250, EXP 175); expected profit 65; cash 75; account 250; receivable محمد 50; status `delivered_unpaid`; paid "200 of 250"; net worth 375 = opening 300 + profit 75.

**S2 — Equipment on credit**
- Given cash 500. When: expense equipment 300, partial 100 cash · direct sale 120 cash · expense materials 40 cash. Then: profit −220, equipment 300, cash 480, payable 200. When pay 200 → cash 280, payable 0, profit unchanged.

**S3 — Cancel with prepayment**
- Prepayment 30 cash, cancel. (a) m = 30 → profit +30 on cancel date, cash unchanged. (b) m = 0, refund now → cash −30, profit 0.

**S4 — Full return** — direct sale 80 cash collected, return 80 refund now → net revenue 0, net cash 0.

**S5 — Prior receivable** — collect 100 from محمد as "مستحق سابق" → cash +100, profit 0, OPEN +100.

**S6 — Borrow** — deposit 50 borrowed from أخي → cash +50, payable 50, profit 0. Pay 50 → cash −50, payable 0.

**S7 — Reconciliation with difference** — recorded 340, counted 300; answers: utilities 25, withdrawal 10; finish → Q19 −5. Profit −25 only; unexplained "نقص 5".

**S8 — Opposite differences** — recorded cash 200 / account 100; counted 150 / 150 → proposal transfer 50 cash→account; profit unchanged.

**S9 — Withdrawal** — withdrawal 200 → cash −200, profit unchanged.

### 13.2 Edge cases

| ID | Given / When | Then |
|---|---|---|
| T1 | Prepayment 60; deliver at price 50 | REV +50; customer_refund line 10; profit +50 |
| T2 | Deliver 100; collect 30; return 50 refund later | remainder 20; net revenue 50; box unchanged by return |
| T3 | Deliver 100; collect 30 cash; return 80 refund now cash | remainder 0; refund 10; net cash from sale 20; net revenue 20 |
| T4 | Setup cash unknown; sale 100 cash collected; expense 40 cash; first reconciliation counted 260 | Q1 = 200 on box created_on; profit 60; net worth 260; incomplete flag cleared; UNEXP 0 |
| T5 | Expense 50 in October (should be 5), corrected in November | October profit +45 vs before; November unchanged |
| T6 | Same-day sale 30 without name; collect 20 | rejected `E-NAME-REQUIRED-FOR-DEBT` |
| T7 | Collect 80 on prior_receivable with outstanding 50 | rejected `E-OVERPAY` |
| T8 | Cash 20 (known); expense 50 cash | accepted; cash −30; warning `w.negative_box` |
| T9 | Cash 100, account 60; merge | Q14 60; cash 160; account merged; totals and profit unchanged |
| T10 | After T9: split with account 40 | Q14 40; cash 120; account 40 |
| T11 | Prepayment 30; cancel m = 0 refund later; then pay refund | after Q15: PRE 0, payable 30, profit 0; after Q7: cash −30, payable 0 |
| T12 | Product cost 18; sale created; product cost changed to 20 | sale expected profit still uses 18 |
| T13 | Prior payable 70, paid | cash −70; profit 0; OPEN −70 |
| T14 | Lines منسف × 10 (25/18) + كنافة × 5 (12/6); default price 310; final 300; delivered | expected profit 90; top sellers منسف 250 (10), كنافة 60 (5); top profit منسف 70 (7/unit), كنافة 30 (6/unit) |
| T15 | Expense gas 15 from personal money | EXP +15; OWN_IN +15; boxes unchanged; profit −15 |
| T16 | Expense materials 120, partial 50 cash | EXP +120; cash −50; supplier payable 70 |
| T17 | Sale 100; prepayment 20; deliver; collect 50; undo delivery | REV 0; remainder 0; PRE 70; cash 70 (unchanged by undo); status scheduled; net worth 0 |
| T18 | Deliver 100; collect 100; price correction to 90 | REV 90 on delivery date; customer_refund 10 |
| T19 | Free-text line "كيكة" price 40; deliver | expected profit NULL; excluded from product cards; REV +40 |
| T20 | Sale without lines | rejected `E-NO-LINES` |
| T21 | registered 1/11, planned 10/11, prepayment 3/11, delivered 12/11 | REV dated 12/11; cash dated 3/11; registered/planned no effect |
| T22 | Deliver 25; collect 22 + "لن يُحصَّل" | cash +22; Sales 25, Returns & discounts 3, net 22; remainder 0; status completed |
| T23 | Deliver 50; collect 55 | Q6 50 + Q18 5; REV 55; message `S-OVERPAY-KEPT` |
| T24 | Prepayment 20; cancel m = 12; refund 8 now cash | REV +12; cash −8; PRE 0 |
| T25 | Lend 50 to أخت; then write-off | after lend: cash −50, receivable 50, profit and withdrawals unchanged; after write-off: receivable 0, withdrawals +50, profit unchanged |
| T26 | Lend 50; collect 50 | cash back to original; withdrawals unaffected; profit unchanged |
| T27 | محمد sale remainders 30, 40, 50 (in that order); collect 100 by name | allocation 30, 40, 30; 20 remains on third; no shortfall question (multiple lines) |
| T28 | Setup cash unknown; sale 500 cash; expense 60 cash; first reconciliation counted 40; answer "withdrawal 300"; finish | Q1 0; Q12 300; Q19 −100; profit 440; net worth 40 |
| T29 | Credit expense 120; paid 50; try correct expense to 40 | rejected `E-CORRECTION-BREAKS-BALANCES` |
| T30 | Expense materials 12 + delivery 2, paid cash | EXP[materials_packaging] 14; cash −14; operation shows delivery 2 |
| T31 | Delivered tracked sale; hide from tracker | no figure changes; operation remains in activity log |
| T32 | Deliver from tracker | identical result to OP-DELIVER elsewhere |
| T33 | Absence 20 days; return reconciliation all matched, no answers | absence complete = true; no incomplete flag |
| T34 | Two boxes; Δcash −50, Δaccount +10 | proposal transfer 10 cash→account; remaining Δcash −40 goes to "less" questions |
| T35 | Correct a prepayment of a delivered sale | rejected `E-CORRECTION-BREAKS-BALANCES` (undo delivery first) |
| T36 | Collect 20 on a single-line receivable of 25; choose "يبقى مستحقاً" | remainder 5; no REV change |
| T37 | Deliver 50; collect 55 (Q6 50 + Q18 5); undo delivery | REV 0; PRE 55; cash unchanged at +55; status scheduled; net worth 0 |
| T38 | Add prior receivable 40 for tracking only (OP-ADD-PRIOR-BALANCE) | AR 40; OPEN +40; box unchanged; profit 0 |
| T39 | Write-off 30 on a line with outstanding 20 | rejected `E-OVERPAY` |
| T40 | Prepayment dated 5/11; deliver with actual date 3/11 | rejected `E-DATE-ORDER` |
| T41 | Cash 50; split with account amount 80 | rejected `E-SPLIT-AMOUNT` |
| T42 | Reconciliation answer "expense 25" created; later cancel that expense | expense reversed on its date; box +25; reconciliation not reopened |
| T43 | Two boxes; expense 15 from personal money | Q10 + Q8 on cash; cash and account unchanged; profit −15 |
| T45 | Reconciliation: Δcash −40; answer "expense" with amount 50 | expense 50; Δ becomes +10; "more" questions shown |
| T46 | Account balance −20 (known); merge | Q14 cash → account 20; account 0, merged; total unchanged |
| T47 | Account opening unknown; merge | rejected `E-MERGE-UNKNOWN` |
| T48 | Sale planned today, not tracked (`tracked = false`) | listed in «مشروعي الآن» today list |
| T49 | Sale created with planned date yesterday; deliver without changing the date | actual delivery date = yesterday; REV dated yesterday |
| T50 | Prepayment 20; cancel with kept m = 25 | rejected `E-OVERPAY` |
| T51 | Collect 10 from "سامي" who has no open lines, not marked prior | rejected `E-NO-OPEN-BALANCE` |
| T52 | Deliver 25; collect 22 + write-off 3; correct the collection to 25 | Q6 22 and Q17 3 reversed; new Q6 25; REV 25; remainder 0 |
| T53 | Cash opening unknown (two boxes); merge | rejected `E-MERGE-UNKNOWN` |
| T54 | Display of 1250 JOD in a report and on the dashboard; a date of 25 November 2026 | report «1,250.000 د», dashboard «1,250 د», date «25/11/2026» |
| T55 | Same save request sent twice (same request id) | applied once; one operation |
| T56 | Save while offline | nothing saved; `E-OFFLINE` |
| T57 | Order planned 20/11, prepayment dated 22/11, opened for delivery on 25/11 | default actual date 22/11; no `E-DATE-ORDER` |
| T58 | Absence detected; user leaves the return card unstarted, or taps «لاحقاً» inside P-12 | periods overlapping the absence show «بيانات غير مكتملة» |
| T59 | Split with account amount 0 | account active; no ledger entry |
| T60 | Same-day sale 20, delivered and collected in one action | one grouped row `op.sale` 20.000 د; it appears under filters `op.sale` and `op.collect` |
| T44 | Edit customer name of a delivered sale with remainder 30 from "ام سامي" to "أم سامي" | remainder line now listed under "أم سامي"; no ledger entry |

---

## 14. Architecture & extensibility (binding)

Rules for **where** things live, so the system stays easy to extend and change. They do not prescribe a language or framework. **Follow the existing layering of the Micro repository** (it already separates domain / application / storage / server); apply these rules inside it.

### 14.1 Layers
| Layer | Contains | Must not |
|---|---|---|
| **Domain** | Entry types (Q1–Q20), operation rules, invariants, formulas of §8 / §8.2 — pure code, no I/O | Access the database, network, UI, or clock directly (dates are passed in) |
| **Application** | One handler per operation (§5): load state, call domain, run one DB transaction, idempotency (R-25), return result or error code | Contain any financial calculation of its own |
| **Infrastructure** | Database access (repositories), migrations, mapping to tables; uses the app's identity and platform | Contain financial logic |
| **UI** | Screens of `micro-manage-ux-final.md`; renders values returned by a read/query layer; strings from the catalog | **Compute any financial figure**, or write Arabic text outside the catalog |

### 14.2 One place for each thing
- **Ledger entry types and their postings:** one module (registry). Every new type is added there with its balance test.
- **§8 and §8.2 figures:** one read/query module. Every screen and report gets numbers from it. The same figure is never computed twice.
- **Validation and error codes:** one module mapping rules to §11 codes.
- **UI strings:** one catalog keyed by §10 / §11 keys.
- **Formatting (R-20 … R-22):** one formatter (the app's, if it exists).
- **Constants (R-1 … R-27 values):** one config module.

### 14.3 Component boundaries
- Manage is a **separate module** inside the app. Other components (Delivery, Market, Tools) **must not import Manage internals or read Manage tables**; Manage must not import theirs.
- Any future cross-component feature goes through an explicit, documented interface owned by the app, not through shared tables.
- Tools (أدواتي) keeps its own calculation code; it must not depend on Manage domain code.

### 14.4 Extension rules
- **New feature** = new operation contract (§5 style) + its entries + tests, without changing existing entry semantics.
- **New entry type** must satisfy the per-entry balance rule (§3.8) and get tests proving INV-1 … INV-4.
- **Schema changes** only through numbered, forward-only migrations. Ledger tables stay append-only.
- **Every change** to this spec bumps its version; the code records the spec version it implements (one constant), and tests reference rule ids.

### 14.5 Forward-compatible fields (cheap now, useful later)
- `operation.created_by_account_id` (TEXT, NOT NULL): the app account that performed the operation. In v1 it always equals the owner; it allows multi-user later without restructuring.
- `project_id` on every table (already required): allows more than one project per account later.

### 14.6 Data deletion hook
Manage provides one internal function to delete **all** data of a project (for the app's future account-deletion feature). It is the **only** path allowed to delete ledger rows, and it is not exposed in the Manage UI.

### 14.7 To be confirmed at implementation (by the implementing agent, before coding)
- The database engine actually used on Cloudflare (e.g. D1, or Postgres via Cloudflare), and how it provides: one transaction per operation, append-only enforcement for ledger tables, and unique request ids (R-25).
- The exact folder/module mapping of §14.1–14.3 inside the current repository.
