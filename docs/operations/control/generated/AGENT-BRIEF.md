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
| WS-216 | IN_PROGRESS | \`refactoring/r5-application-boundaries-20261009\` | 335 | ARCH-007 | R5 مكتملة على الفرع refactoring/r5-application-boundaries-20261009 من الأساس 58d281ed (أمر المالك «R5 Application Boundaries, Reader/Writer, and Public Doors»): المصالحة الإدارية البعدية؛ جرد حدودي كامل ببطاقات قبل أي نقل؛ لجنة خماسية قراءة-فقط قبل التنفيذ طُبقت تعديلاتها السبعة الإلزامية كلها؛ S1 إغلاق ثغرة ماسح الحدود (المواضع النوعية import("…").X صارت محسوبة + الامتدادات js/jsx) وهجرة موقعي شيمة الميزانيات إلى باب budgets (43→42 مفتاحًا)؛ S2 الحارس الـ16 check-application-door-surfaces (تثبيت أسطح القيم والأنواع لكل باب على أي عمق + حظر البراميل غير المرئية + إغلاق R0-N20 وFD-6)؛ S3 الحارس الـ17 check-application-readwrite (18+10 ملفات قراءة لا تكتب حتميًا)؛ S4 عقود PC-4 الرباعية في 12 ملفًا؛ الجذري 710/710 والتطبيق 323/2388 والحراس 17/17 والميزانية 629,300/154,683 وكل البوابات خضراء على رأس التنفيذ 5bd5da4a. PR واحد عند بوابة المالك — الدمج بتفويض منفصل؛ بعده التحقق البعدي والمصالحة الإدارية عمليتان منفصلتان؛ R6 بتعليمة استمرار جديدة فقط. |
