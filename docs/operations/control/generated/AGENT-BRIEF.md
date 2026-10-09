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
| WS-216 | IN_PROGRESS | \`refactoring/r7-structural-ui-boundaries-20261010\` | — | ARCH-007 | R7 بدأت التنفيذ بأمر المالك (2026-10-10): موجة «UI structural boundaries وcompatibility shims» على الفرع refactoring/r7-structural-ui-boundaries-20261010 من main عند e01d560539476c1c7f712891f2355200d2d74aa6 (ما بعد دمج مصالحة R6 عبر PR #341). R7-0 منفذة: تحقق الأساس الحي + بطاقات الإصلاح وجرد المستهلكين لحزم R6-F17-P01..P11 (تقرير R7-0 أعلاه) + جرد شيمات التوافق العشر. التنفيذ التالي بالترتيب: R7-1 (P02 Finance/F-019 + P10 EventsLayer) ثم R7-2 (P01/P03/P07) ثم R7-3 (P04/P08/P09) ثم R7-4 (P05/P06/P11) ثم R7-5 (إغلاق الشيمات بإثبات صفر مستهلكين) ثم R7-6 (أدلة الإغلاق). حدود راسخة: لا دمج ولا push لـmain ولا تنظيف ولا تغيير بصري أو مالي أو Schema/Export/Import (38/30)؛ الحالة النهائية PR_READY لمراجعة المالك ودمجه. |
