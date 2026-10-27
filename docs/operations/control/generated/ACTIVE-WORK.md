# Active Work

> مولّد آليًا من Workstream claims؛ يشمل المراجعة المطلوبة حتى لا يختفي Claim قديم.

| ID | الحالة | الفرع | PR | البنود | الخطوة التالية |
|---|---|---|---|---|---|
| WS-225 | REVIEW_REQUIRED | `components/integration-20261018` | 378 | DOC-009 | إرسال عقد UNIT-002-ZAI-AUTHORIZATION-REVIEW-PROMPT من GitHub؛ إبقاء Workstream REVIEW_REQUIRED؛ لا Claim تنفيذ ولا تعديل تطبيق حتى يقبل المالك decision payloads وعقد التنفيذ. |
| WS-226 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-010 | S01 مقبولة على فرع التكامل ومحفوظة REVIEW_REQUIRED؛ لا إجراء إضافي على WS-226 حتى بوابة الدمج النهائية بعد S18. S02 تعمل مستقلًا في WS-227 على نفس فرع التكامل. |
| WS-227 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-011 | قرار المالك على مانع التحقق البعيد الأخير: مكتشف طرف ثالث جديد GHSA-gcqx-w48m-w2h4 (low، dev-only عبر vite-plugin-pwa→workbox-build→@rollup/plugin-node-resolve→deepmerge 4.3.1، لا نسخة مرقّعة) يحجب خطوة تدقيق الاعتماديات في CI — إما صف OWNER_ACCEPTED في docs/quality/security-exception-register.json (سابقة braces الموثقة) أو انتظار نسخة مرقّعة؛ بعدها commit موسوم S02 وإعادة التحقق المزدوج على الرأس الكامل. بالتوازي: مراجعة Manus للمرشح الكودي 328d986e (Cloudflare Pages أخضر عليه؛ CI أخضر حتى الأسطح قبل إعادة الإرساء). لا merge ولا cleanup ولا S03. |
