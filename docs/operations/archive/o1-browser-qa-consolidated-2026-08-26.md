# O1 browser QA — consolidated record (2026-08-26, three same-route passes)

> **منشأ مؤرخ 2026-10-02 (WS-207/موجة C):** هذا الملف دمج حرفي لثلاثة سجلات QA متزامنة (2026-08-26) لنفس المسار `/finance/owner-entitlement`، كانت في `docs/implementation/` بلا أي إحالة داخلية إليها: `o1-browser-qa.md` (التمرير الأول)، `o1-acceptance-browser-qa.md` (تصحيح القبول)، `o1-successor-edit-browser-qa.md` (تعديل الخليفة وعثرات الأتمتة). المحتوى أدناه **حرفي بلا تعديل** تحت فواصل واضحة؛ الأصول في مواقعها التاريخية داخل تاريخ git (قبل الالتزام الدامج). هذا سجل أدلة تاريخي في الأرشيف، لا سلطة حالية — حالة O1 الحية تُقرأ من Operations Control و`current-state.md`.

---

## الأصل 1/3 — `o1-browser-qa.md`

# O1 browser smoke QA

Date: 2026-08-26.

The local Prototype started on Vite port 3000 and rendered the Arabic RTL application. The fresh-profile flow opened the local setup route, accepted a sample project name, and reached the orders route. The direct `/finance/owner-entitlement` route then rendered successfully with the Finance back link, the owner balance card, dated policy form, entitlement calculation form, opening-balance form, wallet movement form, and empty immutable ledger state. The viewport reported 3,043 pixels below the fold, confirming the mobile-first surface is scrollable rather than clipped.

The empty state correctly displayed `0.00 JOD`, stated that entitlement does not equal cash or operating profit, and presented no wallet option before a wallet exists. No runtime error or blank component appeared during this smoke test. The initial `/finance` navigation on port 5173 was unavailable because Vite selected port 3000; the correct port was then exposed and passed the smoke test.

A sample zero-balance wallet was created through the existing cash route. The cash list then showed one wallet named `صندوق الاختبار` with zero balance and zero saved effects. The existing floating add action sheet can overlay the lower edge on that route; it was closed during the test and did not prevent navigation or saving.

On the live O1 route, a monthly policy was entered with `1500.00` JOD minor, source, and note. The save action persisted it, updated the policy count to 1, displayed the dated policy card, and made the entitlement preview available at `1,500.00 JOD` for 2026-08-01 through 2026-08-31. The page still showed no cash movement, and the saved wallet appeared in the wallet selector.

The live entitlement record was then saved from the preview. The page displayed `تم تسجيل الاستحقاق. لم يتغير كاش المشروع.`, changed the owner balance to `1,500.00 JOD`, and displayed the entitlement in the ledger while the wallet selector remained at zero balance. This confirms the UI preserves the core separation between an accrued right and an actual wallet movement.

The live movement form then selected that entitlement and `صندوق الاختبار`, entered a 500-minor draw, and saved it. The page confirmed `تم تسجيل الحركة وأثرها على محفظة الكاش.`, reduced the owner balance to `1,000.00 JOD`, showed the wallet at `-500.00 JOD`, and displayed the draw in the ledger with its `عكس كامل` action. This is expected for a zero-balance sample wallet and confirms the wallet effect is explicit rather than hidden.

Cleanup verification: IndexedDB databases, Cache Storage, localStorage, sessionStorage, and service-worker registrations were all empty/zero after the QA data was cleared. No synthetic browser test data remains in the session.

---

## الأصل 2/3 — `o1-acceptance-browser-qa.md`

# O1 acceptance-correction browser QA

**Date:** 26 August 2026

This note records a Chromium smoke pass using synthetic Arabic data only. The browser started with a clean local state and redirected to `/setup`; a profile named `اختبار تصحيح O1` was created solely for this pass.

The route `/finance/owner-entitlement` rendered successfully in RTL with the balance card, independent policy form, dated successor form, entitlement form, opening-balance form, and owner movement form. The initial state was empty and displayed `0.00 JOD`, a clear next action, and no fake historical records.

The corrected policy selector exposed monthly, weekly, daily, hourly, fixed-period, completed-work, profit-share, completed-sale-percentage, and per-unit choices. `fixed_shift` was intentionally absent because the current model has no shift evidence. The successor section displayed a dated effective-start field, source/reason, note, and a disabled action until a policy is selected.

The movement form in draw mode exposed entitlement settlement, opening-balance settlement, pre-entitlement draw, and independent owner draw. After switching to return mode, it exposed opening-balance settlement, prior-draw settlement, and new-capital return. The form showed an explicit source selector for opening settlement and did not leave a source-less settlement option.

Dark mode was toggled successfully; the RTL page remained readable and the data state did not change. The visible numeric inputs used ASCII/LTR presentation. Keyboard and exact button targeting remained possible through native controls; no external account, payment, or personal data was used.

The browser smoke was a visual/interaction check of the local development route, not physical Android/iOS, offline reload, or production Cloudflare acceptance. Synthetic data must be cleared before delivery.

The policy save path was exercised with a synthetic monthly policy of 1,500 minor JOD and a dated source note. The UI displayed the policy as active and showed a known 1,500.00 JOD proposal for the full August calendar period. A successor was then saved with effective date 26/08/2026, an explicit reason, and a note. The UI displayed version 2 as active, version 1 as ended on 25/08/2026, and showed the predecessor relationship; the old policy remained visible and the August period was correctly rejected for the successor because it began after the period start. This confirms no retroactive policy rewrite in the live path.

A native dropdown interaction returned an encoding error from the automation bridge once; the same selection completed through the page's DOM and did not indicate an application failure. The interaction was recorded as an automation limitation, not a product failure.

Final cleanup was executed from the page context. The synthetic IndexedDB database `micro-prototype-local` was deleted, Cache Storage was cleared, localStorage and sessionStorage returned empty, and service-worker registrations were unregistered. No synthetic profile, policy, successor, opening balance, entitlement, or movement remains in the browser state.

---

## الأصل 3/3 — `o1-successor-edit-browser-qa.md`

# QA مبدئي لتصحيح successor O1

في 26 أغسطس 2026، بعد إعداد محلي اصطناعي باسم «اختبار خليفة O1»، فتح المسار المسجل `/finance/owner-entitlement`. ظهر سطح الخطأ العربي «تعذر فتح هذا السطح / لم يتم تغيير بياناتك» بدل صفحة دفتر O1. المسار `/owner-entitlement` غير مسجل ويعرض fallback. يلزم فحص Console/runtime قبل اعتبار QA ناجحًا؛ لم تُستخدم بيانات شخصية ولم تُعلن نتيجة قبول.
فحص Console أظهر: `SyntaxError: The requested module '/@fs/home/ubuntu/Micro/src/domain/owner-entitlement/index.ts' does not provide an export named 'ownerEntitlementPolicyFamilyForKind'`. الملف الفعلي والـbarrel يتضمنان التصدير، لكن Vite بقي على module graph قديم؛ إعادة فتح المسار بعد ذلك أبقت سطح الخطأ. سيُعاد تشغيل dev server ثم يُعاد QA.
بعد إعادة تشغيل Vite، ظهر `/finance/owner-entitlement` بنجاح. في RTL ظهرت بطاقة «تعديل سياسة من تاريخ جديد»، وملخص النسخة السابقة 1,500.00 JOD، وتحذير عدم تغيير الاستحقاقات السابقة، وحقل النوع، وحقل مبلغ الخليفة. حُفظت سياسة شهرية اصطناعية بقيمة 1500 minor، ثم أُدخل تاريخ 2026-09-01 ومبلغ 2000 وسبب وملاحظة؛ قبل الحفظ ظهرت القيم الجديدة في النموذج. الأرقام ظهرت ASCII/LTR.
محاولة النقر على زر «حفظ التعديل وإنهاء السابقة» مرتين (بالفهرس ثم بالإحداثيات) لم تغيّر العرض أو أظهرت إشعارًا؛ بقيت السياسة الأولى ظاهرة. يلزم فحص Console/DOM لتحديد ما إذا كان ذلك قيد أتمتة النقر أم خطأ في handler قبل إكمال QA.
بعد استدعاء الزر عبر DOM، نجح الحفظ: ظهر إشعار «تم حفظ إعدادات الخليفة الجديدة وإنهاء النسخة السابقة؛ لا تتغير الاستحقاقات المسجلة سابقًا»، وأصبح عدد السياسات 2. ظهرت النسخة الجديدة شهرية، إصدار 2، تبدأ 01/09/2026، بقيمة 2,000.00 JOD؛ والنسخة القديمة إصدار 1، تنتهي 31/08/2026، بقيمة 1,500.00 JOD. بقيت تحذيرات عدم إعادة احتساب الحقوق التاريخية واضحة.
أعاد اختيار native dropdown الفشل المعروف في bridge بسبب invalid UTF-8، وليس فشلًا في المنتج. تم اختيار `sale_percentage` عبر DOM بنجاح، وتأكدت قائمة الأنواع من احتواء الأنواع التسعة المدعومة مع استبعاد `fixed_shift`.
بعد تغيير النوع عبر DOM إلى `sale_percentage` ظهر حقل «نسبة الخليفة (%)» مع إرشاد صريح بأنها لا تُحسب من العربون أو الكاش. ثم تم تبديل النوع إلى `fixed_period` عبر DOM للتحقق من ظهور حقل نهاية النطاق المعلنة في العرض التالي.
في Dark mode بقيت الصفحة RTL مقروءة وظهر زر «تفعيل المظهر الفاتح». عند محاولة حفظ fixed_period بلا نهاية، لم تُكتب سياسة جديدة؛ ظهر إشعار «اختر سياسة فعالة وحدد تاريخ النفاذ واكتب سببًا وملاحظة للتعديل» لأن تغيير النوع أعاد ضبط اختيار السياسة الفعالة أثناء العرض. هذا يؤكد عدم الكتابة الصامتة، لكن يجب تنظيف الجلسة الآن وإعادة التحقق من المخازن.
نُفذ التنظيف من Console: حُذفت قاعدة `micro-prototype-local`، ولم توجد Cache Storage أو Service Worker، وصُفرت localStorage وsessionStorage. بعد الانتقال إلى `/setup` ظهرت شاشة التأسيس الفارغة مع حقل اسم المشروع؛ لا توجد بيانات O1 اصطناعية متبقية.
