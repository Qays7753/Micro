# أدلة الموجة G الخام — عمليات الفتح والمصروف ومال المالك والتحويل (M2.5 + M2.6 + M2.7)

> السجلات الكاملة محفوظة خارج المستودع في `verify-logs/m27/` (أوامر بوابة الختم). أدلة كل مهمة بتفصيلها: `M2.5-evidence.md` و`M2.6-evidence.md` و`M2.7-evidence.md`.

## §1 بوابة الموجة G على الشجرة النهائية (شجرة التزام M2.7)

```
$ git rev-parse --short HEAD && git status --short
 → شجرة التزام M2.7 (الملفات السبعة للمهمة + ملفات التوثيق)
$ corepack pnpm guards
 → application-ambient-time: PASS … diagnostics-storage: PASS … label-vocabulary: PASS
   … a11y-dialog-surfaces: PASS … manage-literal-text: PASS … deleted-imports: PASS …
 → 22 حارسًا PASS / صفر FAIL — exit 0

$ corepack pnpm typecheck          → نظيف — exit 0
$ (cd apps/prototype-web && npx tsc --noEmit)   → نظيف — exit 0

$ corepack pnpm test
 Test Files  91 passed (91)
      Tests  1271 passed (1271)
   Duration  80.43s — exit 0

$ corepack pnpm lint               → 0 errors / 35 warnings (= الأساس) — exit 0
$ corepack pnpm format:check       → All matched files use Prettier code style! — exit 0

$ KNIP_DISABLE_RAW_TRANSFER=1 corepack pnpm knip   → صفر مخرجات في النطاق — exit 0
```

## §2 الحزمة الكاملة (prototype)

```
$ corepack pnpm --filter @micro/prototype-web test

 Test Files  484 passed (484)
      Tests  3869 passed (3869)
   Duration  391.28s — exit 0
```

(484 = 483 قبل المهمة + ملف `manage.v2.ownerMoney.test.ts`؛ 3869 = 3852 + 17.)

## §3 التركيز النهائي لعمليات الموجة (بلا انحدار عبر المهام الثلاث)

```
$ corepack pnpm --filter @micro/prototype-web test -- \
    worker/tests/manage.v2.ownerMoney.test.ts worker/tests/manage.v2.expense.test.ts \
    worker/tests/manage.v2.routeAccess.test.ts worker/tests/manage.v2.operations.setup.test.ts \
    worker/tests/manage.v2.operationHandler.test.ts worker/tests/manage.v2.schema.test.ts

 ✓ manage.v2.ownerMoney.test.ts (17)   ✓ manage.v2.expense.test.ts (17)
 ✓ manage.v2.routeAccess.test.ts (11)  ✓ manage.v2.operations.setup.test.ts (12)
 ✓ manage.v2.operationHandler.test.ts (8)  ✓ manage.v2.schema.test.ts (18)

 Test Files  6 passed (6)   Tests  83 passed (83) — exit 0
```

## §4 ملاحظة بيئة knip (للصدق الكامل)

تشغيل `knip` بالوضع الافتراضي (النقل الخام) ينهار بـ`RangeError: Array buffer allocation failed` داخل `oxc-parser@0.156.0` على بيئة التنفيذ (ذاكرة 4GB). أُثبت استقلال الانهيار عن كود المهمة: نفس الانهيار على شجرة `fbd55d73` البِكر عبر worktree تشخيصي (أُزيل بعد الفحص). المتغير `KNIP_DISABLE_RAW_TRANSFER=1` هو مخرج knip الرسمي المخصص لهذه الحالة، وهو النمط الموثق نفسه المستخدم في بوابة الموجة E (انظر جدولها) — لا تغيير في نطاق knip ولا في عتباته.
