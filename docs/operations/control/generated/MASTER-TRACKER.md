# Master Tracker

> مولّد آليًا من JSON. عدّل ملفات `items/*.json` و`workstreams/**/*.json` فقط.

BLOCKED: 3 · IN_REVIEW: 1 · READY: 10 · BACKLOG: 2 · REVIEW_REQUIRED: 10 · DEFERRED: 25 · VERIFIED: 7

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
| FIN-007 | READY | P2 | stage-3 | مراجعة فترة مرنة | FIN-003 |
| OPS-002 | READY | P2 | stage-2 | تنبيهات انخفاض المخزون | CTRL-001 |
| OPS-004 | READY | P2 | stage-2 | تكامل القوالب والإنتاجية والوقت الفعلي | CTRL-001 |
| AUDIT-001 | BACKLOG | P1 | stage-7 | تدقيق مستقل نهائي قبل الـPilot | UAT-001 |
| UAT-001 | BACKLOG | P1 | stage-7 | قبول داخلي ببيانات Demo كاملة | DEVICE-001, LEGAL-001 |
| G-001 | REVIEW_REQUIRED | P1 | audit-2026-09-19 | فخ الاستهلاك المزدوج عند التسليم | — |
| GOV-001 | REVIEW_REQUIRED | P1 | governance | مصالحة G10-A مع تعارض عقد C1 | — |
| HARD-009 | REVIEW_REQUIRED | P1 | hardening-verification | إثبات إغلاق مجموعة المعالجة 9 | — |
| HARD-010 | REVIEW_REQUIRED | P1 | hardening-verification | إثبات إغلاق مجموعة المعالجة 10 | — |
| HARD-011 | REVIEW_REQUIRED | P1 | hardening-verification | إثبات إغلاق مجموعة المعالجة 11 | — |
| G-002 | REVIEW_REQUIRED | P2 | audit-2026-09-19 | ذرية تخصيص دفعة المورد للمحفظة | — |
| G-003 | REVIEW_REQUIRED | P2 | audit-2026-09-19 | حرس القراءة القديمة عند حفظ الطلب | — |
| G-004 | REVIEW_REQUIRED | P2 | audit-2026-09-19 | مطابقة تعطيل القدرات للوعد المرئي | — |
| G-005 | REVIEW_REQUIRED | P2 | audit-2026-09-19 | عزل فشل قراءات صفحة المالية | — |
| G-006 | REVIEW_REQUIRED | P3 | audit-2026-09-19 | توحيد حرس السحب بين مساري مال المالك | — |
| SCOPE-001 | DEFERRED | P1 | future-scope | بوابة POS وCRM وWhatsApp والمزامنة وAuth والصلاحيات وCloud | — |
| UX-001 | DEFERRED | P1 | stage-5 | إعادة تصميم UI وUX جذرية | CLEAN-001 |
| BE-001 | DEFERRED | P2 | build-after-evidence | مصاريف متكررة محلية | — |
| BE-002 | DEFERRED | P2 | build-after-evidence | ميزانيات وأهداف بسيطة | — |
| BE-003 | DEFERRED | P2 | build-after-evidence | ربحية المنتج عبر الفترات بمعرف كتالوج ثابت | — |
| BE-004 | DEFERRED | P2 | build-after-evidence | إغلاق فترة رسمي | — |
| BE-005 | DEFERRED | P2 | build-after-evidence | تقادم الديون بشرائح 30/60/90 | — |
| FIN-002 | DEFERRED | P2 | stage-3 | ميزانيات وأهداف بسيطة | CTRL-001 |
| FIN-006 | DEFERRED | P2 | stage-3 | ربحية المنتج بمعرف كتالوج ثابت | OPS-004 |
| FIN-008 | DEFERRED | P2 | stage-3 | تحقق الإهلاك بعد مرور الزمن | — |
| OPS-003 | DEFERRED | P2 | stage-2 | المصروفات المتكررة المحلية | CTRL-001 |
| SCOPE-002 | DEFERRED | P2 | future-scope | الموارد وقدرة المواد والتوسع التشغيلي | — |
| UX-002 | DEFERRED | P2 | post-pilot-gate | Backlog الموجة الرابعة في عقد الملكية | — |
| V-001 | DEFERRED | P2 | pilot-validation | V-01 — التقاط تواريخ استحقاق المشتريات | — |
| V-002 | DEFERRED | P2 | pilot-validation | V-02 — متوقعات الكاش القصيرة | — |
| V-003 | DEFERRED | P2 | pilot-validation | V-03 — أجندة القادم المجمعة بالتاريخ | — |
| V-004 | DEFERRED | P2 | pilot-validation | V-04 — عرض التغطية عند قرار السحب | — |
| V-005 | DEFERRED | P2 | pilot-validation | V-05 — مقارنة فترتين بسيطة | — |
| V-006 | DEFERRED | P2 | pilot-validation | V-06 — جسر ربح إلى كاش رقمي | — |
| V-007 | DEFERRED | P2 | pilot-validation | V-07 — تنبيه انخفاض المواد | — |
| V-008 | DEFERRED | P2 | pilot-validation | V-08 — مصروف اليوم على الرئيسية | — |
| V-009 | DEFERRED | P2 | pilot-validation | V-09 — رقم السحب الآمن الموحد | — |
| V-010 | DEFERRED | P2 | pilot-validation | V-10 — كثافة صفحة المالية | — |
| V-011 | DEFERRED | P2 | pilot-validation | V-11 — فهم نموذج التوزيع الصريح للكاش | — |
| V-012 | DEFERRED | P2 | pilot-validation | V-12 — تسجيل الإهلاك بعد شهر استخدام | — |
| HIST-001 | VERIFIED | P1 | completed | الموجة الأولى: إصلاحات حرجة محددة | — |
| HIST-002 | VERIFIED | P1 | completed | الموجة الثانية: الأساسات المالية والبيانية | — |
| HIST-007 | VERIFIED | P1 | completed | الموجة 4.4: الجودة النظامية والقبول المحلي | — |
| HIST-003 | VERIFIED | P2 | completed | الموجة الثالثة: العقود والملكية التقنية | — |
| HIST-004 | VERIFIED | P2 | completed | الموجة 4.1: مخطط تجربة المنتج | — |
| HIST-005 | VERIFIED | P2 | completed | الموجة 4.2: الهيكل والتنقل والتسمية | — |
| HIST-006 | VERIFIED | P2 | completed | الموجة 4.3: إعادة بناء أسطح المنتج | — |
