# Micro Operations Control v2

**الحالة:** `PROPOSED / REVIEW REQUIRED`  
**المكان:** امتداد لنظام `docs/operations` القائم، وليس نظامًا موازيًا.

## الغرض

يجعل هذا المجلد حالة العمل قابلة للقراءة والتحقق من أي Agent دون الاعتماد على ذاكرة محادثة. لا يغيّر سلطة العقود أو القرارات أو `current-state.md`، ولا يقرر سياسة منتج.

## مصادر الحقيقة

| السؤال | المصدر الحاكم |
|---|---|
| ماذا يعني السلوك أو المال؟ | `docs/contracts/` والسياسات المالية |
| ما القرار المعتمد؟ | `docs/02-decision-log.md` و`docs/decisions/` |
| ما الموجود فعلًا على `main`؟ | الكود والاختبارات وPR المدمج ثم `docs/operations/current-state.md` |
| ما العمل المفتوح ومن يعمل عليه؟ | ملفات `items/` و`workstreams/` هنا |
| ما خطط التوسعة؟ | `docs/expansion/TRACKER.md`، ويُربط من هنا دون نسخه |
| ما الملخص السريع؟ | `generated/AGENT-BRIEF.md` و`generated/MASTER-TRACKER.*`، وهي Views مولّدة لا تُحرّر يدويًا |

## البداية الإلزامية لأي Agent

1. حدّث `main` واقرأ `AGENTS.md` و`docs/operations/current-state.md`.
2. اقرأ `generated/AGENT-BRIEF.md` ثم شغّل `python3 scripts/operations-control/validate.py`.
3. افحص PRs المفتوحة وملفات `workstreams/active/` و`workstreams/review/`.
4. ابحث عن ID والسبب الجذري في السجل والكود والاختبارات والـcommits قبل إنشاء بند أو إعادة تنفيذه.
5. أنشئ Claim بملف Workstream قبل التعديل. لا تبدأ إذا تداخلت `areas` أو `contracts` مع Claim نشط.
6. حدّث السجل داخل PR نفسه. لا تُعلن `VERIFIED` قبل الدمج والتحقق على `main`.

## دورة الحالة

`BACKLOG → READY → CLAIMED → IN_PROGRESS → IN_REVIEW → MERGED_UNVERIFIED → VERIFIED`

حالات جانبية: `BLOCKED`، `REVIEW_REQUIRED`، `DEFERRED`، `SUPERSEDED`، `REOPENED`.

## قواعد تمنع الفوضى

- ملف JSON واحد لكل بند أو Workstream لتقليل تعارضات الدمج.
- المعرّف ثابت ولا يعاد استخدامه.
- لا يُغلق بند دون `merge_sha` و`verified_on_main_sha` ودليل تحقق.
- إذا خالف `main` السجل، فـ`main` هو الدليل: حدّث البند إلى `REOPENED` أو صحّح السجل بدل إعادة التنفيذ بصمت.
- إذا كان التنفيذ موجودًا والسجل متأخرًا، أثبته ثم حدّث السجل فقط.
- الملاحظة الجديدة تصنف `NEW` أو `DEEPENS_EXISTING` أو `DUPLICATE` أو `REOPENED` أو `FALSE_POSITIVE`.
- استخدم حقلي `finding_classification` و`finding_state` لفصل حالة الإثبات عن حالة التنفيذ؛ لا تضف `UNVERIFIED` إلى دورة التنفيذ.
- تغيير سياسة منتج أو معنى مالي يحتاج `OWNER_DECISION_REQUIRED` ولا يحسمه Agent منفردًا.
- ملفات `generated/` وExcel مخرجات قراءة فقط. التعديل يكون في JSON المصدر.
- لا توضع Tokens أو أسرار أو بيانات مستخدم في أي سجل أو دليل.

## الأوامر

```bash
python3 scripts/operations-control/generate_tracker.py
python3 scripts/operations-control/validate.py
python3 scripts/operations-control/generate_tracker.py --check
```

ينتج الأمر Views النصية وCSV التي يتحقق منها CI. ملف `MASTER-TRACKER.xlsx` واجهة مراجعة مولّدة من نفس JSON بواسطة بيئة جداول معتمدة، ولا يحرر يدويًا ولا يتغلب على JSON إذا تأخر تحديثه.

## حالة الانتقال

عند اعتماد هذا PR، يصبح `todo.md` واجهة توافق تشير إلى السجل المولّد، ويُحفظ محتواه السابق في الأرشيف. يبقى `docs/expansion/TRACKER.md` حاكمًا لنطاق التوسعة فقط. PRs القديمة لا تُغلق آليًا؛ تسجل `REVIEW_REQUIRED` حتى قرار المالك.
