# كتالوج وثائق Micro — السلطة والاستشهاد

**حالة الكتالوج:** المرجع الوحيد لتصنيف سلطة الوثائق (أي ملف سلطوي له صف هنا، ويحرس ذلك `scripts/check-doc-index-coverage.mjs`).

> **مسار القراءة ليس هنا.** جدول التوجيه الوحيد هو `AGENTS.md` §2 (النواة + حزم السياق التسع). هذا الكتالوج للبحث والاستشهاد؛ الصفوف لا تعني ترتيب قراءة، والحالة تصنيف سلطة لا أولوية تحميل. (تحديث مؤرخ 2026-10-01 — WS-204؛ كان العنوان «اقرأ هذا أولًا» وقوائم قراءة موازية.)

## كتالوج الملفات السلطوية

| الترتيب | الملف | الحالة | متى يُقرأ؟ |
|---:|---|---|---|
| 0 | `docs/operations/current-state.md` | CURRENT / LIVE STATUS | الحالة المندمجة على `main`، وبوابة التوقف، والخطوة التالية المسموحة لأي Agent جديد |
| 0L | `docs/operations/current-state-log.md` | HISTORICAL LOG / APPEND-ONLY — ليس مرجعًا لل حالة الحية | سجل الشرائح والموجات §9–§90 (أُنشئ بفصل WS-204 في 2026-10-01)؛ يُقرأ بمسار صريح فقط |
| 0D | `docs/operations/control/README.md` و`generated/AGENT-BRIEF.md` | CURRENT / COORDINATION | سجل البنود والـWorkstreams ومنع التداخل وViews المولدة؛ لا يغيّر سلطة العقود أو current-state |
| 0A | `docs/operations/agent-handoff-protocol-v1.md` | CURRENT / OPERATIONAL | بروتوكول الاستلام والتنفيذ والتسليم بين الوكلاء |
| 0B | `docs/operations/micro-thinking-charter-v1.md` | CURRENT / THINKING GATE | هدف Micro وطريقة التفكير وأسئلة النقد وبطاقة الفهم قبل أي كود |
| 0C | `AGENTS.md` | CURRENT / ENTRY POINT | نقطة الدخول الأولى وترتيب القراءة والقواعد غير القابلة للكسر |
| 1 | `docs/01-product-and-technical-blueprint.md` | CURRENT / AUTHORITY | كل قرار منتج أو تقنية أو تنفيذ |
| 2 | `docs/02-decision-log.md` | CURRENT / AUTHORITY | معرفة القرار المعتمد والقرار المسحوب |
| 3 | `docs/03-hypothesis-register.md` | CURRENT | فرضية أو ميزة أو اختبار |
| 4 | `docs/04-product-truth-map.md` | CURRENT | وزن الدليل وما هو مجهول |
| 5 | `docs/07-field-evidence-map.md` | CURRENT | الدليل الميداني وحدود ما تثبته خبرة المؤسس |
| 5A | ~~`docs/06-reference-library.md`~~ — **دُمج في `docs/research/global-build-reference-library-v1.md` (الملحق أ) وحُذف 2026-10-01 (WS-204)** | تصنيف التراخيص وبوابة الإدخال الثمانية في الملحق أ؛ الأصل في تاريخ git |
| 6 | `ai-skills/README.ar.md` | CURRENT | تشغيل مهارات الذكاء الاصطناعي |
| 7 | `docs/05-documentation-governance.md` | CURRENT | إدارة الوثائق وتعارضاتها |
| 8 | `docs/decisions/01-first-vertical-slice.md` | CURRENT | قرار الشريحة التنفيذية الأولى |
| 9 | `docs/decisions/02-repository-policy.md` | CURRENT | سياسة الملكية والترخيص المؤقتة |
| 10 | `docs/decisions/03-scenario-validation-and-system-scope.md` | CURRENT | قرار مجموعة السيناريوهات وحدود النظام |
| 10أ | `docs/decisions/final-continuation-conflict-resolutions-v1.md` | APPROVED — يسود عند التعارض | مصالحة التعارضات التعاقدية للتنفيذ النهائي (Conflicts A–I) وإغلاق FC-02/FC-06/AV-07/AV-08/AV-09/WF-04 |
| 11 | `docs/contracts/` | CURRENT | عقود النتيجة والطلب والتكلفة والمزامنة وسياسات المال P0، ومنها `05-financial-p0-policies.md` |
| 12 | `docs/08-glossary.md` | CURRENT | قاموس المصطلحات المعتمد |
| 12A | `docs/contracts/06-financial-event-prototype-contract.md` | CURRENT / PROTOTYPE | عقد الأحداث المالية المحلية للكاش والذمم ومال المالك وحدود «وضعي المالي» |
| 12B | `docs/expansion/README.md` و`MARKET-DELIVERY-OWNER-IA-CONTRACT.md` | CURRENT / EXPANSION ENTRY POINT | نقطة دخول وقرار وTracker لتوزيع Owner بين Market وDelivery؛ تقرأ فقط عند مهمة التوسعة ولا تدعي تنفيذ قدرة شبكة |
| 12C | `docs/contracts/18-network-identity-workspace-access-contract.md` إلى `24-network-data-classification-field-dictionary-contract.md` | CURRENT / EXPANSION E-00 | عقود الهوية والعزل وAttention/Notification وMarket وDelivery وModeration ودورة البيانات وتصنيف الحقول قبل أي كود توسعة |
| 12C-1 | **تمييز أرقام العقود المتشابهة ١٨–٢٣ (بلا إعادة ترقيم أبدًا)**: كل رقم من ١٨ إلى ٢٣ يحمله ملفان من سلسلتين مختلفتين — (١) سلسلة النموذج المحلي: `18-derived-monthly-order-schedule-g6-a-contract.md` (G6-A)، `19-bounded-local-schedule-recurrence-g6-b-contract.md` (G6-B)، `20-agreement-source-follow-up-g7-a-contract.md` (G7-A)، `21-guided-opening-import-prototype-contract.md` (G8.2)، `22-bounded-operating-capacity-pilot-contract.md` (G9.1)، `23-general-financial-event-correction-boundary-proposal-v1.md` (C1)؛ و(٢) سلسلة توسعة الشبكة E-00: `18-network-identity-workspace-access-contract.md` (N-01/N-02)، `19-services-notification-manage-boundary-contract.md` (N-03/N-04)، `20-market-need-response-listing-moderation-contract.md` (M-01/M-02)، `21-delivery-request-quote-status-privacy-contract.md` (D-01/D-02)، `22-network-moderation-consent-audit-contract.md` (A-01)، `23-network-data-lifecycle-recovery-contract.md` (N-05). أي إشارة إلى «عقد ١٨…٢٣» يجب أن تسمّي السلسلة والملف صراحة. الأرقام ٢٤/٢٥ لسلسلة الشبكة وحدها، و٢٦–٢٩ لسلسلة النموذج وحدها. قرار عدم إعادة الترقيم: حفظ الروابط التاريخية القائمة؛ الإعادة ترقيم كسر مرجعي بلا مكسب سلوكي (قرار المالك D3 على تقرير المسح الهيكلي 2026-09-12). | CURRENT / DISAMBIGUATION | منع الغموض المرجعي لأرقام العقود المتشابهة قبل أي استشهاد |
| 12C-2 | `docs/contracts/30-unified-activity-reader-contract.md` إلى `39-export-envelope-integrity-contract.md` | CURRENT / PROTOTYPE | عقود المجموعة ٥ من برنامج النقل (سُدّدت ملفاتها في المجموعة ٨ من برنامج المعالجة الرباعية 2026-09-12 بقرار المالك D2): ٣٠ القارئ الموحّد للنشاط، ٣١ عمق النتيجة (البنود غير النقدية)، ٣٢ تقرير الفترة المحلي Markdown، ٣٣ المشاركة اليدوية، ٣٤ سجل التصحيحات، ٣٥ فحوص الاستمرارية MIC-14..16، ٣٦ مسودات النماذج، ٣٧ القفل المحلي، ٣٨ تحديث PWA الودود للنماذج، ٣٩ مظروف النسخ v27 وتكامل ملف النقل |
| 12C-3 | `docs/contracts/40-technical-ownership-map-contract.md` | CURRENT / PROTOTYPE | خريطة الملكية التقنية وحدود الوحدات (الموجة الثالثة — EXE-017): مالك كل خدمة وكتابة وسياسة (فحص السلامة وسياسات التوزيع للمالية، النسخ والاستعادة للإعدادات/البيانات، الكتالوج مستهلك)، عقد أهلية «أدواتي»، أسطح التوافق المؤقتة للموجة الرابعة وBacklogها — يحرسها `ownershipBoundaries.exe017.test.ts` |
| 12C-4 | `docs/contracts/41-recurring-expense-reminders-contract.md` | CURRENT / PROTOTYPE | عقد تذكير المصروف المتكرر المحلي (OPS-003 / قرار D-037): المفاهيم الأربعة المنفصلة (سلسلة/مراجعة مجمدة/فترة بقراراتها/حدث مالي بالكاتب الكنوني فقط)، تقويم الفترة والأشهر القصيرة، مفتاح الحتمية بالخانة، حالات القراءة المشتقة (انتباه/مجهول/معكوس)، المخازن ٣٦/٢٨ حين القرار (اليوم 38/30 — تصحيح مؤرخ 2026-09-29 F-033/W4-B)، ومفردات الواجهة الإلزامية الأربع |
| 12C-5 | `docs/contracts/42-optional-expense-budgets-goals-contract.md` | CURRENT / PROTOTYPE | عقد ميزانيات وأهداف المصروف الاختيارية (FIN-002 / قرار المالك D-037): خطة لا حدث مالي، مفاهيم مفصولة، تقويم شهري YYYY-MM بتوقيت عمّان، عدم تداخل النطاقات، حالات مشتقة (ضمن/متجاوز/مراجعة)، مخازن 37/29 حين القرار |
| 12C-6 | `docs/contracts/43-asset-depreciation-prototype-contract.md` | CURRENT / PROTOTYPE | عقد إهلاك الأصول الاسمي للنموذج (FIN-008): مصروف غير نقدي معلن لا يلمس الكاش؛ نماذج الإهلاك الإضافية (ضريبة/إعادة تقييم/مجموعات) خارج النطاق بقرار موثق |
| 12D | `docs/expansion/ROLE-ACCESS-MATRIX.md` و`E00-SCENARIOS-AND-ACCEPTANCE.md` و`E00-EXECUTION-PROTOCOL.md` و`E00-REVIEW-CHECKLIST.md` | CURRENT / EXPANSION E-00 | مصفوفة الوصول وسيناريوهات القبول وبروتوكول وChecklist التوثيق قبل تجربة البيت أو التفعيل |
| 12E | `docs/expansion/FIRST-WEDGE-AND-PILOT-DECISION-CARD.md` و`LOCAL-FIRST-HOME-TRIAL-SOP.md` و`ACTIVATION-PRIVACY-ETHICS-SOP.md` و`PARTNER-PILOT-SOP-AND-MEASUREMENT.md` | CURRENT / EXPANSION E-00 | قرار Wedge وإجراء تجربة البيت وبوابة التفعيل والخصوصية وPilot والقياس؛ لا تفويض تنفيذ ذاتي |
| 12F | `docs/expansion/E00-TECHNICAL-ARCHITECTURE-DECISION.md` و`MANAGE-NETWORK-MIGRATION-EXPORT-GATE.md` و`E00-TRACEABILITY-MATRIX.md` و`HOME-TRIAL-LOG-TEMPLATE.md` | CURRENT / EXPANSION E-00 | حد المعمارية قبل الكود، وحارس Manage/schema/export، وتتبع القرار إلى القبول، وسجل تجربة البيت الآمن |
| 12G | `docs/expansion/FOUR-PARTY-IMPLEMENTATION-GATE-MAP.md` و`FOUR-PARTY-PORTAL-AND-ACCESS-RECOVERY-GATE.md` و`SEVEN-AGENT-EXPANSION-OPERATING-CHECKLIST.md` | CURRENT / EXPANSION E-00 | خريطة بوابات Owner/Supplier/Courier/Admin، استعادة الهوية وAdmin المقيد، وقائمة تشغيل الـAgents السبعة؛ لا Auth أو Cloud أو صلاحيات منفذة |
| 12H | `docs/expansion/E00-INDEPENDENT-ACCEPTANCE-REVIEW-2026-08-27.md` | CURRENT / EXPANSION E-00 ACCEPTANCE | دليل المراجعة المستقلة الذي يغلق أساس E-00 توثيقيًا ويبين ما يبقى قرار مالك أو بوابة تنفيذ لاحقة |
| 12I | `docs/expansion/ACTIVATION-OPERATIONAL-READINESS-AND-SAFETY-GATE.md` | CURRENT / EXPANSION E-00.12 / DOCUMENTATION ONLY | بوابة الدعم والحوادث والإطلاق والإتاحة والقياس قبل تفعيل الجهات الأربع؛ لا مزود أو SLA أو Auth أو Cloud منفذ |
| 12J | `docs/expansion/E00-12-INDEPENDENT-ACCEPTANCE-REVIEW-2026-08-27.md` | CURRENT / EXPANSION E-00.12 ACCEPTANCE | دليل قبول مستقل لبوابة الجاهزية؛ يثبت اكتمال التوثيق فقط ويمنع خلطه بتشغيل A/B أو قرار المالك |
| 12K | `docs/expansion/COMMERCIAL-LIQUIDITY-AND-MODEL-DECISION-CARD.md` | CURRENT / EXPANSION E-00.13 / OWNER DECISION REQUIRED | بطاقة تفاعل أول وسيولة ونموذج تجاري محتمل؛ لا رسوم أو دفع أو عمولة أو توسع قبل دليل وقرار مستقل |
| 12L | `docs/expansion/E00-13-INDEPENDENT-ACCEPTANCE-REVIEW-2026-08-27.md` | CURRENT / EXPANSION E-00.13 ACCEPTANCE | دليل قبول مستقل لبطاقة السيولة والنموذج التجاري؛ يثبت اكتمال التوثيق لا قرار رسوم أو سوق أو دفع أو Pilot |
| 12M | `docs/expansion/MARKET-DELIVERY-OWNER-IA-CONTRACT.md` | CURRENT / EXPANSION E-00.14 / IA ONLY | توزيع Owner: السوق في BottomNav والتوصيل من AppBar ومحتوى الشاشتين ونقاط الدخول؛ لا UI أو Domain أو LocalStore أو Auth/Cloud |
| 12N | `docs/expansion/E00-14-INDEPENDENT-ACCEPTANCE-REVIEW-2026-08-28.md` | CURRENT / EXPANSION E-00.14 ACCEPTANCE | دليل قبول مستقل لتوزيعة السوق والتوصيل؛ يثبت اتساق التوثيق لا تنفيذ الواجهة أو Market/Delivery أو L/A/Pilot |
| 13 | `docs/implementation/01-execution-roadmap.md` | CURRENT | خارطة التنفيذ والبوابات |
| 14 | `docs/implementation/02-domain-contract-coverage.md` | CURRENT | مطابقة العقود مع Domain Core والحدود المؤجلة |
| 15 | `docs/product/problem-statement-v4.md` | CURRENT / CANONICAL | المشكلة والأضرار والأسئلة، والنواة العامة والـProfiles والمشاريع المختلطة |
| 15A | `docs/operations/archive/problem-statement-v3.md` | SUPERSEDED / ARCHIVED (تحديث مؤرخ 2026-10-02 — قرار مالك الجولة الثانية) | سياق تاريخي؛ لا يستخدم كمرجع قرار جديد |
| 15B | `docs/product/problem-statement-v5.md` | CURRENT / CANONICAL — نطاق الطلب والتنقل والبوابة الأمامية | قرارات الطلب/التنقل/التوزيع؛ نطاق v4 (النواة العامة والـProfiles) يبقى في v4 — النطاقان متكاملان لا متنافسان |
| 16 | `docs/product/system-definition-v1.md` | CURRENT | تعريف Micro وحدوده وقيمته ونواته |
| 17 | `docs/product/user-operating-model-v1.md` | CURRENT | الاستخدام اليومي والأسبوعي والشهري |
| 18 | `docs/product/financial-operating-model-v1.md` | CURRENT | النموذج المالي الداخلي للأحداث والنتائج |
| 19 | `docs/product/guidance-interaction-policy-v1.md` | CURRENT | التوجيه داخل سير العمل دون تعليم قسري |
| 19A | `docs/product/activity-profiles-and-hybrid-projects-v1.md` | CURRENT / PRODUCT ARCHITECTURE | حدود النواة والـProfiles والأنشطة المختلطة |
| 19B | `docs/product/owner-decisions-v1.md` | CURRENT / SCOPED REGISTER | قرارات مالك برنامج إعادة التوزيع 2026-08 (١..٢٤ +٢٣-ب)؛ حاكمة داخل نطاقها ومتاحة من `02-decision-log.md`، ولا تعلو على العقود في معنى المال |
| 19C | `docs/product/settled-findings-v1.md` | CURRENT / SCOPED REGISTER | توافق القراءات الأربع ومعايير قبول برنامج إعادة التوزيع |
| 19D | `docs/product/code-facts-v1.md` | CURRENT — أرقامه لقطة مؤرخة (الزوج الحي 38/30 بتصحيح مؤرخ) | حقائق ما بُني فعلًا في حقبة إعادة التوزيع |
| 19E | `docs/product/capability-redistribution-v1.md` | CURRENT / PROGRAM RECORD — منفذ عبر موجات 4.1–4.4 | فهم «لماذا صارت كل شاشة في مكانها»؛ ليس خطة عمل حالية |
| 19F | `docs/product/placement-principles-v1.md` | CURRENT / SUPPORTING | مبادئ مواضع العناصر المستمدة من إعادة التوزيع |
| 20A | `docs/product/mobile-ui-ux-reference-v1.md` | CURRENT / CANONICAL / PHONE-FIRST | مرجع الشكل والتفاعل والحالات والصدق المالي على الهاتف، قبل بناء الواجهة — **§6.1 و§6.2 و§6.4 مُلغات** بقرار إعادة التوزيع (`capability-redistribution-v1.md`) |
| 20B | `docs/product/design-system-v1.md` | HISTORICAL / SCOPED — سجل قرارات تصميم حقبة إعادة التوزيع (تحديد نطاق مؤرخ 2026-10-01 داخل الملف) | فهم منطق القرارات التصميمية التاريخية؛ سلطة الهوية والتوكنات الحالية في `docs/architecture/` و`vf-tokens.css` |
| 20C | `docs/product-source-of-truth.md` | CURRENT / SCOPED — التنقل النهائي ومسارات الشاشات ومسؤولياتها (تحديد نطاق مؤرخ 2026-10-01 داخل الملف) | مرجع التنقل وتدفق الشاشات؛ سلطة المال للعقود والحالة الحية لـ`current-state.md` |
| 20D | `docs/product/home-navigation-proof-v1.md` | CURRENT / SUPPORTING | إثبات نموذج تنقل شاشة الرئيس |
| 20E | `docs/product/deferred-capabilities-execution-plan-v1.md` | HISTORICAL / SUPERSEDED (تحديث مؤرخ 2026-10-02 — OD-01) | سجل القرار التنفيذي التاريخي لحقبة إعادة التوزيع؛ سلطة خارطة المنتج الحالية الوحيدة هي خارطة تطور القدرات (23B) |
| 20F | `docs/product/draft-dismissal-mini-spec-v1.md` | SUPERSEDED / HISTORICAL — أُلغيت بقرار المالك ٢١ (تحديث مؤرخ 2026-10-02) | مواصفة اقتراح تاريخية لإغلاق المسودة مع سبب؛ المنفذ فعليًا: الحذف بلا سبب عبر `draftService.delete` |
| 20G | `docs/product/brand-activation-observations-v1.md` | CURRENT / SCOPED RECORD | ملاحظات تشغيل حزمة العلامة المحفوظة (المساران ذويا التحميل الدائم، سلوك القفل التلقائي، قيد لا-lockup/wordmark، منشأ الحزمة، سجلات مرايا Documents المحققة) — مقطّرة من حزم التخطيط المحذوفة 2026-10-01 (WS-204) |
| 20 | `docs/scenarios/scenario-test-set-v1.md` | CURRENT | 12 شخصية و120 حالة و120 سؤالًا، بما فيها السياحة والمشروع المختلط |
| 21 | `docs/scenarios/scenario-test-results-v1.md` | CURRENT | نتائج التغطية والفجوات |
| 22 | `docs/quality/scenario-coverage-matrix-v1.md` | CURRENT | ربط المشكلات بالسيناريوهات والقدرات |
| 22A | `docs/quality/persona-context-simulation-protocol-v1.md` | CURRENT / EXECUTION PROTOCOL / DERIVED | غلاف سياق حتمي لتشغيل P01–P10 على Prototype؛ لا يستبدل مجموعة السيناريوهات canonical |
| 22B | `docs/quality/persona-context-simulation-results-v1.md` | CURRENT / EXECUTION EVIDENCE | نتائج تشغيل P01–P10 على Prototype؛ تفصل الدليل الحي عن التشغيل المكتبي وحدود النطاق |
| 22C | `docs/quality/security-boundaries.md` | CURRENT / PROTOTYPE / SECURITY REFERENCE | المرجع الموحّد لحدود الأمن والخصوصية المنفذة: التخزين المحلي وحده بلا خروج شبكي، ومستبعدات التصدير (local-security وform-drafts)، والقفل وبوابات الأفعال التدميرية، وتشخيص الثمانية حقول بلا رفع، وفحوص الأسرار، وحدود الاستبدال — كل حد بمرجع كوده واختباره (أُنشئ في المجموعة ٨ من برنامج المعالجة الرباعية تسديدًا لمكتشف STR-014) |
| 22D | `docs/quality/security-exceptions.md` | CURRENT / SECURITY GOVERNANCE | سجل الاستثناءات الأمنية الموثق: مكتشفات تدقيق التبعيات غير القابلة للإصلاح تقنيًا وقرارها المالك الصريح (PROPOSED يحجب CI حتى القرار؛ OWNER_ACCEPTED يُطبع إشعاره في كل تشغيل ولا يمر بصمت؛ المتقادم يُنبه للإزالة) — أنشئ في برنامج تصحيح ما بعد المسح (PR #316، الخطوتان ٢+٣، 2026-10-06) |
| 22E | `docs/quality/security-exception-register.json` | SUPPORTING DATA / MACHINE-READABLE | السجل القابل للفحص الذي يقرؤه `scripts/ci-audit-check.mjs` في كل تشغيل تدقيق — البيانات المقترنة بالسجل النثري 22D (القرار المعلق فيه حاليًا: GHSA-vfj7-8cjw-p6xm / braces) |
| 22F | `docs/quality/vendored-braces-inventory.md` | CURRENT / SECURITY GOVERNANCE | جرد ومراقبة نسخ `braces@3.0.3` المتجسدة داخل حزم أدوات التطوير (vite/rollup/prettier — أربع نسخ؛ نسختا tsx أُزيلتا من المخطط في هذا PR نفسه): غير مرئية لـpnpm audit بنيويًا لأنها مُضمَّنة داخل ملفات dist المنشورة، تطويرية فقط؛ مع تحليل مسارات المعالجة الحية المعاد التحقق منه من السجل (لا مسار آمن اليوم — قيد منبع موثق)، محفزات إعادة الزيارة (rollup 5 مستقر)، والحارس `scripts/check-vendored-braces.mjs` الذي يفشل عند أي انجراف. |
| 23A | `docs/research/accounting-reference-review-v2.md` | SUPPORTING / REFERENCE REVIEW | دليل حي ومصدري لـAccounting ومصفوفة نقل مقيّدة إلى مبادئ تجربة Micro، لا كود أو هوية أو نموذج مالي |
| 23B | `docs/product/capability-evolution-roadmap-v1.md` | CURRENT / PRODUCT ROADMAP — السلطة الوحيدة (OD-01، 2026-10-02) | خارطة مرحلية للصورة المالية العامة وجدول المواعيد والقدرات المؤجلة واعتمادياتها وبوابات قرارها |
| 23C | `docs/implementation/multi-activity-expansion-roadmap-v1.md` | CURRENT / ROADMAP | بوابات التوسع إلى Profiles والمشاريع المختلطة بعد G15/G16 |
| 23D | `docs/research/multi-activity-profile-research-v1.md` | SUPPORTING / RESEARCH | دعم FAO/OECD لحدود النمذجة الزراعية والسياحية |
| 23 | `docs/research/jordan-financial-problems-evidence.md` | SUPPORTING | الأدلة المحلية والخارجية وحدودها |
| 24 | `ai-skills/micro-scenario-validation/` | CURRENT | اختبار القرارات على الشخصيات والحالات والأسئلة |
| 24A | `ai-skills/micro-web-native-ux/` | CURRENT | تجربة Web App بملء الشاشة وسلوك Android-like وRTL وPWA UX |
| 24B | `ai-skills/micro-design-system/` | CURRENT | تطبيق الهوية والتوكنات وLight/Dark على التصميم والكود |
| 24C | `ai-skills/micro-local-first-prototype/` | CURRENT | LocalStore والمسودات وSnapshots وlocal export/import |
| 24D | `ai-skills/micro-prototype-qa/` | CURRENT | اختبار التدفقات والواجهة والحقيقة المالية واللقطات — **وتضم قائمة «ضد الطابع المولد»** (`references/anti-vibe-checklist.md`، دُمجت فيها مهارة micro-anti-vibe-interface-audit غير المسجلة حرفيًا بتاريخ 2026-10-01) |
| 24E | `ai-skills/microbusiness-finance-operations/` | CURRENT / SUPPORTING | حارس المعنى الاقتصادي والتشغيلي — صيغة تشغيلية مكثفة لا تعلو على العقود |
| 24F | `ai-skills/saas-delivery-verifier/` | RETIRED (محفوظة) — 2026-10-01 | مهارة مرحلة MVP التجاري اللاحق؛ مراجعها (مصفوفة التحقق، runbook الإصدار، سياسة الكود الخارجي) تُستشار عند فتح بوابة MVP |
| 24G | `ai-skills/saas-product-guardian/` | RETIRED (محفوظة) — 2026-10-01 | بطاقة قرار المالك وسلّم الأدلة — تُستشار من سجل القرارات عند قرارات MVP الكبرى |
| 25 | `docs/implementation/03-pre-build-alignment-v1.md` | CURRENT / GATE | تعريف المراحل وبوابة المحاكاة قبل البناء |
| 26A | `docs/implementation/mobile-prototype-spec-v1.md` | CURRENT / CANONICAL / PROTOTYPE | مواصفة الشاشات والمسارات والحالات والحدود للـPrototype المحلي |
| 26B | `docs/implementation/prototype-build-charter-v1.md` | CURRENT / CANONICAL / BUILD CHARTER | قرار Web-first وAndroid-like وPWA-ready وCloudflare وخطة البناء المرحلية وحوكمة الوكلاء |
| 26 | `docs/quality/pre-build-experiment-simulation-v1.md` | CURRENT / EVIDENCE | نتائج المحاكاة الحتمية لتجارب ما قبل البناء |
| 27 | `docs/quality/pre-build-experiment-simulation-v1.json` | SUPPORTING DATA | البيانات القابلة لإعادة الفحص للمحاكاة |
| 28 | `docs/research/global-build-reference-library-v1.md` | CURRENT / RESEARCH AUTHORITY | المعرفة العالمية المحفوظة والمفاهيم والتراخيص وقرارات build/study/defer/reject |
| 29 | `docs/research/micro-build-logic-v1.md` | CURRENT / BUILD LOGIC | تحويل المصادر إلى منطق Domain وUX وPrototype ومراحل البناء اللاحقة |
| 30 | `docs/quality/simulated-first-read-cloud-code-v1.md` | CURRENT / QUALITY REVIEW | محاكاة قراءة Agent جديد وحدود ما يفهمه قبل القراءة الفعلية لـCloud Code |
| 31 | `docs/quality/cloud-code-first-read-findings-v1.md` | CURRENT / QUALITY REVIEW | نتائج قراءة Cloud Code الفعلية والتحقق من ملاحظاتها |
| 32 | `docs/quality/unified-audit-resolution-v1.md` | CURRENT / QUALITY GATE | القرار الموحد لما ثبت وما أُصلح وما يؤجل قبل Prototype |
| 33 | `docs/operations/remaining-work-v1.md` | SUPERSEDED — بانر داخل الملف؛ التتبع الحي في `docs/operations/control/items/` | لا يُقرأ كمرجع قرار؛ سُجل هنا لإغلاق فجوة الفهرسة |
| 34 | `docs/operations/archive/decision-18-accounting.md` | HISTORICAL / SCOPED RECORD | محاسبة حالة القرار ١٨ وحدود F-014/F-015 المؤجلة (أُرشف 2026-10-02) |
| 35 | `docs/operations/archive/agent-handoff-2026-08-29.md` · `agent-handoff-2026-08-30.md` · `agent-handoff-2026-08-30-peeling-and-design-system.md` | HISTORICAL / SESSION RECORDS | سجلات تسليم وكيل مؤرخة؛ لا سلطة حالية (أُرشفت 2026-10-02) |
| 36 | `docs/operations/archive/implementation-report-ar.md` | HISTORICAL / EXECUTION REPORT | تقرير التنفيذ العربي لحقبة إعادة التدفق (2026-08-31؛ أُرشف 2026-10-02) |
| 37 | `docs/implementation-traceability.md` | CURRENT — صفوف المجموعات لقطات تاريخية صادقة (تصحيح مؤرخ 2026-10-01 للزوج الحي 38/30 في الترويسة) | تتبع ما نُفذ بحقبة المجموعات ١–٤ |
| 38 | `docs/reference/independent-flow-redesign.md` | HISTORICAL / DESIGN EXERCISE | مرجع تصميم إعادة التدفق المالي والتشغيلي؛ يُقرأ عند تفسير قرارات التدفق فقط |
| 39 | `docs/inventory/` — الملفات السبعة الحية: `00-summary.md` · `01-inventory-master.md` · `03-gap-ranking.md` · `05-unreachable.md` · `06-foundational-setup.md` · `07-duplicates.md` · `08-dependencies.md` (دُمج README في 00-summary وأُرشيف 09 ودُمج 02-by-tier في 01، تحديثات مؤرخة 2026-10-02؛ أسماء الملفات صريحة بتوسيع G2/STR-619 — 2026-10-04) | CONTEXT PACK — جرد قدرات ما قبل إعادة التوزيع (F-001..F-083) | قياس مرجعي لا وثيقة تصميم؛ معرّفات F تستهلكها owner-decisions وsettled-findings |
| 40 | `docs/product-audit/` (3 مصادر `.md`): `financial-system-approved-repairs-source.md` · `financial-system-current-state-analysis-source.md` · `financial-system-deep-ux-product-analysis-source.md` | CONTEXT PACK — سلسلة تدقيق 2026-08-31/09-01 (PA-001..PA-0026) | أصل معرّفات المكتشفات. *(تحديث مؤرخ 2026-10-02 — OD-07: حُذفت مرايا `.docx` الثلاث بقرار مالك بعد إثبات علاقة المرآة من ترويسات المصادر المحفوظة نفسها وتوافق الإصدار الواحد `ddf44f2`؛ الأصل في تاريخ git.)* |
| 41 | `docs/decisions/` — ملفات الحقب: `25-multi-activity-core-profiles-v1.md` · `actual-material-cost-per-order-g6-scope.md` · `capability-roadmap-reconciliation-v1.md` · `g94-retain-g7a-boundary.md` · `general-financial-event-correction-c1-decision-v1.md` · `home-control-center-h01a-decision-v1.md` · `optional-capability-knowledge-model-v1.md` · `pos-sector-gate-v1.md` · `remaining-capabilities-review-v1.md` · `review-finance-c2-decision-v1.md` · `v3-finance-cash-first-ui.md` · `v4-schedule-follow-up-first-ui.md` · `v5-safe-labels-back-and-disclosures.md` | CONTEXT PACK — سجلات قرار مؤرخة | الوصول الكنوني من `02-decision-log.md` |
| 42 | `docs/expansion/EXPANSION-GLOSSARY.md` | CURRENT / SUPPORTING | معجم مصطلحات التوسعة E-00 |
| 43 | `docs/expansion/HISTORICAL-SOURCES.md` | HISTORICAL / NON-AUTHORITY | فهرس المصادر التاريخية للتوسعة؛ لا سلطة تنفيذ |
| 43B | `docs/expansion/DECISIONS.md` · `TRACKER.md` | CURRENT / EXPANSION GOVERNANCE | سجل قرارات التوسعة وتتبعها الحي — يُحدّثان مع كل قرار توسعة موثق |
| 43C | `docs/expansion/historical-source/`: `01-our-ideas-and-system-development.md` · `02-micro-market.md` · `03-micro-delivery.md` · `04-integrated-operating-model.md` · `05-mvp-technical-and-execution.md` · `06-final-build-blueprint.md` | HISTORICAL / NON-AUTHORITY | المصادر التاريخية الستة قبل البناء — تُقرأ لفهم تطور القرارات فقط (إحصاء صريح بتوسيع G2/STR-619 — 2026-10-04) |
| 43D | `docs/quality/`: `g4a-understanding-card.md` · `g82-guided-opening-import-test-plan.md` · `ops-003-recurring-expense-qa-2026-09-21.md` · `prototype-qa-v1.md` · `g15-device-production-acceptance.md` · `g16-pilot-kit-and-decision-gate.md` | CURRENT / QUALITY EVIDENCE — بطاقات فهم وخطط اختبار وسجلات QA وبوابات قبول الجهاز وPilot (G4A/G8.2/OPS-003/G15/G16) | أدلة قبول مؤرخة لا تعلو على العقود (إحصاء صريح بتوسيع G2/STR-619 — 2026-10-04) |

## خريطة العقود الكاملة (49 ملفًا) — تُقرأ بحسب المنطقة الملموسة لا جملةً

| # | الملف | النطاق |
|---|---|---|
| 01 | `docs/contracts/01-financial-result-contract.md` | عقد النتيجة المالية وحدود المعرفة |
| 02 | `docs/contracts/02-order-lifecycle-contract.md` | دورة حياة الطلب وحالاته |
| 03 | `docs/contracts/03-cost-snapshot-contract.md` | لقطة التكلفة وتجميدها |
| 04 | `docs/contracts/04-limited-sync-contract.md` | التخزين المحلي وحدود المزامنة |
| 05 | `docs/contracts/05-financial-p0-policies.md` | سياسات المال P0 — العقد المالي الحاكم |
| 06 | `docs/contracts/06-financial-event-prototype-contract.md` | الأحداث المالية المحلية (الكاش/الذمم/مال المالك) |
| 07 | `docs/contracts/07-schedule-capacity-prototype-contract.md` | الجدولة والسعة |
| 08 | `docs/contracts/08-expense-classification-prototype-contract.md` | تصنيف المصروف |
| 09 | `docs/contracts/09-supplier-purchase-prototype-contract.md` | شراء المورد |
| 10 | `docs/contracts/10-cash-continuity-prototype-contract.md` | استمرارية الكاش |
| 11 | `docs/contracts/11-inventory-material-consumption-prototype-contract.md` | المخزون والمواد والاستهلاك |
| 12 | `docs/contracts/12-financial-insights-g5-prototype-contract.md` | رؤى المالية G5 — **LEGACY/RETAINED** (بانر داخل الملف؛ مُجاوز للتنفيذ بعقد 17 — تصحيح مؤرخ 2026-10-02) |
| 13 | `docs/contracts/13-actual-material-per-order-prototype-contract.md` | المادة الفعلية للطلب |
| 14 | `docs/contracts/14-period-result-allocation-policy-prototype-contract.md` | توزيع نتيجة الفترة |
| 15 | `docs/contracts/15-catalog-reference-prototype-contract.md` | الكتالوج المرجعي |
| 16 | `docs/contracts/16-optional-operating-mode-and-actual-time-contract.md` | وضع التشغيل الاختياري والوقت الفعلي |
| 17 | `docs/contracts/17-contribution-break-even-short-cash-g5-contract.md` | التعادل التشغيلي والكاش القصير G5 |
| 18L | `docs/contracts/18-derived-monthly-order-schedule-g6-a-contract.md` | الجدول الشهري المشتق G6-A (سلسلة النموذج المحلي) |
| 19L | `docs/contracts/19-bounded-local-schedule-recurrence-g6-b-contract.md` | تكرار الجدول المحلي المحدود G6-B |
| 20L | `docs/contracts/20-agreement-source-follow-up-g7-a-contract.md` | مصدر الاتفاق والمتابعة G7-A |
| 21L | `docs/contracts/21-guided-opening-import-prototype-contract.md` | الاستيراد الموجه عند أول تشغيل G8.2 |
| 22L | `docs/contracts/22-bounded-operating-capacity-pilot-contract.md` | سعة التشغيل المحدودة للـPilot G9.1 |
| 23L | `docs/contracts/23-general-financial-event-correction-boundary-proposal-v1.md` | حدود تصحيح الحدث المالي العام C1 |
| 18N | `docs/contracts/18-network-identity-workspace-access-contract.md` | هوية الشبكة وWorkspace (سلسلة E-00) |
| 19N | `docs/contracts/19-services-notification-manage-boundary-contract.md` | حدود «الخدمات» والإشعارات E-00 |
| 20N | `docs/contracts/20-market-need-response-listing-moderation-contract.md` | السوق والإدراج والإشراف E-00 |
| 21N | `docs/contracts/21-delivery-request-quote-status-privacy-contract.md` | التوصيل والخصوصية E-00 |
| 22N | `docs/contracts/22-network-moderation-consent-audit-contract.md` | إشراف وموافقة وتدقيق الشبكة E-00 |
| 23N | `docs/contracts/23-network-data-lifecycle-recovery-contract.md` | دورة حياة بيانات الشبكة واسترجاعها E-00 |
| 24N | `docs/contracts/24-network-data-classification-field-dictionary-contract.md` | قاموس تصنيف حقول بيانات الشبكة E-00 |
| 25N | `docs/contracts/25-network-money-representation-contract.md` | تمثيل المال في الشبكة E-00 |
| 26 | `docs/contracts/26-navigation-referrer-and-deep-link-contract.md` | التنقل والـreferrer والروابط العميقة |
| 27 | `docs/contracts/27-guided-financial-entry-contract.md` | الإدخال المالي الموجه |
| 28 | `docs/contracts/28-selective-inventory-tracking-contract.md` | التتبع الاختياري للمخزون |
| 29 | `docs/contracts/29-group4-deep-finance-contract.md` | المالية العميقة للمجموعة ٤ |
| 30 | `docs/contracts/30-unified-activity-reader-contract.md` | القارئ الموحد للنشاط |
| 31 | `docs/contracts/31-period-statement-depth-contract.md` | عمق كشف الفترة |
| 32 | `docs/contracts/32-local-period-statement-markdown-contract.md` | كشف الفترة Markdown المحلي |
| 33 | `docs/contracts/33-manual-share-preview-contract.md` | معاينة المشاركة اليدوية |
| 34 | `docs/contracts/34-correction-history-trail-contract.md` | مسار تاريخ التصحيحات |
| 35 | `docs/contracts/35-integrity-continuity-checks-contract.md` | فحوص الاستمرارية MIC |
| 36 | `docs/contracts/36-form-drafts-local-boundary-contract.md` | حدود مسودات النماذج المحلية |
| 37 | `docs/contracts/37-local-app-lock-contract.md` | القفل المحلي للتطبيق |
| 38 | `docs/contracts/38-pwa-dirty-safe-update-contract.md` | التحديث الودود الآمن للـPWA |
| 39 | `docs/contracts/39-export-envelope-integrity-contract.md` | تكامل مظروف النسخ والاستيراد/التصدير |
| 40 | `docs/contracts/40-technical-ownership-map-contract.md` | خريطة الملكية التقنية وحدود الوحدات (EXE-017) |
| 41 | `docs/contracts/41-recurring-expense-reminders-contract.md` | تذكير المصروف المتكرر (OPS-003/D-037) |
| 42 | `docs/contracts/42-optional-expense-budgets-goals-contract.md` | ميزانيات وأهداف المصروف (FIN-002/D-037) |
| 43 | `docs/contracts/43-asset-depreciation-prototype-contract.md` | إهلاك الأصول الاسمي (FIN-008) |

> **تمييز الأرقام المتشابهة 18–23 (قرار المالك D3 — لا إعادة ترقيم أبدًا):** كل رقم من ١٨ إلى ٢٣ يحمله ملفان من سلسلتين (النموذج المحلي L أعلاه، والشبكة E-00 N أعلاه)؛ أي إشارة إلى «عقد ١٨…٢٣» تسمّي السلسلة والملف صراحة (التفصيل الكامل في الصف 12C-1).

## مسار القراءة — إحالة وحيدة

**جدول التوجيه الوحيد هو `AGENTS.md` §2 (النواة + حزم السياق التسع).** لا توجد قوائم قراءة موازية في هذا الفهرس (تحديث مؤرخ 2026-10-01 — WS-204):
- حمّل النواة ثم **حزمة مهمتك فقط** من `AGENTS.md` §2، واحترم سقفها.
- العقود تُقرأ **بحسب المنطقة الملموسة** (1–3 عقود ذات صلة) لا جملةً؛ تمييز أرقام العقود المتشابهة 18–23 في الصف 12C-1.
- مخازن الأدلة (أدناه) خارج القراءة الافتراضية بموجب قائمة المنع في `AGENTS.md` §2.

## ملفات داعمة غير سلطوية

`docs/research/architecture-and-stack-decision.md`، `docs/research/architecture-decision-reassessment.md`، `docs/research/architecture-decision-matrix.md`، `docs/research/order-tracking-case-study.md`، `docs/research/github-global-research.md`، `docs/research/github-global-research-round2.md`، `docs/research/vibe-coding-interface-audit-v1.md` (أصل منهجية مراجعة «ضد الطابع المولد»)، والمهارات المتقاعدة `ai-skills/saas-delivery-verifier/` و`ai-skills/saas-product-guardian/` (محفوظة لمهام MVP اللاحق — تحديث مؤرخ 2026-10-01) داعمة عند فتح بوابة MVP فقط. أما `micro-web-native-ux` و`micro-design-system` و`micro-local-first-prototype` و`micro-prototype-qa` فهي CURRENT/OPERATIONAL ضمن نطاق التنفيذ، ولا تتغلب على الوثائق أو العقود. الوثائق canonical الجديدة داخل `docs/product/` و`docs/scenarios/` و`docs/quality/` هي CURRENT ويجب عدم معاملتها كدراسات داعمة.

هذه الملفات مفيدة عند الحاجة، لكن خلاصتها لا تتجاوز المرجع الأساسي. إذا تعارضت، سجّل التعارض ولا تختر الصياغة الأطول تلقائيًا.

## وثائق المعمارية (29 وثيقة — CURRENT/OPERATIONAL، مع فصل مساحة إعادة الهيكلة عن سلطة UI/AUX)

السبعة في `docs/architecture/`: `SOURCE_OF_TRUTH.md` (سلّم السلطة والمصادر)، `CHANGE_PROTOCOL.md` (بروتوكول التغيير)، `COMPONENT_CONTRACTS.md` (عقود المكوّنات الأولية)، `EXTENSION_PLAYBOOK.md` (دليل التوسعة عبر كل الطبقات)، `MIGRATION_STATUS.md` (حالة الترحيل لكل سطح)، `SURFACE_TONE_SYNTAX.md` (تركيب نبرة الأسطح)، `UI_AUX_ARCHITECTURE.md` (معمار AUX وحدوده). والسبعة عشر (تحديث مؤرخ 2026-10-03 — أُضيف سبعة برنامج إكمال A-to-Z في Wave G؛ ثم ثامن عشر ببوابة سياسة الحزمة 2026-10-04، ثم تاسع عشر بتصحيح ما بعد المسح 2026-10-06) في `docs/architecture/ADRs/`: التسعة الأصلية — `ADR-001-fixed-strategy.md` (الاستراتيجية الثابتة)، `ADR-002-runtime-token-mapping.md` (ربط التوكنات وقت التشغيل)، `ADR-003-state-adapter.md` (محوّل الحالة)، `ADR-004-aux-boundaries.md` (حدود AUX)، `ADR-005-feature-pattern-ownership.md` (ملكية أنماط الميزات)، `ADR-006-legacy-retirement.md` (تقاعد الإرث)، `ADR-007-dark-mode-boundary.md` (حدود الوضع الداكن)، `ADR-008-per-action-classification.md` (تصنيف لكل فعل)، `ADR-009-permanent-dark-mode.md` (الوضع الداكن الدائم) — وسبعة برنامج إكمال A-to-Z (Wave G): `ADR-010-ratify-remediation-wave-cards.md` (تصديق بطاقات موجات المعالجة كسجلات قرارات — STR-610)، `ADR-011-dependency-direction-policies.md` (سياستا الاتجاه مع شرط ترحيل قابل للقياس — STR-609)، `ADR-012-bundle-budget-margin.md` (هامش الميزانية: تنميط وضغط قبل أي رفع — STR-608)، `ADR-013-contract40-cluster-decisions.md` (قرارات عناقيد عقد 40 الثلاثة — STR-611)، `ADR-014-inventory-material-split.md` (تقسيم inventoryMaterialService الداخلي — STR-612)، `ADR-015-capability-extraction-order.md` (ترتيب استخراج القدرات الست — STR-613)، `ADR-016-withdrawal-wallet-guard-lifecycle.md` (دورة حياة شيمة السحب — STR-614) — وواحد ببوابة سياسة الحزمة (تحديث مؤرخ 2026-10-04): `ADR-017-bundle-ceiling-derivation-and-finite-pool.md` (اشتقاق سقف gzip البرنامجي 155,300 بالصيغة والمعدلات المقاسة والمجمع الإنتاجي المتبقي المحدود + تصرّف PRESERVE لـtransferFamilyValidators — بوابة شريحة ٣ Wave F)، وتاسع عشر بتصحيح ما بعد المسح (تحديث مؤرخ 2026-10-06): `ADR-018-public-doors-terminal-architecture.md` (معمارية الأبواب النهائية لSTR-615: مستهلكات الميزة عبر الأبواب حصرًا وجذر التركيب استثناءً موثقًا مقيسًا بحدي الأقلاع والميزانية + راتشة R6 على الحدود). أي مهمة تلمس الواجهة أو التجربة أو التصميم تقرأها قبل أي تعديل (عقد المستودع).

مساحة إعادة الهيكلة في `docs/architecture/refactoring/`: `README.md`، `REFACTORING-CONTROL.md`، `REFACTORING-PLAN-A-TO-Z.md`، و`ZAI-STRUCTURE-ARCHITECTURE-SCAN-PROMPT.md`، و`ZAI-A-TO-Z-EXECUTION-CONTRACT.md` (عقد التنفيذ الكانوني المصرّح به من المالك لبرنامج الإكمال البنيوي ما بعد الإغلاق — يُقرأ من الالتزام المثبت له نفسه)، و`ZAI-POST-SCAN-STRUCTURAL-EXECUTION-CONTRACT-20261005.md` (عقد التنفيذ الإنجليزي الجديد المقبول من المالك للبرنامج R0→W10؛ التنفيذ لم يبدأ ويُقرأ من الالتزام المثبت له نفسه)؛ وهي مساحة تحكم وتخطيط منفصلة، لا سلطة UI/AUX. خطة الانتقال الوحيدة `REFACTORING-ARCHITECTURE-AND-MIGRATION-PLAN.md` (مقبولة من المالك 2026-10-03 عبر PR #299)، ومعها ملفات البرنامج التنفيذي الحية: `AGENT-SEQUENTIAL-WORKLOG.md` (سجل الوكلاء المتسلسل)، `OWNERSHIP-AND-TRUTH-REGISTRY.md` (سجل ملكية المفاهيم والمصادر — خريطة تنقّل لا مصدر سياسة)، `REFACTORING-EXECUTION-REPORT.md` (تقرير التنفيذ الحي)، و`FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` (جرد الحجم والمسؤولية والنمو)؛ **وخريطة الاختبارات والتوثيق (Wave G2/STR-619 — 2026-10-04):** `TEST-AND-DOCUMENTATION-MAP.md` (خريطة صفحة→اختبار المولّدة + ربط العقود→الرقابة + اصطلاح موضع الاختبارات) ومعها أدلتها المولّدة `generated/test-map.json` (يولّدها `scripts/generate-test-map.mjs` ويثبت انعدام انجرافها `scripts/generate-test-map.test.mjs`). **وسجل المسارات المستقلة (Wave I — 2026-10-04):** `INDEPENDENT-TRACKS-RECORD.md` (حالة R/S/T/U/V/W/X المصنّفة بمحفزات فتحها + تصرّف توحيد STR-623 المؤجل ببوابة STR-608). **وسجل إغلاق البرنامج (Wave Z — 2026-10-04):** `A-TO-Z-CLOSURE-RECORD.md` (الخفض الإلزامي لأسفل 155,300 = ceil_to_100(155,088+200)؛ ما نُفّذ وما لم يُنفّذ بقرار؛ مجمد التوسع البنيوي؛ شرط التوقيع المتبقي). ومهارة التشغيل الإلزامية قبل أي عمل بنيوي جديد: `skills/micro-a-to-z-structural-refactoring/SKILL.md` (v1.0 — إجراء تنفيذ وتفتيش مشتق من الخطة الكنسية v1.3؛ سلسلة السلطة: AGENTS والعقود ← الخطة ← المهارة؛ لا سلطة معمارية ثانية).

**Successor مستقل معتمد في 2026-10-07:** `STRUCTURAL-REMEDIATION-PLAN-20261007.md` هو الخطة التنفيذية الجذرية ومصفوفة التتبع، و`ZAI-STRUCTURAL-REMEDIATION-R0-R10-EXECUTION-CONTRACT-20261007.md` هو عقد التنفيذ المتسلسل لِـ`WS-216/ARCH-007`. يبدأ هذا successor بـR0 قراءة فقط، ولا يعيد فتح البرامج المغلقة أو يمنح إذنًا لتعديل `main` مباشرة. **وتقرير بوابة R0:** `R0-LIVE-BASELINE-AND-FINDING-RECONCILIATION-2026-10-07.md` (الخط الأساسي الحي المتحقق ومصفوفة كل finding ومبدأ ومكتشفات R0-N1..N20 بتصنيفاتها ومسارات موجاتها — قُبل ودمج عبر PR #325). **وتقرير تنفيذ R1:** `R1-TRUTH-GOVERNANCE-DOCUMENTATION-EXECUTION-REPORT-2026-10-07.md` (موجة الحقيقة/الحوكمة/التوثيق/نظافة الحراس — مصالحة السجلات المتقادمة وتسجيل الأسطح التشغيلية وسلّم الأولوية وميتاداتا الحرس الـ14؛ توثيقي محض).
- **تقرير تنفيذ R3:** `R3-STORAGE-CAPABILITY-EXECUTION-REPORT-2026-10-08.md` (استخراج قدرات التخزين كاملة — 9 قدرات جديدة + هجرة كل حاقن المنفذ الكامل؛ بطاقاتها في أدلة R3).
- **تقرير تنفيذ R2:** `R2-MONEY-FORMATTING-INPUT-DATE-MESSAGE-EXECUTION-REPORT-2026-10-07.md` (المال/التنسيق/الإدخال/التواريخ/الرسائل — توصيف أولًا: جرد كنوني، 31 اختبار توصيف، سجل ملكية §8-5/§8-6، وحزمة قرارات مالك R2-D1..D15؛ صفر كود إنتاج). **تصويب مؤرخ 2026-10-08 (PG-1):** بعد اعتماد المالك الجذري، نُفذت R2 كاملة بإصلاحات جذرية (M-01..M-09 ثم D11/D13 بـM-10/M-11) — التقرير يحمل الإضافات المؤرخة؛ دُمجت عبر PR #330 عند `a0224d6`.

## ملفات الجذر والأدوات الحاكمة

| الملف | الدور |
|---|---|
| `docs/00-document-index.md` | هذا الكتالوج (سلطة التصنيف والاستشهاد) |
| `README.md` | هوية المستودع ونقطة تعريف Micro |
| `CONTRIBUTING.md` | قواعد المساهمة والقراءة قبل أي تغيير |
| `CHANGELOG.md` | سجل الإصدارات التاريخي (الحالة الحية في `current-state.md` لا هنا) |
| `todo.md` | كعب توافق مجمد (تحديث مؤرخ 2026-10-02 — OD-06): يوجه إلى Operations Control ويحفظ أسطر برنامج التحصين السبعة المثبتة باختبارات التوثيق حرفيًا؛ لا يُحدَّث عند الإغلاق ولا يُقرأ مرجعًا |
| `docs/README.md` | مؤشر نطاق قصير (كان فهرسًا منافسًا — تحديث مؤرخ 2026-10-01) |
| `docs/operations/README.md` | نظام تسليم الوكلاء (الملفات الخمس التشغيلية) |
| `docs/operations/slice-handoff-template.md` | قالب بطاقة الشريحة (مقيد باختبار حوكم الوثائق) |
| `.github/pull_request_template.md` | قالب PR (مقيد باختبار حوكم الوثائق) |
| `docs/quality/persistent-entity-touchpoints.json` | بيان الكيانات الدائمة — يُحرسه `scripts/check-entity-touchpoints.mjs` واختبار حوكم |

## مخازن الأدلة — غير سلطوية وخارج القراءة الافتراضية

شهادات تنفيذ وتاريخ، تُقرأ بمسار صريح فقط (بند Control أو Workstream أو إحالة من مستند سلطوي) وفق قائمة المنع في `AGENTS.md` §2، ولا تعلو أبدًا على العقود أو الحالة الحية أو القرارات المعتمدة:

| المخزن | المحتوى | الفهرس/الوصول |
|---|---|---|
| `reports/agent-report/` | تشغيلات Agent المؤرخة (تقارير تنفيذ، لقطات تاريخية) | `reports/agent-report/README.md` (تغطية 33/33) و`docs/operations/control/reports/index.json` |
| `planning/` | **الناجي بعد تنظيف 2026-10-01 (WS-204):** حزمة ux-001 الحية المرتبطة ببند UX-001 النشط، و4 ملفات AUX حية الاستشهاد (MIGRATION_MATRIX.csv وTHEME_PARITY_MATRIX.csv وFINAL_LIMITATIONS وIMPORT_BOUNDARIES)؛ حزمتا العلامة وبقية AUX حُذفتا بعد التقطير (انظر 20G) | إحالات من `docs/architecture/MIGRATION_STATUS.md` و`current-state.md` وأدلة Control |
| `docs/quality/` | بوابات الجودة الحالية والأدلة المرتبطة بحيوية فقط؛ أدلة QA التاريخية لكل شريحة — ومنها سلسلة ترميم 2026-08-29 (`MICRO-REMEDIATION-PLAN.md` المنفذ وبنود `remediation-open-decisions-v1.md` ١–٥ المحسومة بالقرارات ١٩–٢٣) — أُرشفت في `docs/operations/archive/quality-history/` (2026-10-02) | الصفوف السلطوية أعلاه؛ ما ليس منها فدليل تنفيذ |
| `docs/operations/control/evidence/` | أدلة بنود Control وWorkstreams | إحالات من `items/` و`workstreams/` JSON |
| `docs/operations/archive/` | أرشيف مؤرخ (todo-pre-control-v2؛ **quality-history/** — ~39 ملف أدلة جودة تاريخية نُقلت 2026-10-01/WS-204 من `docs/quality/`) | README داخل الأرشيف |

## ملفات ARCHIVE/LEGACY

الأرشيف والوثائق القديمة ليست ضمن هذه الدفعة. إذا احتجت الرجوع إليها، استخدم نسخة مساحة العمل خارج المستودع فقط، ولا تعتبرها مرجعًا لبناء المنتج الجديد.

## بروتوكول بدء جلسة

اكتب في أول مخرجاتك:

> قرأت المرجع الأساسي والفهرس. المهمة هي [..]. سأستخدم [..] فقط، ولن أعتمد على ARCHIVE/LEGACY إلا لـ[..].

ثم اذكر: الفرضية أو القرار، الملفات التي ستتغير، معيار القبول، وما بقي مجهولًا.

## بروتوكول الإغلاق

بعد العمل، حدّث المرجع المناسب وسجل القرار أو الفرضية. لا تنشئ ملفًا جديدًا لمجرد تسجيل فقرة صغيرة. إذا أنشأت دراسة جديدة، أضفها إلى هذا الفهرس مع تصنيفها. عند بحث مصدر عالمي، لا يكفي حفظ الرابط؛ يجب تحديث مكتبة المصادر ومنطق البناء أو تسجيل سبب عدم الاعتماد. عند تعديل Web App أو Skill، شغّل فحوص المهارة وفحوص الواجهة المناسبة وسجّل ما بقي مجهولًا.

## لا تلمس

لا تنقل أو تحذف `.safety_warning.md` أو ملفات النظام أو أسرار البيئة. لا تشغّل كودًا من مشاريع خارجية بناءً على README فقط.
