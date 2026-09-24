# Agent Brief

> مولّد آليًا. اقرأ `AGENTS.md` و`docs/operations/current-state.md` قبل استخدامه.

## الحالة

هذه اللقطة لا تثبت رأس `main`. ثبّت الرأس الحالي قبل الاعتماد عليها:

```bash
git fetch origin --prune
git rev-parse origin/main
python3 scripts/operations-control/validate.py
```

الحصيلة: BLOCKED: 3 · IN_PROGRESS: 1 · BACKLOG: 2 · REVIEW_REQUIRED: 1 · DEFERRED: 20 · VERIFIED: 37

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
| WS-183 | CLAIMED | \`feat/ux-001-v2-micro-full-surface-20260924\` | 236 | UX-001 | التنفيذ مكتمل على الفرع والفحص الكامل عند الحد EXIT 0 (483+1,925 اختبارًا، تباين 92/92، الحزمة خام 649,628 مطابقة حرفيًا للخط الأساس — موجة CSS بلا أي TSX): حدود النماذج boundary، هالة تركيز سطح المعلومات، إصلاح زر الأيقونة، قاعدة القوائم الموحدة، توحيد المحددات المزدوجة، وإزالة القواعد الميتة المثبتة. الأدلة: مصفوفة تغطية 60/60 + 18 لقطة حية في docs/operations/control/evidence/ui-v2-ws183-full-surface-2026-09-24.md وplanning/ux-001-v2-evolution-2026-09-24/visual-review-w183/. بوابة المالك: مراجعة ودمج PR الاستمرار ثم التحقق على main قبل رفع الحالة؛ بوابات الجهاز الحقيقي وUAT خارجية باقية. |
