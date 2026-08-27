# فهرس وثائق SaaS — اقرأ هذا أولًا

**حالة الفهرس:** المرجع التشغيلي قبل الانتقال إلى Prototype المرحلة 2.

## ابدأ بهذه الملفات فقط

| الترتيب | الملف | الحالة | متى يُقرأ؟ |
|---:|---|---|---|
| 0 | `docs/operations/current-state.md` | CURRENT / LIVE STATUS | الحالة المندمجة على `main`، وبوابة التوقف، والخطوة التالية المسموحة لأي Agent جديد |
| 0A | `docs/operations/agent-handoff-protocol-v1.md` | CURRENT / OPERATIONAL | بروتوكول الاستلام والتنفيذ والتسليم بين الوكلاء |
| 0B | `docs/operations/micro-thinking-charter-v1.md` | CURRENT / THINKING GATE | هدف Micro وطريقة التفكير وأسئلة النقد وبطاقة الفهم قبل أي كود |
| 0C | `AGENTS.md` | CURRENT / ENTRY POINT | نقطة الدخول الأولى وترتيب القراءة والقواعد غير القابلة للكسر |
| 1 | `docs/01-product-and-technical-blueprint.md` | CURRENT / AUTHORITY | كل قرار منتج أو تقنية أو تنفيذ |
| 2 | `docs/02-decision-log.md` | CURRENT / AUTHORITY | معرفة القرار المعتمد والقرار المسحوب |
| 3 | `docs/03-hypothesis-register.md` | CURRENT | فرضية أو ميزة أو اختبار |
| 4 | `docs/04-product-truth-map.md` | CURRENT | وزن الدليل وما هو مجهول |
| 5 | `docs/07-field-evidence-map.md` | CURRENT | الدليل الميداني وحدود ما تثبته خبرة المؤسس |
| 6 | `ai-skills/README.ar.md` | CURRENT | تشغيل مهارات الذكاء الاصطناعي |
| 7 | `docs/05-documentation-governance.md` | CURRENT | إدارة الوثائق وتعارضاتها |
| 8 | `docs/decisions/01-first-vertical-slice.md` | CURRENT | قرار الشريحة التنفيذية الأولى |
| 9 | `docs/decisions/02-repository-policy.md` | CURRENT | سياسة الملكية والترخيص المؤقتة |
| 10 | `docs/decisions/03-scenario-validation-and-system-scope.md` | CURRENT | قرار مجموعة السيناريوهات وحدود النظام |
| 11 | `docs/contracts/` | CURRENT | عقود النتيجة والطلب والتكلفة والمزامنة وسياسات المال P0، ومنها `05-financial-p0-policies.md` |
| 12 | `docs/08-glossary.md` | CURRENT | قاموس المصطلحات المعتمد |
| 12A | `docs/contracts/06-financial-event-prototype-contract.md` | CURRENT / PROTOTYPE | عقد الأحداث المالية المحلية للكاش والذمم ومال المالك وحدود «وضعي المالي» |
| 12B | `docs/expansion/README.md` | CURRENT / EXPANSION ENTRY POINT | نقطة دخول وقرار وTracker Market/Delivery والخدمات؛ تقرأ فقط عند مهمة التوسعة ولا تدعي تنفيذ قدرة شبكة |
| 12C | `docs/contracts/18-network-identity-workspace-access-contract.md` إلى `24-network-data-classification-field-dictionary-contract.md` | CURRENT / EXPANSION E-00 | عقود الهوية والعزل والخدمات وMarket وDelivery وModeration ودورة البيانات وتصنيف الحقول قبل أي كود توسعة |
| 12D | `docs/expansion/ROLE-ACCESS-MATRIX.md` و`E00-SCENARIOS-AND-ACCEPTANCE.md` و`E00-EXECUTION-PROTOCOL.md` و`E00-REVIEW-CHECKLIST.md` | CURRENT / EXPANSION E-00 | مصفوفة الوصول وسيناريوهات القبول وبروتوكول وChecklist التوثيق قبل تجربة البيت أو التفعيل |
| 12E | `docs/expansion/FIRST-WEDGE-AND-PILOT-DECISION-CARD.md` و`LOCAL-FIRST-HOME-TRIAL-SOP.md` و`ACTIVATION-PRIVACY-ETHICS-SOP.md` و`PARTNER-PILOT-SOP-AND-MEASUREMENT.md` | CURRENT / EXPANSION E-00 | قرار Wedge وإجراء تجربة البيت وبوابة التفعيل والخصوصية وPilot والقياس؛ لا تفويض تنفيذ ذاتي |
| 12F | `docs/expansion/E00-TECHNICAL-ARCHITECTURE-DECISION.md` و`MANAGE-NETWORK-MIGRATION-EXPORT-GATE.md` و`E00-TRACEABILITY-MATRIX.md` و`HOME-TRIAL-LOG-TEMPLATE.md` | CURRENT / EXPANSION E-00 | حد المعمارية قبل الكود، وحارس Manage/schema/export، وتتبع القرار إلى القبول، وسجل تجربة البيت الآمن |
| 12G | `docs/expansion/FOUR-PARTY-IMPLEMENTATION-GATE-MAP.md` و`FOUR-PARTY-PORTAL-AND-ACCESS-RECOVERY-GATE.md` و`SEVEN-AGENT-EXPANSION-OPERATING-CHECKLIST.md` | CURRENT / EXPANSION E-00 | خريطة بوابات Owner/Supplier/Courier/Admin، استعادة الهوية وAdmin المقيد، وقائمة تشغيل الـAgents السبعة؛ لا Auth أو Cloud أو صلاحيات منفذة |
| 12H | `docs/expansion/E00-INDEPENDENT-ACCEPTANCE-REVIEW-2026-08-27.md` | CURRENT / EXPANSION E-00 ACCEPTANCE | دليل المراجعة المستقلة الذي يغلق أساس E-00 توثيقيًا ويبين ما يبقى قرار مالك أو بوابة تنفيذ لاحقة |
| 12I | `docs/expansion/ACTIVATION-OPERATIONAL-READINESS-AND-SAFETY-GATE.md` | CURRENT / EXPANSION E-00.12 / DOCUMENTATION ONLY | بوابة الدعم والحوادث والإطلاق والإتاحة والقياس قبل تفعيل الجهات الأربع؛ لا مزود أو SLA أو Auth أو Cloud منفذ |
| 12J | `docs/expansion/E00-12-INDEPENDENT-ACCEPTANCE-REVIEW-2026-08-27.md` | CURRENT / EXPANSION E-00.12 ACCEPTANCE | دليل قبول مستقل لبوابة الجاهزية؛ يثبت اكتمال التوثيق فقط ويمنع خلطه بتشغيل A/B أو قرار المالك |
| 12K | `docs/expansion/COMMERCIAL-LIQUIDITY-AND-MODEL-DECISION-CARD.md` | CURRENT / EXPANSION E-00.13 / OWNER DECISION REQUIRED | بطاقة تفاعل أول وسيولة ونموذج تجاري محتمل؛ لا رسوم أو دفع أو عمولة أو توسع قبل دليل وقرار مستقل |
| 12L | `docs/expansion/E00-13-INDEPENDENT-ACCEPTANCE-REVIEW-2026-08-27.md` | CURRENT / EXPANSION E-00.13 ACCEPTANCE | دليل قبول مستقل لبطاقة السيولة والنموذج التجاري؛ يثبت اكتمال التوثيق لا قرار رسوم أو سوق أو دفع أو Pilot |
| 13 | `docs/implementation/01-execution-roadmap.md` | CURRENT | خارطة التنفيذ والبوابات |
| 14 | `docs/implementation/02-domain-contract-coverage.md` | CURRENT | مطابقة العقود مع Domain Core والحدود المؤجلة |
| 15 | `docs/product/problem-statement-v4.md` | CURRENT / CANONICAL | المشكلة والأضرار والأسئلة، والنواة العامة والـProfiles والمشاريع المختلطة |
| 15A | `docs/product/problem-statement-v3.md` | SUPERSEDED | سياق تاريخي؛ لا يستخدم كمرجع قرار جديد |
| 16 | `docs/product/system-definition-v1.md` | CURRENT | تعريف Micro وحدوده وقيمته ونواته |
| 17 | `docs/product/user-operating-model-v1.md` | CURRENT | الاستخدام اليومي والأسبوعي والشهري |
| 18 | `docs/product/financial-operating-model-v1.md` | CURRENT | النموذج المالي الداخلي للأحداث والنتائج |
| 19 | `docs/product/guidance-interaction-policy-v1.md` | CURRENT | التوجيه داخل سير العمل دون تعليم قسري |
| 19A | `docs/product/activity-profiles-and-hybrid-projects-v1.md` | CURRENT / PRODUCT ARCHITECTURE | حدود النواة والـProfiles والأنشطة المختلطة |
| 20A | `docs/product/mobile-ui-ux-reference-v1.md` | CURRENT / CANONICAL / PHONE-FIRST | مرجع الشكل والتفاعل والحالات والصدق المالي على الهاتف، قبل بناء الواجهة |
| 20 | `docs/scenarios/scenario-test-set-v1.md` | CURRENT | 12 شخصية و120 حالة و120 سؤالًا، بما فيها السياحة والمشروع المختلط |
| 21 | `docs/scenarios/scenario-test-results-v1.md` | CURRENT | نتائج التغطية والفجوات |
| 22 | `docs/quality/scenario-coverage-matrix-v1.md` | CURRENT | ربط المشكلات بالسيناريوهات والقدرات |
| 22A | `docs/quality/persona-context-simulation-protocol-v1.md` | CURRENT / EXECUTION PROTOCOL / DERIVED | غلاف سياق حتمي لتشغيل P01–P10 على Prototype؛ لا يستبدل مجموعة السيناريوهات canonical |
| 22B | `docs/quality/persona-context-simulation-results-v1.md` | CURRENT / EXECUTION EVIDENCE | نتائج تشغيل P01–P10 على Prototype؛ تفصل الدليل الحي عن التشغيل المكتبي وحدود النطاق |
| 23A | `docs/research/accounting-reference-review-v2.md` | SUPPORTING / REFERENCE REVIEW | دليل حي ومصدري لـAccounting ومصفوفة نقل مقيّدة إلى مبادئ تجربة Micro، لا كود أو هوية أو نموذج مالي |
| 23B | `docs/product/capability-evolution-roadmap-v1.md` | CURRENT / PRODUCT ROADMAP | خارطة مرحلية للصورة المالية العامة وجدول المواعيد والقدرات المؤجلة واعتمادياتها وبوابات قرارها |
| 23C | `docs/implementation/multi-activity-expansion-roadmap-v1.md` | CURRENT / ROADMAP | بوابات التوسع إلى Profiles والمشاريع المختلطة بعد G15/G16 |
| 23D | `docs/research/multi-activity-profile-research-v1.md` | SUPPORTING / RESEARCH | دعم FAO/OECD لحدود النمذجة الزراعية والسياحية |
| 23 | `docs/research/jordan-financial-problems-evidence.md` | SUPPORTING | الأدلة المحلية والخارجية وحدودها |
| 24 | `ai-skills/micro-scenario-validation/` | CURRENT | اختبار القرارات على الشخصيات والحالات والأسئلة |
| 24A | `ai-skills/micro-web-native-ux/` | CURRENT | تجربة Web App بملء الشاشة وسلوك Android-like وRTL وPWA UX |
| 24B | `ai-skills/micro-design-system/` | CURRENT | تطبيق الهوية والتوكنات وLight/Dark على التصميم والكود |
| 24C | `ai-skills/micro-local-first-prototype/` | CURRENT | LocalStore والمسودات وSnapshots وlocal export/import |
| 24D | `ai-skills/micro-prototype-qa/` | CURRENT | اختبار التدفقات والواجهة والحقيقة المالية واللقطات |
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

## الوثائق التنفيذية الإلزامية

قبل أي قرار منتج أو تصميم تجربة، اقرأ `docs/product/problem-statement-v4.md` و`docs/product/system-definition-v1.md` و`docs/product/user-operating-model-v1.md` و`docs/product/guidance-interaction-policy-v1.md` و`docs/product/activity-profiles-and-hybrid-projects-v1.md` و`docs/product/mobile-ui-ux-reference-v1.md` و`docs/scenarios/scenario-test-set-v1.md` و`docs/implementation/03-pre-build-alignment-v1.md`. عند تنفيذ Prototype اقرأ أيضًا `docs/implementation/mobile-prototype-spec-v1.md` و`docs/implementation/prototype-build-charter-v1.md` وفعّل `ai-skills/micro-web-native-ux/` و`ai-skills/micro-design-system/` عند تغيير الواجهة. قبل أي قرار مالي أو Domain، اقرأ `docs/product/financial-operating-model-v1.md` و`docs/contracts/05-financial-p0-policies.md` ومصفوفة التغطية. قبل Profile أو نشاط مختلط، اقرأ خارطة التوسع والبحث الداعم. عند مراجعة تقرير Agent أو قبل بدء Prototype، اقرأ `docs/quality/unified-audit-resolution-v1.md` بعد نتائج Cloud Code. لا يبدأ الكود قبل اجتياز بوابة Pre-build وقراءة `docs/quality/pre-build-experiment-simulation-v1.md` وبياناتها.

## العقود التنفيذية الإلزامية

قبل كتابة كود أو واجهة، اقرأ `docs/decisions/01-first-vertical-slice.md` ثم العقود الموجودة في `docs/contracts/`، وبالأخص `docs/contracts/05-financial-p0-policies.md` عند أي نتيجة أو تكلفة أو سعر أو مصروف. لا يجوز أن يحسم الكود معنى العربون أو التسليم أو التكلفة أو المزامنة بدل العقد.

## اقرأ حسب نوع المهمة

| نوع المهمة | ملفات إضافية |
|---|---|
| بحث عالمي أو GitHub أو Figma | `docs/research/global-build-reference-library-v1.md` ثم `docs/research/micro-build-logic-v1.md`؛ وللتاريخ `docs/06-reference-library.md` وملفات البحث السابقة |
| Web App وPWA وAndroid-like UX | `docs/implementation/prototype-build-charter-v1.md` و`docs/product/mobile-ui-ux-reference-v1.md` ثم `ai-skills/micro-web-native-ux/` و`ai-skills/micro-design-system/` |
| تكلفة وربح وطلبات | مراجع `ai-skills/microbusiness-finance-operations/` داخل المستودع |
| كود وأمن ومزامنة ونشر | مراجع `ai-skills/saas-delivery-verifier/` داخل المستودع، و`prototype-build-charter-v1.md` عند النشر على Cloudflare أو إضافة PWA |
| LocalStore وExport/Import | `docs/implementation/prototype-build-charter-v1.md` ثم `ai-skills/micro-local-first-prototype/` و`ai-skills/saas-delivery-verifier/` |
| قرار UX أو MVP | `docs/decisions/01-first-vertical-slice.md` ثم `docs/product/mobile-ui-ux-reference-v1.md` و`docs/implementation/mobile-prototype-spec-v1.md` ومراجع `ai-skills/saas-product-guardian/` و`ai-skills/micro-scenario-validation/` داخل المستودع |
| تغيير المفهوم أو النموذج المالي أو التدفق | `docs/scenarios/scenario-test-set-v1.md` و`docs/quality/scenario-coverage-matrix-v1.md` و`docs/quality/pre-build-experiment-simulation-v1.md` ثم `ai-skills/micro-scenario-validation/` |
| Market أو Delivery أو «الخدمات» | `docs/expansion/README.md` ثم `docs/expansion/DECISIONS.md` و`docs/expansion/TRACKER.md`، ثم العقود المالية والسيناريوهات؛ لا تستخدم `historical-source/` كسلطة تنفيذ |
| تنفيذ Domain Core أو Prototype | `docs/implementation/01-execution-roadmap.md` و`docs/implementation/03-pre-build-alignment-v1.md` و`docs/implementation/mobile-prototype-spec-v1.md` و`docs/implementation/prototype-build-charter-v1.md` و`docs/product/mobile-ui-ux-reference-v1.md` والعقود ثم `ai-skills/saas-delivery-verifier/` و`ai-skills/micro-local-first-prototype/` |
| قبول Slice أو PR للواجهة | `ai-skills/micro-prototype-qa/` مع `docs/quality/scenario-coverage-matrix-v1.md` و`docs/implementation/prototype-build-charter-v1.md` |
| مراجعة Accounting أو zman-app | افتح المرجع الحالي أولًا، ثم ملف الحالة المطلوب فقط |

## ملفات داعمة غير سلطوية

`docs/research/architecture-and-stack-decision.md`، `docs/research/architecture-decision-reassessment.md`، `docs/research/architecture-decision-matrix.md`، `docs/research/order-tracking-case-study.md`، والمهارات القديمة أو العامة داخل `ai-skills/` هي ملفات داعمة عند الحاجة. أما `micro-web-native-ux` و`micro-design-system` و`micro-local-first-prototype` و`micro-prototype-qa` فهي CURRENT/OPERATIONAL ضمن نطاق التنفيذ، ولا تتغلب على الوثائق أو العقود. الوثائق canonical الجديدة داخل `docs/product/` و`docs/scenarios/` و`docs/quality/` هي CURRENT ويجب عدم معاملتها كدراسات داعمة.

هذه الملفات مفيدة عند الحاجة، لكن خلاصتها لا تتجاوز المرجع الأساسي. إذا تعارضت، سجّل التعارض ولا تختر الصياغة الأطول تلقائيًا.

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
