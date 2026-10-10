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
| WS-216 | IN_PROGRESS | \`refactoring/r9-complete-w1-w2-w3-20261010\` | 347 | ARCH-007 | R9 owner-authorized root-fix continuation COMPLETE — PR_READY: PR #347 (base 8b3c9aeb) now also carries the continuation commits 56c47a27 (reversal page state machines + return path + alert roles: F3.1/F3.2/F3.3/F3.5 + W3-F1), c1d294b1 (G5 idempotency identity with knowledge + collision-free serialization: F3.4), and 0bb51d1e (IndexedDB listener hardening across 73+1 write-queueing listeners with original-error payload + guarded abort: F7/R9-GA-F7) — full pnpm check exit 0 (747/747 root, 2,502/2,502 app), entry budget 631,254/155,009 under 650,000/155,300, ratchet ledgered (6 entries), surfaces re-anchored at the code head, out-of-band real-Chromium evidence preserved (r9c-browser-evidence/), RB-3 regression + verified negative proofs. Canonical report: R9-POST-REVIEW-ROOT-FIX-EXECUTION-REPORT-2026-10-10. Owner gate: review + merge by separate authorization; post-merge reconciliation then R10. |
