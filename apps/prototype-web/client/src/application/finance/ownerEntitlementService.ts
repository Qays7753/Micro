import { createCashContinuityEntry, type CashContinuityEntry, type CashWallet } from "@micro-domain/cash-continuity/index.js";
import { calculateOwnerEntitlement, createOwnerEntitlementOpeningBalance, createOwnerEntitlementPolicy, createOwnerEntitlementRecord, createOwnerMovement, createOwnerMovementReversal, isPolicyEffective, type OwnerEntitlementEvidence, type OwnerEntitlementOpeningBalance, type OwnerEntitlementPolicy, type OwnerEntitlementRecord, type OwnerMovement, type OwnerMovementReason, type CreateOwnerEntitlementPolicyInput } from "@micro-domain/owner-entitlement/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";

export type OwnerEntitlementResult<T> = { ok: true; value: T; reused?: boolean } | { ok: false; code: "validation_error" | "storage_error"; message: string };
export type OwnerEntitlementOverview = {
  policies: readonly OwnerEntitlementPolicy[];
  activePolicies: readonly OwnerEntitlementPolicy[];
  entitlements: readonly OwnerEntitlementRecord[];
  openingBalances: readonly OwnerEntitlementOpeningBalance[];
  movements: readonly OwnerMovement[];
  walletBalances: readonly (CashWallet & { balanceMinor: number })[];
  approvedEntitlementMinor: number;
  openingBalanceMinor: number;
  drawnForEntitlementMinor: number;
  drawnBeforeEntitlementMinor: number;
  ownerDrawMinor: number;
  returnedForPriorDrawMinor: number;
  returnedAsCapitalMinor: number;
  remainingEntitlementBalanceMinor: number;
  cashMovementMinor: number;
  balanceState: "positive" | "zero" | "negative";
  truth: string;
  nextAction: string;
};
export type OwnerPolicyInput = Omit<CreateOwnerEntitlementPolicyInput, "createdAt">;
export type OwnerEntitlementRecordInput = { policyId: string; periodFrom: string; periodTo: string; occurredOn: string; note: string; idempotencyKey: string; evidence?: OwnerEntitlementEvidence };
export type OwnerOpeningBalanceInput = Omit<OwnerEntitlementOpeningBalance, "recordedAt">;
export type OwnerMovementInput = { kind: "draw" | "return"; amountMinor: number; walletId: string; occurredOn: string; reason: OwnerMovementReason; note: string; idempotencyKey: string; relatedEntitlementId?: string | null; relatedMovementId?: string | null };
export type OwnerMovementReversalInput = { movementId: string; occurredOn: string; reason: string; idempotencyKey: string };

type PeriodResultReader = (from: string, to: string) => Promise<{ ok: true; value: { resultMinor: number | null; status: "recorded_only" | "incomplete" | "invalid" } } | { ok: false; message: string }>;
const id = (prefix: string) => globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const failure = <T,>(message = "تعذر قراءة السجل المحلي."): OwnerEntitlementResult<T> => ({ ok: false, code: "storage_error", message });
const localDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const ammanDate = (timestamp: string) => { const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(timestamp)); const part = (type: string) => parts.find(entry => entry.type === type)?.value; return `${part("year")}-${part("month")}-${part("day")}`; };

export class OwnerEntitlementService {
  constructor(private readonly store: PrototypeLocalStore, private readonly periodResultReader?: PeriodResultReader, private readonly now: () => string = () => new Date().toISOString()) {}

  async readOverview(): Promise<OwnerEntitlementResult<OwnerEntitlementOverview>> {
    const [policies, entitlements, openingBalances, movements, wallets, cashEntries] = await Promise.all([this.store.listOwnerEntitlementPolicies(), this.store.listOwnerEntitlementRecords(), this.store.listOwnerEntitlementOpeningBalances(), this.store.listOwnerMovements(), this.store.listCashWallets(), this.store.listCashContinuityEntries()]);
    if (!policies.ok || !entitlements.ok || !openingBalances.ok || !movements.ok || !wallets.ok || !cashEntries.ok) return failure("تعذر قراءة سجل استحقاق المالك ومحفظة الكاش.");
    const activePolicies = policies.value.filter(policy => policy.status === "active");
    const walletBalances = wallets.value.map(wallet => ({ ...wallet, balanceMinor: cashEntries.value.filter(entry => entry.walletId === wallet.id).reduce((sum, entry) => sum + entry.cashDeltaMinor, 0) }));
    const approvedEntitlementMinor = entitlements.value.reduce((sum, record) => sum + record.amountMinor, 0);
    const openingBalanceMinor = openingBalances.value.reduce((sum, balance) => sum + balance.amountMinor, 0);
    const netMovementAmount = (reason: OwnerMovementReason, sign: 1 | -1) => Math.max(0, sign * movements.value.filter(movement => movement.reason === reason).reduce((sum, movement) => sum + movement.amountMinor * (movement.reversalOfId ? -1 : 1), 0));
    const drawnForEntitlementMinor = netMovementAmount("entitlement_settlement", 1);
    const drawnBeforeEntitlementMinor = netMovementAmount("pre_entitlement_draw", 1);
    const ownerDrawMinor = netMovementAmount("owner_draw", 1);
    const returnedForPriorDrawMinor = netMovementAmount("settlement_of_prior_draw", 1);
    const returnedAsCapitalMinor = netMovementAmount("new_capital_investment", 1);
    const remainingEntitlementBalanceMinor = openingBalanceMinor + entitlements.value.reduce((sum, record) => sum + record.amountMinor, 0) + movements.value.reduce((sum, movement) => sum + movement.entitlementDeltaMinor, 0);
    const cashMovementMinor = movements.value.reduce((sum, movement) => sum + movement.cashDeltaMinor, 0);
    const balanceState = remainingEntitlementBalanceMinor > 0 ? "positive" : remainingEntitlementBalanceMinor < 0 ? "negative" : "zero";
    return { ok: true, value: { policies: policies.value, activePolicies, entitlements: entitlements.value, openingBalances: openingBalances.value, movements: movements.value, walletBalances, approvedEntitlementMinor, openingBalanceMinor, drawnForEntitlementMinor, drawnBeforeEntitlementMinor, ownerDrawMinor, returnedForPriorDrawMinor, returnedAsCapitalMinor, remainingEntitlementBalanceMinor, cashMovementMinor, balanceState, truth: "الاستحقاق المسجل ليس قبضًا ولا يغير كاش المشروع. السحب والإرجاع الفعليان يغيران محفظة الكاش فقط وفق سببهما؛ الاستثمار الجديد مستقل عن الاستحقاق، والسحب غير المرتبط بسياسة يبقى Owner Draw مستقلًا.", nextAction: activePolicies.length === 0 ? "أضف سياسة مؤرخة إذا أردت تسجيل استحقاق جديد؛ لا ينشئ النظام استحقاقًا من تاريخ سابق تلقائيًا." : balanceState === "positive" ? "يمكن تسجيل سحب لتسوية استحقاق معتمد ضمن الرصيد المتاح، أو تسجيل واقعة فعلية أخرى بسبب واضح." : balanceState === "negative" ? "راجع السحوبات السابقة وسجل إرجاعًا لتسوية سحب سابق إذا كان هذا ما حدث فعليًا." : "الرصيد مسوى حاليًا؛ لا تسجل حركة بلا سبب واضح." } };
  }

  async createPolicy(input: OwnerPolicyInput): Promise<OwnerEntitlementResult<OwnerEntitlementPolicy>> {
    const existing = await this.store.listOwnerEntitlementPolicies(); if (!existing.ok) return failure("تعذر التحقق من سياسات استحقاق المالك.");
    const repeated = existing.value.find(policy => policy.idempotencyKey === input.idempotencyKey); if (repeated) return { ok: true, value: repeated, reused: true };
    if (existing.value.some(policy => policy.id === input.id)) return { ok: false, code: "validation_error", message: "معرف السياسة مستخدم؛ أنشئ نسخة جديدة بمعرف مختلف." };
    try { const policy = createOwnerEntitlementPolicy({ ...input, createdAt: this.now() }); const saved = await this.store.saveOwnerEntitlementPolicy(policy); return saved.ok ? { ok: true, value: saved.value } : failure("تعذر حفظ سياسة الاستحقاق؛ لم يتم تأكيد العملية."); } catch (error) { return { ok: false, code: "validation_error", message: error instanceof Error ? error.message : "بيانات السياسة غير صالحة." }; }
  }

  async calculate(policyId: string, periodFrom: string, periodTo: string): Promise<OwnerEntitlementResult<ReturnType<typeof calculateOwnerEntitlement>>> {
    const policy = await this.store.getOwnerEntitlementPolicy(policyId); if (!policy.ok) return failure("تعذر قراءة سياسة الاستحقاق."); if (!policy.value) return { ok: false, code: "validation_error", message: "لم نجد سياسة الاستحقاق المطلوبة." };
    if (!localDate(periodFrom) || !localDate(periodTo)) return { ok: false, code: "validation_error", message: "حدود الفترة المحلية غير صالحة." };
    const [orders, timeRecords] = await Promise.all([this.store.listOrders(), this.store.listActualTimeRecords()]); if (!orders.ok || !timeRecords.ok) return failure("تعذر قراءة الأعمال المكتملة أو الوقت المسجل.");
    const finalOrders = orders.value.filter(stored => stored.order.resultStatus === "final").map(stored => ({ stored, deliveredOn: stored.order.events.find(event => event.type === "status_changed" && event.toStatus === "delivered")?.createdAt ? ammanDate(stored.order.events.find(event => event.type === "status_changed" && event.toStatus === "delivered")!.createdAt) : null })).filter(item => item.deliveredOn !== null && item.deliveredOn >= periodFrom && item.deliveredOn <= periodTo);
    const timeQuantity = finalOrders.length ? timeRecords.value.filter(record => finalOrders.some(item => item.stored.order.id === record.orderId)).reduce((sum, record) => sum + record.minutesDelta, 0) : null;
    const evidence: OwnerEntitlementEvidence = { periodFrom, periodTo, completedWorkCount: finalOrders.length, completedSaleMinor: finalOrders.reduce((sum, item) => sum + item.stored.order.recognizedRevenueMinor, 0), unitQuantity: finalOrders.reduce((sum, item) => sum + item.stored.order.quantity, 0), timeQuantity };
    if (policy.value.kind === "profit_share") { if (!this.periodResultReader) return { ok: true, value: calculateOwnerEntitlement(policy.value, { ...evidence, recognizedProfitMinor: null, recognizedProfitStatus: "invalid" }) }; const result = await this.periodResultReader(periodFrom, periodTo); if (!result.ok) return failure(result.message); evidence.recognizedProfitMinor = result.value.resultMinor; evidence.recognizedProfitStatus = result.value.status; }
    try { return { ok: true, value: calculateOwnerEntitlement(policy.value, evidence) }; } catch (error) { return { ok: false, code: "validation_error", message: error instanceof Error ? error.message : "تعذر حساب الاستحقاق." }; }
  }

  async recordEntitlement(input: OwnerEntitlementRecordInput): Promise<OwnerEntitlementResult<OwnerEntitlementRecord>> {
    const existing = await this.store.listOwnerEntitlementRecords(); if (!existing.ok) return failure("تعذر التحقق من استحقاقات المالك."); const repeated = existing.value.find(record => record.idempotencyKey === input.idempotencyKey); if (repeated) return { ok: true, value: repeated, reused: true };
    const policy = await this.store.getOwnerEntitlementPolicy(input.policyId); if (!policy.ok) return failure("تعذر قراءة سياسة الاستحقاق."); if (!policy.value) return { ok: false, code: "validation_error", message: "اختر سياسة استحقاق موجودة." };
    const calculated = await this.calculate(input.policyId, input.periodFrom, input.periodTo); if (!calculated.ok) return calculated;
    if (calculated.value.amountMinor === null) return { ok: false, code: "validation_error", message: calculated.value.nextAction };
    try { const record = createOwnerEntitlementRecord({ id: id("entitlement"), policyId: policy.value.id, policyVersion: policy.value.version, periodFrom: input.periodFrom, periodTo: input.periodTo, occurredOn: input.occurredOn, recordedAt: this.now(), amountMinor: calculated.value.amountMinor, knowledge: calculated.value.knowledge === "incomplete" ? "partial" : calculated.value.knowledge, calculationBasis: calculated.value.calculationBasis, baseMinor: calculated.value.baseMinor, quantity: calculated.value.quantity, note: input.note, idempotencyKey: input.idempotencyKey }); const saved = await this.store.saveOwnerEntitlementRecord(record); return saved.ok ? { ok: true, value: saved.value } : failure("تعذر حفظ الاستحقاق؛ لم يتغير الكاش."); } catch (error) { return { ok: false, code: "validation_error", message: error instanceof Error ? error.message : "بيانات الاستحقاق غير صالحة." }; }
  }

  async setOpeningBalance(input: OwnerOpeningBalanceInput): Promise<OwnerEntitlementResult<OwnerEntitlementOpeningBalance>> {
    const existing = await this.store.listOwnerEntitlementOpeningBalances(); if (!existing.ok) return failure("تعذر التحقق من الرصيد الافتتاحي."); const repeated = existing.value.find(balance => balance.idempotencyKey === input.idempotencyKey); if (repeated) return { ok: true, value: repeated, reused: true };
    try { const balance = createOwnerEntitlementOpeningBalance({ ...input, recordedAt: this.now() }); const saved = await this.store.saveOwnerEntitlementOpeningBalance(balance); return saved.ok ? { ok: true, value: saved.value } : failure("تعذر حفظ الرصيد الافتتاحي؛ لم تُنشأ حركات ماضية."); } catch (error) { return { ok: false, code: "validation_error", message: error instanceof Error ? error.message : "بيانات الرصيد الافتتاحي غير صالحة." }; }
  }

  async recordMovement(input: OwnerMovementInput): Promise<OwnerEntitlementResult<{ movement: OwnerMovement; cashEntry: CashContinuityEntry }>> {
    const [movements, wallets, entitlements, cashEntries] = await Promise.all([this.store.listOwnerMovements(), this.store.listCashWallets(), this.store.listOwnerEntitlementRecords(), this.store.listCashContinuityEntries()]); if (!movements.ok || !wallets.ok || !entitlements.ok || !cashEntries.ok) return failure("تعذر قراءة حركة المالك أو محفظة الكاش.");
    const repeated = movements.value.find(movement => movement.idempotencyKey === input.idempotencyKey); if (repeated) { const cashEntry = cashEntries.value.find(entry => entry.operationKey === `owner-movement:${input.idempotencyKey}`); return cashEntry ? { ok: true, value: { movement: repeated, cashEntry }, reused: true } : failure("وجدت حركة مالك بلا أثر كاش مطابق؛ لم يتكرر الأثر."); }
    if (!wallets.value.some(wallet => wallet.id === input.walletId)) return { ok: false, code: "validation_error", message: "اختر محفظة كاش موجودة؛ لا تحفظ حركة بلا محفظة." };
    if (input.reason === "entitlement_settlement") { if (input.kind !== "draw" || !input.relatedEntitlementId || !entitlements.value.some(record => record.id === input.relatedEntitlementId)) return { ok: false, code: "validation_error", message: "اختر استحقاقًا مسجلًا لتسويته؛ لا تخمن السبب." }; const entitlement = entitlements.value.find(record => record.id === input.relatedEntitlementId)!; const settled = movements.value.filter(movement => movement.relatedEntitlementId === entitlement.id).reduce((sum, movement) => sum + movement.entitlementDeltaMinor, 0); if (input.amountMinor > entitlement.amountMinor + settled) return { ok: false, code: "validation_error", message: "لا يمكن أن يتجاوز السحب استحقاق هذا السجل المتبقي." }; }
    if (input.reason === "settlement_of_prior_draw") { if (input.kind !== "return" || !input.relatedMovementId) return { ok: false, code: "validation_error", message: "اختر سحبًا سابقًا لإرجاعه؛ لا تسجل إرجاعًا بلا أصل." }; const source = movements.value.find(movement => movement.id === input.relatedMovementId); if (!source || source.kind !== "draw" || source.reversalOfId || movements.value.some(movement => movement.reversalOfId === source.id)) return { ok: false, code: "validation_error", message: "السحب السابق المطلوب غير صالح للتسوية." }; const returned = movements.value.filter(movement => movement.relatedMovementId === source.id).reduce((sum, movement) => sum + movement.amountMinor * (movement.reversalOfId ? -1 : 1), 0); if (input.amountMinor > source.amountMinor - returned) return { ok: false, code: "validation_error", message: "لا يمكن أن يتجاوز الإرجاع قيمة السحب السابق المتبقية." }; }
    try { const movement = createOwnerMovement({ id: id("owner-movement"), recordedAt: this.now(), ...input }); const cashEntry = createCashContinuityEntry({ id: id("owner-cash"), walletId: input.walletId, type: "cash_adjustment", occurredOn: input.occurredOn, recordedAt: this.now(), cashDeltaMinor: movement.cashDeltaMinor, note: input.note, reason: `حركة مالك: ${input.reason}`, operationKey: `owner-movement:${input.idempotencyKey}` }); const saved = await this.store.commitOwnerMovement(movement, cashEntry); return saved.ok ? { ok: true, value: saved.value } : failure("تعذر حفظ حركة المالك والكاش ذريًا؛ لم يتم تأكيد نجاح العملية."); } catch (error) { return { ok: false, code: "validation_error", message: error instanceof Error ? error.message : "بيانات حركة المالك غير صالحة." }; }
  }

  async reverseMovement(input: OwnerMovementReversalInput): Promise<OwnerEntitlementResult<OwnerMovement>> {
    const [movements, cashEntries] = await Promise.all([this.store.listOwnerMovements(), this.store.listCashContinuityEntries()]); if (!movements.ok || !cashEntries.ok) return failure("تعذر قراءة سجل حركة المالك.");
    const repeated = movements.value.find(movement => movement.reversalOfId && movement.idempotencyKey === input.idempotencyKey); if (repeated) return { ok: true, value: repeated, reused: true };
    const source = movements.value.find(movement => movement.id === input.movementId); if (!source) return { ok: false, code: "validation_error", message: "لم نجد حركة المالك الأصلية." }; if (source.reversalOfId) return { ok: false, code: "validation_error", message: "لا يمكن عكس عكس سابق." }; if (movements.value.some(movement => movement.reversalOfId === source.id)) return { ok: false, code: "validation_error", message: "عُكست هذه الحركة سابقًا؛ لا يُنشأ عكس ثانٍ." };
    try { const reversal = createOwnerMovementReversal({ id: id("owner-reversal"), source, occurredOn: input.occurredOn, recordedAt: this.now(), reason: input.reason, idempotencyKey: input.idempotencyKey }); const cashEntry = createCashContinuityEntry({ id: id("owner-cash-reversal"), walletId: source.walletId, type: "cash_adjustment", occurredOn: input.occurredOn, recordedAt: this.now(), cashDeltaMinor: reversal.cashDeltaMinor, note: reversal.note, reason: `عكس حركة مالك: ${input.reason}`, operationKey: `owner-movement:${input.idempotencyKey}` }); const saved = await this.store.commitOwnerMovement(reversal, cashEntry); return saved.ok ? { ok: true, value: saved.value.movement } : failure("تعذر حفظ عكس حركة المالك والكاش ذريًا؛ بقي الأصل محفوظًا."); } catch (error) { return { ok: false, code: "validation_error", message: error instanceof Error ? error.message : "بيانات عكس الحركة غير صالحة." }; }
  }
}
