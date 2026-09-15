# SCREEN COVERAGE REPORT — every screen, every theme, one table

Canonical viewport 390×844 (full-page). Extras: 320 / 430 where responsive risk was recorded.
Statuses: PASS = original full-page capture uploaded; NOT_RUN = redirect route (not a screen).

| # | Screen (exact title) | Route | Light 390 | Dark 390 | Extras |
| --- | --- | --- | --- | --- | --- |
| 01 | مشروع النخبة | `/` | PASS | PASS | 320 PASS · 430 PASS |
| 02 | ما اسم مشروعك؟ | `/setup` step 1 | PASS | PASS | — |
| 03 | وين تحط فلوسك؟ | `/setup` step 2 | PASS | PASS | — |
| 04 | شو وضع الدرج هلق؟ | `/setup` step 3 | PASS | PASS | — |
| 05 | شو عندك هلق؟ | `/foundation` | PASS | PASS | — |
| 06 | العمل | `/orders` | PASS | PASS | 430 PASS |
| 07 | تصميم مخطط | `/orders/new?intent=planned_design` | PASS | PASS | — |
| 08 | طلب من عميل | `/orders/draft/:id` | PASS (+fresh-intent state PASS) | PASS | — |
| 09 | سجّل ما اتفقت عليه | `/orders/draft/:id/agreement` | PASS | PASS | — |
| 10 | مجسم شعار من الجبس | `/orders/draft/:id/cost` | PASS | PASS | — |
| 11 | الطلب غير متاح محليًا | `/orders/:id` | PASS (safe state ¹) | PASS (safe state ¹) | — |
| 12 | مراجعة التسليم | `/orders/:id/deliver` | PASS (read-only, confirm not clicked) | PASS | — |
| 13 | تسجيل بيع مباشر | `/direct-sales/new` | PASS | PASS | — |
| 14 | تصحيح بيع مباشر | `/direct-sales/:id` | PASS (safe state ¹) | PASS (safe state ¹) | — |
| 15 | المواعيد | `/schedule` | PASS | PASS | — |
| 16 | الموعد غير متاح محليًا | `/schedule/:id` | PASS (safe state ¹) | PASS (safe state ¹) | — |
| 17 | مالي | `/finance` | PASS | PASS | 320 PASS · 430 PASS |
| 18 | تسجيل استثمار المالك | `/finance/new/:type` | PASS | PASS | — |
| 19 | سحب من المشروع لنفسك؟ | `/finance/withdraw` | PASS | PASS | — |
| 20 | مال المالك | `/finance/owner-entitlement` | PASS | PASS | — |
| 21 | تحصيل أو التزام قريب | `/finance/g5/declaration` | PASS | PASS | — |
| 22 | كشف الفترة | `/finance/statement` | PASS | PASS | 320 PASS |
| 23 | آخر ما حدث | `/finance/activity` | PASS | PASS | — |
| 24 | لا نص للمشاركة | `/share/preview` | PASS (no-source state ¹) | PASS (no-source state ¹) | — |
| 25 | محافظ الكاش | `/cash` | PASS | PASS | — |
| 26 | أين يوجد الكاش الآن؟ | `/cash/wallet/new` | PASS | PASS | — |
| 27 | الدرج (دفتر المحفظة) | `/cash/wallet/:id` | PASS (empty ledger ¹) | PASS (empty ledger ¹) | — |
| 28 | رصيد افتتاحي معروف أصلًا | `/cash/wallet/:id/opening-later` | PASS | PASS | — |
| 29 | اضبط كاش الدرج | `/cash/wallet/:id/adjust` | PASS | PASS | — |
| 30 | تحتاج محفظتين للتحويل | `/cash/transfer` | PASS (two-wallet state) | PASS (two-wallet state) | — |
| 31 | وزّع الكاش غير الموزع | `/cash/distribute` | PASS | PASS | — |
| 32 | عدّ اللي في الدرج فعلًا | `/cash/count` | PASS | PASS | — |
| 33 | جارٍ فتح الأثر… | `/cash/entry/:id/reverse` | PASS (loading state ¹²) | PASS (loading state ¹²) | — |
| 34 | حصّل من مين عليه إلَي | `/collect` | PASS | PASS | — |
| 35 | المواد والمخزون | `/inventory` | PASS | PASS | — |
| 36 | أي مادة تسجّل؟ | `/inventory/material/new` | PASS | PASS | — |
| 37 | أكّد رصيد قماش تغليف | `/inventory/material/:id/confirm` | PASS | PASS | — |
| 38 | استلم شراء مواد | `/inventory/movement/receipt` | PASS | PASS | — |
| 38b | استهلك مادة | `/inventory/movement/consume` | PASS | PASS | — |
| 38c | سجل هدر مادة | `/inventory/movement/waste` | PASS | PASS | — |
| 39 | جارٍ فتح حركة المادة… | `/inventory/movement/:id/reverse` | PASS (loading state ¹²) | PASS (loading state ¹²) | — |
| 40 | منتجاتي وخدماتي | `/catalog` | PASS | PASS | — |
| 41 | احسب قبل أن تلتزم | `/tools` | PASS | PASS | — |
| 42 | حاسبة التكلفة والسعر | `/tools/calculator` | PASS | PASS | — |
| 43 | تقدير المجسم | `/tools/estimate/:id` | PASS | PASS | — |
| 44 | فحص سلامة مالي | `/tools/integrity` | PASS | PASS | — |
| 45 | الأصول | `/assets` | PASS | PASS | — |
| 46 | شراء للاستخدام الطويل | `/assets/new` | PASS | PASS | — |
| 47 | الأصل غير متاح محليًا | `/assets/:id` | PASS (safe state ¹) | PASS (safe state ¹) | — |
| 48 | القروض | `/loans` | PASS | PASS | — |
| 49 | أعطيت مالًا يُعاد | `/loans/new` | PASS | PASS | — |
| 50 | القرض غير متاح محليًا | `/loans/:id` | PASS (safe state ¹) | PASS (safe state ¹) | — |
| 51 | الموردون والمشتريات | `/suppliers` | PASS | PASS | — |
| 52 | سجل شراء مواد | `/suppliers/purchase/new` | PASS | PASS | — |
| 52b | شراء المواد غير موجود | `/suppliers/purchase/:id` | PASS (safe state ¹) | PASS (safe state ¹) | — |
| 53 | شراء المواد غير موجود (دفع) | `/suppliers/purchase/:id/payment` | PASS (safe state ¹) | PASS (safe state ¹) | — |
| 54 | مين عليه إلَي، وعليّ لمين؟ | `/parties` | PASS | PASS | — |
| 55 | الإعدادات | `/settings` | PASS | PASS | — |
| 56 | ملفك وملف مشروعك | `/profile` | PASS | PASS | — |
| 57 | هذه الصفحة ليست جزءًا من هذا الإصدار | catch-all | PASS | PASS | — |
| 58 | Micro مقفل | AppLockGate (dialog) | PASS (engaged) | PASS (engaged) | — |
| 59 | شاشة الإطلاق (Light) | splash overlay (dialog) | PASS (motion mid-flight) | — | — |
| 60 | شاشة الإطلاق (Dark) | splash overlay (dialog) | — | PASS (motion mid-flight) | — |
| 61 | /review | `/review` | NOT_RUN (redirect to `/finance`) | NOT_RUN | — |

**Totals: 131 PASS · 2 NOT_RUN · 0 FAILED.**

¹ Real instances require posting/reversal/deletion actions that the capture policy forbids triggering merely for screenshots; the captured state is the route's genuine reachable state (recovery/empty/loading) — recorded per row in `SCREENSHOT_COVERAGE_MATRIX.csv`.
² The route's recorded behavior for an unknown id is a persistent loading state; the not-found branch is a storage-error path. Preserved as-is (no product change allowed in this scope).
