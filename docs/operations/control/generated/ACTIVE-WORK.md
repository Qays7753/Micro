# Active Work

> مولّد آليًا من Workstream claims؛ يشمل المراجعة المطلوبة حتى لا يختفي Claim قديم.

| ID | الحالة | الفرع | PR | البنود | الخطوة التالية |
|---|---|---|---|---|---|
| WS-225 | REVIEW_REQUIRED | `components/integration-20261018` | 378 | DOC-009 | إرسال عقد UNIT-002-ZAI-AUTHORIZATION-REVIEW-PROMPT من GitHub؛ إبقاء Workstream REVIEW_REQUIRED؛ لا Claim تنفيذ ولا تعديل تطبيق حتى يقبل المالك decision payloads وعقد التنفيذ. |
| WS-226 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-010 | S01 مقبولة على فرع التكامل ومحفوظة REVIEW_REQUIRED؛ لا إجراء إضافي على WS-226 حتى بوابة الدمج النهائية بعد S18. S02 تعمل مستقلًا في WS-227 على نفس فرع التكامل. |
| WS-227 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-011 | إذن انتقال المالك من S02 إلى S03 مسجل (2026-10-28) بناء على إعادة تحقق المرحلة A عند 015c2d6c؛ S02 تبقى REVIEW_REQUIRED حتى مراجعة Manus المستقلة وقبول المالك؛ التنفيذ الانتقالي في WS-228؛ لا merge ولا cleanup. |
| WS-228 | IN_REVIEW | `components/integration-20261027` | 383 | DOC-012 | اكتمل تسليم S03 (النتيجة: 08-S03-RESULT-2026-10-28.md؛ المرشح النهائي 9de4f0a5؛ PR #383 محدّث)؛ المطلوب الآن: مراجعة Manus المستقلة لـS02+S03 وقبول المالك الصريح للمرحلة قبل أي دمج؛ لا merge ولا cleanup ولا S04. |
