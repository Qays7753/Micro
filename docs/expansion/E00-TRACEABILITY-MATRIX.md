# Expansion — مصفوفة التتبع من القرار إلى العقد والاختبار

**الحالة:** `CURRENT / E-00 / REVIEW MAP`
**الغرض:** يمنع فقد قرار أو تكرار عقد، ويبين أين يثبت كل مبدأ قبل الكود وبعده.

## Major Discussion Points

| قرار أو خطر | العقد/الوثيقة الحاكمة | السيناريو/اختبار | أول مرحلة تنفيذ ممكنة | حارس عدم التوسع |
|---|---|---|---|---|
| Micro واحد والخدمات لوحة متابعة | `DECISIONS` EX-D01/D02، عقد 19. | S-01 إلى S-03. | L-02 بعد G19–G23. | لا tabs/متجر خدمات أو UI قبل UX. |
| Manage محلي ولا أثر مالي تلقائي | `DECISIONS` EX-D03/D05، عقد 19 و23، بوابة Migration. | S-04 إلى S-06 وS-16. | L-02/L-03/L-04. | لا Migration/Schema/Export أو Event تلقائي. |
| هوية وعزل متعدد الأطراف | عقد 18، Matrix الدور، Activation SOP. | S-10 وS-18 واختبارات A-05. | A-01 بعد L ودليل. | لا ادعاء أمان من Simulator. |
| حد أدنى للبيانات | عقد 21 و22 و24. | S-05 وS-09 وS-18. | A-03/E-04. | لا هاتف/عنوان/Media/Analytics بلا Scope. |
| Market Need/Response/Listing | عقد 20، بطاقة Wedge، Partner Pilot SOP. | S-01/S-02/S-07/S-08/S-12. | L-03 ثم E-03. | لا Checkout/Payment/Rating/Chat. |
| Delivery Request/Quote/Status | عقد 21، بطاقة Wedge، Partner Pilot SOP. | S-05/S-06/S-09/S-10/S-15. | L-04 ثم E-04. | لا GPS/Dispatch/Driver/COD. |
| Moderation/Consent/Audit | عقد 22 وMatrix الدور. | S-07/S-11/S-18. | L-03 simulator ثم A. | لا Admin مالي أو حذف صامت. |
| Offline/duplicate/recovery | عقد 23 وHome Trial SOP. | S-12 إلى S-17. | L-01 إلى L-05/A-06. | لا مزامنة أو آخر كتابة صامتة. |
| أخلاقيات/شفافية/Pilot | Activation SOP وPartner Pilot SOP. | بوابة A/B والمراجعة الأسبوعية. | قبل أول دعوة. | لا شريك/Review/Rating مزيف أو توسع بسبب vanity metrics. |

## Action Points

- [ ] يضيف كل PR توسعة صفًا أو رابطًا لهذه المصفوفة إذا أدخل قرارًا أو حقلًا أو حالة جديدة.
- [ ] لا يغلق بند Tracker ما لم يذكر العقد والسيناريو ودليل القبول المرتبطين في المصفوفة.
- [ ] يراجع المراجع المستقل المصفوفة عند كل انتقال L → A أو عند اقتراح قدرة عالية المخاطر.

## References

[1]: [القرارات المعتمدة](DECISIONS.md)
[2]: [سيناريوهات E-00](E00-SCENARIOS-AND-ACCEPTANCE.md)
[3]: [Checklist مراجعة E-00](E00-REVIEW-CHECKLIST.md)
