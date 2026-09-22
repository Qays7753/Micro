# Financial Roadmap — Wave 3 Delivery Report (FIN-005, WS-175)

**Branch:** `feat/fin-005-short-cash-horizon-20260923` (base: verified main `557c44efc265241ce30db5f781931466921745cd` — Wave 2 + D-038 closure)
**Scope:** short-cash horizon reading 7/30/90 days (default 30). **Schema/export unchanged 37/29**; no new persistent entity; no new store; the reading writes nothing.

## What was built

1. **Pure horizon resolver** (`apps/prototype-web/client/src/application/finance/shortCashHorizon.ts`): the approved family `{7, 30, 90}` with `DEFAULT_SHORT_CASH_HORIZON_DAYS = 30`; horizon = **[today, today+N−1] inclusive** in Asia/Amman local dates (`YYYY-MM-DD`, treated as strings — the caller owns clock derivation); UTC-millis-on-local-midnight arithmetic exactly matching `periodPresets.ts` (Wave 1); typed rejection for out-of-family values and invalid dates (validation messages as inline `message:` literals per the g5Service pattern — moment-of-action, never at-rest).
2. **Read-only service read** (`g5Service.readShortCashHorizon(days)`): derives today from the service's **injectable clock** (`now()` → `localDateInAmman`), resolves the window, then calls the **same canonical `calculateShortCash` engine with the formula unchanged** (recorded cash + declared collections − declared commitments). Reads only existing canonical sources (position, orders, events, purchases, declarations). Dated receivables/obligations enter only with a valid `dueOn` inside the window; undated material balances stay visibly outside the number and force `incomplete` with `projectedCashMinor: null`; negative forecasts display honestly; no blocking, no automatic action.
3. **Minimal surface wiring** (`pages/Finance.tsx` `CashDecisionSurface`): horizon selector (three `micro-text-action` toggles, `aria-pressed`, default 30) + the horizon window dates in the card heading. The short-cash reading is now an **independent read block** (own state + effect on `[horizonDays, dataVersion, retryCount]`) following the bridgeState/G-005 isolation precedent — **no longer tied to the page's month range**, which continues to drive only the period result / break-even / declarations. Failure of the horizon read shows the g5 block fallback card without hiding position cards. No visual redesign; no UX-001 work.
4. **`readDecision` left intact**: the general-window short-cash capability (contract 17 §7 reading over any from/to) remains for period-view composition and existing tests — the horizon family composes the same engine, no second math path.

## Tests (16 new: 8 pure + 5 service + 3 DOM)

- **Pure resolver** (`shortCashHorizon.test.ts`): family/default constants; 7/30/90 windows anchored on today inclusive; month boundary (09-23 + 29 → 10-22); 90-day across year (2026-11-15 → 2027-02-12; leap-year-before-anchor no-op); year-end (12-28 + 6 → 01-03); leap anchors (2028-01-31 + 29 → 2028-02-29 vs 2027 → 2027-03-01); out-of-family rejection (14/60/1); invalid-date rejection; input immutability.
- **Service** (`g5Service.shortCashHorizon.test.ts`): clock-anchored window + **formula unchanged** (cash −1000 + collection 4000 → 3000); **edge inclusion both ends + strict one-day exclusion with per-horizon differences** (7/30/90 commitments 1000/2000/3000 over the same three dated purchases); undated → `incomplete` + `undatedPayablesMinor` visible + `projectedCashMinor: null`; **no-mutation proof**: full-store `readSnapshot()` deep-equality before/after reading all three horizons with live events + declarations; negative projected cash shown.
- **DOM** (`FinanceShortCashHorizon.w175.dom.test.tsx`): family buttons present with 30 pressed by default and the Amman window rendered; switching to 7 days re-reads (window 23/09 → 29/09) without any `notifyDataChanged` call (reading never writes); horizon window stays anchored on today regardless of the page's month-range selection.

## Gates

- Full CI-equivalent pipeline green: typecheck clean; lint 0 errors / 37 warnings (budget 37); prettier; **text-density all caps OK (Finance 322/322 — documented raise, see below)**; design-guards; guards (secrets 1705 files / 0, test-focus 298 / 0, entity-touchpoints PASS, runtime cycles 0); root suite **454/454**; prototype suite **260 files / 1852/1852** (+16); build + PWA; bundle **649,292/650,000 raw + 154,148/155,000 gzip — PASS** (headroom 708 bytes noted for future waves).
- Operations Control: validator PASS (64 items, 17 workstreams, 1 active claim); views regenerated from JSON sources only.

## Owner-review items (vetoable)

1. **Density cap Finance 318→322** (4 mandated strings: «٧ أيام» / «٣٠ يومًا» / «٩٠ يومًا» + one group aria-label «أفق قراءة الكاش») — the D-038 model: documented in the CAPS ledger with reason, owner-vetoable at review, to be closed with the wave's owner-decision record.

## Not changed (intentionally)

Domain `calculateShortCash` and all G5 domain policies (byte-identical); `ShortCashDeclaration` store/export/touchpoints (37/29 unchanged); G5DeclarationEditor; period presets; the period view's break-even/comparison surface; every storage writer. No cleanup, no structural refactor, no route changes.

## Rollback boundary

`557c44efc265241ce30db5f781931466921745cd` (verified main immediately before this wave). Revert = single revert of the wave squash merge (self-contained: resolver + service method + wiring + tests + density ledger entry + tracker updates in this PR).
