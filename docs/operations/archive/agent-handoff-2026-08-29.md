# تقرير تسليم للإيجنت التالي — 29 أغسطس 2026

## الخلاصة التنفيذية

تم دمج سلسلة «العمل» حتى تسجيل البيع المباشر وتعديله أو إلغائه. التطبيق يعمل محليًا
على الـPreview، وتهيئة ما بعد الدمج تعمل بعد إصلاح مشكلة إصدار pnpm.

آخر رأس محلي على `main` هو دمج تصحيح المبيعات المباشرة:
`2d25448de8cb5b5583a5d541cd2ed90e568b8c5e`.

## ما تم إنجازه

### 1. وجهة «العمل»

- حُسم اسم الوجهة وسلوكها في المهمة #4.
- أُنشئت وجهة «العمل» لتعرض ما يخص العمل الفعلي دون طلبات وهمية.
- صارت شاشة الطلبات متكيفة مع وجود السجلات الفعلية، مع مسار واضح للأفعال المتاحة.
- التغييرات الأساسية موجودة في:
  - `apps/prototype-web/client/src/pages/Orders.tsx`
  - `apps/prototype-web/client/src/app/navigation.ts`
  - `apps/prototype-web/client/src/app/navigation.test.ts`
  - `apps/prototype-web/client/src/pages/Orders.ui.test.tsx`

### 2. تسجيل البيع المباشر

- أضيف نموذج بيع مباشر مستقل عن الطلبات الخارجية.
- يمكن لصاحب المحل تسجيل البيع ومشاهدته داخل «العمل».
- المسار محلي-first عبر Application Service وLocalStore، وليس اتصالًا بقاعدة بيانات أو خدمة خارجية.
- الطبقات الرئيسية:
  - `src/domain/direct-sale/`
  - `apps/prototype-web/client/src/application/direct-sales/directSaleService.ts`
  - `apps/prototype-web/client/src/pages/DirectSaleEditor.tsx`
  - `apps/prototype-web/client/src/storage/local/`

### 3. تصحيح أو إلغاء البيع المحفوظ

- يمكن فتح بيع مباشر محفوظ وتعديله.
- يمكن إلغاء البيع بعد الحفظ وفق مسار تصحيح موثق، دون حذف صامت.
- أضيفت اختبارات Domain وApplication وواجهة المستخدم.
- هذه التغييرات مدمجة في المهمة #7، والـcommit الحالي هو رأس `main`.

## إصلاحات البيئة والـPreview

- الـWorkflow الحالي:
  - `Project` يشغل `Start application`.
  - `Start application` يشغل Vite على `0.0.0.0:5000`.
- سكربت ما بعد الدمج:
  - `scripts/post-merge.sh`
  - يستخدم `corepack pnpm` بدل `pnpm` العادي حتى يلتزم بـ`pnpm@9.15.9`.
  - ينفذ تثبيت القفل، فحص TypeScript، وبناء الـPrototype.
- تم تشغيل التهيئة بعد الدمج بنجاح بعد هذا الإصلاح.
- تم تشغيل الـPreview والتحقق منه بصريًا؛ الصفحة تفتح على المنفذ 5000.
- توجد تحذيرات غير حاجبة مرتبطة بمتغيرات Analytics غير المعرفة وطلب ثابت واحد `404` في سجل المتصفح؛ لم تمنع تشغيل الصفحة.

## ما لم يُنفذ وما يجب ألا يُدّعى

- المهمة #8 أُلغيت: **لا توجد حماية مكتملة من ضياع تصحيح عند تعديل البيع من تبويبين في الوقت نفسه**.
- إذا أُعيد فتح هذه الحاجة، يجب تصميمها كمسار مستقل: كشف تعارض/نسخة عند الحفظ ومنع الكتابة الصامتة فوق تعديل أحدث، مع اختبار تبويبين.
- لا يوجد Auth أو Sync أو Cloud أو SaaS أو بيانات مستخدمين حقيقية.
- لا يوجد قبول نهائي على Android/iOS أو PWA مثبتة أو Offline إنتاجي أو Production أو Pilot ميداني.
- لا تُعامل بيانات الـPrototype المحلية أو المعاينة على أنها بيانات تشغيل حقيقية.

## نقطة البدء للإيجنت التالي

1. اقرأ هذا التقرير، ثم `docs/operations/current-state.md` و`AGENTS.md`.
2. افحص حالة المهام قبل إنشاء عمل جديد؛ #4 و#5 و#6 و#7 مدمجة، و#8 ملغاة.
3. قبل أي تعديل شغّل:

   ```bash
   corepack pnpm run check
   corepack pnpm run prototype:build
   ```

4. عند تعديل المبيعات المباشرة، راجع أولًا:
   - `src/domain/direct-sale/`
   - `apps/prototype-web/client/src/application/direct-sales/`
   - `apps/prototype-web/client/src/pages/DirectSaleEditor.tsx`
   - اختبارات البيع المباشر و`Orders.ui.test.tsx`.
5. لا تغيّر معنى السجل المالي أو التخزين أو الاستيراد/التصدير دون عقد واختبارات مستقلة.