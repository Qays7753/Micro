# أدلة الموجة D (M1.10 + M1.11) — المخرجات الخام

> الصفحة المرجعية للتقرير: `WAVE-D-report-AR.md`. كل مخرج أدناه كما أُنتج فعلًا في تشغيله (اقتُطعت الأسطر المتكررة بـ«…» فقط حيث يُشار للعدد). التشغيلات على شجرة `feature/manage-v2` على التوالي: `893fcd82` (قبل الموجة) ← `51382f5c` (M1.10) ← `0d1f0c1d` (M1.11) ← التزام التقرير (البوابة النهائية عليه).

## §1 المقدمة (preflight) — على `893fcd82` قبل أي تعديل

```
$ git fetch && git rebase FETCH_HEAD
Successfully rebased and updated refs/heads/feature/manage-v2.
$ git log -1 --format=%H
893fcd82dcf2c9a250d41c72a06520f505eefd1f
$ git status --short
(فارغ — الشجرة نظيفة، لا ملفات غير متتبعة)
```

- الفرع: `feature/manage-v2` (فقط). المتتبّع قبل التنفيذ: M1.10 `TODO` وM1.11 `TODO` (بند الموجة D مفوَّض في `893fcd82`).
- بوابة ما قبل الموجة (توثيق الأساس): `corepack pnpm guards` → exit 0 (22 حارسًا PASS)؛ `corepack pnpm test` → exit 0 — **89 ملفًا / 1139 اختبارًا كلها ناجحة**؛ `corepack pnpm typecheck` → exit 0 نظيف.

## §2 M1.10 — الحالة الحمراء المقصودة أولًا (اختبارات أولًا)

### §2.1 حارس فهرس الوثائق بعد توسيع `FULL_COVERAGE_DIRS` وقبل إضافة صفوف الفهرس

```
$ node scripts/check-doc-index-coverage.mjs
check-doc-index-coverage: FAIL unindexed docs/manage-v2/DELETION-MANIFEST.md authority file not mentioned in docs/00-document-index.md
check-doc-index-coverage: FAIL unindexed docs/manage-v2/FIXTURES.md authority file not mentioned in docs/00-document-index.md
check-doc-index-coverage: FAIL unindexed docs/manage-v2/IMPACT.md authority file not mentioned in docs/00-document-index.md
check-doc-index-coverage: FAIL unindexed docs/manage-v2/PHASE-MAP.md authority file not mentioned in docs/00-document-index.md
check-doc-index-coverage: FAIL unindexed docs/manage-v2/REVIEW.md authority file not mentioned in docs/00-document-index.md
check-doc-index-coverage: FAIL unindexed docs/manage-v2/SECURITY-EVIDENCE.md authority file not mentioned in docs/00-document-index.md
check-doc-index-coverage: FAIL unindexed docs/manage-v2/ZAI-TASK-TEMPLATE.md authority file not mentioned in docs/00-document-index.md
check-doc-index-coverage: FAIL unindexed docs/manage-v2/micro-manage-concept-final.md authority file not mentioned in docs/00-document-index.md
check-doc-index-coverage: FAIL unindexed docs/manage-v2/micro-manage-spec-final.md authority file not mentioned in docs/00-document-index.md
check-doc-index-coverage: FAIL unindexed docs/manage-v2/micro-manage-ux-final.md authority file not mentioned in docs/00-document-index.md
check-doc-index-coverage: FAIL unindexed docs/manage-v2/reports/M1.1-evidence.md authority file not mentioned in docs/00-document-index.md
… (25 ملفًا إجمالًا: الجذرية + التقارير + الأوامر + المراجعات)
check-doc-index-coverage: 25 finding(s)
```

(ملاحظة عد: 25 لا 29 لأن `PLAN.md` و`TRACKER.md` و`README.md` تمر بالاسم المجرد من مسارات أخرى — مع ذلك أُدرجت التسعة والعشرون بمساراتها الكاملة في صفوف الفهرس الجديدة 44/44A/44B/44C.)

### §2.2 الراتشة بعد نمو ملف الحارس وقبل مدخل الإرساء

```
$ node scripts/check-file-size-ratchet.mjs
file-size-ratchet: FAIL — 1 نمو/انجرافًا غير مصرح فوق الأساس:
  [within-band-growth] scripts/check-doc-index-coverage.mjs: 148 -> 180 nbLOC (NORMAL -> NORMAL)
```

### §2.3 بعد الإصلاحين

```
$ node scripts/check-doc-index-coverage.mjs
check-doc-index-coverage: catalog coverage complete          # exit 0
$ node scripts/check-file-size-ratchet.mjs
file-size-ratchet: REANCHORED (documented) scripts/check-doc-index-coverage.mjs: 148 -> 180 (NORMAL)
file-size-ratchet: PASS — 653 ملفًا مشمولًا (الأساس 514؛ انكماش 31؛ محذوف 14؛ إرساءات موثقة 194)؛ … # exit 0
```

### §2.4 تحقيق حارس Minor: MoneyFils ليس *Minor بنيويًا (لا تغيير كود ولا إعفاء)

```
$ node -e '… MINOR_TYPE_PATTERN.test(…) …'
MINOR_TYPE_PATTERN.test("MoneyFils") = false
MINOR_TYPE_PATTERN.test("MoneyFils[]") = false
MINOR_TYPE_PATTERN.test("MoneyMinor") = true
$ node scripts/check-money-minor-casts.mjs
check-money-minor-casts: PASS — 514 ملف إنتاج مفحوصًا (خارج المناطق المعتمدة)؛ صفر تأكيدات داخلية إلى عائلة Minor (أساس 0)؛ صفر تأكيدات خارجية غير مصرحة؛ 13/13 موقع تضييق هوية as-number مطابقًا للأساس …  # exit 0
$ node scripts/check-registry-coverage.mjs
registry-coverage: PASS — 42 بيت تطبيق و21 منطقة مجال كلها مذكورة في سجل الملكية …  # exit 0
```

## §3 M1.10 — التصحيح الذاتي: انجراف تنسيق الموجة C (قاعدة التسليم بلا أحمر)

`pnpm format:check` كشف أربعة ملفات من الموجة C خارج التنسيق (بوابة الموجة C لا تشمل format):

```
$ corepack pnpm format:check
[warn] src/domain/manage/money/fils.ts
[warn] tests/manage/money.test.ts
[warn] apps/prototype-web/client/src/application/manage/strings/ar.ts
[warn] apps/prototype-web/client/src/application/manage/strings/stringsCatalog.test.ts
```

عولجت بـ`prettier --write` عليها وحدها — تغيير صياغي محض (إزالة اقتباسات مفاتيح آمنة/لف سطر طويل)؛ قيم الكتالوج بايت-بايت لم تتغير:

```
$ corepack pnpm vitest run tests/manage/money.test.ts apps/prototype-web/client/src/application/manage/strings/stringsCatalog.test.ts
 Test Files  1 passed (1)      # (money.test.ts ضمن الملف — مجموعتان في ملف واحد أبلغ عنه عدّاد vitest كملف واحد ناجح)
      Tests  84 passed (84)
$ corepack pnpm format:check
All matched files use Prettier code style!      # exit 0
```

(فحص فرق `ar.ts` قبل الكتابة أظهر أن التغيير إزالة اقتباسات المفاتيح الآمنة + لف سطر واحد — السلاسل النصية نفسها.)

## §4 M1.10 — بوابة `pnpm check` الكاملة (شرط المهمة: تغيّر الحراس المشتركة)

كل مرحلة exit 0 على شجرة المهمة (سجل التشغيل المرحلي `/tmp/check-m110.log` نقلًا هنا):

| المرحلة | النتيجة |
|---|---|
| operations-control:test | exit 0 |
| operations-control:check | exit 0 |
| typecheck | exit 0 (بلا خرج) |
| lint | exit 0 (٠ أخطاء / ضمن سقف التحذيرات) |
| format:check | exit 0 (بعد التصحيح الذاتي §3) |
| text-density | exit 0 |
| design-guards | exit 0 |
| guards | exit 0 — 22 حارسًا PASS |
| test | exit 0 — 89 ملفًا / 1139 اختبارًا ناجحة |
| prototype:check | exit 0 |
| prototype:test | exit 0 — 478 ملفًا / 3786 اختبارًا ناجحة |
| prototype:build | exit 0 — `check-bundle-surfaces: PASS … within the local baseline` و`build-worker: OK dist/public/_worker.js` |

## §5 M1.11 — رحلة ضبط knip (التشغيلات التشخيصية كاملة)

### §5.1 أول تشغيل (قبل ضبط النطاق): النطاق الضيق يولّد إيجابيات كاذبة للتبعيات + كشف حقيقيين

```
$ KNIP_DISABLE_RAW_TRANSFER=1 corepack pnpm knip
Unused dependencies (3)
clsx            apps/prototype-web/package.json:16:6
tailwind-merge  apps/prototype-web/package.json:21:6
vaul            apps/prototype-web/package.json:22:6
Unused devDependencies (3)
@embedded-postgres/linux-x64        apps/prototype-web/package.json:26:6
miniflare                           apps/prototype-web/package.json:38:6
stylelint-declaration-strict-value  package.json:33:6
Unused exports (16)
PLANNING_INPUT_SCHEMA_VERSION            …planningCalculationLifecycle.ts:43:14
PLANNING_CALCULATION_VERSION             …planningCalculationLifecycle.ts:45:14
previewPlanningCalculation               …application/planning/index.ts:8:3
… (إعادة تصدير الباب + دوال planningToolsService — لأن الصفحات خارج النطاق الداخلي)
```

تحقق الاستخدام الفعلي للتبعيات الست (كلها مستعملة فعلًا خارج النطاق — لذا إطفاء فئتي `dependencies/devDependencies` تحت النطاق المقصوص توثيق قصور التحليل لا إخفاء ميت):

```
$ grep -rn "from \"clsx" apps/prototype-web/client/src/components/primitives/EmptyState.tsx …
clsx → EmptyState.tsx/StatusChip.tsx/ChoiceRow.tsx (مكوّنات خارج النطاق)
tailwind-merge → lib/utils.ts
vaul → components/ui/drawer.tsx
miniflare → worker/tests/harness.ts
@embedded-postgres/linux-x64 → scripts/pg-test-server.mjs (استدعاء ديناميكي مدعوم)
stylelint-declaration-strict-value → .stylelintrc.json (تكوين لا استيراد)
```

### §5.2 تتبع الاستيراد: الباب العام مستهلك من الصفحات عبر `@/` لكن الصفحات خارج النطاق الداخلي

```
$ npx knip --trace-export suggestPlanningPrice
apps/prototype-web/client/src/application/planning/index.ts:suggestPlanningCalculation
└── (no imports found) ✗
apps/prototype-web/client/src/application/planning/planningToolsService.ts:suggestPlanningPrice
└── apps/prototype-web/client/src/application/planning/index.ts:reExport[suggestPlanningPrice] ✗
```

(الصفحات تستورد الباب: `CostCalculator.tsx:31: import { suggestPlanningPrice } from "@/application/planning";` — عندما أدخلت الصفحة داخل النطاق التجريبي اختفت النتيجة، فالسبب تصنيف الداخل/الخارج لا موت الكود.)

### §5.3 النطاق الواسع (كل التطبيق) مرفوض: 55 ملفًا محمّلة بالاتفاق لا بالاستيراد الساكن

```
$ npx knip --config /tmp/knip-wide.json
Unused files (55)
apps/prototype-web/client/src/storage/local/capabilities/actualTimeCapabilityAnchors.ts
… (16 مرساة قدرات + ملفات worker/api/… كلها تُحمَّل بالاتفاق/الديناميكية)
```

### §5.4 النطاق النهائي + الإصلاح الذاتي للتصديرين الميتين الحقيقيين

النتيجة الحقيقية الوحيدة الباقية بعد ضبط النطاق (أبواب عامة معلنة + مسارات الأسماء مثبتة):

```
$ KNIP_DISABLE_RAW_TRANSFER=1 corepack pnpm knip
Unused exports (2)
PLANNING_INPUT_SCHEMA_VERSION  apps/prototype-web/client/src/application/estimates/planningCalculationLifecycle.ts:43:14
PLANNING_CALCULATION_VERSION   apps/prototype-web/client/src/application/estimates/planningCalculationLifecycle.ts:45:14
```

تحقق: لا مستورد لهما في الشجرة كلها (ولا الاختبارات) — لكنهما مستعملان محليًا (`inputSchemaVersion`/`calculationVersion` سطري 131-132). أُزيلت `export` وحدها (بقيت القيمتان والتعليقات والسلوك):

```
$ KNIP_DISABLE_RAW_TRANSFER=1 corepack pnpm knip
(لا خرج — صفر مخرجات)      # exit 0
```

### §5.5 ملاحظة بيئة التشغيل: oxc raw transfer

```
$ corepack pnpm knip        # بلا KNIP_DISABLE_RAW_TRANSFER في هذه الحاوية (4GB ذاكرة)
RangeError: Array buffer allocation failed
    at new ArrayBuffer (<anonymous>)
    at createBuffer (…oxc-parser/…/raw-transfer/common.js:294:23)
```

مفتاح knip الموثق `KNIP_DISABLE_RAW_TRANSFER` يعطل مسار oxc للأداء فقط (النتائج مطابقة)؛ خطوة CI تحمله في `env` ليعمل مسار الكود نفسه في كل بيئة. (داخل الحاوية `new ArrayBuffer(6*1024**3)` يفشل — ذاكرة 4GB — بينما عدّاد الذاكرة الافتراضي لا يقيده.)

### §5.6 حارس النسخ المتضمنة بعد تثبيت knip: انجراف تثبيت جزئي ثم استقرار الشجرة

بعد `pnpm add -Dw knip`: تشغيل `check-vendored-braces` ظل PASS لكن اختباره الدخاني pin العدد=4 vs 5 لأن إعادة التثبيت الجزئية أبقت دليل vite قديمًا (بلا yaml peer) بجانب الجديد:

```
$ corepack pnpm vitest run scripts/check-vendored-braces.test.mjs
AssertionError: expected [ 'prettier@3.9.6:index.mjs', …(4) ] to have a length of 4 but got 5
```

القفل يحمل نسخة vite واحدة فقط (باللاحقة yaml@2.9.1 لأن knip جلب yaml@2.9.1 فحُلّ الـpeer الاختياري)؛ إعادة تثبيت نظيفة من القفل وحّدت الشجرة:

```
$ rm -rf node_modules apps/prototype-web/node_modules tools/micromatch-shim/node_modules
$ corepack pnpm install --frozen-lockfile --ignore-scripts
Done in 8.2s
$ corepack pnpm vitest run scripts/check-vendored-braces.test.mjs
 Test Files  1 passed (1)
      Tests  11 passed (11)
```

(تعقيب بيئة: `--ignore-scripts` أسقط ملفات أسماء الربط التي يولدها postinstall حزمة @embedded-postgres؛ أُعيد توليدها بسكربت الحزمة الرسمي نفسه `scripts/hydrate-symlinks.js` من داخل دليل الحزمة — أثر محلي فقط؛ CI لا يشغّل PG المدمج أصلًا بل حاوية خدمة PostgreSQL 17.5 المثبتة بالبصمة.)

## §6 M1.11 — بوابة `pnpm check` الكاملة + CI

| المرحلة | النتيجة |
|---|---|
| operations-control:test / :check | exit 0 ×2 |
| typecheck | exit 0 |
| lint | exit 0 |
| format:check | exit 0 |
| text-density / design-guards | exit 0 ×2 |
| guards | exit 0 — 22 حارسًا PASS |
| knip (بمسار CI) | exit 0 — صفر مخرجات |
| test | exit 0 — 89/1139 |
| prototype:check | exit 0 |
| prototype:test | exit 0 — 478/3786 |
| prototype:build | exit 0 |

اختبارات سياسة CI بعد إضافة الخطوة:

```
$ corepack pnpm vitest run scripts/ci-workflow-policy.test.mjs scripts/ci-audit-check.test.mjs scripts/ci-audit-step.test.mjs scripts/security/history-secret-scan-workflow.test.mjs
 Test Files  4 passed (4)
      Tests  38 passed (38)
```

## §7 بوابة الموجة النهائية (على رأس الالتزام التوثيقي للتقرير — شجرة الموجة كاملة)

```
$ corepack pnpm guards        → exit 0 — 22 حارسًا PASS (صفر FAIL)
$ corepack pnpm test          → exit 0 — 89 ملفًا / 1139 اختبارًا كلها ناجحة
$ corepack pnpm typecheck     → exit 0 نظيف بلا خرج
$ KNIP_DISABLE_RAW_TRANSFER=1 corepack pnpm knip
                              → exit 0 — صفر مخرجات في النطاق
```
