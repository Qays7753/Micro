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
| WS-216 | IN_PROGRESS | \`refactoring/r6-w3-text-density-tooling-20261009\` | 340 | ARCH-007 | موجات R6 منفذة على السلسلة المكدسة (W1 مصححة على PR #338؛ W2 على PR #339 — كلاهما مفتوح عند بوابة المالك). **R6-W3 IN_REVIEW — PR #340 مفتوح** (الرأس الحي الكامل 90f9253e79ca13410addd914dba463557fafbcf5؛ CI النهائي 37993359915 ناجح؛ تقرير الجاهزية مثبت في evidence؛ ترتيب الدمج الإلزامي PR #338 ثم #339 ثم #340) (مكدسة على رأس W2؛ أدوات/اختبارات/توثيق فقط): F-009 فصل عدّاد كثافة النص — التواصيف أولًا (ذهبي 4,117 بايت sha256‏ 812a24bb… التُقط وأخضر قبل الفصل)، ثم استخراج دفتر CAPS/PAGES/EXPLICIT_SERVICES حرفيًا بتاريخه المؤرخ المحفوظ إلى scripts/text_density_policy.py (بيانات فقط) والمحرك (458 nbLOC — يغادر SPLIT_NOW إلى WATCH) يستوردها ويتحقق منها (خرج 2 عند المدخلات المشوهة)؛ المخرجات بايت-متطابقة قبل/بعد؛ 7 اختبارات توصيف/حدّ/سلبيات؛ السجل §2/§3/§7 وأساس الراتشة (تشديد المحرك وتسجيل الدفتر SPLIT_CANDIDATE) وخريطة الاختبارات وSOURCE_OF_TRUTH حُدثت نفس-الـPR؛ الحزمة مثبتة بلا تغيير. الجذري 730/730؛ التطبيق 323/2388؛ الحراس 17/17. الخطوة التالية: مراجعة المالك والدمج بالترتيب PR #338 ثم PR #339 ثم PR الـW3 بتفويض منفصل (لا دمج من هذه الجلسة)، ثم التحقق البعدي والمصالحة الإدارية. لا يبدأ R7 قبل إغلاق مكتشفات R6 أو تسجيل قرار محمي لكل بند. |
