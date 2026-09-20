# نتائج الاختبارات المركزة — Stage 2 / الموجة 4 (OPS-007 + OPS-009)

**الفرع:** `stage-2/completion-remaining` · **كود:** `33a505b` · **التاريخ:** 2026-09-21

| # | الأمر | الخروج | النتيجة |
|---|---|---|---|
| 1 | `corepack pnpm exec vitest run client/src/application/inventory/inventoryMaterialService.test.ts` | 0 | 33/33 PASS (27 قائمة + 6 جديدة) |
| 2 | `corepack pnpm exec vitest run client/src/components/order/ActualMaterialPanel.dom.test.tsx` | 0 | 6/6 PASS |
| 3 | `pnpm check` | 0 | السلسلة كاملة ناجحة (404+1674 اختبارًا؛ budget 615,929/146,588) |
| 4 | `python3 scripts/operations-control/validate.py` | 0 | valid |
| 5 | `node scripts/check-secrets.mjs` | 0 | PASS — 1620 ملفًا |
| 6 | `node scripts/check-test-focus.mjs` | 0 | PASS — 275 ملف اختبار |
| 7 | `git diff --check` | 0 | نظيف |

| الاختبار | الحالة | الملف |
|---|---|---|
| لقطة تقديرية + استهلاك معلوم → needs_review بسبب snapshot_knowledge والفرق يبقى ظاهرًا (800−2000=−1200) | PASS | inventoryMaterialService.test.ts |
| استهلاك بتكلفة غير معروفة → needs_review بسبب actual_cost_unknown والقيمة تصرَّح «أدنى من الحقيقة» (0−2000=−2000) | PASS | inventoryMaterialService.test.ts |
| السببان معًا يُصرَّحان معًا | PASS | inventoryMaterialService.test.ts |
| recorded → لا أسباب مراجعة | PASS | inventoryMaterialService.test.ts |
| قبل/بعد التسليم + إعادة قراءة: نفس القيم ولا كتابة (مطابقة لقطة المخزن الكاملة) واللقطة نفسها قبل التسليم وبعده | PASS | inventoryMaterialService.test.ts |
| استلام جديد بسعر مختلف (3000): الدليل السعري تحرك + لقطة الطلب التاريخية deep-equal + المقارنة تقرأ 2000 المجمدة (OPS-009) | PASS | inventoryMaterialService.test.ts |
| DOM: recorded يعرض القيم والفرق بلا أسباب وبلا «نهائي» | PASS | ActualMaterialPanel.dom.test.tsx |
| DOM: not_recorded حالة صادقة بلا صفر مضلل | PASS | ActualMaterialPanel.dom.test.tsx |
| DOM: سبب التكلفة غير المعروفة نص مرئي والفرق ظاهر مؤهَّلًا | PASS | ActualMaterialPanel.dom.test.tsx |
| DOM: سبب اللقطة يظهر ويرشد لحالة النتيجة | PASS | ActualMaterialPanel.dom.test.tsx |
| DOM: السببان معًا في سطر الأسباب | PASS | ActualMaterialPanel.dom.test.tsx |
| DOM: القيم المفقودة «—» لا 0.00 (لا قسر إلى الصفر) | PASS | ActualMaterialPanel.dom.test.tsx |
