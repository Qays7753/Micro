# Micro Manage v2 — أدلة الموجة C (M1.7 → M1.8 → M1.9 + M1.9a)

> مخرجات الأوامر الحرفية كما نُفِّذت على الشجرة الحية، بترتيب التنفيذ.
> SHA الابتداء: `80b44d8f8c00bda5aa9bba1762fe0389c6e6dad8` (رأس البعيد وقت الأمر).
> SHAs المهام: M1.7 `7e5c1b43`، M1.8 `c8293a01`، M1.9 `8d86584a`.

## §0 — الـpreflight (قبل أي كتابة)

```
$ git fetch origin --prune && git reset --hard origin/feature/manage-v2
HEAD is now at 80b44d8f docs(manage-v2): authorize wave C (M1.7, M1.8, M1.9) in phase 1 prompt
$ git status --short        → (فارغ — شجرة نظيفة)
$ git ls-files --others --exclude-standard → (فارغ — لا untracked)
$ git log --oneline -3 origin/feature/manage-v2
80b44d8f docs(manage-v2): authorize wave C (M1.7, M1.8, M1.9) in phase 1 prompt
4f8c9d69 docs(manage-v2): wave B review completed (ACCEPTED)
fddb787b WAVE-B — pin M1.6 task SHA in tracker + wave B report (AR) + raw evidence
```

- المتتبّع قبل الموجة: M1.7/M1.8/M1.9 كلها ZAI `TODO` ومانوس `PENDING` — أول مهمة غير `DONE` هي M1.7. لا `STATE_DRIFT`.
- جدول الموجات: الصف C «authorized now» والمهام المطلوبة (M1.7 → M1.8 → M1.9) مطابقة لأقسام أمر التنفيذ.

## §1 — الاختبارات أولًا: الفشل المقصود قبل أي كود

**M1.7** — على شجرة `80b44d8f` (الموديول غير موجود):

```
$ corepack pnpm vitest run tests/manage/money.test.ts
Error: Failed to resolve import "../../src/domain/manage/index.js" from "tests/manage/money.test.ts"
  18| import {
     | ^
 Test Files  1 failed (1)
      Tests  no tests
FAIL  tests/manage/money.test.ts (1)
EXIT 1
```

**M1.8** — الحارس والكتالوج غير موجودين:

```
$ corepack pnpm vitest run scripts/check-manage-literal-text.test.mjs
Error: Failed to resolve import "./check-manage-literal-text.mjs" from "scripts/check-manage-literal-text.test.mjs"
 Test Files  1 failed (1) | Tests  no tests | EXIT 1

$ cd apps/prototype-web && corepack pnpm exec vitest run stringsCatalog
Error: Failed to resolve import "./index" from "client/src/application/manage/strings/stringsCatalog.test.ts"
 Test Files  1 failed (1) | Tests  no tests | EXIT 1
```

**M1.9** — الحارس غير موجود:

```
$ corepack pnpm vitest run scripts/check-deleted-imports.test.mjs
Error: Failed to resolve import "./check-deleted-imports.mjs" from "scripts/check-deleted-imports.test.mjs"
 Test Files  1 failed (1) | Tests  no tests | EXIT 1
```

## §2 — الفشل الموثَّق لحارس سجل الملكية بعد إنشاء منطقة المجال (M1.7)

```
$ node scripts/check-registry-coverage.mjs
registry-coverage: FAIL — 1 وحدة بلا صف في docs/architecture/refactoring/OWNERSHIP-AND-TRUTH-REGISTRY.md:
  [domain-area] manage/
    منطقة مجال بلا ذكر في سجل الملكية §1 — أضف صف الملكية قبل أي عمل في المنطقة
EXIT 1
```

(بعد M1.8 يصبح الفشل وحدتين: `[application-home] manage/` + `[domain-area] manage/` — انظر §6.)

## §3 — M1.7 بعد التنفيذ (على شجرة الالتزام `7e5c1b43`)

```
$ corepack pnpm vitest run tests/manage/money.test.ts
 Test Files  1 passed (1)
      Tests  84 passed (84)
EXIT 0

$ node scripts/check-module-boundaries.mjs
module-boundaries: PASS — 467 ملف إنتاج؛ … 0 حافة عميل→مانج و0 حافة أجنبية من مجال مانج
(صفر مسموح — R10/R11 جاهزتان قبل كود مانج، M1.6/§14.3/D-5)؛ صفر زيادة صامتة …
EXIT 0

$ corepack pnpm typecheck → EXIT 0
$ corepack pnpm lint → ✖ 35 problems (0 errors, 35 warnings) → EXIT 0 (= الأساس بالضبط)
$ node scripts/check-file-size-ratchet.mjs → EXIT 0
$ node scripts/check-money-minor-casts.mjs → EXIT 0
$ node scripts/check-date-arithmetic-ownership.mjs → EXIT 0
$ node scripts/check-test-focus.mjs → EXIT 0
$ node scripts/check-type-cycles.mjs → EXIT 0

$ corepack pnpm test
 Test Files  1 failed | 86 passed (87)
      Tests  1 failed | 1123 passed (1124)
 FAIL  scripts/check-registry-coverage.test.mjs > … > live repo smoke: every live home and area is mentioned (exit 0)
(الفشل الوحيد هو الفحص الدخاني لحارس سجل الملكية نفسه — §2 أعلاه؛ لا علاقة له بقبول M1.7)
```

## §4 — M1.8 بعد التنفيذ (على شجرة الالتزام `c8293a01`)

```
$ corepack pnpm vitest run scripts/check-manage-literal-text.test.mjs
 Test Files  1 passed (1) | Tests  7 passed (7) | EXIT 0

$ cd apps/prototype-web && corepack pnpm exec vitest run stringsCatalog
 Test Files  1 passed (1) | Tests  5 passed (5) | EXIT 0

$ node scripts/check-manage-literal-text.mjs
manage-literal-text: PASS — 3 ملف سطح مانج مفحوصًا؛ 0 حرفية عربية
(المسموح: الكتالوج strings/ar.ts وحده — موجود ومستثنى؛ M1.8/§10-§11/§14.2/D-7)
EXIT 0

$ pnpm --filter @micro/prototype-web check → tsc --noEmit && tsc --noEmit -p tsconfig.node.json → EXIT 0
$ node apps/prototype-web/scripts/check-test-typecheck-coverage.mjs
check-test-typecheck-coverage: PASS — 443 test files inside the app typecheck program (NF-020 part 2)
$ corepack pnpm typecheck → EXIT 0
$ corepack pnpm lint → ✖ 35 problems (0 errors, 35 warnings) → EXIT 0
$ node scripts/check-module-boundaries.mjs → EXIT 0
```

## §5 — M1.9 بعد التنفيذ (على شجرة الالتزام `8d86584a`)

```
$ corepack pnpm vitest run scripts/check-deleted-imports.test.mjs
 Test Files  1 passed (1) | Tests  8 passed (8) | EXIT 0

$ node scripts/check-deleted-imports.mjs
deleted-imports: PASS — 22 صفًا في الجرد (21 planned / 1 deleted)؛
3171 استيرادًا مفحوصًا في 567 ملف إنتاج؛ صفر استيراد لمسار محذوف وصفر إحياء (M1.9/D-10)
EXIT 0

$ corepack pnpm lint → ✖ 35 problems (0 errors, 35 warnings) → EXIT 0
$ corepack pnpm typecheck → EXIT 0
$ node scripts/check-file-size-ratchet.mjs → EXIT 0
$ node scripts/check-doc-index-coverage.mjs → EXIT 0
```

## §6 — بوابة الموجة على رأس الموجة النهائي `8d86584a`

### 6.1 — `corepack pnpm guards` → **exit 1 (أحمر)**

السلسلة تمرّ خضراء حتى `registry-coverage` حيث تتوقف (كل الحراس قبلها PASS:
secrets، test-focus، entity-touchpoints، runtime-cycles، doc-index-coverage،
current-state-size، agent-document-contract، skill-references، image-policy،
module-boundaries، lint-warning-baseline «35 تحذيرًا بالضبط»، type-cycles):

```
registry-coverage: FAIL — 2 وحدة بلا صف في docs/architecture/refactoring/OWNERSHIP-AND-TRUTH-REGISTRY.md:
  [application-home] manage/
    بيت تطبيق بلا ذكر في سجل الملكية — أضف صفه في §3م (أو §3 للبيوت المالية) وحدّث خريطة G2
  [domain-area] manage/
    منطقة مجال بلا ذكر في سجل الملكية §1 — أضف صف الملكية قبل أي عمل في المنطقة
 ELIFECYCLE  Command failed with exit code 1.
```

وبتشغيل بقية الحراس فرادى بعد نقطة التوقف (المستخرجة من السلسلة نفسها):

```
check-acceptance-value-anchors:  exit 0     check-storage-listener-guards:  exit 0
check-file-size-ratchet:          exit 0     check-money-minor-casts:         exit 0
check-vendored-braces:            exit 0     check-application-ambient-time:  exit 0
check-date-arithmetic-ownership:  exit 0     check-diagnostics-storage:       exit 0
check-a11y-dialog-surfaces:       exit 0     check-manage-literal-text:       exit 0  (جديد الموجة)
check-test-typecheck-coverage:    exit 0     check-deleted-imports:           exit 0  (جديد الموجة)

check-application-door-surfaces:  exit 1 — application-door-surfaces: FAIL — 1 خرقًا:
  [door-unregistered] manage/strings

check-application-readwrite:      exit 1 — application-readwrite: FAIL — 3 خرقًا:
  [read-like-corpus-growth] manage/strings/ar.ts
  [read-like-corpus-growth] manage/strings/index.ts
  [read-like-corpus-growth] manage/strings/keys.ts

check-label-vocabulary:           exit 1 — label-vocabulary: FAIL — 5 خرقًا:
  [unclassified-domain-label-literal] application/manage/strings/ar.ts:30 — «الكمية» == domain quantity (string-literal)
  [unclassified-domain-label-literal] application/manage/strings/ar.ts:34 — «اسم العميل» == domain customerName (string-literal)
  [unclassified-domain-label-literal] application/manage/strings/ar.ts:43 — «المبلغ» == domain amountMinor (string-literal)
  [unclassified-domain-label-literal] application/manage/strings/ar.ts:53 — «اسم المورد» == domain supplierName (string-literal)
  [unclassified-domain-label-literal] application/manage/strings/ar.ts:251 — «الاسم» == domain name (string-literal)
```

### 6.2 — `corepack pnpm test` → **exit 1**

```
 Test Files  5 failed | 84 passed (89)
      Tests  8 failed | 1131 passed (1139)
```

الاختبارات الثمانية الفاشلة كلها فحوص دخانية حية للحراس الأربعة أعلاه +
دبوس عدد واحد:

```
FAIL scripts/check-registry-coverage.test.mjs > live repo smoke: every live home and area is mentioned (exit 0)
FAIL scripts/check-application-door-surfaces.test.mjs > live repo: all 34 doors + the root file match the registered baseline
FAIL scripts/check-application-door-surfaces.test.mjs > CLI exits 0 on the live repo and 2 on a non-repo path
FAIL scripts/check-application-readwrite.test.mjs > live repo: all 18 registered readers are write-free (zero violations)
FAIL scripts/check-application-readwrite.test.mjs > CLI exits 0 on the live repo and 2 on a non-repo path
FAIL scripts/check-application-readwrite.test.mjs > read-like corpus membership + property > the live repository passes at the baseline: 80 corpus files, zero violations
FAIL scripts/check-label-vocabulary.test.mjs > passes on the live repository tree with the classified pinned set
FAIL scripts/check-diagnostics-storage.test.mjs > passes on the live repository tree with exactly the one registered entry
   (الحارس نفسه PASS؛ الاختبار يدبّس عدد ملفات الإنتاج في رسالته: متوقَّع 436، الفعلي 439 — نمو ملفات strings الثلاثة)
```

ملاحظة العدّ: قبل الموجة ٨٦ ملفًا / ١٠٤٠ اختبارًا (الموجة B)؛ بعدها ٨٩ ملفًا /
١١٣٩ اختبارًا — الزيادة +٩٩ حصرًا (٨٤ M1.7 + ٧ M1.8 + ٨ M1.9) و+٣ ملفات،
وصفر تعديل على أي اختبار قائم خارج فحوص الحراس الدخانية أعلاه.

### 6.3 — `corepack pnpm typecheck` → **exit 0 (أخضر)**

```
> micro@0.1.0 typecheck
> tsc --noEmit
(بلا أي خرج)
EXIT 0
```

### 6.4 — تشديد إضافي (فوق بوابة الموجة)

```
$ corepack pnpm lint → ✖ 35 problems (0 errors, 35 warnings) — الأساس بالضبط (D-05)
$ pnpm --filter @micro/prototype-web check → EXIT 0 (برنامجا التطبيق النوعيان)
```

## §7 — لماذا لم تُصلح الحراس الأربعة داخل الموجة (قرار `BLOCKED`)

ملفات إصلاح كل حارس خارج «الملفات المسموحة» لكل مهمة نفَّذت التغيير المُوقع:

| الحارس | الخرق | ملف الإصلاح | مهمةُ من أسّس الخرق | ملف الإصلاح مسموح فيها؟ |
|---|---|---|---|---|
| registry-coverage | `[domain-area] manage/` | `docs/architecture/refactoring/OWNERSHIP-AND-TRUTH-REGISTRY.md` | M1.7 | لا (المسموح: `src/domain/manage/**`، `tests/manage/**`) |
| registry-coverage | `[application-home] manage/` | السجل نفسه | M1.8 | لا (المسموح: `client/src/application/manage/**` + الحارس الجديد + package.json guards) |
| application-door-surfaces | `[door-unregistered] manage/strings` | `scripts/application-door-surfaces-baseline.json` | M1.8 | لا |
| application-readwrite | `read-like-corpus-growth ×3` | قائمة الجسم المسجلة داخل `scripts/check-application-readwrite.mjs` | M1.8 | لا |
| label-vocabulary | `unclassified ×5` (قيم المواصفة الحرفية) | `PINNED_LABEL_LITERALS` داخل `scripts/check-label-vocabulary.mjs` | M1.8 | لا |
| (اختبار) check-diagnostics-storage.test.mjs | دبوس العدد 436→439 | نص الاختبار نفسه | M1.8 | لا |

سابقة الحكم نفسها: M1.1 (استخراج نواة التكلفة) أسّس منطقة مجال جديدة بلا صف
سجل فبقيت الشجرة حمراء حتى أذن المالك بمهمة التصحيح M1.1a. جدول الموجات
الحالي يضع تحديث هذه الحراس للـManage في **M1.10 (الموجة D)** —
«scripts/check-registry-coverage.mjs + OWNERSHIP-AND-TRUTH-REGISTRY.md for
the new Manage paths» — لكنه لا يذكر door-surfaces ولا label-vocabulary ولا
readwrite ولا دبوس عدد diagnostics، فالدقة المطلوبة من المالك موثَّقة في
تقرير الموجة.


---

# ملحق التشغيل الثاني — M1.9a (تصحيح إرساء الحراس، 26/11/2026)

## §8 — الـpreflight والحالة الحمراء قبل أي تعديل (على `3d4eeaf3`)

```
$ git fetch origin && git rebase FETCH_HEAD
Successfully rebased and updated refs/heads/feature/manage-v2.
$ git log -1 --format=%H
3d4eeaf3f314664845fafcd7adc821aadaeaf970
$ git status --short   (فارغ — شجرة نظيفة، لا untracked)
```

المتتبّع: M1.7/M1.8/M1.9 كلها `DONE` وM1.9a `TODO` (أول غير منجز في الموجة) — لا `STATE_DRIFT`.

تشغيل `corepack pnpm guards` توقّف عند الحارس الثالث عشر (registry-coverage):

```
registry-coverage: FAIL — 2 وحدة بلا صف في docs/architecture/refactoring/OWNERSHIP-AND-TRUTH-REGISTRY.md:
  [application-home] manage/
    بيت تطبيق بلا ذكر في سجل الملكية — أضف صفه في §3م (أو §3 للبيوت المالية) وحدّث خريطة G2
  [domain-area] manage/
    منطقة مجال بلا ذكر في سجل الملكية §1 — أضف صف الملكية قبل أي عمل في المنطقة
 ELIFECYCLE  Command failed with exit code 1
```

والحراس الثلاثة الباقية المعنية بالمهمة (بعد الواقف في السلسلة) فرديًا:

```
$ node scripts/check-application-door-surfaces.mjs
application-door-surfaces: FAIL — 1 خرقًا:
  [door-unregistered] manage/strings

$ node scripts/check-application-readwrite.mjs
application-readwrite: FAIL — 3 خرقًا:
  [read-like-corpus-growth] manage/strings/ar.ts
  [read-like-corpus-growth] manage/strings/index.ts
  [read-like-corpus-growth] manage/strings/keys.ts

$ node scripts/check-label-vocabulary.mjs
label-vocabulary: FAIL — 5 خرقًا:
  [unclassified-domain-label-literal] application/manage/strings/ar.ts:30 — «الكمية» == domain quantity (string-literal)
  [unclassified-domain-label-literal] application/manage/strings/ar.ts:34 — «اسم العميل» == domain customerName (string-literal)
  [unclassified-domain-label-literal] application/manage/strings/ar.ts:43 — «المبلغ» == domain amountMinor (string-literal)
  [unclassified-domain-label-literal] application/manage/strings/ar.ts:53 — «اسم المورد» == domain supplierName (string-literal)
  [unclassified-domain-label-literal] application/manage/strings/ar.ts:251 — «الاسم» == domain name (string-literal)
```

## §9 — الحراس الأربعة بعد التصحيحات (شجرة التزام المهمة `589ff370`)

```
$ node scripts/check-registry-coverage.mjs
registry-coverage: PASS — 42 بيت تطبيق و21 منطقة مجال كلها مذكورة في سجل الملكية (Wave H/STR-617 بند 5)

$ node scripts/check-application-door-surfaces.mjs
application-door-surfaces: PASS — 35 بابًا (أي عمق) + 1 ملف جذر إنتاجيًا؛ الأسطح (قيمًا وأنواعًا) مطابقة للأساس المسجل؛ صفر توسيع/انكماش/برميل غير مرئي صامت (R5/S2 — PC-3/R0-N20)

$ node scripts/check-application-readwrite.mjs
application-readwrite: PASS — 18 ملف قارئ مسجلًا + 10 موسوم PC-4؛ صفر استدعاءات كتابة (save/commit/delete/replace/clear بأول حرف كبير)؛ القارئ لا يكتب حتميًا في حدود المفردات الموثقة (R5/S3 — F-08)؛ جسم القراءة خارج العائلات الخمس 83/83 ملفًا (راتشة عضوية+خاصية D-04 — R10A-F-019/OD-GUARD)

$ node scripts/check-label-vocabulary.mjs
label-vocabulary: PASS — 45 تسمية دومين كنونية؛ 439 ملف إنتاج زُرع؛ 39 مدخلًا مثبتًا مصنفًا يغطي 45 موضعًا حيًّا (owner-gated/variant — راتشة OD-LABEL: التكرار الجديد يُرفض حتى يُصنف)؛ مستهلك طبقة التطبيق الوحيد المحايد (agreementPresentation) يستهلك fieldLabelAr من الدومين

$ node scripts/generate-test-map.mjs && node scripts/generate-test-map.mjs
generate-test-map: wrote docs/architecture/refactoring/generated/test-map.json (pages 76, contracts 49)   [مرتين — لا انجراف بعد الثانية]
```

## §10 — اختبارات الحراس الأربعة المحدَّثة (على شجرة `589ff370`)

```
$ corepack pnpm vitest run scripts/check-application-door-surfaces.test.mjs scripts/check-application-readwrite.test.mjs scripts/check-registry-coverage.test.mjs scripts/check-label-vocabulary.test.mjs

 ✓ scripts/check-label-vocabulary.test.mjs (9 tests) 2519ms
 ✓ scripts/check-application-readwrite.test.mjs (16 tests) 1070ms
 ✓ scripts/check-application-door-surfaces.test.mjs (14 tests) 631ms
 ✓ scripts/check-registry-coverage.test.mjs (4 tests) 284ms

 Test Files  4 passed (4)
      Tests  43 passed (43)
```

## §11 — بوابة الموجة على رأس مهمة M1.9a `589ff370`

`corepack pnpm guards` → exit 1 — ١٤ حارسًا أخضر ثم الفشل الوحيد:

```
file-size-ratchet: تدقيق الانجراف مقابل origin/main @ 5a9064e657a40041ebe63c8f107d57a802f6b93f
file-size-ratchet: FAIL — 2 نمو/انجرافًا غير مصرح فوق الأساس:
  [within-band-growth] scripts/application-door-surfaces-baseline.json: 617 -> 628 nbLOC (WATCH -> WATCH)
    نمو غير مبرر داخل الشريط — قلّل المسؤولية أو أرسِ القيمة الجديدة بسجل إرساء موثق (ledger) بمرجع مراجعة مالك في نفس الـPR؛ لا تحرر الأساس بصمت
  [within-band-growth] scripts/check-application-readwrite.mjs: 370 -> 382 nbLOC (NORMAL -> NORMAL)
    نمو غير مبرر داخل الشريط — قلّل المسؤولية أو أرسِ القيمة الجديدة بسجل إرساء موثق (ledger) بمرجع مراجعة مالك في نفس الـPR؛ لا تحرر الأساس بصمت
 ELIFECYCLE  Command failed with exit code 1.
```

(السلسلة تتوقف عند أول فشل؛ الحراس الاثنا عشر بعده تحقّقت فرديًا كلها PASS: vendored-braces، date-arithmetic-ownership، application-door-surfaces، application-readwrite، storage-listener-guards، test-typecheck-coverage، money-minor-casts، application-ambient-time، diagnostics-storage، label-vocabulary، a11y-dialog-surfaces، manage-literal-text، deleted-imports.)

`corepack pnpm test` → exit 1 — ٢ فشلين فقط:

```
 FAIL  scripts/check-diagnostics-storage.test.mjs > ... > passes on the live repository tree with exactly the one registered entry
AssertionError: expected 'diagnostics-storage: PASS — 439 ملف إ…' to match /436 ملف إنتاج/

 FAIL  scripts/check-file-size-ratchet.test.mjs > CLI on the live repo (smoke) > exits 0 with a summary line and the migration/drift note on the live tree

 Test Files  2 failed | 87 passed (89)
      Tests  2 failed | 1137 passed (1139)
```

`corepack pnpm typecheck` → exit 0 نظيف (لا خرج).

## §12 — بنود الإغلاق الأخضر المتبقية (خارج ملفات M1.9a المسموحة)

| البند | الملف المطلوب | التغيير المطلوب | لماذا خارج النطاق |
|---|---|---|---|
| إرساء راتشة ١ | `scripts/file-size-ratchet-reanchors.json` | مدخل: أساس الأبواب 617→628 (WATCH) بسلسلة صحيحة + ocRef حاكم | الملف خارج قائمة M1.9a المسموحة؛ ولا يوجد سجل Operations Control لمانج-في٢ ليُشار إليه |
| إرساء راتشة ٢ | `scripts/file-size-ratchet-reanchors.json` | مدخل: حارس القراءة 370→382 (NORMAL) كذلك | مثل أعلاه |
| دبوس عدد | `scripts/check-diagnostics-storage.test.mjs` | `/436 ملف إنتاج/` → `/439 ملف إنتاج/` + تعليق مؤرخ | الملف خارج قائمة M1.9a المسموحة (كان في سؤال الموجة الأصلي ولم يُدرج في بنودها) |

لم يُنفَّذ أي منها — التزامًا بحدود الكتابة («never widen scope to make a gate pass»).

## §13 — استكمال M1.9a: الحالة الحمراء الموثَّقة قبل أي تعديل (على `dbabe541`)

بعد إذن المالك المحدَّث (`dbabe541` — تحديث نص المهمة بالبندين ٥ و٦)، وقبل أي تعديل، الاختباران المعنيان بالاستكمال والفشلان نفساهما المسجلان في §11:

```
$ corepack pnpm vitest run scripts/check-diagnostics-storage.test.mjs scripts/check-file-size-ratchet.test.mjs

 FAIL  scripts/check-diagnostics-storage.test.mjs > ... > passes on the live repository tree with exactly the one registered entry
AssertionError: expected 'diagnostics-storage: PASS — 439 م…' to match /436 ملف إنتاج/

 FAIL  scripts/check-file-size-ratchet.test.mjs > CLI on the live repo (smoke) > exits 0 with a summary line and the migration/drift note on the live tree
AssertionError: expected 1 to be +0 // Object.is equality

 Test Files  2 failed (2)
      Tests  2 failed | 41 passed (43)
```

```
$ node scripts/check-file-size-ratchet.mjs
file-size-ratchet: تدقيق الانجراف مقابل origin/main @ 5a9064e657a40041ebe63c8f107d57a802f6b93f
file-size-ratchet: FAIL — 2 نمو/اندرافًا غير مصرح فوق الأساس:
  [within-band-growth] scripts/application-door-surfaces-baseline.json: 617 -> 628 nbLOC (WATCH -> WATCH)
    نمو غير مبرر داخل الشريط — قلّل المسؤولية أو أرسِ القيمة الجديدة بسجل إرساء موثق (ledger) بمرجع مراجعة مالك في نفس الـPR؛ لا تحرر الأساس بصمت
  [within-band-growth] scripts/check-application-readwrite.mjs: 370 -> 382 nbLOC (NORMAL -> NORMAL)
    نمو غير مبرر داخل الشريط — قلّل المسؤولية أو أرسِ القيمة الجديدة بسجل إرساء موثق (ledger) بمرجع مراجعة مالك في نفس الـPR؛ لا تحرر الأساس بصمت
```

## §14 — الاستكمال بعد التنفيذ (على شجرة التزام الاستكمال `ed9c15cd`)

الاختباران المعنيان:

```
$ corepack pnpm vitest run scripts/check-diagnostics-storage.test.mjs scripts/check-file-size-ratchet.test.mjs

 Test Files  2 passed (2)
      Tests  43 passed (43)
      Duration  3.71s
```

الحارس فرديًا — نموّا الموجة صارا «REANCHORED (documented)» (آخر سطرين قبل سطر PASS؛ بقية سطور REANCHORED هي الإرساءات الموثقة السابقة):

```
$ node scripts/check-file-size-ratchet.mjs
file-size-ratchet: REANCHORED (documented) scripts/application-door-surfaces-baseline.json: 617 -> 628 (WATCH)
file-size-ratchet: REANCHORED (documented) scripts/check-application-readwrite.mjs: 370 -> 382 (NORMAL)
file-size-ratchet: PASS — 653 ملفًا مشمولًا (الأساس 514؛ انكماش 31؛ محذوف 14؛ إرساءات موثقة 194)؛ صفر نمو غير مبرر داخل الشريط أو عابره (R8-2/R8-F-005+F-006)؛ تراخيص الإرساء محسولة آليًا ضد شجرة OC (37 مرجعًا — F-028)
```

## §15 — بوابة الموجة النهائية على رأس استكمال M1.9a `ed9c15cd`

`corepack pnpm guards` → **exit 0** — كل سطور الحراس PASS (لا FAIL واحد):

```
check-secrets: PASS — 2404 files scanned, 0 secret patterns
check-test-focus: PASS — 538 test files (JS + Python), 0 focus/skip occurrences
check-entity-touchpoints: PASS — manifest covers every store, every declared path exists, every omission has a reason
module-boundaries: PASS — 469 ملف إنتاج؛ الأساس المقبول: 4 استيرادًا عميقًا داخل المجال، 15 حافة واجهة→مجال، 0 حافة تطبيق→عرض، 3 حافة عميقة عابرة لمناطق المجال، 2 حافة واجهة→تخزين (resolution-based)، 66 استيرادًا عميقًا واجهة→دواخل بيوت التطبيق (راتشة R6/STR-615)، 0 حافة مكوّن→صفحة (الصنف الممنوع — R8-F-019)؛ 23 حافة نوعية واجهة→تخزين (راتشة R8/D-01 على أساس 19 مفتاحًا)؛ 124 حافة أزواج بيوت تطبيق منها 84 قيمة و40 نوعًا (راتشة R9/D-07 على جرد 130/81/49 مع إعفاءات OD-10 الورقية)؛ 0 حافة عميل→مانج و0 حافة أجنبية من مجال مانج (صفر مسموح — R10/R11 جاهزتان قبل كود مانج، M1.6/§14.3/D-5)؛ صفر زيادة صامتة (ratchet — Wave 4E/RC-9 + Wave H/STR-617 + الخطوة ٦/STR-615 + R8/R8-F-019 + M1.6/R10-R11)
check-lint-warning-baseline: PASS — 35 تحذيرًا بالضبط (max-lines-per-function=18 + complexity=17) = الأساس المعتمد؛ السقف 37 باقٍ في سطر lint دون مساس (D-05/R10A-F-026 — OD-GUARD)
type-cycles: PASS — 1 دورة نوعية قائمة (كلها ضمن الأساس المقبول)؛ صفر دورة جديدة صامتة (Wave H/STR-617 بند 1)
registry-coverage: PASS — 42 بيت تطبيق و21 منطقة مجال كلها مذكورة في سجل الملكية (Wave H/STR-617 بند 5)
acceptance-value-anchors: PASS — مواقع الاستهلاك الأربعة المحروسة (agreementContextService وagreementService لمصادر الاتفاق من سجل التوافق؛ walletKinds وmaterialUnits في guided من المجال) تستهلك مصادرها الكنونية مباشرة والقوائم الكنونية بأعضائها الموثقة — رجوع أي موقع إلى نسخة حرفية (بصيغتيها) يُصاد حتميًا بالسلبيات المثبتة (Wave H/STR-623 ثم توحيد R4-B2 ثم إغلاق R4-REC-5)؛ وعائلات F-024 الست (inventoryMovementType وcatalogItemKind وscheduleStatus وyieldReadiness وshortCashDeclaration وexpenseContext) مثبتة من الجهتين: اتحاد المجال == مدققة النقل == الطاقم الموثق (R6-W2/F-024)
file-size-ratchet: PASS — 653 ملفًا مشمولًا (الأساس 514؛ انكماش 31؛ محذوف 14؛ إرساءات موثقة 194)؛ صفر نمو غير مبرر داخل الشريط أو عابره (R8-2/R8-F-005+F-006)؛ تراخيص الإرساء محسولة آليًا ضد شجرة OC (37 مرجعًا — F-028)
check-vendored-braces: PASS — 4 vendored copy/copies, exactly matching the documented baseline (documented upstream limitation — see docs/quality/vendored-braces-inventory.md; the graph-level elimination is guarded separately)
check-date-arithmetic-ownership: PASS — no Date.UTC in production; the Date object/Date.parse are kernel-file-only in the domain; no unguarded business-date slicing in any app layer (AST-bound ?? exemption, 4 approved sites); no localDateInAmman without an explicit instant; no ambient new Date() in the domain (R1–R6 clean).
application-door-surfaces: PASS — 35 بابًا (أي عمق) + 1 ملف جذر إنتاجيًا؛ الأسطح (قيمًا وأنواعًا) مطابقة للأساس المسجل؛ صفر توسيع/انكماش/برميل غير مرئي صامت (R5/S2 — PC-3/R0-N20)
application-readwrite: PASS — 18 ملف قارئ مسجلًا + 10 موسوم PC-4؛ صفر استدعاءات كتابة (save/commit/delete/replace/clear بأول حرف كبير)؛ القارئ لا يكتب حتميًا في حدود المفردات الموثقة (R5/S3 — F-08)؛ جسم القراءة خارج العائلات الخمس 83/83 ملفًا (راتشة عضوية+خاصية D-04 — R10A-F-019/OD-GUARD)
check-storage-listener-guards: PASS — 105 onsuccess listeners across 5 storage boundary files, all guarded (or documented exemptions: 2)
check-test-typecheck-coverage: PASS — 443 test files inside the app typecheck program (NF-020 part 2)
check-money-minor-casts: PASS — 514 ملف إنتاج مفحوصًا (خارج المناطق المعتمدة)؛ صفر تأكيدات داخلية إلى عائلة Minor (أساس 0)؛ صفر تأكيدات خارجية غير مصرحة؛ 13/13 موقع تضييق هوية as-number مطابقًا للأساس (D-02/OD-MONEY — MoneyMinor = number كما هو؛ W5 مغلقة بمحفزاتها)
application-ambient-time: PASS — 178 ملف إنتاج تطبيقي؛ 25 منطقة ID-fallback معتمدة فيها 25 نداء Date.now() معفى؛ 3 تحليلًا صريحًا (مسموح)؛ منفذ الساعة الموثق 1 موقعًا؛ صفر قراءة ساعة غير عائلية (ratشة OD-TIME على جرد 25 موقعًا: 21 شكل-أ + 4 شكل-ب — تصحيح مؤرخ 2026-11-22 DOC-041/WS-251)
diagnostics-storage: PASS — 439 ملف إنتاج زُرع؛ صفر وصول غير مسجل لمفاتيح تخزين المتصفح؛ الموضع المسجل الوحيد بالضبط: مهايئ التشخيص (apps/prototype-web/client/src/storage/diagnostics/browserDiagnosticStorage.ts — R11-W1A-NF-001)؛ الاستثناء التراثي للمسودات أُزيل بتقاعد ARCH-012 (2026-10-15)؛ والمهايئ نظيف من منفذ التخزين المالية/المحلية (فصل الحدود سارٍ)
label-vocabulary: PASS — 45 تسمية دومين كنونية؛ 439 ملف إنتاج زُرع؛ 39 مدخلًا مثبتًا مصنفًا يغطي 45 موضعًا حيًّا (owner-gated/variant — راتشة OD-LABEL: التكرار الجديد يُرفض حتى يصنف)؛ مستهلك طبقة التطبيق الوحيد المحايد (agreementPresentation) يستهلك fieldLabelAr من الدومين
a11y-dialog-surfaces: PASS — 439 ملف إنتاج زُرع؛ 10 سطحًا حواريًا مصنفًا (9 ملفًا يحمل تصريح حوار حيًا)؛ أي سطح حوار جديد يُرفض حتى يصنف في نفس الـPR (W4-0/OD-A11Y)؛ فخ التركيز قانوني للـTRUE_MODAL وحده
manage-literal-text: PASS — 3 ملف سطح مانج مفحوصًا؛ 0 حرفية عربية (المسموح: الكتالوج strings/ar.ts وحده — موجود ومستثنى؛ M1.8/§10-§11/§14.2/D-7)
deleted-imports: PASS — 22 صفًا في الجرد (21 planned / 1 deleted)؛ 3171 استيرادًا مفحوصًا في 567 ملف إنتاج؛ صفر استيراد لمسار محذوف وصفر إحياء (M1.9/D-10)
```

`corepack pnpm test` → **exit 0 — 89 ملفًا / 1139 اختبارًا: كلها ناجحة، صفر فشل**:

```
 Test Files  89 passed (89)
      Tests  1139 passed (1139)
      Duration  80.23s
```

`corepack pnpm typecheck` → **exit 0 نظيف** (لا خرج بعد سطر tsc --noEmit).
