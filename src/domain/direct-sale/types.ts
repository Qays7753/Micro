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
  /* S05 (DOC-014 / UNIT-037 P3.2 + العقد المشترك §5.1 — PartyRef): ربط صريح
   * بطرف محفوظ إن اختاره المستخدم — اختياري: غيابه (أو null) يعني تعريفًا
   * نصيًا على المصدر أو بيعًا بلا طرف؛ لا يُستنتج من الاسم أبدًا ولا يُنشأ
   * تلقائيًا. لقطة الاسم تبقى customerName كما سُجلت وقت الحفظ. */
  customerPartyId?: string | null;
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
  /* S11 (UNIT-026 sale-slice): خطوط القبض المؤرخة داخل الأصل — اختيارية
   * متوافقة رجعيًا؛ collectedMinor يبقى الإجمالي المحروس وتُعدل الحركات
   * معه معًا دائمًا داخل دالة نطاق واحدة (لا تعديل المجموع وحده). */
  collections?: readonly DirectSaleCollectionEntry[];
  /* S11 (UNIT-005/PD-02): المرتجع الكامل — غيابه/null = بيع غير مُرتجع. */
  return?: DirectSaleFullReturn | null;
  /* S11 (UNIT-026 sale-slice): مدفوعات الرد الفعلية المؤرخة — غيابها = لا رد مدفوع. */
  refundPayments?: readonly DirectSaleRefundPaymentEntry[];
  /* S11: إجمالي المُرَدّ فعليًا — نظير collectedMinor المحروس لحركة الكاش الخارجة. */
  refundedMinor?: MoneyMinor;
};

export type DirectSaleCollectionStatus =
  | "collected_in_full"
  | "partial_debt"
  | "partial_needs_review"
  /* S11 (UNIT-005/PD-02 — أمر b33a8877): مرتجع كامل مؤهل — الحق المتبقي
   * أُلغي والبيع الأصل وتاريخه محفوظان؛ لا تحصيل ولا تعديل مالي بعده. */
  | "returned_full";
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

/* S11 (UNIT-026 sale-slice — أمر b33a8877 §6): سطر قبض مؤرخ داخل أصل البيع
 * نفسه — هوية وتاريخ أعمال حقيقي ومفتاح نية؛ لا تعديل مجموع collectedMinor
 * وحده أبدًا (P3.2: entryId/amount/occurredOn/commandId). الحقل الاختياري
 * متوافق رجعيًا: غيابه = القبض المجمل القديم كما هو بدرجته ولا تُؤلف تواريخه
 * (SDF-014). تخصيص المحفظة إن وُجد يرتبط بسطر القبض القائم نفسه
 * (allocationEntryId) لا بقبض آخر ولا بحدث كاش إضافي. */
export type DirectSaleCollectionEntry = {
  id: string;
  amountMinor: MoneyMinor;
  occurredOn: string;
  operationKey: string;
  recordedAt: string;
  note: string | null;
  allocationEntryId?: string | null;
};

/* S11 (UNIT-005/PD-02): المرتجع الكامل المؤهل — يُبقي البيع الأصل وتاريخه
 * وسجل تغييراته، ويلغي الحق المتبقي، ويثبت حق رد المقبوض فعليًا فقط
 * (لا الإيراد كله)؛ لا نقص نقد قبل دفع رد فعلي. */
export type DirectSaleFullReturn = {
  occurredOn: string;
  refundDueMinor: MoneyMinor;
  operationKey: string;
  recordedAt: string;
  reason: string;
};

/* S11 (UNIT-026 sale-slice): دفع رد فعلي مؤرخ داخل أصل البيع — ينقص حق الرد
 * القائم ولا يُدفع مرتين (SDF-054)؛ الكاش ينقص بقدره عند القراءة المالية
 * من مصدره الواحد. */
export type DirectSaleRefundPaymentEntry = {
  id: string;
  amountMinor: MoneyMinor;
  occurredOn: string;
  operationKey: string;
  recordedAt: string;
  note: string | null;
  allocationEntryId?: string | null;
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
  /* S05 (DOC-014 / UNIT-037): ربط طرف محفوظ اختياري — لقطة الاسم تبقى مع
   * المصدر (customerName) ولا تُحدّث بتعديل الطرف لاحقًا. */
  customerPartyId?: string | null | undefined;
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
  /* S05 (DOC-014 / UNIT-037): undefined يُبقي ربط الأصل؛ null الصريح يفك الربط. */
  customerPartyId?: string | null | undefined;
  costMinor: MoneyMinor | null;
  occurredOn: string;
  note: string;
};

/* S11 (UNIT-026 sale-slice): تحصيل دفعة على بيع آجل حي مؤكد المتبقي —
 * دالة نطاق واحدة تعدل الإجمالي والسطر المؤرخ معًا؛ الحارس الحي (النسخة
 * والمتبقي) داخل حد كتابة المخزن لا هنا. */
export type CollectDirectSalePaymentInput = {
  entryId: string;
  amountMinor: MoneyMinor;
  occurredOn: string;
  operationKey: string;
  recordedAt: string;
  note?: string | null;
  allocationEntryId?: string | null;
};

/* S11 (UNIT-005/PD-02): إثبات المرتجع الكامل — يلغي الحق ويثبت رد المقبوض. */
export type DirectSaleFullReturnInput = {
  occurredOn: string;
  operationKey: string;
  recordedAt: string;
  reason: string;
};

/* S11 (UNIT-026 sale-slice): دفع رد فعلي مؤرخ — لا يتجاوز حق الرد القائم. */
export type PayDirectSaleRefundInput = {
  entryId: string;
  amountMinor: MoneyMinor;
  occurredOn: string;
  operationKey: string;
  recordedAt: string;
  note?: string | null;
  allocationEntryId?: string | null;
};

/* S11 (UNIT-026 sale-slice — تصحيح R1 للمراجعة): عكس تحصيل مؤرخ موثق داخل
 * دالة نطاق واحدة — المجموع المحروس والتفصيل المؤرخ يسيران معًا دائمًا
 * (المفتاح نفسه للمراجعة والحركة السالبة لأنهما واقعة عكس واحدة). */
export type ReverseDirectSaleCollectionInput = {
  amountMinor: MoneyMinor;
  occurredOn: string;
  operationKey: string;
  recordedAt: string;
  reason: string;
  note?: string | null;
  allocationEntryId?: string | null;
};
