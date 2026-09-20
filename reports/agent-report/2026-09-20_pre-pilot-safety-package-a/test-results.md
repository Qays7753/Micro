# نتائج الاختبارات — الحزمة (أ) G-001/G-002/G-003/G-006

**التاريخ:** 2026-09-20 · **الفرع:** `fix/pre-pilot-safety-a-b` · **HEAD:** `233861763598c64f9ee4d1f3fb46f5ffb04714fb` · **خط الأساس:** `3702c9013…` (CI SUCCESS)

## الأوامر المركزية (نتائج حرفية)

```
$ pnpm check
→ EXIT 0 — كامل المسار: operations-control tests + validator + typecheck + lint + format:check
  + text-density + design-guards + guards + test + prototype:check + prototype:test + build
  + bundle-budget: PASS (raw=607141 / gzip=143986 ≤ 650000/155000)

$ pnpm test
  Test Files  36 passed (36)
       Tests  404 passed (404)

$ pnpm prototype:test
  Test Files  228 passed (228)
       Tests  1611 passed (1611)

$ pnpm typecheck
→ 0 errors

$ node scripts/check-secrets.mjs
→ check-secrets: PASS — 1577 files scanned, 0 secret patterns

$ node scripts/check-test-focus.mjs (ضمن guards)
→ PASS (لا .only/.skip)

$ python3 scripts/operations-control/validate.py
→ Operations Control valid: 64 items, 4 workstreams, 1 active claims, origin/main=3702c9013…

$ git diff --check
→ نظيف
```

## الاختبارات الجديدة (52) — كلها ناجحة

| الملف | الاختبارات |
|---|---|
| `client/src/storage/local/orderCommitGuard.test.ts` | 7 — missing record · key reuse · stale base · dropped event · wrapper change · clean commit · null≡undefined |
| `client/src/application/fulfillment/orderWriteStaleResults.test.ts` | 9 — two-context conflict (winner preserved) · same-key reuse · conscious re-save · independent orders · agreement path · delivery-vs-collection race (nothing written) · old-data compatibility · genuine storage_error · export/restore then write |
| `client/src/application/fulfillment/deliveryReviewService.priorConsumption.test.ts` | 11 — full prior (skip) · partial (remaining only) · none (= planned, legacy) · multiple materials mixed · no false shortage · insufficient stock (remaining−available) · reversed prior excluded · write-boundary rejection (nothing written) · commit remaining only · idempotent retry (reused) · no double cost (result fields snapshot-derived) |
| `client/src/application/suppliers/supplierPurchaseService.attributionAtomicity.test.ts` | 12 — cash purchase (0 allocations) · credit+initial wallet atomic · later payment derived key · invalid wallet (nothing written) · injected failure (no half state) · legacy half-state heal → MIC-17 PASS · concurrent double-click (1 payment/1 allocation) · replay after success (zero new writes) · multiple wallets · MIC-17 healthy PASS · MIC-17 intentionally incomplete FAIL · export/restore round-trip + post-restore write |
| `client/src/application/finance/withdrawalWalletGuard.test.ts` | 13 — guard pure (below/equal/above/zero/invalid/bad-amount/unallocated) · ledger (below/equal/above-nothing-written-then-other-wallet/same-key reuse/reversal restores) · event (above=no event/within=+allocation/unallocated records) · both paths same message · period expenses/result unchanged |

## اختبارات قائمة حُرّكت (نفس التوقعات، مسارات الكتابة الجديدة)

- `adapterConformance.group10.test.ts` — `commitOrderDelivery(base, …)` (2)
- `IndexedDbLocalStore.delivery.test.ts` — base parameter (2)
- `supplierScheduleStaleResults.test.ts` — مضاعف الفشل عبر الالتزام الموحد (1)
- `G3Hardening.dom.test.tsx` — العدّ والإقحام عبر `commitSupplierPurchaseWithAttribution` (6 ضمن الملف)
- `collectionService.test.ts` — حقن الفشل عبر `commitOrderUpdate` (1)
- `ownerEntitlementService.test.ts` — بذر رصيد افتتاحي (17 ضمن الملف)
- `ownerCrossModelDuplicates.test.ts` — بذر رصيد افتتاحي (6 ضمن الملف)
- `ownerEntitlementTransfer.test.ts` — بذر رصيد افتتاحي + عدّ القيود (14 ضمن الملف)
- `integrityCheckService.test.ts` — قائمة الفحوص + MIC-17 (كلها ضمن الملف)

## الحصيلة

- **404 + 1611 = 2015 اختبارًا ناجحًا** (منها 52 جديدة لهذه الحزمة) — صفر إخفاقات.
- فشل محقون آلي (fault injection) في اختبارين — ليس إثبات متصفح حي (NOT_EXECUTED للتحقق الحي).
