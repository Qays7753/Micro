# Master Tracker

> مولّد آليًا من JSON. عدّل ملفات `items/*.json` و`workstreams/**/*.json` فقط.

BLOCKED: 3 · IN_PROGRESS: 1 · READY: 1 · BACKLOG: 2 · REVIEW_REQUIRED: 1 · DEFERRED: 21 · VERIFIED: 35

| ID | الحالة | التصنيف | Gate | الأولوية | المرحلة | العنوان | المالك | الطبقات | الاعتماديات |
|---|---|---|---|---|---|---|---|---|---|
| DEVICE-001 | BLOCKED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P1 | stage-7 | QA على أجهزة فعلية وWebKit وPWA | Product owner / Manus coordination | device, accessibility, pwa | UX-001, REL-001 |
| LEGAL-001 | BLOCKED | RELEASE_GATE | NOT_APPLICABLE | P1 | stage-8 | مراجعة أردنية مالية وقانونية | Product owner / Manus coordination | legal, product-scope | FIN-007 |
| PILOT-001 | BLOCKED | RELEASE_GATE | RELEASE_GATE | P1 | stage-10 | قرار بدء Pilot | Product owner / Manus coordination | release, pilot | CTRL-001, CTRL-002, G-001, G-002, G-003, G-004, G-005, G-006, OPS-001, OPS-002, OPS-003, OPS-004, OPS-005, OPS-006, OPS-007, OPS-008, OPS-009, FIN-001, FIN-002, FIN-003, FIN-004, FIN-005, FIN-006, FIN-007, FIN-008, CLEAN-001, UX-001, REL-001, DEVICE-001, LEGAL-001, UAT-001, AUDIT-001, HARD-009, HARD-010, HARD-011 |
| CLEAN-001 | IN_PROGRESS | FIX_BEFORE_PILOT | NOT_APPLICABLE | P2 | stage-4 | تنظيف الأسطح الجزئية والميتة | Product owner / Manus coordination | cross-layer, presentation | FIN-007, OPS-004 |
| REL-001 | READY | FIX_BEFORE_PILOT | NOT_APPLICABLE | P1 | stage-6 | اختبارات الصمود والفشل | Product owner / Manus coordination | storage, transfer, resilience | CLEAN-001 |
| AUDIT-001 | BACKLOG | RELEASE_GATE | NOT_APPLICABLE | P1 | stage-9 | تدقيق مستقل نهائي قبل الـPilot | Product owner / Manus coordination | uat, audit, cross-layer | UAT-001 |
| UAT-001 | BACKLOG | RELEASE_GATE | NOT_APPLICABLE | P1 | stage-9 | قبول داخلي ببيانات Demo كاملة | Product owner / Manus coordination | uat, audit, cross-layer | DEVICE-001, LEGAL-001 |
| GOV-001 | REVIEW_REQUIRED | GOVERNANCE | NOT_APPLICABLE | P1 | governance | مصالحة G10-A مع تعارض عقد C1 | Product owner / Manus coordination | governance, contracts | — |
| SCOPE-001 | DEFERRED | FUTURE_SCOPE | OUT_OF_SCOPE | P1 | future-scope | بوابة POS وCRM وWhatsApp والمزامنة وAuth والصلاحيات وCloud | Product owner / Manus coordination | future-scope | — |
| UX-001 | DEFERRED | FIX_BEFORE_PILOT | DEPENDENCY_GATE_REQUIRED_BEFORE_PILOT | P1 | stage-5 | إعادة تصميم UI وUX جذرية | Product owner / Manus coordination | ui/ux, presentation | CLEAN-001 |
| BE-001 | DEFERRED | HISTORICAL | DUPLICATE_HISTORICAL | P2 | build-after-evidence | مصاريف متكررة محلية | Product owner / Manus coordination | future-capability | — |
| BE-002 | DEFERRED | HISTORICAL | DUPLICATE_HISTORICAL | P2 | build-after-evidence | ميزانيات وأهداف بسيطة | Product owner / Manus coordination | future-capability | — |
| BE-003 | DEFERRED | HISTORICAL | DUPLICATE_HISTORICAL | P2 | build-after-evidence | ربحية المنتج عبر الفترات بمعرف كتالوج ثابت | Product owner / Manus coordination | future-capability | — |
| BE-004 | DEFERRED | PILOT_VALIDATION | PILOT_EVIDENCE_REQUIRED | P2 | build-after-evidence | إغلاق فترة رسمي | Product owner / Manus coordination | future-capability | — |
| BE-005 | DEFERRED | PILOT_VALIDATION | PILOT_EVIDENCE_REQUIRED | P2 | build-after-evidence | تقادم الديون بشرائح 30/60/90 | Product owner / Manus coordination | future-capability | — |
| SCOPE-002 | DEFERRED | FUTURE_SCOPE | OUT_OF_SCOPE | P2 | future-scope | الموارد وقدرة المواد والتوسع التشغيلي | Product owner / Manus coordination | future-scope | — |
| UX-002 | DEFERRED | FUTURE_SCOPE | OUT_OF_SCOPE | P2 | post-pilot-gate | Backlog الموجة الرابعة في عقد الملكية | Product owner / Manus coordination | post-pilot | — |
| V-001 | DEFERRED | PILOT_VALIDATION | PILOT_EVIDENCE_REQUIRED | P2 | pilot-validation | V-01 — التقاط تواريخ استحقاق المشتريات | Product owner / Manus coordination | pilot-validation | — |
| V-002 | DEFERRED | PILOT_VALIDATION | PILOT_EVIDENCE_REQUIRED | P2 | pilot-validation | V-02 — متوقعات الكاش القصيرة | Product owner / Manus coordination | pilot-validation | — |
| V-003 | DEFERRED | PILOT_VALIDATION | PILOT_EVIDENCE_REQUIRED | P2 | pilot-validation | V-03 — أجندة القادم المجمعة بالتاريخ | Product owner / Manus coordination | pilot-validation | — |
| V-004 | DEFERRED | PILOT_VALIDATION | PILOT_EVIDENCE_REQUIRED | P2 | pilot-validation | V-04 — عرض التغطية عند قرار السحب | Product owner / Manus coordination | pilot-validation | — |
| V-005 | DEFERRED | PILOT_VALIDATION | PILOT_EVIDENCE_REQUIRED | P2 | pilot-validation | V-05 — مقارنة فترتين بسيطة | Product owner / Manus coordination | pilot-validation | — |
| V-006 | DEFERRED | PILOT_VALIDATION | PILOT_EVIDENCE_REQUIRED | P2 | pilot-validation | V-06 — جسر ربح إلى كاش رقمي | Product owner / Manus coordination | pilot-validation | — |
| V-007 | DEFERRED | PILOT_VALIDATION | PILOT_EVIDENCE_REQUIRED | P2 | pilot-validation | V-07 — تنبيه انخفاض المواد | Product owner / Manus coordination | pilot-validation | — |
| V-008 | DEFERRED | PILOT_VALIDATION | PILOT_EVIDENCE_REQUIRED | P2 | pilot-validation | V-08 — مصروف اليوم على الرئيسية | Product owner / Manus coordination | pilot-validation | — |
| V-009 | DEFERRED | PILOT_VALIDATION | PILOT_EVIDENCE_REQUIRED | P2 | pilot-validation | V-09 — رقم السحب الآمن الموحد | Product owner / Manus coordination | pilot-validation | — |
| V-010 | DEFERRED | PILOT_VALIDATION | PILOT_EVIDENCE_REQUIRED | P2 | pilot-validation | V-10 — كثافة صفحة المالية | Product owner / Manus coordination | pilot-validation | — |
| V-011 | DEFERRED | PILOT_VALIDATION | PILOT_EVIDENCE_REQUIRED | P2 | pilot-validation | V-11 — فهم نموذج التوزيع الصريح للكاش | Product owner / Manus coordination | pilot-validation | — |
| V-012 | DEFERRED | PILOT_VALIDATION | PILOT_EVIDENCE_REQUIRED | P2 | pilot-validation | V-12 — تسجيل الإهلاك بعد شهر استخدام | Product owner / Manus coordination | pilot-validation | — |
| CTRL-001 | VERIFIED | GOVERNANCE | NOT_APPLICABLE | P1 | stage-0 | اعتماد Operations Control v2 | Product owner / Manus coordination | governance, documentation | — |
| CTRL-002 | VERIFIED | GOVERNANCE | EVIDENCE_RECONCILIATION_REQUIRED | P1 | stage-0 | مصالحة القدرات والتقارير ومصادر الحقيقة | Product owner / Manus coordination | governance, documentation | — |
| FIN-001 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P1 | stage-3 | تسجيل اقتراض داخل المشروع | Product owner / Manus coordination | Layer 3, domain, application, presentation | CTRL-001 |
| FIN-003 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P1 | stage-3 | مقارنة الفترات وجسر الربح إلى الكاش | Product owner / Manus coordination | Layer 3, domain, application, presentation | FIN-001 |
| FIN-004 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P1 | stage-3 | حد السحب الآمن للمالك | Product owner / Manus coordination | Layer 3, domain, application, presentation | FIN-003, FIN-005 |
| FIN-005 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P1 | stage-3 | توقع الكاش والتصريحات المتوقعة | Product owner / Manus coordination | Layer 3, domain, application, presentation | OPS-001 |
| G-001 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P1 | audit-2026-09-19 | فخ الاستهلاك المزدوج عند التسليم | Product owner / Manus coordination | cross-layer | — |
| HARD-009 | VERIFIED | HARDENING | MAIN_VERIFIED | P1 | hardening-verification | إثبات إغلاق مجموعة المعالجة 9 | Product owner / Manus coordination | governance, verification | — |
| HARD-010 | VERIFIED | HARDENING | MAIN_VERIFIED | P1 | hardening-verification | إثبات إغلاق مجموعة المعالجة 10 | Product owner / Manus coordination | governance, verification | — |
| HARD-011 | VERIFIED | HARDENING | MAIN_VERIFIED | P1 | hardening-verification | إثبات إغلاق مجموعة المعالجة 11 | Product owner / Manus coordination | governance, verification | — |
| HIST-001 | VERIFIED | HISTORICAL | NOT_APPLICABLE | P1 | completed | الموجة الأولى: إصلاحات حرجة محددة | Product owner / Manus coordination | historical-evidence | — |
| HIST-002 | VERIFIED | HISTORICAL | NOT_APPLICABLE | P1 | completed | الموجة الثانية: الأساسات المالية والبيانية | Product owner / Manus coordination | historical-evidence | — |
| HIST-007 | VERIFIED | HISTORICAL | NOT_APPLICABLE | P1 | completed | الموجة 4.4: الجودة النظامية والقبول المحلي | Product owner / Manus coordination | historical-evidence | — |
| OPS-001 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P1 | stage-2 | المواعيد والاستحقاقات وتقادم الذمم الأساسي | Product owner / Manus coordination | Layer 2, application, presentation | CTRL-001 |
| OPS-005 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P1 | stage-2 | سطح قادم موحد للدفعات والتحصيلات والطلبات والالتزامات | Product owner / Manus coordination | Layer 2, application, presentation | CTRL-001, OPS-001 |
| OPS-009 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P1 | stage-2 | حماية Cost Snapshot وإعلان النتيجة النهائية أو التقديرية | Product owner / Manus coordination | Layer 2, application, presentation | CTRL-001, OPS-007 |
| FIN-002 | VERIFIED | FIX_BEFORE_PILOT | DEPENDENCY_GATE_REQUIRED_BEFORE_PILOT | P2 | stage-3 | ميزانيات وأهداف بسيطة | Product owner / Manus coordination | Layer 3, domain, application, presentation | CTRL-001 |
| FIN-006 | VERIFIED | FIX_BEFORE_PILOT | DEPENDENCY_GATE_REQUIRED_BEFORE_PILOT | P2 | stage-3 | ربحية المنتج بمعرف كتالوج ثابت | Product owner / Manus coordination | Layer 3, domain, application, presentation | OPS-004 |
| FIN-007 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P2 | stage-3 | مراجعة فترة مرنة | Product owner / Manus coordination | Layer 3, domain, application, presentation | FIN-003 |
| FIN-008 | VERIFIED | FIX_BEFORE_PILOT | DEPENDENCY_GATE_REQUIRED_BEFORE_PILOT | P2 | stage-3 | تحقق الإهلاك بعد مرور الزمن | Product owner / Manus coordination | Layer 3, domain, application, presentation | — |
| G-002 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P2 | audit-2026-09-19 | ذرية تخصيص دفعة المورد للمحفظة | Product owner / Manus coordination | cross-layer | — |
| G-003 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P2 | audit-2026-09-19 | حرس القراءة القديمة عند حفظ الطلب | Product owner / Manus coordination | cross-layer | — |
| G-004 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P2 | audit-2026-09-19 | مطابقة تعطيل القدرات للوعد المرئي | Product owner / Manus coordination | cross-layer | — |
| G-005 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P2 | audit-2026-09-19 | عزل فشل قراءات صفحة المالية | Product owner / Manus coordination | cross-layer | — |
| HIST-003 | VERIFIED | HISTORICAL | NOT_APPLICABLE | P2 | completed | الموجة الثالثة: العقود والملكية التقنية | Product owner / Manus coordination | historical-evidence | — |
| HIST-004 | VERIFIED | HISTORICAL | NOT_APPLICABLE | P2 | completed | الموجة 4.1: مخطط تجربة المنتج | Product owner / Manus coordination | historical-evidence | — |
| HIST-005 | VERIFIED | HISTORICAL | NOT_APPLICABLE | P2 | completed | الموجة 4.2: الهيكل والتنقل والتسمية | Product owner / Manus coordination | historical-evidence | — |
| HIST-006 | VERIFIED | HISTORICAL | NOT_APPLICABLE | P2 | completed | الموجة 4.3: إعادة بناء أسطح المنتج | Product owner / Manus coordination | historical-evidence | — |
| OPS-002 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P2 | stage-2 | تنبيهات انخفاض المخزون | Product owner / Manus coordination | Layer 2, application, presentation | CTRL-001 |
| OPS-003 | VERIFIED | FIX_BEFORE_PILOT | DEPENDENCY_GATE_REQUIRED_BEFORE_PILOT | P2 | stage-2 | المصروفات المتكررة المحلية | Product owner / Manus coordination | Layer 2, application, presentation | CTRL-001 |
| OPS-004 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P2 | stage-2 | ربط القوالب بالتكلفة المخططة دون استهلاك فعلي | Product owner / Manus coordination | Layer 2, application, presentation | CTRL-001 |
| OPS-006 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P2 | stage-2 | تقادم ديون مبسط قبل الشرائح المتقدمة | Product owner / Manus coordination | Layer 2, application, presentation | CTRL-001, OPS-001 |
| OPS-007 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P2 | stage-2 | مقارنة التكلفة المخططة بالمستهلكة والفرق | Product owner / Manus coordination | Layer 2, application, presentation | CTRL-001, OPS-004 |
| OPS-008 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P2 | stage-2 | الوقت الفعلي مقابل المخطط | Product owner / Manus coordination | Layer 2, application, presentation | CTRL-001, OPS-004 |
| G-006 | VERIFIED | FIX_BEFORE_PILOT | NOT_APPLICABLE | P3 | audit-2026-09-19 | توحيد حرس السحب بين مساري مال المالك | Product owner / Manus coordination | cross-layer | — |
