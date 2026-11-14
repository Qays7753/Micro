# Agent Brief

> مولّد آليًا. اقرأ `AGENTS.md` و`docs/operations/current-state.md` قبل استخدامه.

## الحالة

هذه اللقطة لا تثبت رأس `main`. ثبّت الرأس الحالي قبل الاعتماد عليها:

```bash
git fetch origin --prune
git rev-parse origin/main
python3 scripts/operations-control/validate.py
```

الحصيلة: BLOCKED: 3 · IN_PROGRESS: 1 · IN_REVIEW: 7 · BACKLOG: 2 · REVIEW_REQUIRED: 6 · DEFERRED: 20 · VERIFIED: 85 · SUPERSEDED: 1

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
| WS-244 | REVIEW_REQUIRED | `uxr/integration-20261105` | 384 | DOC-028 | UXR-00 مقبولة توثيقيًا من المالك بتاريخ 2026-11-05؛ لا عمل إضافيًا. Claim محرر وW01 تملك DOC-029/WS-245؛ PR #384 يبقى Draft. |
| WS-245 | REVIEW_REQUIRED | `uxr/integration-20261105` | 384 | DOC-029 | اكتمل تنفيذ UXR-01 ثم UXR-02 داخل W01 على الفرع وPR #384 Draft فقط؛ التسليم لمراجعة Manus المستقلة وقرار المالك — لا قبول ذاتي ولا دمج. مطالبة W02 (WS-246/DOC-030) مؤذونة برسالة المالك المؤرخة 2026-11-06 على الفرع والـPR نفسهما مع حفظ W01 كاملًا. |
| WS-246 | REVIEW_REQUIRED | `uxr/integration-20261105` | 384 | DOC-030 | W02 (UXR-03) مكتملة التسليم عند رأس التسليم a315db6a مع مراجعتَي القراءة-فوق PASS عليه (وثيقتا التقرير UXR-W02-RESULT-2026-11-06)؛ أمر المالك المتصل المؤرخ 2026-11-06 (UXR-W03-W04-EXECUTION-PROMPT) يفرّغ المطالبة من العمل التنفيذي إلى REVIEW_REQUIRED بانتظار قرار المالك — الفحوص والمراجعات المجمعة تُنفذ بعد اكتمال W05 بأمر المرحلة النهائية. لا يعني النقل أي قبول. مطالبة W03+W04 المتصلة هي WS-247/DOC-031 على الفرع والـPR نفسيهما. |
| WS-247 | REVIEW_REQUIRED | `uxr/integration-20261105` | 384 | DOC-031 | W03 (UXR-04 بتسليماته الثلاثة) وW04 (UXR-05 ثم UXR-06) منفذتان ومسلَّمتان على الفرع وPR #384 Draft فقط برأس كود تسليم W04 193bdf3e وتقريرين UXR-W03-RESULT-2026-11-06 وUXR-W04-RESULT-2026-11-06؛ حرّرت المطالبة من IN_REVIEW إلى REVIEW_REQUIRED قانونيًا بأمر المرحلة النهائية المؤرخ 2026-11-06 — لا يعني النقل أي قبول: تنتظر التحقق المجموع (الفحوص المؤجلة والمراجعة الخماسية المستقلة على المرشح النهائي بعد اكتمال تنفيذ W05) وقرار المالك؛ لا قبول ذاتي ولا دمج. |
| WS-249 | IN_PROGRESS | `zai/micro-market-delivery-handoff-20261111` | — | DOC-033, DOC-034, DOC-035, DOC-036, DOC-037, DOC-038, DOC-039 | Workstream A (DOC-039) مكتملة بدليل الدفع النهائي — التشغيل 43599295588 أخضر كاملًا على الرأس النهائي c6e99716 (مع الالتزام التوثيقي أعلاه لهذا الدليل)؛ يليها إنشاء مطالبة WS-250 المستقلة لتنفيذ Manage Online M1–M6 على الفرع المخصص zai/micro-manage-online-20261114 من هذا الرأس. |
