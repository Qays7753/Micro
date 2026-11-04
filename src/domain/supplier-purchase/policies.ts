import { fieldLabelAr, isValidLocalDate, isValidTimestamp } from "../shared/index.js";
import type {
  CreateSupplierPurchaseInput,
  RecordSupplierPurchasePaymentInput,
  ReverseSupplierPurchasePaymentInput,
  SupplierPurchase,
  SupplierPurchaseLine,
  SupplierPurchasePayment,
  SupplierPurchasePaymentReversal,
  SupplierPurchaseRevision,
  SupplierPurchaseStatus,
  UpdateSupplierPurchaseInput,
} from "./types.js";

/* R2 (M-04/D3، 2026-10-08): صلاحية التاريخ المحلي من النواة الكنسية — كانت
 * regex+NaN فقط فتقبل تواريخ الدوران (2023-02-29). */
const validDate = (value: string) => isValidLocalDate(value);
const assertText = (value: string, field: string) => {
  if (!value.trim()) throw new Error(`أكمل ${fieldLabelAr(field)} قبل الحفظ.`);
};
const assertPositive = (value: number, field: string) => {
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(`أدخل ${fieldLabelAr(field)} رقمًا صحيحًا موجبًا.`);
};
const assertNonNegative = (value: number, field: string) => {
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`أدخل ${fieldLabelAr(field)} رقمًا صحيحًا غير سالب.`);
};
const statusFor = (totalMinor: number, paidMinor: number): SupplierPurchaseStatus =>
  paidMinor <= 0 ? "unpaid" : paidMinor >= totalMinor ? "paid" : "partially_paid";
const totalPaid = (payments: readonly SupplierPurchasePayment[]) =>
  payments.reduce((sum, payment) => sum + payment.amountMinor, 0);
/* المجموعة ٢: المدفوع الفعلي = مجموع الدفعات مطروحًا منه التراجعات الموثقة —
 * علاقة التدقيق تبقى، ولا تُحذف الدفعة الأصلية أبدًا. */
const totalReversed = (reversals: readonly SupplierPurchasePaymentReversal[] | undefined) =>
  (reversals ?? []).reduce((sum, reversal) => sum + reversal.amountMinor, 0);
/* R10-B4/F-021: معلنًا لمعاينات القراءة الشقيقة — القراءة النقية نفسها. */
export const effectivePaid = (purchase: SupplierPurchase): number =>
  totalPaid(purchase.payments) - totalReversed(purchase.paymentReversals);
const recompute = (purchase: SupplierPurchase, paidMinor: number, recordedAt: string): SupplierPurchase =>
  Object.freeze({
    ...purchase,
    paidMinor,
    payableMinor: purchase.totalMinor - paidMinor,
    status: statusFor(purchase.totalMinor, paidMinor),
    updatedAt: recordedAt,
  });
/* S05 (DOC-014 / UNIT-037 A1/AC02/AC04 + U037-F02): تعريف الجهة عند الاستحقاق
 * القائم — المدفوع الفعلي بعد العملية هو الحاكم (عند الإنشاء: الدفع الأولي
 * وحده؛ عند التعديل: المدفوع بعد التعديل كاملًا). القاعدة مسطحة بلا
 * استثناء رجعي: كل استحقاق قائم في تاريخ هذا النظام يحمل تعريفًا (السجلات
 * القديمة كلها مسماة)، فلا يوجد قديم بلا تعريف يُظلم بالقيد. */
const SUPPLIER_DEFINITION_REQUIRED_MESSAGE =
  "اكتب اسمًا أو وصفًا يعرّف جهة المبلغ المستحق، أو اختر موردًا محفوظًا — الاستحقاق بلا تعريف يضيع من المتابعة.";

const assertSupplierIdentityForPayable = (input: {
  supplierName: string | null;
  supplierPartyId?: string | null | undefined;
  paidMinor: number;
  totalMinor: number;
}) => {
  const hasSupplierIdentity = Boolean(input.supplierName?.trim() || input.supplierPartyId?.trim());
  if (input.paidMinor < input.totalMinor && !hasSupplierIdentity)
    throw new Error(SUPPLIER_DEFINITION_REQUIRED_MESSAGE);
  /* S05 (العقد المشترك §5.1 — PartyRef): الرابط المحفوظ يحمل لقطة تسميته
   * معه دائمًا — رابط بلا لقطة شكل مكسور يُرفض داخل المجال. */
  if (input.supplierPartyId?.trim() && !input.supplierName?.trim())
    throw new Error("ربط المورد المحفوظ يحمل لقطة اسمه معه — أعد اختيار المورد قبل الحفظ.");
};

/* S05 (DOC-014 / UNIT-037 AC02): توحيد هوية المورد على السجل — الفراغ يُقرأ
 * «بلا مورد مسجل» بصدق، والربط المحفوظ الصريح يُثبّت كما اختير. */
const supplierIdentityOf = (input: {
  supplierName?: string | null | undefined;
  supplierPartyId?: string | null | undefined;
}): { supplierName: string | null; supplierPartyId: string | null } => ({
  supplierName: input.supplierName?.trim() || null,
  supplierPartyId: input.supplierPartyId?.trim() || null,
});

/* الدفعة الأولية عند التسجيل — حرة تُبنى مرة واحدة للإنشاء وحده. */
const initialPaymentsFor = (input: {
  id: string;
  initialPaidMinor: number;
  purchasedOn: string;
  recordedAt: string;
  idempotencyKey: string;
  initialPaymentWalletId?: string | null;
}): readonly SupplierPurchasePayment[] =>
  input.initialPaidMinor > 0
    ? [
        Object.freeze({
          id: `${input.id}:initial`,
          amountMinor: input.initialPaidMinor,
          occurredOn: input.purchasedOn,
          recordedAt: input.recordedAt,
          idempotencyKey: `${input.idempotencyKey}:initial`,
          note: "دفعة عند تسجيل الشراء",
          /* FIN-003: مصدر الدفعة الأولية إن عُيّن — حركة التغطية تكتبها
           * خدمة التطبيق بعد حفظ الشراء نفسه. */
          walletId: input.initialPaymentWalletId?.trim() || null,
        }),
      ]
    : [];

const assertPurchaseFields = (input: {
  supplierName: string | null;
  supplierPartyId?: string | null;
  note: string;
  totalMinor: number;
  initialPaidMinor: number;
  purchasedOn: string;
  dueOn?: string | null;
  recordedAt: string;
}) => {
  assertText(input.note, "note");
  assertPositive(input.totalMinor, "totalMinor");
  assertNonNegative(input.initialPaidMinor, "initialPaidMinor");
  if (!validDate(input.purchasedOn)) throw new Error("أدخل تاريخ الشراء تاريخًا محليًا صحيحًا.");
  if (input.dueOn && !validDate(input.dueOn)) throw new Error("أدخل تاريخ الاستحقاق تاريخًا محليًا صحيحًا.");
  /* R2 (M-02/X1): فحص الطابع من النواة — سلوك متكافل، مالك واحد. */
  if (!isValidTimestamp(input.recordedAt)) throw new Error("أدخل وقت التسجيل وقتًا صحيحًا.");
  if (input.initialPaidMinor > input.totalMinor)
    throw new Error("المدفوع مبدئيًا لا يمكن أن يتجاوز إجمالي الشراء.");
};
/* المجموعة ٢ (§10.4): المدفوع بعد التعديل = الدفع الأولي الجديد + الدفعات اللاحقة
 * − تراجعاتها الموثقة. معيّن صريح؛ الشروط في استدعائه لا في صياغته. */
/* R10-B4/F-021: صار معلنًا — تستهلكه وحدة معاينات القراءة الشقيقة
 * (previewDerivations.ts)؛ المعادلة نفسها بلا أي تغيير. */
export const paidAfterEditFor = (purchase: SupplierPurchase, input: { initialPaidMinor: number }): number => {
  const laterPayments = purchase.payments.filter(payment => payment.id !== `${purchase.id}:initial`);
  const laterPaidMinor = laterPayments.reduce((sum, payment) => sum + payment.amountMinor, 0);
  const reversedLaterMinor = totalReversed(purchase.paymentReversals);
  return input.initialPaidMinor + laterPaidMinor - reversedLaterMinor;
};
/* المدفوع بعد التعديل محصور بالإجمالي الجديد وبالصفر — حارس واحد مستقل. */
const assertPaidAfterEdit = (paidAfterEdit: number, totalMinor: number) => {
  if (paidAfterEdit > totalMinor)
    throw new Error("الإجمالي الجديد أقل من الدفعات المسجلة عليه؛ راجع الدفعات أو التراجعات قبل التعديل.");
  if (paidAfterEdit < 0) throw new Error("التعديل يجعل المدفوع سالبًا؛ راجع التراجعات المسجلة أولًا.");
};

/* المجموعة ٢ (عقد ٢٨): ربط المادة والكمية المتوقعة — نفس تحقق الإنشاء والتعديل. */
const assertMaterialLink = (input: { materialId?: string | null; expectedQuantityMilli?: number | null }) => {
  if (input.materialId !== undefined && input.materialId !== null && !input.materialId.trim())
    throw new Error("اربط المادة بمعرّف موجود أو اتركه فارغًا.");
  if (
    input.expectedQuantityMilli !== undefined &&
    input.expectedQuantityMilli !== null &&
    (!Number.isInteger(input.expectedQuantityMilli) || input.expectedQuantityMilli <= 0)
  )
    throw new Error("أدخل الكمية المتوقعة رقمًا صحيحًا موجبًا، أو اتركها فارغة.");
};

/* S07 (UNIT-027 D01 / العقد المشترك §5.4 PurchaseLine): بنود الشراء — هوية
 * ثابتة لكل بند، وقيمة معلومة موجبة لا تجعل مجموع البنود يتجاوز إجمالي
 * الشراء (الأجزاء لا تكرر فوق الكل)، ومجهولة القيمة null لا صفرًا معلومًا
 * (SDF-036)، وtracked_material يوجب مادة (لا تتبع بلا مادة). تطابق
 * معالجة البند مع حالة تتبع المادة الحية فحص تطبيقي عند الخدمة (المجال
 * النقي لا يملك قائمة المواد)؛ هنا شكل البند وتحدوده الذاتية. الفحوص
 * مفككة على مساعِدات بترتيب الرفض نفسه (أسبقية الرفض محفوظة حرفيًا). */
const assertPurchaseLineIdentity = (
  line: SupplierPurchaseLine,
  isDuplicateLineId: (lineId: string) => boolean,
): void => {
  if (!line.lineId?.trim()) throw new Error("لكل بند شراء هوية ثابتة غير فارغة.");
  if (isDuplicateLineId(line.lineId)) throw new Error("هوية بند الشراء مكررة داخل الشراء الواحد.");
};

const assertPurchaseLineTreatment = (line: SupplierPurchaseLine): void => {
  if (line.treatment !== "period_material" && line.treatment !== "tracked_material")
    throw new Error("معالجة بند الشراء غير صالحة.");
};

const assertPurchaseLineMaterialQuantity = (line: SupplierPurchaseLine): void => {
  if (line.materialId !== undefined && line.materialId !== null && !line.materialId.trim())
    throw new Error("اربط بند الشراء بمادة موجودة أو اتركه بلا مادة.");
  if (
    line.expectedQuantityMilli !== undefined &&
    line.expectedQuantityMilli !== null &&
    (!Number.isInteger(line.expectedQuantityMilli) || line.expectedQuantityMilli <= 0)
  )
    throw new Error("كمية بند الشراء رقم صحيح موجب بوحدة المادة، أو اتركها فارغة.");
  if (line.treatment === "tracked_material" && (line.materialId === undefined || line.materialId === null))
    throw new Error("بند المواد المتتبعة يوجب مادة مرتبطة — لا تتبع بلا مادة.");
};

/* معرفة التكلفة: المعلومة تُعاد قيمتها لمجموع البنود؛ والمجهولة مساهمتها
 * صفر بلا قيمة معلنة (null لا صفرًا موسومًا معلومًا — SDF-036). */
const assertPurchaseLineValue = (line: SupplierPurchaseLine): number => {
  if (line.costKnowledge === "known") {
    if (
      line.valueMinor === undefined ||
      line.valueMinor === null ||
      !Number.isInteger(line.valueMinor) ||
      line.valueMinor <= 0
    )
      throw new Error("قيمة بند الشراء المعلومة رقم صحيح موجب بالدينار، أو اتركها مجهولة.");
    return line.valueMinor;
  }
  if (line.costKnowledge === "unknown") {
    if (line.valueMinor !== undefined && line.valueMinor !== null)
      throw new Error("قيمة بند الشراء المجهولة تسجل بلا قيمة معلنة — لا صفرًا موسومًا معلومًا.");
    return 0;
  }
  throw new Error("معرفة تكلفة بند الشراء غير صالحة.");
};

const assertPurchaseLines = (
  lines: readonly SupplierPurchaseLine[] | null | undefined,
  totalMinor: number,
): void => {
  if (lines === undefined || lines === null || lines.length === 0) return;
  const lineIds = new Set<string>();
  let knownValueSum = 0;
  for (const line of lines) {
    assertPurchaseLineIdentity(line, lineId => lineIds.has(lineId));
    assertPurchaseLineTreatment(line);
    assertPurchaseLineMaterialQuantity(line);
    knownValueSum += assertPurchaseLineValue(line);
    lineIds.add(line.lineId);
  }
  if (knownValueSum > totalMinor)
    throw new Error("مجموع قيم البنود المعلومة يتجاوز إجمالي الشراء — الأجزاء لا تكرر فوق الكل.");
};

/* S07: تطبيع بنود الشراء — تجميد كل بند وقصّ المعرفات؛ الغياب/الفراغ = بلا
 * بنود (null) كالمسار القائم، لا مصفوفة فارغة توهم معنى. */
const normalizePurchaseLines = (
  lines: readonly SupplierPurchaseLine[] | null | undefined,
): readonly SupplierPurchaseLine[] | null => {
  if (lines === undefined || lines === null || lines.length === 0) return null;
  return Object.freeze(
    lines.map(line =>
      Object.freeze({
        ...line,
        lineId: line.lineId.trim(),
        materialId: line.materialId?.trim() || null,
        expectedQuantityMilli: line.expectedQuantityMilli ?? null,
        valueMinor: line.valueMinor ?? null,
      }),
    ),
  );
};

export function createSupplierPurchase(input: CreateSupplierPurchaseInput): SupplierPurchase {
  assertText(input.id, "id");
  assertText(input.idempotencyKey, "idempotencyKey");
  assertPurchaseFields(input);
  assertMaterialLink(input);
  assertPurchaseLines(input.lines, input.totalMinor);
  /* S05 (DOC-014 / UNIT-037): عند الإنشاء الدفع الأولي هو المدفوع كله. */
  assertSupplierIdentityForPayable({
    supplierName: input.supplierName,
    supplierPartyId: input.supplierPartyId,
    paidMinor: input.initialPaidMinor,
    totalMinor: input.totalMinor,
  });
  const payments: readonly SupplierPurchasePayment[] = initialPaymentsFor(input);
  const paidMinor = totalPaid(payments);
  return Object.freeze({
    id: input.id,
    /* S05 (DOC-014 / UNIT-037 AC02): المورد اختياري في المدفوع كاملًا — الفراغ
     * يُقرأ «بلا مورد مسجل» بصدق، والربط المحفوظ الصريح كما اختير. */
    ...supplierIdentityOf(input),
    note: input.note.trim(),
    purchasedOn: input.purchasedOn,
    dueOn: input.dueOn?.trim() || null,
    totalMinor: input.totalMinor,
    paidMinor,
    payableMinor: input.totalMinor - paidMinor,
    status: statusFor(input.totalMinor, paidMinor),
    idempotencyKey: input.idempotencyKey,
    payments,
    materialId: input.materialId?.trim() || null,
    expectedQuantityMilli: input.expectedQuantityMilli ?? null,
    lines: normalizePurchaseLines(input.lines),
    createdAt: input.recordedAt,
    updatedAt: input.recordedAt,
  });
}

export function recordSupplierPurchasePayment(
  purchase: SupplierPurchase,
  input: RecordSupplierPurchasePaymentInput,
): SupplierPurchase {
  assertText(input.id, "id");
  assertText(input.idempotencyKey, "idempotencyKey");
  assertText(input.note, "note");
  assertPositive(input.amountMinor, "amountMinor");
  if (!validDate(input.occurredOn)) throw new Error("أدخل تاريخ الحركة تاريخًا محليًا صحيحًا.");
  /* R2 (M-02/X1): فحص الطابع من النواة — سلوك متكافل، مالك واحد. */
  if (!isValidTimestamp(input.recordedAt)) throw new Error("أدخل وقت التسجيل وقتًا صحيحًا.");
  if (purchase.payments.some(payment => payment.idempotencyKey === input.idempotencyKey)) return purchase;
  /* S2-01: الحارس والمتبقي محسوبان من المدفوع الفعلي (الدفعات − التراجعات الموثقة)
   * لا من حقول مخزنة قد تعكس حالة ما قبل تراجع — لا يُبعث أثر دفعة مُتراجَع عنها. */
  const effectivePayableMinor = purchase.totalMinor - effectivePaid(purchase);
  if (input.amountMinor > effectivePayableMinor)
    throw new Error("الدفعة لا يمكن أن تتجاوز المتبقي المسجل على الشراء.");
  const payment = Object.freeze({
    id: input.id,
    amountMinor: input.amountMinor,
    occurredOn: input.occurredOn,
    recordedAt: input.recordedAt,
    idempotencyKey: input.idempotencyKey,
    note: input.note.trim(),
    /* FIN-003: محفظة مصدر الدفعة إن عُيّنت — غيابها = الكاش غير الموزع. */
    walletId: input.walletId?.trim() || null,
  });
  const payments = Object.freeze([...purchase.payments, payment]);
  /* S2-01: المدفوع بعد الدفعة الجديدة يطرح التراجعات الموثقة نفسها. */
  const paidMinor = totalPaid(payments) - totalReversed(purchase.paymentReversals);
  if (paidMinor < 0 || paidMinor > purchase.totalMinor)
    throw new Error("الدفعة تجعل المدفوع خارج الحدود؛ راجع التراجعات المسجلة أولًا.");
  return Object.freeze({
    ...purchase,
    payments,
    paidMinor,
    payableMinor: purchase.totalMinor - paidMinor,
    status: statusFor(purchase.totalMinor, paidMinor),
    updatedAt: input.recordedAt,
  });
}

/* المجموعة ٢ (عقد ٢٨): بناء مراجعة التعديل — استخراج يبقي تعقيد التعديل نفسه
 * محكومًا، ويجمع قيم «قبل التصحيح» في مكان واحد قابل للفحص. */
const buildEditRevision = (
  purchase: SupplierPurchase,
  input: UpdateSupplierPurchaseInput,
  initialPaidMinor: number,
): SupplierPurchaseRevision =>
  Object.freeze({
    kind: "edit",
    idempotencyKey: input.idempotencyKey,
    createdAt: input.recordedAt,
    reason: input.reason.trim(),
    beforeTotalMinor: purchase.totalMinor,
    beforeInitialPaidMinor: initialPaidMinor,
    beforeSupplierName: purchase.supplierName,
    beforeNote: purchase.note,
    beforePurchasedOn: purchase.purchasedOn,
    beforeDueOn: purchase.dueOn,
    beforeMaterialId: purchase.materialId ?? null,
    beforeExpectedQuantityMilli: purchase.expectedQuantityMilli ?? null,
    /* S07 (UNIT-027): البنود قبل التعديل — لقطة موثقة كقيم «قبل التصحيح». */
    beforeLines: purchase.lines ?? null,
  });

/* المجموعة ٢ (§10.4): إعادة بناء الدفعات بعد التعديل — الدفع الأولي الجديد
 * يُعاد بناؤه بمعرّفه القديم إن وُجد، والدفعات اللاحقة كما سُجّلت. */
const rebuildPayments = (
  purchase: SupplierPurchase,
  input: UpdateSupplierPurchaseInput,
): readonly SupplierPurchasePayment[] => {
  const laterPayments = purchase.payments.filter(payment => payment.id !== `${purchase.id}:initial`);
  if (input.initialPaidMinor <= 0) return laterPayments;
  const initialPayment = purchase.payments.find(payment => payment.id === `${purchase.id}:initial`);
  const rebuiltInitial = Object.freeze({
    id: `${purchase.id}:initial`,
    amountMinor: input.initialPaidMinor,
    occurredOn: input.purchasedOn,
    recordedAt: input.recordedAt,
    idempotencyKey: initialPayment?.idempotencyKey ?? `${input.idempotencyKey}:initial`,
    note: "دفعة عند تسجيل الشراء",
  });
  return [rebuiltInitial, ...laterPayments];
};

/* المجموعة ٢ (§10.4): تعديل موثق لسجل الشراء — التكلفة والدفع الأولي والبيانات
 * تصحح بمراجعة تُحفظ قيم ما قبل التصحيح؛ الدفعات اللاحقة وتراجعاتها لا تُمس،
 * والمدفوع بعد التعديل لا يتجاوز الإجمالي الجديد. لا يُحذف السجل الأصلي. */
export function updateSupplierPurchase(
  purchase: SupplierPurchase,
  input: UpdateSupplierPurchaseInput,
): SupplierPurchase {
  assertText(input.idempotencyKey, "idempotencyKey");
  assertText(input.reason, "reason");
  if (purchase.revisions?.some(revision => revision.idempotencyKey === input.idempotencyKey)) return purchase;
  assertPurchaseFields(input);
  assertMaterialLink(input);
  assertPurchaseLines(input.lines, input.totalMinor);

  const paidAfterEdit = paidAfterEditFor(purchase, input);
  assertPaidAfterEdit(paidAfterEdit, input.totalMinor);
  /* S05 (DOC-014 / UNIT-037): المدفوع بعد التعديل هو الحاكم — تعديل يجعل
   * الشراء مسددًا كاملًا يسمح بإخلاء المورد؛ واستحقاق قائم يوجب التعريف. */
  assertSupplierIdentityForPayable({
    supplierName: input.supplierName,
    supplierPartyId: input.supplierPartyId,
    paidMinor: paidAfterEdit,
    totalMinor: input.totalMinor,
  });

  const initialPayment = purchase.payments.find(payment => payment.id === `${purchase.id}:initial`);
  const revision = buildEditRevision(purchase, input, initialPayment?.amountMinor ?? 0);
  const next = recompute(
    {
      ...purchase,
      /* S05 (DOC-014 / UNIT-037): المدفوع كامله قد يُخلى المورد؛ والاستحقاق
       * القائم يوجب التعريف — والهوية الموحدة تُطبّق فوق السجل. */
      ...supplierIdentityOf(input),
      note: input.note.trim(),
      purchasedOn: input.purchasedOn,
      dueOn: input.dueOn?.trim() || null,
      totalMinor: input.totalMinor,
      payments: rebuildPayments(purchase, input),
      materialId: input.materialId?.trim() || null,
      expectedQuantityMilli: input.expectedQuantityMilli ?? null,
      /* S07 (UNIT-027): البنود بعد التعديل — استبدال معلن لا صامت. */
      lines: normalizePurchaseLines(input.lines),
      revisions: Object.freeze([...(purchase.revisions ?? []), revision]),
    },
    paidAfterEdit,
    input.recordedAt,
  );
  return next;
}

/* المجموعة ٢ (§10.4): تراجع موثق عن دفعة لاحقة — الدفعة الأصلية تبقى في السجل
 * وعلاقة التدقيق صريحة (paymentId)؛ الدفع الأولي لا يُتراجع من هنا بل يُصحح
 * بتعديل الشراء نفسه. تراجع واحد لكل دفعة — لا تكرار ولا مضاعفة أثر. */
export function reverseSupplierPurchasePayment(
  purchase: SupplierPurchase,
  input: ReverseSupplierPurchasePaymentInput,
): SupplierPurchase {
  assertText(input.id, "id");
  assertText(input.idempotencyKey, "idempotencyKey");
  assertText(input.reason, "reason");
  if (!validDate(input.occurredOn)) throw new Error("أدخل تاريخ الحركة تاريخًا محليًا صحيحًا.");
  /* R2 (M-02/X1): فحص الطابع من النواة — سلوك متكافل، مالك واحد. */
  if (!isValidTimestamp(input.recordedAt)) throw new Error("أدخل وقت التسجيل وقتًا صحيحًا.");
  const reversals = purchase.paymentReversals ?? [];
  if (reversals.some(reversal => reversal.idempotencyKey === input.idempotencyKey)) return purchase;
  const payment = purchase.payments.find(candidate => candidate.id === input.paymentId);
  if (!payment) throw new Error("لم تُعثر على الدفعة المطلوب التراجع عنها.");
  if (payment.id === `${purchase.id}:initial`)
    throw new Error("التراجع عن الدفعة الأولية يتم بتعديل الشراء نفسه، لا من هنا.");
  if (reversals.some(reversal => reversal.paymentId === payment.id))
    throw new Error("تم التراجع عن هذه الدفعة سابقًا؛ لا يُنشأ تراجع ثانٍ.");

  const reversal: SupplierPurchasePaymentReversal = Object.freeze({
    id: input.id,
    paymentId: payment.id,
    amountMinor: payment.amountMinor,
    reason: input.reason.trim(),
    occurredOn: input.occurredOn,
    recordedAt: input.recordedAt,
    idempotencyKey: input.idempotencyKey,
  });
  return recompute(
    { ...purchase, paymentReversals: Object.freeze([...reversals, reversal]) },
    effectivePaid(purchase) - payment.amountMinor,
    input.recordedAt,
  );
}
