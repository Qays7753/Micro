/**
 * المجموعة ٤ (عقد ٢٩): خدمة تصنيف العربون المحتفظ به — الافتراضي الآمن
 * «معلق» يبقى ظاهرًا حتى يختار المالك: مال مالك أو إيراد مشروع. القرار
 * حدث مالي مرتبط بالطلب يُكتب ذرّيًا مع الطلب؛ لا كاش جديد ولا إيراد مزدوج
 * — الكاش دخل سابقًا عند التحصيل. التصحيح عكس + بديل موثق قابل للتتبع.
 */
import {
  createFinancialEvent,
  createFinancialReversal,
  type FinancialEvent,
  type FinancialEventType,
} from "@micro-domain/financial-event/index.js";
import {
  classifyRetainedDeposit,
  reclassifyRetainedDeposit,
  type RetainedDepositMeaning,
} from "@micro-domain/craft-order/index.js";
import type { PrototypeLocalStore, StoredCraftOrder } from "@/storage/local/types";

export type RetainedDepositRow = {
  orderId: string;
  customerName: string;
  depositMinor: number;
  decision: "pending" | "owner" | "revenue";
};

export type RetainedDepositResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: "storage_error" | "invalid_state" | "validation_error"; message: string };

function failure(code: "storage_error" | "invalid_state" | "validation_error", message: string) {
  return { ok: false as const, code, message };
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function classificationEventId(events: readonly FinancialEvent[], orderId: string): string | null {
  /* آخر تصنيف نشط غير معكوس للطلب. */
  const reversed = new Set(
    events.flatMap(event =>
      event.correctionType === "reverse" && event.correctionOfEventId ? [event.correctionOfEventId] : [],
    ),
  );
  const candidates = events
    .filter(
      event =>
        event.depositContext?.orderId === orderId &&
        event.correctionType !== "reverse" &&
        !reversed.has(event.id),
    )
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
  return candidates[0]?.id ?? null;
}

export class RetainedDepositService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async listPending(): Promise<RetainedDepositResult<readonly RetainedDepositRow[]>> {
    const ordersResult = await this.store.listOrders();
    if (!ordersResult.ok) return failure("storage_error", "تعذر قراءة الطلبات المحلية.");
    return {
      ok: true,
      value: ordersResult.value
        .filter(
          stored =>
            stored.order.status === "cancelled" &&
            stored.order.depositSettlement === "retain_deposit" &&
            (stored.order.retainedMeaning ?? null) === null,
        )
        .map(stored => ({
          orderId: stored.id,
          customerName: stored.order.customerName,
          depositMinor: stored.order.depositCollectedMinor,
          decision: stored.order.retainedMeaning ?? "pending",
        })),
    };
  }

  async classify(
    orderId: string,
    meaning: RetainedDepositMeaning,
    reason: string,
  ): Promise<RetainedDepositResult<{ order: StoredCraftOrder; event: FinancialEvent }>> {
    const ordersResult = await this.store.getOrder(orderId);
    if (!ordersResult.ok) return failure("storage_error", "تعذر قراءة الطلب المحلي.");
    const stored = ordersResult.value;
    if (!stored) return failure("invalid_state", "الطلب غير متاح محليًا.");
    const eventsResult = await this.store.listFinancialEvents();
    if (!eventsResult.ok) return failure("storage_error", "تعذر قراءة سجل الأحداث المالية.");
    if (classificationEventId(eventsResult.value, orderId))
      return failure("invalid_state", "هذا العربون مصنَّف سابقًا — صحِّحه بقرار موثق.");
    try {
      const now = this.now();
      const eventType: FinancialEventType =
        meaning === "owner" ? "deposit_retained_owner" : "deposit_retained_revenue";
      const event = createFinancialEvent({
        id: newId("event"),
        type: eventType,
        amountMinor: stored.order.depositCollectedMinor,
        occurredOn: now.slice(0, 10),
        recordedAt: now,
        idempotencyKey: `${orderId}:deposit-classify:${now}`,
        note: `تصنيف عربون محتفظ به (${meaning === "owner" ? "مال مالك" : "إيراد مشروع"}): ${reason.trim()}`,
        counterparty: stored.order.customerName,
        depositContext: { orderId },
      });
      const order = classifyRetainedDeposit(stored.order, meaning, reason, `${orderId}:classify:${now}`, now);
      const commit = await this.store.commitDepositClassification(
        { ...stored, order, updatedAt: now },
        event,
      );
      if (!commit.ok) return failure("storage_error", commit.message);
      return { ok: true, value: { order: commit.value.order, event: commit.value.event } };
    } catch (error) {
      return failure("validation_error", error instanceof Error ? error.message : "تصنيف العربون غير صالح.");
    }
  }

  async reclassify(
    orderId: string,
    meaning: RetainedDepositMeaning,
    reason: string,
  ): Promise<
    RetainedDepositResult<{ order: StoredCraftOrder; reversal: FinancialEvent; replacement: FinancialEvent }>
  > {
    const ordersResult = await this.store.getOrder(orderId);
    if (!ordersResult.ok) return failure("storage_error", "تعذر قراءة الطلب المحلي.");
    const stored = ordersResult.value;
    if (!stored) return failure("invalid_state", "الطلب غير متاح محليًا.");
    const eventsResult = await this.store.listFinancialEvents();
    if (!eventsResult.ok) return failure("storage_error", "تعذر قراءة سجل الأحداث المالية.");
    const sourceId = classificationEventId(eventsResult.value, orderId);
    if (!sourceId) return failure("invalid_state", "لا تصنيف قائم يُصحَّح — سجِّل تصنيفًا أولًا.");
    const source = eventsResult.value.find(event => event.id === sourceId)!;
    try {
      const now = this.now();
      const reversal = createFinancialReversal({
        id: newId("event"),
        sourceEvent: source,
        occurredOn: now.slice(0, 10),
        recordedAt: now,
        idempotencyKey: `${orderId}:deposit-reclassify-reversal:${now}`,
        reason,
      });
      const eventType: FinancialEventType =
        meaning === "owner" ? "deposit_retained_owner" : "deposit_retained_revenue";
      const replacement = createFinancialEvent({
        id: newId("event"),
        type: eventType,
        amountMinor: stored.order.depositCollectedMinor,
        occurredOn: now.slice(0, 10),
        recordedAt: now,
        idempotencyKey: `${orderId}:deposit-reclassify-replacement:${now}`,
        note: `تصحيح تصنيف عربون محتفظ به (${meaning === "owner" ? "مال مالك" : "إيراد مشروع"}): ${reason.trim()}`,
        counterparty: stored.order.customerName,
        depositContext: { orderId },
      });
      const order = reclassifyRetainedDeposit(stored.order, meaning, reason, `${orderId}:reclassify:${now}`, now);
      const commit = await this.store.commitDepositClassificationCorrection(
        { ...stored, order, updatedAt: now },
        reversal,
        replacement,
      );
      if (!commit.ok) return failure("storage_error", commit.message);
      return {
        ok: true,
        value: { order: commit.value.order, reversal: commit.value.reversal, replacement: commit.value.replacement },
      };
    } catch (error) {
      return failure("validation_error", error instanceof Error ? error.message : "تصحيح التصنيف غير صالح.");
    }
  }
}
