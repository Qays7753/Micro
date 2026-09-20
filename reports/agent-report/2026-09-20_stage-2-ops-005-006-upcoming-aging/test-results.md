# نتائج الاختبارات المركزة — Stage 2 / الموجة 2 (OPS-005 + OPS-006)

**الفرع:** `stage-2/ops-005-006-upcoming-aging` · **كود:** `3551765` · **التاريخ:** 2026-09-20

## الأوامر والخروج

| # | الأمر | الخروج | النتيجة |
|---|---|---|---|
| 1 | `corepack pnpm exec vitest run client/src/application/finance/upcomingService.test.ts client/src/FinanceUpcoming.dom.test.tsx` | 0 | 6/6 PASS |
| 2 | `pnpm check` | 0 | كامل السلسلة ناجح (lint 37/37؛ FinanceUpcoming 49/49 وFinanceMore 37/37؛ budget 612,661/145,490) |
| 3 | `python3 scripts/operations-control/validate.py` | 0 | valid: 64 items, 7 workstreams, 1 active claim |
| 4 | `python3 scripts/operations-control/generate_tracker.py --check` | 0 | Views طازجة |
| 5 | `git diff --check` | 0 | نظيف |

## مصفوفة الاختبارات المركزة

| الاختبار | الحالة | الملف |
|---|---|---|
| تركيب أربع كتل بمصادرها وتواريخها المعلنة (supplier_due/scheduled_date/no_stored_date) | PASS | upcomingService.test.ts |
| الطلب المسلّم خارج جدول القادم؛ الطلبات بلا مبلغ نقدي | PASS | upcomingService.test.ts |
| التقادم المبسط من إجماليات OPS-001 نفسها (بلا حساب ثانٍ) | PASS | upcomingService.test.ts |
| عزل فشل كتلة: المدفوعات تتعثر والبقية سليمة وaging.payables=null | PASS | upcomingService.test.ts |
| لا كتابة عند القراءة (مطابقة اللقطة) | PASS | upcomingService.test.ts |
| DOM: أربع كتل بمعنى ومصدر لكل موعد والمجهول مبالغه ظاهرة | PASS | FinanceUpcoming.dom.test.tsx |
| DOM: فتح السطح لا يكتب أي سجل | PASS | FinanceUpcoming.dom.test.tsx |
| DOM: فشل كتلة يعزل نفسه (بطاقة + إعادة محاولة + البقية حية + لا كتابة رغم الفشل) | PASS | FinanceUpcoming.dom.test.tsx |
| حارس تزامن معرفة المسارات (مسار جديد مصنف سطحًا بعقد قصد) | PASS | routeKnowledgeSync.test.ts |

## QA الحي

`NOT_EXECUTED` — لا متصفح حي في بيئة التنفيذ؛ التغطية آلية DOM/Integration أعلاه.
