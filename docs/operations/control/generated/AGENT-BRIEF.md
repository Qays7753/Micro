# Agent Brief

> مولّد آليًا. اقرأ `AGENTS.md` و`docs/operations/current-state.md` قبل استخدامه.

## الحالة

هذه اللقطة لا تثبت رأس `main`. ثبّت الرأس الحالي قبل الاعتماد عليها:

```bash
git fetch origin --prune
git rev-parse origin/main
python3 scripts/operations-control/validate.py
```

الحصيلة: BLOCKED: 3 · IN_PROGRESS: 1 · IN_REVIEW: 18 · BACKLOG: 2 · REVIEW_REQUIRED: 2 · DEFERRED: 20 · VERIFIED: 66 · SUPERSEDED: 1

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
| WS-225 | REVIEW_REQUIRED | `components/integration-20261018` | 378 | DOC-009 | إرسال عقد UNIT-002-ZAI-AUTHORIZATION-REVIEW-PROMPT من GitHub؛ إبقاء Workstream REVIEW_REQUIRED؛ لا Claim تنفيذ ولا تعديل تطبيق حتى يقبل المالك decision payloads وعقد التنفيذ. |
| WS-226 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-010 | S01 مقبولة على فرع التكامل ومحفوظة REVIEW_REQUIRED؛ لا إجراء إضافي على WS-226 حتى بوابة الدمج النهائية بعد S18. S02 تعمل مستقلًا في WS-227 على نفس فرع التكامل. |
| WS-227 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-011 | S02 مقبولة من المالك على فرع التكامل بتاريخ 2026-11-04؛ لا عمل مرحلي إضافي دون دليل جديد؛ لا VERIFIED على main ولا merge. |
| WS-228 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-012 | S03 مقبولة من المالك على فرع التكامل بتاريخ 2026-11-04؛ لا عمل مرحلي إضافي دون دليل جديد؛ لا VERIFIED على main ولا merge. |
| WS-229 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-013 | S04 مقبولة من المالك على فرع التكامل بتاريخ 2026-11-04؛ لا عمل مرحلي إضافي دون دليل جديد؛ لا VERIFIED على main ولا merge. |
| WS-230 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-014 | S05 مقبولة من المالك على فرع التكامل بتاريخ 2026-11-04؛ لا عمل مرحلي إضافي دون دليل جديد؛ لا VERIFIED على main ولا merge. |
| WS-231 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-015 | S06 مقبولة من المالك على فرع التكامل بتاريخ 2026-11-04؛ لا عمل مرحلي إضافي دون دليل جديد؛ لا VERIFIED على main ولا merge. |
| WS-232 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-016 | S07 مقبولة من المالك على فرع التكامل بتاريخ 2026-11-04؛ لا عمل مرحلي إضافي دون دليل جديد؛ لا VERIFIED على main ولا merge. |
| WS-233 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-017 | S08 مقبولة من المالك على فرع التكامل بتاريخ 2026-11-04؛ لا عمل مرحلي إضافي دون دليل جديد؛ لا VERIFIED على main ولا merge. |
| WS-234 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-018 | S09 مقبولة من المالك على فرع التكامل بتاريخ 2026-11-04؛ لا عمل مرحلي إضافي دون دليل جديد؛ لا VERIFIED على main ولا merge. |
| WS-235 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-019 | S10 مقبولة من المالك على فرع التكامل بتاريخ 2026-11-03؛ Workstream REVIEW_REQUIRED يحرر الملكية للمراحل اللاحقة ولا يعني VERIFIED على main. لا إعادة فتح دون دليل جديد؛ لا merge ولا كتابة على main. |
| WS-236 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-020 | S11 مقبولة من المالك على فرع التكامل بتاريخ 2026-11-04؛ لا عمل مرحلي إضافي دون دليل جديد؛ لا VERIFIED على main ولا merge. |
| WS-237 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-021 | S12 مقبولة على فرع التكامل؛ لا إجراء إضافي دون دليل جديد. استمرار S14 مستقل ومشروط بحسم عائق gzip؛ لا merge ولا كتابة على main. |
| WS-238 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-022 | S13 مقبولة على فرع التكامل؛ لا إجراء إضافي دون دليل جديد. استمرار S14 مستقل ومشروط بحسم عائق gzip؛ لا merge ولا كتابة على main. |
| WS-239 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-023 | S14 مقبولة من المالك على فرع التكامل بتاريخ 2026-11-03؛ Workstream REVIEW_REQUIRED يحرر الملكية للمراحل اللاحقة ولا يعني VERIFIED على main. لا إعادة فتح دون دليل جديد؛ لا merge ولا كتابة على main. |
| WS-240 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-024 | S15 مقبولة من المالك على فرع التكامل بتاريخ 2026-11-04؛ لا إعادة فتح دون دليل جديد. لا عمل مرحلي إضافي مفوض؛ لا VERIFIED على main ولا merge. |
| WS-241 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-025 | S16 مقبولة من المالك على فرع التكامل بتاريخ 2026-11-04؛ لا إعادة فتح دون دليل جديد. لا عمل مرحلي إضافي مفوض؛ لا VERIFIED على main ولا merge. |
| WS-242 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-026 | S17 مقبولة من المالك على فرع التكامل بتاريخ 2026-11-04؛ لا عمل مرحلي إضافي دون دليل جديد؛ لا VERIFIED على main ولا merge. |
| WS-243 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-027 | S18 مقبولة من المالك على فرع التكامل بتاريخ 2026-11-04؛ لا عمل مرحلي إضافي دون دليل جديد؛ لا VERIFIED على main ولا merge. |
