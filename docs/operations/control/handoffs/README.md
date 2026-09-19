# Handoffs

لا تنشئ ملخص محادثة حرًا هنا. الاستلام يتكون من:

1. Workstream JSON محدث.
2. Item JSON لكل نتيجة تغيرت.
3. وصف PR وفق القالب.
4. تحديث `current-state.md` فقط عند تغير الحقيقة المندمجة.

عند توقف Agent قبل PR، يحدّث `next_action` و`notes` ووقت التحديث، ويترك الحالة `BLOCKED` أو `IN_PROGRESS` بصدق. لا يستخدم `VERIFIED` لتسليم عمل محلي.

