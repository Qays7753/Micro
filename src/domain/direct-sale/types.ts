/** A direct sale is its own financial record. It is never inferred from an order collection. */
import type { Currency, MoneyMinor } from "../shared/index.js";

export type DirectSale = {
  id: string;
  itemName: string;
  quantity: number;
  currency: Currency;
  revenueMinor: MoneyMinor;
  collectedMinor: MoneyMinor;
  /* D-001: هوية زبون البيع الآجل حقل مستقل صادق — لا تُستخرج من نص الملاحظة.
   * اختياري كسجلات ما قبل الحقل؛ غيابه يعني «بدون زبون مسجل». */
  customerName?: string | null;
  /* X-06 (و٤): حالة الفرق بين المتفق والمقبوض — «partial_debt» يظهر الفرق في «لي عند
   * العملاء»، و«partial_needs_review» فرق لم يُقرَّر بعد. الحقل إضافي اختياري:
   * السجلات القديمة بلا حقوله تُقرأ قبضًا كاملًا (collected === revenue دائمًا عندها) —
   * قراءة التوافق هذه تعيش في التخزين والقراءة لا في مدخلات الإنشاء (F-013/W2-A). */
  collectionStatus?: DirectSaleCollectionStatus;
  /** Optional catalog reference binding (القيد التاسع — ربط اختياري لا يلزم أحدًا). */
  catalogItemId?: string | null;
  costMinor: MoneyMinor | null;
  profitMinor: MoneyMinor | null;
  occurredOn: string;
  recordedAt: string;
  note: string;
  idempotencyKey: string;
  /** Optional on legacy local records; missing means active with no corrections. */
  status?: DirectSaleStatus;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  revisions?: readonly DirectSaleRevision[];
};

export type DirectSaleCollectionStatus = "collected_in_full" | "partial_debt" | "partial_needs_review";
type DirectSaleStatus = "active" | "cancelled";
type DirectSaleRevisionKind = "edit" | "cancel" | "price_cut";
export type DirectSaleRevision = {
  kind: DirectSaleRevisionKind;
  idempotencyKey: string;
  createdAt: string;
  reason: string | null;
  /** Present when the agreed revenue changed: the original stays in the record (X-06). */
  beforeRevenueMinor?: MoneyMinor | null;
};

export type CreateDirectSaleInput = {
  id: string;
  itemName: string;
  quantity: number;
  revenueMinor: MoneyMinor;
  /* F-013 (W2-A): المجهول ليس مقبوضًا كاملًا — المجال لا يفترض القبض الكامل عند
   * غياب الحقل؛ الافتراض الوحيد المتعمد يعيش مرة واحدة عند حد التطبيق (البيع
   * النقدي السريع في DirectSaleService.record) موثقًا هناك. */
  collectedMinor: MoneyMinor;
  /** Defaults to the derived status of collected vs revenue when absent. */
  collectionStatus?: DirectSaleCollectionStatus | undefined;
  catalogItemId?: string | null | undefined;
  /** D-001: اسم الزبون للدين — اختياري؛ الفراغ الصريح يعني بلا زبون. */
  customerName?: string | null | undefined;
  costMinor: MoneyMinor | null;
  occurredOn: string;
  recordedAt: string;
  note: string;
  idempotencyKey: string;
};

export type UpdateDirectSaleInput = {
  itemName: string;
  quantity: number;
  revenueMinor: MoneyMinor;
  /* F-013 (W2-A): التعديل يوجب المقبوض الصريح — حذفه كان يعيد ضبط القبض إلى
   * السعر المتفق كاملًا بصمت، وهو خطر مالي حي في مسار التصحيح. */
  collectedMinor: MoneyMinor;
  collectionStatus?: DirectSaleCollectionStatus | undefined;
  catalogItemId?: string | null | undefined;
  /** D-001: undefined يُبقي زبون الأصل؛ null الصريح يمحو الزبون. */
  customerName?: string | null | undefined;
  costMinor: MoneyMinor | null;
  occurredOn: string;
  note: string;
};
