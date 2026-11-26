# أدلة الموجة E الخام — المخطط والسجل والثوابت (M2.1 + M2.2 + M2.3)

> هذه الأدلة تجميع مرجعي للبوابة النهائية للموجة؛ الأدلة الخام الكاملة لكل مهمة في ملفات أدلة المهام نفسها (`M2.1-evidence.md` و`M2.2-evidence.md` و`M2.3-evidence.md`). كل أمر أدناه كما أُنتج فعلًا على شجرة المهمة (قبل الالتزامات التوثيقية الملاصقة).

## §1 بوابة الموجة النهائية (على شجرة المهمة M2.3 — ختام الموجة)

```
$ corepack pnpm guards ; echo EXIT=$?
  (22 سطر «: PASS» و0 «: FAIL» في المخرج)
  EXIT=0

$ grep -c ": PASS" /tmp/guards.log
22
$ grep -c ": FAIL" /tmp/guards.log
0

$ corepack pnpm typecheck ; echo EXIT=$?
  (نظيف بلا أخطاء)
  EXIT=0

$ corepack pnpm test ; echo EXIT=$?
 Test Files  91 passed (91)
      Tests  1271 passed (1271)
  EXIT=0

$ corepack pnpm exec vitest run tests/manage/invariants.test.ts
      Tests  66 passed (66)

$ corepack pnpm lint ; echo EXIT=$?
✖ 35 problems (0 errors, 35 warnings)
  EXIT=0

$ corepack pnpm format:check ; echo EXIT=$?
All matched files use Prettier code style!
  EXIT=0

$ KNIP_DISABLE_RAW_TRANSFER=1 corepack pnpm knip ; echo EXIT=$?
  (صفر مخرجات في النطاق)
  EXIT=0

$ corepack pnpm --filter @micro/prototype-web test ; echo EXIT=$?
 Test Files  479 passed (479)
      Tests  3804 passed (3804)
  EXIT=0
```

حراس `pnpm guards` الـ22 كلها PASS — منها ما يمس هذه الموجة مباشرة:

```
check-money-minor-casts: PASS — 524 ملف إنتاج مفحوصًا؛ صفر تأكيدات Minor؛ 13/13 موقع تضييق مطابق للأساس
manage-literal-text: PASS — 3 ملف سطح مانج مفحوصًا؛ 0 حرفية عربية خارج الكتالوج
deleted-imports: PASS — صفر استيراد لمسار محذوف وصفر إحياء
check-lint-warning-baseline: PASS — 35 تحذيرًا بالضبط (max-lines-per-function=18 + complexity=17) = الأساس المعتمد
```

## §2 مسار tests-first لمهمة الموجة الأخيرة (M2.3)

الفشل الأول المقصود (قبل كتابة الموديول):

```
$ corepack pnpm exec vitest run tests/manage/invariants.test.ts
 TypeError: check is not a function
 Test Files  1 failed (1)
      Tests  65 failed | 1 passed (66)
```

الفشل الوسيط الجوهري (خطأ إشارة ΣUNEXP في مصادر صافي الثروة — كشفه S7):

```
- Expected
+ Received
  {
    "invariantId": "INV-1",
-   "outcome": "pass",
+   "outcome": "violation",
+   "violations": [
+     "صافي الثروة (300000 فلس) لا يساوي مصادره (310000 فلس) — الفرق -10000 فلس (§8/§9 INV-1).",
+   ],
  }
 Tests  3 failed | 63 passed (66)
```

بعد التصحيح:

```
$ corepack pnpm exec vitest run tests/manage/invariants.test.ts
      Tests  66 passed (66)
```

والفشلان الوسيطان الآخران (typecheck وراتشة lint) وتصحيحهما الذاتي موثقان حرفيًا في `M2.3-evidence.md` §3 و§4 (بلا أي إرساء أساس — عاد العدد 35 بالضبط).

## §3 بوابة ما قبل المهمة (شجرة M2.2 — شرط البدء)

على `55375cdf` (رأس بعيد مطابق، شجرة نظيفة): بوابة الموجة الجزئية كانت خضراء كما وثقها تقرير M2.2 — guards 22 PASS / test 90 ملفًا/1205 اختبارات / typecheck exit 0 / lint 0/35 / format exit 0 / knip exit 0 / prototype 479 ملفًا/3804 اختبارات.

## §4 الحالة عبر الموجة

| | قبل M2.1 | بعد M2.2 | بعد M2.3 (البوابة) |
|---|---|---|---|
| ملفات الاختبار | 89 | 90 | **91** |
| الاختبارات | 1139 | 1205 | **1271** |
| تحذيرات lint | 35 | 35 | **35** (= الأساس، بلا إرساء) |
| حراس PASS | 22 | 22 | **22** (صفر FAIL) |
| prototype | 478/3786 | 479/3804 | **479/3804** |
| knip في النطاق | 0 | 0 | **0** |

(اختبار الهجرة 18/18 يعمل داخل مساحة العامل: `apps/prototype-web/worker/tests/manage.v2.schema.test.ts` — فنما عدّاد prototype بعد M2.1 من 478/3786 إلى 479/3804 (+1 ملف/+18 اختبارًا) ولم يمس عدّاد الجذر؛ واختبار السجل واختبار الثوابت داخل `tests/manage/` فعدّاد الجذر وحده هو الذي نما بعدهما.)
