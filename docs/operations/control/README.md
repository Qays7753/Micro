# Micro Operations Control v2

**الحالة:** `PROPOSED / REVIEW REQUIRED`
**المكان:** امتداد لنظام `docs/operations` القائم، وليس نظامًا موازيًا.

## الغرض

يجعل هذا المجلد حالة العمل قابلة للقراءة والتحقق من أي Agent دون الاعتماد على ذاكرة محادثة. لا يغيّر سلطة العقود أو القرارات أو `current-state.md`، ولا يقرر سياسة منتج.

ملف السياق الدائم والخطة الكاملة قبل الـPilot هو [`context.md`](context.md). يشرح المنتج، baseline، المراحل 0–10، الأدوار، حدود النطاق، الفرق بين Finding وFeature وفرضية Pilot، والخطوة التالية المسموحة. لا تنشئ ملف سياق أو Tracker موازيًا.

## مصادر الحقيقة

| السؤال | المصدر الحاكم |
|---|---|
| ماذا يعني السلوك أو المال؟ | `docs/contracts/` والسياسات المالية |
| ما القرار المعتمد؟ | `docs/02-decision-log.md` و`docs/decisions/` |
| ما الموجود فعلًا على `main`؟ | الكود والاختبارات وPR المدمج و`docs/operations/current-state.md`؛ ويُثبت Git الرأس الحالي |
| ما العمل المفتوح ومن يعمل عليه؟ | ملفات `items/` و`workstreams/` هنا |
| ما خطط التوسعة؟ | `docs/expansion/TRACKER.md`، ويُربط من هنا دون نسخه |
| ما الملخص السريع؟ | `generated/AGENT-BRIEF.md` و`generated/MASTER-TRACKER.*`، وهي Views مولّدة لا تُحرّر يدويًا |
| ما السياق الدائم والخطة الكاملة؟ | [`context.md`](context.md) و`roadmap.md`؛ ملفان توجيهيان مرتبطان بالسجل ولا يستبدلان مصادر السلوك |
| ما التقرير الخارجي؟ | `reports/index.json` والروابط المفهرسة، دون نسخ التقرير إلى Tracker |

## البداية الإلزامية لأي Agent

1. حدّث `main` واقرأ `AGENTS.md` و`docs/operations/current-state.md`.
2. اقرأ `context.md` و`generated/AGENT-BRIEF.md` ثم شغّل `python3 scripts/operations-control/validate.py`؛ الفشل في إثبات Git أو freshness يوقف العمل.
3. افحص PRs المفتوحة وملفات `workstreams/` و`generated/ACTIVE-WORK.md`.
4. ابحث عن ID والسبب الجذري في السجل والكود والاختبارات والـcommits قبل إنشاء بند أو إعادة تنفيذه.
5. أنشئ Claim بملف Workstream قبل التعديل. لا تبدأ إذا تداخلت `areas` أو `contracts`، مباشرة أو هرميًا، مع Claim نشط.
6. حدّث السجل داخل PR نفسه. لا تُعلن `VERIFIED` قبل الدمج وإثبات الـSHA على `main` والتحقق من الدليل.

## دورة الحالة

`BACKLOG → READY → CLAIMED → IN_PROGRESS → IN_REVIEW → MERGED_UNVERIFIED → VERIFIED`

حالات جانبية: `BLOCKED`، `REVIEW_REQUIRED`، `DEFERRED`، `SUPERSEDED`، `REOPENED`. كل Item وWorkstream يحمل `status_history`؛ آخر سجل يجب أن يطابق الحالة الحالية، والانتقال غير القانوني يفشل Validator. السجل التاريخي المستورد يستخدم `migration_baseline: true` صراحة.

## الحقول الإلزامية للتنسيق

كل Item يحتاج `next_action`. وكل بند `BLOCKED` يحتاج `blocked_reason`، وكل بند `DEFERRED` يحتاج `deferred_reason`. يتطلب `MERGED_UNVERIFIED` `merge_sha`. ويتطلب `VERIFIED` `merge_sha` و`verified_on_main_sha` ودليلًا، مع إثبات أن الـcommits موجودة وقابلة للوصول من `origin/main`.

كل Item يحتاج أيضًا `classification` و`gate_classification` و`owner` و`tests_required` و`layers`. التصنيف يميز بين `FIX_BEFORE_PILOT` و`BUILD_AFTER_EVIDENCE` و`FUTURE_SCOPE` و`PILOT_VALIDATION` و`HISTORICAL` و`GOVERNANCE` و`HARDENING` و`RELEASE_GATE`. و`gate_classification` يوضح هل البند متطلب Gate مؤجل التنفيذ، أو يحتاج دليل Pilot، أو خارج النطاق، أو مكرر تاريخيًا، أو مثبت على main. لا تسمح `DEFERRED` بتجاوز متطلب قبل Pilot.

## Claims ومنع التداخل

يجب أن يتضمن Workstream `branch` و`base_sha` و`areas` و`contracts` و`items` و`next_action`. يطبّع Validator المسارات والفواصل ويكشف التداخل المباشر والهرمي، وملكية Item في أكثر من Workstream نشط، وBase SHA غير الموجود أو المختلف عن `origin/main` كتحذير واضح. حالات Claims القديمة لا تختفي؛ تبقى `REVIEW_REQUIRED` حتى قرار صريح.

## المصالحة قبل Pilot

`migration-map.md` يربط كل بند غير مكتمل من الأرشيف التاريخي بنتيجة حية: Item، أو `VERIFIED` بدليل، أو `DEFERRED`، أو `SUPERSEDED_BY_<ID>`، أو `REVIEW_REQUIRED`. لا يحول التقرير الخارجي Findings إلى عمل جاهز تلقائيًا؛ يسجلها كعناصر مرتبطة بالمصدر مع بواباتها. خطة المراحل 0–10 وتفاصيل ما قبل الـPilot محفوظة في `context.md` و`roadmap.md`.

## Views وExcel

- ملف JSON واحد لكل Item أو Workstream لتقليل تعارضات الدمج.
- المعرّف ثابت ولا يعاد استخدامه.
- ملفات `generated/` وExcel مخرجات قراءة فقط. التعديل يكون في JSON المصدر ثم يعاد توليد Views.
- `MASTER-TRACKER.csv` وMarkdown يتضمنان الخطوة التالية وأسباب الحجب/التأجيل.
- `MASTER-TRACKER.xlsx` واجهة مراجعة محفوظة من الصفحات الحالية، و`MASTER-TRACKER.xlsx.meta.json` يثبت SHA-256 لمصدر JSON وWorkbook. أي تغيير في JSON دون تحديث Excel وMetadata يفشل Validator.
- طريقة التحديث المعتمدة: تحديث Workbook في أداة جداول مراجعة، الحفاظ على الصفحات المفيدة، ثم تشغيل `python3 scripts/operations-control/generate_tracker.py --refresh-excel-meta` ومراجعة `unzip -t`.

## قواعد تمنع الفوضى

- إذا خالف `main` السجل، فـ`main` هو الدليل: حدّث البند إلى `REOPENED` أو صحّح السجل بدل إعادة التنفيذ بصمت.
- إذا كان التنفيذ موجودًا والسجل متأخرًا، أثبته ثم حدّث السجل فقط.
- الملاحظة الجديدة تصنف `NEW_FINDING` أو `DEEPENS_EXISTING` أو `DUPLICATE` أو `REOPENED` أو `FALSE_POSITIVE`.
- استخدم حقلي `finding_classification` و`finding_state` لفصل حالة الإثبات عن حالة التنفيذ؛ لا تضف `UNVERIFIED` إلى دورة التنفيذ.
- تغيير سياسة منتج أو معنى مالي يحتاج `OWNER_DECISION_REQUIRED` ولا يحسمه Agent منفردًا.
- لا توضع Tokens أو أسرار أو بيانات مستخدم في أي سجل أو دليل.

## الأوامر

```bash
python3 scripts/operations-control/generate_tracker.py
python3 scripts/operations-control/validate.py
python3 scripts/operations-control/generate_tracker.py --check
python3 scripts/operations-control/generate_tracker.py --refresh-excel-meta
```

أمر `generate_tracker.py` ينتج Views النصية وCSV. Excel لا يُحرّر يدويًا من داخل Git؛ بعد تحديثه في أداة الجداول، يثبت Metadata مصدره وHash الملف. `docs/expansion/TRACKER.md` يبقى حاكمًا لنطاق Expansion؛ اربطه ولا تنسخه.
