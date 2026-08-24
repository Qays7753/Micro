# G9.2 — QA قيد التشغيل المحدود

أضيفت دالة Application صريحة `deriveCapacityDecision` فوق `ScheduleDay` الحالي. تعيد `unknown` عند غياب السعة، و`needs_review` عند وجود مدد ناقصة، و`within_limit` أو `over_limit` عند اكتمال المدد. التعارض يبقى تحذيرًا مستقلًا.

اجتازت اختبارات Domain/Application للحد، التجاوز، النقص، التعارض، وعدم تحويل المجهول إلى صفر أو أثر مالي. لا تكتب الدالة إلى LocalStore ولا تغير موعدًا أو كاشًا أو ذمة أو نتيجة أو `CostSnapshot`.
