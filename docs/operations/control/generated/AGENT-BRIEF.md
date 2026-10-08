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
| WS-216 | IN_PROGRESS | \`refactoring/r5-application-boundaries-20261009\` | — | ARCH-007 | R4 مدموجة ومتحققة على main: PR #334 (16 التزامًا/37 ملفًا) بmerge commit 58d281edac7382f19580335a955ccde029125328 (والداه 1c54c552 و91ca8ee5) وCI أخضر على رأس الدمج نفسه (run 37856130116)؛ فرع R4 محفوظ على origin حتى تفويض تنظيف لاحق. بدأت R5 (حدود التطبيق وفصل القارئ/الكاتب وأبواب public وحوكمة الاستيراد العميق) بأمر المالك «R5 Application Boundaries, Reader/Writer, and Public Doors» على الفرع refactoring/r5-application-boundaries-20261009 من 58d281e: أول شريحة = المصالحة الإدارية البعدية الموثقة هنا (اللوق §152 وEntry 61)، ثم جرد حدودي كامل ببطاقات قبل أي نقل. يُفتح PR واحد لR5 عند اكتمال الموجة عند بوابة المالك؛ R6 فما بعد لم تبدأ؛ لا كتابة مباشرة على main ولا دمج للـPR من هذه الجلسة. |
