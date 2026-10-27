# Active Work

> مولّد آليًا من Workstream claims؛ يشمل المراجعة المطلوبة حتى لا يختفي Claim قديم.

| ID | الحالة | الفرع | PR | البنود | الخطوة التالية |
|---|---|---|---|---|---|
| WS-225 | REVIEW_REQUIRED | `components/integration-20261018` | 378 | DOC-009 | إرسال عقد UNIT-002-ZAI-AUTHORIZATION-REVIEW-PROMPT من GitHub؛ إبقاء Workstream REVIEW_REQUIRED؛ لا Claim تنفيذ ولا تعديل تطبيق حتى يقبل المالك decision payloads وعقد التنفيذ. |
| WS-226 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-010 | S01 مقبولة على فرع التكامل ومحفوظة REVIEW_REQUIRED؛ لا إجراء إضافي على WS-226 حتى بوابة الدمج النهائية بعد S18. S02 تعمل مستقلًا في WS-227 على نفس فرع التكامل. |
| WS-227 | CLAIMED | `components/integration-20261027` | 383 | DOC-011 | ZAI يقرأ أمر S02 READY من GitHub، يثبت S02_BASE_SHA على الرأس الحي، ثم ينفذ S02-A إلى S02-D فقط ويتوقف عند تسليم المراجعة؛ Manus يراجع candidate نفسه. |
