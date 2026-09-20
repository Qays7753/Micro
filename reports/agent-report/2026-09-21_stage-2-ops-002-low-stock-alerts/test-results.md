# نتائج الاختبارات المركزة — Stage 2 / الموجة 6 (OPS-002)

**الفرع:** `stage-2/completion-remaining` · **كود:** `6b5abaa` · **التاريخ:** 2026-09-21

| # | الأمر | الخروج | النتيجة |
|---|---|---|---|
| 1 | `corepack pnpm exec vitest run tests/domain/inventory-material.test.ts` | 0 | 16/16 (4 جديدة) |
| 2 | `corepack pnpm exec vitest run client/src/application/inventory/inventoryMaterialService.test.ts` | 0 | 39/39 (6 جديدة) |
| 3 | `corepack pnpm exec vitest run client/src/application/preferences/preferencesFieldPreservation.test.ts` | 0 | 3/3 |
| 4 | `corepack pnpm exec vitest run client/src/InventoryLowStock.dom.test.tsx` | 0 | 5/5 |
| 5 | `pnpm check` | 0 | السلسلة كاملة (404+1693؛ budget 617,376) |
| 6 | `validate.py` / `check-secrets` / `check-test-focus` / `git diff --check` | 0 | صالح / PASS / PASS / نظيف |

| الاختبار | الحالة | الملف |
|---|---|---|
| مصفوفة الحالة الكاملة (تحت/عند/فوق/بلا حد/مجهول/غير متتبع) | PASS | tests/domain/inventory-material.test.ts |
| الحد الغائب أو الصفر أو السالب = لا سياسة | PASS | tests/domain/inventory-material.test.ts |
| الكمية غير المؤكدة (بمعرفة أو بلا حركات) لا تنبيه | PASS | tests/domain/inventory-material.test.ts |
| غير المتتبَّعة لا تُقيَّم | PASS | tests/domain/inventory-material.test.ts |
| الحد المعلن يقارن صراحة في overview؛ مجهول/غير متتبع لا يقيَّمان | PASS | inventoryMaterialService.test.ts |
| المساواة حالة مستقلة صامتة | PASS | inventoryMaterialService.test.ts |
| سجل قديم بلا الحقل = لا يُخترع حد | PASS | inventoryMaterialService.test.ts |
| حفظ/إزالة الحد عبر البوابة + رفض غير الصالح + إعادة القراءة | PASS | inventoryMaterialService.test.ts |
| بلا كتابة عند القراءة (مطابقة لقطة المخزن الكاملة) | PASS | inventoryMaterialService.test.ts |
| فشل قراءة التفضيلات = تدهور صادق لا فشل صفحة | PASS | inventoryMaterialService.test.ts |
| الحدود تنجو من كل كتّاب التفضيلات (EXE-002) | PASS | preferencesFieldPreservation.test.ts |
| DOM: بلا حد = صمت؛ محرر داخل details منهار | PASS | InventoryLowStock.dom.test.tsx |
| DOM: التنبيه بقيمته المفهومة؛ المجهول صمت | PASS | InventoryLowStock.dom.test.tsx |
| DOM: المساواة ليست تنبيهًا | PASS | InventoryLowStock.dom.test.tsx |
| DOM: الحفظ يفعّل التنبيه بلا إعادة تحميل (تفضيل حقيقي) | PASS | InventoryLowStock.dom.test.tsx |
| DOM: تعطيل القدرة يخفي المحرر ويبقي القراءة (G-004) | PASS | InventoryLowStock.dom.test.tsx |
