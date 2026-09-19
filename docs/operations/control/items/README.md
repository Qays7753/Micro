# سجلات البنود

كل ملف يمثل سببًا جذريًا واحدًا. لا تُنشئ ملفًا جديدًا قبل البحث في العناوين والأسباب والتقارير وسجل Git.

## اكتشاف جديد

صنّفه أولًا: `NEW_FINDING` أو `DEEPENS_EXISTING` أو `DUPLICATE` أو `REOPENED` أو `FALSE_POSITIVE`. حالة الإثبات (`UNVERIFIED` أو `CONFIRMED`) ليست حالة تنفيذ؛ سجّلها في `finding_state`. لا ينتقل البند إلى `READY` قبل وجود دليل ومعايير قبول واعتماد قرار المالك إن كان يغيّر سياسة.

## عقد السجل

كل Item يطابق `schemas/item.schema.json`، بما في ذلك `source` و`status_history` و`migration_baseline` و`next_action`. السجلات التاريخية ذات الحالة الواحدة تستخدم `migration_baseline: true` صراحةً؛ السجلات الجديدة تسجل كل انتقال مع التاريخ والفاعل والسبب.

كل Item يحدد أيضًا `classification` و`gate_classification` و`owner` و`tests_required` و`layers`. التصنيف يفرق بين إصلاح قبل Pilot، وبناء بعد دليل، ونطاق مستقبلي، وفرضية تحقق Pilot، وسجل تاريخي، وحوكمة، وتحسين تحصيني، وبوابة إصدار. يوضح `gate_classification` هل `DEFERRED` متطلب Gate مؤجل التنفيذ، أو دليل Pilot، أو خارج النطاق، أو تكرار تاريخي؛ هذه الحقول تسجل قابلية التتبع ولا تمنح إذنًا بالتنفيذ.

- `BLOCKED` يتطلب `blocked_reason`.
- `DEFERRED` يتطلب `deferred_reason` وبوابة إعادة فتح.
- `MERGED_UNVERIFIED` يتطلب `merge_sha`.
- `VERIFIED` يتطلب `merge_sha` و`verified_on_main_sha` ودليلًا قابلًا للوصول، ويثبت Validator وجود الـcommits وتاريخها على `origin/main`.
- كل حالة غير نهائية تتطلب `next_action` واضحة.

## الإغلاق

`VERIFIED` يتطلب Merge SHA وSHA تحقق على `main` ودليلًا. لا يكفي تقرير Agent أو نجاح محلي أو SHA نصي. شغّل `python3 scripts/operations-control/validate.py` بعد تحديث JSON، ثم أعد توليد Views.
