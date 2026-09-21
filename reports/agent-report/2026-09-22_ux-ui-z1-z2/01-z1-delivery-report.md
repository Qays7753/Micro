# Z1 Delivery Report — Home as a Daily Decision Surface (WS-172, Z1.1–Z1.6)

- **Scope & credential mode:** Z1 Home only (package §5 steps Z1.1–Z1.6); owner PAT used exclusively for branch push / PR / PR comments via a local credential file; never printed, echoed, committed, or embedded in any artifact.
- **Baseline SHA:** `b0b4cea66a06c295c65eb895dc2b9067c8b732cf` (verified = `origin/main` at claim; audit branch tip identical).
- **Current branch/SHAs:** `feat/ux-ui-z1-z2-20260921` — Z1 commits in order: `7522129` (Z1.1 tests) → `6f4e799` (Z1.2–Z1.4) → `ffbbf6f` (Z1.5) → `9cf6589` (Z1.5 follow-up) → `becaea0` + `de9c513` (Z1.6 current-diff fixes). Z1.0 docs commit: `6a8cce4`.
- **PR:** #207 (draft, base `main`).

## Files changed and why

| File | Why |
|---|---|
| `client/src/pages/Home.tsx` | Recompose hierarchy: daily-status region (attention/empty/incomplete/normal), priority block with ONE primary CTA, today-summary moved above actions, fixed actions = sale/expense/order only, new secondary cluster (catalog + المزيد), facts as open Rows, background-refresh error with in-place safe retry. |
| `client/src/application/home/homeControlCenterModel.ts` | `dailyStatus` presentation-model derivation + `hasAnyRecordedData` input (ordering/de-duplication semantics only; no financial meaning). |
| `client/src/application/home/homeControlCenterService.ts` | Reader-only: expose existing `hasAnyData`; remove three amount-duplicating insights (unallocated-cash, uncollected-receivables, incomplete-result) per §3.1 no-repeat rule; keep sales-change. |
| `client/src/index.css` | 4 NEW Home-specific selectors only (`micro-home-daily-status`, `micro-home-refresh-error`, `micro-home-secondary-actions`, `micro-home-fact-rows` font fix); zero shared selectors touched; tokens only. |
| `client/src/Home.dom.test.tsx` | Daily-status region, empty-day, error/retry contract additions. |
| `client/src/HomeRedesign.w43.dom.test.tsx` | Re-locked composition contract: three fixed actions; collection absent from fixed actions; secondary cluster; one primary CTA; DOM order (state/actions before numbers; finance/activity last); contextual collection with returnTo; five destinations unchanged. |
| `client/src/application/home/homeControlCenterModel.test.ts` | `dailyStatus` derivation cases. |
| `client/src/application/home/homeControlCenterService.test.ts` | Insights expectations updated; `hasAnyRecordedData` exposure; reader/no-write and unknown≠zero preserved. |
| **Documented §10.6 exceptions (out of allowlist, presentation-only, non-protected):** `client/src/Nav001.dom.test.tsx` (removed `"عربون أو تحصيل"` from the label array — one line) and `client/src/Set003Capabilities.dom.test.tsx` (deleted the single obsolete assertion `expect(row.textContent).toContain("عربون أو تحصيل"))` — one line). Both pinned the pre-Z1 fixed-four composition that package §1.2/§9.1 supersede. Not silent; owner may veto at PR review. |

## Visible behavior changed

- Home opens with a declared daily status (`home-daily-status`, role=status): priority day shows «الأهم الآن» + the item + ONE primary CTA (`Button action="save" block`) — collection appears here only when the priority is a due/overdue item; empty day shows «يومك مفتوح» + the fixed-actions guidance; incomplete-data day names the unregistered facts without inventing numbers; normal day says «لا يوجد شيء عاجل اليوم».
- Fixed action cluster contains EXACTLY «سجّل بيعًا» / «سجّل مصروفًا» / «طلب من عميل» (orders-capability gated). The fixed «عربون أو تحصيل» action was REMOVED; collection is contextual only (due rows `/collect?source=order|sale:<id>` + priority CTA). «منتجاتي وخدماتي» and «المزيد»→«مسودة تصميم» moved to a visually lighter secondary cluster outside the fixed container.
- «اليوم» summary (rows + upcoming line) moved above the actions; «أرقامك» (numbers/facts) moved below actions; facts render as open Rows (Card overload reduced; Cards remain for priority/away/setup receipt only).
- Background refresh failure now keeps the previous ready content and shows an inline `role="alert"` with an in-place safe Retry; first-boot failure keeps the honest full error surface.
- Duplicate amounts across adjacent regions removed (three insights dropped; sales-change kept).

## Contracts and invariants preserved

Reader-only service (no new writes/reads beyond exposing an existing boolean); unknown ≠ zero everywhere; `withReturnTo(href, "/")` on every Home link; five destinations and routes unchanged; no recurring-expense content on Home; frozen Arabic product words kept; priority legality/sorting/de-dup/limits unchanged; fact sources/roads model values identical (ReadLayerParity green); primitives/tokens only (no hex/rgb/hsl; design-token guards green); no new states/writers/routes/dependencies; schema/export 36/28 untouched.

## Exact commands, tests, and checks (all on Z1 HEAD `de9c513`)

1. Z1 targeted gate — `pnpm --filter @micro/prototype-web exec vitest run` over the 12 §7.2 files (Home.dom, HomeRedesign.w43, model+service tests, navigation, navigationContract, routeClassifier, routeKnowledgeSync, ArabicRtlContent.w44, Accessibility.w44, U09.css, StateRecovery.w44): **12 files / 104 tests PASS**.
2. Extended related sweep (17 files, adding Nav001, Set003, G004CapabilityGuard, G5Activity, ReadLayerParity, QuickFormsNotify, projectFinancialService.evidence): **135/135 PASS**.
3. `pnpm prototype:check` (tsc): **PASS** after fixing one current-diff seed error (missing `CostSnapshotInput.source` in HomeRedesign test — commit `becaea0`).
4. `pnpm design-guards` (token guards + theme contrast 82/82 + stylelint): **PASS**.
5. `pnpm check` (full gate: operations-control tests+validator, typecheck, lint 37/37 ceiling, format, text-density, design-guards, guards, root suite 434, prototype suite, build + bundle budget): **EXIT 0** — bundle 625,542/650,000 raw · 148,559/155,000 gzip PASS.
6. `pnpm text-density`: Home **77 → 71** (cap 78); all other surfaces unchanged.
7. Z1.1 red-state record: contract tests landed first and failed **19/81** exactly on composition-difference assertions before implementation (expected per package Z1.1).

## Visual QA (live, production build; §8.2/§8.4)

Evidence class **VERIFIED** for: first-use after setup; empty day; incomplete-data day; attention day with debt priority; fixed actions = exactly sale/expense/order (no collection); contextual collection CTA → `/collect?source=sale:<id>&returnTo=%2F` with source identity, person, item, remaining, and partial options; partial collection result «الباقي على أم سليم: 240.00 د.أ — الديون مستمرة» (partial never presented complete); return to Home preserved; bottom nav exactly five destinations in order; NO horizontal overflow at 320/360/390/430; zero console errors and zero page errors across the whole session; long Arabic project name and 4-digit amounts render correctly. Screenshots: `screenshots/home-empty-320.png`, `home-after-sale-{320,360,390,430}.png`, `home-priority-day-390.png`, `collect-partial-390.png`.

**NOT_EXECUTED (live):** loading state and error/retry live replay (covered by gated DOM tests), real-device QA / Safe Area / physical keyboard (no physical device in environment — `REAL_DEVICE_QA_NOT_PERFORMED`), iOS/WebKit.

## Evidence classes for material claims

- Baseline SHA equality, clean worktree, no open PRs, validator PASS, full gate EXIT 0 at baseline and at Z1 HEAD: **VERIFIED**.
- Live visual behaviors listed above: **VERIFIED** (headless Chromium on the production build).
- Safe Area / physical device / WebKit: **NOT_EXECUTED** (environment).
- §10.6 exception classification (presentation-only, non-protected): **VERIFIED** against the protected-files list §4.2 and the diffs shown above.

## Failures and classification

- `prototype:check` tsc failure (missing `CostSnapshotInput.source` in the new test seed): **current-diff** — fixed in allowlisted file, commit `becaea0`.
- Prettier format failure on `Home.tsx`: **current-diff** — fixed, commit `de9c513`.
- No pre-existing, environmental, or outside-wave failures remain.

## Protected-file exceptions

None (FinancialEventEditor, QuickActionSheet, navigation files untouched). Out-of-allowlist documented exceptions: exactly the two §10.6 single-line test edits listed above.

## Deferred work

Loading/error live visual replay; real-device QA; physical keyboard/Safe Area checks; Dark Mode/tablet/desktop (out of scope by package); remaining Z2 waves (next).

## Rollback boundary

Revert Z1 commits in reverse order (`de9c513` → `becaea0` → `9cf6589` → `ffbbf6f` → `6f4e799` → `7522129`); docs commit `6a8cce4` (claim/card) stays unless the whole claim is abandoned. Z1 never touches order/sale/expense/collection/finance/recurring/Domain/Storage source files, so reverting is self-contained before Z2 begins.

## Owner decision required

`NONE` for Z1 as specified — with the single disclosed item that the two §10.6 test-assertion exceptions are owner-vetoable at PR review.

**Status: `Z1_COMPLETE — Z2_READY`** (gates recorded above; Z2 starts only from this checkpoint).
