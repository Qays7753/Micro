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
| WS-216 | IN_PROGRESS | \`refactoring/r9-complete-w1-w2-w3-20261010\` | — | ARCH-007 | R9 complete remediation (W1+W2+W3) owner-authorized and executing on branch refactoring/r9-complete-w1-w2-w3-20261010 from base 8b3c9aeb09ca33ed66f0a929c157b668839d0463 (live main: PR #346 post-merge reconciliation, CI run 38061919149 success on the exact SHA). W1 = documentation/evidence/Operations Control reconciliation of the accepted preflight findings R9-PF-N1..N10 (repair cards R9-REPAIR-CARDS.md; canonical findings copy + five-reviewer package under structural-remediation-r9-20261010/; R8-N1 canonical evidence annex added to the R8 evidence directory). W2 = genuine rollback/recovery rehearsals (RB-1 snapshot backup/replace/failure/restore; RB-2 migration/re-derivation failure/restore) + root-fix of the discovered recovery defect R9-GA-F1 (replaceIndexedDbSnapshot non-atomic on synchronous queueing failure) with regression tests. W3 = direct behavioral tests for the five named-reference pages with no visual UI change. One PR at the end; NO merge without owner authorization; the PR head SHA and its CI/Cloudflare run URLs will be pinned in the PR body and final report, and the post-merge reconciliation (owner action) moves merge_sha/verified_on_main_sha to the R9 merge SHA only after it exists. |
