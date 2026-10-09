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
| WS-216 | IN_PROGRESS | \`refactoring/r6-w1-records-reconciliation-20261009\` | 338 | ARCH-007 | مسح R6 القراءة-فقط مكتمل ومقبول: تقريره الكنوني وحزمة قرار المالك على main عبر PR #337 عند fd92d7e8812726dcca8d27d3ad64c8f24dc96abd (docs/operations/control/evidence/structural-remediation-r6-20261009/). **R6-W1 IN_REVIEW — PR #338 مفتوح** (رأس المحتوى النهائي 583391975bfd6a8cb005d52f66a3865e8501463f من الأساس fd92d7e8 وفوقه commit التثبيت الختامي = رأس PR الحي؛ SHA الرأس الحي وإحصاءات الدمج النهائية مثبتة في متن PR #338؛ 15 ملفًا توثيقية/تحكم فقط +501/−86): F-002/F-003/F-004/F-005/F-006/F-007/F-008/F-011/F-012/F-017/F-026 + مصفوفة R6-SCAN-F-001..027 الدائمة (جرد الملفات §8) + حزم R7 الصريحة R6-F17-P01..P11؛ صفر تغيير كود/اختبار/سكربت/CSS؛ أدلة R2–R5 السابقة مستعادة كاملة بعد مراجعة المالك الأولى (لا حذف أدلة). الخطوة التالية: مراجعة المالك ودمج PR #338 بتفويض منفصل (لا دمج من هذه الجلسة)، ثم التحقق البعدي والمصالحة الإدارية، ثم R6-W2 (F-001 اختباريًا + F-024 بعد جرد المواقع) وR6-W3 (فصل text-density-count.py). لا يبدأ R7 قبل إغلاق مكتشفات R6 أو تسجيل قرار محمي لكل بند. |
