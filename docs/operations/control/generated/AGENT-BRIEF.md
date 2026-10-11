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
| WS-216 | IN_PROGRESS | \`refactoring/r9-complete-w1-w2-w3-20261010\` | 347 | ARCH-007 | R9 SYSTEMIC root-fix continuation COMPLETE — PR_READY: on the same PR #347 (base 8b3c9aeb), the systemic continuation closed the owner's two required corrections and the full recurrence families — F3.6-ERROR-ROLE-INVENTORY (complete 99-element semantic inventory: 11 error-only alert flips, 9 mixed-tone splits with tone-in-state, 24 read-error alert additions, 8 documented preserves), F3.7 (three more swallowed-read/infinite-loading pages given explicit read state machines: CashAdjustmentEditor/ScheduleEditor/RecurringExpenseEditor), G5.1 (legacy-key semantic bridge in createDeclaration — eight-field comparison after the exact-key miss; cross-format retry reuse without any schema/export change), G5.2 (collision-free contribution-mix key), F7.1 (listAll read-hang guard + the permanent check-storage-listener-guards static guard, guard #20), F8 (reproducible browser-evidence chain: committed bundle b1d5fd5f + builder + manifest + a fresh real-Chromium run, HeadlessChrome/156, zero console errors). Commits da8747ca + ecc4b963 + ecf17620 + 91bd07ac + the docs commit. Full pnpm check exit 0 (754/754 root, 2,521/2,521 app); entry 631,652/155,093 under 650,000/155,300; negative proofs recorded. Canonical report: R9-SYSTEMIC-ROOT-FIX-AND-EVIDENCE-CLOSURE-EXECUTION-REPORT-2026-10-11. Owner gate: review + merge by separate authorization; post-merge reconciliation then R10. |
