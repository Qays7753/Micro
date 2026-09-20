# نتائج الاختبارات المركزة — Stage 2 / الموجة 5 (OPS-008)

**الفرع:** `stage-2/completion-remaining` · **كود:** `8a67efa` · **التاريخ:** 2026-09-21

| # | الأمر | الخروج | النتيجة |
|---|---|---|---|
| 1 | `corepack pnpm exec vitest run client/src/application/time/actualTimeService.test.ts` | 0 | 8/8 PASS (4 قائمة + 4 جديدة) |
| 2 | `corepack pnpm exec vitest run client/src/ActualTimePanel.dom.test.tsx` | 0 | 6/6 PASS |
| 3 | `pnpm check` | 0 | السلسلة كاملة ناجحة (404+1680 اختبارًا؛ budget 615,915) |
| 4 | `python3 scripts/operations-control/validate.py` | 0 | valid |
| 5 | `check-secrets` / `check-test-focus` / `git diff --check` | 0 | PASS / PASS / نظيف |

| الاختبار | الحالة | الملف |
|---|---|---|
| مواد تقديرية + وقت معروف → recorded (المعرفة من مصدر الوقت — عقد ١٦ §٤) | PASS | actualTimeService.test.ts |
| فعلي 30 < مخطط 60 → فرق سالب −30 صادق | PASS | actualTimeService.test.ts |
| دقائق مخططة صفرية → المخطط غير متاح والفرق غير متاح (لا صفر واثق) | PASS | actualTimeService.test.ts |
| القراءة المتكررة لا تكتب — مطابقة لقطة المخزن الكاملة | PASS | actualTimeService.test.ts |
| DOM: not_recorded مع مخطط معروف — «غير مسجل» لا صفر | PASS | ActualTimePanel.dom.test.tsx |
| DOM: not_recorded مع مخطط غائب — «غير متاح» مرتين | PASS | ActualTimePanel.dom.test.tsx |
| DOM: recorded — القيم والفرق وسطر أثر القراءة فقط | PASS | ActualTimePanel.dom.test.tsx |
| DOM: needs_review تقديري — السبب الصادق ولا «الفرق كبير» المصنوع | PASS | ActualTimePanel.dom.test.tsx |
| DOM: needs_review صفري — «غير متاح» ولا «0 دقيقة» مستقلة | PASS | ActualTimePanel.dom.test.tsx |
| DOM: التراجع الموثق يبقي الأصل ظاهرًا مع سببه وتاريخه | PASS | ActualTimePanel.dom.test.tsx |
