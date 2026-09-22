# Financial Roadmap — Wave 5 Delivery Report (FIN-006, WS-177)

**Branch:** `feat/fin-006-catalog-item-result-20260923` (base: verified main `83197b1c214f25a400ed81f88823d2221fd5ae83` — Wave 4 closed)
**Scope:** canonical per-catalog-item recorded result. **Schema/export unchanged 37/29**; no new store; read-derived only; margins stay recorded values.

## What was built

1. **Canonical separation on the identity-keyed path** (`recurringWorkService.readRecurringWork` — the existing per-item per-period reading, extended in place rather than duplicated): the **final-only core is preserved byte-for-byte** (finalOrderCount/directMarginMinor/recognizedRevenue/DirectCost from recorded values); **estimated orders** now appear with their **recorded** revenue and margin **separated from the core** (never merged, never hidden); **incomplete and review-required orders** are a visible count without values (arithmetic bucket: delivered − final − estimated — no fourth scan); the delivery-attribution inventory now runs **once** over delivered-in-period orders instead of per item.
2. **Visible unlinked exclusion**: delivered orders inside the period **without a linkable catalog reference** — both `catalogItemId === null` (legacy) and dangling references to missing items — are listed in the readings envelope with their **historical item names and recorded result statuses**: excluded from every row, never merged by display name, never silently invisible.
3. **Surface** (`CatalogReadingsSection`): per-item separation lines («تقديرية منفصلة: N طلبًا · إيراد مسجل · هامش تقديري — لا تدخل الرقم النهائي» / «N طلبًا غير مكتمل أو مقفلًا للمراجعة») and the envelope unlinked note, all rendered **inside the collapsed `<details>` body — the density-free zone per the §10.1 counter rule: Catalog cap 93/93 unchanged**. The existing honesty note («لا تعني صافي ربح نهائيًا، ولا توصية سعر») stays; no price/stop recommendations anywhere.
4. **Identity keying guarantee**: rows were and remain keyed by stable `catalogItemId`; a dedicated test pins that two items sharing the same display name produce two separate rows (display-name keying cannot leak in). Catalog item names/units are immutable after creation (only price/cost defaults revise — `updateCatalogItemDefaults`), and a test proves a **default-price revision never rewrites historical margins** (recorded values only).
5. **Entry-bundle discipline**: the service lives in the app-root context (entry chunk); the additions initially pushed the entry to 650,075 > 650,000 (D-034 hard gate). Compacted the added logic (arithmetic bucket counting + single-pass estimated sums + one-pass delivery inventory) → **649,919/650,000 raw + 154,310/155,000 gzip — PASS** without weakening any behavior.

## Tests (8 new: 5 service + 3 DOM)

- **Service** (`recurringWorkService.fin006.test.ts`): final core unchanged while estimated recorded values and incomplete counts are separated; unlinked visibility for null-identity AND dangling references with historical names; same-name/two-identity guard; catalog default-price revision leaves margins frozen (recorded-values-only); no price/stop recommendation wording in reasons/next actions.
- **DOM** (`CatalogItemResult.w177.dom.test.tsx`): the separation renders with recorded values visibly apart; the unlinked note renders with names and the exclusion wording; clean periods render zero noise.

## Gates

- Full CI-equivalent pipeline green: typecheck (root + workspace); lint 0 errors / **37 warnings (budget 37)**; prettier; **text-density all caps — Catalog 93/93 unchanged (collapsed-details rule)**; design-guards; guards; root suite **465/465**; prototype suite **263 files / 1865/1865** (+8); build + PWA; bundle **649,919/650,000 raw + 154,310/155,000 gzip — PASS (compacted)**.
- Operations Control: validator PASS (64 items, 19 workstreams, 1 active claim).

## Owner-review items (vetoable)

1. None new — no cap raises this wave (Catalog 93/93 and Finance 330/330 unchanged); the reopen of FIN-006 (DEFERRED→READY) followed the WS-174 owner-roadmap-order precedent recorded in status_history.

## Not changed (intentionally)

The G5 mix (display-name keyed by contract 17 §5 — a different, explicitly labeled reading); `calculateBreakEven` and all G5 domain policies; every storage writer; catalog creation/update paths; the period view; schema/export (37/29); no new store or entity.

## Rollback boundary

`83197b1c214f25a400ed81f88823d2221fd5ae83` (verified main immediately before this wave). Revert = single revert of the wave squash merge (self-contained: service additions + surface display + tests + tracker updates).
