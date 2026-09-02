# Third-Party Notices

## الحالة الحالية

لم يُدمج في Micro أي كود من Akaunting أو Bigcapital أو Crater أو ERPNext أو POSR أو EasyAppointments أو CostTable أو Recipe Costs أو Craftplan أو أي مشروع GitHub آخر. استُخدمت هذه المشاريع كمراجع بحث وتصميم فقط، وفق سياسة `ai-skills/saas-delivery-verifier/references/external_code_policy.md`.

## اعتماديات التطوير الحالية

يستخدم Domain Core حاليًا TypeScript وVitest كاعتماديات تطوير. يجب إعادة فحص إصدارات الاعتماديات وتراخيصها عند كل إصدار إنتاجي، وتحديث هذا الملف إذا أضيفت مكتبة أو كود أو أصل خارجي إلى المنتج.

## اعتماديات التشغيل المشحونة في حزمة الإنتاج (S5-04)

حزمة `dist/public` تشحن اليوم الاعتماديات التالية، وكلها تراخيص متساهلة:

| المكتبة/الأصل | الدور في الحزمة | الترخيص |
|---|---|---|
| react / react-dom | إطار الواجهة (chunk `react-runtime`) | MIT |
| wouter | التوجيه الخفيف (chunk `react-runtime`) | MIT |
| vaul | أدراج اللمس السفلية (chunk `interaction-runtime`) | MIT |
| lucide-react | الأيقونات (chunk `iconography`) | ISC |
| @radix-ui/react-tooltip | طبقة تلميحات الواجهة — chunk `radix-runtime` بعد فصله للمجموعة ٦ (G6-R5-10) | MIT |
| clsx | تركيب أصناف العناصر عبر `cn()` في `lib/utils.ts` (G6-R5-10) | MIT |
| tailwind-merge | حل تعارض أصناف Tailwind داخل `cn()` (G6-R5-10) | MIT |
| workbox-window + workbox-build | خدمة العملاء وPWA precache | MIT |
| IBM Plex Sans Arabic (٤٠٠/٥٠٠/٦٠٠/٧٠٠) | خط الواجهة العربي — مستضاف محليًا `public/fonts/` (S5-01) | SIL OFL 1.1 |
| IBM Plex Mono (٥٠٠/٦٠٠) | خط الأرقام والوحدات — مستضاف محليًا `public/fonts/` (S5-01) | SIL OFL 1.1 |

الأصول المذكورة أعلاه جُلبت من Google Fonts وتُخزَّن محليًا ضمن المستودع (`apps/prototype-web/client/public/fonts/`)؛ رخصة OFL تنص على إبقاء إشعار الترخيص مع التوزيع، وهذا الملف هو الإشعار المعتمد داخل المستودع.

يجب تحديث هذا الجدول عند أي تغيير في `apps/prototype-web/package.json` أو أصول الخطوط قبل الإصدار.

## سجل الإدخال الإلزامي

قبل دمج أي مصدر خارجي، يجب تسجيل الاسم، الرابط، الإصدار أو commit، الترخيص الفعلي، الملفات أو الأجزاء المستخدمة، التعديلات، الاعتماديات غير المباشرة، سبب الملاءمة، والمخاطر. إذا غاب الترخيص أو كانت شروطه غير واضحة، يُستخدم المصدر كفكرة أو نمط فقط ولا يُنسخ الكود.
