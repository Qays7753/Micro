import {
  calculateAllocationPolicy,
  createAllocationPolicy,
  createAllocationPolicySuccessor,
  isAllocationPolicyEffective,
  type AllocationCalculation,
  type AllocationPolicy,
  type AllocationPolicyKind,
  type AllocationPolicyTerms,
} from "@micro-domain/recurring-margin/index.js";
import type { AllocationEvidence } from "@micro-domain/recurring-margin/index.js";
import type { InventoryMovement, WasteContext } from "@micro-domain/inventory-material/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { localDateInAmman as ammanDate } from "@/presentation/formatters";

export type RecurringWorkFailure = {
  ok: false;
  code: "validation_error" | "storage_error" | "not_found";
  message: string;
};
export type RecurringWorkResult<T> = { ok: true; value: T; reused?: boolean } | RecurringWorkFailure;
export type RecurringWorkPolicyInput = {
  catalogItemId: string;
  kind: AllocationPolicyKind;
  amountMinor: number | null;
  rateMinor: number | null;
  rateMinorPerWholeUnit?: number | null;
  percentageBps: number | null;
  unitId: string | null;
  periodFrom: string;
  periodTo: string;
  startsOn: string;
  endsOn: string | null;
  source: string;
  reason: string;
  note: string;
  idempotencyKey: string;
};
export type RecurringWorkPolicySuccessorInput = Omit<
  RecurringWorkPolicyInput,
  "catalogItemId" | "startsOn" | "endsOn" | "idempotencyKey"
> & { startsOn: string; endsOn: string | null; idempotencyKey: string };
export type RecurringWorkWasteSummary = {
  orderWasteMinor: number;
  catalogItemWasteMinor: number;
  catalogTemplateWasteMinor: number;
  generalProjectWasteMinor: number;
  unallocatedWasteMinor: number;
  totalWasteMinor: number;
  recordedCount: number;
};
export type RecurringWorkTimeSummary = {
  recordedOrderCount: number;
  notRecordedOrderCount: number;
  needsReviewOrderCount: number;
  plannedMinutes: number;
  actualMinutes: number | null;
  varianceMinutes: number | null;
};
export type RecurringWorkMaterialSummary = {
  recordedOrderCount: number;
  notRecordedOrderCount: number;
  needsReviewOrderCount: number;
  plannedMaterialMinor: number;
  actualMaterialMinor: number | null;
  varianceMinor: number | null;
};
export type RecurringWorkReading = {
  catalogItemId: string;
  periodFrom: string;
  periodTo: string;
  finalOrderCount: number;
  deliveredQuantity: number;
  outputQuantityMilli: number | null;
  recognizedRevenueMinor: number | null;
  recognizedDirectCostMinor: number | null;
  directMarginMinor: number | null;
  directStatus: "recorded" | "not_recorded";
  material: RecurringWorkMaterialSummary;
  time: RecurringWorkTimeSummary;
  waste: RecurringWorkWasteSummary;
  policies: readonly AllocationPolicy[];
  allocation: AllocationCalculation | null;
  reasons: readonly string[];
  nextAction: string;
};
export type RecurringWorkReadings = {
  from: string;
  to: string;
  items: readonly RecurringWorkReading[];
};

const id = (prefix: string) =>
  globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const failure = <T>(
  message: string,
  code: RecurringWorkFailure["code"] = "storage_error",
): RecurringWorkResult<T> => ({ ok: false, code, message });
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
const activeMovements = (movements: readonly InventoryMovement[]) => {
  const reversed = new Set(
    movements
      .filter(movement => movement.type === "reversal" && movement.reversesMovementId)
      .map(movement => movement.reversesMovementId),
  );
  return movements.filter(movement => movement.type !== "reversal" && !reversed.has(movement.id));
};
const wasteValue = (context: WasteContext | null) =>
  context?.kind === "unallocated" ||
  context?.kind === "general_project" ||
  context?.kind === "order" ||
  context?.kind === "catalog_item" ||
  context?.kind === "catalog_template";
const toQuantityMilli = (quantity: number): number | null => {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const quantityMilli = quantity * 1000;
  return Number.isSafeInteger(quantityMilli) && Math.abs(quantity - quantityMilli / 1000) < Number.EPSILON
    ? quantityMilli
    : null;
};
const sumSafeIntegers = (values: readonly number[]): number | null => {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0 || total > Number.MAX_SAFE_INTEGER - value) return null;
    total += value;
  }
  return total;
};

export class RecurringWorkService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async createPolicy(input: RecurringWorkPolicyInput): Promise<RecurringWorkResult<AllocationPolicy>> {
    const [item, policies] = await Promise.all([
      this.store.getCatalogItem(input.catalogItemId),
      this.store.listAllocationPolicies(input.catalogItemId),
    ]);
    if (!item.ok || !policies.ok) return failure("تعذر قراءة مرجع العمل أو سياسات التوزيع.");
    if (!item.value) return failure("مرجع العمل غير موجود؛ لا يمكن ربط سياسة توزيع به.", "not_found");
    const repeated = policies.value.find(policy => policy.idempotencyKey === input.idempotencyKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    if (
      policies.value.some(
        policy =>
          policy.status === "active" &&
          rangesOverlap(policy.periodFrom, policy.periodTo, input.periodFrom, input.periodTo),
      )
    )
      return failure(
        "توجد سياسة توزيع فعالة في النطاق نفسه؛ أنهِها أو أنشئ نطاقًا مستقلًا بوضوح.",
        "validation_error",
      );
    try {
      const policy = createAllocationPolicy({
        id: id("allocation-policy"),
        seriesId: id("allocation-series"),
        successorOfPolicyId: null,
        version: 1,
        status: "active",
        createdAt: this.now(),
        updatedAt: this.now(),
        ...input,
      });
      const saved = await this.store.saveAllocationPolicy(policy);
      return saved.ok
        ? { ok: true, value: saved.value }
        : failure("تعذر حفظ سياسة التوزيع؛ لم يتغير أي أثر مالي.");
    } catch (error) {
      return failure(
        error instanceof Error ? error.message : "بيانات سياسة التوزيع غير صالحة.",
        "validation_error",
      );
    }
  }

  async createPolicySuccessor(
    policyId: string,
    input: RecurringWorkPolicySuccessorInput,
  ): Promise<RecurringWorkResult<AllocationPolicy>> {
    const policies = await this.store.listAllocationPolicies();
    if (!policies.ok) return failure("تعذر قراءة سياسات التوزيع.");
    const repeated = policies.value.find(policy => policy.idempotencyKey === input.idempotencyKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    const previous = policies.value.find(policy => policy.id === policyId);
    if (!previous) return failure("لم نجد سياسة التوزيع الأصلية.", "not_found");
    if (previous.status !== "active")
      return failure("لا يمكن إنشاء نسخة جديدة لسياسة غير فعالة.", "validation_error");
    if (!localDate(input.startsOn) || input.startsOn <= previous.startsOn)
      return failure("تاريخ نفاذ النسخة الجديدة يجب أن يكون بعد النسخة السابقة.", "validation_error");
    if (previous.endsOn !== null && input.startsOn !== dayAfter(previous.endsOn))
      return failure("تاريخ النسخة الجديدة يجب أن يتبع نهاية النسخة السابقة مباشرة.", "validation_error");
    if (
      policies.value.some(
        policy =>
          policy.id !== previous.id &&
          policy.seriesId === previous.seriesId &&
          policy.startsOn >= input.startsOn,
      )
    )
      return failure("توجد نسخة لاحقة لهذه السياسة؛ لا ينشئ النظام نسخة متداخلة.", "validation_error");
    try {
      const successor = createAllocationPolicySuccessor(previous, {
        ...previous,
        ...input,
        id: id("allocation-policy"),
        seriesId: previous.seriesId,
        successorOfPolicyId: previous.id,
        version: previous.version + 1,
        status: "active",
        endsOn: input.endsOn,
        createdAt: this.now(),
        updatedAt: this.now(),
      } as AllocationPolicy &
        AllocationPolicyTerms & {
          id: string;
          seriesId: string;
          successorOfPolicyId: string;
          version: number;
          status: "active";
          idempotencyKey: string;
          createdAt: string;
          updatedAt: string;
        });
      const ended = createAllocationPolicy({
        ...previous,
        endsOn: dayBefore(input.startsOn),
        status: "inactive",
        updatedAt: this.now(),
      });
      const saved = await this.store.commitAllocationPolicySuccessor(ended, successor);
      return saved.ok
        ? { ok: true, value: saved.value.successor }
        : failure("تعذر حفظ النسخة الجديدة من سياسة التوزيع ذريًا؛ بقيت النسخة السابقة كما هي.");
    } catch (error) {
      return failure(
        error instanceof Error ? error.message : "بيانات النسخة الجديدة من سياسة التوزيع غير صالحة.",
        "validation_error",
      );
    }
  }

  async deactivatePolicy(policyId: string): Promise<RecurringWorkResult<AllocationPolicy>> {
    const policy = await this.store.getAllocationPolicy(policyId);
    if (!policy.ok) return failure("تعذر قراءة سياسة التوزيع.");
    if (!policy.value) return failure("سياسة التوزيع غير موجودة.", "not_found");
    if (policy.value.status === "inactive") return { ok: true, value: policy.value };
    const saved = await this.store.saveAllocationPolicy({
      ...policy.value,
      status: "inactive",
      updatedAt: this.now(),
    });
    return saved.ok ? { ok: true, value: saved.value } : failure("تعذر إيقاف سياسة التوزيع.");
  }

  async readRecurringWork(from: string, to: string): Promise<RecurringWorkResult<RecurringWorkReadings>> {
    if (!localDate(from) || !localDate(to) || from > to)
      return failure("حدود الفترة المحلية غير صالحة.", "validation_error");
    const [catalog, orders, movements, timeRecords, policies] = await Promise.all([
      this.store.listCatalogItems(),
      this.store.listOrders(),
      this.store.listInventoryMovements(),
      this.store.listActualTimeRecords(),
      this.store.listAllocationPolicies(),
    ]);
    if (!catalog.ok || !orders.ok || !movements.ok || !timeRecords.ok || !policies.ok)
      return failure("تعذر قراءة مرجع العمل أو أدلة الوقت والهدر وسياسات التوزيع.");
    const active = activeMovements(movements.value);
    const reversedTime = new Set(
      timeRecords.value.filter(record => record.reversalOfId !== null).map(record => record.reversalOfId),
    );
    const activeTime = timeRecords.value.filter(
      record => record.minutesDelta > 0 && !reversedTime.has(record.id),
    );
    const items = catalog.value.map(item => {
      const deliveredOrdersInPeriod = orders.value
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
          candidate =>
            candidate.stored.catalogItemId === item.id &&
            candidate.deliveredOn !== null &&
            candidate.deliveredOn >= from &&
            candidate.deliveredOn <= to,
        );
      const finalOrders = deliveredOrdersInPeriod.filter(
        candidate => candidate.stored.order.resultStatus === "final",
      );
      const finalOrderIds = new Set(finalOrders.map(candidate => candidate.stored.id));
      const excludedOrderIds = deliveredOrdersInPeriod
        .filter(candidate => candidate.stored.order.resultStatus !== "final")
        .map(candidate => candidate.stored.id);
      const plannedMaterialMinor = finalOrders.reduce(
        (sum, candidate) => sum + candidate.stored.order.costSnapshot.materialCostMinor,
        0,
      );
      const plannedMinutes = finalOrders.reduce(
        (sum, candidate) => sum + (candidate.stored.order.costSnapshot.input.time?.minutes ?? 0),
        0,
      );
      let actualMaterialMinor = 0;
      let actualQuantityMilli = 0;
      const recordedOrderIds = new Set<string>();
      for (const movement of active)
        if (movement.type === "consumption" && movement.orderId && finalOrderIds.has(movement.orderId)) {
          actualMaterialMinor += Math.abs(movement.valueDeltaMinor);
          actualQuantityMilli += Math.abs(movement.quantityDeltaMilli);
          recordedOrderIds.add(movement.orderId);
        }
      const needsReviewMaterial = finalOrders.filter(
        candidate =>
          recordedOrderIds.has(candidate.stored.id) &&
          candidate.stored.order.costSnapshot.knowledgeState !== "known",
      ).length;
      const material: RecurringWorkMaterialSummary = {
        recordedOrderCount: recordedOrderIds.size,
        notRecordedOrderCount: finalOrders.length - recordedOrderIds.size,
        needsReviewOrderCount: needsReviewMaterial,
        plannedMaterialMinor,
        actualMaterialMinor: recordedOrderIds.size ? actualMaterialMinor : null,
        varianceMinor:
          recordedOrderIds.size === finalOrders.length && recordedOrderIds.size > 0
            ? actualMaterialMinor - plannedMaterialMinor
            : null,
      };
      let actualMinutes = 0;
      let timeRecordedOrderCount = 0;
      let timeNeedsReviewOrderCount = 0;
      const missingTimeOrderIds: string[] = [];
      for (const candidate of finalOrders) {
        const records = activeTime.filter(record => record.orderId === candidate.stored.id);
        if (records.length === 0) {
          missingTimeOrderIds.push(candidate.stored.id);
          continue;
        }
        timeRecordedOrderCount += 1;
        actualMinutes += records.reduce((sum, record) => sum + record.minutesDelta, 0);
        if (
          candidate.stored.order.costSnapshot.input.time?.minutes === null ||
          candidate.stored.order.costSnapshot.knowledgeState !== "known"
        )
          timeNeedsReviewOrderCount += 1;
      }
      const time: RecurringWorkTimeSummary = {
        recordedOrderCount: timeRecordedOrderCount,
        notRecordedOrderCount: missingTimeOrderIds.length,
        needsReviewOrderCount: timeNeedsReviewOrderCount,
        plannedMinutes,
        actualMinutes: timeRecordedOrderCount ? actualMinutes : null,
        varianceMinutes:
          timeRecordedOrderCount && missingTimeOrderIds.length === 0 ? actualMinutes - plannedMinutes : null,
      };
      const waste: RecurringWorkWasteSummary = {
        orderWasteMinor: 0,
        catalogItemWasteMinor: 0,
        catalogTemplateWasteMinor: 0,
        generalProjectWasteMinor: 0,
        unallocatedWasteMinor: 0,
        totalWasteMinor: 0,
        recordedCount: 0,
      };
      for (const movement of active) {
        if (movement.type !== "waste" || !movement.wasteContext || !wasteValue(movement.wasteContext))
          continue;
        const value = Math.abs(movement.valueDeltaMinor);
        const context = movement.wasteContext;
        let include = false;
        if (context.kind === "order" && finalOrderIds.has(context.orderId)) {
          waste.orderWasteMinor += value;
          include = true;
        }
        if (context.kind === "catalog_item" && context.catalogItemId === item.id) {
          waste.catalogItemWasteMinor += value;
          include = true;
        }
        if (context.kind === "catalog_template" && context.catalogItemId === item.id) {
          waste.catalogTemplateWasteMinor += value;
          include = true;
        }
        if (context.kind === "general_project") waste.generalProjectWasteMinor += value;
        if (context.kind === "unallocated") waste.unallocatedWasteMinor += value;
        if (include) waste.recordedCount += 1;
      }
      waste.totalWasteMinor =
        waste.orderWasteMinor +
        waste.catalogItemWasteMinor +
        waste.catalogTemplateWasteMinor +
        waste.generalProjectWasteMinor +
        waste.unallocatedWasteMinor;
      const directMarginMinor = finalOrders.length
        ? finalOrders.reduce(
            (sum, candidate) =>
              sum +
              candidate.stored.order.recognizedRevenueMinor -
              candidate.stored.order.recognizedCostMinor,
            0,
          )
        : null;
      const activePolicies = policies.value.filter(
        policy => policy.status === "active" && isAllocationPolicyEffective(policy, item.id, from, to),
      );
      const quantityMillis = finalOrders.map(candidate => toQuantityMilli(candidate.stored.order.quantity));
      const outputQuantityMilli =
        finalOrders.length && quantityMillis.every((value): value is number => value !== null)
          ? sumSafeIntegers(quantityMillis as number[])
          : null;
      const evidence: AllocationEvidence = {
        catalogItemId: item.id,
        periodFrom: from,
        periodTo: to,
        finalOrderIds: finalOrders.map(candidate => candidate.stored.id),
        excludedOrderIds,
        outputQuantityMilli,
        outputUnitId: finalOrders.length ? (item.unitId ?? null) : null,
        actualTimeMinutes: timeRecordedOrderCount ? actualMinutes : null,
        missingTimeOrderIds,
        recognizedRevenueMinor: finalOrders.length
          ? finalOrders.reduce((sum, candidate) => sum + candidate.stored.order.recognizedRevenueMinor, 0)
          : null,
        missingRevenueOrderIds: [],
        directMarginMinor: directMarginMinor ?? 0,
      };
      const allocation =
        activePolicies.length === 1 ? calculateAllocationPolicy(activePolicies[0]!, evidence) : null;
      const reasons = [
        ...(excludedOrderIds.length
          ? ["طلبات مستبعدة"]
          : []),
        ...(material.notRecordedOrderCount ? ["مادة غير مسجلة"] : []),
        ...(time.notRecordedOrderCount ? ["لم تسجل وقتًا فعليًا لبعض الطلبات؛ هذا لا يعني صفر وقت."] : []),
        ...(waste.totalWasteMinor
          ? ["هدر مسجل"]
          : []),
        ...(activePolicies.length > 1
          ? ["سياسات متداخلة"]
          : []),
      ];
      const nextAction =
        allocation?.status === "known"
          ? allocation.nextAction
          : material.notRecordedOrderCount > 0
            ? "سجل المادة الفعلية"
            : activePolicies.length === 0
              ? "بلا سياسة توزيع"
              : (allocation?.nextAction ??
                "راجع السياسة والدليل");
      return {
        catalogItemId: item.id,
        periodFrom: from,
        periodTo: to,
        finalOrderCount: finalOrders.length,
        deliveredQuantity: finalOrders.reduce((sum, candidate) => sum + candidate.stored.order.quantity, 0),
        outputQuantityMilli,
        recognizedRevenueMinor:
          directMarginMinor === null
            ? null
            : finalOrders.reduce((sum, candidate) => sum + candidate.stored.order.recognizedRevenueMinor, 0),
        recognizedDirectCostMinor:
          directMarginMinor === null
            ? null
            : finalOrders.reduce((sum, candidate) => sum + candidate.stored.order.recognizedCostMinor, 0),
        directMarginMinor,
        directStatus: directMarginMinor === null ? "not_recorded" : "recorded",
        material,
        time,
        waste,
        policies: policies.value.filter(policy => policy.catalogItemId === item.id),
        allocation,
        reasons,
        nextAction,
      } satisfies RecurringWorkReading;
    });
    return {
      ok: true,
      value: {
        from,
        to,
        items,
      },
    };
  }
}
