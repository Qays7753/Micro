# UI/UX V2 Phase 0 Baseline — 2026-09-23

**Micro baseline:** `origin/main` = `f05b45e6cd46b6dfae116f51cdbcd4b2444b8dfc`

**Bold Modular V2 baseline:** `Qays7753/Micro-Bold-Modular-Design-Handoff-V1` `main` = `026541d9ac10c8d8df9999c4cd85653c4231ff43`

## حالة البوابة

Phase 0 توثيقية فقط. لم تُعدّل ملفات Tokens أو Standard أو كود التطبيق، ولم يبدأ أي نقل أو إعادة تنظيم.

## القرارات المثبتة

1. Bold Modular V2 هو المرجع البصري المعتمد للاتجاه الجديد.
2. `Micro Standard` و`apps/prototype-web/client/src/styles/vf-tokens.css` يبقيان جسر التنفيذ داخل Micro حتى يتم اعتماد Mapping صريح؛ لا يُنشأ مصدر Tokens ثانٍ.
3. موجة V2 الحالية Light-first/Light-only بصريًا؛ Dark Mode الحالي يُحافَظ عليه ولا يُحذف أو يُعاد تصميمه أو تُنقل إليه Tokens V2 في هذه الموجة.
4. الوظائف والبيانات والحسابات والـDomain والتخزين والتصدير خارج نطاق UI/UX.
5. لا يبدأ الكود قبل Phase 1 قراءة-فقط: خريطة V2-to-Micro Integration Mapping وجرد المستهلكين ومراجعة المالك.

## تحقق baseline

- شجرة Micro نظيفة على baseline.
- لا توجد PRs مفتوحة عند بدء Phase 0.
- لا توجد Worktrees إضافية محلية عند بدء Phase 0.
- `python3 scripts/operations-control/validate.py` مرّ قبل التحديث.
- `UX-001` بقي `DEFERRED`؛ اعتماد الاتجاه لا يعني اكتمال الترحيل أو اختبار الأجهزة أو اختبار المستخدمين.

## خارج نطاق هذه المرحلة

- تحديث `vf-tokens.css`.
- تعديل Micro Standard أو وثائق Standard البصرية التفصيلية.
- تعديل Dark Mode.
- تعديل أي مكوّن أو شاشة أو منطق مالي.
- إنشاء خريطة الدمج التفصيلية؛ تُنفذ في Phase 1 بعد مراجعة الوثائق الأساسية.
