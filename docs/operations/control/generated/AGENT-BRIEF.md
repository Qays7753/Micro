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
| WS-216 | IN_PROGRESS | \`refactoring/r6-w2-tests-20261009\` | 339 | ARCH-007 | مسح R6 القراءة-فقط مكتمل ومقبول؛ R6-W1 مصححة على PR #338 (مفتوح عند بوابة المالك؛ الأدلة السابقة مستعادة append-only؛ CI أخضر على الرأس النهائي b3048f2a). **R6-W2 IN_REVIEW — PR #339 مفتوح** (مكدسة على رأس W1؛ اختبارات/حراس فقط): F-001 جذر حتمية StateRecovery ببوابة releaseRead (سابقة Home.dom.test.tsx:157؛ الـassertion كما هو حرفيًا؛ 14 تشغيلًا أخضر متتاليًا للملف المركز؛ مجموعة التطبيق 323/2388 خضراء) + F-024 جرد المواقع الست الدقيق قبل التنفيذ (inventoryMovementType وcatalogItemKind وscheduleStatus وyieldReadiness وshortCashDeclaration وexpenseContext) وتمديد حارس مراسي قيم القبول بتثبيت مزدوج (اتحاد المجال == مدققة النقل == الطاقم الموثق؛ 13 اختبارًا جديدًا بسلبيات الاتجاهين؛ الجذري 723/723). صفر تغيير إنتاج؛ Schema ‏38/Export ‏30 كما هما؛ جذر 4D يبقى بقرار مالك. الخطوة التالية: مراجعة المالك ودمج PR #338 ثم PR الـW2 بتفويض منفصل (لا دمج من هذه الجلسة)، ثم R6-W3 (فصل text-density-count.py بتوصيف أولًا). لا يبدأ R7 قبل إغلاق مكتشفات R6 أو تسجيل قرار محمي لكل بند. |
