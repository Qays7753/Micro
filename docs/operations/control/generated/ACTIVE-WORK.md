# Active Work

> مولّد آليًا من Workstream claims؛ يشمل المراجعة المطلوبة حتى لا يختفي Claim قديم.

| ID | الحالة | الفرع | PR | البنود | الخطوة التالية |
|---|---|---|---|---|---|
| WS-225 | REVIEW_REQUIRED | `components/integration-20261018` | 378 | DOC-009 | إرسال عقد UNIT-002-ZAI-AUTHORIZATION-REVIEW-PROMPT من GitHub؛ إبقاء Workstream REVIEW_REQUIRED؛ لا Claim تنفيذ ولا تعديل تطبيق حتى يقبل المالك decision payloads وعقد التنفيذ. |
| WS-226 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-010 | S01 مقبولة على فرع التكامل ومحفوظة REVIEW_REQUIRED؛ لا إجراء إضافي على WS-226 حتى بوابة الدمج النهائية بعد S18. S02 تعمل مستقلًا في WS-227 على نفس فرع التكامل. |
| WS-227 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-011 | إذن انتقال المالك من S02 إلى S03 مسجل (2026-10-28) بناء على إعادة تحقق المرحلة A عند 015c2d6c؛ S02 تبقى REVIEW_REQUIRED حتى مراجعة Manus المستقلة وقبول المالك؛ التنفيذ الانتقالي في WS-228؛ لا merge ولا cleanup. |
| WS-228 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-012 | تسليم S03 قائم (النتيجة: 08-S03-RESULT-2026-10-28.md؛ المرشح النهائي 9de4f0a5)؛ علاج عيب التزامن المؤكد يُنفذ في مسار DOC-013/WS-229 المأذون بنفس الأمر؛ يبقى المطلوب: مراجعة Manus المستقلة وقبول المالك الصريح قبل أي دمج. |
| WS-229 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-013 | مراجعة Manus المستقلة وقبول المالك لS04 على المرشح النهائي 9d7d2aee؛ التحقق البعيد مسجل في تعليق PR #383. S05 أُذن بقرار مالك مستقل (00-S05-EXECUTION-PROMPT-2026-10-29.md في 1663f245) وينفذ على الفرع/PR نفسيهما مع الأمرين المحوّلين CF-001/CF-002؛ لا دمج ولا كتابة main قبل قرار المالك. |
| WS-230 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-014 | مراجعة Manus المستقلة وقبول المالك لS05 على المرشح النهائي bee05336 (يتضمن الآن إصلاحَي العقد S05-MR-001/S05-MR-002 المسلَّمين أعلى الفرع نفسه بcommits موسومة مستقلة — ما زالا رهن المراجعة المستقلة كجزء من ملف S05)؛ لا دمج ولا كتابة main. |
| WS-231 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-015 | مراجعة Manus المستقلة وقبول المالك على PR #383 (المرشح الكودي 0a728d14 وسجلات التوثيق فوقه وملحق S06-MR-001 11a-S06-ADDENDUM-2026-10-30.md لإصلاح 18a7128a)؛ لا دمج ولا كتابة main. |
| WS-232 | REVIEW_REQUIRED | `components/integration-20261027` | 383 | DOC-016 | مراجعة Manus المستقلة وقرار المالك على PR #383 (سجل S07 الكامل مع إصلاح S07-MR-001 في 12-S07-RESULT §1-ب/§4-ب)؛ لا دمج ولا كتابة main. |
| WS-233 | IN_PROGRESS | `components/integration-20261027` | 383 | DOC-017 | تنفيذ S08 المتصل (UNIT-034) على components/integration-20261027 / PR #383؛ لا كتابة main ولا merge؛ S07/S08 رهن المراجعة المستقلة وقبول المالك. |
