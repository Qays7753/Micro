# الموجة A — دليل خام (مقتطفات أوامر فعلية)

> مقتطفات مضغوطة من المخرجات الخام؛ الأوامر كاملة في تقرير الموجة `WAVE-A-report-AR.md`. كلها على شجرة `feature/manage-v2` أثناء تنفيذ الموجة A (26/11/2026).

## 0. الـpreflight (قبل أي كتابة)

```
$ git fetch origin && git branch --show-current && git log -1 --format=%H && git status --short && git ls-files --others --exclude-standard
feature/manage-v2
a5ff462ba52ccda7e0feb68fba5021fa891403f0
(شجرة نظيفة، لا untracked؛ HEAD = origin/feature/manage-v2 — 0/0)
```
المتتبّر قبل الموجة: M1.2 `TODO`، M1.3 `TODO` — لا `STATE_DRIFT`.

## 1. M1.2 — الاختبارات أولًا (فشل مقصود قبل أي كود)

```
$ corepack pnpm --filter @micro/prototype-web exec vitest run orderDetailViewModel.test.ts OrderDetail.noEstimateSource
 ❯ client/src/pages/OrderDetail.noEstimateSource.dom.test.tsx (2 tests | 2 failed)
AssertionError: expected "list" to not be called at all, but actually been called 1 times
        Number of calls: 1
AssertionError: Unable to find an element with the text: المصدر: تقدير  (انتظار النفي انتهى بمهلة)
 ❯ client/src/application/agreements/orderDetailViewModel.test.ts
AssertionError: expected [ 'deriveOrderSectionDecisions', …(4) ] to deeply equal [ …(3) ]
+   "readSourceEstimate",
 Test Files  2 failed (2)      Tests  3 failed | 6 passed (9)
```

## 2. M1.2 — بعد التنفيذ

```
$ corepack pnpm --filter @micro/prototype-web exec vitest run orderDetailViewModel.test.ts OrderDetail.noEstimateSource
 ✓ client/src/pages/OrderDetail.noEstimateSource.dom.test.tsx (2 tests)
 ✓ client/src/application/agreements/orderDetailViewModel.test.ts (7 tests)
 Test Files  2 passed (2)      Tests  9 passed (9)

$ corepack pnpm --filter @micro/prototype-web exec vitest run G3.dom.test.tsx orderDetailViewModel.test.ts OrderDetail.noEstimateLink
 Test Files  3 passed (3)      Tests  22 passed (22)

$ corepack pnpm --filter @micro/prototype-web test
 Test Files  475 passed (475)      Tests  3782 passed (3782)

$ corepack pnpm typecheck && corepack pnpm --filter @micro/prototype-web exec tsc --noEmit
 (نظيف — exit 0 لكل منهما)

$ corepack pnpm lint
 ✖ 35 problems (0 errors, 35 warnings)   ← = الأساس بالضبط

$ rg -n "readSourceEstimate" apps/prototype-web/client/src → لا نتائج (قبول النص الحرفي)
```

## 3. M1.3 — الاختبارات أولًا (فشل مقصود قبل أي كود)

```
$ corepack pnpm --filter @micro/prototype-web exec vitest run AskMicro.noFinancialDraft
 FAIL  client/src/AskMicro.noFinancialDraft.dom.test.tsx
AssertionError: expected <div class="micro-ask-draft" …(1)>…(9)</div> to be null
 FAIL  client/src/AskMicro.noFinancialDraft.scan.test.ts
AssertionError: expected [ …(5) ] to deeply equal []
+   ".../components/ask/AskDraftCard.tsx: AskDraftCard"
+   ".../components/ask/AskDraftCard.tsx: constructFinancialEventRecord"
+   ".../components/ask/AskDraftCard.tsx: financialEvents"
+   ".../components/ask/AskDraftCard.tsx: saveManageRecord"
+   "client/src/pages/AskMicro.tsx: AskDraftCard"
 Test Files  2 failed (2)      Tests  2 failed (2)
```

## 4. M1.3 — بعد التنفيذ

```
$ corepack pnpm --filter @micro/prototype-web exec vitest run AskMicro.dom.test.tsx AskMicro.governance AskMicro.noFinancialDraft
 Test Files  4 passed (4)      Tests  13 passed (13)

$ corepack pnpm --filter @micro/prototype-web test
 Test Files  477 passed (477)      Tests  3781 passed (3781)

$ rg -n "AskDraftCard|constructFinancialEventRecord" apps/prototype-web/client/src/pages/AskMicro.tsx apps/prototype-web/client/src/components/ask
 → لا نتائج (المجلد محذوف أصلًا)

$ git diff --stat dbc0462c^..dbc0462c -- apps/prototype-web/client/src/application/ask/
 → فارغ (صفر أسطر — الدليل الحرفي على عدم المسّ)
```

## 5. مصالحة أدلة الحراس (الحالة الحمراء التي خلّفتها الموجة ثم الخضراء)

الحالة الحمراء قبل المصالحة (على الجذر):

```
$ corepack pnpm test
 Test Files  3 failed | 83 passed (86)      Tests  5 failed | 1026 passed (1031)
 × check-module-boundaries: census (R9-stale-edge ×2 — حافتا orderDetailViewModel→draftService/costEstimateService)
 × generate-test-map: committed evidence JSON matches the live tree
 × text-density golden: byte-identical to the golden fixture

$ node scripts/check-module-boundaries.mjs
module-boundaries: FAIL — 2 خرقًا جديدًا فوق الأساس المقبول:
  [R9-stale-edge] application/agreements/orderDetailViewModel.ts -> application/drafts/draftService.ts
  [R9-stale-edge] application/agreements/orderDetailViewModel.ts -> application/estimates/costEstimateService.ts
```

بعد المصالحة الموثقة (إزالة الصفين + إعادة اشتقاق الأغلف + دبوس الاختبار + المولّد + الذهبي):

```
$ node scripts/check-module-boundaries.mjs
module-boundaries: PASS — … 124 حافة أزواج بيوت تطبيق منها 84 قيمة و40 نوعًا … صفر زيادة صامتة

$ node scripts/check-diagnostics-storage.mjs
diagnostics-storage: PASS — 436 ملف إنتاج زُرع؛ صفر وصول غير مسجل…

$ corepack pnpm test
 Test Files  86 passed (86)      Tests  1031 passed (1031)
```

## 6. بوابة الموجة (على الشجرة المكتملة 66745a89)

```
$ corepack pnpm guards
 (exit 0؛ ٢٠ سطر PASS؛ صفر FAIL — منها:)
check-lint-warning-baseline: PASS — 35 تحذيرًا بالضبط … = الأساس المعتمد
registry-coverage: PASS — 41 بيت تطبيق و20 منطقة مجال كلها مذكورة في سجل الملكية
file-size-ratchet: PASS — 644 ملفًا مشمولًا (الأساس 514؛ انكماش 31؛ محذوف 14؛ إرساءات موثقة 193)؛ صفر نمو غير مبرر
module-boundaries: PASS — 124 حافة … 84 قيمة و40 نوعًا

$ corepack pnpm test
 Test Files  86 passed (86)      Tests  1031 passed (1031)      (exit 0)

$ corepack pnpm typecheck
 > tsc --noEmit        (exit 0 — نظيف)

تشديد إضافي:
$ corepack pnpm --filter @micro/prototype-web test
 Test Files  477 passed (477)      Tests  3781 passed (3781)      (exit 0)
$ corepack pnpm --filter @micro/prototype-web exec tsc --noEmit
 (exit 0 — نظيف)
$ corepack pnpm lint
 ✖ 35 problems (0 errors, 35 warnings)
```

## 7. سجل الالتزامات (موجة A كاملة)

```
66745a89 WAVE-A gate-fix — reconcile the guard evidence the wave's authorized changes moved (M1.2+M1.3)
dbc0462c M1.3 scope-boundary/S3 — remove the financial draft from Ask Micro
aeca7042 M1.2 — record task commit SHA in tracker (docs only)
bed01d5e M1.2 §14.3 — cut estimate→order cost link: remove readSourceEstimate + source-estimate UI (S2)

--- bed01d5e ---  6 files changed, 227 insertions(+), 72 deletions(-)
--- aeca7042 ---  1 file changed, 2 insertions(+), 2 deletions(-)
--- dbc0462c ---  8 files changed, 249 insertions(+), 814 deletions(-)
--- 66745a89 ---  6 files changed, 35 insertions(+), 66 deletions(-)
```

ملاحظة أمانة تقنية (١): التزام M1.3 عُدِّل محليًا مرة واحدة **قبل أي دفع** (unpushed) لضم حذف الملف الذي فكّه `git stash pop` من الفهرس إلى التزام مهمته — لا force-push ولا إعادة كتابة لأي تاريخ منشور.
ملاحظة أمانة تقنية (٢): قبل الدفعة الوحيدة للموجة تقدّم الرأس البعيد بستة التزامات توثيقية للمالك (`a5ff462b` ← `eba0ef7f`)؛ أُعيد ترتيب التزامات الموجة غير المدفوعة فوقها بـrebase نظيف بلا تعارض — لا merge ولا force-push؛ التاريخ المدفوع خطي، ثم جُدِّدت مراجع الـSHA في المتتبّر والتقرير في الالتزام الختامي:

```
$ git rebase origin/feature/manage-v2
Successfully rebased and updated refs/heads/feature/manage-v2.
$ git push origin feature/manage-v2   (fast-forward — بلا قوة)
```
