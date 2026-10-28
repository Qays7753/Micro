# Agent Brief

> مولّد آليًا. اقرأ `AGENTS.md` و`docs/operations/current-state.md` قبل استخدامه.

## الحالة

هذه اللقطة لا تثبت رأس `main`. ثبّت الرأس الحالي قبل الاعتماد عليها:

```bash
git fetch origin --prune
git rev-parse origin/main
python3 scripts/operations-control/validate.py
```

الحصيلة: BLOCKED: 3 · IN_PROGRESS: 1 · IN_REVIEW: 4 · BACKLOG: 2 · REVIEW_REQUIRED: 2 · DEFERRED: 20 · VERIFIED: 66 · SUPERSEDED: 1

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
| WS-225 | REVIEW_REQUIRED | `components/integration-20261018` | 378 | DOC-009 | إرسال عقد UNIT-002-ZAI-AUTHORIZATION-REVIEW-PROMPT من GitHub؛ إبقاء Workstream REVIEW_REQUIRED؛ لا Claim تنفيذ ولا تعديل تطبيق حتى يقبل المالك decision payloads وعقد التنفيذ. |
| WS-226 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-010 | S01 مقبولة على فرع التكامل ومحفوظة REVIEW_REQUIRED؛ لا إجراء إضافي على WS-226 حتى بوابة الدمج النهائية بعد S18. S02 تعمل مستقلًا في WS-227 على نفس فرع التكامل. |
| WS-227 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-011 | إذن انتقال المالك من S02 إلى S03 مسجل (2026-10-28) بناء على إعادة تحقق المرحلة A عند 015c2d6c؛ S02 تبقى REVIEW_REQUIRED حتى مراجعة Manus المستقلة وقبول المالك؛ التنفيذ الانتقالي في WS-228؛ لا merge ولا cleanup. |
| WS-228 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-012 | تسليم S03 قائم (النتيجة: 08-S03-RESULT-2026-10-28.md؛ المرشح النهائي 9de4f0a5)؛ علاج عيب التزامن المؤكد يُنفذ في مسار DOC-013/WS-229 المأذون بنفس الأمر؛ يبقى المطلوب: مراجعة Manus المستقلة وقبول المالك الصريح قبل أي دمج. |
| WS-229 | IN_REVIEW | `components/integration-20261027` | 383 | DOC-013 | مراجعة Manus المستقلة وقبول المالك على المرشح النهائي؛ التحقق البعيد مسجل في تعليق PR #383؛ لا دمج ولا كتابة main ولا S05. |
