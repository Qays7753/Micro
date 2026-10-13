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
| WS-216 | IN_PROGRESS | `refactoring/r10b-complete-b1-b6-20261011` | 356 | ARCH-007 | R10-B/D1 EXECUTED (OD-14=D1 owner-approved): commit 0a829bf6 removes the build identity from the JS entry and carries it in ONE index.html meta tag (strict build-time validation + closeBundle fail-closed carrier/leak verification; guarded one-shot DOM read in buildIdentity.ts). Gate PASS on the committed tree: 30 identity draws byte-identical (index-CPVmJmgX.js 631,903/155,290, sigma-hat 0), same-identity rebuild identical, null-vs-identity differ only in index.html+sw.js, headroom 10 >= 2*sigma-hat under untouched 650,000/155,300. Surfaces re-anchored same-PR (local 2,683,356 / cloud 2,683,446); ratchet R10B-D1-IDENTITY-CARRIER. NEXT: push D1 + post-push PWA/CI/Cloudflare evidence + five reviewers on the implementation, then OD-9=C as a separate revertible commit (no-consumer proof first), then NF-020 part 2 (exclusion removal + narrowing insertions + coverage guard), then B6 final closure (matrix re-check, five verification agents, full chain, final report + Merge Manifest). Merge remains owner-only. |
