# Micro — S01 Authority Matrix — 2026-10-27

**الحالة:** S01 accepted on integration branch; S02 draft review required.
**Base SHA:** `3584aa1d08cea3e0a00623b719fed7f991ce187f`
**Branch:** `components/integration-20261027`

| العنصر | المصدر/المرجع | الحالة في S01 | ما يجوز فعله لاحقًا |
|---|---|---|---|
| تعليمات التشغيل | `AGENTS.md`, SOP, Handoff Protocol | سلطة حاكمة | لا تنشأ نسخة منافسة؛ استثناء الفرع الواحد خاص بهذا البرنامج فقط |
| الحالة والتحكم | `docs/operations/current-state.md` وJSON المصدر | محدثان من المصادر الرسمية | لا تعدل generated views يدويًا |
| main والكود | `origin/main` عند `3584aa1d08cea3e0a00623b719fed7f991ce187f` | خط أساس حي متحقق قبل الكتابة | لا تنسب فحصًا إلى رأس آخر |
| حزمة التنفيذ الأصلية | `docs/implementation/micro-component-execution/` | منشورة مع تمييز ملفات الحزمة الأصلية عن إضافات S01 | GitHub هو مصدر التنفيذ؛ Drive provenance فقط |
| UNIT-001 V3 | سجلات `DOC-008/WS-224` | VERIFIED ضمن نطاقه السابق | لا يعاد تنفيذه ولا يُعامل كتطابق تلقائي مع V9 |
| UNIT-001 V9 | `02-SPECIFICATIONS/03-New-Design/UNIT-001-إعداد-المشروع.md` | مواصفة تسليم معتمدة، غير منفذة في هذه الجولة | S03 يراجع الفرق فوق تنفيذ V3 |
| UNIT-002 V5 | `docs/product/components/UNIT-002...V5.md` | مراجعة سابقة، لا توسيع | لا تنفيذ UNIT-002 من S01 |
| UNIT-002 V11 | `02-SPECIFICATIONS/03-New-Design/UNIT-002-استكمال-بيانات-المشروع.md` | مواصفة تسليم معتمدة، غير منفذة في هذه الجولة | تبقى ضمن تخطيط S14 |
| DOC-009/WS-225 | `REVIEW_REQUIRED` | محفوظان دون توسيع | لا يتحولان إلى Claim تنفيذ |
| S01 | `DOC-010/WS-226` | `IN_REVIEW` مع قبول مالك على فرع التكامل فقط؛ candidate المراجع `3b1b24b…` وسجل القبول اللاحق `424c6fd…` | لا merge أو VERIFIED على `main`; يحفظ سجل القبول |
| S02 | `01-STAGES.md` و`00-S02-TASK-DRAFT-2026-10-27.md` | `DRAFT_FOR_CHATGPT_REVIEW`؛ لا تنفيذ | مراجعة ChatGPT ثم اعتماد المالك للأمر النهائي؛ لا ZAI |
| S03–S18 | `01-STAGES.md` | `PLANNED_REVIEW` | لا أمر تنفيذ أو انتقال تلقائي |
| المال/البيانات | Schema 38 / Export 30 والعقود المالية | لم تتغير | أي تغيير لاحق يحتاج مرحلة وعقدًا مستقلين |
