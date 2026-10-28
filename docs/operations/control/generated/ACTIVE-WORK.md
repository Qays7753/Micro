# Active Work

> مولّد آليًا من Workstream claims؛ يشمل المراجعة المطلوبة حتى لا يختفي Claim قديم.

| ID | الحالة | الفرع | PR | البنود | الخطوة التالية |
|---|---|---|---|---|---|
| WS-225 | REVIEW_REQUIRED | `components/integration-20261018` | 378 | DOC-009 | إرسال عقد UNIT-002-ZAI-AUTHORIZATION-REVIEW-PROMPT من GitHub؛ إبقاء Workstream REVIEW_REQUIRED؛ لا Claim تنفيذ ولا تعديل تطبيق حتى يقبل المالك decision payloads وعقد التنفيذ. |
| WS-226 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-010 | S01 مقبولة على فرع التكامل ومحفوظة REVIEW_REQUIRED؛ لا إجراء إضافي على WS-226 حتى بوابة الدمج النهائية بعد S18. S02 تعمل مستقلًا في WS-227 على نفس فرع التكامل. |
| WS-227 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-011 | أُعيد التحقق من S02 (ZAI، 2026-10-28، Phase A من أمر S03): لا مانع كودي، والسجلات صُححت، وسلسلة pnpm check خضراء على الرأس الحي، والبوابات البعيدة ناجحة عبر 1d9a8378 (ودليل الرأس النهائي في تعليق PR). التالي مراجعة Manus المستقلة ثم قبول المالك؛ لا merge ولا cleanup ولا S03. |
