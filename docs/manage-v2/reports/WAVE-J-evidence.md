# أدلة الموجة J الخام — M2.12 + M2.13 وبوابة الموجة

> السجلات الكاملة في `verify-logs/` (خارج المستودع): `m212-red.log` و`m212-focused.log` و`m212-regressions.log` و`m212-guards.log` و`m212-typecheck.log` و`m212-lint.log` و`m213-red.log` و`m213-focused.log` و`m213-regressions.log` و`m213-guards.log` و`m213-typecheck.log` و`m213-lint.log` و`waveJ-guards.log` و`waveJ-typecheck-root.log` و`waveJ-format.log` و`waveJ-knip.log` و`waveJ-root-test.log` و`waveJ-proto-test.log`. أدلة المهمتين التفصيلية في `M2.12-evidence.md` و`M2.13-evidence.md`.

## §0 التزامات الموجة

| الالتزام | البصمة الكاملة |
|---|---|
| M2.11-correction (قبل الموجة — يوثّق احمرار شجرة M2.11 على typecheck والراتشة) | `240030f3` |
| M2.12 (التزام المهمة) | `8df857c06c9b59d7be684fdc068c25327d8acb98` |
| M2.12 pin | `b57d6c40` |
| M2.13 (التزام المهمة) | `1eec3f6e225f6cefe4fbb24cc4dc6d5944be7db9` |
| M2.10/M2.11-correction (knip door — قبل بوابة الموجة، انظر §2) | `4cef4ff4` |
| رأس بوابة الموجة (هذه الشجرة) | `4cef4ff40bb93cf622f01107503a51f61fb0571c` |

## §1 المهمتان

- **M2.12:** الأحمر المقصود ثم 6/6؛ المؤثرات 142/142؛ الموسّعة خضراء — التفصيل الملف بملف والفشول الوسيطة في `M2.12-evidence.md`.
- **M2.13:** الأحمر المقصود ثم 6/6؛ المؤثرات 148/148؛ الموسّعة خضراء — التفصيل والفشول الوسيطة في `M2.13-evidence.md`.

## §2 ما وُجد عند فتح الموجة (تصحيحان سابقا، موثقان تحت M2.11 في المتتبع)

1. **شجرة `03e7b86f` (التزام M2.11) حمراء على فحصين لم تسجلهما بوابة الموجة I:** typecheck التطبيق (TS2353 لخانة netProfit + ثلاثة TS2769) وحارس راتشة الحجم (`new-file-enters-band` على readModel.ts نفسه). صُحّحا بالتزام `240030f3` (تغييرات نوعية/توثيقية) قبل التزام M2.12.
2. **ادّعاء بوابة الموجة I «knip 0» غير دقيق هو أيضًا:** خمسة رموز لم تُدخل باب knip المعلن (البرميل) يوم موجاتها (PlanRevisionEntries من M2.10 وprofitBarsOf وperiodOverlapsIncompleteAbsence وexpectedProfitFils وProfitBar من M2.11 — مستهلكها الوحيد ملفات العامل خارج نطاق الراسم) فظهرت «تصديرات غير مستخدمة» على شجرتي M2.11 وM2.12 (مُثبت بworktree على `b57d6c40`: 3 دوال + 3 أنواع). صُحّح بالتزام `4cef4ff4` (إدخالها بالباب المعلن نفسه) قبل بوابة الموجة J.

## §3 بوابة الموجة J الكاملة (على رأس `4cef4ff4` — الشجرة النهائية)

| الفحص | الأمر | النتيجة |
|---|---|---|
| الحراس | `corepack pnpm guards` | **22 PASS / صفر FAIL، exit 0** (راتشة: إرساءان موثقان 301→409 لمسار الحياة و401 لتأسيس الاستيراد) |
| اختبار الجذر | `corepack pnpm test` | **91 ملفًا / 1271 اختبارًا، exit 0** |
| اختبار التطبيق | `corepack pnpm --filter @micro/prototype-web test` | **490 ملفًا / 3930 اختبارًا، exit 0** |
| typecheck | `corepack pnpm typecheck` + `npx tsc --noEmit` (+`-p tsconfig.node.json`) داخل التطبيق | **0 / 0/0** |
| format | `corepack pnpm format:check` | **0** |
| knip | `KNIP_DISABLE_RAW_TRANSFER=1 corepack pnpm knip` | **0 مخرجات، exit 0** |
| lint | `corepack pnpm lint` | **0 أخطاء** (تحذيرات v1 القديمة نفسها؛ ملفات الموجة صفر تحذير) |

**الموجة J خضراء بالكامل.**
