import type {
  CreateFinancialEventInput,
  CreateFinancialReversalInput,
  FinancialEvent,
  FinancialEventTotals,
  OperatingExpenseContext,
  SharedProjectShare,
} from "./types.js";
import { JOD, fieldLabelAr, roundHalfUp } from "../shared/index.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
function assertNonBlank(value: string, field: string) {
  if (!value.trim()) throw new Error(`أكمل ${fieldLabelAr(field)} قبل الحفظ.`);
}
function assertPositiveMinor(value: number, field = "amountMinor") {
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(`أدخل ${fieldLabelAr(field)} رقمًا صحيحًا موجبًا.`);
}
function assertDate(value: string, field: string) {
  if (!DATE_PATTERN.test(value)) throw new Error(`أدخل ${fieldLabelAr(field)} تاريخًا محليًا صحيحًا.`);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day)
    throw new Error(`أدخل ${fieldLabelAr(field)} تاريخًا محليًا صحيحًا.`);
}

/** Round a positive percentage share to JOD minor units using half-up integer arithmetic. */
export function calculateSharedProjectShareMinor(totalAmountMinor: number, percentageBps: number): number {
  assertPositiveMinor(totalAmountMinor, "totalAmountMinor");
  if (!Number.isInteger(percentageBps) || percentageBps < 1 || percentageBps > 10_000)
    throw new Error("أدخل النسبة قيمة بين 1 و10000.");
  const rounded = roundHalfUp(totalAmountMinor * percentageBps, 10_000);
  if (rounded === null) throw new Error("حصة المشروع تتجاوز الدقة الآمنة للأرقام الصحيحة.");
  return rounded;
}

function assertOptionalMinor(value: number | null | undefined, field: string) {
  if (value !== null && value !== undefined && (!Number.isInteger(value) || value < 0))
    throw new Error(`أدخل ${fieldLabelAr(field)} رقمًا صحيحًا غير سالب أو اتركه فارغًا.`);
}
function expectedKnowledge(basis: SharedProjectShare["basis"]): OperatingExpenseContext["knowledge"] {
  return basis === "agreed_fixed_share" || basis === "agreed_percentage"
    ? "known"
    : basis === "owner_estimate"
      ? "estimated"
      : "needs_review";
}
/* و٩: التحقق من الشكل العام للحصة — الأساس والملاحظة والمعرفة والتوزيع. */
function assertShareShape(
  value: SharedProjectShare,
  knowledge: OperatingExpenseContext["knowledge"],
): "allocated" | "unallocated" {
  if (!(
    "agreed_fixed_share" === value.basis ||
    "agreed_percentage" === value.basis ||
    "owner_estimate" === value.basis ||
    "needs_review" === value.basis
  ))
    throw new Error("أساس حصة المصروف المشترك غير صالح.");
  if (value.note !== null && typeof value.note !== "string")
    throw new Error("ملاحظة حصة المصروف المشترك غير صالحة.");
  if (knowledge !== expectedKnowledge(value.basis))
    throw new Error("حصة المصروف المشترك لا تطابق درجة المعرفة المعلنة.");
  const allocation = value.allocation ?? "allocated";
  if (allocation !== "allocated" && allocation !== "unallocated")
    throw new Error("توزيع حصة المصروف المشترك غير صالح.");
  return allocation;
}

/* و٩: المصروف غير الموزع — إجمالي موجب معلن ولا نسبة ولا حصة محسوبة. */
function assertUnallocatedShare(
  basis: SharedProjectShare["basis"],
  totalAmountMinor: number | null,
  percentageBps: number | null,
  calculatedShareMinor: number | null,
): void {
  if (
    basis !== "needs_review" ||
    totalAmountMinor === null ||
    totalAmountMinor <= 0 ||
    percentageBps !== null ||
    calculatedShareMinor !== null
  )
    throw new Error("المصروف المشترك غير الموزع يتطلب إجماليًا موجبًا بلا حصة محسوبة.");
}

/* و٩: الحصة الموزعة — قيود النسبة والحصة المحسوبة وأساسها المتفق. */
function assertAllocatedShare(
  basis: SharedProjectShare["basis"],
  totalAmountMinor: number | null,
  percentageBps: number | null,
  calculatedShareMinor: number | null,
): void {
  if (basis === "needs_review" && totalAmountMinor !== null)
    throw new Error("الحصة الموزعة التي تحتاج مراجعة لا تعلن إجماليًا دون حصة محسوبة.");
  if (
    percentageBps !== null &&
    (!Number.isInteger(percentageBps) || percentageBps < 1 || percentageBps > 10_000)
  )
    throw new Error("أدخل النسبة قيمة بين 1 و10000.");
  if (percentageBps === null && calculatedShareMinor !== null)
    throw new Error("الحصة المحسوبة تتطلب نسبة صريحة.");
  if (
    percentageBps !== null &&
    (totalAmountMinor === null ||
      calculatedShareMinor === null ||
      calculatedShareMinor !== calculateSharedProjectShareMinor(totalAmountMinor, percentageBps))
  )
    throw new Error("مدخلات النسبة المشتركة لا تطابق الحصة المحسوبة.");
  if (
    basis === "agreed_percentage" &&
    (totalAmountMinor === null || percentageBps === null || calculatedShareMinor === null)
  )
    throw new Error("النسبة المتفق عليها تتطلب الإجمالي والنسبة والحصة المحسوبة معًا.");
}

function normalizeSharedProjectShare(
  value: SharedProjectShare,
  knowledge: OperatingExpenseContext["knowledge"],
): SharedProjectShare {
  const allocation = assertShareShape(value, knowledge);
  const totalAmountMinor = value.totalAmountMinor ?? null;
  const percentageBps = value.percentageBps ?? null;
  const calculatedShareMinor = value.calculatedShareMinor ?? null;
  assertOptionalMinor(totalAmountMinor, "totalAmountMinor");
  assertOptionalMinor(calculatedShareMinor, "calculatedShareMinor");
  if (allocation === "unallocated")
    assertUnallocatedShare(value.basis, totalAmountMinor, percentageBps, calculatedShareMinor);
  else assertAllocatedShare(value.basis, totalAmountMinor, percentageBps, calculatedShareMinor);
  return Object.freeze({
    basis: value.basis,
    note: value.note?.trim() || null,
    allocation,
    totalAmountMinor,
    percentageBps,
    calculatedShareMinor,
  });
}
function normalizeExpenseContext(
  value: OperatingExpenseContext | null | undefined,
): OperatingExpenseContext | null {
  if (!value) return null;
  if (!(value.relationship === "project" || value.relationship === "shared"))
    throw new Error("علاقة المصروف بالمشروع غير صالحة.");
  if (!(
    value.behavior === "fixed" ||
    value.behavior === "variable" ||
    value.behavior === "mixed" ||
    value.behavior === "unknown"
  ))
    throw new Error("سلوك المصروف غير صالح.");
  if (!(
    value.purpose === "project_general" ||
    value.purpose === "period" ||
    value.purpose === "order" ||
    value.purpose === "product" ||
    value.purpose === "campaign" ||
    value.purpose === "unallocated"
  ))
    throw new Error("غرض المصروف غير صالح.");
  if (!(value.knowledge === "known" || value.knowledge === "estimated" || value.knowledge === "needs_review"))
    throw new Error("درجة معرفة المصروف غير صالحة.");
  const share = value.sharedProjectShare;
  if (value.relationship !== "shared" && share)
    throw new Error("حصة المشروع المشتركة تخص المصروفات المشتركة فقط.");
  if (!share)
    return Object.freeze({
      relationship: value.relationship,
      behavior: value.behavior,
      purpose: value.purpose,
      knowledge: value.knowledge,
      sharedProjectShare: null,
    });
  return Object.freeze({
    relationship: value.relationship,
    behavior: value.behavior,
    purpose: value.purpose,
    knowledge: value.knowledge,
    sharedProjectShare: normalizeSharedProjectShare(share, value.knowledge),
  });
}
function isUnallocatedSharedExpense(context: OperatingExpenseContext | null): boolean {
  return context?.relationship === "shared" && context.sharedProjectShare?.allocation === "unallocated";
}
/* خريطة الأثر الخماسي [كاش، ذمم، رأس مالك، مصروف، أمانات] لكل نوع حدث. */
const DELTA_TABLE: Readonly<Record<CreateFinancialEventInput["type"], readonly number[]>> = {
  owner_investment_cash: [1, 0, 1, 0, 0],
  owner_withdrawal_cash: [-1, 0, -1, 0, 0],
  operating_expense_cash: [-1, 0, 0, 1, 0],
  operating_expense_payable: [0, 1, 0, 1, 0],
  payable_settlement_cash: [-1, -1, 0, 0, 0],
  /* المبدأ ١٣: أمانة قُبضت — الكاش يرتفع والرصيد الأمين يرتفع؛ لا إيراد ولا مصروف. */
  amanah_held_cash: [1, 0, 0, 0, 1],
  /* أمانة سُلّمت — الكاش ينخفض والرصيد الأمين ينخفض؛ لا أثر على الربح. */
  amanah_released_cash: [-1, 0, 0, 0, -1],
  /* هالك بلا خروج نقد: يخفض الربح ولا يمس الكاش ولا الذمم. */
  loss_non_cash: [0, 0, 0, 1, 0],
};

function deltas(
  type: CreateFinancialEventInput["type"],
  amountMinor: number,
  expenseContext: OperatingExpenseContext | null,
) {
  const [cash = 0, payable = 0, ownerCapital = 0, operatingExpense = 0, amanah = 0] = DELTA_TABLE[type] ?? [];
  /* المصروف المشترك غير الموزّع لا يدخل نتيجة الفترة حتى تُحدَّد حصة معلنة. */
  const operatingExpenseMinor = isUnallocatedSharedExpense(expenseContext) ? 0 : operatingExpense * amountMinor;
  return {
    cashDeltaMinor: cash * amountMinor,
    payableDeltaMinor: payable * amountMinor,
    ownerCapitalDeltaMinor: ownerCapital * amountMinor,
    operatingExpenseDeltaMinor: operatingExpenseMinor,
    amanahDeltaMinor: amanah * amountMinor,
  };
}

export function createFinancialEvent(input: CreateFinancialEventInput): FinancialEvent {
  assertNonBlank(input.id, "id");
  assertPositiveMinor(input.amountMinor);
  assertNonBlank(input.idempotencyKey, "idempotencyKey");
  assertNonBlank(input.note, "note");
  assertDate(input.occurredOn, "occurredOn");
  if (Number.isNaN(Date.parse(input.recordedAt))) throw new Error("أدخل وقت التسجيل وقتًا صحيحًا.");
  const relatedEventId = input.relatedEventId?.trim() || null;
  if (input.type === "payable_settlement_cash" && !relatedEventId)
    throw new Error("تسديد الالتزام يتطلب التزامًا مرتبطًا.");
  if (input.type !== "payable_settlement_cash" && relatedEventId)
    throw new Error("الربط بحدث قائم يخص تسديد الالتزامات فقط.");
  const counterparty = input.counterparty?.trim() || null;
  const expenseContext = normalizeExpenseContext(input.expenseContext);
  if (expenseContext && input.type !== "operating_expense_cash" && input.type !== "operating_expense_payable")
    throw new Error("سياق المصروف يخص المصروفات التشغيلية فقط.");
  /* الأمانات والخسارة غير النقدية أحداث مستقلة: لا ربط بالتزامات ولا سياق مصروف. */
  if (
    (input.type === "amanah_held_cash" ||
      input.type === "amanah_released_cash" ||
      input.type === "loss_non_cash") &&
    expenseContext
  )
    throw new Error("الأمانات والخسارة غير النقدية لا تحمل سياق مصروف.");
  const share = expenseContext?.sharedProjectShare;
  if (
    share?.allocation === "allocated" &&
    share.calculatedShareMinor !== null &&
    input.amountMinor !== share.calculatedShareMinor
  )
    throw new Error("المبلغ يجب أن يساوي حصة المشروع المحسوبة.");
  if (share?.allocation === "unallocated" && input.amountMinor !== share.totalAmountMinor)
    throw new Error("المبلغ يجب أن يساوي إجمالي المصروف المشترك غير الموزع.");
  return Object.freeze({
    id: input.id,
    type: input.type,
    currency: JOD,
    amountMinor: input.amountMinor,
    occurredOn: input.occurredOn,
    recordedAt: input.recordedAt,
    idempotencyKey: input.idempotencyKey,
    note: input.note.trim(),
    counterparty,
    relatedEventId,
    expenseContext,
    correctionType: null,
    correctionOfEventId: null,
    correctionReason: null,
    ...deltas(input.type, input.amountMinor, expenseContext),
  });
}

export function createFinancialReversal(input: CreateFinancialReversalInput): FinancialEvent {
  assertNonBlank(input.id, "id");
  assertNonBlank(input.idempotencyKey, "idempotencyKey");
  assertNonBlank(input.reason, "reason");
  assertDate(input.occurredOn, "occurredOn");
  if (Number.isNaN(Date.parse(input.recordedAt))) throw new Error("أدخل وقت التسجيل وقتًا صحيحًا.");
  if (input.sourceEvent.correctionType === "reverse" || input.sourceEvent.correctionOfEventId)
    throw new Error("لا يمكن التراجع عن سجل تراجع سابق.");
  return Object.freeze({
    id: input.id,
    type: input.sourceEvent.type,
    currency: JOD,
    amountMinor: input.sourceEvent.amountMinor,
    occurredOn: input.occurredOn,
    recordedAt: input.recordedAt,
    idempotencyKey: input.idempotencyKey,
    note: `تراجع: ${input.sourceEvent.note}`,
    counterparty: input.sourceEvent.counterparty,
    relatedEventId: input.sourceEvent.relatedEventId,
    expenseContext: input.sourceEvent.expenseContext ?? null,
    correctionType: "reverse",
    correctionOfEventId: input.sourceEvent.id,
    correctionReason: input.reason.trim(),
    cashDeltaMinor: -input.sourceEvent.cashDeltaMinor,
    payableDeltaMinor: -input.sourceEvent.payableDeltaMinor,
    ownerCapitalDeltaMinor: -input.sourceEvent.ownerCapitalDeltaMinor,
    operatingExpenseDeltaMinor: -input.sourceEvent.operatingExpenseDeltaMinor,
    amanahDeltaMinor: -(input.sourceEvent.amanahDeltaMinor ?? 0),
  });
}

/** Ids of events whose economic effect a live reversal cancels. A reversal is itself never reversible, so no recursion is needed. */
export function reversedEventIds(events: readonly FinancialEvent[]): ReadonlySet<string> {
  return new Set(
    events.flatMap(event =>
      event.correctionType === "reverse" && event.correctionOfEventId ? [event.correctionOfEventId] : [],
    ),
  );
}

/** Settlements still counting against a payable: neither reversal records nor the settlements they cancelled. */
export function activeSettlementsMinor(events: readonly FinancialEvent[], payableId: string): number {
  const reversedIds = reversedEventIds(events);
  return events
    .filter(
      event =>
        event.type === "payable_settlement_cash" &&
        event.relatedEventId === payableId &&
        event.correctionType !== "reverse" &&
        !reversedIds.has(event.id),
    )
    .reduce((sum, event) => sum + event.amountMinor, 0);
}

export function summarizeFinancialEvents(events: readonly FinancialEvent[]): FinancialEventTotals {
  return events.reduce<FinancialEventTotals>(
    (totals, event) => ({
      cashMinor: totals.cashMinor + event.cashDeltaMinor,
      payableMinor: totals.payableMinor + event.payableDeltaMinor,
      ownerCapitalMinor: totals.ownerCapitalMinor + event.ownerCapitalDeltaMinor,
      operatingExpenseMinor: totals.operatingExpenseMinor + event.operatingExpenseDeltaMinor,
      amanahMinor: totals.amanahMinor + (event.amanahDeltaMinor ?? 0),
      eventCount: totals.eventCount + 1,
    }),
    {
      cashMinor: 0,
      payableMinor: 0,
      ownerCapitalMinor: 0,
      operatingExpenseMinor: 0,
      amanahMinor: 0,
      eventCount: 0,
    },
  );
}
