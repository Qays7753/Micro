# Agent Brief

> مولّد آليًا. اقرأ `AGENTS.md` و`docs/operations/current-state.md` قبل استخدامه.

## الحالة

رأس `main` عند تأسيس السجل: `87ebcf2ffa74752bf385eff3a10962454b45d33e`  
الحصيلة: BLOCKED: 3 · IN_REVIEW: 1 · READY: 13 · BACKLOG: 2 · DEFERRED: 2 · VERIFIED: 7

## قبل أي تعديل

1. `git fetch origin && git switch main && git pull --ff-only origin main`.
2. شغّل `python3 scripts/operations-control/validate.py`.
3. افحص PRs المفتوحة و`generated/ACTIVE-WORK.md`.
4. ابحث عن ID والسبب الجذري في JSON والكود والاختبارات والـcommits.
5. أنشئ Claim منفصلًا، ولا تتداخل مع `areas` أو `contracts` النشطة.

## بوابة البرنامج

الـPilot `BLOCKED` حتى تصبح متطلبات `releases/pre-pilot.json` كلها `VERIFIED` ثم يصدر قرار مالك. UI/UX الجذري مؤجل حتى استقرار الوظائف والحدود.

## العمل النشط

> مولّد آليًا من Workstream claims.

| ID | الحالة | الفرع | البنود | الخطوة التالية |
|---|---|---|---|---|
| WS-001 | IN_REVIEW | `docs/operations-control-v2` | CTRL-001 | مراجعة المالك وAgent مستقل؛ لا دمج قبل قبول الملاحظات. |

