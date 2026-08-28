# Expansion — نقطة الدخول الحاكمة لـMicro Market وMicro Delivery

**الحالة:** `CURRENT / DECISION AND TRACKER / NO EXPANSION CODE YET`
**آخر مراجعة:** 28 أغسطس 2026.
**الغرض:** هذه نقطة الدخول الوحيدة لأي Agent أو مراجع يعمل على Market أو Delivery أو نقاط دخولهما. تجمع القرار الذي اعتمده المالك، وحدود المرحلة المحلية، وتسلسل العقود والبناء. لا تحل محل `current-state.md` عند وصف ما اندمج فعليًا.

## Major Discussion Points

## 1. الفكرة التي لا يجوز أن يخطئها أي Agent

يرى المالك **Micro واحدًا**: نظامه لإدارة المشروع ماليًا وتشغيليًا. لا تعرض له صفحة اختيار ثلاثة منتجات، ولا تطلب منه تهيئة مال أو مخزون كي يصل إلى مورد أو ترتيب حركة.

> **`السوق` وجهة Market مستقلة في BottomNav، ورمز السيارة يفتح قسم Delivery مستقلاً من AppBar. لا تعرض Micro صفحة اختيار منتجات أو Dashboard خدمات مركزية.**

يبقى `Micro Manage` مركز إدارة المشروع. أما Market وDelivery فهما قدرتان متصلتان تظهران داخل Micro عندما توجد متابعة أو نية واضحة. في المقابل، المورد وشركة التوصيل لا يدخلان Manage؛ لهما بوابات دور مستقلة ومقيدة عند مرحلة التفعيل الحقيقي. وAdmin هو دور داخلي محدود للمراجعة والسياسة، لا مدير مال للمالك ولا مشغل يومي للسوق.

| الشخص | ما يراه في التصور النهائي | ما لا يراه أو يفعله |
|---|---|---|
| Owner | Manage، السوق، التوصيل، واحتياجاته وردود الموردين وطلبات الحركة الخاصة به ضمن مصدرها. | مال أو طلبات جهة أخرى، بوابة مورد/شركة أخرى، قرار Moderation. |
| Supplier member | Listings جهته، صورها، والاحتياجات/التفاعلات التي تسمح السياسة بالرد عليها. | ربح/كاش/ذمم Owner، عملاؤه، ردود المنافسين، بيانات ليست لازمة للتفاعل. |
| Courier member | عروض ومهام جهة التوصيل، والحد الأدنى من بيانات المهمة في مرحلتها الصحيحة. | كاش/ربح Owner، أسعار Market غير اللازمة، مهام جهة أخرى، تفاصيل عميل مبكرة. |
| Admin | طابور مراجعة الوسائط والعروض والبلاغات، مع سجل قرار وسبب. | Manage المالي، تعديل صامت لحالة خارج السياسة، بيانات لا تحتاج المراجعة إليها. |

## 2. قواعد لا تقبل الاستثناء

| القاعدة | معناها العملي |
|---|---|
| Micro واحد للمالك | السوق والتوصيل قدرتان داخل Micro لا منتجات مستقلة؛ Market وجهة واحدة في BottomNav وDelivery قسم من رمز AppBar، لا صفحة تسويق لثلاثة منتجات. |
| المال محلي وصاحب المشروع يقر الواقعة | قبول عرض Market أو حالة `arrived`/`completed` في Delivery لا ينشئ شراءً أو كاشًا أو COGS أو مخزونًا أو تسليمًا أو قبضًا. |
| السياق اختياري ومكشوف | لا يخرج من Manage إلا ما اختاره Owner صراحةً، ويستطيع مراجعته وتعديله قبل النشر أو الإفصاح. |
| التنبيه في مصدره | Badge أو Notification من Market تظهر في السوق، ومن Delivery تظهر في التوصيل؛ لا Dashboard خدمات مركزية ولا Feed طويل ولا رقم نشاط استعراضي. |
| التجربة المحلية ليست أمنًا | Role simulator المحلي يختبر المنطق والواجهة فقط. لا يدعي حماية بين أشخاص أو أجهزة مختلفة. |
| لا توسع منصة مبكر | لا Checkout أو دفع أو عمولة أو تقييمات/نجوم أو Chat مفتوح أو توصية تلقائية أو تتبع حي أو Dispatch أو Driver Portal في البداية. |
| لا علاقة تلقائية بين الشبكة والمال | أي اقتراح لتسجيل واقع في Manage يمر عبر فعل صريح ومراجعة Owner، ولا يملأ مبلغًا أو تاريخًا أو نوعًا قسرًا. |

## 3. ما هو منفذ وما ليس منفذًا

| المجال | الحقيقة |
|---|---|
| Micro Manage | موجود محليًا على `main` وفق `docs/operations/current-state.md`؛ طريقه الإلزامي UI → Application → Domain → LocalStore → IndexedDB. |
| Market / Delivery | **قرار وتصميم فقط**؛ لا Domain أو LocalStore أو صفحة أو ربط شبكة منفذ لهذه التوسعة على `main` بعد. |
| Auth / Cloud / API / Webhooks / Push | غير منفذ وغير مصرح في التجربة المنزلية المحلية. لا يفترض Agent وجودها. |
| محاكي الأدوار | قرار للـQA المحلي لاحقًا، وليس Login أو Authorization أو بوابة حية. |
| المورد/شركة التوصيل/Admin الحقيقيون | لا دعوات ولا وصول خارجي قبل بوابة التفعيل متعدد الأطراف. |

## 4. ترتيب القراءة الإلزامي

أي Agent يبدأ مهمة توسعة يكتب أولًا أنه قرأ هذه الملفات بالترتيب، ويذكر المهمة وملفاتها وحدودها ومعيار قبولها وما بقي مجهولًا.

1. [`docs/operations/current-state.md`](../operations/current-state.md) ثم `git fetch origin --prune` لمعرفة `main` والـPRات الحية.
2. [`AGENTS.md`](../../AGENTS.md) و[`docs/00-document-index.md`](../00-document-index.md) و[`docs/operations/micro-thinking-charter-v1.md`](../operations/micro-thinking-charter-v1.md).
3. هذا الملف، ثم [`DECISIONS.md`](DECISIONS.md) و[`TRACKER.md`](TRACKER.md).
4. عقود E-00: `docs/contracts/18-network-identity-workspace-access-contract.md` إلى `24-network-data-classification-field-dictionary-contract.md`، ثم [`ROLE-ACCESS-MATRIX.md`](ROLE-ACCESS-MATRIX.md) و[`E00-SCENARIOS-AND-ACCEPTANCE.md`](E00-SCENARIOS-AND-ACCEPTANCE.md) و[`E00-EXECUTION-PROTOCOL.md`](E00-EXECUTION-PROTOCOL.md).
5. عقود Manage المالية: `docs/contracts/05-financial-p0-policies.md` و`docs/product/financial-operating-model-v1.md` و`docs/implementation/02-domain-contract-coverage.md`.
6. `docs/scenarios/scenario-test-set-v1.md` و`docs/quality/scenario-coverage-matrix-v1.md`، ثم بوابة `docs/implementation/03-pre-build-alignment-v1.md`.
7. [`MARKET-DELIVERY-OWNER-IA-CONTRACT.md`](MARKET-DELIVERY-OWNER-IA-CONTRACT.md) و[`EXPANSION-GLOSSARY.md`](EXPANSION-GLOSSARY.md) و[`E00-TRACEABILITY-MATRIX.md`](E00-TRACEABILITY-MATRIX.md) و[`E00-REVIEW-CHECKLIST.md`](E00-REVIEW-CHECKLIST.md) و[`E00-INDEPENDENT-ACCEPTANCE-REVIEW-2026-08-27.md`](E00-INDEPENDENT-ACCEPTANCE-REVIEW-2026-08-27.md) و[`E00-TECHNICAL-ARCHITECTURE-DECISION.md`](E00-TECHNICAL-ARCHITECTURE-DECISION.md) و[`MANAGE-NETWORK-MIGRATION-EXPORT-GATE.md`](MANAGE-NETWORK-MIGRATION-EXPORT-GATE.md).
8. [`FOUR-PARTY-IMPLEMENTATION-GATE-MAP.md`](FOUR-PARTY-IMPLEMENTATION-GATE-MAP.md) و[`FOUR-PARTY-PORTAL-AND-ACCESS-RECOVERY-GATE.md`](FOUR-PARTY-PORTAL-AND-ACCESS-RECOVERY-GATE.md) و[`SEVEN-AGENT-EXPANSION-OPERATING-CHECKLIST.md`](SEVEN-AGENT-EXPANSION-OPERATING-CHECKLIST.md) لتثبيت بوابات الجهات الأربع والاستعادة وتوزيع العمل قبل أي Agent أو كود.
9. [`ACTIVATION-OPERATIONAL-READINESS-AND-SAFETY-GATE.md`](ACTIVATION-OPERATIONAL-READINESS-AND-SAFETY-GATE.md) و[`E00-12-INDEPENDENT-ACCEPTANCE-REVIEW-2026-08-27.md`](E00-12-INDEPENDENT-ACCEPTANCE-REVIEW-2026-08-27.md) لتحديد وقبول توثيق دعم وحوادث وإطلاق تدريجي وإتاحة وقياس Pilot بحدود صادقة؛ لا يختاران مزودًا أو SLA أو قانونًا أو يصرحان بتنفيذ A/B.
10. [`FIRST-WEDGE-AND-PILOT-DECISION-CARD.md`](FIRST-WEDGE-AND-PILOT-DECISION-CARD.md) و[`COMMERCIAL-LIQUIDITY-AND-MODEL-DECISION-CARD.md`](COMMERCIAL-LIQUIDITY-AND-MODEL-DECISION-CARD.md) و[`E00-13-INDEPENDENT-ACCEPTANCE-REVIEW-2026-08-27.md`](E00-13-INDEPENDENT-ACCEPTANCE-REVIEW-2026-08-27.md) قبل L-00 لتحديد Wedge والتفاعل والسيولة وقرار الإيراد المستقبلي بحدود صادقة، ثم [`LOCAL-FIRST-HOME-TRIAL-SOP.md`](LOCAL-FIRST-HOME-TRIAL-SOP.md) و[`HOME-TRIAL-LOG-TEMPLATE.md`](HOME-TRIAL-LOG-TEMPLATE.md) و[`ACTIVATION-PRIVACY-ETHICS-SOP.md`](ACTIVATION-PRIVACY-ETHICS-SOP.md) و[`PARTNER-PILOT-SOP-AND-MEASUREMENT.md`](PARTNER-PILOT-SOP-AND-MEASUREMENT.md).
11. [`HISTORICAL-SOURCES.md`](HISTORICAL-SOURCES.md) فقط إذا احتاج سببًا تاريخيًا أو تفصيلًا لم يعد داخل القرار الحاكم؛ لا يستخدم أي ملف تحته كتعليمات تنفيذ.

## 5. طريقة العمل على التوسعة

لا يفتح Agent كودًا بسبب أن فكرة شاشة تبدو جاهزة. يبدأ من **موقف مستخدم وضرر ونتيجة وفعل تالٍ**، ثم يكتب/يحدّث العقد، ويربطه بسيناريو، ويحدد ما لا يفعله. عند وجود احتمال لتغيير `localSchemaVersion` أو `localExportVersion` أو معنى مال/تاريخ/Snapshot أو نقل بيانات Manage إلى طبقة شبكة: يتوقف، ويكتب قرار Migration/Export/Import مستقلًا ولا يخمن.

| نوع العمل | المسموح الآن بالتوازي مع برنامج UX | المؤجل حتى البوابة المناسبة |
|---|---|---|
| توثيق | Tracker، عقود، مصفوفة وصول، سيناريوهات، سجل قرار، قوالب QA، وتنظيم المصادر. | لا شيء يمنع هذا ما دام لا يغير تعريف المال أو سلوك UI الحالي. |
| تصميم | wireframe نصي وcopy وحالات Market وDelivery داخل وثائق. | لا تعديل App Shell أو Home أو BottomNav قبل بوابة L-00 وقرار Wedge. |
| كود محلي | لا يبدأ قبل العقود ودمج UX ذات الصلة. | لا Market/Delivery UI، ولا LocalStore أو schema/export أو محاكي أدوار الآن. |
| تفعيل متصل | لا يبدأ في L. | هوية، Cloud DB، صلاحيات، ملفات، إشعار متصل، دعوات، أو Pilot حقيقي. |

## Action Points

1. المصدر التنفيذي التفصيلي هو [`TRACKER.md`](TRACKER.md). لا تتجاوز بندًا أو تؤشر عليه لمجرد كتابة وثيقة أو نجاح build.
2. قبل أول كود نكمل **E-00: العقود والسيناريو ومصفوفة الوصول والبوابات والاستعادة والجاهزية التشغيلية وقرار السيولة/النموذج التجاري وقبول الحزمة المستقل** فقط، ثم يقرر المالك أول Slice ونقطة تجربة البيت.
3. أغلقت G19–G23؛ لكن لا تبدأ أول واجهة توسعة داخل Micro قبل قبول E-00.14 وL-00 وقرار Wedge، لأن السوق ورمز Delivery يمسان App Shell والملاحة.
4. قبل دعوة أي شخص حقيقي نكمل بوابة التفعيل A: هوية، Workspace، API/DB authorization، عزل ملفات، اختبارات اختراق صلاحيات، وسجل تدقيق.

## References

[1]: [Tracker التوسعة الحاكم](TRACKER.md)
[2]: [قرارات التوسعة المعتمدة](DECISIONS.md)
[3]: [سجل المصادر والأرشيف](HISTORICAL-SOURCES.md)
[4]: [حالة Micro التشغيلية الحية](../operations/current-state.md)
