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
import type { PrototypeLocalStore } from "@/storage/local/types";

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
  truth: string;
  nextAction: string;
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
const ammanDate = (timestamp: string) => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const part = (type: string) => parts.find(entry => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};
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
      return failure("تعذر قراءة سجل استحقاق المالك ومحفظة الكاش.");
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
        truth:
          "الاستحقاق المسجل ليس قبضًا ولا يغير كاش المشروع. السحب والإرجاع الفعليان يغيران محفظة الكاش فقط وفق سببهما؛ الاستثمار الجديد مستقل عن الاستحقاق، والسحب غير المرتبط بسياسة يبقى Owner Draw مستقلًا.",
        nextAction:
          activePolicies.length === 0
            ? "أضف سياسة مؤرخة إذا أردت تسجيل استحقاق جديد؛ لا ينشئ النظام استحقاقًا من تاريخ سابق تلقائيًا."
            : balanceState === "positive"
              ? "يمكن تسجيل سحب لتسوية استحقاق أو افتتاح موجب ضمن المصدر المتبقي، أو تسجيل واقعة فعلية أخرى بسبب واضح."
              : balanceState === "negative"
                ? "راجع السحوبات السابقة وسجل إرجاعًا لتسوية سحب سابق أو افتتاح سالب إذا كان هذا ما حدث فعليًا."
                : "الرصيد مسوى حاليًا؛ لا تسجل حركة بلا سبب واضح.",
      },
    };
  }

  async createPolicy(input: OwnerPolicyInput): Promise<OwnerEntitlementResult<OwnerEntitlementPolicy>> {
    const existing = await this.store.listOwnerEntitlementPolicies();
    if (!existing.ok) return failure("تعذر التحقق من سياسات استحقاق المالك.");
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
          message: "السلسلة موجودة؛ استخدم إجراء الخليفة المؤرخ بدل تعديل الإصدار يدويًا.",
        };
      const saved = await this.store.saveOwnerEntitlementPolicy(policy);
      return saved.ok
        ? { ok: true, value: saved.value }
        : failure("تعذر حفظ سياسة الاستحقاق؛ لم يتم تأكيد العملية.");
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
    if (!policies.ok) return failure("تعذر قراءة سلسلة سياسة الاستحقاق.");
    const repeated = policies.value.find(policy => policy.idempotencyKey === input.idempotencyKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    const previous = policies.value.find(policy => policy.id === policyId);
    if (!previous)
      return { ok: false, code: "validation_error", message: "لم نجد السياسة الأصلية لإنشاء خليفة لها." };
    if (previous.status !== "active")
      return {
        ok: false,
        code: "validation_error",
        message: "لا يمكن إنشاء خليفة من سياسة منتهية؛ اختر النسخة الفعالة الأخيرة.",
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
        message: "تاريخ نفاذ الخليفة يجب أن يكون محليًا وبعد بداية السياسة الأصلية.",
      };
    if (previous.endsOn !== null && input.startsOn > dayAfter(previous.endsOn))
      return {
        ok: false,
        code: "validation_error",
        message:
          "تاريخ الخليفة يتجاوز نهاية السياسة الأصلية ويترك فجوة؛ اختر تاريخ النهاية التالي أو أنشئ سياسة مستقلة.",
      };
    if (!input.source.trim() || !input.note.trim())
      return { ok: false, code: "validation_error", message: "سبب التعديل وملاحظة الخليفة إلزاميان." };
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
        message: "توجد نسخة لاحقة في السلسلة من هذا التاريخ؛ لا ينشئ النظام خليفة متداخلًا.",
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
          message: "تاريخ نفاذ الخليفة يقع قبل بداية السياسة الأصلية؛ لم تتغير السلسلة.",
        };
      const saved = await this.store.commitOwnerEntitlementPolicySuccessor(ended, successor);
      return saved.ok
        ? { ok: true, value: saved.value.successor }
        : failure("تعذر حفظ خليفة السياسة ذريًا؛ بقيت السلسلة دون تغيير.");
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      const message = raw.includes("fixed_period")
        ? "الخليفة من نوع مبلغ ثابت للفترة تحتاج تاريخ نهاية معلنًا."
        : raw.includes("unitLabel")
          ? "الخليفة لكل وحدة أو عمل مكتمل تحتاج تسمية وحدة صريحة."
          : raw.includes("percentageBps")
            ? "أدخل نسبة صحيحة بين 0.01% و100%."
            : raw.includes("amountMinor")
              ? "أدخل مبلغًا موجبًا بوحدة JOD minor."
              : raw.includes("policy kind")
                ? "نوع الخليفة غير مدعوم أو لا يملك دليلًا مكتملًا في هذا الإصدار."
                : "بيانات خليفة السياسة غير صالحة؛ لم تتغير النسخة السابقة.";
      return { ok: false, code: "validation_error", message };
    }
  }

  async calculate(
    policyId: string,
    periodFrom: string,
    periodTo: string,
  ): Promise<OwnerEntitlementResult<ReturnType<typeof calculateOwnerEntitlement>>> {
    const policy = await this.store.getOwnerEntitlementPolicy(policyId);
    if (!policy.ok) return failure("تعذر قراءة سياسة الاستحقاق.");
    if (!policy.value)
      return { ok: false, code: "validation_error", message: "لم نجد سياسة الاستحقاق المطلوبة." };
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
        deliveredOn: stored.order.events.find(
          event => event.type === "status_changed" && event.toStatus === "delivered",
        )?.createdAt
          ? ammanDate(
              stored.order.events.find(
                event => event.type === "status_changed" && event.toStatus === "delivered",
              )!.createdAt,
            )
          : null,
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
        message: error instanceof Error ? error.message : "تعذر حساب الاستحقاق.",
      };
    }
  }

  async recordEntitlement(
    input: OwnerEntitlementRecordInput,
  ): Promise<OwnerEntitlementResult<OwnerEntitlementRecord>> {
    const existing = await this.store.listOwnerEntitlementRecords();
    if (!existing.ok) return failure("تعذر التحقق من استحقاقات المالك.");
    const repeated = existing.value.find(record => record.idempotencyKey === input.idempotencyKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    const policy = await this.store.getOwnerEntitlementPolicy(input.policyId);
    if (!policy.ok) return failure("تعذر قراءة سياسة الاستحقاق.");
    if (!policy.value) return { ok: false, code: "validation_error", message: "اختر سياسة استحقاق موجودة." };
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
          "يوجد استحقاق نشط يغطي المصدر أو الفترة نفسها؛ لم يتكرر الحق. اعكس السجل السابق أولًا إذا كان خطأ.",
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
      return saved.ok ? { ok: true, value: saved.value } : failure("تعذر حفظ الاستحقاق؛ لم يتغير الكاش.");
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات الاستحقاق غير صالحة.",
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
    if (!records.ok || !movements.ok) return failure("تعذر قراءة سجل الاستحقاق.");
    const repeated = records.value.find(
      record => record.reversalOfId !== null && record.idempotencyKey === input.idempotencyKey,
    );
    if (repeated) return { ok: true, value: repeated, reused: true };
    const source = records.value.find(record => record.id === input.recordId);
    if (!source) return { ok: false, code: "validation_error", message: "لم نجد سجل الاستحقاق الأصلي." };
    if (source.reversalOfId) return { ok: false, code: "validation_error", message: "لا يمكن عكس عكس سابق." };
    if (records.value.some(record => record.reversalOfId === source.id))
      return {
        ok: false,
        code: "validation_error",
        message: "عُكس هذا الاستحقاق سابقًا؛ لا يُنشأ عكس ثانٍ.",
      };
    if (activeOriginals(movements.value).some(movement => movement.relatedEntitlementId === source.id))
      return {
        ok: false,
        code: "validation_error",
        message: "اعكس أو سوِّ حركات هذا الاستحقاق أولًا؛ لا نترك مصدرًا مسجلًا بلا رصيد متوازن.",
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
        : failure("تعذر حفظ عكس الاستحقاق؛ بقي الأصل محفوظًا.");
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات عكس الاستحقاق غير صالحة.",
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
        message: "يوجد رصيد افتتاحي فعال؛ اعكسه أو صححه قبل إضافة طبقة افتتاحية جديدة.",
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
    if (source.reversalOfId) return { ok: false, code: "validation_error", message: "لا يمكن عكس عكس سابق." };
    if (balances.value.some(balance => balance.reversalOfId === source.id))
      return {
        ok: false,
        code: "validation_error",
        message: "عُكس هذا الرصيد الافتتاحي سابقًا؛ لا يُنشأ عكس ثانٍ.",
      };
    if (activeOriginals(movements.value).some(movement => movement.relatedOpeningBalanceId === source.id))
      return {
        ok: false,
        code: "validation_error",
        message: "اعكس أو سوِّ حركات هذا الافتتاح أولًا؛ لا نترك مصدرًا مسجلًا بلا رصيد متوازن.",
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
        : failure("تعذر حفظ عكس الرصيد الافتتاحي؛ بقي الأصل محفوظًا.");
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات عكس الرصيد الافتتاحي غير صالحة.",
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
          message: "اختر استحقاقًا مسجلًا وفعالًا لتسويته؛ لا تخمن السبب.",
        };
      const entitlement = activeEntitlementRecords.find(record => record.id === input.relatedEntitlementId)!;
      const settled = movements.value
        .filter(movement => movement.relatedEntitlementId === entitlement.id)
        .reduce((sum, movement) => sum + movement.entitlementDeltaMinor, 0);
      if (input.amountMinor > entitlement.amountMinor + settled)
        return {
          ok: false,
          code: "validation_error",
          message: "لا يمكن أن يتجاوز السحب استحقاق هذا السجل المتبقي.",
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
          message: "اختر رصيدًا افتتاحيًا فعالًا؛ لا تسوِّ مصدرًا معكوسًا.",
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
    if (source.reversalOfId) return { ok: false, code: "validation_error", message: "لا يمكن عكس عكس سابق." };
    if (movements.value.some(movement => movement.reversalOfId === source.id))
      return { ok: false, code: "validation_error", message: "عُكست هذه الحركة سابقًا؛ لا يُنشأ عكس ثانٍ." };
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
        reason: `عكس حركة مالك: ${input.reason}`,
        operationKey: `owner-movement:${input.idempotencyKey}`,
      });
      const saved = await this.store.commitOwnerMovement(reversal, cashEntry);
      return saved.ok
        ? { ok: true, value: saved.value.movement }
        : failure("تعذر حفظ عكس حركة المالك والكاش ذريًا؛ بقي الأصل محفوظًا.");
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات عكس الحركة غير صالحة.",
      };
    }
  }
}
