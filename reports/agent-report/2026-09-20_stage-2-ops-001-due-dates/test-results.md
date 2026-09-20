# نتائج الاختبارات المركزة — Stage 2 / الموجة 1 (OPS-001)

**الفرع:** `stage-2/ops-001-due-dates` · **كود:** `89842e7` · **التاريخ:** 2026-09-20

## الأوامر والخروج

| # | الأمر | الخروج | النتيجة |
|---|---|---|---|
| 1 | `corepack pnpm exec vitest run src/application/finance/dueDatesService.test.ts src/SuppliersDueAging.dom.test.tsx` | 0 | 11/11 PASS |
| 2 | `corepack pnpm exec vitest run client/src/G004CapabilityGuard.dom.test.tsx` | 0 | 7/7 PASS |
| 3 | `pnpm check` | 0 | كامل السلسلة ناجح (lint 37/37؛ text-density ضمن السقوف؛ guards؛ 404 جذور + 234/1649 نموذج؛ build + budget 610,520/144,897) |
| 4 | `python3 scripts/operations-control/validate.py` | 0 | valid: 64 items, 6 workstreams, 1 active claim |
| 5 | `python3 scripts/operations-control/generate_tracker.py --check` | 0 | Views طازجة |
| 6 | `git diff --check` | 0 | نظيف |

## مصفوفة الاختبارات المركزة

| الاختبار | الحالة | الملف |
|---|---|---|
| متجهات التصنيف: none/invalid/overdue/today/upcoming (المفقود ليس اليوم) | PASS | dueDatesService.test.ts |
| التقادم الأساسي: overdue/current/unknown | PASS | dueDatesService.test.ts |
| التقادم بالمبالغ والعدّ + استبعاد المسدّد | PASS | dueDatesService.test.ts |
| حدّ اليوم المحلي (09:00Z اليوم نفسه / 21:30Z اليوم التالي) بساعة قابلة للحقن | PASS | dueDatesService.test.ts |
| لا كتابة عند القراءة (مطابقة readSnapshot قبل/بعد) | PASS | dueDatesService.test.ts |
| فشل قراءة المشتريات → storage_error صادق | PASS | dueDatesService.test.ts |
| ذمم التحصيل: بلا تاريخ مصرّحًا والمبالغ مقروءة (غياب التاريخ ≠ غياب الدين) | PASS | dueDatesService.test.ts |
| فشل قراءة الذمم → storage_error صادق | PASS | dueDatesService.test.ts |
| DOM: متأخر/لم يحن/مستحق اليوم + المفقود «لا يوجد تاريخ استحقاق مسجل» بلا تاريخ مُخترع | PASS | SuppliersDueAging.dom.test.tsx |
| DOM: لا كتابة عند فتح السطح (مطابقة اللقطة) | PASS | SuppliersDueAging.dom.test.tsx |
| DOM: فشل القراءة بطاقة خطأ صادقة + إعادة محاولة بلا كتابة | PASS | SuppliersDueAging.dom.test.tsx |
| Regression: بوابة G-004 (7/7) بعد توصيل الخدمة في الهيكل | PASS | G004CapabilityGuard.dom.test.tsx |

## QA الحي

`NOT_EXECUTED` — لا متصفح حي في بيئة التنفيذ؛ التغطية آلية DOM/Integration أعلاه.
