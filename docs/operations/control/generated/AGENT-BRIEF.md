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
| WS-216 | IN_PROGRESS | `refactoring/r10b-complete-b1-b6-20261011` | 356 | ARCH-007 | R10-B5 PARTIAL (11 of 13 findings closed with evidence on the branch: F-025 cbe38120, F-027 fe1b79e3, F-028+NF-021 e290f1a3, F-029 262be825, F-030 a5573699, F-031+NF-022 298bd502, NF-024+NF-026 b39db892, NF-023 b279a6b3; E-UNV-008 mutation drill executed 6/6 on the real dist; local entry 631,721/155,222 PASS under the untouched ceilings). NF-020 part 1 of 2 landed behavior-verified at 257d0f54 (2,603/2,603; probe census 589->428; exclusion still in place) — part 2 required: narrowing inserts (failure-tolerant sites narrow to the failure arm, not okValue), remaining fixture drift, remove the exclusion, add the coverage guard. F-024 gated on OD-9 (package strengthened to the full canonical field list; no option chosen). Next: complete NF-020 part 2, then the B5 five-reviewer gate + records reconciliation, then B6. IN_REVIEW after PR; VERIFIED only with on-main evidence. |
