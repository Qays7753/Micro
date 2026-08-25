# دليل حزمة مهارات SaaS للمشاريع المنزلية

## الغرض

هذه الحزمة تجعل أي مساعد ذكاء اصطناعي يعمل داخل إطار موحد للمشروع بدل إعادة شرح الهوية والمشكلة والقواعد في كل جلسة. الحزمة لا تستبدل الحكم البشري ولا تثبت نجاح السوق، لكنها تمنع الانحياز والتوسع والأخطاء المتكررة.

## الملفات

| المهارة | استخدمها عندما | وظيفتها |
|---|---|---|
| `saas-product-guardian` | قرار منتج، بحث، ميزة، MVP، بديل أو فرضية | يحرس Problem Statement، الدليل، النطاق، ومعايير القبول والفشل |
| `microbusiness-finance-operations` | تكلفة، سعر، ربح، كاش، طلب، مخزون، خدمة أو اختبار مالي | يحرس المعنى الاقتصادي والتشغيلي والفروق بين الطعام والحرفة والخدمة |
| `micro-scenario-validation` | تغيير المفهوم أو Problem Statement أو النموذج المالي أو تجربة المستخدم أو ميزة | يختبر القرار على الشخصيات والحالات والأسئلة canonical قبل البناء |
| `saas-delivery-verifier` | كود، قاعدة بيانات، مزامنة، أمن، نشر، ترحيل أو اختبار | يحرس المعمارية، العزل، local-first، الاستعادة، الجودة والتسليم |
| `micro-web-native-ux` | Web App بملء الشاشة، Android-like UX، RTL، PWA UX، شاشات أو تنقل | يحرس سلوك الويب والطبقات والرجوع ولوحة المفاتيح والحالات |
| `micro-design-system` | ألوان، خطوط، مسافات، مكونات، Light/Dark، Figma-to-code أو tokens | يحرس الهوية المثبتة والتوكنات والتباين وعدم وجود قيم خام |
| `micro-local-first-prototype` | LocalStore، IndexedDB، مسودات، Snapshots، أحداث، Export/Import أو offline | يحرس حدود التخزين المحلي والإصدارات والاستعادة وعدم التكرار |
| `micro-prototype-qa` | قبول Slice أو PR، اختبار UI والتدفقات والمالية واللقطات | يحرس RTL، 360/390/430، Light/Dark، حالات الواجهة والحقيقة المالية |

## ترتيب الاستخدام

ابدأ دائمًا بـ`saas-product-guardian`. أضف `microbusiness-finance-operations` عندما يمس الطلب المال أو التكلفة أو التشغيل. أضف `micro-scenario-validation` عند تغيير المفهوم أو Problem Statement أو النموذج المالي أو تجربة المستخدم أو أي ميزة. أضف `saas-delivery-verifier` عند الانتقال إلى كود أو بنية أو إصدار. عند بناء واجهة Web App فعّل `micro-web-native-ux` و`micro-design-system`. عند بناء التخزين المحلي فعّل `micro-local-first-prototype`. عند قبول Slice أو PR فعّل `micro-prototype-qa`. يمكن تفعيل المهارات المتخصصة مع مهارات المنتج والمال والتنفيذ عند الحاجة.

## مراجع Micro الثابتة

قبل أي قرار منتج أو تجربة، اقرأ `../docs/product/problem-statement-v4.md` و`../docs/product/system-definition-v1.md` و`../docs/product/user-operating-model-v1.md` و`../docs/product/activity-profiles-and-hybrid-projects-v1.md` و`../docs/implementation/03-pre-build-alignment-v1.md`. قبل أي قرار مالي، اقرأ `../docs/product/financial-operating-model-v1.md`. قبل Profile أو مشروع مختلط، اقرأ `../docs/implementation/multi-activity-expansion-roadmap-v1.md` و`../docs/research/multi-activity-profile-research-v1.md`. عند استخدام مصدر عالمي أو اختيار نمط أو مكتبة، اقرأ `../docs/research/global-build-reference-library-v1.md` ثم `../docs/research/micro-build-logic-v1.md`. عند تنفيذ Prototype اقرأ `../docs/implementation/prototype-build-charter-v1.md` و`../docs/product/mobile-ui-ux-reference-v1.md` و`../docs/implementation/mobile-prototype-spec-v1.md`، ثم فعّل المهارة المناسبة للواجهة أو التخزين أو الجودة. عند تغيير المفهوم أو تجربة المستخدم، فعّل `micro-scenario-validation` واختبر التغيير على `../docs/scenarios/scenario-test-set-v1.md` و`../docs/quality/scenario-coverage-matrix-v1.md`. هذه الوثائق هي مصدر الحقيقة داخل GitHub؛ المهارات تفرض طريقة استخدامها ولا تستبدلها.

## رسالة بدء محمولة

عند استخدام مساعد لا يقرأ مجلد المهارات تلقائيًا، أرسل له:

> استخدم حزمة مهارات Micro المرفقة. ابدأ بـsaas-product-guardian، واقرأ Pre-build Alignment وBuild Charter قبل الكود، واقرأ مكتبة `docs/research/global-build-reference-library-v1.md` ومنطق `docs/research/micro-build-logic-v1.md` عند أي بحث أو اختيار نمط أو مكتبة، ثم فعّل مهارة Web UX وDesign System عند الواجهة، ومهارة Local-first عند التخزين، ومهارة Prototype QA عند قبول Slice. لا تعتبر أي نظام قديم أو مشروع GitHub مصدر حقيقة. اربط كل قرار بـProblem Statement والسيناريوهات canonical، افصل الدليل عن الفرضية، اختر أقل Vertical Slice، واذكر التوصية والمخاطر ومعيار القبول والفشل. لا تعرض ربحًا عند نقص التكلفة، ولا تبنِ Billing في تطبيق المستخدم في MVP التجاري اللاحق، ولا تنقل كودًا بلا ترخيص واضح.

ثم أرفق مجلدات المهارات كما هي، لا ملف SKILL.md وحده إذا أردت أن يقرأ المراجع الداخلية.

## طريقة العمل على مهمة جديدة

1. اطلب من المساعد تصنيف المهمة قبل الحل.
2. اطلب منه قراءة مرجع المنتج ذي الصلة.
3. اجعله يكتب بطاقة قرار أو فرضية.
4. اجعله يحدد أقل نطاق وفئات التأثير.
5. قبل الكود، اطلب بوابة التنفيذ والتحقق.
6. بعد التنفيذ، اطلب نتيجة الاختبارات وما بقي مجهولًا.
7. لا تقبل «تم» دون ملفات أو اختبار أو دليل واضح.

## قواعد الاستمرارية

عند بدء جلسة جديدة، أرسل آخر قرار معتمد، الفرضية الحالية، الملفات المتغيرة، وما فشل سابقًا. لا تعيد سرد كل تاريخ المشروع؛ استخدم المهارات والمراجع ثم حدّث سجل القرارات.

إذا تعارضت إجابة المساعد مع Problem Statement أو قاعدة مالية أو بوابة أمان أو فشلت في تغطية حالة اختبار، يجب أن يوقف التنفيذ ويعرض التعارض بدل تخمين حل.

## حدود الحزمة

الحزمة لا تمنح معرفة تلقائية بسوق الأردن، ولا تثبت الاستعداد للدفع، ولا تغني عن اختبار مستخدمين أو مراجعة قانونية أو أمنية. عندما تكون المعلومة مجهولة، يجب أن تسميها مجهولة وتطلب اختبارًا أو دليلًا.
