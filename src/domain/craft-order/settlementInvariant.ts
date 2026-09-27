import { orderValueMinor } from "./policies.js";
import type { CraftOrder } from "./types.js";

/* Group 1 (الميثاق الرئيسي للإصلاح 2026-09-28 — F-004/F-005): ثابت أساس
 * التسوية ملك الدومين — اشتقاق قراءة فقط يعلن انحرافات التسوية بلا أي كتابة:
 *
 * ١) ثابت الأحداث (كل الطلبات): مجموع أحداث القبض (عربون + تحصيل) ناقص
 *    أحداث العكس (عكس تحصيل + عكس عربون نشط + رد عربون الملغى) يساوي
 *    المقبوض المسجل — الأحداث هي الحقيقة. الاحتفاظ بالعربون (deposit_retained)
 *    لا يُطرح: الاحتفاظ لا يعيد المال للزبون.
 * ٢) ثابت الأساس (الطلبات غير الملغاة — للملغى مسار تسوية عربونه الخاص
 *    يعيد المتبقي إلى صفر عند اكتماله): المتبقي المسجل يطابق أساس قيمة
 *    الطلب القابلة للتحصيل (عقد ٢، البند ٤٣) بلا Math.max عمدًا — السجل
 *    الذي تجاوز قبضه القيمة يظهر سالبًا فلا يطابق المخزن أبدًا (نفس منطق
 *    حارس D-15 assertSettlementBasisConsistent: الحارس أشد لا أخف).
 *
 * الاشتقاق ومفردات التفصيل يملكهما الدومين — مثل DELIVERY_RESPONSIBILITY_AR
 * وdescribeSettlementConflict — ويُحمَّلان عند الفحص فقط فلا يدخلان حزمة
 * الدخول الرئيسية (سقف D-034). النتيجة كائن بيانات مطابق شكليًا لما يستهلكه
 * فاحص السلامة في التطبيق (id/titleAr/status/detailAr/...) بلا استيراد بين
 * الطبقتين — التطبيق يمرر العنوان المعتمد من سجل فحوصه فيبقى مصدر المفردات
 * واحدًا لكل طبقة. */

export type SettlementOrderLike = {
  id: string;
  order: CraftOrder;
};

/** معرّف الفحص الثابت — يستهلكه فاحص التطبيق في واجهة النتيجة. */
export const SETTLEMENT_INVARIANT_CHECK_ID = "MIC-18" as const;

/** النتيجة الكاملة لفحص ثابت التسوية — بيانات فقط، بلا أي كتابة. */
export type SettlementInvariantResult = {
  id: typeof SETTLEMENT_INVARIANT_CHECK_ID;
  titleAr: string;
  status: "PASS" | "FAIL";
  detailAr: string;
  offenderCount: number;
  offenderSampleIds: readonly string[];
  driftMinor: number;
  deepLink: string;
};

export function settlementInvariantResult(
  orders: readonly SettlementOrderLike[],
  titleAr: string,
): SettlementInvariantResult {
  const offenders: string[] = [];
  let driftMinor = 0;
  for (const stored of orders) {
    const order = stored.order;
    /* (١) ثابت الأحداث — أحداث القبض والعكس تسوّي المقبوض المسجل. */
    const inflow = order.events
      .filter(event => event.type === "deposit_collected" || event.type === "collection_recorded")
      .reduce((sum, event) => sum + (event.amountMinor ?? 0), 0);
    const outflow = order.events
      .filter(
        event =>
          event.type === "collection_reversed" ||
          event.type === "deposit_reversed" ||
          event.type === "deposit_refunded",
      )
      .reduce((sum, event) => sum + (event.amountMinor ?? 0), 0);
    const eventCollectedMinor = inflow - outflow;
    if (eventCollectedMinor !== order.collectedMinor) {
      offenders.push(`أحداث-لا-تسوي-المقبوض:${stored.id}`);
      driftMinor += Math.abs(eventCollectedMinor - order.collectedMinor);
      continue;
    }
    /* (٢) ثابت الأساس — المتبقي المسجل يطابق قيمة الطلب القابلة للتحصيل. */
    if (order.status === "cancelled") continue;
    const derivedReceivableMinor = orderValueMinor(order) - order.collectedMinor;
    if (order.receivableMinor !== derivedReceivableMinor) {
      offenders.push(`متبقي-لا-يطابق-الأساس:${stored.id}`);
      driftMinor += Math.abs(derivedReceivableMinor - order.receivableMinor);
    }
  }
  if (offenders.length > 0)
    return {
      id: SETTLEMENT_INVARIANT_CHECK_ID,
      titleAr,
      status: "FAIL",
      detailAr:
        `ثابت أساس التسوية مكسور في ${offenders.length} طلبًا — الأحداث أو المتبقي المسجل ` +
        "لا يطابق أساس قيمة الطلب القابلة للتحصيل. راجع الطلب المعني؛ التحصيل العادي محجوز له حتى تصحيح موثق.",
      offenderCount: offenders.length,
      offenderSampleIds: offenders.slice(0, 5),
      driftMinor,
      deepLink: "/orders",
    };
  return {
    id: SETTLEMENT_INVARIANT_CHECK_ID,
    titleAr,
    status: "PASS",
    detailAr:
      "ثابت أساس التسوية سليم: أحداث القبض والعكس تسوّي المقبوض المسجل، والمتبقي يطابق قيمة الطلب القابلة للتحصيل لكل طلب غير ملغى.",
    offenderCount: 0,
    offenderSampleIds: [],
    driftMinor: 0,
    deepLink: "/orders",
  };
}
