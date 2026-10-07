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
| WS-216 | IN_PROGRESS | \`refactoring/r2-money-formatting-20261007\` | — | ARCH-007 | R2 نُفذت جذريًا على الفرع refactoring/r2-money-formatting-20261007 بعد المراجعة الخمسية الثانية: نواة تاريخ محلي حساب خالص (ISO 0000–9999) + توحيد الأصناف الثمانية + إصلاح RangeError برمي مهيكل + تسعة مواضع ساعة بتاريخ عمّان + فصل priceDate + منسّقات كنونية (نسبة/صدى) + حارس ملكية حساب التاريخ (الحارس 15)؛ الموانيفستات M-01..M-09 مكتوبة قبل التنفيذ؛ pnpm check كامل PASS (الجذري 478/478، التطبيق 2266/2266، الميزانية تحت السقوف)؛ PR #330 عند بوابة مراجعة المالك — لا دمج إلا بتفويض منفصل. |
