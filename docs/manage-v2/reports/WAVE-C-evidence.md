# Micro Manage v2 — أدلة الموجة C الخام (M1.7 → M1.8 → M1.9)

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
