import { fieldLabelAr, quantityMilliExact, roundHalfUp } from "../shared/index.js";
import type {
  OwnerEntitlementKnowledge,
  OwnerEntitlementOpeningBalance,
  OwnerEntitlementOpeningBalanceReversalInput,
  OwnerEntitlementPolicy,
  OwnerEntitlementPolicyFamily,
  OwnerEntitlementPolicyKind,
  OwnerEntitlementRecord,
  OwnerEntitlementRecordReversalInput,
  OwnerMovement,
  CreateOwnerEntitlementPolicyInput,
  CreateOwnerEntitlementPolicySuccessorInput,
  CreateOwnerMovementInput,
  CreateOwnerMovementReversalInput,
} from "./types.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const policyKinds = [
  "monthly",
  "weekly",
  "daily",
  "hourly",
  "fixed_period",
  "fixed_shift",
  "per_completed_work",
  "profit_share",
  "sale_percentage",
  "per_unit",
] as const;
const policyFamilies = [
  "time_period",
  "fixed_amount",
  "completed_work",
  "profit_share",
  "completed_sale_percentage",
  "unit",
] as const;
const movementReasons = [
  "entitlement_settlement",
  "opening_balance_settlement",
  "pre_entitlement_draw",
  "owner_draw",
  "settlement_of_prior_draw",
  "new_capital_investment",
] as const;
const familyByKind: Record<OwnerEntitlementPolicyKind, OwnerEntitlementPolicyFamily> = {
  monthly: "time_period",
  weekly: "time_period",
  daily: "time_period",
  hourly: "time_period",
  fixed_period: "fixed_amount",
  fixed_shift: "fixed_amount",
  per_completed_work: "completed_work",
  profit_share: "profit_share",
  sale_percentage: "completed_sale_percentage",
  per_unit: "unit",
};

function nonBlank(value: string, field: string) {
  if (!value.trim()) throw new Error(`أكمل ${fieldLabelAr(field)} قبل الحفظ.`);
}
function date(value: string, field: string) {
  if (!DATE_PATTERN.test(value)) throw new Error(`أدخل ${fieldLabelAr(field)} تاريخًا محليًا صحيحًا.`);
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month! - 1 || parsed.getUTCDate() !== day)
    throw new Error(`أدخل ${fieldLabelAr(field)} تاريخًا محليًا صحيحًا.`);
}
function iso(value: string, field: string) {
  if (Number.isNaN(Date.parse(value))) throw new Error(`أدخل ${fieldLabelAr(field)} وقتًا صحيحًا.`);
}
function positiveMinor(value: number | null, field: string) {
  if (value === null || !Number.isInteger(value) || value <= 0)
    throw new Error(`أدخل ${fieldLabelAr(field)} رقمًا صحيحًا موجبًا.`);
}
function optionalPositiveMinor(value: number | null, field: string) {
  if (value !== null && (!Number.isInteger(value) || value <= 0))
    throw new Error(`أدخل ${fieldLabelAr(field)} رقمًا صحيحًا موجبًا أو اتركه فارغًا.`);
}
function bps(value: number | null, field: string) {
  if (value !== null && (!Number.isInteger(value) || value < 1 || value > 10_000))
    throw new Error(`أدخل ${fieldLabelAr(field)} قيمة بين 1 و10000 أو اتركه فارغًا.`);
}
export function ownerEntitlementPolicyFamilyForKind(
  kind: OwnerEntitlementPolicyKind,
): OwnerEntitlementPolicyFamily {
  if (!(policyKinds as readonly string[]).includes(kind)) throw new Error("نوع السياسة غير صالح.");
  return familyByKind[kind];
}
function assertPolicyFamily(kind: OwnerEntitlementPolicyKind, family: OwnerEntitlementPolicyFamily) {
  if (ownerEntitlementPolicyFamilyForKind(kind) !== family) throw new Error("عائلة السياسة لا تطابق نوعها.");
}
function sourceKeys(value: readonly string[] | undefined | null, field: string) {
  const keys = value ?? [];
  if (
    !Array.isArray(keys) ||
    keys.some(key => typeof key !== "string" || !key.trim()) ||
    new Set(keys).size !== keys.length
  )
    throw new Error(`${fieldLabelAr(field)} يجب أن يحوي قيمًا فريدة غير فارغة.`);
  return keys.map(key => key.trim());
}
function localDayNumber(value: string) {
  return Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)));
}
function inclusiveDays(from: string, to: string) {
  // Both bounds are UTC-midnight instants, so the difference is an exact whole number of days.
  return (localDayNumber(to) - localDayNumber(from)) / 86_400_000 + 1;
}
function lastDayOfMonth(value: string) {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  return `${value.slice(0, 7)}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
}
function isFullCalendarMonth(from: string, to: string) {
  return from.endsWith("-01") && to === lastDayOfMonth(from);
}

/* تحقق عائلة المبلغ/النسبة معيّن مستقل — نفس الرسائل بلا تضخيم الدالة الأم. */
function assertPolicyAmountShape(input: CreateOwnerEntitlementPolicyInput) {
  const amountKinds: readonly OwnerEntitlementPolicyKind[] = [
    "monthly",
    "weekly",
    "daily",
    "hourly",
    "fixed_period",
    "fixed_shift",
    "per_completed_work",
    "per_unit",
  ];
  const percentageKinds: readonly OwnerEntitlementPolicyKind[] = ["profit_share", "sale_percentage"];
  if (amountKinds.includes(input.kind) && input.amountMinor === null)
    throw new Error("هذه السياسة تتطلب مبلغًا صحيحًا موجبًا.");
  if (percentageKinds.includes(input.kind) && input.percentageBps === null)
    throw new Error("هذه السياسة تتطلب نسبة صريحة.");
  if (amountKinds.includes(input.kind) && input.percentageBps !== null)
    throw new Error("سياسة المبلغ لا تعلن نسبة.");
  if (percentageKinds.includes(input.kind) && input.amountMinor !== null)
    throw new Error("سياسة النسبة لا تعلن مبلغًا.");
}

export function createOwnerEntitlementPolicy(
  input: CreateOwnerEntitlementPolicyInput,
): OwnerEntitlementPolicy {
  nonBlank(input.id, "id");
  nonBlank(input.source, "source");
  nonBlank(input.note, "note");
  nonBlank(input.idempotencyKey, "idempotencyKey");
  if (!Number.isInteger(input.version) || input.version < 1)
    throw new Error("أدخل رقم النسخة رقمًا صحيحًا موجبًا.");
  if (!(policyKinds as readonly string[]).includes(input.kind)) throw new Error("نوع السياسة غير صالح.");
  if (!(policyFamilies as readonly string[]).includes(input.family))
    throw new Error("عائلة السياسة غير صالحة.");
  assertPolicyFamily(input.kind, input.family);
  date(input.startsOn, "startsOn");
  if (input.endsOn !== null) date(input.endsOn, "endsOn");
  if (input.endsOn && input.endsOn < input.startsOn)
    throw new Error("تاريخ النهاية لا يمكن أن يسبق تاريخ البداية.");
  if (input.kind === "fixed_period" && input.endsOn === null)
    throw new Error("سياسة الفترة الثابتة تتطلب تاريخ نهاية صريحًا.");
  if (input.status === "ended" && input.endsOn === null)
    throw new Error("السياسة المنتهية تتطلب تاريخ نهاية.");
  if (input.status !== "active" && input.status !== "ended") throw new Error("حالة السياسة غير صالحة.");
  optionalPositiveMinor(input.amountMinor, "amountMinor");
  bps(input.percentageBps, "percentageBps");
  assertPolicyAmountShape(input);
  if (input.kind === "per_unit" || input.kind === "per_completed_work")
    nonBlank(input.unitLabel ?? "", "unitLabel");
  if (input.kind !== "per_unit" && input.kind !== "per_completed_work" && input.unitLabel !== null)
    throw new Error("تسمية الوحدة تخص سياسات الوحدة أو العمل المكتمل فقط.");
  iso(input.createdAt, "createdAt");
  const seriesId = input.seriesId?.trim() || input.id;
  const successorOfPolicyId = input.successorOfPolicyId?.trim() || null;
  if (successorOfPolicyId === input.id) throw new Error("السياسة لا تكون نسخة جديدة لنفسها.");
  return Object.freeze({
    ...input,
    seriesId,
    successorOfPolicyId,
    amountMinor: input.amountMinor ?? null,
    percentageBps: input.percentageBps ?? null,
    unitLabel: input.unitLabel?.trim() || null,
    source: input.source.trim(),
    note: input.note.trim(),
  });
}

export function createOwnerEntitlementPolicySuccessor(
  input: CreateOwnerEntitlementPolicySuccessorInput,
): OwnerEntitlementPolicy {
  const successor = createOwnerEntitlementPolicy({
    ...input,
    family: ownerEntitlementPolicyFamilyForKind(input.kind),
  });
  if (!successor.successorOfPolicyId) throw new Error("النسخة الجديدة تتطلب سياسة أصل صريحة.");
  return successor;
}

export function createOwnerEntitlementRecord(input: OwnerEntitlementRecord): OwnerEntitlementRecord {
  nonBlank(input.id, "id");
  nonBlank(input.policyId, "policyId");
  nonBlank(input.note, "note");
  nonBlank(input.idempotencyKey, "idempotencyKey");
  if (!Number.isInteger(input.policyVersion) || input.policyVersion < 1)
    throw new Error("أدخل رقم نسخة السياسة رقمًا صحيحًا موجبًا.");
  date(input.periodFrom, "periodFrom");
  date(input.periodTo, "periodTo");
  date(input.occurredOn, "occurredOn");
  if (input.periodFrom > input.periodTo) throw new Error("نهاية الفترة لا يمكن أن تسبق بدايتها.");
  positiveMinor(input.amountMinor, "amountMinor");
  if (!(input.knowledge === "known" || input.knowledge === "estimated" || input.knowledge === "partial"))
    throw new Error("درجة المعرفة غير صالحة.");
  if (!(policyFamilies as readonly string[]).includes(input.calculationBasis))
    throw new Error("أساس الحساب غير صالح.");
  if (input.baseMinor !== null && (!Number.isInteger(input.baseMinor) || input.baseMinor < 0))
    throw new Error("أدخل المبلغ الأساس رقمًا صحيحًا غير سالب أو اتركه فارغًا.");
  if (input.quantity !== null && (!Number.isFinite(input.quantity) || input.quantity <= 0))
    throw new Error("أدخل الكمية رقمًا موجبًا أو اتركها فارغة.");
  const keys = sourceKeys(input.sourceKeys, "sourceKeys");
  const reversalOfId = input.reversalOfId?.trim() || null;
  if (reversalOfId === input.id) throw new Error("السجل لا يتراجع عن نفسه.");
  if (reversalOfId === null && input.reversalReason !== null && input.reversalReason !== undefined)
    throw new Error("السجل الأصلي لا يحمل سبب تراجع.");
  if (reversalOfId !== null) nonBlank(input.reversalReason ?? "", "reversalReason");
  iso(input.recordedAt, "recordedAt");
  return Object.freeze({
    ...input,
    sourceKeys: keys,
    reversalOfId,
    reversalReason: input.reversalReason?.trim() || null,
    note: input.note.trim(),
  });
}

export function createOwnerEntitlementRecordReversal(
  input: OwnerEntitlementRecordReversalInput,
): OwnerEntitlementRecord {
  nonBlank(input.id, "id");
  nonBlank(input.reason, "reason");
  nonBlank(input.idempotencyKey, "idempotencyKey");
  date(input.occurredOn, "occurredOn");
  iso(input.recordedAt, "recordedAt");
  if (input.source.reversalOfId) throw new Error("لا يمكن التراجع عن سجل تراجع سابق.");
  return Object.freeze({
    ...input.source,
    id: input.id,
    occurredOn: input.occurredOn,
    recordedAt: input.recordedAt,
    idempotencyKey: input.idempotencyKey,
    note: `تراجع: ${input.source.note}`,
    reversalOfId: input.source.id,
    reversalReason: input.reason.trim(),
  });
}

export function createOwnerEntitlementOpeningBalance(
  input: OwnerEntitlementOpeningBalance,
): OwnerEntitlementOpeningBalance {
  nonBlank(input.id, "id");
  nonBlank(input.reason, "reason");
  nonBlank(input.note, "note");
  nonBlank(input.idempotencyKey, "idempotencyKey");
  if (!Number.isInteger(input.amountMinor) || input.amountMinor === 0)
    throw new Error("أدخل رصيد الافتتاح رقمًا صحيحًا غير صفري.");
  date(input.occurredOn, "occurredOn");
  iso(input.recordedAt, "recordedAt");
  const reversalOfId = input.reversalOfId?.trim() || null;
  if (reversalOfId === input.id) throw new Error("رصيد الافتتاح لا يتراجع عن نفسه.");
  if (reversalOfId === null && input.reversalReason !== null && input.reversalReason !== undefined)
    throw new Error("رصيد الافتتاح الأصلي لا يحمل سبب تراجع.");
  if (reversalOfId !== null) nonBlank(input.reversalReason ?? "", "reversalReason");
  return Object.freeze({
    ...input,
    reversalOfId,
    reversalReason: input.reversalReason?.trim() || null,
    reason: input.reason.trim(),
    note: input.note.trim(),
  });
}

export function createOwnerEntitlementOpeningBalanceReversal(
  input: OwnerEntitlementOpeningBalanceReversalInput,
): OwnerEntitlementOpeningBalance {
  nonBlank(input.id, "id");
  nonBlank(input.reason, "reason");
  nonBlank(input.idempotencyKey, "idempotencyKey");
  date(input.occurredOn, "occurredOn");
  iso(input.recordedAt, "recordedAt");
  if (input.source.reversalOfId) throw new Error("لا يمكن التراجع عن سجل تراجع سابق.");
  return Object.freeze({
    ...input.source,
    id: input.id,
    occurredOn: input.occurredOn,
    recordedAt: input.recordedAt,
    idempotencyKey: input.idempotencyKey,
    note: `تراجع: ${input.source.note}`,
    reversalOfId: input.source.id,
    reversalReason: input.reason.trim(),
  });
}

/* و٩: سبب الحركة يجب أن يناسب نوعها — سحب أو إرجاع. */
function assertMovementReasonMatchesKind(
  kind: CreateOwnerMovementInput["kind"],
  reason: CreateOwnerMovementInput["reason"],
): void {
  if (kind === "draw" && (reason === "settlement_of_prior_draw" || reason === "new_capital_investment"))
    throw new Error("سبب السحب غير صالح.");
  if (
    kind === "return" &&
    (reason === "entitlement_settlement" || reason === "pre_entitlement_draw" || reason === "owner_draw")
  )
    throw new Error("سبب الإرجاع غير صالح.");
}

/* و٩: كل ربط مرتبط بسبب واحد صريح — لا ربط بلا سببه ولا سبب بلا ربطه. */
function assertMovementRelations(
  reason: CreateOwnerMovementInput["reason"],
  relations: {
    relatedEntitlementId: string | null;
    relatedOpeningBalanceId: string | null;
    relatedMovementId: string | null;
  },
): void {
  assertPairedRelation(
    reason === "entitlement_settlement",
    relations.relatedEntitlementId,
    "تسوية الحق تتطلب حقًا مسجلًا مرتبطًا.",
    "الربط بحق مسجل يخص تسوية الحقوق فقط.",
  );
  assertPairedRelation(
    reason === "opening_balance_settlement",
    relations.relatedOpeningBalanceId,
    "تسوية رصيد الافتتاح تتطلب رصيدًا مرتبطًا صريحًا.",
    "الربط برصيد افتتاح يخص تسوياته فقط.",
  );
  assertPairedRelation(
    reason === "settlement_of_prior_draw",
    relations.relatedMovementId,
    "تسوية السحب تتطلب حركة مرتبطة صريحة.",
    "الربط بحركة سحب يخص تسوياتها فقط.",
  );
}

/* و٩: علاقة سبب-ربط مقترنة: الربط موجود إذا وفقط إذا كان السبب يستدعيه. */
function assertPairedRelation(
  reasonMatches: boolean,
  relationId: string | null,
  missingMessage: string,
  unrelatedMessage: string,
): void {
  if (reasonMatches && !relationId) throw new Error(missingMessage);
  if (!reasonMatches && relationId) throw new Error(unrelatedMessage);
}

/* و٩: آثار الحركة على الحق بحسب سببها. */
function movementEntitlementDeltaMinor(
  reason: CreateOwnerMovementInput["reason"],
  amountMinor: number,
): number {
  if (reason === "entitlement_settlement" || reason === "pre_entitlement_draw") return -amountMinor;
  if (reason === "settlement_of_prior_draw") return amountMinor;
  return 0;
}

/* و٩: آثار الحركة على رصيد الافتتاح بحسب سببها ونوعها. */
function movementOpeningBalanceDeltaMinor(
  reason: CreateOwnerMovementInput["reason"],
  kind: CreateOwnerMovementInput["kind"],
  amountMinor: number,
): number {
  if (reason !== "opening_balance_settlement") return 0;
  return kind === "draw" ? -amountMinor : amountMinor;
}

/* و٩: آثار الحركة على رأس مال المالك بحسب سببها. */
function movementOwnerCapitalDeltaMinor(
  reason: CreateOwnerMovementInput["reason"],
  amountMinor: number,
): number {
  if (reason === "owner_draw") return -amountMinor;
  if (reason === "new_capital_investment") return amountMinor;
  return 0;
}

/* و٩: تحقق الحقول الأولية لحركة المالك. */
function assertMovementPrimitives(input: CreateOwnerMovementInput): void {
  nonBlank(input.id, "id");
  nonBlank(input.walletId, "walletId");
  nonBlank(input.note, "note");
  nonBlank(input.idempotencyKey, "idempotencyKey");
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0)
    throw new Error("أدخل المبلغ رقمًا صحيحًا موجبًا.");
  date(input.occurredOn, "occurredOn");
  iso(input.recordedAt, "recordedAt");
  if (input.kind !== "draw" && input.kind !== "return") throw new Error("نوع حركة المالك غير صالح.");
  if (!(movementReasons as readonly string[]).includes(input.reason)) throw new Error("سبب الحركة غير صالح.");
}

export function createOwnerMovement(input: CreateOwnerMovementInput): OwnerMovement {
  assertMovementPrimitives(input);
  assertMovementReasonMatchesKind(input.kind, input.reason);
  const relatedEntitlementId = input.relatedEntitlementId?.trim() || null;
  const relatedOpeningBalanceId = input.relatedOpeningBalanceId?.trim() || null;
  const relatedMovementId = input.relatedMovementId?.trim() || null;
  assertMovementRelations(input.reason, {
    relatedEntitlementId,
    relatedOpeningBalanceId,
    relatedMovementId,
  });
  const entitlementDeltaMinor = movementEntitlementDeltaMinor(input.reason, input.amountMinor);
  const openingBalanceDeltaMinor = movementOpeningBalanceDeltaMinor(
    input.reason,
    input.kind,
    input.amountMinor,
  );
  const ownerCapitalDeltaMinor = movementOwnerCapitalDeltaMinor(input.reason, input.amountMinor);
  return Object.freeze({
    id: input.id,
    kind: input.kind,
    amountMinor: input.amountMinor,
    walletId: input.walletId,
    occurredOn: input.occurredOn,
    recordedAt: input.recordedAt,
    reason: input.reason,
    note: input.note.trim(),
    idempotencyKey: input.idempotencyKey,
    relatedEntitlementId,
    relatedOpeningBalanceId,
    relatedMovementId,
    reversalOfId: null,
    reversalReason: null,
    cashDeltaMinor: input.kind === "draw" ? -input.amountMinor : input.amountMinor,
    entitlementDeltaMinor,
    openingBalanceDeltaMinor,
    ownerCapitalDeltaMinor,
  });
}

export function createOwnerMovementReversal(input: CreateOwnerMovementReversalInput): OwnerMovement {
  nonBlank(input.id, "id");
  nonBlank(input.reason, "reason");
  nonBlank(input.idempotencyKey, "idempotencyKey");
  date(input.occurredOn, "occurredOn");
  iso(input.recordedAt, "recordedAt");
  if (input.source.reversalOfId) throw new Error("لا يمكن التراجع عن سجل تراجع سابق.");
  return Object.freeze({
    ...input.source,
    id: input.id,
    occurredOn: input.occurredOn,
    recordedAt: input.recordedAt,
    idempotencyKey: input.idempotencyKey,
    note: `تراجع: ${input.source.note}`,
    reversalOfId: input.source.id,
    reversalReason: input.reason.trim(),
    cashDeltaMinor: -input.source.cashDeltaMinor,
    entitlementDeltaMinor: -input.source.entitlementDeltaMinor,
    openingBalanceDeltaMinor: -input.source.openingBalanceDeltaMinor,
    ownerCapitalDeltaMinor: -input.source.ownerCapitalDeltaMinor,
  });
}

export type OwnerEntitlementEvidence = {
  periodFrom: string;
  periodTo: string;
  completedWorkCount?: number | null;
  completedWorkKeys?: readonly string[] | null;
  completedSaleMinor?: number | null;
  completedSaleKeys?: readonly string[] | null;
  recognizedProfitMinor?: number | null;
  recognizedProfitStatus?: "recorded_only" | "incomplete" | "invalid";
  recognizedProfitKeys?: readonly string[] | null;
  timeQuantity?: number | null;
  timeSourceKeys?: readonly string[] | null;
  unitQuantity?: number | null;
  unitSourceKeys?: readonly string[] | null;
};
export type OwnerEntitlementCalculation = {
  amountMinor: number | null;
  knowledge: OwnerEntitlementKnowledge;
  baseMinor: number | null;
  quantity: number | null;
  calculationBasis: OwnerEntitlementPolicyFamily;
  sourceKeys: readonly string[];
  nextAction: string;
};

export function isPolicyEffective(policy: OwnerEntitlementPolicy, from: string, to: string): boolean {
  return (
    policy.status === "active" && policy.startsOn <= from && (policy.endsOn === null || policy.endsOn >= to)
  );
}
/* و٩: الحق بالساعة — دقائق موثقة بمراجعها وتقريب نصف-أعلى. */
function hourlyEntitlement(
  policy: OwnerEntitlementPolicy,
  evidence: OwnerEntitlementEvidence,
  amount: number,
): OwnerEntitlementCalculation {
  const minutes = evidence.timeQuantity ?? null;
  const keys = evidence.timeSourceKeys ?? [];
  if (minutes === null || !Number.isInteger(minutes) || minutes <= 0 || keys.length === 0)
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: null,
      quantity: null,
      calculationBasis: "time_period",
      sourceKeys: [],
      nextAction:
        "سجل مدة العمل بالدقائق مع مراجع سجل الوقت قبل اعتماد الحق " +
        "بالساعة؛ لا يتحول الوقت المجهول إلى صفر.",
    };
  const timeAmountMinor = roundHalfUp(amount * minutes, 60);
  if (timeAmountMinor === null)
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: minutes,
      quantity: minutes,
      calculationBasis: "time_period",
      sourceKeys: keys,
      nextAction: "المدة أو أجر الساعة يتجاوز الدقة الآمنة؛ راجع الإدخال قبل اعتماد الحق.",
    };
  return {
    amountMinor: timeAmountMinor,
    knowledge: "known",
    baseMinor: minutes,
    quantity: minutes,
    calculationBasis: "time_period",
    sourceKeys: keys,
    nextAction: "راجع مصدر الدقائق قبل الاعتماد.",
  };
}

/* و٩: الحق لكل عمل مكتمل — عدد موثق بمراجع فريدة. */
function completedWorkEntitlement(
  policy: OwnerEntitlementPolicy,
  evidence: OwnerEntitlementEvidence,
  amount: number,
): OwnerEntitlementCalculation {
  const quantity = evidence.completedWorkCount ?? null;
  if (quantity === null || !Number.isInteger(quantity) || quantity <= 0)
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: null,
      quantity: null,
      calculationBasis: "completed_work",
      sourceKeys: [],
      nextAction: "أكمل عدد الطلبات أو الخدمات المكتملة والمحتسب إيرادها عند التسليم.",
    };
  const keys = evidence.completedWorkKeys ?? [];
  if (keys.length !== quantity || new Set(keys).size !== keys.length)
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: null,
      quantity: null,
      calculationBasis: "completed_work",
      sourceKeys: [],
      nextAction: "احفظ مراجع الأعمال المكتملة حتى لا يعاد احتساب الطلب نفسه.",
    };
  return {
    amountMinor: amount * quantity,
    knowledge: "known",
    baseMinor: amount,
    quantity,
    calculationBasis: "completed_work",
    sourceKeys: keys,
    nextAction: "راجع أن كل عمل محسوب نهائي ومكتمل، لا مسودة أو عربون.",
  };
}

/* و٩: الحق لكل وحدة — كمية بأجزاء من ألف ومراجعها. */
function unitEntitlement(
  policy: OwnerEntitlementPolicy,
  evidence: OwnerEntitlementEvidence,
  amount: number,
): OwnerEntitlementCalculation {
  const quantity = evidence.unitQuantity ?? null;
  if (quantity === null || !Number.isFinite(quantity) || quantity <= 0)
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: null,
      quantity: null,
      calculationBasis: "unit",
      sourceKeys: [],
      nextAction: "سجل كمية الوحدات المكتملة ووحدتها قبل الاعتماد؛ لا تخترع عددًا.",
    };
  const keys = evidence.unitSourceKeys ?? [];
  if (keys.length === 0)
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: null,
      quantity: null,
      calculationBasis: "unit",
      sourceKeys: [],
      nextAction: "احفظ مراجع الوحدات أو العمل المكتمل حتى لا يعاد احتساب المصدر نفسه.",
    };
  const quantityMilli = quantityMilliExact(quantity);
  if (quantityMilli === null)
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: amount,
      quantity,
      calculationBasis: "unit",
      sourceKeys: keys,
      nextAction: "سجل كمية الوحدات بدقة أجزاء من ألف؛ الدقة الأعلى غير ممثلة في هذا الإصدار.",
    };
  const unitAmountMinor = roundHalfUp(quantityMilli * amount, 1000);
  if (unitAmountMinor === null)
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: amount,
      quantity,
      calculationBasis: "unit",
      sourceKeys: keys,
      nextAction: "كمية الوحدات أو سعر الوحدة يتجاوز الدقة الآمنة؛ راجع الإدخال قبل اعتماد الحق.",
    };
  return {
    amountMinor: unitAmountMinor,
    knowledge: "known",
    baseMinor: amount,
    quantity,
    calculationBasis: "unit",
    sourceKeys: keys,
    nextAction: "راجع أن الوحدة والكمية صالحتان وموجودتان في السجل.",
  };
}

/* و٩: حق نسبة الربح — من قراءة G3 المسجلة الكاملة فقط. */
function profitShareEntitlement(
  policy: OwnerEntitlementPolicy,
  evidence: OwnerEntitlementEvidence,
): OwnerEntitlementCalculation {
  const base = evidence.recognizedProfitMinor ?? null;
  if (base === null || evidence.recognizedProfitStatus === "invalid")
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: base,
      quantity: null,
      calculationBasis: "profit_share",
      sourceKeys: [],
      nextAction: "أغلق الفترة وتحقق من قراءة G3 المسجلة الصحيحة؛ لا تحسب النسبة من الكاش أو المبيعات الخام.",
    };
  if (evidence.recognizedProfitStatus !== "recorded_only")
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: base,
      quantity: null,
      calculationBasis: "profit_share",
      sourceKeys: [],
      nextAction: "راجع أسباب نقص نتيجة G3 قبل تسجيل نسبة الحق؛ لا تعرض دقة كاذبة.",
    };
  const share = roundHalfUp(base * (policy.percentageBps ?? 0), 10_000);
  if (share === null)
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: base,
      quantity: null,
      calculationBasis: "profit_share",
      sourceKeys: evidence.recognizedProfitKeys ?? [],
      nextAction: "أساس الربح أو النسبة يتجاوز الدقة الآمنة؛ راجع القراءة قبل اعتماد الحق.",
    };
  if (share <= 0)
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: base,
      quantity: null,
      calculationBasis: "profit_share",
      sourceKeys: evidence.recognizedProfitKeys ?? [],
      nextAction: "راجع النسبة أو أساس الربح؛ لا يسجل حق صفري من نسبة موجبة.",
    };
  return {
    amountMinor: share,
    knowledge: "known",
    baseMinor: base,
    quantity: null,
    calculationBasis: "profit_share",
    sourceKeys: evidence.recognizedProfitKeys ?? [`g3:${evidence.periodFrom}:${evidence.periodTo}`],
    nextAction: "راجع فترة G3 ومصدرها قبل الاعتماد.",
  };
}

/* و٩: حق نسبة البيع المكتمل — من البيع المحتسب إيراده عند التسليم فقط. */
function salePercentageEntitlement(
  policy: OwnerEntitlementPolicy,
  evidence: OwnerEntitlementEvidence,
): OwnerEntitlementCalculation {
  const base = evidence.completedSaleMinor ?? null;
  if (base === null || !Number.isInteger(base) || base <= 0)
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: base,
      quantity: null,
      calculationBasis: "completed_sale_percentage",
      sourceKeys: [],
      nextAction:
        "أكمل قيمة البيع المكتمل والمحتسب إيراده عند التسليم؛ لا تحسب من العربون أو الدين غير المحتسب عند التسليم.",
    };
  const keys = evidence.completedSaleKeys ?? [];
  if (keys.length === 0)
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: base,
      quantity: null,
      calculationBasis: "completed_sale_percentage",
      sourceKeys: [],
      nextAction: "احفظ مراجع البيوع المكتملة حتى لا يعاد احتساب البيع نفسه.",
    };
  const share = roundHalfUp(base * (policy.percentageBps ?? 0), 10_000);
  if (share === null)
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: base,
      quantity: null,
      calculationBasis: "completed_sale_percentage",
      sourceKeys: [],
      nextAction: "أساس البيع أو النسبة يتجاوز الدقة الآمنة؛ راجع القراءة قبل اعتماد الحق.",
    };
  if (share <= 0)
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: base,
      quantity: null,
      calculationBasis: "completed_sale_percentage",
      sourceKeys: keys,
      nextAction: "راجع قيمة البيع أو النسبة؛ لا يسجل حق صفري من نسبة موجبة.",
    };
  return {
    amountMinor: share,
    knowledge: "known",
    baseMinor: base,
    quantity: null,
    calculationBasis: "completed_sale_percentage",
    sourceKeys: keys,
    nextAction: "راجع أن البيع مكتمل ومحتسب إيراده عند التسليم، لا عربونًا أو دينًا.",
  };
}

/* و٩: حوارس شكل الفترة بحسب نوع السياسة — شهر كامل أو سبعة أيام أو يوم واحد أو النطاق المعلن. */
function entitlementPeriodGuard(
  policy: OwnerEntitlementPolicy,
  evidence: OwnerEntitlementEvidence,
): OwnerEntitlementCalculation | null {
  if (policy.kind === "fixed_shift")
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: null,
      quantity: null,
      calculationBasis: "fixed_amount",
      sourceKeys: [],
      nextAction:
        "لا يوجد في النموذج الحالي سجل ورديات موثق؛ استخدم مبلغًا للفترة " +
        "أو أكمل دليل الوردية قبل اعتماد الحق.",
    };
  if (policy.kind === "monthly" && !isFullCalendarMonth(evidence.periodFrom, evidence.periodTo))
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: null,
      quantity: null,
      calculationBasis: "time_period",
      sourceKeys: [],
      nextAction:
        "السياسة الشهرية تحتاج شهرًا تقويميًا كاملًا؛ لا يسجل النظام مبلغ الشهر عن فترة قصيرة أو جزئية.",
    };
  if (policy.kind === "weekly" && inclusiveDays(evidence.periodFrom, evidence.periodTo) !== 7)
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: null,
      quantity: null,
      calculationBasis: "time_period",
      sourceKeys: [],
      nextAction:
        "السياسة الأسبوعية تحتاج سبعة أيام متصلة كاملة؛ اختر فترة أسبوع واضحة ولا يسجل النظام أسبوعًا جزئيًا.",
    };
  if (policy.kind === "daily" && evidence.periodFrom !== evidence.periodTo)
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: null,
      quantity: null,
      calculationBasis: "time_period",
      sourceKeys: [],
      nextAction: "السياسة اليومية تحتاج يومًا محليًا واحدًا فقط.",
    };
  if (policy.kind === "fixed_period") return fixedPeriodRangeGuard(policy, evidence);
  return null;
}

/* و٩: المبلغ الثابت يُحسب على نطاقه المعلن كاملًا فقط. */
function fixedPeriodRangeGuard(
  policy: OwnerEntitlementPolicy,
  evidence: OwnerEntitlementEvidence,
): OwnerEntitlementCalculation | null {
  const rangeMatches =
    policy.endsOn !== null && evidence.periodFrom === policy.startsOn && evidence.periodTo === policy.endsOn;
  if (rangeMatches) return null;
  return {
    amountMinor: null,
    knowledge: "incomplete",
    baseMinor: null,
    quantity: null,
    calculationBasis: "fixed_amount",
    sourceKeys: [],
    nextAction:
      "المبلغ الثابت يحتاج النطاق المعلن كاملًا في السياسة؛ لا تسجل فترة متداخلة أو أقصر بلا نسخة سياسة جديدة.",
  };
}

export function calculateOwnerEntitlement(
  policy: OwnerEntitlementPolicy,
  evidence: OwnerEntitlementEvidence,
): OwnerEntitlementCalculation {
  date(evidence.periodFrom, "periodFrom");
  date(evidence.periodTo, "periodTo");
  if (evidence.periodFrom > evidence.periodTo) throw new Error("نهاية الفترة لا يمكن أن تسبق بدايتها.");
  if (!isPolicyEffective(policy, evidence.periodFrom, evidence.periodTo))
    return {
      amountMinor: null,
      knowledge: "incomplete",
      baseMinor: null,
      quantity: null,
      calculationBasis: policy.family,
      sourceKeys: [],
      nextAction: "اجعل الفترة بعد تاريخ بدء السياسة وقبل إيقافها، أو أنشئ نسخة سياسة جديدة من تاريخ صحيح.",
    };
  const amount = policy.amountMinor ?? 0;
  const periodGuard = entitlementPeriodGuard(policy, evidence);
  if (periodGuard) return periodGuard;
  if (policy.kind === "hourly") return hourlyEntitlement(policy, evidence, amount);
  if (policy.kind === "per_completed_work") return completedWorkEntitlement(policy, evidence, amount);
  if (policy.kind === "per_unit") return unitEntitlement(policy, evidence, amount);
  if (policy.kind === "profit_share") return profitShareEntitlement(policy, evidence);
  if (policy.kind === "sale_percentage") return salePercentageEntitlement(policy, evidence);
  return {
    amountMinor: amount,
    knowledge: "known",
    baseMinor: null,
    quantity: null,
    calculationBasis: policy.family === "fixed_amount" ? "fixed_amount" : "time_period",
    sourceKeys: [],
    nextAction: "راجع الفترة والسياسة المصدر قبل الاعتماد.",
  };
}

export function isValidOwnerEntitlementPolicy(value: unknown): value is OwnerEntitlementPolicy {
  try {
    if (!value || typeof value !== "object") return false;
    createOwnerEntitlementPolicy(value as CreateOwnerEntitlementPolicyInput);
    return true;
  } catch {
    return false;
  }
}
export function isValidOwnerEntitlementRecord(value: unknown): value is OwnerEntitlementRecord {
  try {
    if (!value || typeof value !== "object") return false;
    createOwnerEntitlementRecord(value as OwnerEntitlementRecord);
    return true;
  } catch {
    return false;
  }
}
export function isValidOwnerEntitlementOpeningBalance(
  value: unknown,
): value is OwnerEntitlementOpeningBalance {
  try {
    if (!value || typeof value !== "object") return false;
    createOwnerEntitlementOpeningBalance(value as OwnerEntitlementOpeningBalance);
    return true;
  } catch {
    return false;
  }
}
export function isValidOwnerMovement(value: unknown): value is OwnerMovement {
  try {
    if (!value || typeof value !== "object") return false;
    const candidate = value as OwnerMovement;
    if (
      candidate.reversalOfId !== null &&
      (typeof candidate.reversalOfId !== "string" ||
        candidate.reversalOfId.trim().length === 0 ||
        candidate.reversalOfId === candidate.id)
    )
      return false;
    const expected = createOwnerMovement({
      id: candidate.id,
      kind: candidate.kind,
      amountMinor: candidate.amountMinor,
      walletId: candidate.walletId,
      occurredOn: candidate.occurredOn,
      recordedAt: candidate.recordedAt,
      reason: candidate.reason,
      note: candidate.note,
      idempotencyKey: candidate.idempotencyKey,
      relatedEntitlementId: candidate.relatedEntitlementId,
      relatedOpeningBalanceId: candidate.relatedOpeningBalanceId,
      relatedMovementId: candidate.relatedMovementId,
    });
    if (candidate.reversalOfId === null)
      return (
        candidate.reversalReason === null &&
        candidate.cashDeltaMinor === expected.cashDeltaMinor &&
        candidate.entitlementDeltaMinor === expected.entitlementDeltaMinor &&
        candidate.openingBalanceDeltaMinor === expected.openingBalanceDeltaMinor &&
        candidate.ownerCapitalDeltaMinor === expected.ownerCapitalDeltaMinor
      );
    if (!candidate.reversalReason || candidate.reversalReason.trim().length === 0) return false;
    return (
      candidate.cashDeltaMinor === -expected.cashDeltaMinor &&
      candidate.entitlementDeltaMinor === -expected.entitlementDeltaMinor &&
      candidate.openingBalanceDeltaMinor === -expected.openingBalanceDeltaMinor &&
      candidate.ownerCapitalDeltaMinor === -expected.ownerCapitalDeltaMinor
    );
  } catch {
    return false;
  }
}
