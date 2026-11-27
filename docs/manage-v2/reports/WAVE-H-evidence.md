# أدلة الموجة H الخام — التحصيل والدفع والشطب والتصحيح والإلغاء (M2.8 + M2.9 + M2.10)

> السجلات الكاملة في `verify-logs/` (خارج المستودع). أدلة كل مهمة بتفصيلها: `M2.8-evidence.md` و`M2.9-evidence.md` و`M2.10-evidence.md`.

## §1 بوابة الموجة H على الشجرة النهائية (شجرة التزام M2.10)

```
$ corepack pnpm guards
 → file-size-ratchet: PASS — 684 ملفًا مشمولًا (الأساس 516؛ انكماش 31؛ محذوف 14؛ إرساءات موثقة 194)
   … 22 حارسًا PASS / صفر FAIL — exit 0

$ corepack pnpm typecheck                      → نظيف — exit 0
$ (cd apps/prototype-web && npx tsc --noEmit)  → نظيف — exit 0

$ corepack pnpm test
 Test Files  91 passed (91)
      Tests  1271 passed (1271) — exit 0

$ corepack pnpm lint            → 0 errors / 35 warnings (= الأساس) — exit 0
$ corepack pnpm format:check    → All matched files use Prettier code style! — exit 0

$ KNIP_DISABLE_RAW_TRANSFER=1 corepack pnpm knip → صفر مخرجات في النطاق — exit 0
```

## §2 الحزمة الكاملة (prototype)

```
$ corepack pnpm --filter @micro/prototype-web test

 Test Files  487 passed (487)
      Tests  3906 passed (3906) — exit 0
```

(487 = 486 بعد M2.9 + ملف `manage.v2.correct.test.ts`؛ 3906 = 3896 + 10.)

## §3 التركيز النهائي لعمليات الموجة (بلا انحدار عبر المهام الثلاث والتسع السابقة)

```
$ corepack pnpm --filter @micro/prototype-web test -- \
    worker/tests/manage.v2.correct.test.ts worker/tests/manage.v2.writeOff.test.ts \
    worker/tests/manage.v2.collectPay.test.ts worker/tests/manage.v2.ownerMoney.test.ts \
    worker/tests/manage.v2.expense.test.ts worker/tests/manage.v2.routeAccess.test.ts \
    worker/tests/manage.v2.operations.setup.test.ts worker/tests/manage.v2.operationHandler.test.ts \
    worker/tests/manage.v2.schema.test.ts

 Test Files  9 passed (9)   Tests  120 passed (120) — exit 0
```

## §4 إرساء راتشة حجم الملفات (أمر الحارس نفسه)

```
$ node scripts/check-file-size-ratchet.mjs
 (قبل الإرساء) file-size-ratchet: FAIL — 2 نمو/انجرافًا غير مصرح فوق الأساس:
   [new-file-enters-band] apps/prototype-web/worker/api/manageV2.ts: WATCH (409 nbLOC)
   [new-file-enters-band] apps/prototype-web/worker/application/manage/operationHandler.ts: WATCH (426 nbLOC)

 (بعد الإرساء الموثق بنمط s10 — سجل provenance مؤرخ + القياسان في الأساس)
 file-size-ratchet: PASS — 684 ملفًا مشمولًا (…؛ إرساءات موثقة 194)؛ صفر نمو غير مبرر — exit 0
```

الإرساء بتصريح البند 10 من أمر المرحلة 2 (تحديث سجل/أساس الحارس الذي أطلقه كود المهمة المشروع في نفس الالتزام)؛ ocRef الحاكم ARCH-007 على نمط مدخلات M1.9a/M1.10 السابقة.
