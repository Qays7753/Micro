import {
  createCashContinuityEntry,
  type CashContinuityEntry,
  type CashWallet,
} from "@micro-domain/cash-continuity/index.js";
import {
  calculateOwnerEntitlement,
  createOwnerEntitlementOpeningBalance,
  createOwnerEntitlementOpeningBalanceReversal,
  createOwnerEntitlementPolicy,
  createOwnerEntitlementPolicySuccessor,
  createOwnerEntitlementRecord,
  createOwnerEntitlementRecordReversal,
  createOwnerMovement,
  createOwnerMovementReversal,
  isPolicyEffective,
  type OwnerEntitlementEvidence,
  type OwnerEntitlementOpeningBalance,
  type OwnerEntitlementPolicy,
  type OwnerEntitlementRecord,
  type OwnerMovement,
  type OwnerMovementReason,
  type CreateOwnerEntitlementPolicyInput,
  type OwnerEntitlementPolicyTerms,
} from "@micro-domain/owner-entitlement/index.js";
import { reversedEventIds, type FinancialEvent } from "@micro-domain/financial-event/index.js";
import { lastEffectiveDeliveryEvent } from "@/application/fulfillment/deliveryAttribution";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { localDateInAmman as ammanDate } from "@/presentation/formatters";

export type OwnerEntitlementResult<T> =
  | { ok: true; value: T; reused?: boolean }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };
export type OwnerEntitlementOverview = {
  policies: readonly OwnerEntitlementPolicy[];
  activePolicies: readonly OwnerEntitlementPolicy[];
  entitlements: readonly OwnerEntitlementRecord[];
  openingBalances: readonly OwnerEntitlementOpeningBalance[];
  movements: readonly OwnerMovement[];
  walletBalances: readonly (CashWallet & { balanceMinor: number })[];
  approvedEntitlementMinor: number;
  openingBalanceMinor: number;
  openingBalanceSettlementMinor: number;
  openingBalanceRemainingMinor: number;
  drawnForEntitlementMinor: number;
  drawnBeforeEntitlementMinor: number;
  ownerDrawMinor: number;
  returnedForPriorDrawMinor: number;
  returnedAsCapitalMinor: number;
  remainingEntitlementBalanceMinor: number;
  cashMovementMinor: number;
  balanceState: "positive" | "zero" | "negative";
};
/* المجموعة ٦ (البند ٢ — S2-07): قراءة «مال المالك» الموحدة — طبقة قراءة فقط
 * فوق المصدرين القائمين (الأحداث المالية العامة + حركات دفتر المالك)، بلا
 * تخزين جديد ولا تغيير معنى: نفس معادلة readPosition لرأس المال المسجل،
 * وسجل موحد يعرض المصدر والتاريخ والمبلغ والأثر والمحفظة وحالة التراجع. */
export type OwnerMoneyRow = {
  id: string;
  source: "event" | "ledger";
  occurredOn: string;
  /** موجب = دخل مالك إلى المشروع؛ سالب = خرج منه. */
  amountMinor: number;
  effectLabel: string;
  cashPoolLabel: string | null;
  reversalLabel: string | null;
  note: string;
  deepLink: string | null;
};
export type OwnerMoneyOverview = {
  ownerCapitalRecordedMinor: number;
  remainingEntitlementBalanceMinor: number;
  balanceState: "positive" | "zero" | "negative";
  rows: readonly OwnerMoneyRow[];
};
export type OwnerPolicyInput = Omit<CreateOwnerEntitlementPolicyInput, "createdAt">;
export type OwnerPolicySuccessorInput = OwnerEntitlementPolicyTerms & {
  startsOn: string;
  source: string;
  note: string;
  idempotencyKey: string;
};
export type OwnerEntitlementRecordInput = {
  policyId: string;
  periodFrom: string;
  periodTo: string;
  occurredOn: string;
  note: string;
  idempotencyKey: string;
  evidence?: OwnerEntitlementEvidence;
};
export type OwnerOpeningBalanceInput = Omit<
  OwnerEntitlementOpeningBalance,
  "recordedAt" | "reversalOfId" | "reversalReason"
>;
export type OwnerMovementInput = {
  kind: "draw" | "return";
  amountMinor: number;
  walletId: string;
  occurredOn: string;
  reason: OwnerMovementReason;
  note: string;
  idempotencyKey: string;
  relatedEntitlementId?: string | null;
  relatedOpeningBalanceId?: string | null;
  relatedMovementId?: string | null;
};
export type OwnerMovementReversalInput = {
  movementId: string;
  occurredOn: string;
  reason: string;
  idempotencyKey: string;
};
export type OwnerEntitlementReversalInput = {
  recordId: string;
  occurredOn: string;
  reason: string;
  idempotencyKey: string;
};
export type OwnerOpeningBalanceReversalInput = {
  balanceId: string;
  occurredOn: string;
  reason: string;
  idempotencyKey: string;
};

type PeriodResultReader = (
  from: string,
  to: string,
) => Promise<
  | { ok: true; value: { resultMinor: number | null; status: "recorded_only" | "incomplete" | "invalid" } }
  | { ok: false; message: string }
>;
const id = (prefix: string) =>
  globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const failure = <T>(message = "تعذر قراءة السجل المحلي."): OwnerEntitlementResult<T> => ({
  ok: false,
  code: "storage_error",
  message,
});
const localDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T12:00:00.000Z`).getTime()) &&
  new Date(`${value}T12:00:00.000Z`).toISOString().slice(0, 10) === value;
const dayBefore = (value: string) => {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};
const dayAfter = (value: string) => {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};
const rangesOverlap = (leftFrom: string, leftTo: string | null, rightFrom: string, rightTo: string | null) =>
  leftFrom <= (rightTo ?? "9999-12-31") && rightFrom <= (leftTo ?? "9999-12-31");
const periodExclusive = (kind: OwnerEntitlementPolicy["kind"]) =>
  kind === "monthly" ||
  kind === "weekly" ||
  kind === "daily" ||
  kind === "fixed_period" ||
  kind === "profit_share";
const activeOriginals = <T extends { id: string; reversalOfId: string | null }>(values: readonly T[]) => {
  const reversed = new Set(
    values.filter(value => value.reversalOfId !== null).map(value => value.reversalOfId),
  );
  return values.filter(value => value.reversalOfId === null && !reversed.has(value.id));
};
const signedRecordTotal = (values: readonly OwnerEntitlementRecord[]) =>
  values.reduce((sum, value) => sum + (value.reversalOfId ? -value.amountMinor : value.amountMinor), 0);
const signedOpeningTotal = (values: readonly OwnerEntitlementOpeningBalance[]) =>
  values.reduce((sum, value) => sum + (value.reversalOfId ? -value.amountMinor : value.amountMinor), 0);
const signedMovementTotal = (
  values: readonly OwnerMovement[],
  selector: (movement: OwnerMovement) => number,
) => values.reduce((sum, value) => sum + selector(value) * (value.reversalOfId ? -1 : 1), 0);

export class OwnerEntitlementService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly periodResultReader?: PeriodResultReader,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async readOverview(): Promise<OwnerEntitlementResult<OwnerEntitlementOverview>> {
    const [policies, entitlements, openingBalances, movements, wallets, cashEntries] = await Promise.all([
      this.store.listOwnerEntitlementPolicies(),
      this.store.listOwnerEntitlementRecords(),
      this.store.listOwnerEntitlementOpeningBalances(),
      this.store.listOwnerMovements(),
      this.store.listCashWallets(),
      this.store.listCashContinuityEntries(),
    ]);
    if (
      !policies.ok ||
      !entitlements.ok ||
      !openingBalances.ok ||
      !movements.ok ||
      !wallets.ok ||
      !cashEntries.ok
    )
      return failure("تعذر قراءة سجل حق المالك ومحفظة الكاش.");
    const activePolicies = policies.value.filter(policy => policy.status === "active");
    const walletBalances = wallets.value.map(wallet => ({
      ...wallet,
      balanceMinor: cashEntries.value
        .filter(entry => entry.walletId === wallet.id)
        .reduce((sum, entry) => sum + entry.cashDeltaMinor, 0),
    }));
    const openingBalanceMinor = signedOpeningTotal(openingBalances.value);
    const openingBalanceSettlementMinor = movements.value.reduce(
      (sum, movement) => sum + movement.openingBalanceDeltaMinor,
      0,
    );
    const openingBalanceRemainingMinor = openingBalanceMinor + openingBalanceSettlementMinor;
    const approvedEntitlementMinor = signedRecordTotal(entitlements.value);
    const netMovementAmount = (reason: OwnerMovementReason) =>
      Math.max(
        0,
        signedMovementTotal(
          movements.value.filter(movement => movement.reason === reason),
          movement => movement.amountMinor,
        ),
      );
    const drawnForEntitlementMinor = netMovementAmount("entitlement_settlement");
    const drawnBeforeEntitlementMinor = netMovementAmount("pre_entitlement_draw");
    const ownerDrawMinor = netMovementAmount("owner_draw");
    const returnedForPriorDrawMinor = netMovementAmount("settlement_of_prior_draw");
    const returnedAsCapitalMinor = netMovementAmount("new_capital_investment");
    const remainingEntitlementBalanceMinor =
      openingBalanceRemainingMinor +
      approvedEntitlementMinor +
      movements.value.reduce((sum, movement) => sum + movement.entitlementDeltaMinor, 0);
    const cashMovementMinor = movements.value.reduce((sum, movement) => sum + movement.cashDeltaMinor, 0);
    const balanceState =
      remainingEntitlementBalanceMinor > 0
        ? "positive"
        : remainingEntitlementBalanceMinor < 0
          ? "negative"
          : "zero";
    return {
      ok: true,
      value: {
        policies: policies.value,
        activePolicies,
        entitlements: entitlements.value,
        openingBalances: openingBalances.value,
        movements: movements.value,
        walletBalances,
        approvedEntitlementMinor,
        openingBalanceMinor,
        openingBalanceSettlementMinor,
        openingBalanceRemainingMinor,
        drawnForEntitlementMinor,
        drawnBeforeEntitlementMinor,
        ownerDrawMinor,
        returnedForPriorDrawMinor,
        returnedAsCapitalMinor,
        remainingEntitlementBalanceMinor,
        cashMovementMinor,
        balanceState,
      },
    };
  }

  /** المجموعة ٦ (البند ٢): الدفتر الموحد — أحداث المالك العامة + حركات الدفتر
   * بترتيب زمني واحد؛ رأس المال بنفس معادلة readPosition (الأحداث + حركات
   * رأس المال) فلا رقم ثانٍ ولا معنى جديد. */
  async readOwnerMoneyOverview(): Promise<OwnerEntitlementResult<OwnerMoneyOverview>> {
    const [eventsResult, movementsResult, walletsResult, overviewResult] = await Promise.all([
      this.store.listFinancialEvents(),
      this.store.listOwnerMovements(),
      this.store.listCashWallets(),
      this.readOverview(),
    ]);
    if (!eventsResult.ok || !movementsResult.ok || !walletsResult.ok || !overviewResult.ok)
      return failure("تعذر قراءة سجل مال المالك الموحد.");
    const events = eventsResult.value as readonly FinancialEvent[];
    const movements = movementsResult.value;
    const reversedIds = reversedEventIds(events);
    const walletNameOf = (walletId: string | null) => {
      if (!walletId) return null;
      const wallet = walletsResult.value.find(candidate => candidate.id === walletId);
      return wallet ? `محفظة: ${wallet.name}` : null;
    };
    const rows: OwnerMoneyRow[] = [];
    for (const event of events) {
      if (event.type !== "owner_investment_cash" && event.type !== "owner_withdrawal_cash") continue;
      rows.push({
        id: event.id,
        source: "event",
        occurredOn: event.occurredOn,
        amountMinor: event.ownerCapitalDeltaMinor,
        effectLabel: "رأس مال",
        cashPoolLabel: "كاش غير موزع",
        reversalLabel: reversedIds.has(event.id) ? "مُتراجَع موثقًا" : null,
        note: event.note,
        deepLink: `/finance?event=${encodeURIComponent(event.id)}`,
      });
    }
    const reversedMovementIds = new Set(
      movements.filter(movement => movement.reversalOfId !== null).map(movement => movement.reversalOfId),
    );
    for (const movement of movements) {
      const isReversal = movement.reversalOfId !== null;
      const reversed = reversedMovementIds.has(movement.id);
      rows.push({
        id: movement.id,
        source: "ledger",
        occurredOn: movement.occurredOn,
        /* اتجاه الكاش من منظور المالك: سحب = خرج (سالب)، إرجاع = دخل (موجب).
         * التراجع يحمل نوع أصله مع دلتا معكوسة، فالمعيار الحاسم هو أثر الكاش
         * نفسه (cashDeltaMinor) لا نوع الحركة. */
        amountMinor: movement.cashDeltaMinor,
        effectLabel:
          movement.ownerCapitalDeltaMinor !== 0
            ? "رأس مال"
            : movement.openingBalanceDeltaMinor !== 0
              ? "رصيد افتتاحي"
              : movement.entitlementDeltaMinor !== 0
                ? "حق مسجل"
                : "حركة",
        cashPoolLabel: walletNameOf(movement.walletId),
        reversalLabel: isReversal ? "تراجع موثق عن حركة" : reversed ? "مُتراجَع موثقًا" : null,
        note: movement.note,
        deepLink: null,
      });
    }
    rows.sort(
      (left, right) => right.occurredOn.localeCompare(left.occurredOn) || left.id.localeCompare(right.id),
    );
    const ownerCapitalRecordedMinor =
      events.reduce((sum, event) => sum + event.ownerCapitalDeltaMinor, 0) +
      movements.reduce((sum, movement) => sum + movement.ownerCapitalDeltaMinor, 0);
    return {
      ok: true,
      value: {
        ownerCapitalRecordedMinor,
        remainingEntitlementBalanceMinor: overviewResult.value.remainingEntitlementBalanceMinor,
        balanceState: overviewResult.value.balanceState,
        rows,
      },
    };
  }

  async createPolicy(input: OwnerPolicyInput): Promise<OwnerEntitlementResult<OwnerEntitlementPolicy>> {
    const existing = await this.store.listOwnerEntitlementPolicies();
    if (!existing.ok) return failure("تعذر التحقق من سياسات حق المالك.");
    const repeated = existing.value.find(policy => policy.idempotencyKey === input.idempotencyKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    if (existing.value.some(policy => policy.id === input.id))
      return {
        ok: false,
        code: "validation_error",
        message: "معرف السياسة مستخدم؛ أنشئ نسخة جديدة بمعرف مختلف.",
      };
    try {
      const policy = createOwnerEntitlementPolicy({ ...input, createdAt: this.now() });
      if (existing.value.some(other => other.seriesId === policy.seriesId))
        return {
          ok: false,
          code: "validation_error",
          message: "يوجد إصدار سابق لنفس السياسة؛ أنشئ نسخة جديدة تبدأ من تاريخ بدل تعديل الإصدار يدويًا.",
        };
      const saved = await this.store.saveOwnerEntitlementPolicy(policy);
      return saved.ok
        ? { ok: true, value: saved.value }
        : failure("تعذر حفظ سياسة حق المالك؛ لم يتم تأكيد العملية.");
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات السياسة غير صالحة.",
      };
    }
  }

  async createPolicySuccessor(
    policyId: string,
    input: OwnerPolicySuccessorInput,
  ): Promise<OwnerEntitlementResult<OwnerEntitlementPolicy>> {
    const policies = await this.store.listOwnerEntitlementPolicies();
    if (!policies.ok) return failure("تعذر قراءة سياسات حق المالك.");
    const repeated = policies.value.find(policy => policy.idempotencyKey === input.idempotencyKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    const previous = policies.value.find(policy => policy.id === policyId);
    if (!previous)
      return {
        ok: false,
        code: "validation_error",
        message: "لم نجد السياسة الأصلية لإنشاء نسخة جديدة لها.",
      };
    if (previous.status !== "active")
      return {
        ok: false,
        code: "validation_error",
        message: "لا يمكن إنشاء نسخة جديدة من سياسة منتهية؛ اختر النسخة الفعالة الأخيرة.",
      };
    if (previous.endsOn !== null && ammanDate(this.now()) > previous.endsOn)
      return {
        ok: false,
        code: "validation_error",
        message: "انتهت السياسة تاريخيًا؛ لا يوسّع النظام سياسة منتهية بصمت. أنشئ سياسة مستقلة بقرار جديد.",
      };
    if (!localDate(input.startsOn) || input.startsOn <= previous.startsOn)
      return {
        ok: false,
        code: "validation_error",
        message: "تاريخ بدء النسخة الجديدة يجب أن يكون محليًا وبعد بداية السياسة الأصلية.",
      };
    if (previous.endsOn !== null && input.startsOn > dayAfter(previous.endsOn))
      return {
        ok: false,
        code: "validation_error",
        message:
          "تاريخ بدء النسخة الجديدة يتجاوز نهاية السياسة الأصلية ويترك فجوة؛ اختر تاريخ النهاية التالي أو أنشئ سياسة مستقلة.",
      };
    if (!input.source.trim() || !input.note.trim())
      return { ok: false, code: "validation_error", message: "سبب التعديل وملاحظة النسخة الجديدة إلزاميان." };
    const later = policies.value.find(
      policy =>
        policy.seriesId === previous.seriesId &&
        policy.id !== previous.id &&
        policy.startsOn >= input.startsOn,
    );
    if (later)
      return {
        ok: false,
        code: "validation_error",
        message: "توجد نسخة لاحقة تبدأ من هذا التاريخ؛ لا ينشئ النظام نسختين متداخلتين.",
      };
    try {
      const successor = createOwnerEntitlementPolicySuccessor({
        id: id("owner-policy"),
        seriesId: previous.seriesId,
        successorOfPolicyId: previous.id,
        version: previous.version + 1,
        kind: input.kind,
        amountMinor: input.amountMinor,
        percentageBps: input.percentageBps,
        unitLabel: input.unitLabel,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        source: input.source,
        note: input.note,
        status: "active",
        idempotencyKey: input.idempotencyKey,
        createdAt: this.now(),
      });
      const ended = createOwnerEntitlementPolicy({
        ...previous,
        endsOn: dayBefore(input.startsOn),
        status: "ended",
      });
      if (ended.endsOn! < ended.startsOn)
        return {
          ok: false,
          code: "validation_error",
          message: "تاريخ بدء النسخة الجديدة يقع قبل بداية السياسة الأصلية؛ لم يتغير أي شيء.",
        };
      const saved = await this.store.commitOwnerEntitlementPolicySuccessor(ended, successor);
      return saved.ok
        ? { ok: true, value: saved.value.successor }
        : failure("تعذر حفظ النسخة الجديدة ذريًا؛ بقيت السياسات دون تغيير.");
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      const message = raw.includes("fixed_period")
        ? "النسخة الجديدة من نوع مبلغ ثابت للفترة تحتاج تاريخ نهاية معلنًا."
        : raw.includes("unitLabel")
          ? "النسخة الجديدة لكل وحدة أو عمل مكتمل تحتاج تسمية وحدة صريحة."
          : raw.includes("percentageBps")
            ? "أدخل نسبة صحيحة بين 0.01% و100%."
            : raw.includes("amountMinor")
              ? "أدخل مبلغًا موجبًا بوحدة JOD minor."
              : raw.includes("policy kind")
                ? "نوع النسخة الجديدة غير مدعوم أو لا يملك دليلًا مكتملًا في هذا الإصدار."
                : "بيانات النسخة الجديدة غير صالحة؛ لم تتغير النسخة السابقة.";
      return { ok: false, code: "validation_error", message };
    }
  }

  async calculate(
    policyId: string,
    periodFrom: string,
    periodTo: string,
  ): Promise<OwnerEntitlementResult<ReturnType<typeof calculateOwnerEntitlement>>> {
    const policy = await this.store.getOwnerEntitlementPolicy(policyId);
    if (!policy.ok) return failure("تعذر قراءة سياسة حق المالك.");
    if (!policy.value)
      return { ok: false, code: "validation_error", message: "لم نجد سياسة حق المالك المطلوبة." };
    if (!localDate(periodFrom) || !localDate(periodTo))
      return { ok: false, code: "validation_error", message: "حدود الفترة المحلية غير صالحة." };
    const [orders, timeRecords] = await Promise.all([
      this.store.listOrders(),
      this.store.listActualTimeRecords(),
    ]);
    if (!orders.ok || !timeRecords.ok) return failure("تعذر قراءة الأعمال المكتملة أو الوقت المسجل.");
    const finalOrders = orders.value
      .filter(stored => stored.order.resultStatus === "final")
      .map(stored => ({
        stored,
        /* المجموعة ٦ (تدقيق A1 — FT-01): دليل المالك يقرأ آخر تسليم ساري —
         * إعادة التسليم بعد العكس تحدّث فترة الدليل لا فترة التسليم المعكوس. */
        deliveredOn: (() => {
          const event = lastEffectiveDeliveryEvent(stored.order);
          return event ? ammanDate(event.createdAt) : null;
        })(),
      }))
      .filter(
        item => item.deliveredOn !== null && item.deliveredOn >= periodFrom && item.deliveredOn <= periodTo,
      );
    const reversedTimeIds = new Set(
      timeRecords.value.filter(record => record.reversalOfId !== null).map(record => record.reversalOfId),
    );
    const activeTimeRecords = timeRecords.value.filter(
      record => record.minutesDelta > 0 && !reversedTimeIds.has(record.id),
    );
    const relevantOrderIds = new Set(finalOrders.map(item => item.stored.order.id));
    const relevantTimeRecords = activeTimeRecords.filter(record => relevantOrderIds.has(record.orderId));
    const evidence: OwnerEntitlementEvidence = {
      periodFrom,
      periodTo,
      completedWorkCount: finalOrders.length,
      completedWorkKeys: finalOrders.map(item => item.stored.order.id),
      completedSaleMinor: finalOrders.reduce(
        (sum, item) => sum + item.stored.order.recognizedRevenueMinor,
        0,
      ),
      completedSaleKeys: finalOrders.map(item => item.stored.order.id),
      unitQuantity: finalOrders.reduce((sum, item) => sum + item.stored.order.quantity, 0),
      unitSourceKeys: finalOrders.map(item => item.stored.order.id),
      timeQuantity: relevantTimeRecords.reduce((sum, record) => sum + record.minutesDelta, 0) || null,
      timeSourceKeys: relevantTimeRecords.map(record => record.id),
    };
    if (policy.value.kind === "profit_share") {
      if (!this.periodResultReader)
        return {
          ok: true,
          value: calculateOwnerEntitlement(policy.value, {
            ...evidence,
            recognizedProfitMinor: null,
            recognizedProfitStatus: "invalid",
          }),
        };
      const result = await this.periodResultReader(periodFrom, periodTo);
      if (!result.ok) return failure(result.message);
      evidence.recognizedProfitMinor = result.value.resultMinor;
      evidence.recognizedProfitStatus = result.value.status;
      evidence.recognizedProfitKeys = [`g3:${periodFrom}:${periodTo}`];
    }
    try {
      return { ok: true, value: calculateOwnerEntitlement(policy.value, evidence) };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "تعذر حساب الحق.",
      };
    }
  }

  async recordEntitlement(
    input: OwnerEntitlementRecordInput,
  ): Promise<OwnerEntitlementResult<OwnerEntitlementRecord>> {
    const existing = await this.store.listOwnerEntitlementRecords();
    if (!existing.ok) return failure("تعذر التحقق من حقوق المالك.");
    const repeated = existing.value.find(record => record.idempotencyKey === input.idempotencyKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    const policy = await this.store.getOwnerEntitlementPolicy(input.policyId);
    if (!policy.ok) return failure("تعذر قراءة سياسة حق المالك.");
    if (!policy.value) return { ok: false, code: "validation_error", message: "اختر سياسة حق موجودة." };
    const calculated = await this.calculate(input.policyId, input.periodFrom, input.periodTo);
    if (!calculated.ok) return calculated;
    if (calculated.value.amountMinor === null)
      return { ok: false, code: "validation_error", message: calculated.value.nextAction };
    const sourceKeys =
      calculated.value.sourceKeys.length > 0
        ? calculated.value.sourceKeys
        : [`period:${policy.value.id}:${input.periodFrom}:${input.periodTo}`];
    const activeRecords = activeOriginals(existing.value);
    const policyValue = policy.value;
    const samePolicy = activeRecords.filter(
      record => record.policyId === policyValue.id && record.policyVersion === policyValue.version,
    );
    const sourceOverlap = samePolicy.some(record => record.sourceKeys.some(key => sourceKeys.includes(key)));
    if (
      sourceOverlap ||
      (periodExclusive(policyValue.kind) &&
        samePolicy.some(record =>
          rangesOverlap(record.periodFrom, record.periodTo, input.periodFrom, input.periodTo),
        ))
    )
      return {
        ok: false,
        code: "validation_error",
        message:
          "يوجد حق نشط يغطي المصدر أو الفترة نفسها؛ لم يتكرر الحق. تراجع عن السجل السابق أولًا إذا كان خطأ.",
      };
    try {
      const record = createOwnerEntitlementRecord({
        id: id("entitlement"),
        policyId: policy.value.id,
        policyVersion: policy.value.version,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        amountMinor: calculated.value.amountMinor,
        knowledge: calculated.value.knowledge === "incomplete" ? "partial" : calculated.value.knowledge,
        calculationBasis: calculated.value.calculationBasis,
        baseMinor: calculated.value.baseMinor,
        quantity: calculated.value.quantity,
        sourceKeys,
        note: input.note,
        idempotencyKey: input.idempotencyKey,
        reversalOfId: null,
        reversalReason: null,
      });
      const saved = await this.store.saveOwnerEntitlementRecord(record);
      return saved.ok ? { ok: true, value: saved.value } : failure("تعذر حفظ الحق؛ لم يتغير الكاش.");
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات الحق غير صالحة.",
      };
    }
  }

  async reverseEntitlement(
    input: OwnerEntitlementReversalInput,
  ): Promise<OwnerEntitlementResult<OwnerEntitlementRecord>> {
    const [records, movements] = await Promise.all([
      this.store.listOwnerEntitlementRecords(),
      this.store.listOwnerMovements(),
    ]);
    if (!records.ok || !movements.ok) return failure("تعذر قراءة سجل الحق.");
    const repeated = records.value.find(
      record => record.reversalOfId !== null && record.idempotencyKey === input.idempotencyKey,
    );
    if (repeated) return { ok: true, value: repeated, reused: true };
    const source = records.value.find(record => record.id === input.recordId);
    if (!source) return { ok: false, code: "validation_error", message: "لم نجد سجل الحق الأصلي." };
    if (source.reversalOfId)
      return { ok: false, code: "validation_error", message: "لا يمكن التراجع عن تراجع سابق." };
    if (records.value.some(record => record.reversalOfId === source.id))
      return {
        ok: false,
        code: "validation_error",
        message: "تم التراجع عن هذا الحق سابقًا؛ لا يُنشأ تراجع ثانٍ.",
      };
    if (activeOriginals(movements.value).some(movement => movement.relatedEntitlementId === source.id))
      return {
        ok: false,
        code: "validation_error",
        message: "تراجع عن حركات هذا الحق أو سوِّها أولًا؛ لا نترك مصدرًا مسجلًا بلا رصيد متوازن.",
      };
    try {
      const reversal = createOwnerEntitlementRecordReversal({
        id: id("entitlement-reversal"),
        source,
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      });
      const saved = await this.store.commitOwnerEntitlementRecordReversal(source.id, reversal);
      return saved.ok
        ? { ok: true, value: saved.value }
        : failure("تعذر حفظ التراجع عن الحق؛ بقي الأصل محفوظًا.");
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات التراجع عن الحق غير صالحة.",
      };
    }
  }

  async setOpeningBalance(
    input: OwnerOpeningBalanceInput,
  ): Promise<OwnerEntitlementResult<OwnerEntitlementOpeningBalance>> {
    const existing = await this.store.listOwnerEntitlementOpeningBalances();
    if (!existing.ok) return failure("تعذر التحقق من الرصيد الافتتاحي.");
    const repeated = existing.value.find(balance => balance.idempotencyKey === input.idempotencyKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    if (activeOriginals(existing.value).length > 0)
      return {
        ok: false,
        code: "validation_error",
        message: "يوجد رصيد افتتاحي فعال؛ تراجع عنه أو صححه قبل إضافة طبقة افتتاحية جديدة.",
      };
    try {
      const balance = createOwnerEntitlementOpeningBalance({
        ...input,
        recordedAt: this.now(),
        reversalOfId: null,
        reversalReason: null,
      });
      const saved = await this.store.saveOwnerEntitlementOpeningBalance(balance);
      return saved.ok
        ? { ok: true, value: saved.value }
        : failure("تعذر حفظ الرصيد الافتتاحي؛ لم تُنشأ حركات ماضية.");
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات الرصيد الافتتاحي غير صالحة.",
      };
    }
  }

  async reverseOpeningBalance(
    input: OwnerOpeningBalanceReversalInput,
  ): Promise<OwnerEntitlementResult<OwnerEntitlementOpeningBalance>> {
    const [balances, movements] = await Promise.all([
      this.store.listOwnerEntitlementOpeningBalances(),
      this.store.listOwnerMovements(),
    ]);
    if (!balances.ok || !movements.ok) return failure("تعذر قراءة الرصيد الافتتاحي.");
    const repeated = balances.value.find(
      balance => balance.reversalOfId !== null && balance.idempotencyKey === input.idempotencyKey,
    );
    if (repeated) return { ok: true, value: repeated, reused: true };
    const source = balances.value.find(balance => balance.id === input.balanceId);
    if (!source) return { ok: false, code: "validation_error", message: "لم نجد الرصيد الافتتاحي الأصلي." };
    if (source.reversalOfId)
      return { ok: false, code: "validation_error", message: "لا يمكن التراجع عن تراجع سابق." };
    if (balances.value.some(balance => balance.reversalOfId === source.id))
      return {
        ok: false,
        code: "validation_error",
        message: "تم التراجع عن هذا الرصيد الافتتاحي سابقًا؛ لا يُنشأ تراجع ثانٍ.",
      };
    if (activeOriginals(movements.value).some(movement => movement.relatedOpeningBalanceId === source.id))
      return {
        ok: false,
        code: "validation_error",
        message: "تراجع عن حركات هذا الافتتاح أو سوِّها أولًا؛ لا نترك مصدرًا مسجلًا بلا رصيد متوازن.",
      };
    try {
      const reversal = createOwnerEntitlementOpeningBalanceReversal({
        id: id("opening-reversal"),
        source,
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      });
      const saved = await this.store.commitOwnerEntitlementOpeningBalanceReversal(source.id, reversal);
      return saved.ok
        ? { ok: true, value: saved.value }
        : failure("تعذر حفظ التراجع عن الرصيد الافتتاحي؛ بقي الأصل محفوظًا.");
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات التراجع عن الرصيد الافتتاحي غير صالحة.",
      };
    }
  }

  async recordMovement(
    input: OwnerMovementInput,
  ): Promise<OwnerEntitlementResult<{ movement: OwnerMovement; cashEntry: CashContinuityEntry }>> {
    const [movements, wallets, entitlements, openingBalances, cashEntries] = await Promise.all([
      this.store.listOwnerMovements(),
      this.store.listCashWallets(),
      this.store.listOwnerEntitlementRecords(),
      this.store.listOwnerEntitlementOpeningBalances(),
      this.store.listCashContinuityEntries(),
    ]);
    if (!movements.ok || !wallets.ok || !entitlements.ok || !openingBalances.ok || !cashEntries.ok)
      return failure("تعذر قراءة حركة المالك أو محفظة الكاش.");
    const repeated = movements.value.find(movement => movement.idempotencyKey === input.idempotencyKey);
    if (repeated) {
      const cashEntry = cashEntries.value.find(
        entry => entry.operationKey === `owner-movement:${input.idempotencyKey}`,
      );
      return cashEntry
        ? { ok: true, value: { movement: repeated, cashEntry }, reused: true }
        : failure("وجدت حركة مالك بلا أثر كاش مطابق؛ لم يتكرر الأثر.");
    }
    if (!wallets.value.some(wallet => wallet.id === input.walletId))
      return {
        ok: false,
        code: "validation_error",
        message: "اختر محفظة كاش موجودة؛ لا تحفظ حركة بلا محفظة.",
      };
    const activeEntitlementRecords = activeOriginals(entitlements.value);
    if (input.reason === "entitlement_settlement") {
      if (
        input.kind !== "draw" ||
        !input.relatedEntitlementId ||
        !activeEntitlementRecords.some(record => record.id === input.relatedEntitlementId)
      )
        return {
          ok: false,
          code: "validation_error",
          message: "اختر حقًا مسجلًا وفعالًا لتسويته؛ لا تخمن السبب.",
        };
      const entitlement = activeEntitlementRecords.find(record => record.id === input.relatedEntitlementId)!;
      const settled = movements.value
        .filter(movement => movement.relatedEntitlementId === entitlement.id)
        .reduce((sum, movement) => sum + movement.entitlementDeltaMinor, 0);
      if (input.amountMinor > entitlement.amountMinor + settled)
        return {
          ok: false,
          code: "validation_error",
          message: "لا يمكن أن يتجاوز السحب حق هذا السجل المتبقي.",
        };
    }
    if (input.reason === "opening_balance_settlement") {
      if (!input.relatedOpeningBalanceId)
        return {
          ok: false,
          code: "validation_error",
          message: "اختر رصيدًا افتتاحيًا لتسويته؛ لا نخمن مصدر الحركة.",
        };
      const activeOpening = activeOriginals(openingBalances.value).find(
        balance => balance.id === input.relatedOpeningBalanceId,
      );
      if (!activeOpening)
        return {
          ok: false,
          code: "validation_error",
          message: "اختر رصيدًا افتتاحيًا فعالًا؛ لا تسوِّ مصدرًا تم التراجع عنه.",
        };
      const settled = movements.value
        .filter(movement => movement.relatedOpeningBalanceId === activeOpening.id)
        .reduce((sum, movement) => sum + movement.openingBalanceDeltaMinor, 0);
      const remaining = activeOpening.amountMinor + settled;
      if (
        (remaining > 0 && input.kind !== "draw") ||
        (remaining < 0 && input.kind !== "return") ||
        remaining === 0 ||
        input.amountMinor > Math.abs(remaining)
      )
        return {
          ok: false,
          code: "validation_error",
          message: "نوع الحركة أو مبلغ تسوية الافتتاح لا يطابق الرصيد المتبقي.",
        };
    }
    if (input.reason === "settlement_of_prior_draw") {
      if (input.kind !== "return" || !input.relatedMovementId)
        return {
          ok: false,
          code: "validation_error",
          message: "اختر سحبًا سابقًا لإرجاعه؛ لا تسجل إرجاعًا بلا أصل.",
        };
      const source = movements.value.find(movement => movement.id === input.relatedMovementId);
      if (
        !source ||
        source.kind !== "draw" ||
        source.reversalOfId ||
        movements.value.some(movement => movement.reversalOfId === source.id)
      )
        return { ok: false, code: "validation_error", message: "السحب السابق المطلوب غير صالح للتسوية." };
      const returned = movements.value
        .filter(movement => movement.relatedMovementId === source.id)
        .reduce((sum, movement) => sum + movement.amountMinor * (movement.reversalOfId ? -1 : 1), 0);
      if (input.amountMinor > source.amountMinor - returned)
        return {
          ok: false,
          code: "validation_error",
          message: "لا يمكن أن يتجاوز الإرجاع قيمة السحب السابق المتبقية.",
        };
    }
    try {
      const movement = createOwnerMovement({ id: id("owner-movement"), recordedAt: this.now(), ...input });
      const cashEntry = createCashContinuityEntry({
        id: id("owner-cash"),
        walletId: input.walletId,
        type: "cash_adjustment",
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        cashDeltaMinor: movement.cashDeltaMinor,
        note: input.note,
        reason: `حركة مالك: ${input.reason}`,
        operationKey: `owner-movement:${input.idempotencyKey}`,
      });
      const saved = await this.store.commitOwnerMovement(movement, cashEntry);
      return saved.ok
        ? { ok: true, value: saved.value }
        : failure("تعذر حفظ حركة المالك والكاش ذريًا؛ لم يتم تأكيد نجاح العملية.");
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات حركة المالك غير صالحة.",
      };
    }
  }

  async reverseMovement(input: OwnerMovementReversalInput): Promise<OwnerEntitlementResult<OwnerMovement>> {
    const [movements, cashEntries] = await Promise.all([
      this.store.listOwnerMovements(),
      this.store.listCashContinuityEntries(),
    ]);
    if (!movements.ok || !cashEntries.ok) return failure("تعذر قراءة سجل حركة المالك.");
    const repeated = movements.value.find(
      movement => movement.reversalOfId && movement.idempotencyKey === input.idempotencyKey,
    );
    if (repeated) return { ok: true, value: repeated, reused: true };
    const source = movements.value.find(movement => movement.id === input.movementId);
    if (!source) return { ok: false, code: "validation_error", message: "لم نجد حركة المالك الأصلية." };
    if (source.reversalOfId)
      return { ok: false, code: "validation_error", message: "لا يمكن التراجع عن تراجع سابق." };
    if (movements.value.some(movement => movement.reversalOfId === source.id))
      return {
        ok: false,
        code: "validation_error",
        message: "تم التراجع عن هذه الحركة سابقًا؛ لا يُنشأ تراجع ثانٍ.",
      };
    try {
      const reversal = createOwnerMovementReversal({
        id: id("owner-reversal"),
        source,
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      });
      const cashEntry = createCashContinuityEntry({
        id: id("owner-cash-reversal"),
        walletId: source.walletId,
        type: "cash_adjustment",
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        cashDeltaMinor: reversal.cashDeltaMinor,
        note: reversal.note,
        reason: `تراجع عن حركة مالك: ${input.reason}`,
        operationKey: `owner-movement:${input.idempotencyKey}`,
      });
      const saved = await this.store.commitOwnerMovement(reversal, cashEntry);
      return saved.ok
        ? { ok: true, value: saved.value.movement }
        : failure("تعذر حفظ التراجع عن حركة المالك والكاش ذريًا؛ بقي الأصل محفوظًا.");
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات التراجع عن الحركة غير صالحة.",
      };
    }
  }
}
