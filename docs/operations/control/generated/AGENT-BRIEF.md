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
| WS-216 | IN_PROGRESS | \`main\` | — | ARCH-007 | R10-B W0 COMPLETE at R10B_BASE_SHA ffc54eb1150932c9bba88b48a7c38275f2a3effa (branch refactoring/r10b-systemic-findings-root-fix-20261011, docs/evidence-only): all 37 R10-A findings + 34 new findings (R10B-NF-001..034) reconciled in the canonical R10-B findings matrix (54 FIX_NOW grouped into waves R10-B1..R10-B6, 16 precise DEFER cards, 1 disproved retraction R10A-F-023); 12 E-UNV limitations re-researched; 5 PRESERVE cards re-ratified 9-10/10; PILOT count corrected to 14; BLOCKED blockers 2/3 stale corrections staged. OWNER GATE: OD-6 (W0 acceptance + wave authorization) plus OD-1..OD-13 per the owner decision package. NO code remediation performed before owner approval. Next: owner decision, then waves R10-B1..R10-B6 on this branch; no merge, no cleanup, no branch deletion. |
