# Financial Roadmap — Wave 1 Delivery Report (FIN-003 + FIN-007, WS-173)

**Branch:** `feat/fin-003-007-period-comparison-20260922` (base: verified main `63765e539b42e9a28ff83a2af6577488d8f63a28` after Phase 0 PR #210)
**Scope:** period comparison + flexible period review + profit-to-cash bridge — read-only capability. No Writer, no schema/export change (36/28), no new persistent entity, no new route.

## What was built

### Application layer (read-only, composed on the canonical reader)
1. **`periodPresets.ts`** (196 lines): preset family `this/last` week/month/quarter + custom; `resolvePeriodPreset` (inclusive local `YYYY-MM-DD`, Amman semantics, typed rejection of `from > to`); `previousEqualPeriod` (identical length, immediately preceding); `isPeriodActive`; Arabic label map matching existing surface wording. Pure — no store, no React.
2. **`periodComparisonService.ts`** (420 lines): `readPeriodComparison(A, B)` calls the canonical `readRecordedPeriodResult` exactly twice (single math path — asserted by a spy test); every canonical numeric field becomes a comparison line (label + source + kind money/count + a/b/delta/changeBps with null-safety and no divide-by-zero); per-side statuses worst-of propagation; `partial` qualification when either side contains today (never silently treated as completed); `overlapping` flag; `hasNoData` empty-period honesty; invalid range → `invalid` + nulls.
3. **`profitToCashBridgeService.ts`** (392 lines): measured recorded cash delta over the period = order collections/reversals by Amman event date + active direct sales by sale date + all financial-event `cashDeltaMinor` by `occurredOn` − supplier payments (with reversals) + continuity entries affecting total cash (opening/adjustment/reversal; transfers excluded as internal net-zero). Bridge lines from the canonical result to that measured delta, each with Arabic label + source: non-cash add-backs (depreciation, write-off, loss_non_cash), disposal-result removal, retained-deposit-revenue removal, receivables timing, materials timing, operating payables, unallocated shared paid, owner flows, asset flows, loan flows (outgoing only — incoming borrowing honestly absent until FIN-001), amanah flows, cash adjustments. Final `remainderMinor = measured − Σlines` renders as a visible «فرق غير مطابق» line when nonzero; statuses `recorded_only`/`incomplete`/`invalid`; never silent zero.

### Presentation (minimum functional wiring, no redesign)
4. **Statement.tsx**: quarter presets added to QuickRange (this/last); «قارن مع الفترة السابقة» toggle; comparison panel in a collapsed `<details>` with a **side-B selector** («الفترة المقارنة»): previous-equal shortcut (default) OR a user-chosen custom range with date fields seeded from the shortcut — completing the "two user-selected periods" acceptance; side-B label honest to source («السابقة» vs «المقارنة»); excluded-count per side; statuses + reasons; retry idiom on read failure. «فترة جارية» header badge when the displayed period contains today (independent of comparison).
5. **Finance.tsx**: collapsed «لماذا يختلف الربح عن الكاش؟» bridge section over the page's existing period selection (result, measured cash delta, all lines, highlighted remainder when nonzero, status + reasons).
6. **PrototypeServicesContext**: read-only service registration with injectable clock; reading types re-exported from the app root.

## Tests (37 new: 13 + 7 + 8 application + 9 DOM)

- `periodPresets.test.ts` (13): preset resolution incl. Amman month/quarter/year boundaries, previousEqualPeriod across 28/29/30/31-day months, isPeriodActive edges, custom rejection, input immutability.
- `periodComparisonService.test.ts` (7): two complete months via canonical reader; excluded incomplete delivered order visible on the correct side; shared share + payable-then-settlement landing on correct sides; empty vs data period; invalid range; current-period partial (injected clock); overlapping; **no-write full-store deep-equality**.
- `profitToCashBridgeService.test.ts` (8): clean August world balances exactly (measured −18,800 hand-computed: collections +10,000, direct sale +5,000, events −32,300, supplier payments −1,000, continuity −500; result 10,700 + lines = measured, remainder 0, `recorded_only`); in-period depreciation → add-back 600 + honest `incomplete`; timing story (result 5,500 vs cash 1,000 through receivables timing, still balances); orphan wallet reversal → visible «فرق غير مطابق» −7,000 + `incomplete`; reversed range → `invalid` nulls; Amman boundary (22:30Z→August counted, 21:30Z next night excluded); **no-write full-store deep-equality**; storage-error path.
- `StatementPeriod.w173.dom.test.tsx` (6): quarter preset resolution; partial badge presence/absence; shortcut comparison with correct dates; **custom side-B selection with «المقارنة» labeling**; excluded-count rendering; read-failure retry idiom.
- `FinanceBridge.w173.dom.test.tsx` (3): bridge details renders on the clean world; remainder visible when unexplainable; error path.
- 11 existing page-test harnesses extended with the new read-only service registration (+3/+4 lines each, purely additive; zero assertions touched).

## Gates

- Focused suites: all green (see counts above).
- Full `pnpm check` **EXIT 0**: root 434/434; prototype 253 files / **1820/1820**; typecheck clean; lint within 37-warnings budget; prettier clean; text-density all surfaces within caps; design-guards/guards pass; build + PWA OK; bundle budget **645,136/650,000 raw + 153,332/155,000 gzip — PASS**.
- Operations Control validator PASS (WS-173 active claim, no overlaps).
- Independent review (Agent 5 role): **PASS_WITH_NOTES** — all 10 acceptance criteria verified; notes below.

## Honest notes / owner-review items

1. **Density cap raise (owner-vetoable):** `Statement` 209 → **216** in `scripts/text-density-count.py`, documented with dated comment (mandated quarter/comparison labels; panel body inside collapsed details). Statement now sits **exactly at cap** — any future label needs a new documented decision.
2. **Bundle headroom (advisory):** entry chunk grew 625,551 → 645,136 raw (new services registered in the app-root services context). Only ~4.9KB raw headroom remains — future waves should follow the EXE-014/D-034 dynamic-load precedent (OPS-003) instead of raising caps.
3. **Comparison UI:** both capabilities are exposed — user-selected side A (any preset/custom) AND side B (shortcut or custom). The reviewer's earlier "shortcut-only" finding was resolved by the follow-up commit (bc57134).
4. **Bridge scope honesty:** incoming borrowing does not exist yet (FIN-001, Wave 6) — its bridge line reads honestly zero with no events; outgoing loans are reconciled. Depreciation in-period legitimately makes the canonical reader `incomplete` — the bridge propagates that status honestly rather than hiding it.
5. **Coordinator caught + fixed during verification:** (a) an infinite-render loop (object identity in effect deps) that manifested as worker OOM — fixed by primitive deps; (b) missing `source`/`catalogItemId` fields in two new DOM test files (typecheck errors the sub-agent left uncommitted); (c) prettier normalization on application-layer files. All re-gated green.
6. **Deferred by design:** no Markdown export of comparison/bridge (contract 32 covers the single-period statement; comparison export can ride a later wave if the owner asks); no visual QA beyond DOM-level (no live browser in environment — standing limitation).

## Financial invariants checked

Collection ≠ profit; debt ≠ cash; canonical reader is the ONLY result math (spy-verified); expense recognized once by `occurredOn` (settlement adds no second expense — tested); shared expense only as recorded share (no new allocation logic); capital/withdrawals/loans/amanah/assets kept OUT of the result and shown as separate bridge lines; missing knowledge → `incomplete` with reasons (never zero); no writes from any new path (three no-write deep-equality tests + DOM no-write where applicable); no historical mutation; no schema/export/touchpoint change.

## Rollback boundary

Verified main `63765e539b42e9a28ff83a2af6577488d8f63a28`. Rollback = revert this wave's squash merge (self-contained: application layer + tests + two pages + services context + density cap entry). No other wave or protected file depends on it.
