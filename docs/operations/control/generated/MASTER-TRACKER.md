# Master Tracker

> مولّد آليًا. عدّل ملفات `items/*.json` فقط.

BLOCKED: 3 · IN_REVIEW: 1 · READY: 13 · BACKLOG: 2 · DEFERRED: 2 · VERIFIED: 7

| ID | الحالة | الأولوية | المرحلة | العنوان | الاعتماديات |
|---|---|---|---|---|---|
| DEVICE-001 | BLOCKED | P1 | stage-6 | QA على أجهزة فعلية وWebKit وPWA | UX-001, REL-001 |
| LEGAL-001 | BLOCKED | P1 | stage-7 | مراجعة أردنية مالية وقانونية | FIN-007 |
| PILOT-001 | BLOCKED | P1 | stage-8 | قرار بدء Pilot | AUDIT-001 |
| CTRL-001 | IN_REVIEW | P1 | stage-0 | اعتماد Operations Control v2 | — |
| FIN-001 | READY | P1 | stage-3 | تسجيل اقتراض داخل المشروع | CTRL-001 |
| FIN-003 | READY | P1 | stage-3 | مقارنة الفترات وجسر الربح إلى الكاش | FIN-001 |
| FIN-004 | READY | P1 | stage-3 | حد السحب الآمن للمالك | FIN-003, FIN-005 |
| FIN-005 | READY | P1 | stage-3 | توقع الكاش والتصريحات المتوقعة | OPS-001 |
| OPS-001 | READY | P1 | stage-2 | المواعيد والاستحقاقات وتقادم الذمم | CTRL-001 |
| REL-001 | READY | P1 | stage-6 | اختبارات الصمود والفشل | CLEAN-001 |
| CLEAN-001 | READY | P2 | stage-4 | تنظيف الأسطح الجزئية والميتة | FIN-007, OPS-004 |
| FIN-002 | READY | P2 | stage-3 | ميزانيات وأهداف بسيطة | CTRL-001 |
| FIN-006 | READY | P2 | stage-3 | ربحية المنتج بمعرف كتالوج ثابت | OPS-004 |
| FIN-007 | READY | P2 | stage-3 | مراجعة فترة مرنة | FIN-003 |
| OPS-002 | READY | P2 | stage-2 | تنبيهات انخفاض المخزون | CTRL-001 |
| OPS-003 | READY | P2 | stage-2 | المصروفات المتكررة المحلية | CTRL-001 |
| OPS-004 | READY | P2 | stage-2 | تكامل القوالب والإنتاجية والوقت الفعلي | CTRL-001 |
| AUDIT-001 | BACKLOG | P1 | stage-7 | تدقيق مستقل نهائي قبل الـPilot | UAT-001 |
| UAT-001 | BACKLOG | P1 | stage-7 | قبول داخلي ببيانات Demo كاملة | DEVICE-001, LEGAL-001 |
| UX-001 | DEFERRED | P1 | stage-5 | إعادة تصميم UI وUX جذرية | CLEAN-001 |
| FIN-008 | DEFERRED | P2 | stage-3 | تحقق الإهلاك بعد مرور الزمن | — |
| HIST-001 | VERIFIED | P1 | completed | الموجة الأولى: إصلاحات حرجة محددة | — |
| HIST-002 | VERIFIED | P1 | completed | الموجة الثانية: الأساسات المالية والبيانية | — |
| HIST-007 | VERIFIED | P1 | completed | الموجة 4.4: الجودة النظامية والقبول المحلي | — |
| HIST-003 | VERIFIED | P2 | completed | الموجة الثالثة: العقود والملكية التقنية | — |
| HIST-004 | VERIFIED | P2 | completed | الموجة 4.1: مخطط تجربة المنتج | — |
| HIST-005 | VERIFIED | P2 | completed | الموجة 4.2: الهيكل والتنقل والتسمية | — |
| HIST-006 | VERIFIED | P2 | completed | الموجة 4.3: إعادة بناء أسطح المنتج | — |
