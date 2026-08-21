# دليل الإصدار والتراجع

## قبل التغيير

اقرأ القرار وبطاقة الفرضية. سجّل الإصدار الحالي، schema، البيانات المتأثرة، migration، خطة rollback، ومتى تكون backup صالحة.

## أثناء التنفيذ

اعمل على vertical slice. لا تجمع domain refactor مع feature غير مرتبطة. اجعل الأخطاء قابلة للقراءة، وقيّد retries، وسجّل idempotency وsync state. لا تكشف بيانات سرية في logs.

## قبل النشر

شغّل build وlint وunit/domain وintegration/RLS وsync وmobile/RTL وacceptance. افحص secrets وdependency licenses وbundle وmigrations. جرّب البيانات الفارغة والناقصة والتاريخية والفشل المتعمد.

## النشر

انشر staged أو canary إن أمكن. تحقق من health، تسجيل الدخول، workspace isolation، إنشاء طلب، حساب التكلفة، التحصيل، export، وإعادة فتح التطبيق على الهاتف.

## بعد النشر

راقب الأخطاء والـsync queue والتعارض والبطء والدعم. سجل commit والإصدار ونتائج smoke test. لا تعتبر deployment ناجحًا لأن الصفحة فتحت فقط.

## التراجع

إذا ظهر فساد بيانات أو تكرار مالي أو خرق عزل: أوقف الكتابات المتأثرة، حافظ على الأدلة، فعّل النسخة الاحتياطية أو rollback الموثق، وأبلغ المستخدم بما حدث. لا تصلح التاريخ بحذف صامت.
