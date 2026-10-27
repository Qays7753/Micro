# Micro — جدول مراحل التنفيذ وبطاقاتها

**النسخة:** V1 · **التاريخ:** 2026-10-27 — عمّان.
**الحالة:** جدول المراحل منشور ضمن S01 للمراجعة؛ S01 `DELIVERED_FOR_REVIEW`، وS02–S18 `PLANNED_REVIEW` بلا أوامر تنفيذ.

**الاقتراح:** 18 مرحلة S01..S18: تجهيز توثيقي، و16 شريحة تطوير، وقبول تكامل نهائي. العدد مبني على فصل الكتّاب والعقود والقراء، ويحتاج مراجعة Manus؛ لا يساوي 45 مكونًا ولا المجموعات السبع. S01 `DELIVERED_FOR_REVIEW`، وS02–S18 `PLANNED_REVIEW`؛ لا أمر تنفيذ جاهز.

الأرقام تسلسل عمل لكاتب واحد. شروط البدء أدناه تبعيات فعلية، وليست كل علاقة جوار. الرأس الحي لكل مرحلة يرث جميع commits المراحل المقبولة السابقة ولو لم تكن كلها تبعيات وظيفية مباشرة.

| المرحلة | الهدف | UNIT داخل النطاق | شروط البدء |
|---|---|---|---|
| S01 | تثبيت الحزمة والسلطة وخط الأساس | توثيق / قبول برنامج | رأس main حي وتكليف تجهيز |
| S02 | حماية الكتابة والاستعادة وإزالة القفل | 042, 044 | S01 |
| S03 | بداية المشروع وبياناته وإعداداته الأساسية | 001, 038, 039 | S02 |
| S04 | النقد ومال المالك والقياس والتخصيص | 020, 022, 023, 024, 025 | S02, S03 |
| S05 | العملاء والموردون عند الحاجة | 037 | S02, S03 |
| S06 | المصروف والمتكرر والفاتورة المشتركة | 015, 019 | S04, S05 |
| S07 | المشتريات والمخزون الاختياري | 027, 028 | S04, S05, S06 |
| S08 | الأصول والمعدات دون تعقيد | 034 | S04, S07 |
| S09 | بناء الطلب وتكلفته والمنتج القابل لإعادة الاستخدام | 007, 008, 029 | S02, S05, S06, S07 |
| S10 | الأدوات المستقلة ومحفوظات الحاسبة | 030, 031, 032 | S09 |
| S11 | البيع المباشر والتسجيل السريع والتحصيل منه | 004, 005, 026 | S04, S05, S07, S09 |
| S12 | اتفاق الطلب وتنفيذه وتسليمه وتسويته | 009, 010, 011, 026 | S04, S05, S07, S09, S11 |
| S13 | إدارة الطلبات والتقويم والمتابعة الموحدة | 006, 012, 018 | S06, S11, S12 |
| S14 | بدء التسجيل من الماضي والعودة بعد الانقطاع | 002 | S03, S04, S05, S06, S07, S08, S11, S12 |
| S15 | المالية والكشف والسجل والميزانيات وإيقاف القدرات الملغاة | 013, 013B, 016, 017, 021, 035, 036, 040 | S06, S07, S08, S11, S12, S14 |
| S16 | الرئيسية والتنقل والوصول للخدمات | 003, 014, 041, 043 | S10, S13, S15 |
| S17 | فحص البيانات وتجربة النسخ النهائية | 033, 044 | S14, S15, S16 |
| S18 | القبول المتكامل وتجهيز الدمج النهائي | توثيق / قبول برنامج | S17 |

## منع إعادة البناء ونصف التنفيذ

لكل SH مالك بناء واحد. المستهلك اللاحق قد يضيف محولًا عند صاحبه ويختبره، دون نسخ الأصل. أي كتابة ذرية أو معنى مالي قائم يتكامل مع منتج البيانات في مرحلته؛ لا يترك قارئ قديم يخصم التكلفة مرتين أو يسمي القبض إيرادًا انتظارًا لتصميم المالية في S15.

إغلاق شريحة لا يغلق مكونًا كاملًا إذا بقي له تكامل لازم. يثبت RESULT ما اكتمل وما بقي ومالكه. مثال 044: حماية الاستبدال في S02، ونقل كل عائلة عند تغييرها، والتجربة والمصالحة الشاملة في S17؛ لا تؤجل المهاجرات جميعها إلى النهاية.

## بطاقات المراحل — تخطيط، وليست أوامر تشغيل

### S01 — تثبيت الحزمة والسلطة وخط الأساس

**الحالة:** `DELIVERED_FOR_REVIEW` على فرع التكامل؛ لا أمر ZAI ولا انتقال إلى S02.

**المواصفات:** توثيق أو قبول برنامج؛ لا مكون منتج جديد، و[العقد المشترك](02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md)، وفصول P3 وA/B ذات الصلة.

**الهدف:** نشر الحزمة وفهرستها، ومصالحة مواصفات 001/002 السابقة مع ACC-01 وPD-01 وPD-02، وتثبيت فرع التكامل الواحد وحالات القبول في المراجع القائمة. لا تعديل لكود المنتج.

**الذرية والعمل المشترك:** عمل توثيقي ينشره مانوس وفق تكليف النشر. وجود المواصفات وحده لا يفتح واجهة 002 ولا يمنح إذنًا ضمنيًا بتغيير مخطط أو قاعدة مالية.

**البيانات والنقل:** تثبيت schema 38 / export 30 كخط أساس حالي. تحدد فروق السلطة والأرقام المحروسة التي تحتاج اعتمادًا ملموسًا قبل المرحلة المتأثرة.

**القبول المطلوب:** نجاح حراس الوثائق والفهرس وOperations Control، وفحص الروابط والبصمات ومصدر كل نسخة. لا سجل حالة منافس ولا أصلان قابلان للتعديل؛ يحفظ اعتماد 001 السابق بحدوده. أي تعارض غير مغلق يبقى مانع بدء مسمى. هذه نتيجة تسليم للمراجعة وليست قبولًا أو إذنًا لـS02.

**خارج النطاق:** لا أوامر لجميع المراحل، ولا خدمات أو مخازن جديدة، ولا تغيير لسياسة CI.

**شروط البدء:** تثبيت الرأس الحي وتكليف التجهيز التوثيقي. **العقود المملوكة:** SH-01.

**مواضع البنية القائمة المحتملة:** `AGENTS.md` و`docs/operations/control/` و`docs/operations/current-state.md` والفهرس، وفق تكليف التجهيز أو القبول.

**اختبارات قائمة للملاحة، وليست دليل نجاح:** حراس الوثائق وOperations Control أو بوابة البرنامج حسب نوع الشريحة.

**حالات SDF ذات مالك القبول الأساسي هنا:** لا حالة تغلق بتوثيق السلطة فقط. كلها مخططة ولم تشغّل؛ تكرر الحالات المشتركة عند تكامل مصدر أو قارئ يتأثر بها. التفاصيل والنتائج في ملف الحالات الأصلي.

**الرجوع والإغلاق:** يثبت الأمر الحالي SHA آخر رأس مقبول على فرع التكامل؛ لا نخمن قيمته الآن. رجوع الكود لا يخفض schema أو يستبدل البيانات بصمت. خطة البيانات المتوافقة تسبق الكتابة المؤثرة. ZAI منفذ المنتج الوحيد؛ S01 نشر توثيقي لمانوس. المراجعتان على نفس candidate، والانتقال باعتماد المالك.

### S02 — حماية الكتابة والاستعادة وإزالة القفل

**الحالة:** PLANNED_REVIEW؛ لا فرع مرحلة ولا أمر منشور.

**المواصفات:** [UNIT-042](02-SPECIFICATIONS/03-New-Design/UNIT-042-قفل-التطبيق.md)، [UNIT-044](02-SPECIFICATIONS/03-New-Design/UNIT-044-النسخ-الاحتياطي-والاستعادة.md)، و[العقد المشترك](02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md)، وفصول P3 وA/B ذات الصلة.

**الهدف:** إكمال عقد الأمر والنسخة والجيل واسترداد المآل عند الحاجة المثبتة؛ حماية الاستبدال 044 ومسح مسودات الجيل؛ إزالة PIN من الإقلاع والإعدادات والروابط دون بديل مصادقة.

**الذرية والعمل المشترك:** استبدال اللقطة ومسح form-drafts وتجديد الجيل حد واحد. الأمر القديم يرفض ولو بقي projectId نفسه. تثبت مصفوفة تكييف الكتّاب؛ لا يفتح كاتب جديد قبل حرسه، ولا تطلب إعادة كتابة كل الكتّاب دفعة واحدة.

**البيانات والنقل:** الجيل محلي ولا يصدر بحيث تعيده نسخة قديمة. يثبت تمثيل الإيصال عند أول حاجة فعلية؛ لا تنشأ المخازن الأربعة المرشحة تلقائيًا. التغيير الدائم يشمل المهايئين والمهاجرة والتصدير والوارد وحراسه في الشريحة نفسها.

**القبول المطلوب:** فشل آخر الكتابة، واستعادة مع نافذتين، ورفض ملف غير مؤهل قبل المسح، ونسخة رجوع خارج القاعدة قبل الاستبدال، وحسم المآل المجهول. استعادة قديمة لا تعيد PIN؛ تفحص IndexedDB وMemory حيث يتغير العقد.

**خارج النطاق:** لا إعادة بناء للهوية الذرية المنفذة. لا إغلاق شامل لـ044 قبل عائلات المراحل اللاحقة؛ تختبر كل عائلة عند تغييرها، والتجربة النهائية في S17.

**شروط البدء:** S01. **العقود المملوكة:** SH-02, SH-03, SH-04.

**مواضع البنية القائمة المحتملة:** `apps/prototype-web/client/src/application/security/index.ts`؛ `apps/prototype-web/client/src/application/security/localLockBackoff.ts`؛ `apps/prototype-web/client/src/application/security/localLockService.ts`؛ `apps/prototype-web/client/src/application/security/pinOperations.ts`؛ `apps/prototype-web/client/src/application/transfers/index.ts`؛ `apps/prototype-web/client/src/application/transfers/localTransferService.ts`؛ `apps/prototype-web/client/src/components/security/AppLockGate.tsx`؛ `apps/prototype-web/client/src/components/settings/SettingsDataProtectionSection.tsx`؛ `apps/prototype-web/client/src/pages/Settings.tsx`؛ `apps/prototype-web/client/src/storage/local/indexedDbSnapshot.ts`؛ `src/domain/shared/index.ts`.

**اختبارات قائمة للملاحة، وليست دليل نجاح:** `apps/prototype-web/client/src/application/security/localLockService.idleCharacterization.test.ts`؛ `apps/prototype-web/client/src/application/security/localLockService.test.ts`؛ `apps/prototype-web/client/src/application/transfers/localTransferService.assetResidual.test.ts`؛ `apps/prototype-web/client/src/application/transfers/localTransferService.capabilitiesRoundTrip.test.ts`؛ `apps/prototype-web/client/src/application/transfers/localTransferService.directSaleRoundTrip.test.ts`؛ `tests/domain/shared.test.ts`.

**حالات SDF ذات مالك القبول الأساسي هنا:** SDF-037, SDF-038, SDF-042, SDF-043, SDF-049, SDF-051, SDF-057. كلها مخططة ولم تشغّل؛ تكرر الحالات المشتركة عند تكامل مصدر أو قارئ يتأثر بها. التفاصيل والنتائج في ملف الحالات الأصلي.

**الرجوع والإغلاق:** يثبت الأمر الحالي SHA آخر رأس مقبول على فرع التكامل؛ لا نخمن قيمته الآن. رجوع الكود لا يخفض schema أو يستبدل البيانات بصمت. خطة البيانات المتوافقة تسبق الكتابة المؤثرة. ZAI منفذ المنتج الوحيد؛ S01 نشر توثيقي لمانوس. المراجعتان على نفس candidate، والانتقال باعتماد المالك.

### S03 — بداية المشروع وبياناته وإعداداته الأساسية

**الحالة:** PLANNED_REVIEW؛ لا فرع مرحلة ولا أمر منشور.

**المواصفات:** [UNIT-001](02-SPECIFICATIONS/03-New-Design/UNIT-001-إعداد-المشروع.md)، [UNIT-038](02-SPECIFICATIONS/03-New-Design/UNIT-038-الإعدادات.md)، [UNIT-039](02-SPECIFICATIONS/03-New-Design/UNIT-039-بيانات-المشروع-والمالك.md)، و[العقد المشترك](02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md)، وفصول P3 وA/B ذات الصلة.

**الهدف:** استكمال الفرق فوق UNIT-001 المدموج: اسم المشروع وحده إلزامي، وتفضيل العرض اختياري ومحايد، وهوية واحدة، وتعديل البيانات في الإعدادات بحقول محددة دون طمس البقية.

**الذرية والعمل المشترك:** إعادة استخدام commitProfileCreate القائم. التعديل ليس إنشاءً. نجاح الاسم مع فشل تفضيل اختياري لا يعيد إنشاء المشروع؛ الاستعادة وسياق رجوعها عند 044.

**البيانات والنقل:** activity-profile وowner-profile وlocal-preferences والمسودة المؤقتة المؤهلة. لا محفظة أو افتتاح 0 أو تمويل مالك أو حساب دخول من الإعداد.

**القبول المطلوب:** اسم فقط ثم دخول؛ نافذتا إنشاء؛ فشل القراءة ليس فراغًا؛ فشل التفضيل بعد نجاح الاسم؛ تغيير الاسم مع نفس الهوية؛ الاستعادة وإلغاؤها. وصلة اختيار بداية التسجيل عند 002 تتكامل في S14 دون معالج إلزامي مؤقت.

**خارج النطاق:** لا إعادة تنفيذ ما أثبته DOC-008. لا يستخدم workMode أوactivityType بدل تفضيل منتجات/خدمات.

**شروط البدء:** S02. **العقود المملوكة:** SH-05.

**مواضع البنية القائمة المحتملة:** `apps/prototype-web/client/src/app/StartupGate.tsx`؛ `apps/prototype-web/client/src/application/owner/ownerProfileService.ts`؛ `apps/prototype-web/client/src/application/preferences/index.ts`؛ `apps/prototype-web/client/src/application/preferences/preferenceService.ts`؛ `apps/prototype-web/client/src/application/profile/profileService.ts`؛ `apps/prototype-web/client/src/pages/Profile.tsx`؛ `apps/prototype-web/client/src/pages/Settings.tsx`؛ `apps/prototype-web/client/src/pages/Setup.tsx`؛ `src/domain/shared/index.ts`.

**اختبارات قائمة للملاحة، وليست دليل نجاح:** `apps/prototype-web/client/src/app/StartupGate.recovery.test.ts`؛ `apps/prototype-web/client/src/application/owner/ownerProfileService.test.ts`؛ `apps/prototype-web/client/src/application/preferences/preferenceService.test.ts`؛ `apps/prototype-web/client/src/application/profile/profileService.test.ts`؛ `apps/prototype-web/client/src/pages/Profile.ui.test.tsx`؛ `apps/prototype-web/client/src/pages/Setup.ui.test.tsx`؛ `tests/domain/shared.test.ts`.

**حالات SDF ذات مالك القبول الأساسي هنا:** SDF-008. كلها مخططة ولم تشغّل؛ تكرر الحالات المشتركة عند تكامل مصدر أو قارئ يتأثر بها. التفاصيل والنتائج في ملف الحالات الأصلي.

**الرجوع والإغلاق:** يثبت الأمر الحالي SHA آخر رأس مقبول على فرع التكامل؛ لا نخمن قيمته الآن. رجوع الكود لا يخفض schema أو يستبدل البيانات بصمت. خطة البيانات المتوافقة تسبق الكتابة المؤثرة. ZAI منفذ المنتج الوحيد؛ S01 نشر توثيقي لمانوس. المراجعتان على نفس candidate، والانتقال باعتماد المالك.

### S04 — النقد ومال المالك والقياس والتخصيص

**الحالة:** PLANNED_REVIEW؛ لا فرع مرحلة ولا أمر منشور.

**المواصفات:** [UNIT-020](02-SPECIFICATIONS/03-New-Design/UNIT-020-مال-المالك.md)، [UNIT-022](02-SPECIFICATIONS/03-New-Design/UNIT-022-إدارة-النقد.md)، [UNIT-023](02-SPECIFICATIONS/03-New-Design/UNIT-023-التحويل-بين-أماكن-النقد.md)، [UNIT-024](02-SPECIFICATIONS/03-New-Design/UNIT-024-تحديد-مكان-النقد.md)، [UNIT-025](02-SPECIFICATIONS/03-New-Design/UNIT-025-مطابقة-رصيد-الصندوق.md)، و[العقد المشترك](02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md)، وفصول P3 وA/B ذات الصلة.

**الهدف:** أماكن النقد والتحويل وتحديد مكان دفعة قائمة، ومال المالك بقصد صريح، وقياس الموجود والمطابقة. يبنى عقد استقبال مراجع الدفعات والتغطية الذي يستهلكه أصحاب المصادر لاحقًا.

**الذرية والعمل المشترك:** التحويل بجهتيه؛ التخصيص مع مرجع المصدر ونسخته دون قبض ثانٍ؛ المطابقة لا تعيد احتساب فرق القياس. الفاتورة المشتركة تستهلك عقد المالك في معاملة المصروف عند S06.

**البيانات والنقل:** cash-continuity وعائلات مال المالك. الرصد له نطاق وقطع وتغطية ومعرفة مستقلة. لا تجمع مشروع 200 ومحفظة 80 إلى 280، ولا يعاد تفسير التسوية القديمة كقياس جديد.

**القبول المطلوب:** 100 دينار = 10000 minor؛ دفتر 100 وعدّ 90 لا نقص 20؛ رصيد مجهول مع رصد 90 لا فرق مقابل 0؛ فشل الجهة الثانية من تحويل 10؛ تخصيص لا يقبض ثانية؛ سحب المالك ليس مصروفًا.

**خارج النطاق:** لا بيع أو سداد من صفحة الصندوق، ولا تمويل مالك تلقائي لفرق غير مفسر. يستهلك أصحاب الدفعات العقد لاحقًا دون نسخه.

**شروط البدء:** S02, S03. **العقود المملوكة:** SH-06, SH-07.

**مواضع البنية القائمة المحتملة:** `apps/prototype-web/client/src/application/cash/cashContinuityService.ts`؛ `apps/prototype-web/client/src/application/cash/index.ts`؛ `apps/prototype-web/client/src/application/finance/index.ts`؛ `apps/prototype-web/client/src/application/finance/projectFinancialEventWrites.ts`؛ `apps/prototype-web/client/src/application/finance/projectFinancialReads.ts`؛ `apps/prototype-web/client/src/application/owner-money/index.ts`؛ `apps/prototype-web/client/src/application/owner-money/ownerEntitlementService.ts`؛ `apps/prototype-web/client/src/pages/CashAdjustmentEditor.tsx`؛ `apps/prototype-web/client/src/pages/CashCount.tsx`؛ `apps/prototype-web/client/src/pages/CashDistribution.tsx`؛ `apps/prototype-web/client/src/pages/CashTransferEditor.tsx`؛ `apps/prototype-web/client/src/pages/CashWalletEditor.tsx`؛ `apps/prototype-web/client/src/pages/CashWallets.tsx`؛ `apps/prototype-web/client/src/pages/OwnerEntitlement.tsx`؛ `apps/prototype-web/client/src/pages/OwnerWithdrawalEditor.tsx`؛ `apps/prototype-web/client/src/pages/WalletLedger.tsx`؛ `apps/prototype-web/client/src/storage/local/cashContinuityCommitGuard.ts`؛ `apps/prototype-web/client/src/storage/local/supplierAttributionCommitGuard.ts`؛ `src/domain/cash-continuity/index.ts`؛ `src/domain/cash-continuity/policies.ts`؛ `src/domain/cash-continuity/types.ts`؛ `src/domain/craft-order/index.ts`؛ `src/domain/craft-order/policies.ts`؛ `src/domain/craft-order/types.ts`؛ `src/domain/direct-sale/index.ts`؛ `src/domain/direct-sale/policies.ts`؛ `src/domain/direct-sale/types.ts`؛ `src/domain/financial-analysis/index.ts`؛ `src/domain/financial-analysis/policies.ts`؛ `src/domain/financial-analysis/types.ts`؛ `src/domain/financial-event/index.ts`؛ `src/domain/financial-event/policies.ts`؛ `src/domain/financial-event/types.ts`؛ `src/domain/owner-entitlement/index.ts`؛ `src/domain/owner-entitlement/policies.ts`؛ `src/domain/owner-entitlement/types.ts`؛ `src/domain/supplier-purchase/index.ts`؛ `src/domain/supplier-purchase/policies.ts`؛ `src/domain/supplier-purchase/types.ts`.

**اختبارات قائمة للملاحة، وليست دليل نجاح:** `apps/prototype-web/client/src/application/cash/cashContinuityService.test.ts`؛ `apps/prototype-web/client/src/application/owner-money/ownerEntitlementService.test.ts`؛ `apps/prototype-web/client/src/pages/OwnerEntitlement.ui.test.ts`؛ `apps/prototype-web/client/src/pages/OwnerWithdrawalEditor.ui.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/directSaleCapability.contract.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/ownerEntitlementCapability.contract.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/supplierPurchaseCapability.contract.test.ts`؛ `apps/prototype-web/client/src/storage/local/supplierAttributionCommitGuard.test.ts`؛ `src/domain/direct-sale/policies.test.ts`؛ `tests/domain/cash-continuity.test.ts`؛ `tests/domain/craft-order-corrections.test.ts`؛ `tests/domain/financial-analysis.test.ts`؛ `tests/domain/financial-event.test.ts`؛ `tests/domain/supplier-purchase-corrections.test.ts`.

**حالات SDF ذات مالك القبول الأساسي هنا:** SDF-001, SDF-015, SDF-016, SDF-020, SDF-021. كلها مخططة ولم تشغّل؛ تكرر الحالات المشتركة عند تكامل مصدر أو قارئ يتأثر بها. التفاصيل والنتائج في ملف الحالات الأصلي.

**الرجوع والإغلاق:** يثبت الأمر الحالي SHA آخر رأس مقبول على فرع التكامل؛ لا نخمن قيمته الآن. رجوع الكود لا يخفض schema أو يستبدل البيانات بصمت. خطة البيانات المتوافقة تسبق الكتابة المؤثرة. ZAI منفذ المنتج الوحيد؛ S01 نشر توثيقي لمانوس. المراجعتان على نفس candidate، والانتقال باعتماد المالك.

### S05 — العملاء والموردون عند الحاجة

**الحالة:** PLANNED_REVIEW؛ لا فرع مرحلة ولا أمر منشور.

**المواصفات:** [UNIT-037](02-SPECIFICATIONS/03-New-Design/UNIT-037-العملاء-والموردون.md)، و[العقد المشترك](02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md)، وفصول P3 وA/B ذات الصلة.

**الهدف:** هوية طرف محفوظ اختيارية واختيار صريح، أو تعريف على المصدر حين لا يريد المستخدم حفظه. تعديل وأرشفة دون دفتر أرصدة قابل للتحرير.

**الذرية والعمل المشترك:** حفظ الطرف الاختياري لا يعيد عملية أعمال نجحت. الحق الجديد يحتاج تعريفًا بسيطًا دون هاتف أو CRM مفروض؛ لا دمج للأسماء المتشابهة آليًا.

**البيانات والنقل:** counterparties مخزن مرشح يثبت احتياجه وشكله ونقله. لا حفظ آلي لكل عميل ولا منح الأسماء القديمة هويات مفترضة؛ أرصدة الأطراف تقرأ مصادرها بمهايئ ضيق.

**القبول المطلوب:** طرفان بالاسم نفسه لا يندمجان؛ الحفظ اختياري؛ الأرشفة لا تحذف اللقطات أو الحقوق. تكمل حالات البيع والشراء الجديدة عند مراحل مصادرها، ولا تعلن ناجحة هنا دون تشغيلها.

**خارج النطاق:** لا ذمم يدوية موازية ولا توزيع مبلغ إجمالي على أقدم حق تلقائيًا. الحق الافتتاحي المؤهل يتكامل في S14.

**شروط البدء:** S02, S03. **العقود المملوكة:** SH-08.

**مواضع البنية القائمة المحتملة:** `apps/prototype-web/client/src/application/parties/index.ts`؛ `apps/prototype-web/client/src/application/parties/partyLedgerService.ts`؛ `apps/prototype-web/client/src/pages/Parties.tsx`؛ `src/domain/craft-order/index.ts`؛ `src/domain/craft-order/policies.ts`؛ `src/domain/craft-order/types.ts`؛ `src/domain/direct-sale/index.ts`؛ `src/domain/direct-sale/policies.ts`؛ `src/domain/direct-sale/types.ts`؛ `src/domain/shared/index.ts`؛ `src/domain/supplier-purchase/index.ts`؛ `src/domain/supplier-purchase/policies.ts`؛ `src/domain/supplier-purchase/types.ts`.

**اختبارات قائمة للملاحة، وليست دليل نجاح:** `apps/prototype-web/client/src/application/parties/partyLedgerService.customerName.test.ts`؛ `apps/prototype-web/client/src/application/parties/partyLedgerService.visibility.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/directSaleCapability.contract.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/supplierPurchaseCapability.contract.test.ts`؛ `src/domain/direct-sale/policies.test.ts`؛ `tests/domain/craft-order-corrections.test.ts`؛ `tests/domain/supplier-purchase-corrections.test.ts`.

**حالات SDF ذات مالك القبول الأساسي هنا:** لا حالة تغلق بتوثيق السلطة فقط. كلها مخططة ولم تشغّل؛ تكرر الحالات المشتركة عند تكامل مصدر أو قارئ يتأثر بها. التفاصيل والنتائج في ملف الحالات الأصلي.

**الرجوع والإغلاق:** يثبت الأمر الحالي SHA آخر رأس مقبول على فرع التكامل؛ لا نخمن قيمته الآن. رجوع الكود لا يخفض schema أو يستبدل البيانات بصمت. خطة البيانات المتوافقة تسبق الكتابة المؤثرة. ZAI منفذ المنتج الوحيد؛ S01 نشر توثيقي لمانوس. المراجعتان على نفس candidate، والانتقال باعتماد المالك.

### S06 — المصروف والمتكرر والفاتورة المشتركة

**الحالة:** PLANNED_REVIEW؛ لا فرع مرحلة ولا أمر منشور.

**المواصفات:** [UNIT-015](02-SPECIFICATIONS/03-New-Design/UNIT-015-تسجيل-العمليات-المالية.md)، [UNIT-019](02-SPECIFICATIONS/03-New-Design/UNIT-019-تكرار-المصروف.md)، و[العقد المشترك](02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md)، وفصول P3 وA/B ذات الصلة.

**الهدف:** مصروف واحد والتكرار خيار داخله. وقوع المصروف مختلف عن دفعه وتذكيره؛ الفاتورة المشتركة تسجل جزء المشروع وجزء المالك دون تكرار.

**الذرية والعمل المشترك:** تأكيد الدورة والمصروف والدفعة المختارة والروابط والإيصال معًا. دفع المشروع 60 وحصته 30 يعطي نقدًا −60 ومصروفًا 30 وسحبًا 30 بنفس النية. الربط بمصروف قائم لا يعيده.

**البيانات والنقل:** financial-events ومخازن التكرار القائمة، ومعها عائلات المالك عند استحقاقها. لا expenses ledger ثانٍ. تحفظ الدورات المعالجة؛ تعديل المستقبل لا يغير الماضي.

**القبول المطلوب:** نافذتان لتأكيد دورة واحدة؛ مصروف 10 مدفوع منه 3؛ إلغاء بلا أثر؛ فاتورة 60/30، وبديل دفع المشروع 30 فقط دون سحب إضافي؛ تعديل سلسلة وربط واقعة قائمة.

**خارج النطاق:** لا مصروف آلي من مرور الموعد. الميزانية خطة وقارئ في S15 وليست كاتب مصروف هنا.

**شروط البدء:** S04, S05. **العقود المملوكة:** SH-09.

**مواضع البنية القائمة المحتملة:** `apps/prototype-web/client/src/application/finance/index.ts`؛ `apps/prototype-web/client/src/application/finance/projectFinancialEventWrites.ts`؛ `apps/prototype-web/client/src/application/recurring/recurringExpenseService.ts`؛ `apps/prototype-web/client/src/pages/FinancialEventEditor.tsx`؛ `apps/prototype-web/client/src/pages/RecurringExpenseDetail.tsx`؛ `apps/prototype-web/client/src/pages/RecurringExpenseEditor.tsx`؛ `apps/prototype-web/client/src/storage/local/recurringExpenseCommitGuard.ts`؛ `src/domain/financial-event/index.ts`؛ `src/domain/financial-event/policies.ts`؛ `src/domain/financial-event/types.ts`؛ `src/domain/owner-entitlement/index.ts`؛ `src/domain/owner-entitlement/policies.ts`؛ `src/domain/owner-entitlement/types.ts`؛ `src/domain/recurring-expense/index.ts`؛ `src/domain/recurring-expense/policies.ts`؛ `src/domain/recurring-expense/types.ts`.

**اختبارات قائمة للملاحة، وليست دليل نجاح:** `apps/prototype-web/client/src/application/recurring/recurringExpenseService.test.ts`؛ `apps/prototype-web/client/src/pages/FinancialEventEditor.guided.test.tsx`؛ `apps/prototype-web/client/src/pages/FinancialEventEditor.ui.test.tsx`؛ `apps/prototype-web/client/src/storage/local/capabilities/ownerEntitlementCapability.contract.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/recurringExpenseCapability.contract.test.ts`؛ `apps/prototype-web/client/src/storage/local/recurringExpenseCommitGuard.test.ts`؛ `tests/domain/financial-event.test.ts`؛ `tests/domain/recurring-expense.test.ts`.

**حالات SDF ذات مالك القبول الأساسي هنا:** SDF-063, SDF-064. كلها مخططة ولم تشغّل؛ تكرر الحالات المشتركة عند تكامل مصدر أو قارئ يتأثر بها. التفاصيل والنتائج في ملف الحالات الأصلي.

**الرجوع والإغلاق:** يثبت الأمر الحالي SHA آخر رأس مقبول على فرع التكامل؛ لا نخمن قيمته الآن. رجوع الكود لا يخفض schema أو يستبدل البيانات بصمت. خطة البيانات المتوافقة تسبق الكتابة المؤثرة. ZAI منفذ المنتج الوحيد؛ S01 نشر توثيقي لمانوس. المراجعتان على نفس candidate، والانتقال باعتماد المالك.

### S07 — المشتريات والمخزون الاختياري

**الحالة:** PLANNED_REVIEW؛ لا فرع مرحلة ولا أمر منشور.

**المواصفات:** [UNIT-027](02-SPECIFICATIONS/03-New-Design/UNIT-027-المشتريات.md)، [UNIT-028](02-SPECIFICATIONS/03-New-Design/UNIT-028-المواد-والمخزون.md)، و[العقد المشترك](02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md)، وفصول P3 وA/B ذات الصلة.

**الهدف:** شراء واحد وبنود عند الحاجة، ودفعات واستلام مستقل عند الحاجة. تتبع الكمية لما اختاره المستخدم فقط؛ المواد غير المتتبعة تكلفة فترة الشراء بقرار المنتج، مع منع تكرارها في وصفة أو بيع.

**الذرية والعمل المشترك:** الشراء والبنود والدفعات والاستلام المختار والتغطية والتخصيص والإيصال بحد معلوم. الاستلام اللاحق فعل صريح؛ العد والهدر والاستهلاك حالات مختلفة. تحدث مهايئات قارئ التكلفة القائم مع المنتج الجديد؛ لا تؤجل صحة النتيجة إلى S15.

**البيانات والنقل:** supplier-purchases وعائلات المخزون وتقييم WAC القائم. شراء قديم أحادي يتحول لبند واحد بنفس الهوية والدفعات. شراء أصل يربط 034 عبر صاحبه القائم؛ الأصل ليس مادة فترة.

**القبول المطلوب:** شراء 12 دفع 4 ثم استلام واستهلاك 5؛ طحين 10 دون تتبع ثم تكلفة جديدة 2: تكلفة 12 دون خصم تقدير المواد ثانية؛ المورد غير إلزامي للمسدد؛ تصحيح بعد استهلاك وتخصيص؛ لا تسجيل لكل كوب.

**خارج النطاق:** لا ERP أو مخزون إجباري أو تحويل نقص العد لهدر تلقائي. استهلاك تسليم الطلب ينفذ ذريًا داخل S12 باستخدام منفذ هذه المرحلة.

**شروط البدء:** S04, S05, S06. **العقود المملوكة:** SH-10, SH-11.

**مواضع البنية القائمة المحتملة:** `apps/prototype-web/client/src/application/finance/index.ts`؛ `apps/prototype-web/client/src/application/finance/projectFinancialPeriodReads.ts`؛ `apps/prototype-web/client/src/application/inventory/index.ts`؛ `apps/prototype-web/client/src/application/inventory/inventoryMaterialWrites.ts`؛ `apps/prototype-web/client/src/application/suppliers/index.ts`؛ `apps/prototype-web/client/src/application/suppliers/supplierPurchaseService.ts`؛ `apps/prototype-web/client/src/pages/InventoryMaterials.tsx`؛ `apps/prototype-web/client/src/pages/SupplierPurchaseEditor.tsx`؛ `apps/prototype-web/client/src/pages/Suppliers.tsx`؛ `apps/prototype-web/client/src/storage/local/supplierScheduleCommitGuard.ts`؛ `src/domain/asset/index.ts`؛ `src/domain/asset/policies.ts`؛ `src/domain/asset/types.ts`؛ `src/domain/craft-order/index.ts`؛ `src/domain/craft-order/policies.ts`؛ `src/domain/craft-order/types.ts`؛ `src/domain/financial-analysis/index.ts`؛ `src/domain/financial-analysis/policies.ts`؛ `src/domain/financial-analysis/types.ts`؛ `src/domain/financial-event/index.ts`؛ `src/domain/financial-event/policies.ts`؛ `src/domain/financial-event/types.ts`؛ `src/domain/inventory-material/index.ts`؛ `src/domain/inventory-material/policies.ts`؛ `src/domain/inventory-material/types.ts`؛ `src/domain/supplier-purchase/index.ts`؛ `src/domain/supplier-purchase/policies.ts`؛ `src/domain/supplier-purchase/types.ts`.

**اختبارات قائمة للملاحة، وليست دليل نجاح:** `apps/prototype-web/client/src/application/suppliers/supplierPurchaseService.attributionAtomicity.test.ts`؛ `apps/prototype-web/client/src/application/suppliers/supplierPurchaseService.message.test.ts`؛ `apps/prototype-web/client/src/pages/SupplierPurchaseEditor.ui.test.tsx`؛ `apps/prototype-web/client/src/storage/local/capabilities/inventoryMaterialCapability.contract.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/orderLifecycleCapability.contract.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/supplierPurchaseCapability.contract.test.ts`؛ `apps/prototype-web/client/src/storage/local/supplierScheduleCommitGuard.derivationCoupling.test.ts`؛ `apps/prototype-web/client/src/storage/local/supplierScheduleCommitGuard.test.ts`؛ `tests/domain/craft-order-corrections.test.ts`؛ `tests/domain/financial-analysis.test.ts`؛ `tests/domain/inventory-material.test.ts`؛ `tests/domain/supplier-purchase-corrections.test.ts`.

**حالات SDF ذات مالك القبول الأساسي هنا:** SDF-031, SDF-044, SDF-067. كلها مخططة ولم تشغّل؛ تكرر الحالات المشتركة عند تكامل مصدر أو قارئ يتأثر بها. التفاصيل والنتائج في ملف الحالات الأصلي.

**الرجوع والإغلاق:** يثبت الأمر الحالي SHA آخر رأس مقبول على فرع التكامل؛ لا نخمن قيمته الآن. رجوع الكود لا يخفض schema أو يستبدل البيانات بصمت. خطة البيانات المتوافقة تسبق الكتابة المؤثرة. ZAI منفذ المنتج الوحيد؛ S01 نشر توثيقي لمانوس. المراجعتان على نفس candidate، والانتقال باعتماد المالك.

### S08 — الأصول والمعدات دون تعقيد

**الحالة:** PLANNED_REVIEW؛ لا فرع مرحلة ولا أمر منشور.

**المواصفات:** [UNIT-034](02-SPECIFICATIONS/03-New-Design/UNIT-034-الأصول-والمعدات.md)، و[العقد المشترك](02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md)، وفصول P3 وA/B ذات الصلة.

**الهدف:** أصل مشترى أو قائم، مع دفع أو مستحق حين يثبت دليله، وإهلاك وتخلص اختياريين. يستكمل حد شراء الأصل القائم؛ لا فاتورة ثانية ولا خصم كل الثمن مصروفًا.

**الذرية والعمل المشترك:** الأصل وأثره المؤهل والنقد والحق والتمويل والإيصال عند صاحب المصدر. التصحيح يفحص الإهلاك والتخلص التابعين.

**البيانات والنقل:** assets وfinancial-events وروابطهما. الأصل القديم الناقص المستندات يبقى بمعرفته؛ لا عمر أو تمويل أو حق مختلق. توافق النقل في الشريحة نفسها.

**القبول المطلوب:** أصل 100 دفع منه 40: أصل 100 ونقد −40 وحق 60؛ أصل قائم بلا مستند لا ينشئ شراء اليوم؛ ثمن الأصل لا يدخل مصروف الميزانية العادي؛ الإهلاك ليس دفعًا جديدًا.

**خارج النطاق:** لا قروض بديلة، ولا مرتجع تجاري جديد للأصول ضمن PD-02، ولا إهلاك إجباري لكل مستخدم.

**شروط البدء:** S04, S07. **العقود المملوكة:** SH-12.

**مواضع البنية القائمة المحتملة:** `apps/prototype-web/client/src/application/assets/assetService.ts`؛ `apps/prototype-web/client/src/application/assets/index.ts`؛ `apps/prototype-web/client/src/pages/AssetEditor.tsx`؛ `apps/prototype-web/client/src/pages/Assets.tsx`؛ `src/domain/asset/index.ts`؛ `src/domain/asset/policies.ts`؛ `src/domain/asset/types.ts`؛ `src/domain/financial-event/index.ts`؛ `src/domain/financial-event/policies.ts`؛ `src/domain/financial-event/types.ts`؛ `src/domain/supplier-purchase/index.ts`؛ `src/domain/supplier-purchase/policies.ts`؛ `src/domain/supplier-purchase/types.ts`.

**اختبارات قائمة للملاحة، وليست دليل نجاح:** `apps/prototype-web/client/src/application/assets/assetService.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/assetCapability.contract.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/supplierPurchaseCapability.contract.test.ts`؛ `tests/domain/asset.test.ts`؛ `tests/domain/financial-event.test.ts`؛ `tests/domain/supplier-purchase-corrections.test.ts`.

**حالات SDF ذات مالك القبول الأساسي هنا:** لا حالة تغلق بتوثيق السلطة فقط. كلها مخططة ولم تشغّل؛ تكرر الحالات المشتركة عند تكامل مصدر أو قارئ يتأثر بها. التفاصيل والنتائج في ملف الحالات الأصلي.

**الرجوع والإغلاق:** يثبت الأمر الحالي SHA آخر رأس مقبول على فرع التكامل؛ لا نخمن قيمته الآن. رجوع الكود لا يخفض schema أو يستبدل البيانات بصمت. خطة البيانات المتوافقة تسبق الكتابة المؤثرة. ZAI منفذ المنتج الوحيد؛ S01 نشر توثيقي لمانوس. المراجعتان على نفس candidate، والانتقال باعتماد المالك.

### S09 — بناء الطلب وتكلفته والمنتج القابل لإعادة الاستخدام

**الحالة:** PLANNED_REVIEW؛ لا فرع مرحلة ولا أمر منشور.

**المواصفات:** [UNIT-007](02-SPECIFICATIONS/03-New-Design/UNIT-007-مسودة-الطلب.md)، [UNIT-008](02-SPECIFICATIONS/03-New-Design/UNIT-008-التكلفة.md)، [UNIT-029](02-SPECIFICATIONS/03-New-Design/UNIT-029-المنتجات-والخدمات.md)، و[العقد المشترك](02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md)، وفصول P3 وA/B ذات الصلة.

**الهدف:** مسودة طلب بمجموعات منتجات أو خدمات ومكوناتها، وتكرار الكمية مرة واحدة. تكلفة بمعرفتها وتغطيتها، وسعر بيع وهامش مفهوم؛ اختيار مرجع محفوظ كلقطة، وحفظ منتج جديد باختيار صريح فقط.

**الذرية والعمل المشترك:** المسودة ولقطة التكلفة لا تولدان مالًا أو استهلاكًا. استيراد المرجع يثبت لقطة ولا يغير أصله؛ نواة الحساب مشتركة مع الحاسبة في S10 دون دمج الدفاتر.

**البيانات والنقل:** order-drafts ولقطات التكلفة والكتالوج والوحدات والتحويلات. نطاق تكلفة الوحدة والمجموعة والطلب واضح؛ توصيل يتحمله المشروع مرة للطلب؛ الإضافة وفق PD-01 وليست رسوم توصيل زبون.

**القبول المطلوب:** صندوق بشوكولاتتين وثمن للحبة يتكرر 10، ومجموعة ثانية مختلفة؛ توصيل 3 مرة واحدة؛ إجمالي 10 لكمية 3 لا يصير 10.02؛ مجهول لا 0؛ تحديث مسودة يحفظ كامل المدخلات.

**خارج النطاق:** لا مصروف فعلي من جهد المالك أو كهرباء تقديرية، ولا حفظ تلقائي لكل منتج. الاتفاق والقبض عند S12.

**شروط البدء:** S02, S05, S06, S07. **العقود المملوكة:** SH-13.

**مواضع البنية القائمة المحتملة:** `apps/prototype-web/client/src/application/catalog/catalogService.ts`؛ `apps/prototype-web/client/src/application/catalog/index.ts`؛ `apps/prototype-web/client/src/application/cost/costService.ts`؛ `apps/prototype-web/client/src/application/cost/index.ts`؛ `apps/prototype-web/client/src/application/drafts/draftService.ts`؛ `apps/prototype-web/client/src/application/drafts/index.ts`؛ `apps/prototype-web/client/src/pages/Catalog.tsx`؛ `apps/prototype-web/client/src/pages/CostEditor.tsx`؛ `apps/prototype-web/client/src/pages/DraftEditor.tsx`؛ `apps/prototype-web/client/src/pages/NewDraft.tsx`؛ `src/domain/catalog/index.ts`؛ `src/domain/catalog/policies.ts`؛ `src/domain/catalog/types.ts`؛ `src/domain/craft-order/index.ts`؛ `src/domain/craft-order/policies.ts`؛ `src/domain/craft-order/types.ts`؛ `src/domain/inventory-material/index.ts`؛ `src/domain/inventory-material/policies.ts`؛ `src/domain/inventory-material/types.ts`؛ `src/domain/shared/index.ts`.

**اختبارات قائمة للملاحة، وليست دليل نجاح:** `apps/prototype-web/client/src/application/catalog/catalogService.test.ts`؛ `apps/prototype-web/client/src/application/cost/costService.priceDate.test.ts`؛ `apps/prototype-web/client/src/application/cost/costService.test.ts`؛ `apps/prototype-web/client/src/application/drafts/draftService.test.ts`؛ `apps/prototype-web/client/src/pages/Catalog.operationKey.test.ts`؛ `apps/prototype-web/client/src/pages/Catalog.ui.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/inventoryMaterialCapability.contract.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/orderLifecycleCapability.contract.test.ts`؛ `tests/domain/catalog.test.ts`؛ `tests/domain/craft-order-corrections.test.ts`؛ `tests/domain/inventory-material.test.ts`؛ `tests/domain/shared.test.ts`.

**حالات SDF ذات مالك القبول الأساسي هنا:** SDF-002, SDF-032, SDF-034. كلها مخططة ولم تشغّل؛ تكرر الحالات المشتركة عند تكامل مصدر أو قارئ يتأثر بها. التفاصيل والنتائج في ملف الحالات الأصلي.

**الرجوع والإغلاق:** يثبت الأمر الحالي SHA آخر رأس مقبول على فرع التكامل؛ لا نخمن قيمته الآن. رجوع الكود لا يخفض schema أو يستبدل البيانات بصمت. خطة البيانات المتوافقة تسبق الكتابة المؤثرة. ZAI منفذ المنتج الوحيد؛ S01 نشر توثيقي لمانوس. المراجعتان على نفس candidate، والانتقال باعتماد المالك.

### S10 — الأدوات المستقلة ومحفوظات الحاسبة

**الحالة:** PLANNED_REVIEW؛ لا فرع مرحلة ولا أمر منشور.

**المواصفات:** [UNIT-030](02-SPECIFICATIONS/03-New-Design/UNIT-030-نقل-وظائف-أدواتي.md)، [UNIT-031](02-SPECIFICATIONS/03-New-Design/UNIT-031-التكلفة-والتسعير.md)، [UNIT-032](02-SPECIFICATIONS/03-New-Design/UNIT-032-التقديرات-المحفوظة.md)، و[العقد المشترك](02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md)، وفصول P3 وA/B ذات الصلة.

**الهدف:** الأدوات الخمس فقط: التكلفة والتسعير، وقيمة ساعة العمل، وكمية البيع المطلوبة، وحصة المشروع من فاتورة، وفحص فكرة مبسط. محفوظات T01 داخل الحاسبة دون صفحة مستقلة.

**الذرية والعمل المشترك:** الحساب نقي؛ الحفظ الاختياري في cost-estimates بلا بيع أو طلب أو مصروف أو مخزون أو حفظ كتالوج آلي. يستهلك نواة S09 بنفس المعادلات وسياق تخطيط مستقل.

**البيانات والنقل:** تحفظ الحسابات القديمة ومدخلاتها وافتراضاتها؛ إزالة استقلال 032 لا تمسها. لا يعاد تسعير محفوظ تاريخي بمراجع اليوم.

**القبول المطلوب:** نفس المدخلات تعطي نفس الحساب في 008/031؛ فتح وحفظ وحذف حساب بلا أثر أعمال؛ حصة الفاتورة مجرد ناتج حتى يسجلها المستخدم عند صاحب المصروف.

**خارج النطاق:** لا أداة سادسة أو جسر مالي تلقائي أو تبويب أدوات سادس. نقل المدخل النهائي في S16.

**شروط البدء:** S09. **العقود المملوكة:** SH-14.

**مواضع البنية القائمة المحتملة:** `apps/prototype-web/client/src/application/cost/costService.ts`؛ `apps/prototype-web/client/src/application/cost/index.ts`؛ `apps/prototype-web/client/src/application/estimates/costEstimateService.ts`؛ `apps/prototype-web/client/src/application/estimates/index.ts`؛ `apps/prototype-web/client/src/pages/CostCalculator.tsx`؛ `apps/prototype-web/client/src/pages/CostEditor.tsx`؛ `apps/prototype-web/client/src/pages/EstimateDetail.tsx`؛ `apps/prototype-web/client/src/pages/Tools.tsx`؛ `src/domain/catalog/index.ts`؛ `src/domain/catalog/policies.ts`؛ `src/domain/catalog/types.ts`؛ `src/domain/craft-order/index.ts`؛ `src/domain/craft-order/policies.ts`؛ `src/domain/craft-order/types.ts`؛ `src/domain/shared/index.ts`.

**اختبارات قائمة للملاحة، وليست دليل نجاح:** `apps/prototype-web/client/src/application/cost/costService.priceDate.test.ts`؛ `apps/prototype-web/client/src/application/cost/costService.test.ts`؛ `apps/prototype-web/client/src/application/estimates/costEstimateService.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/orderLifecycleCapability.contract.test.ts`؛ `tests/domain/catalog.test.ts`؛ `tests/domain/craft-order-corrections.test.ts`؛ `tests/domain/shared.test.ts`.

**حالات SDF ذات مالك القبول الأساسي هنا:** SDF-059, SDF-065. كلها مخططة ولم تشغّل؛ تكرر الحالات المشتركة عند تكامل مصدر أو قارئ يتأثر بها. التفاصيل والنتائج في ملف الحالات الأصلي.

**الرجوع والإغلاق:** يثبت الأمر الحالي SHA آخر رأس مقبول على فرع التكامل؛ لا نخمن قيمته الآن. رجوع الكود لا يخفض schema أو يستبدل البيانات بصمت. خطة البيانات المتوافقة تسبق الكتابة المؤثرة. ZAI منفذ المنتج الوحيد؛ S01 نشر توثيقي لمانوس. المراجعتان على نفس candidate، والانتقال باعتماد المالك.

### S11 — البيع المباشر والتسجيل السريع والتحصيل منه

**الحالة:** PLANNED_REVIEW؛ لا فرع مرحلة ولا أمر منشور.

**المواصفات:** [UNIT-004](02-SPECIFICATIONS/03-New-Design/UNIT-004-التسجيل-السريع.md)، [UNIT-005](02-SPECIFICATIONS/03-New-Design/UNIT-005-البيع-المباشر.md)، [UNIT-026](02-SPECIFICATIONS/03-New-Design/UNIT-026-تسجيل-دفعة-على-مستحق.md)، و[العقد المشترك](02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md)، وفصول P3 وA/B ذات الصلة.

**الهدف:** بيع نقدي أو جزئي، وتكلفة بمعرفتها، ودفعات مصدرية وتواريخها ومكانها. التسجيل السريع يفوض الأصل نفسه؛ تحصيل المصدر وتصحيح الخطأ والمرتجع الكامل وفق PD-02.

**الذرية والعمل المشترك:** البيع والقبض والحق والمكان والتغطية والإيصال داخل حد المصدر؛ المتبقي حي داخل المعاملة. المرتجع يلغي غير المقبوض ويثبت حق رد المقبوض دون دفع تلقائي. يرجع للمخزون أصل عاد فعلًا وكان مؤهلًا فقط.

**البيانات والنقل:** direct-sales يبقى الأصل؛ لا دفتر قبض عام. القبض القديم المجمل لا تؤلف تواريخه. تكيف قراءة المالية والكشف القائمة حتى لا تصبح الدفعة إيرادًا ثانيًا قبل S15.

**القبول المطلوب:** بيع 15 قبض 5 وتكلفة 6: نقد 5 وإيراد 15 ومساهمة 9 وحق 10؛ تحصيل 10 بلا إيراد جديد؛ محاولتا قبض؛ مرتجع كامل يلغي الحق 10 ويثبت رد 5 فقط؛ حفظ تاريخ البيع والمرتجع.

**خارج النطاق:** لا يستخدم PD-01 لإضافة نموذج إيراد آخر للبيع المباشر. لا خصم ثانٍ لمادة الفترة. **ملكية UNIT-026 هنا:** يبني S11 العقد المشترك والقدرة الأساسية ومحول البيع، ويقبل الجزء الخاص بالبيع؛ لا يبني محول الطلب أو الحق الافتتاحي.

**شروط البدء:** S04, S05, S07, S09. **العقود المملوكة:** SH-15.

**مواضع البنية القائمة المحتملة:** `apps/prototype-web/client/src/app/quickRecording.tsx`؛ `apps/prototype-web/client/src/application/collections/collectionService.ts`؛ `apps/prototype-web/client/src/application/collections/index.ts`؛ `apps/prototype-web/client/src/application/direct-sales/directSaleService.ts`؛ `apps/prototype-web/client/src/application/finance/index.ts`؛ `apps/prototype-web/client/src/application/finance/projectFinancialEventWrites.ts`؛ `apps/prototype-web/client/src/components/layout/QuickActionSheet.tsx`؛ `apps/prototype-web/client/src/pages/Collect.tsx`؛ `apps/prototype-web/client/src/pages/DirectSaleEditor.tsx`؛ `src/domain/cash-continuity/index.ts`؛ `src/domain/cash-continuity/policies.ts`؛ `src/domain/cash-continuity/types.ts`؛ `src/domain/craft-order/index.ts`؛ `src/domain/craft-order/policies.ts`؛ `src/domain/craft-order/types.ts`؛ `src/domain/direct-sale/index.ts`؛ `src/domain/direct-sale/policies.ts`؛ `src/domain/direct-sale/types.ts`؛ `src/domain/financial-analysis/index.ts`؛ `src/domain/financial-analysis/policies.ts`؛ `src/domain/financial-analysis/types.ts`؛ `src/domain/financial-event/index.ts`؛ `src/domain/financial-event/policies.ts`؛ `src/domain/financial-event/types.ts`؛ `src/domain/shared/index.ts`.

**اختبارات قائمة للملاحة، وليست دليل نجاح:** `apps/prototype-web/client/src/application/collections/collectionService.test.ts`؛ `apps/prototype-web/client/src/application/direct-sales/directSaleService.test.ts`؛ `apps/prototype-web/client/src/components/layout/QuickActionSheet.category.test.tsx`؛ `apps/prototype-web/client/src/components/layout/QuickActionSheet.guard.test.tsx`؛ `apps/prototype-web/client/src/pages/DirectSaleEditor.ui.test.tsx`؛ `apps/prototype-web/client/src/storage/local/capabilities/directSaleCapability.contract.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/orderLifecycleCapability.contract.test.ts`؛ `src/domain/direct-sale/policies.test.ts`؛ `tests/domain/cash-continuity.test.ts`؛ `tests/domain/craft-order-corrections.test.ts`؛ `tests/domain/financial-analysis.test.ts`؛ `tests/domain/financial-event.test.ts`؛ `tests/domain/shared.test.ts`.

**حالات SDF ذات مالك القبول الأساسي هنا:** SDF-003, SDF-004, SDF-005, SDF-009, SDF-010, SDF-011, SDF-012, SDF-014, SDF-022, SDF-039, SDF-041, SDF-053, SDF-056. كلها مخططة ولم تشغّل؛ تكرر الحالات المشتركة عند تكامل مصدر أو قارئ يتأثر بها. التفاصيل والنتائج في ملف الحالات الأصلي.

**الرجوع والإغلاق:** يثبت الأمر الحالي SHA آخر رأس مقبول على فرع التكامل؛ لا نخمن قيمته الآن. رجوع الكود لا يخفض schema أو يستبدل البيانات بصمت. خطة البيانات المتوافقة تسبق الكتابة المؤثرة. ZAI منفذ المنتج الوحيد؛ S01 نشر توثيقي لمانوس. المراجعتان على نفس candidate، والانتقال باعتماد المالك.

### S12 — اتفاق الطلب وتنفيذه وتسليمه وتسويته

**الحالة:** PLANNED_REVIEW؛ لا فرع مرحلة ولا أمر منشور.

**المواصفات:** [UNIT-009](02-SPECIFICATIONS/03-New-Design/UNIT-009-الاتفاق-والعربون.md)، [UNIT-010](02-SPECIFICATIONS/03-New-Design/UNIT-010-تفاصيل-الطلب.md)، [UNIT-011](02-SPECIFICATIONS/03-New-Design/UNIT-011-مراجعة-التسليم.md)، [UNIT-026](02-SPECIFICATIONS/03-New-Design/UNIT-026-تسجيل-دفعة-على-مستحق.md)، و[العقد المشترك](02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md)، وفصول P3 وA/B ذات الصلة.

**الهدف:** اتفاق ومقدم وتنفيذ وتسليم؛ قبض التسليم ضمن مساره الرئيسي، والتحصيل اللاحق عند 026 من المصدر. تفاصيل 010 تنسق دون محررات مالية منافسة؛ تكامل PD-01 وPD-02 في حدودهما.

**الذرية والعمل المشترك:** التسليم وحالته وحدثه والاعتراف ولقطته واستهلاكه المؤهل والقبض المختار والمكان والتغطية والإيصال معًا. تفحص كل النسخ والباقي والتقييم داخل الحد؛ لا نصف نجاح.

**البيانات والنقل:** نسخ الاتفاق وأحداث التنفيذ والدفعات داخل أصلها؛ اللقطة ثابتة بتاريخها. التقييم الفعلي يستبدل الجزء المطابق من المواد، ولا يمحو الجهد أو يجمع لقطتين. لا يعاد تسليم موروث.

**القبول المطلوب:** طلب 50 وإضافة 5 وقبض 20: إجمالي 55 وحق 35 وإيراد عند التسليم؛ مقدم 5 وقبض 10 وفشل استهلاك يتراجع كل الجديد؛ إغلاق التنفيذ لا يسقط حق رد؛ الصندوق المرتجع لا يرجع خامات تلقائيًا.

**خارج النطاق:** لا رسوم توصيل زبون أو split أو حجز سيارة. لا دفع رد بمجرد إعلان المرتجع، ولا مرتجع تجاري جزئي معقد. **ملكية UNIT-026 هنا:** يضيف S12 محول الطلب داخل أصل الطلب ويقبل تحصيله وتسليمه؛ لا يعيد بناء قدرة S11.

**شروط البدء:** S04, S05, S07, S09, S11. **العقود المملوكة:** SH-16.

**مواضع البنية القائمة المحتملة:** `apps/prototype-web/client/src/application/agreements/agreementService.ts`؛ `apps/prototype-web/client/src/application/agreements/index.ts`؛ `apps/prototype-web/client/src/application/agreements/orderDetailViewModel.ts`؛ `apps/prototype-web/client/src/application/collections/collectionService.ts`؛ `apps/prototype-web/client/src/application/collections/index.ts`؛ `apps/prototype-web/client/src/application/direct-sales/directSaleService.ts`؛ `apps/prototype-web/client/src/application/fulfillment/deliveryReviewService.ts`؛ `apps/prototype-web/client/src/application/fulfillment/fulfillmentService.ts`؛ `apps/prototype-web/client/src/application/fulfillment/index.ts`؛ `apps/prototype-web/client/src/pages/AgreementEditor.tsx`؛ `apps/prototype-web/client/src/pages/Collect.tsx`؛ `apps/prototype-web/client/src/pages/DeliveryReview.tsx`؛ `apps/prototype-web/client/src/pages/OrderDetail.tsx`؛ `src/domain/cash-continuity/index.ts`؛ `src/domain/cash-continuity/policies.ts`؛ `src/domain/cash-continuity/types.ts`؛ `src/domain/craft-order/index.ts`؛ `src/domain/craft-order/policies.ts`؛ `src/domain/craft-order/types.ts`؛ `src/domain/direct-sale/index.ts`؛ `src/domain/direct-sale/policies.ts`؛ `src/domain/direct-sale/types.ts`؛ `src/domain/financial-analysis/index.ts`؛ `src/domain/financial-analysis/policies.ts`؛ `src/domain/financial-analysis/types.ts`؛ `src/domain/financial-event/index.ts`؛ `src/domain/financial-event/policies.ts`؛ `src/domain/financial-event/types.ts`؛ `src/domain/inventory-material/index.ts`؛ `src/domain/inventory-material/policies.ts`؛ `src/domain/inventory-material/types.ts`.

**اختبارات قائمة للملاحة، وليست دليل نجاح:** `apps/prototype-web/client/src/application/agreements/agreementService.test.ts`؛ `apps/prototype-web/client/src/application/agreements/orderDetailViewModel.test.ts`؛ `apps/prototype-web/client/src/application/collections/collectionService.test.ts`؛ `apps/prototype-web/client/src/application/direct-sales/directSaleService.test.ts`؛ `apps/prototype-web/client/src/application/fulfillment/deliveryReviewService.lockedReview.test.ts`؛ `apps/prototype-web/client/src/application/fulfillment/deliveryReviewService.priorConsumption.test.ts`؛ `apps/prototype-web/client/src/application/fulfillment/fulfillmentService.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/directSaleCapability.contract.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/inventoryMaterialCapability.contract.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/orderLifecycleCapability.contract.test.ts`؛ `src/domain/direct-sale/policies.test.ts`؛ `tests/domain/cash-continuity.test.ts`؛ `tests/domain/craft-order-corrections.test.ts`؛ `tests/domain/financial-analysis.test.ts`؛ `tests/domain/financial-event.test.ts`؛ `tests/domain/inventory-material.test.ts`.

**حالات SDF ذات مالك القبول الأساسي هنا:** SDF-033, SDF-035, SDF-040, SDF-052, SDF-054, SDF-055. كلها مخططة ولم تشغّل؛ تكرر الحالات المشتركة عند تكامل مصدر أو قارئ يتأثر بها. التفاصيل والنتائج في ملف الحالات الأصلي.

**الرجوع والإغلاق:** يثبت الأمر الحالي SHA آخر رأس مقبول على فرع التكامل؛ لا نخمن قيمته الآن. رجوع الكود لا يخفض schema أو يستبدل البيانات بصمت. خطة البيانات المتوافقة تسبق الكتابة المؤثرة. ZAI منفذ المنتج الوحيد؛ S01 نشر توثيقي لمانوس. المراجعتان على نفس candidate، والانتقال باعتماد المالك.

### S13 — إدارة الطلبات والتقويم والمتابعة الموحدة

**الحالة:** PLANNED_REVIEW؛ لا فرع مرحلة ولا أمر منشور.

**المواصفات:** [UNIT-006](02-SPECIFICATIONS/03-New-Design/UNIT-006-العمل.md)، [UNIT-012](02-SPECIFICATIONS/03-New-Design/UNIT-012-المواعيد-والمتابعات.md)، [UNIT-018](02-SPECIFICATIONS/03-New-Design/UNIT-018-المتابعة-المالية.md)، و[العقد المشترك](02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md)، وفصول P3 وA/B ذات الصلة.

**الهدف:** قائمة وتقويم لنفس الطلبات، ومواعيد ومتابعة تشمل المالية من مصادرها. يدمج عرض 018 دون حذف المواعيد أو حالات المتابعة.

**الذرية والعمل المشترك:** القراءة والتصفية وتبديل العرض لا تكتب طلبًا أو قبضًا. الموعد لا يثبت تسليمًا والتذكير لا يؤكد مصروفًا؛ الأفعال تفوض أصحابها 010/011/026/015.

**البيانات والنقل:** schedule-entries وrecurrences وروابطها؛ لا تقويم مالي موازٍ. التصفية على المجتمع قبل حد العرض، والعدد الكلي صادق عند القراءة الجزئية.

**القبول المطلوب:** قائمة وشهر وأسبوع ويوم من نفس المصادر؛ موعد بلا وقت لا يفرض 00:00؛ فات/اليوم/قادم لا يحرك مالًا؛ رجوع بعد التسليم يعرض الحالة الصحيحة؛ الخطأ والإلغاء لا يفقدان المدخلات.

**خارج النطاق:** لا سحب وإفلات أو تواصل تأكيد خارجي أو تذكيرات خارج التطبيق غير معتمدة.

**شروط البدء:** S06, S11, S12. **العقود المملوكة:** SH-17.

**مواضع البنية القائمة المحتملة:** `apps/prototype-web/client/src/application/collections/collectionService.ts`؛ `apps/prototype-web/client/src/application/collections/index.ts`؛ `apps/prototype-web/client/src/application/finance/index.ts`؛ `apps/prototype-web/client/src/application/finance/upcomingService.ts`؛ `apps/prototype-web/client/src/application/scheduling/index.ts`؛ `apps/prototype-web/client/src/application/scheduling/scheduleService.ts`؛ `apps/prototype-web/client/src/pages/FinanceUpcoming.tsx`؛ `apps/prototype-web/client/src/pages/Orders.tsx`؛ `apps/prototype-web/client/src/pages/Schedule.tsx`؛ `apps/prototype-web/client/src/storage/local/supplierScheduleCommitGuard.ts`؛ `src/domain/craft-order/index.ts`؛ `src/domain/craft-order/policies.ts`؛ `src/domain/craft-order/types.ts`؛ `src/domain/financial-analysis/index.ts`؛ `src/domain/financial-analysis/policies.ts`؛ `src/domain/financial-analysis/types.ts`؛ `src/domain/recurring-expense/index.ts`؛ `src/domain/recurring-expense/policies.ts`؛ `src/domain/recurring-expense/types.ts`.

**اختبارات قائمة للملاحة، وليست دليل نجاح:** `apps/prototype-web/client/src/application/collections/collectionService.test.ts`؛ `apps/prototype-web/client/src/application/finance/upcomingService.test.ts`؛ `apps/prototype-web/client/src/application/scheduling/scheduleService.test.ts`؛ `apps/prototype-web/client/src/pages/Orders.ui.test.tsx`؛ `apps/prototype-web/client/src/storage/local/capabilities/orderLifecycleCapability.contract.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/recurringExpenseCapability.contract.test.ts`؛ `apps/prototype-web/client/src/storage/local/supplierScheduleCommitGuard.derivationCoupling.test.ts`؛ `apps/prototype-web/client/src/storage/local/supplierScheduleCommitGuard.test.ts`؛ `tests/domain/craft-order-corrections.test.ts`؛ `tests/domain/financial-analysis.test.ts`؛ `tests/domain/recurring-expense.test.ts`.

**حالات SDF ذات مالك القبول الأساسي هنا:** SDF-013. كلها مخططة ولم تشغّل؛ تكرر الحالات المشتركة عند تكامل مصدر أو قارئ يتأثر بها. التفاصيل والنتائج في ملف الحالات الأصلي.

**الرجوع والإغلاق:** يثبت الأمر الحالي SHA آخر رأس مقبول على فرع التكامل؛ لا نخمن قيمته الآن. رجوع الكود لا يخفض schema أو يستبدل البيانات بصمت. خطة البيانات المتوافقة تسبق الكتابة المؤثرة. ZAI منفذ المنتج الوحيد؛ S01 نشر توثيقي لمانوس. المراجعتان على نفس candidate، والانتقال باعتماد المالك.

### S14 — بدء التسجيل من الماضي والعودة بعد الانقطاع

**الحالة:** PLANNED_REVIEW؛ لا فرع مرحلة ولا أمر منشور.

**المواصفات:** [UNIT-002](02-SPECIFICATIONS/03-New-Design/UNIT-002-استكمال-بيانات-المشروع.md)، و[العقد المشترك](02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md)، وفصول P3 وA/B ذات الصلة.

**الهدف:** ACC-01 وJRN-010: الجديد يختار اليوم أو تاريخًا سابقًا بحرية، والعائد يحدد الفترة غير المسجلة. ملخص وضع قصير وأسئلة مباشرة ومجاميع أو تفاصيل وتوسيع عند الحاجة.

**الذرية والعمل المشترك:** المعاينة بلا مال. الالتزام ينسق أصحاب المصادر والتغطية والقياسات والإيصال معًا، أو تقسيمًا آمنًا معلنًا قبل الكتابة ومثبتًا في المواصفة. التفصيل يحل مكان أبعاده من الملخص دون مضاعفة.

**البيانات والنقل:** PeriodSummary وأبعاد المعرفة والتغطية، ورصد النقد والمخزون. الحق الافتتاحي التجاري المؤهل ليس مبيعات اليوم. مسودة كاملة بنوع ونسخة وجيل؛ تجاوز 32KB له معالجة مثبتة لا قص صامت.

**القبول المطلوب:** بوابات فرعية مستقلة للمعاينة بلا مال، والتغطية، والقياسات، والكتابة الذرية، والمسودة/الحجم، والفشل/الاستئناف. داخلها: ملخص 200/120/80 ثم تفصيل 80/30/20 لا يغير الإجماليات؛ قبض مجهول لا يفترض 48 بالتناسب؛ رصد 200 وقبض قديم 30 يغطيه لا يصبح 230؛ حق قديم 50 من مصدره؛ فشل آخر المعاملة بلا نصف نجاح؛ لا لوم أو إجبار على كل الماضي.

**خارج النطاق:** لا دفتر 002 مستقل أو تسوية فرق آلية أو اعتبار آخر زيارة إقفالًا. استكمال المفقود مختلف عن استبدال النسخة 044.

**شروط البدء:** S03, S04, S05, S06, S07, S08, S11, S12. **العقود المملوكة:** SH-18.

**مواضع البنية القائمة المحتملة:** `apps/prototype-web/client/src/application/transfers/guidedOpeningImportService.ts`؛ `apps/prototype-web/client/src/application/transfers/index.ts`؛ `apps/prototype-web/client/src/pages/Foundation.tsx`؛ `src/domain/cash-continuity/index.ts`؛ `src/domain/cash-continuity/policies.ts`؛ `src/domain/cash-continuity/types.ts`؛ `src/domain/direct-sale/index.ts`؛ `src/domain/direct-sale/policies.ts`؛ `src/domain/direct-sale/types.ts`؛ `src/domain/financial-event/index.ts`؛ `src/domain/financial-event/policies.ts`؛ `src/domain/financial-event/types.ts`؛ `src/domain/inventory-material/index.ts`؛ `src/domain/inventory-material/policies.ts`؛ `src/domain/inventory-material/types.ts`؛ `src/domain/shared/index.ts`؛ `src/domain/supplier-purchase/index.ts`؛ `src/domain/supplier-purchase/policies.ts`؛ `src/domain/supplier-purchase/types.ts`.

**اختبارات قائمة للملاحة، وليست دليل نجاح:** `apps/prototype-web/client/src/application/transfers/guidedOpeningImportService.g82.test.ts`؛ `apps/prototype-web/client/src/application/transfers/guidedOpeningImportService.test.ts`؛ `apps/prototype-web/client/src/pages/Foundation.ui.test.tsx`؛ `apps/prototype-web/client/src/storage/local/capabilities/directSaleCapability.contract.test.ts`؛ `src/domain/direct-sale/policies.test.ts`؛ `tests/domain/shared.test.ts`؛ `tests/domain/supplier-purchase-corrections.test.ts`.

**حالات SDF ذات مالك القبول الأساسي هنا:** SDF-007, SDF-017, SDF-018, SDF-019, SDF-023, SDF-024, SDF-025, SDF-026, SDF-027, SDF-028, SDF-029, SDF-030, SDF-036, SDF-050, SDF-066, SDF-071, SDF-072. كلها مخططة ولم تشغّل؛ تكرر الحالات المشتركة عند تكامل مصدر أو قارئ يتأثر بها. التفاصيل والنتائج في ملف الحالات الأصلي.

**الرجوع والإغلاق:** يثبت الأمر الحالي SHA آخر رأس مقبول على فرع التكامل؛ لا نخمن قيمته الآن. رجوع الكود لا يخفض schema أو يستبدل البيانات بصمت. خطة البيانات المتوافقة تسبق الكتابة المؤثرة. ZAI منفذ المنتج الوحيد؛ S01 نشر توثيقي لمانوس. المراجعتان على نفس candidate، والانتقال باعتماد المالك.

### S15 — المالية والكشف والسجل والميزانيات وإيقاف القدرات الملغاة

**الحالة:** PLANNED_REVIEW؛ لا فرع مرحلة ولا أمر منشور.

**المواصفات:** [UNIT-013](02-SPECIFICATIONS/03-New-Design/UNIT-013-المالية-وملخص-الفترة.md)، [UNIT-013B](02-SPECIFICATIONS/03-New-Design/UNIT-013B-ميزانيات-المصروف-الاختيارية.md)، [UNIT-016](02-SPECIFICATIONS/03-New-Design/UNIT-016-كشف-الفترة.md)، [UNIT-017](02-SPECIFICATIONS/03-New-Design/UNIT-017-سجل-العمليات.md)، [UNIT-021](02-SPECIFICATIONS/03-New-Design/UNIT-021-التوقعات-النقدية-المؤجلة.md)، [UNIT-035](02-SPECIFICATIONS/03-New-Design/UNIT-035-القروض-التي-أعطاها-المشروع.md)، [UNIT-036](02-SPECIFICATIONS/03-New-Design/UNIT-036-القروض-التي-أخذها-المشروع.md)، [UNIT-040](02-SPECIFICATIONS/03-New-Design/UNIT-040-المشاركة.md)، و[العقد المشترك](02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md)، وفصول P3 وA/B ذات الصلة.

**الهدف:** قارئ نتيجة موحد للمالية والرئيسية والكشف والميزانية، ومدخل مالية قصير بلوحة وصول 6 مجموعات و15 مدخلًا، وكشف وسجل وميزانية اختيارية. حجب الإقراض والاقتراض المؤجل والتوقع المتقدم والمشاركة دون مسح تاريخها.

**الذرية والعمل المشترك:** قراءة متسقة بختم الجيل والنطاق والمراجعة؛ التصحيح يفوض الأصل. إيقاف القدرة يحجب الواجهة والرابط وحد الكاتب، ويحفظ ما يلزم للتاريخ والنقل.

**البيانات والنقل:** لا مخزن ملخص أو دفتر مكرر. التغطية والملخص والعائدات والقبض والتقييم تقرأ بمعرفتها؛ الميزانية ليست مصروفًا. تبقى عائلات القروض والتوقع القديمة للتوافق دون إعادة فتح الإنشاء.

**القبول المطلوب:** حزمتان داخليتان بقبول مستقل: (1) قارئ النتيجة/الملخص/الكشف/السجل، و(2) الميزانيات وإيقاف القدرات؛ ثم قبول تكاملي واحد. نفس النطاق والمعرفة في 013/016/013B؛ الجزء المعروف لا يسمى ربحًا كاملًا؛ مصروف 10 مدفوع 3 وأصل 100 لا يصبح مصروف ميزانية 113؛ تنزيل 016 يبقى دون 040؛ رابط القرض المباشر محجوب؛ التاريخ يحفظ معناه.

**خارج النطاق:** لا توقع سحب آمن أو أمانات جديدة أو قروض باسم بديل. لا تغيير CONS-DEC02 أو PD تحت اسم تبسيط واجهة.

**شروط البدء:** S06, S07, S08, S11, S12, S14. **العقود المملوكة:** SH-19, SH-20.

**مواضع البنية القائمة المحتملة:** `apps/prototype-web/client/src/app/MicroRouter.tsx`؛ `apps/prototype-web/client/src/application/activity/activityService.ts`؛ `apps/prototype-web/client/src/application/activity/index.ts`؛ `apps/prototype-web/client/src/application/budgets/expenseBudgetService.ts`؛ `apps/prototype-web/client/src/application/budgets/index.ts`؛ `apps/prototype-web/client/src/application/finance/index.ts`؛ `apps/prototype-web/client/src/application/finance/projectFinancialPeriodReads.ts`؛ `apps/prototype-web/client/src/application/finance/projectFinancialReads.ts`؛ `apps/prototype-web/client/src/application/finance/statementService.ts`؛ `apps/prototype-web/client/src/application/loans/index.ts`؛ `apps/prototype-web/client/src/application/loans/loanService.ts`؛ `apps/prototype-web/client/src/application/loans/receivedLoanService.ts`؛ `apps/prototype-web/client/src/application/share/index.ts`؛ `apps/prototype-web/client/src/application/share/shareMessageService.ts`؛ `apps/prototype-web/client/src/components/finance/ExpenseBudgetsSectionBody.tsx`؛ `apps/prototype-web/client/src/pages/Finance.tsx`؛ `apps/prototype-web/client/src/pages/FinanceActivity.tsx`؛ `apps/prototype-web/client/src/pages/FinanceUpcoming.tsx`؛ `apps/prototype-web/client/src/pages/G5DeclarationEditor.tsx`؛ `apps/prototype-web/client/src/pages/Loans.tsx`؛ `apps/prototype-web/client/src/pages/ReceivedLoanDetail.tsx`؛ `apps/prototype-web/client/src/pages/ReceivedLoanEditor.tsx`؛ `apps/prototype-web/client/src/pages/SharePreview.tsx`؛ `apps/prototype-web/client/src/pages/Statement.tsx`؛ `src/domain/budget/index.ts`؛ `src/domain/budget/policies.ts`؛ `src/domain/budget/types.ts`؛ `src/domain/cash-continuity/index.ts`؛ `src/domain/cash-continuity/policies.ts`؛ `src/domain/cash-continuity/types.ts`؛ `src/domain/financial-analysis/index.ts`؛ `src/domain/financial-analysis/policies.ts`؛ `src/domain/financial-analysis/types.ts`؛ `src/domain/financial-event/index.ts`؛ `src/domain/financial-event/policies.ts`؛ `src/domain/financial-event/types.ts`؛ `src/domain/loan/index.ts`؛ `src/domain/loan/policies.ts`؛ `src/domain/loan/types.ts`؛ `src/domain/owner-safe-withdrawal/index.ts`؛ `src/domain/owner-safe-withdrawal/policies.ts`؛ `src/domain/owner-safe-withdrawal/types.ts`؛ `src/domain/received-loan/index.ts`؛ `src/domain/received-loan/policies.ts`؛ `src/domain/received-loan/types.ts`.

**اختبارات قائمة للملاحة، وليست دليل نجاح:** `apps/prototype-web/client/src/application/activity/activityService.test.ts`؛ `apps/prototype-web/client/src/application/budgets/expenseBudgetService.3c.test.ts`؛ `apps/prototype-web/client/src/application/finance/statementService.test.ts`؛ `apps/prototype-web/client/src/application/loans/loanService.test.ts`؛ `apps/prototype-web/client/src/application/loans/receivedLoanService.test.ts`؛ `apps/prototype-web/client/src/application/share/shareMessageService.test.ts`؛ `apps/prototype-web/client/src/pages/FinanceActivity.periodKey.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/expenseBudgetCapability.contract.test.ts`؛ `apps/prototype-web/client/src/storage/local/capabilities/loanCapability.contract.test.ts`؛ `tests/domain/budget.test.ts`؛ `tests/domain/cash-continuity.test.ts`؛ `tests/domain/financial-analysis.test.ts`؛ `tests/domain/financial-event.test.ts`؛ `tests/domain/loan.test.ts`؛ `tests/domain/owner-safe-withdrawal.test.ts`.

**حالات SDF ذات مالك القبول الأساسي هنا:** SDF-006, SDF-045, SDF-058, SDF-061, SDF-062. كلها مخططة ولم تشغّل؛ تكرر الحالات المشتركة عند تكامل مصدر أو قارئ يتأثر بها. التفاصيل والنتائج في ملف الحالات الأصلي.

**الرجوع والإغلاق:** يثبت الأمر الحالي SHA آخر رأس مقبول على فرع التكامل؛ لا نخمن قيمته الآن. رجوع الكود لا يخفض schema أو يستبدل البيانات بصمت. خطة البيانات المتوافقة تسبق الكتابة المؤثرة. ZAI منفذ المنتج الوحيد؛ S01 نشر توثيقي لمانوس. المراجعتان على نفس candidate، والانتقال باعتماد المالك.

### S16 — الرئيسية والتنقل والوصول للخدمات

**الحالة:** PLANNED_REVIEW؛ لا فرع مرحلة ولا أمر منشور.

**المواصفات:** [UNIT-003](02-SPECIFICATIONS/03-New-Design/UNIT-003-مشروعي-الآن.md)، [UNIT-014](02-SPECIFICATIONS/03-New-Design/UNIT-014-أدوات-وسجلات-المالية.md)، [UNIT-041](02-SPECIFICATIONS/03-New-Design/UNIT-041-السوق.md)، [UNIT-043](02-SPECIFICATIONS/03-New-Design/UNIT-043-الخدمات-القادمة.md)، و[العقد المشترك](02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md)، وفصول P3 وA/B ذات الصلة.

**الهدف:** الشريط RTL: المالية، الطلبات، الرئيسية، التوصيل، السوق. الرئيسية افتراضية، بملخص صادق وأفعال سريعة بسحب يدوي وعرض الكل ومتابعات محدودة. الأدوات بزر ثانوي؛ تلغى صفحة 014 بعد اكتمال بدائلها.

**الذرية والعمل المشترك:** نقل المدخل لا ينشئ أصلًا أو رصيدًا؛ يجهز الرجوع والرابط البديل قبل الإزالة. الرئيسية تستهلك قارئ S15 دون تكرار معادلاته، والقائمة والتقويم من المصادر نفسها.

**البيانات والنقل:** لا HomeStore أو جدول أعمال للتنقل. الخدمات القادمة ظاهرة بصدق وفق 043؛ طلب سيارة مستقل عن نفقة توصيل الطلب، والسوق دون صفقات داخلية.

**القبول المطلوب:** الأفعال الخمسة والرجوع؛ الوصول المالي بلا صفحة طويلة؛ إزالة 014 لا تقطع وظيفة؛ الرجوع من طلب أو شراء أو أداة لا يكرر الحفظ؛ لا حجز سيارة أو سلة سوق أو AskMicro وهمي.

**خارج النطاق:** لا هوية بصرية جديدة أو تعديل Showcase أو تبويب أدوات سادس، ولا إعادة 035/040/042 من المزيد.

**شروط البدء:** S10, S13, S15. **العقود المملوكة:** SH-21.

**مواضع البنية القائمة المحتملة:** `apps/prototype-web/client/src/app/MicroRouter.tsx`؛ `apps/prototype-web/client/src/app/navigationContract.ts`؛ `apps/prototype-web/client/src/application/home/homeControlCenterService.ts`؛ `apps/prototype-web/client/src/application/home/index.ts`؛ `apps/prototype-web/client/src/components/layout/AppHeader.tsx`؛ `apps/prototype-web/client/src/pages/Finance.tsx`؛ `apps/prototype-web/client/src/pages/FinanceMore.tsx`؛ `apps/prototype-web/client/src/pages/Home.tsx`؛ `apps/prototype-web/client/src/pages/Market.tsx`؛ `src/domain/cash-continuity/index.ts`؛ `src/domain/cash-continuity/policies.ts`؛ `src/domain/cash-continuity/types.ts`؛ `src/domain/financial-analysis/index.ts`؛ `src/domain/financial-analysis/policies.ts`؛ `src/domain/financial-analysis/types.ts`.

**اختبارات قائمة للملاحة، وليست دليل نجاح:** `apps/prototype-web/client/src/app/navigationContract.test.ts`؛ `apps/prototype-web/client/src/application/home/homeControlCenterService.test.ts`؛ `tests/domain/cash-continuity.test.ts`؛ `tests/domain/financial-analysis.test.ts`.

**حالات SDF ذات مالك القبول الأساسي هنا:** SDF-060. كلها مخططة ولم تشغّل؛ تكرر الحالات المشتركة عند تكامل مصدر أو قارئ يتأثر بها. التفاصيل والنتائج في ملف الحالات الأصلي.

**الرجوع والإغلاق:** يثبت الأمر الحالي SHA آخر رأس مقبول على فرع التكامل؛ لا نخمن قيمته الآن. رجوع الكود لا يخفض schema أو يستبدل البيانات بصمت. خطة البيانات المتوافقة تسبق الكتابة المؤثرة. ZAI منفذ المنتج الوحيد؛ S01 نشر توثيقي لمانوس. المراجعتان على نفس candidate، والانتقال باعتماد المالك.

### S17 — فحص البيانات وتجربة النسخ النهائية

**الحالة:** PLANNED_REVIEW؛ لا فرع مرحلة ولا أمر منشور.

**المواصفات:** [UNIT-033](02-SPECIFICATIONS/03-New-Design/UNIT-033-فحص-البيانات.md)، [UNIT-044](02-SPECIFICATIONS/03-New-Design/UNIT-044-النسخ-الاحتياطي-والاستعادة.md)، و[العقد المشترك](02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md)، وفصول P3 وA/B ذات الصلة.

**الهدف:** إنشاء نسخة واستعادة ملف بمعاينة وحماية الموجود، وفحص اتساق للقراءة داخل الإعدادات. مصالحة كل العائلات والإصدارات والقدرات المتقاعدة بعد إلحاق نقلها في وقت تغييرها.

**الذرية والعمل المشترك:** استبدال لا دمج؛ لقطة متسقة، ونسخة رجوع خارجية قابلة للتعافي قبل التدمير، وجيل جديد وعزل المسودات. فحص 033 لا يصلح المال تلقائيًا.

**البيانات والنقل:** جميع العائلات القائمة والمضافة باعتماد شريحتها؛ التفضيلات تصدر دون جيل قديم؛ لا PIN أو صلاحية نموذج قديم. يهاجر الملف القديم المؤهل دون إعادة المال، والتطبيق القديم يرفض الأحدث.

**القبول المطلوب:** Round-trip للمعرفة والحقوق والتغطية والكمية واللقطات؛ ملف فاسد أو كبير أو مرجع ناقص؛ فشل الاستبدال ونافذتان ومسودة قديمة؛ تمييز تجهيز الملف عن حفظه فعليًا خارج التطبيق.

**خارج النطاق:** لا إصلاح مالي آلي أو Cloud Backup أو Auth أو مزامنة. لا تؤجل مهاجرات S03–S16 إلى هذه المرحلة.

**شروط البدء:** S14, S15, S16. **العقود المملوكة:** SH-22.

**مواضع البنية القائمة المحتملة:** `apps/prototype-web/client/src/application/finance/index.ts`؛ `apps/prototype-web/client/src/application/finance/integrityCheckService.ts`؛ `apps/prototype-web/client/src/application/transfers/index.ts`؛ `apps/prototype-web/client/src/application/transfers/localTransferService.ts`؛ `apps/prototype-web/client/src/components/settings/SettingsDataProtectionSection.tsx`؛ `apps/prototype-web/client/src/pages/Settings.tsx`؛ `apps/prototype-web/client/src/pages/ToolsIntegrity.tsx`؛ `apps/prototype-web/client/src/storage/local/indexedDbSnapshot.ts`؛ `src/domain/financial-analysis/index.ts`؛ `src/domain/financial-analysis/policies.ts`؛ `src/domain/financial-analysis/types.ts`؛ `src/domain/shared/index.ts`.

**اختبارات قائمة للملاحة، وليست دليل نجاح:** `apps/prototype-web/client/src/application/finance/integrityCheckService.test.ts`؛ `apps/prototype-web/client/src/application/transfers/localTransferService.assetResidual.test.ts`؛ `apps/prototype-web/client/src/application/transfers/localTransferService.capabilitiesRoundTrip.test.ts`؛ `apps/prototype-web/client/src/application/transfers/localTransferService.directSaleRoundTrip.test.ts`؛ `tests/domain/financial-analysis.test.ts`؛ `tests/domain/shared.test.ts`.

**حالات SDF ذات مالك القبول الأساسي هنا:** SDF-046, SDF-047, SDF-048, SDF-069, SDF-070. كلها مخططة ولم تشغّل؛ تكرر الحالات المشتركة عند تكامل مصدر أو قارئ يتأثر بها. التفاصيل والنتائج في ملف الحالات الأصلي.

**الرجوع والإغلاق:** يثبت الأمر الحالي SHA آخر رأس مقبول على فرع التكامل؛ لا نخمن قيمته الآن. رجوع الكود لا يخفض schema أو يستبدل البيانات بصمت. خطة البيانات المتوافقة تسبق الكتابة المؤثرة. ZAI منفذ المنتج الوحيد؛ S01 نشر توثيقي لمانوس. المراجعتان على نفس candidate، والانتقال باعتماد المالك.

### S18 — القبول المتكامل وتجهيز الدمج النهائي

**الحالة:** PLANNED_REVIEW؛ لا فرع مرحلة ولا أمر منشور.

**المواصفات:** توثيق أو قبول برنامج؛ لا مكون منتج جديد، و[العقد المشترك](02-SPECIFICATIONS/05-Data-and-Implementation/02-Shared-Data-and-Financial-Contract-AR.md)، وفصول P3 وA/B ذات الصلة.

**الهدف:** الرحلات العشر ومصفوفة التبعيات والهاتف والرجوع والإلغاء والخطأ والفراغ والتكرار والمجهول؛ مراجعتان على مرشح واحد وملف جاهزية دمج للمالك.

**الذرية والعمل المشترك:** لا توسعات منتج تحت اسم الاختبار النهائي. العيب المثبت يعود إلى مرحلته ومالكه بتصحيح محدد، وتعاد الاختبارات المتأثرة والبوابات الواجبة.

**البيانات والنقل:** تثبت أزواج المخطط والتصدير الفعلية ومصفوفة المهاجرات والنقل. قبول فرع التكامل لا يعني التحقق على main.

**القبول المطلوب:** بوابات المستودع الحالية ناجحة على المرشح، ومراجعتان على نفس SHA. دليل Android/iOS والجهاز الحقيقي عند اشتراطه، أو حدود غير مجتازة بوضوح. الدمج بموافقة المالك ثم تحقق main.

**خارج النطاق:** لا دمج أو حذف فروع تلقائي، ولا ادعاء Pilot أو قبول ميداني من محاكاة المتصفح.

**شروط البدء:** S17. **العقود المملوكة:** أدلة قبول البرنامج؛ لا API جديد.

**مواضع البنية القائمة المحتملة:** `AGENTS.md` و`docs/operations/control/` و`docs/operations/current-state.md` والفهرس، وفق تكليف التجهيز أو القبول.

**اختبارات قائمة للملاحة، وليست دليل نجاح:** حراس الوثائق وOperations Control أو بوابة البرنامج حسب نوع الشريحة.

**حالات SDF ذات مالك القبول الأساسي هنا:** SDF-068. كلها مخططة ولم تشغّل؛ تكرر الحالات المشتركة عند تكامل مصدر أو قارئ يتأثر بها. التفاصيل والنتائج في ملف الحالات الأصلي.

**الرجوع والإغلاق:** يثبت الأمر الحالي SHA آخر رأس مقبول على فرع التكامل؛ لا نخمن قيمته الآن. رجوع الكود لا يخفض schema أو يستبدل البيانات بصمت. خطة البيانات المتوافقة تسبق الكتابة المؤثرة. ZAI منفذ المنتج الوحيد؛ S01 نشر توثيقي لمانوس. المراجعتان على نفس candidate، والانتقال باعتماد المالك.

## بعد آخر مرحلة

يتلقى المالك Merge Manifest والرأس والبوابات والمراجعتين والحدود. الدمج بقراره فقط، ثم يفحص main الفعلي والنشر حيث يشترط؛ لا يستخدم SHA قبل الدمج كأنه SHA الدمج. حالات الجهاز وPilot الخارجية مستقلة عن قبول هذه الخطة.
