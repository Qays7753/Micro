# Agent Brief

> مولّد آليًا. اقرأ `AGENTS.md` و`docs/operations/current-state.md` قبل استخدامه.

## الحالة

هذه اللقطة لا تثبت رأس `main`. ثبّت الرأس الحالي قبل الاعتماد عليها:

```bash
git fetch origin --prune
git rev-parse origin/main
python3 scripts/operations-control/validate.py
```

الحصيلة: BLOCKED: 3 · IN_PROGRESS: 2 · BACKLOG: 2 · REVIEW_REQUIRED: 1 · DEFERRED: 20 · VERIFIED: 56 · SUPERSEDED: 1

السياق الدائم والخطة الكاملة: `docs/operations/control/context.md` و`docs/operations/control/roadmap.md`.

## قبل أي تعديل

1. `git fetch origin && git switch main && git pull --ff-only origin main`.
2. شغّل `python3 scripts/operations-control/validate.py`؛ يفشل إذا تعذر إثبات Git أو كانت Views/Excel قديمة.
3. افحص PRs المفتوحة و`generated/ACTIVE-WORK.md`.
4. ابحث عن ID والسبب الجذري في JSON والكود والاختبارات والـcommits.
5. أنشئ Claim منفصلًا، ولا تتداخل مع `areas` أو `contracts` النشطة، بما في ذلك تداخل الأب/الابن.

## بوابة البرنامج

الـPilot `BLOCKED` حتى تصبح متطلبات `releases/pre-pilot.json` كلها `VERIFIED` ثم يصدر قرار مالك. البنود ذات `DEPENDENCY_GATE_REQUIRED_BEFORE_PILOT` قد تتأجل من ناحية التنفيذ لكنها تحجب البوابة، بينما `PILOT_EVIDENCE_REQUIRED` و`OUT_OF_SCOPE` لا تتحول تلقائيًا إلى Features.

## العمل النشط أو المحتاج مراجعة

> مولّد آليًا من Workstream claims؛ يشمل المراجعة المطلوبة حتى لا يختفي Claim قديم.

| ID | الحالة | الفرع | PR | البنود | الخطوة التالية |
|---|---|---|---|---|---|
| WS-216 | IN_PROGRESS | \`refactoring/r4-transfer-schema-export-20261008\` | — | ARCH-007 | اكتملت R4 (حدود Transfer/Schema/Export/Import + إغلاق R3) على الفرع refactoring/r4-transfer-schema-export-20261008 من الأساس 1c54c55: بوابة إغلاق R3 مُجتازة (اختبارات الحرّاس الأربعة، أجنحة عمق القدرات الأربع، حذف سطر CI المتقاعد، تصويب المقاييس وتعداد الـ23 طريقة)؛ توحيد قيم القبول الحالية عند مالكها الكنوني (إغلاق STR-623 بموجب بوابة STR-608 الموثقة: قائمة cashWalletKinds المجالية + استهلاك مباشر في الموقعين + مراسي استهلاك)؛ قناة مهيكلة لرفض guided parse؛ قرارات PRESERVE موثقة لملفات النقل الكبيرة؛ المخطط/التصدير 38/30 محفوظان بالتحقق الكامل (الذهبيات وMANIFEST و25 زوجًا). التدقيق العدائي النهائي ثم PR واحد بMerge Manifest عند بوابة المالك — الدمج بتفويض منفصل؛ بعده R5 بتعليمة استمرار جديدة. |
