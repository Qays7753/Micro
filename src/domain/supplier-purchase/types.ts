/** Material purchases affect cash/payables only until inventory consumption is implemented. All money is JOD minor units. */
export type SupplierPurchaseStatus = "unpaid" | "partially_paid" | "paid";
/* S07 (UNIT-027 D01 / العقد المشترك §5.4 PurchaseLine): معالجة معلنة لكل
 * بند تُوثّق لحظة الشراء — قرار الاعتراف المؤرخ الذي يقرأه قارئ الفترة؛
 * period_material = مواد فترة تُحمل تكلفتها مرة على فترة تاريخ الشراء
 * (D02 المعتمد)، وtracked_material = مواد متتبعة تكلفتها عند الاستعمال/الهدر
 * المؤهل عبر حركات المخزون لا عند الشراء. لا يعاد تصنيف الماضي بصمت. */
export type SupplierPurchaseLineTreatment = "period_material" | "tracked_material";
export type SupplierPurchaseLine = {
  lineId: string;
  /* مرجع مادة اختياري — tracked_material يوجبه؛ وperiod_material قد يكون بلا
   * مادة (مواد يومية بلا تعريف مادة) وفق SDF-067. */
  materialId?: string | null;
  /** الكمية المتوقعة بوحدة المادة — اختيارية؛ null = غير مسجلة. */
  expectedQuantityMilli?: number | null;
  /* قيمة البند: معلومة = موجبة آمنة لا تجعل مجموع البنود يتجاوز إجمالي
   * الشراء؛ مجهولة = null لا صفرًا معلومًا (SDF-036: الكمية قد تعرف والقيمة
   * مجهولة). */
  valueMinor?: number | null;
  costKnowledge: "known" | "unknown";
  treatment: SupplierPurchaseLineTreatment;
};
export type SupplierPurchasePayment = {
  id: string;
  amountMinor: number;
  occurredOn: string;
  recordedAt: string;
  idempotencyKey: string;
  note: string;
  /* FIN-003 (قرار المالك المعتمد ٢٠٢٦-٠٩-١٦): محفظة مصدر الدفعة إن عُيّنت
   * وقت التسجيل — حقل اختياري متوافق رجعيًا: الدفعات القديمة بلاه تُقرأ
   * «من الكاش غير الموزع» ولا يُعاد إسنادها تاريخيًا أبدًا. */
  walletId?: string | null;
};
/* المجموعة ٢ (§10.4): تراجع موثق عن دفعة مورد — يستعيد ما بقي للمورد ويُرجع أثر
 * الكاش؛ لا يُحذف الدفع الأصلي بل تبقى علاقة التدقيق صريحة عبر paymentId. */
export type SupplierPurchasePaymentReversal = {
  id: string;
  paymentId: string;
  amountMinor: number;
  reason: string;
  occurredOn: string;
  recordedAt: string;
  idempotencyKey: string;
};
/* المجموعة ٢ (§10.4): مراجعة موثقة لتعديل الشراء — القيم قبل التصحيح محفوظة
 * في المراجعة نفسها، والسجل الأصلي لا يُمسح. */
export type SupplierPurchaseRevision = {
  kind: "edit";
  idempotencyKey: string;
  createdAt: string;
  reason: string;
  beforeTotalMinor: number;
  beforeInitialPaidMinor: number;
  /* S05 (DOC-014 / UNIT-037): null = الشراء كان بلا مورد مسجل (مدفوع كاملًا). */
  beforeSupplierName: string | null;
  beforeNote: string;
  beforePurchasedOn: string;
  beforeDueOn: string | null;
  /* المجموعة ٢ (عقد ٢٨): ربط المادة والكمية المتوقعة في مراجعة التعديل —
   * القديمة بلاها تُقرأ فارغة (null) بلا تعبئة. */
  beforeMaterialId?: string | null;
  beforeExpectedQuantityMilli?: number | null;
  /* S07 (UNIT-027): البنود قبل التعديل — لقطة موثقة كقيم «قبل التصحيح»
   * الأخرى؛ غيابها = لم تكن للشراء بنود. */
  beforeLines?: readonly SupplierPurchaseLine[] | null;
};
export type SupplierPurchase = {
  id: string;
  /* S05 (DOC-014 / UNIT-037 A1/AC02 — U037-ACD02): المورد اختياري في الشراء
   * المدفوع كاملًا — null تعني «بلا مورد مسجل» بصدق (لا طرف «غير مسجل»
   * مشترك ولا اسم مصنوع). السجلات القديمة دائمًا اسم غير فارغ؛ والاستحقاق
   * القائم يوجب تعريفًا بسيطًا أو ربط مورد محفوظ (سياسات الإنشاء/التعديل). */
  supplierName: string | null;
  /* S05 (DOC-014 / UNIT-037 P3.2 + العقد المشترك §5.1 — PartyRef): ربط صريح
   * بمورد محفوظ إن اختاره المستخدم — اختياري: غيابه (أو null) يعني تعريفًا
   * نصيًا على المصدر أو شراءً بلا مورد؛ لا يُستنتج من الاسم أبدًا. لقطة
   * الاسم تبقى supplierName كما سُجلت وقت الحفظ. */
  supplierPartyId?: string | null;
  note: string;
  purchasedOn: string;
  dueOn: string | null;
  totalMinor: number;
  paidMinor: number;
  payableMinor: number;
  status: SupplierPurchaseStatus;
  idempotencyKey: string;
  payments: readonly SupplierPurchasePayment[];
  /** تراجعات موثقة عن دفعات لاحقة — السجلات القديمة بلاها تُقرأ فارغة. */
  paymentReversals?: readonly SupplierPurchasePaymentReversal[];
  /** مراجعات موثقة لتعديل الشراء — القديمة بلاها تُقرأ فارغة. */
  revisions?: readonly SupplierPurchaseRevision[];
  /* المجموعة ٢ (عقد ٢٨ / TR-07): مادة مرتبطة اختيارية — تُعبّئ جسر الاستلام
   * (المادة + الكمية + القيمة المتبقية). غيابها = null (غير معروف) لا صفر. */
  materialId?: string | null;
  /** الكمية المتوقعة بوحدة المادة — اختيارية؛ null = غير مسجلة، والحد يبقى على القيمة. */
  expectedQuantityMilli?: number | null;
  /* S07 (UNIT-027 D01): بنود اختيارية بهوية ثابتة ومعالجة اعتراف معلنة —
   * غيابها (الإرث/شراء بلا بنود) يُقرأ بالمسار القائم نفسه ولا يُعاد
   * تصنيفه رجعيًا أبدًا (حد D02 الصريح). */
  lines?: readonly SupplierPurchaseLine[] | null;
  createdAt: string;
  updatedAt: string;
};
export type CreateSupplierPurchaseInput = {
  id: string;
  /* S05 (DOC-014 / UNIT-037): null = شراء مدفوع كاملًا بلا مورد مسجل. */
  supplierName: string | null;
  supplierPartyId?: string | null;
  note: string;
  purchasedOn: string;
  dueOn?: string | null;
  totalMinor: number;
  initialPaidMinor: number;
  recordedAt: string;
  idempotencyKey: string;
  materialId?: string | null;
  expectedQuantityMilli?: number | null;
  /* S07 (UNIT-027 D01): بنود الشراء عند الإنشاء — اختيارية؛ الغياب/الفراغ
   * = شراء بلا بنود (المسار القائم). */
  lines?: readonly SupplierPurchaseLine[] | null;
  /* FIN-003: مصدر الدفعة الأولية إن دُفع شيء الآن — نفس دلالة walletId في الدفعة. */
  initialPaymentWalletId?: string | null;
};
export type RecordSupplierPurchasePaymentInput = {
  id: string;
  amountMinor: number;
  occurredOn: string;
  recordedAt: string;
  idempotencyKey: string;
  note: string;
  /* FIN-003: محفظة مصدر الدفعة — null/غياب = من الكاش غير الموزع. */
  walletId?: string | null;
};
/* المجموعة ٢ (§10.4): تعديل موثق لسجل الشراء — التكلفة والدفع الأولي والبيانات
 * وربط المادة والكمية المتوقعة (المجموعة ٢ — عقد ٢٨). */
export type UpdateSupplierPurchaseInput = {
  /* S05 (DOC-014 / UNIT-037): null = بلا مورد مسجل (مسموح ما دام مسددًا كاملًا). */
  supplierName: string | null;
  supplierPartyId?: string | null;
  note: string;
  purchasedOn: string;
  dueOn?: string | null;
  totalMinor: number;
  initialPaidMinor: number;
  recordedAt: string;
  idempotencyKey: string;
  reason: string;
  materialId?: string | null;
  expectedQuantityMilli?: number | null;
  /* S07 (UNIT-027): بنود الشراء بعد التعديل — استبدال معلن بقيم «قبل»
   * موثقة في المراجعة؛ لا تعديل صامت خارجها. */
  lines?: readonly SupplierPurchaseLine[] | null;
};
export type ReverseSupplierPurchasePaymentInput = {
  id: string;
  paymentId: string;
  reason: string;
  occurredOn: string;
  recordedAt: string;
  idempotencyKey: string;
};
