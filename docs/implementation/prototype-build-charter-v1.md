# Micro — Prototype Build Charter v1

**الحالة:** CURRENT / CANONICAL / بوابة تشغيل قبل بناء Prototype

**الإصدار:** 1.0

**التاريخ:** 2026-08-22

**النطاق:** Prototype المرحلة 2 فقط

**المرجع الأعلى:** [`docs/01-product-and-technical-blueprint.md`](../01-product-and-technical-blueprint.md)

## 1. الغرض

هذا الملف يحول قرارات Micro المعتمدة إلى ميثاق تنفيذ عملي قبل كتابة واجهة Prototype أو طبقة التخزين. الغرض منه منع التشتت بين Web App وPWA وNative، ومنع خلط كود التطبيق بالوثائق، ومنع أي Agent أو مطور من توسيع المرحلة إلى SaaS أو ERP أو نظام محاسبي عام قبل وجود دليل.

لا يغير هذا الملف مفهوم Micro أو Problem Statement أو السياسات المالية. وهو لا يتغلب على العقود أو `AGENTS.md` أو `docs/01-product-and-technical-blueprint.md` أو سياسات المال؛ بل يوضح كيف ننفذ ما تم اعتماده ضمن حدود Prototype.

## 2. القرار التنفيذي المعتمد

> **Micro Prototype هو Web App فعلي بملء الشاشة، مصمم بسلوك Android-like حديث، يعمل أولًا من المتصفح، قابل للإضافة إليه كـPWA، ومستعد للتغليف كتطبيق Native لاحقًا، ويستضيفه Cloudflare. بياناته في Prototype محلية على جهاز المستخدم، ولا توجد فيه مزامنة أو Auth أو SaaS مركزي.**

المصطلح التشغيلي الدقيق هو **Web-first Android-like App**. يجوز استخدام «Native-ready» أو «PWA-ready» لوصف قابلية التوسع، لكن لا يجوز وصف Prototype بأنه تطبيق Native كامل أو SaaS سحابي لمجرد أن ملفاته مستضافة على Cloudflare.

## 3. القرارات المثبتة

| المجال | القرار الملزم | ما لا يعنيه القرار |
|---|---|---|
| المنتج | Micro نظام إدارة مالية وتشغيلية عميق داخليًا وبسيط عمليًا في الواجهة | ليس تطبيق طلبات فقط، ولا LMS، ولا ERP أو POS أو CRM عامًا |
| منصة Prototype | Web App بملء الشاشة من المتصفح | ليس Website تسويقيًا أو صفحات Mockup غير مترابطة |
| أسلوب التجربة | Android-like: App Shell، Header، تنقل سفلي محدود، Bottom Sheets، رجوع، حالات ضغط، Safe Areas، ونماذج قصيرة | ليس نسخ Material 3 أو نسخ Android UI حرفيًا |
| الهوية | الألوان والخطوط والمسافات والقياسات المثبتة في `mobile-ui-ux-reference-v1.md` نهائية لهذه المرحلة | لا يعاد اختيار لوحة جديدة ولا تدخل ألوان Hex خام خارج التوكنات |
| اللغة والاتجاه | العربية RTL هي تجربة الاختبار الأساسية | لا نعتبر الإنجليزية معيار التصميم الأول |
| التخزين | LocalStore محلي مع مسودات وSnapshots وأحداث وتصدير/استيراد محلي | لا توجد قاعدة بيانات مركزية أو Workspace أو Sync تجاري |
| الاستضافة | Cloudflare كهدف نشر للتطبيق الثابت/الويب | Cloudflare لا يعني Backend أو SaaS أو مزامنة |
| PWA | manifest وService Worker وApp Shell وOffline UX بعد استقرار المسار الأساسي [1] | لا يثبت دعم كل قدرات الجهاز على كل متصفح |
| Native لاحقًا | Capacitor [2] أو Native client مستقل خيار توسع بعد إثبات الحاجة | لا نضيف Native shell أو متجر تطبيقات أثناء Prototype الأول |
| المستخدم | مستخدم واحد على جهاز واحد | غياب Roles وPermissions وAuth ليس فشلًا في هذه المرحلة |
| الشريحة | مسار الحرفة المخصصة من التكلفة إلى النتيجة | لا يدخل POS أو المخزون العام أو نقطة التعادل كميزة جاهزة |

## 4. النطاق الوظيفي للـPrototype

يدخل في Prototype ما يلزم لإثبات أن صاحب مشروع غير محاسبي يستطيع تسجيل طلب حرفة مخصصة وفهم أثره واتخاذ الخطوة التالية. يشمل ذلك تأسيسًا محليًا مختصرًا، إنشاء طلب، إدخال المواد والوقت والتغليف والتوصيل والهدر عندما تنطبق، إنشاء Cost Snapshot، عرض المعروف والمقدر والناقص، مراجعة سعر الحماية، حفظ الاتفاق والموعد، تسجيل العربون الاختياري، تحديث التنفيذ، التسليم، التحصيل أو الدين، عرض نتيجة الطلب بدرجة معرفة، ثم اقتراح فعل تالٍ وتصدير/استيراد محلي.

يظل اسم النتيجة في الواجهة **نتيجة الطلب**. لا تعرض الواجهة «ربح المشروع منذ البداية»، ولا تحول العربون إلى ربح تلقائي، ولا تعرض الدين كاشًا، ولا تعرض ربحًا نهائيًا عندما تكون عناصر مؤثرة في التكلفة ناقصة. ترجع كل قاعدة مالية إلى [`docs/contracts/05-financial-p0-policies.md`](../contracts/05-financial-p0-policies.md) وعقود Domain.

## 5. ما هو خارج النطاق عمدًا

يبقى خارج Prototype: Auth، Supabase، RLS، Workspace مركزي، Billing، Cloud Sync، تعدد المستخدمين، نظام أدوار، Ledger عام، نقطة التعادل العامة، تقارير المشروع منذ البداية، Inventory عام، POS، CRM، تكاملات الدفع، إشعارات خلفية مضمونة، AI، قطاعات الأطعمة والخدمات، وميزات SaaS التجارية.

يمكن أن تظهر بعض هذه الموضوعات في الوثائق بوصفها رؤية لاحقة أو حالات مؤجلة، لكن لا يجوز أن تتحول إلى شاشات أو جداول أو حقول داخل Prototype إلا بقرار جديد موثق ويمر عبر بوابة المنتج والسيناريوهات.

## 6. المعمارية الملزمة

يجب أن يفصل التنفيذ بين واجهة الويب وقواعد Micro والتخزين المحلي وفق المسار التالي:

```text
Web UI / RTL / Android-like interaction
                ↓
Application / Use Cases / View Models
                ↓
Micro Domain Core
                ↓
LocalStore Port
                ↓
IndexedDB implementation + local export/import

PWA manifest / Service Worker / Cloudflare deployment
تظل طبقة تشغيل ونشر منفصلة عن قواعد المال.
```

لا تضع React قواعد الربح أو العربون أو التسليم. ولا تتصل المكونات مباشرة بـIndexedDB. ولا يضيف LocalStore معنى ماليًا من عنده. يتحقق Application من المدخلات، ويستدعي Domain Core، ويحوّل النتيجة إلى View Model مفهوم للواجهة.

إذا استُخدم Capacitor مستقبلًا، يكون عميلًا إضافيًا لنفس Application/Domain contracts قدر الإمكان؛ لا يعاد تعريف المنتج داخل Native shell. وإذا ظهرت حاجة إلى Native UI مستقل، تبقى العقود والـView Models والاختبارات المالية مشتركة حيثما كان ذلك عمليًا.

## 7. نظام البناء المرحلي

لا نبني Prototype كاملًا كحزمة شاشات منفصلة، ولا نبني شاشة واحدة معزولة ثم نترك المسار غير مكتمل. الأسلوب المعتمد هو **Vertical Slices متعاقبة**؛ كل Slice يمر من البيانات إلى المنطق إلى الواجهة إلى الاختبار، ثم يُراجع قبل الانتقال إلى التالي.

| الدورة | نطاق العمل | بوابة المراجعة |
|---|---|---|
| 0 — Shell | تهيئة Web App، RTL، App Shell، التوكنات، Light/Dark، التنقل، حالة التحميل الأساسية | لا لون خام، لا dead ends، ولا تحذير console أساسي |
| 1 — بداية الطلب | التأسيس المحلي، «مشروعي الآن»، إنشاء الطلب، المسودة، الرجوع، الحفظ، والاستئناف | يستطيع المستخدم بدء طلب وحفظه دون فقد المدخلات |
| 2 — التكلفة والسعر | المواد والوقت وبقية مدخلات الشريحة، Cost Snapshot، known/estimated/missing، سعر الحماية | لا يظهر ربح نهائي مع نقص مؤثر، وتظهر الافتراضات ومصدر الرقم |
| 3 — الاتفاق والتنفيذ | الاتفاق، الموعد، العربون، Timeline، تحديث التنفيذ، الحفظ ومنع التكرار | العربون ليس ربحًا، والطلب لا يتخطى الحالات غير المسموحة |
| 4 — التسليم والنتيجة | التسليم، التحصيل أو الدين، نتيجة الطلب، درجة المعرفة، والفعل التالي | الدين ليس كاشًا، والتسليم لا يسجل قبضًا تلقائيًا، والنتيجة قابلة للشرح |
| 5 — الحماية المحلية | Export/Import، schema version، رفض الملف الناقص، حالات offline، الإعدادات الأساسية | ينجح round-trip ولا تُحذف الحالة الحالية عند استيراد غير صالح |
| 6 — الصقل والتحقق | 360/390/430px، Light/Dark، keyboard، Back، Bottom Sheets، empty/error/loading/no-results، Playwright ولقطات مرجعية عند اعتمادها | لا أخطاء حرجة، وكل فعل أساسي قابل لإعادة الاختبار |

بعد كل دورة لا ننتقل تلقائيًا. يجب أن يراجع المشرف المخرج، ويُغلق الوكيل المراجع قائمة القبول، ثم تُسجل الفجوات أو قرار الاستمرار في PR.

## 8. تعريف النجاح للـPrototype

ينجح Prototype عندما يستطيع مستخدم غير محاسبي إكمال مسار طلب حرفة واحد من البداية إلى النتيجة دون مساعدة مستمرة، ويستطيع أن يجيب بلسانه عن الأسئلة التالية: ما الذي سجلته؟ ما تكلفة العمل المعروفة أو المقدرة؟ ما الذي ينقص؟ كيف أثرت المعلومات في السعر؟ ما الذي قبضته؟ ما الذي بقي؟ وهل النتيجة نهائية أم تحتاج مراجعة؟ وما الخطوة التالية؟

النجاح التقني يتطلب أيضًا أن تحفظ المسودة محليًا، وأن تبقى Snapshots التاريخية ثابتة، وأن تمنع العمليات المكررة، وأن تحترم حالات Domain، وأن ينجح التصدير والاستيراد المحلي، وأن تعمل الواجهة في Light/Dark وعلى أحجام الهاتف الأساسية. لا يساوي هذا النجاح إثبات التبني التجاري أو الاستعداد للدفع؛ ذلك يحتاج Pilot منفصلًا.

## 9. المهارات الداخلية المطلوبة

توجد في `ai-skills/` مهارات المنتج والمال والسيناريوهات والتسليم. لا نكررها. عند بدء التنفيذ نضيف أو نكيّف فقط المهارات التي لا تغطيها الحزمة الحالية:

| المهارة | نطاقها | مخرجها |
|---|---|---|
| `micro-web-native-ux` | Web App بملء الشاشة، RTL، Android-like interactions، App Shell، Back، Sheets، Keyboard وSafe Areas | مراجعة UX مرتبطة بـUI/UX Reference وPrototype Spec |
| `micro-design-system` | تطبيق tokens والهوية المثبتة في الكود وLight/Dark وحالات المكونات | فحص عدم وجود قيم خام، وتطابق التصميم مع المرجع |
| `micro-local-first-prototype` | LocalStore، المسودات، schema، Export/Import، والاستعادة الآمنة | عقد تخزين واختبارات round-trip وملف استيراد غير صالح |
| `micro-prototype-qa` | فحص التدفقات، 360/390/430px، Light/Dark، الحالات المالية والبصرية | مصفوفة قبول ونتائج قابلة للتكرار |

كل Skill جديد يجب أن يحتوي `SKILL.md`، واسمًا ووصفًا ومتى يعمل، وروابط الوثائق الداخلية، وأي scripts أو references لازمة، وقواعد عدم التغيير. لا ننسخ مستودعات خارجية كاملة؛ نستخدم معيار Agent Skills المفتوح [3] ونوثق المصدر والترخيص والإصدار عندما نكيّف مادة خارجية.

## 10. حوكمة الوكلاء

يعمل الفريق بصورة مرحلية لا متوازية افتراضيًا. يوجد مشرف واحد مسؤول عن الاتساق، يراجع النطاق، ويقبل أو يرفض الانتقال بين الدورات. يمكن استخدام وكلاء متخصصين، لكن لا يملك أي منهم حق إعادة تعريف Micro أو تعديل هوية الألوان أو توسيع النطاق منفردًا.

| الدور | المسؤولية |
|---|---|
| Product/Financial Guard | يراجع المشكلة، السيناريو، P0، والحالات المالية قبل الكود |
| Architecture/Review Gate | يراجع الطبقات، العقود، التبعيات، والفروق قبل الدمج |
| Application/Logic | يبني Use Cases وView Models فوق Domain Core |
| Local Persistence | يبني LocalStore وExport/Import وschema دون معنى مالي جديد |
| Web UI | يبني الشاشات والمكونات والحالات وفق UI/UX Reference |

يجب أن يذكر كل تسليم ما قرأه، وما تغير، وما لم يتغير، والاختبارات، والمجهولات، ومخاطر الانتقال. إذا ظهر تعارض في المال أو المرحلة أو الهوية، يتوقف التنفيذ ويُرفع التعارض للمشرف بدل التخمين.

## 11. تنظيم المستودع

لا يوضع كود التطبيق داخل `docs/`، ولا توضع قواعد المال داخل مكونات الواجهة. البنية المستهدفة هي:

```text
src/
├── domain/                     # Domain Core الحالي
└── prototype/
    ├── app/                    # App shell وrouting وproviders
    ├── pages/                  # شاشات Prototype
    ├── components/             # مكونات UI المشتركة
    ├── application/            # Use Cases وView Models
    ├── storage/                # LocalStore وexport/import
    └── styles/                 # tokens وRTL وLight/Dark

tests/
├── domain/                     # اختبارات Domain
└── prototype/                  # اختبارات التدفقات والتخزين والواجهة

docs/
├── product/                    # المشكلة والمنتج وUI/UX
├── implementation/             # Charter وPrototype Spec وخارطة التنفيذ
├── contracts/                  # العقود والسياسات المالية
├── scenarios/                  # الشخصيات والحالات والأسئلة
├── research/                   # المصادر والمنطق المستخلص
└── quality/                    # المحاكاة والتغطية ونتائج الاختبار

ai-skills/                      # Skills فقط
scripts/                        # أدوات الفحص والبناء فقط
```

ملفات البحث المؤقتة أو تقارير الوكلاء لا تدخل `docs/` تلقائيًا. يدخل المستودع فقط القرار الدائم أو دليل الاختبار الذي يحتاجه الفريق مستقبلًا، ويُصنف Canonical أو Supporting أو Historical بوضوح.

## 12. GitHub والدمج

يجب ألا يدفع أي Agent مباشرة إلى `main`. يبدأ العمل من آخر `origin/main`، ثم يعمل في فرع محدد، ويفتح PR. في حال استخدام عدة وكلاء يكون المسار:

```text
main
  ↓
prototype/integration-v1
  ├── agent/web-native-ux
  ├── agent/application-logic
  ├── agent/local-store
  ├── agent/web-ui
  └── agent/qa-review
```

لا تُفتح فروع متوازية إذا كان أحدها يعتمد على مخرج الآخر؛ عندها يُستخدم الترتيب المتعاقب. لا يدمج PR إلى `main` إلا بعد مراجعة diff، ونجاح الفحوص، وإغلاق ملاحظات المراجع، وتسجيل التغييرات. يفضل أن يكون لكل Slice PR مفهوم بدل commit ضخم يجمع Domain والتخزين والواجهة دون حدود.

## 13. بوابة الإذن قبل البناء

هذا الميثاق يثبت القرار ولا يبدأ البناء تلقائيًا. لا تُهيأ scaffold جديدة، ولا تُضاف تبعيات، ولا يُكتب UI، ولا تُنشأ قاعدة LocalStore حتى يعطي مالك المنتج إذنًا صريحًا ببدء Prototype.

عند صدور الإذن، تكون البداية بالترتيب التالي: فحص حالة `origin/main`، تهيئة Web App المستهدف وفق بيئة البناء المعتمدة، إنشاء branch أو integration path، بناء Shell، ثم اختبار دورة 0 قبل الانتقال إلى دورة 1. إذا اختلفت بيئة المشروع الفعلية عن الافتراضات المذكورة هنا، يعاد ضبط الخطة وفق ما توفره scaffold قبل كتابة تفاصيل تقنية جديدة.

## 14. مراجع القرار

- [`AGENTS.md`](../../AGENTS.md)
- [`docs/01-product-and-technical-blueprint.md`](../01-product-and-technical-blueprint.md)
- [`docs/implementation/03-pre-build-alignment-v1.md`](03-pre-build-alignment-v1.md)
- [`docs/implementation/mobile-prototype-spec-v1.md`](mobile-prototype-spec-v1.md)
- [`docs/product/mobile-ui-ux-reference-v1.md`](../product/mobile-ui-ux-reference-v1.md)
- [`docs/contracts/05-financial-p0-policies.md`](../contracts/05-financial-p0-policies.md)
- [`docs/implementation/02-domain-contract-coverage.md`](02-domain-contract-coverage.md)
- [`docs/implementation/01-execution-roadmap.md`](01-execution-roadmap.md)
- [`ai-skills/README.ar.md`](../../ai-skills/README.ar.md)
- [Agent Skills open standard](https://agentskills.io/home)
- [web.dev — Progressive Web Apps](https://web.dev/explore/progressive-web-apps)
- [Capacitor — Cross-platform Native Runtime for Web Apps](https://capacitorjs.com/docs/)

### المراجع الخارجية المرقمة

[1]: https://web.dev/explore/progressive-web-apps "web.dev — Progressive Web Apps"
[2]: https://capacitorjs.com/docs/ "Capacitor — Cross-platform Native Runtime for Web Apps"
[3]: https://agentskills.io/home "Agent Skills — Open Standard Overview"

## 15. سجل الإصدار

| الإصدار | التاريخ | التغيير |
|---|---|---|
| v1.0 | 2026-08-22 | تثبيت Web-first Android-like Web App، PWA-ready، Cloudflare deployment target، Local-first Prototype، نظام البناء المرحلي، حوكمة الوكلاء، وفصل الكود عن الوثائق |
