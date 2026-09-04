import { fieldLabelAr } from "../shared/index.js";
import type {
  CreateSupplierPurchaseInput,
  RecordSupplierPurchasePaymentInput,
  ReverseSupplierPurchasePaymentInput,
  SupplierPurchase,
  SupplierPurchasePayment,
  SupplierPurchasePaymentReversal,
  SupplierPurchaseRevision,
  SupplierPurchaseStatus,
  UpdateSupplierPurchaseInput,
} from "./types.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (value: string) =>
  DATE_PATTERN.test(value) && !Number.isNaN(new Date(`${value}T12:00:00.000Z`).valueOf());
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
const effectivePaid = (purchase: SupplierPurchase): number =>
  totalPaid(purchase.payments) - totalReversed(purchase.paymentReversals);
const recompute = (purchase: SupplierPurchase, paidMinor: number, recordedAt: string): SupplierPurchase =>
  Object.freeze({
    ...purchase,
    paidMinor,
    payableMinor: purchase.totalMinor - paidMinor,
    status: statusFor(purchase.totalMinor, paidMinor),
    updatedAt: recordedAt,
  });
/* المجموعة ٢: حقول الشراء المشتركة — نفس تحقق الإنشاء والتعديل لا نسختان تتباعدان. */
const assertPurchaseFields = (input: {
  supplierName: string;
  note: string;
  totalMinor: number;
  initialPaidMinor: number;
  purchasedOn: string;
  dueOn?: string | null;
  recordedAt: string;
}) => {
  assertText(input.supplierName, "supplierName");
  assertText(input.note, "note");
  assertPositive(input.totalMinor, "totalMinor");
  assertNonNegative(input.initialPaidMinor, "initialPaidMinor");
  if (!validDate(input.purchasedOn)) throw new Error("أدخل تاريخ الشراء تاريخًا محليًا صحيحًا.");
  if (input.dueOn && !validDate(input.dueOn)) throw new Error("أدخل تاريخ الاستحقاق تاريخًا محليًا صحيحًا.");
  if (Number.isNaN(Date.parse(input.recordedAt))) throw new Error("أدخل وقت التسجيل وقتًا صحيحًا.");
  if (input.initialPaidMinor > input.totalMinor)
    throw new Error("المدفوع مبدئيًا لا يمكن أن يتجاوز إجمالي الشراء.");
};
/* المجموعة ٢ (§10.4): المدفوع بعد التعديل = الدفع الأولي الجديد + الدفعات اللاحقة
 * − تراجعاتها الموثقة. معيّن صريح؛ الشروط في استدعائه لا في صياغته. */
const paidAfterEditFor = (purchase: SupplierPurchase, input: UpdateSupplierPurchaseInput): number => {
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

export function createSupplierPurchase(input: CreateSupplierPurchaseInput): SupplierPurchase {
  assertText(input.id, "id");
  assertText(input.idempotencyKey, "idempotencyKey");
  assertPurchaseFields(input);
  assertMaterialLink(input);
  const payments: readonly SupplierPurchasePayment[] =
    input.initialPaidMinor > 0
      ? [
          Object.freeze({
            id: `${input.id}:initial`,
            amountMinor: input.initialPaidMinor,
            occurredOn: input.purchasedOn,
            recordedAt: input.recordedAt,
            idempotencyKey: `${input.idempotencyKey}:initial`,
            note: "دفعة عند تسجيل الشراء",
          }),
        ]
      : [];
  const paidMinor = totalPaid(payments);
  return Object.freeze({
    id: input.id,
    supplierName: input.supplierName.trim(),
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
  if (Number.isNaN(Date.parse(input.recordedAt))) throw new Error("أدخل وقت التسجيل وقتًا صحيحًا.");
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

  const paidAfterEdit = paidAfterEditFor(purchase, input);
  assertPaidAfterEdit(paidAfterEdit, input.totalMinor);

  const initialPayment = purchase.payments.find(payment => payment.id === `${purchase.id}:initial`);
  const revision = buildEditRevision(purchase, input, initialPayment?.amountMinor ?? 0);
  const next = recompute(
    {
      ...purchase,
      supplierName: input.supplierName.trim(),
      note: input.note.trim(),
      purchasedOn: input.purchasedOn,
      dueOn: input.dueOn?.trim() || null,
      totalMinor: input.totalMinor,
      payments: rebuildPayments(purchase, input),
      materialId: input.materialId?.trim() || null,
      expectedQuantityMilli: input.expectedQuantityMilli ?? null,
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
  if (Number.isNaN(Date.parse(input.recordedAt))) throw new Error("أدخل وقت التسجيل وقتًا صحيحًا.");
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
