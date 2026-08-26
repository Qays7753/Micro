import type { OwnerEntitlementKnowledge, OwnerEntitlementOpeningBalance, OwnerEntitlementPolicy, OwnerEntitlementPolicyFamily, OwnerEntitlementPolicyKind, OwnerEntitlementRecord, OwnerMovement, CreateOwnerEntitlementPolicyInput, CreateOwnerMovementInput, CreateOwnerMovementReversalInput } from "./types.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const policyKinds = ["monthly", "weekly", "daily", "hourly", "fixed_period", "fixed_shift", "per_completed_work", "profit_share", "sale_percentage", "per_unit"] as const;
const policyFamilies = ["time_period", "fixed_amount", "completed_work", "profit_share", "completed_sale_percentage", "unit"] as const;
const movementReasons = ["entitlement_settlement", "pre_entitlement_draw", "owner_draw", "settlement_of_prior_draw", "new_capital_investment"] as const;

function nonBlank(value: string, field: string) { if (!value.trim()) throw new Error(`${field} is required`); }
function date(value: string, field: string) { if (!DATE_PATTERN.test(value)) throw new Error(`${field} must be a valid local date`); const [year, month, day] = value.split("-").map(Number); const parsed = new Date(Date.UTC(year!, month! - 1, day)); if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month! - 1 || parsed.getUTCDate() !== day) throw new Error(`${field} must be a valid local date`); }
function iso(value: string, field: string) { if (Number.isNaN(Date.parse(value))) throw new Error(`${field} must be ISO-8601`); }
function positiveMinor(value: number | null, field: string) { if (value === null || !Number.isInteger(value) || value <= 0) throw new Error(`${field} must be a positive integer or null`); }
function optionalPositiveMinor(value: number | null, field: string) { if (value !== null && (!Number.isInteger(value) || value <= 0)) throw new Error(`${field} must be a positive integer or null`); }
function bps(value: number | null, field: string) { if (value !== null && (!Number.isInteger(value) || value < 1 || value > 10_000)) throw new Error(`${field} must be between 1 and 10000 or null`); }
function assertPolicyFamily(kind: OwnerEntitlementPolicyKind, family: OwnerEntitlementPolicyFamily) {
  const expected: Record<OwnerEntitlementPolicyKind, OwnerEntitlementPolicyFamily> = { monthly: "time_period", weekly: "time_period", daily: "time_period", hourly: "time_period", fixed_period: "fixed_amount", fixed_shift: "fixed_amount", per_completed_work: "completed_work", profit_share: "profit_share", sale_percentage: "completed_sale_percentage", per_unit: "unit" };
  if (expected[kind] !== family) throw new Error("policy family does not match kind");
}

export function createOwnerEntitlementPolicy(input: CreateOwnerEntitlementPolicyInput): OwnerEntitlementPolicy {
  nonBlank(input.id, "id"); nonBlank(input.source, "source"); nonBlank(input.note, "note"); nonBlank(input.idempotencyKey, "idempotencyKey");
  if (!Number.isInteger(input.version) || input.version < 1) throw new Error("version must be a positive integer");
  if (!(policyKinds as readonly string[]).includes(input.kind)) throw new Error("policy kind is invalid");
  if (!(policyFamilies as readonly string[]).includes(input.family)) throw new Error("policy family is invalid");
  assertPolicyFamily(input.kind, input.family); date(input.startsOn, "startsOn"); if (input.endsOn !== null) date(input.endsOn, "endsOn"); if (input.endsOn && input.endsOn < input.startsOn) throw new Error("endsOn cannot precede startsOn");
  if (input.status === "ended" && input.endsOn === null) throw new Error("ended policy requires endsOn");
  if (input.status !== "active" && input.status !== "ended") throw new Error("policy status is invalid");
  optionalPositiveMinor(input.amountMinor, "amountMinor"); bps(input.percentageBps, "percentageBps");
  const amountKinds: readonly OwnerEntitlementPolicyKind[] = ["monthly", "weekly", "daily", "hourly", "fixed_period", "fixed_shift", "per_completed_work", "per_unit"];
  const percentageKinds: readonly OwnerEntitlementPolicyKind[] = ["profit_share", "sale_percentage"];
  if (amountKinds.includes(input.kind) && input.amountMinor === null) throw new Error("this policy requires a positive amountMinor");
  if (percentageKinds.includes(input.kind) && input.percentageBps === null) throw new Error("this policy requires percentageBps");
  if (amountKinds.includes(input.kind) && input.percentageBps !== null) throw new Error("amount policy cannot declare percentageBps");
  if (percentageKinds.includes(input.kind) && input.amountMinor !== null) throw new Error("percentage policy cannot declare amountMinor");
  if (input.kind === "per_unit" || input.kind === "per_completed_work") nonBlank(input.unitLabel ?? "", "unitLabel");
  if (input.kind !== "per_unit" && input.kind !== "per_completed_work" && input.unitLabel !== null) throw new Error("unitLabel is only valid for unit or completed work policies");
  iso(input.createdAt, "createdAt");
  return Object.freeze({ ...input, amountMinor: input.amountMinor ?? null, percentageBps: input.percentageBps ?? null, unitLabel: input.unitLabel?.trim() || null, source: input.source.trim(), note: input.note.trim() });
}

export function createOwnerEntitlementRecord(input: OwnerEntitlementRecord): OwnerEntitlementRecord {
  nonBlank(input.id, "id"); nonBlank(input.policyId, "policyId"); nonBlank(input.note, "note"); nonBlank(input.idempotencyKey, "idempotencyKey");
  if (!Number.isInteger(input.policyVersion) || input.policyVersion < 1) throw new Error("policyVersion must be a positive integer");
  date(input.periodFrom, "periodFrom"); date(input.periodTo, "periodTo"); date(input.occurredOn, "occurredOn"); if (input.periodFrom > input.periodTo) throw new Error("periodTo cannot precede periodFrom");
  positiveMinor(input.amountMinor, "amountMinor"); if (!(input.knowledge === "known" || input.knowledge === "estimated" || input.knowledge === "partial")) throw new Error("knowledge is invalid");
  if (!(policyFamilies as readonly string[]).includes(input.calculationBasis)) throw new Error("calculationBasis is invalid");
  if (input.baseMinor !== null && (!Number.isInteger(input.baseMinor) || input.baseMinor < 0)) throw new Error("baseMinor must be a non-negative integer or null");
  if (input.quantity !== null && (!Number.isFinite(input.quantity) || input.quantity <= 0)) throw new Error("quantity must be positive or null");
  iso(input.recordedAt, "recordedAt");
  return Object.freeze({ ...input, note: input.note.trim() });
}

export function createOwnerEntitlementOpeningBalance(input: OwnerEntitlementOpeningBalance): OwnerEntitlementOpeningBalance {
  nonBlank(input.id, "id"); nonBlank(input.reason, "reason"); nonBlank(input.note, "note"); nonBlank(input.idempotencyKey, "idempotencyKey");
  if (!Number.isInteger(input.amountMinor)) throw new Error("opening balance must be an integer");
  date(input.occurredOn, "occurredOn"); iso(input.recordedAt, "recordedAt");
  return Object.freeze({ ...input, reason: input.reason.trim(), note: input.note.trim() });
}

export function createOwnerMovement(input: CreateOwnerMovementInput): OwnerMovement {
  nonBlank(input.id, "id"); nonBlank(input.walletId, "walletId"); nonBlank(input.note, "note"); nonBlank(input.idempotencyKey, "idempotencyKey");
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error("amountMinor must be a positive integer");
  date(input.occurredOn, "occurredOn"); iso(input.recordedAt, "recordedAt");
  if (input.kind !== "draw" && input.kind !== "return") throw new Error("movement kind is invalid");
  if (!(movementReasons as readonly string[]).includes(input.reason)) throw new Error("movement reason is invalid");
  if (input.kind === "draw" && (input.reason === "settlement_of_prior_draw" || input.reason === "new_capital_investment")) throw new Error("draw reason is invalid");
  if (input.kind === "return" && (input.reason === "entitlement_settlement" || input.reason === "pre_entitlement_draw" || input.reason === "owner_draw")) throw new Error("return reason is invalid");
  const relatedEntitlementId = input.relatedEntitlementId?.trim() || null; const relatedMovementId = input.relatedMovementId?.trim() || null;
  if (input.reason === "entitlement_settlement" && !relatedEntitlementId) throw new Error("entitlement settlement requires relatedEntitlementId");
  if (input.reason !== "entitlement_settlement" && relatedEntitlementId) throw new Error("only entitlement settlement may reference relatedEntitlementId");
  if (input.reason === "settlement_of_prior_draw" && !relatedMovementId) throw new Error("draw settlement requires relatedMovementId");
  if (input.reason !== "settlement_of_prior_draw" && relatedMovementId) throw new Error("only draw settlement may reference relatedMovementId");
  const entitlementDeltaMinor = input.reason === "entitlement_settlement" ? -input.amountMinor : input.reason === "pre_entitlement_draw" ? -input.amountMinor : input.reason === "settlement_of_prior_draw" ? input.amountMinor : 0;
  const ownerCapitalDeltaMinor = input.reason === "owner_draw" ? -input.amountMinor : input.reason === "new_capital_investment" ? input.amountMinor : 0;
  return Object.freeze({ id: input.id, kind: input.kind, amountMinor: input.amountMinor, walletId: input.walletId, occurredOn: input.occurredOn, recordedAt: input.recordedAt, reason: input.reason, note: input.note.trim(), idempotencyKey: input.idempotencyKey, relatedEntitlementId, relatedMovementId, reversalOfId: null, reversalReason: null, cashDeltaMinor: input.kind === "draw" ? -input.amountMinor : input.amountMinor, entitlementDeltaMinor, ownerCapitalDeltaMinor });
}

export function createOwnerMovementReversal(input: CreateOwnerMovementReversalInput): OwnerMovement {
  nonBlank(input.id, "id"); nonBlank(input.reason, "reason"); nonBlank(input.idempotencyKey, "idempotencyKey"); date(input.occurredOn, "occurredOn"); iso(input.recordedAt, "recordedAt");
  if (input.source.reversalOfId) throw new Error("cannot reverse a reversal");
  return Object.freeze({ ...input.source, id: input.id, occurredOn: input.occurredOn, recordedAt: input.recordedAt, idempotencyKey: input.idempotencyKey, note: `عكس: ${input.source.note}`, reversalOfId: input.source.id, reversalReason: input.reason.trim(), cashDeltaMinor: -input.source.cashDeltaMinor, entitlementDeltaMinor: -input.source.entitlementDeltaMinor, ownerCapitalDeltaMinor: -input.source.ownerCapitalDeltaMinor });
}

export type OwnerEntitlementEvidence = {
  periodFrom: string;
  periodTo: string;
  completedWorkCount?: number | null;
  completedSaleMinor?: number | null;
  recognizedProfitMinor?: number | null;
  recognizedProfitStatus?: "recorded_only" | "incomplete" | "invalid";
  timeQuantity?: number | null;
  unitQuantity?: number | null;
};
export type OwnerEntitlementCalculation = { amountMinor: number | null; knowledge: OwnerEntitlementKnowledge; baseMinor: number | null; quantity: number | null; calculationBasis: OwnerEntitlementPolicyFamily; nextAction: string };

export function isPolicyEffective(policy: OwnerEntitlementPolicy, from: string, to: string): boolean { return policy.status === "active" && policy.startsOn <= to && (policy.endsOn === null || policy.endsOn >= from); }
export function calculateOwnerEntitlement(policy: OwnerEntitlementPolicy, evidence: OwnerEntitlementEvidence): OwnerEntitlementCalculation {
  date(evidence.periodFrom, "periodFrom"); date(evidence.periodTo, "periodTo"); if (evidence.periodFrom > evidence.periodTo) throw new Error("periodTo cannot precede periodFrom");
  if (!isPolicyEffective(policy, evidence.periodFrom, evidence.periodTo)) return { amountMinor: null, knowledge: "incomplete", baseMinor: null, quantity: null, calculationBasis: policy.family, nextAction: "اجعل الفترة بعد تاريخ بدء السياسة وقبل إيقافها، أو أنشئ نسخة سياسة جديدة من تاريخ صحيح." };
  const amount = policy.amountMinor ?? 0;
  if (policy.kind === "fixed_shift") return { amountMinor: null, knowledge: "incomplete", baseMinor: null, quantity: null, calculationBasis: "fixed_amount", nextAction: "لا يوجد في النموذج الحالي سجل ورديات موثق؛ استخدم مبلغًا للفترة أو أكمل دليل الوردية قبل اعتماد الاستحقاق." };
  if (policy.kind === "hourly") {
    const minutes = evidence.timeQuantity ?? null; if (minutes === null || !Number.isFinite(minutes) || minutes <= 0) return { amountMinor: null, knowledge: "incomplete", baseMinor: null, quantity: null, calculationBasis: "time_period", nextAction: "سجل مدة العمل المعروفة قبل اعتماد الاستحقاق بالساعة؛ لا يتحول الوقت المجهول إلى صفر." };
    return { amountMinor: Math.floor((amount * minutes) / 60), knowledge: "known", baseMinor: minutes, quantity: minutes, calculationBasis: "time_period", nextAction: "راجع مصدر الدقائق قبل الاعتماد." };
  }
  if (policy.kind === "per_completed_work") {
    const quantity = evidence.completedWorkCount ?? null; if (quantity === null || !Number.isInteger(quantity) || quantity <= 0) return { amountMinor: null, knowledge: "incomplete", baseMinor: null, quantity: null, calculationBasis: "completed_work", nextAction: "أكمل عدد الطلبات أو الخدمات المكتملة والمعترف بإيرادها." };
    return { amountMinor: amount * quantity, knowledge: "known", baseMinor: amount, quantity, calculationBasis: "completed_work", nextAction: "راجع أن كل عمل محسوب نهائي ومكتمل، لا مسودة أو عربون." };
  }
  if (policy.kind === "per_unit") {
    const quantity = evidence.unitQuantity ?? null; if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) return { amountMinor: null, knowledge: "incomplete", baseMinor: null, quantity: null, calculationBasis: "unit", nextAction: "سجل كمية الوحدات المكتملة ووحدتها قبل الاعتماد؛ لا تخترع عددًا." };
    return { amountMinor: Math.floor(amount * quantity), knowledge: "known", baseMinor: amount, quantity, calculationBasis: "unit", nextAction: "راجع أن الوحدة والكمية صالحتان وموجودتان في السجل." };
  }
  if (policy.kind === "profit_share") {
    const base = evidence.recognizedProfitMinor ?? null; if (base === null || evidence.recognizedProfitStatus === "invalid") return { amountMinor: null, knowledge: "incomplete", baseMinor: base, quantity: null, calculationBasis: "profit_share", nextAction: "أغلق الفترة وتحقق من قراءة G3 المسجلة الصحيحة؛ لا تحسب النسبة من الكاش أو المبيعات الخام." };
    if (evidence.recognizedProfitStatus !== "recorded_only") return { amountMinor: null, knowledge: "incomplete", baseMinor: base, quantity: null, calculationBasis: "profit_share", nextAction: "راجع أسباب نقص نتيجة G3 قبل تسجيل نسبة الاستحقاق؛ لا تعرض دقة كاذبة." };
    const share = Math.floor((base * (policy.percentageBps ?? 0) + 5_000) / 10_000); if (share <= 0) return { amountMinor: null, knowledge: "incomplete", baseMinor: base, quantity: null, calculationBasis: "profit_share", nextAction: "راجع النسبة أو أساس الربح؛ لا يسجل استحقاق صفري من نسبة موجبة." };
    return { amountMinor: share, knowledge: "known", baseMinor: base, quantity: null, calculationBasis: "profit_share", nextAction: "راجع فترة G3 ومصدرها قبل الاعتماد." };
  }
  if (policy.kind === "sale_percentage") {
    const base = evidence.completedSaleMinor ?? null; if (base === null || !Number.isInteger(base) || base <= 0) return { amountMinor: null, knowledge: "incomplete", baseMinor: base, quantity: null, calculationBasis: "completed_sale_percentage", nextAction: "أكمل قيمة البيع المكتمل والمعترف بإيراده؛ لا تحسب من العربون أو الدين غير المعترف به." };
    const share = Math.floor((base * (policy.percentageBps ?? 0) + 5_000) / 10_000); if (share <= 0) return { amountMinor: null, knowledge: "incomplete", baseMinor: base, quantity: null, calculationBasis: "completed_sale_percentage", nextAction: "راجع قيمة البيع أو النسبة؛ لا يسجل استحقاق صفري من نسبة موجبة." };
    return { amountMinor: share, knowledge: "known", baseMinor: base, quantity: null, calculationBasis: "completed_sale_percentage", nextAction: "راجع أن البيع مكتمل ومعترف بإيراده، لا عربونًا أو دينًا." };
  }
  return { amountMinor: amount, knowledge: "known", baseMinor: null, quantity: null, calculationBasis: policy.family === "fixed_amount" ? "fixed_amount" : "time_period", nextAction: "راجع الفترة والسياسة المصدر قبل الاعتماد." };
}

export function isValidOwnerEntitlementPolicy(value: unknown): value is OwnerEntitlementPolicy { try { if (!value || typeof value !== "object") return false; createOwnerEntitlementPolicy(value as CreateOwnerEntitlementPolicyInput); return true; } catch { return false; } }
export function isValidOwnerEntitlementRecord(value: unknown): value is OwnerEntitlementRecord { try { if (!value || typeof value !== "object") return false; createOwnerEntitlementRecord(value as OwnerEntitlementRecord); return true; } catch { return false; } }
export function isValidOwnerEntitlementOpeningBalance(value: unknown): value is OwnerEntitlementOpeningBalance { try { if (!value || typeof value !== "object") return false; createOwnerEntitlementOpeningBalance(value as OwnerEntitlementOpeningBalance); return true; } catch { return false; } }
export function isValidOwnerMovement(value: unknown): value is OwnerMovement { try { if (!value || typeof value !== "object") return false; const candidate = value as OwnerMovement; if (candidate.reversalOfId !== null && (typeof candidate.reversalOfId !== "string" || candidate.reversalOfId.trim().length === 0 || candidate.reversalOfId === candidate.id)) return false; const expected = createOwnerMovement({ id: candidate.id, kind: candidate.kind, amountMinor: candidate.amountMinor, walletId: candidate.walletId, occurredOn: candidate.occurredOn, recordedAt: candidate.recordedAt, reason: candidate.reason, note: candidate.note, idempotencyKey: candidate.idempotencyKey, relatedEntitlementId: candidate.relatedEntitlementId, relatedMovementId: candidate.relatedMovementId }); if (candidate.reversalOfId === null) return candidate.reversalReason === null && candidate.cashDeltaMinor === expected.cashDeltaMinor && candidate.entitlementDeltaMinor === expected.entitlementDeltaMinor && candidate.ownerCapitalDeltaMinor === expected.ownerCapitalDeltaMinor; if (!candidate.reversalReason || candidate.reversalReason.trim().length === 0) return false; return candidate.cashDeltaMinor === -expected.cashDeltaMinor && candidate.entitlementDeltaMinor === -expected.entitlementDeltaMinor && candidate.ownerCapitalDeltaMinor === -expected.ownerCapitalDeltaMinor; } catch { return false; } }
