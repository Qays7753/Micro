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
| WS-216 | IN_PROGRESS | \`refactoring/r9-complete-w1-w2-w3-20261010\` | 347 | ARCH-007 | R9 SYSTEMIC root-fix continuation COMPLETE — post-push cloud-anchor repair landed: the five systemic commits (da8747ca + ecc4b963 + ecf17620 + 91bd07ac + the docs closure 67366bff) pushed to PR #347 exposed that the bundle-surfaces cloud environment records were still anchored at 0bb51d1e (CI run 38118248772 + Pages check-run 114407518003 failed exactly the three grown surfaces); the repair commit re-anchors both cloud records to the 67366bff measurements (github-actions = exact CI-measured values, locally reproduced and pre-verified in both simulated cloud environments) and records the full chain in §12 of the systemic report. All finding closures unchanged: F3.6-ERROR-ROLE-INVENTORY (99-element semantic inventory), F3.7 (three read state machines), G5.1 (legacy-key semantic bridge), G5.2, F7.1 (listAll guard + static guard #20), F8 (reproducible browser-evidence chain). Full pnpm check exit 0 (754/754 root, 2,521/2,521 app); entry 631,652/155,093 local — 631,764/155,157 CI — under 650,000/155,300. PR_READY is conditioned on green CI + Cloudflare Pages on the exact final head (URLs pinned in the PR body per R9-GA-F5). Canonical report: R9-SYSTEMIC-ROOT-FIX-AND-EVIDENCE-CLOSURE-EXECUTION-REPORT-2026-10-11 (§12 = the repair record). Owner gate: review + merge by separate authorization; post-merge reconciliation then R10. |
