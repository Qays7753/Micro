import type {
  CreateFinancialEventInput,
  CreateFinancialReversalInput,
  FinancialEvent,
  FinancialEventTotals,
  OperatingExpenseContext,
  SharedProjectShare,
} from "./types.js";
import { JOD, roundHalfUp } from "../shared/index.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
function assertNonBlank(value: string, field: string) {
  if (!value.trim()) throw new Error(`${field} is required`);
}
function assertPositiveMinor(value: number, field = "amountMinor") {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${field} must be a positive integer`);
}
function assertDate(value: string, field: string) {
  if (!DATE_PATTERN.test(value)) throw new Error(`${field} must be a valid local date`);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day)
    throw new Error(`${field} must be a valid local date`);
}

/** Round a positive percentage share to JOD minor units using half-up integer arithmetic. */
export function calculateSharedProjectShareMinor(totalAmountMinor: number, percentageBps: number): number {
  assertPositiveMinor(totalAmountMinor, "totalAmountMinor");
  if (!Number.isInteger(percentageBps) || percentageBps < 1 || percentageBps > 10_000)
    throw new Error("percentageBps must be between 1 and 10000");
  const rounded = roundHalfUp(totalAmountMinor * percentageBps, 10_000);
  if (rounded === null) throw new Error("shared project share exceeds safe integer range");
  return rounded;
}

function assertOptionalMinor(value: number | null | undefined, field: string) {
  if (value !== null && value !== undefined && (!Number.isInteger(value) || value < 0))
    throw new Error(`${field} must be a non-negative integer or null`);
}
function expectedKnowledge(basis: SharedProjectShare["basis"]): OperatingExpenseContext["knowledge"] {
  return basis === "agreed_fixed_share" || basis === "agreed_percentage"
    ? "known"
    : basis === "owner_estimate"
      ? "estimated"
      : "needs_review";
}
function normalizeSharedProjectShare(
  value: SharedProjectShare,
  knowledge: OperatingExpenseContext["knowledge"],
): SharedProjectShare {
  if (!(
    "agreed_fixed_share" === value.basis ||
    "agreed_percentage" === value.basis ||
    "owner_estimate" === value.basis ||
    "needs_review" === value.basis
  ))
    throw new Error("expenseContext.sharedProjectShare.basis is invalid");
  if (value.note !== null && typeof value.note !== "string")
    throw new Error("expenseContext.sharedProjectShare.note is invalid");
  if (knowledge !== expectedKnowledge(value.basis))
    throw new Error("expenseContext.sharedProjectShare does not match knowledge");
  const allocation = value.allocation ?? "allocated";
  if (allocation !== "allocated" && allocation !== "unallocated")
    throw new Error("expenseContext.sharedProjectShare.allocation is invalid");
  const totalAmountMinor = value.totalAmountMinor ?? null;
  const percentageBps = value.percentageBps ?? null;
  const calculatedShareMinor = value.calculatedShareMinor ?? null;
  assertOptionalMinor(totalAmountMinor, "totalAmountMinor");
  assertOptionalMinor(calculatedShareMinor, "calculatedShareMinor");
  if (allocation === "unallocated") {
    if (
      value.basis !== "needs_review" ||
      totalAmountMinor === null ||
      totalAmountMinor <= 0 ||
      percentageBps !== null ||
      calculatedShareMinor !== null
    )
      throw new Error("unallocated shared expenses require a positive total and no calculated share");
  } else {
    if (value.basis === "needs_review" && totalAmountMinor !== null)
      throw new Error("an allocated needs_review share cannot declare a total without a calculated share");
    if (
      percentageBps !== null &&
      (!Number.isInteger(percentageBps) || percentageBps < 1 || percentageBps > 10_000)
    )
      throw new Error("percentageBps must be between 1 and 10000");
    if (percentageBps === null && calculatedShareMinor !== null)
      throw new Error("calculatedShareMinor requires percentageBps");
    if (
      percentageBps !== null &&
      (totalAmountMinor === null ||
        calculatedShareMinor === null ||
        calculatedShareMinor !== calculateSharedProjectShareMinor(totalAmountMinor, percentageBps))
    )
      throw new Error("shared percentage inputs do not match calculatedShareMinor");
    if (
      value.basis === "agreed_percentage" &&
      (totalAmountMinor === null || percentageBps === null || calculatedShareMinor === null)
    )
      throw new Error("agreed_percentage requires totalAmountMinor, percentageBps, and calculatedShareMinor");
  }
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
    throw new Error("expenseContext.relationship is invalid");
  if (!(
    value.behavior === "fixed" ||
    value.behavior === "variable" ||
    value.behavior === "mixed" ||
    value.behavior === "unknown"
  ))
    throw new Error("expenseContext.behavior is invalid");
  if (!(
    value.purpose === "project_general" ||
    value.purpose === "period" ||
    value.purpose === "order" ||
    value.purpose === "product" ||
    value.purpose === "campaign" ||
    value.purpose === "unallocated"
  ))
    throw new Error("expenseContext.purpose is invalid");
  if (!(value.knowledge === "known" || value.knowledge === "estimated" || value.knowledge === "needs_review"))
    throw new Error("expenseContext.knowledge is invalid");
  const share = value.sharedProjectShare;
  if (value.relationship !== "shared" && share)
    throw new Error("expenseContext.sharedProjectShare is only valid for shared expenses");
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
function deltas(
  type: CreateFinancialEventInput["type"],
  amountMinor: number,
  expenseContext: OperatingExpenseContext | null,
) {
  const operatingExpenseMinor = isUnallocatedSharedExpense(expenseContext) ? 0 : amountMinor;
  switch (type) {
    case "owner_investment_cash":
      return {
        cashDeltaMinor: amountMinor,
        payableDeltaMinor: 0,
        ownerCapitalDeltaMinor: amountMinor,
        operatingExpenseDeltaMinor: 0,
      };
    case "owner_withdrawal_cash":
      return {
        cashDeltaMinor: -amountMinor,
        payableDeltaMinor: 0,
        ownerCapitalDeltaMinor: -amountMinor,
        operatingExpenseDeltaMinor: 0,
      };
    case "operating_expense_cash":
      return {
        cashDeltaMinor: -amountMinor,
        payableDeltaMinor: 0,
        ownerCapitalDeltaMinor: 0,
        operatingExpenseDeltaMinor: operatingExpenseMinor,
      };
    case "operating_expense_payable":
      return {
        cashDeltaMinor: 0,
        payableDeltaMinor: amountMinor,
        ownerCapitalDeltaMinor: 0,
        operatingExpenseDeltaMinor: operatingExpenseMinor,
      };
    case "payable_settlement_cash":
      return {
        cashDeltaMinor: -amountMinor,
        payableDeltaMinor: -amountMinor,
        ownerCapitalDeltaMinor: 0,
        operatingExpenseDeltaMinor: 0,
      };
  }
}

export function createFinancialEvent(input: CreateFinancialEventInput): FinancialEvent {
  assertNonBlank(input.id, "id");
  assertPositiveMinor(input.amountMinor);
  assertNonBlank(input.idempotencyKey, "idempotencyKey");
  assertNonBlank(input.note, "note");
  assertDate(input.occurredOn, "occurredOn");
  if (Number.isNaN(Date.parse(input.recordedAt))) throw new Error("recordedAt must be ISO-8601");
  const relatedEventId = input.relatedEventId?.trim() || null;
  if (input.type === "payable_settlement_cash" && !relatedEventId)
    throw new Error("payable settlement requires relatedEventId");
  if (input.type !== "payable_settlement_cash" && relatedEventId)
    throw new Error("only payable settlement may reference a related event");
  const counterparty = input.counterparty?.trim() || null;
  const expenseContext = normalizeExpenseContext(input.expenseContext);
  if (expenseContext && input.type !== "operating_expense_cash" && input.type !== "operating_expense_payable")
    throw new Error("expenseContext is only valid for operating expenses");
  const share = expenseContext?.sharedProjectShare;
  if (
    share?.allocation === "allocated" &&
    share.calculatedShareMinor !== null &&
    input.amountMinor !== share.calculatedShareMinor
  )
    throw new Error("amountMinor must equal the calculated shared project share");
  if (share?.allocation === "unallocated" && input.amountMinor !== share.totalAmountMinor)
    throw new Error("amountMinor must equal the unallocated shared expense total");
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
  if (Number.isNaN(Date.parse(input.recordedAt))) throw new Error("recordedAt must be ISO-8601");
  if (input.sourceEvent.correctionType === "reverse" || input.sourceEvent.correctionOfEventId)
    throw new Error("cannot reverse an existing reversal");
  return Object.freeze({
    id: input.id,
    type: input.sourceEvent.type,
    currency: JOD,
    amountMinor: input.sourceEvent.amountMinor,
    occurredOn: input.occurredOn,
    recordedAt: input.recordedAt,
    idempotencyKey: input.idempotencyKey,
    note: `عكس: ${input.sourceEvent.note}`,
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
  });
}

export function summarizeFinancialEvents(events: readonly FinancialEvent[]): FinancialEventTotals {
  return events.reduce<FinancialEventTotals>(
    (totals, event) => ({
      cashMinor: totals.cashMinor + event.cashDeltaMinor,
      payableMinor: totals.payableMinor + event.payableDeltaMinor,
      ownerCapitalMinor: totals.ownerCapitalMinor + event.ownerCapitalDeltaMinor,
      operatingExpenseMinor: totals.operatingExpenseMinor + event.operatingExpenseDeltaMinor,
      eventCount: totals.eventCount + 1,
    }),
    { cashMinor: 0, payableMinor: 0, ownerCapitalMinor: 0, operatingExpenseMinor: 0, eventCount: 0 },
  );
}
