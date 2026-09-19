# Handoffs

لا تنشئ ملخص محادثة حرًا هنا. الاستلام يتكون من:

1. Workstream JSON محدث ومطابق لـ`schemas/workstream.schema.json`.
2. Item JSON لكل نتيجة تغيرت، مع `status_history` و`next_action`.
3. وصف PR وفق القالب.
4. تحديث `current-state.md` فقط عند تغير الحقيقة المندمجة.

عند توقف Agent قبل PR، يحدّث `next_action` و`notes` ووقت التحديث، ويترك الحالة `BLOCKED` مع `blocked_reason` أو `IN_PROGRESS` بصدق. عند التأجيل، يسجل `deferred_reason` وبوابة إعادة الفتح. لا يستخدم `VERIFIED` لتسليم عمل محلي.

قبل Claim جديد، شغّل Validator وتحقق من عدم تداخل `areas` أو `contracts` المباشر أو الهرمي، ومن عدم حجز Item في Workstream نشط آخر.
