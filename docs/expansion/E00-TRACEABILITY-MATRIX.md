# Expansion — مصفوفة التتبع من القرار إلى العقد والاختبار

**الحالة:** `CURRENT / E-00 / REVIEW MAP`
**الغرض:** يمنع فقد قرار أو تكرار عقد، ويبين أين يثبت كل مبدأ قبل الكود وبعده.

## Major Discussion Points

| قرار أو خطر | العقد/الوثيقة الحاكمة | السيناريو/اختبار | أول مرحلة تنفيذ ممكنة | حارس عدم التوسع |
|---|---|---|---|---|
| Micro واحد: السوق والتوصيل بوابتان لا منتجات | `DECISIONS` EX-D01/D02/D10/D15…D17، عقد IA وعقد 19. | S-01 إلى S-03 وS-05/S-06A/S-15A. | L-00 ثم L-02/L-03/L-04 بعد Wedge. | لا Dashboard خدمات مركزية أو UI قبل E-00.14/Wedge، ولا Chat/ترتيب/حجز. |
| Manage محلي ولا أثر مالي تلقائي | `DECISIONS` EX-D03/D05، عقد 19 و23، بوابة Migration. | S-04 إلى S-06 وS-16. | L-02/L-03/L-04. | لا Migration/Schema/Export أو Event تلقائي. |
| هوية وعزل متعدد الأطراف | عقد 18، Matrix الدور، Activation SOP. | S-10 وS-18 واختبارات A-05. | A-01 بعد L ودليل. | لا ادعاء أمان من Simulator. |
| استعادة الهوية وAdmin المقيد | عقدا 18 و23، بوابة التفعيل، وخريطة الجهات الأربع والاستعادة. | حالات R-01…R-04 واختبارات A للحساب/العضوية/الامتياز. | A-01 بعد قرار هوية موثق. | لا كلمة مرور محلية أو انتحال أو دخول Admin إلى Manage. |
| حد أدنى للبيانات | عقد 21 و22 و24. | S-05 وS-09 وS-18. | A-03/E-04. | لا هاتف/عنوان/Media/Analytics بلا Scope. |
| Market Need/Response/Listing | عقد 20، بطاقة Wedge، Partner Pilot SOP. | S-01/S-02/S-07/S-08/S-12. | L-03 ثم E-03. | لا Checkout/Payment/Rating/Chat. |
| Delivery Request/Quote/Status | عقد 21، بطاقة Wedge، Partner Pilot SOP. | S-05/S-06/S-09/S-10/S-15. | L-04 ثم E-04. | لا GPS/Dispatch/Driver/COD. |
| Moderation/Consent/Audit | عقد 22 وMatrix الدور. | S-07/S-11/S-18. | L-03 simulator ثم A. | لا Admin مالي أو حذف صامت. |
| Offline/duplicate/recovery | عقد 23 وHome Trial SOP. | S-12 إلى S-17. | L-01 إلى L-05/A-06. | لا مزامنة أو آخر كتابة صامتة. |
| أخلاقيات/شفافية/Pilot | Activation SOP وPartner Pilot SOP. | بوابة A/B والمراجعة الأسبوعية. | قبل أول دعوة. | لا شريك/Review/Rating مزيف أو توسع بسبب vanity metrics. |
| قبول E-00 التوثيقي | `E00-INDEPENDENT-ACCEPTANCE-REVIEW-2026-08-27.md` وTracker وChecklist المراجعة. | مراجعة مستقلة لرأس موثق وروابط/نطاق وفحوص مشروع. | مكتمل توثيقيًا؛ L-00 ما زالت مشروطة. | لا يساوي قبول وثائق بتجربة بيت أو A أو Pilot. |
| جاهزية التشغيل والثقة قبل التفعيل | `ACTIVATION-OPERATIONAL-READINESS-AND-SAFETY-GATE.md` و`E00-12-INDEPENDENT-ACCEPTANCE-REVIEW-2026-08-27.md` مع العقود 18–24 وSOPs. | OR-01…OR-07، مراجعة دعم/incident/release/accessibility/measurement قبل A/B. | E-00.12 مقبولة توثيقيًا؛ ثم A/B حسب الدليل. | لا SLA أو مزود أو دعم شامل أو Analytics أو امتثال قانوني مفترض. |
| السيولة والنموذج التجاري | `COMMERCIAL-LIQUIDITY-AND-MODEL-DECISION-CARD.md` و`E00-13-INDEPENDENT-ACCEPTANCE-REVIEW-2026-08-27.md` وبطاقة Wedge وPilot SOP و`DECISIONS` EX-O06…EX-O08. | تفاعل ذري، عتبة نجاح/فشل، جهة بذرة، وقرار Build/Discovery/Defer/Reject. | E-00.13 مقبولة توثيقيًا؛ ثم L بعد قرار المالك. | لا سوق عام أو رسوم/عمولة/دفع أو ترتيب مدفوع أو توسع بسبب GMV/تسجيلات. |
| توزيع Owner بين Market وDelivery | عقد IA و`DECISIONS` EX-D02/D10/D15…D17 والعقود 19–21 و24. | S-01…S-06A/S-09/S-15A و`E00-14-INDEPENDENT-ACCEPTANCE-REVIEW-2026-08-28.md`. | E-00.14 مقبولة توثيقيًا؛ ثم L-00 بعد Wedge. | لا صفحة خدمات مركزية أو UI مبكر أو Chat/Ranking/Ratings/دفع/GPS/Dispatch أو انتقال Manage تلقائي. |

## Action Points

- [ ] يضيف كل PR توسعة صفًا أو رابطًا لهذه المصفوفة إذا أدخل قرارًا أو حقلًا أو حالة جديدة.
- [ ] لا يغلق بند Tracker ما لم يذكر العقد والسيناريو ودليل القبول المرتبطين في المصفوفة.
- [ ] يراجع المراجع المستقل المصفوفة عند كل انتقال L → A أو عند اقتراح قدرة عالية المخاطر.

## References

[1]: [القرارات المعتمدة](DECISIONS.md)
[2]: [سيناريوهات E-00](E00-SCENARIOS-AND-ACCEPTANCE.md)
[3]: [Checklist مراجعة E-00](E00-REVIEW-CHECKLIST.md)
