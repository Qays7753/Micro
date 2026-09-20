# نتائج الاختبارات — الحزمة (ب) G-004/G-005

**التاريخ:** 2026-09-20 · **الفرع:** `fix/pre-pilot-safety-b` · **HEAD (كود):** `902802e9aea3cffab92d96638cbb217ff87876a8` · **القاعدة (المكدسة):** `b44edcd` (رأس PR #190) · **خط الأساس:** `3702c9013…` (CI SUCCESS)

## الأوامر المركزية (نتائج حرفية)

```
$ pnpm check
→ EXIT 0 — كامل المسار: operations-control tests + validator + typecheck + lint + format:check
  + text-density + design-guards + guards + test + prototype:check + prototype:test + build
  + bundle-budget: PASS (raw=609036 / gzip=144484 ≤ 650000/155000)

$ pnpm test
  Test Files  36 passed (36)
       Tests  404 passed (404)

$ pnpm prototype:test
  Test Files  232 passed (232)
       Tests  1638 passed (1638)

$ pnpm typecheck && pnpm --filter @micro/prototype-web exec tsc --noEmit
→ 0 errors

$ node scripts/check-secrets.mjs
→ check-secrets: PASS — 1587 files scanned, 0 secret patterns

$ node scripts/check-test-focus.mjs (ضمن guards)
→ PASS — 268 test files, 0 .only/.skip occurrences

$ python3 scripts/operations-control/validate.py
→ Operations Control valid (بعد تحديث G-004/G-005 إلى IN_REVIEW وWS-163 إلى IN_REVIEW)

$ git diff --check
→ نظيف
```

## الاختبارات الجديدة (27) — كلها ناجحة

| الملف | الاختبارات |
|---|---|
| `client/src/G004CapabilityGuard.dom.test.tsx` | 7 |
| `client/src/G004CapabilityDeepLinks.dom.test.tsx` | 5 |
| `client/src/G005FinanceReadIsolation.dom.test.tsx` | 13 |
| `client/src/application/transfers/localTransferService.capabilitiesRoundTrip.test.ts` | 2 |

ملاحظة حسابية: رسالة الالتزام `902802e` ذكرت «+25» — العدد المعتمد الصحيح **27** (7+5+13+2) كما في الجدول ومتن PR #191.

## الاختبارات القائمة ذات الصلة (انحدار) — كلها ناجحة ضمن pnpm check

`Set003Capabilities.dom.test.tsx` (4) · `Set003SettingsSection.dom.test.tsx` (1) · `FinanceEmptyTruth.dom.test.tsx` (2) · `StateRecovery.w44.dom.test.tsx` (6) · `U06.dom.test.tsx` (7) · `Accessibility.w44.dom.test.tsx` (7) · `ArabicRtlContent.w44.dom.test.tsx` (6) · `G3.dom.test.tsx` (12) · `G3Delivery.dom.test.tsx` (3) · `G3Hardening.dom.test.tsx` (6) · `G4RetainedDeposit.dom.test.tsx` (5) · `G6.dom.test.tsx` (7) · `OrdJourneys.dom.test.tsx` (9) · `group2InventorySurfaces.test.tsx` (18) · `PurchasingBridgeExe011.dom.test.tsx` (5) · `R2.renderSmoke.test.tsx` — كلها ضمن تشغيلة 232 ملفًا/1638 اختبارًا.

## التنفيذ الحرفي لاختبارات الحزمة المركزة

```
$ pnpm --filter @micro/prototype-web exec vitest run \
    client/src/G004CapabilityGuard.dom.test.tsx \
    client/src/G004CapabilityDeepLinks.dom.test.tsx \
    client/src/G005FinanceReadIsolation.dom.test.tsx \
    client/src/application/transfers/localTransferService.capabilitiesRoundTrip.test.ts
  Test Files  4 passed (4)
       Tests  27 passed (27)
```

## ملاحظات التصنيف

- كل ما أعلاه آلي عبر jsdom وخدمات حقيقية فوق مخزن الذاكرة — **ليس إثبات متصفح حي** (QA الحي: NOT_EXECUTED، انظر تقرير التنفيذ §7).
- لا فشل مخصص كـ«موجود مسبقًا» — البوابة خضراء بالكامل بلا استثناءات.
