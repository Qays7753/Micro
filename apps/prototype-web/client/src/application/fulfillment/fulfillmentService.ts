/** Slice 4 financial boundary: delivery, collection, and debt are three distinct Domain operations. */
import {
  cancelOrder,
  collectRegisteredDebt,
  collectRemaining,
  registerDebt,
  reviseAgreedPrice,
  reverseOrderCollection,
  settleDepositRefund,
  settleDepositRetain,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import type { StoredCraftOrder, PrototypeLocalStore } from "@/storage/local/types";

export type FulfillmentResult =
  | { ok: true; stored: StoredCraftOrder }
  | { ok: false; code: "storage_error" | "invalid_state"; message: string };
export type DepositRow = {
  orderId: string;
  itemName: string;
  customerName: string;
  depositCollectedMinor: number;
  settlementStatus: StoredCraftOrder["order"]["settlementStatus"];
  depositSettlement: StoredCraftOrder["order"]["depositSettlement"];
};
export type DepositOverview = {
  deposits: readonly DepositRow[];
  collectedTotalMinor: number;
  awaitingSettlementCount: number;
};
const success = (stored: StoredCraftOrder): FulfillmentResult => ({ ok: true, stored });
const failure = (
  code: Extract<FulfillmentResult, { ok: false }>["code"],
  message: string,
): FulfillmentResult => ({ ok: false, code, message });

export class FulfillmentService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly schedules: ScheduleService = new ScheduleService(store, now),
  ) {}

  private async load(id: string): Promise<FulfillmentResult> {
    const result = await this.store.getOrder(id);
    if (!result.ok) return failure("storage_error", "تعذر قراءة الطلب المحلي.");
    if (!result.value) return failure("invalid_state", "الطلب غير متاح محليًا.");
    return success(result.value);
  }

  private async persist(stored: StoredCraftOrder): Promise<FulfillmentResult> {
    const result = await this.store.saveOrder(stored);
    return result.ok
      ? success(result.value)
      : failure("storage_error", "تعذر حفظ التغيير. لم يتم تأكيد نجاح العملية.");
  }

  async markReady(id: string): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    if (["ready", "delivered", "settled"].includes(current.stored.order.status)) return current;
    if (current.stored.order.status !== "in_progress")
      return failure("invalid_state", "لا يمكن تسجيل الجاهزية من حالة الطلب الحالية.");
    try {
      const timestamp = this.now();
      const order = transitionOrder(current.stored.order, {
        to: "ready",
        idempotencyKey: `${id}:mark-ready`,
        createdAt: timestamp,
      });
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسجيل الجاهزية.");
    }
  }

  async deliver(id: string): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    if (
      ["delivered", "settled"].includes(current.stored.order.status) &&
      current.stored.order.events.some(
        event => event.type === "status_changed" && event.toStatus === "delivered",
      )
    )
      return current;
    if (current.stored.order.status !== "ready")
      return failure("invalid_state", "لا يمكن تسجيل التسليم قبل أن يصبح الطلب جاهزًا.");
    try {
      const timestamp = this.now();
      const order = transitionOrder(current.stored.order, {
        to: "delivered",
        idempotencyKey: `${id}:deliver`,
        createdAt: timestamp,
      });
      const saved = await this.persist({ ...current.stored, order, updatedAt: timestamp });
      if (saved.ok) await this.schedules.reconcileDelivery(id);
      return saved;
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسجيل التسليم.");
    }
  }

  async collectFullRemaining(id: string): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    if (current.stored.order.status === "settled" && current.stored.order.settlementStatus === "paid")
      return current;
    if (current.stored.order.status !== "delivered")
      return failure("invalid_state", "التحصيل المتبقي يتطلب تسجيل التسليم أولًا.");
    if (current.stored.order.receivableMinor <= 0)
      return failure("invalid_state", "لا يوجد مبلغ متبقٍ لتحصيله.");
    try {
      const timestamp = this.now();
      const amount = current.stored.order.receivableMinor;
      const order = collectRemaining(current.stored.order, amount, `${id}:collect-full-${amount}`, timestamp);
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسجيل التحصيل.");
    }
  }

  /* §٥-١٦ (المرحلة أ — رحلة ٢): الدين المسجل قابل للتحصيل لاحقًا. المبلغ هو
   * الحقل الوحيد؛ التحصيل يقلل الدين ولا يعيد فتح الطلب. */
  async collectDebt(id: string, amountMinor: number): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    if (current.stored.order.settlementStatus !== "debt" || current.stored.order.receivableMinor <= 0)
      return current; // لا دين مسجل: لا شيء يُفعل
    if (current.stored.order.status === "cancelled") return current;
    try {
      const timestamp = this.now();
      const order = collectRegisteredDebt(
        current.stored.order,
        amountMinor,
        `${id}:debt-collect-${amountMinor}-${timestamp}`,
        timestamp,
      );
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسجيل تحصيل الدين.");
    }
  }

  /* المجموعة ٢ (§6.1): ورقة التحصيل تستدعي هذا المسار الواحد — يختار دالة النطاق
   * الصحيحة بحسب حالة الطلب (دين مسجل أو متبقٍ بعد التسليم) ويكتب تحصيلًا واحدًا
   * موثقًا. لا يُنشئ إيرادًا ولا يلمس النتيجة — التحصيل كاش ومتبقٍ فقط. */
  async collectFromSheet(
    id: string,
    amountMinor: number,
    operationKey: string,
  ): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    const order = current.stored.order;
    if (order.status === "cancelled") return failure("invalid_state", "طلب ملغى لا يُحصّل منه.");
    if (order.settlementStatus === "debt" && order.receivableMinor > 0)
      return this.collectDebt(id, amountMinor);
    if (order.status === "delivered") {
      if (order.receivableMinor <= 0)
        return failure("invalid_state", "لا يوجد مبلغ متبقٍ لتحصيله على هذا الطلب.");
      if (amountMinor > order.receivableMinor)
        return failure("invalid_state", "التحصيل لا يمكن أن يتجاوز المتبقي على الطلب.");
      try {
        const timestamp = this.now();
        const next = collectRemaining(
          order,
          amountMinor,
          `${operationKey}`,
          timestamp,
        );
        return this.persist({ ...current.stored, order: next, updatedAt: timestamp });
      } catch (error) {
        return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسجيل التحصيل.");
      }
    }
    return failure(
      "invalid_state",
      "تحصيل الطلب يتطلب دينًا مسجلًا أو طلبًا مسلّمًا بمتبقٍ؛ المتبقي قبل التسليم يُسجّل عربونًا.",
    );
  }

  /* المجموعة ٢ (§10.3): التراجع الموثق عن قبضة مسجلة من تفاصيل الطلب. */
  async reverseCollection(
    id: string,
    input: { collectionEventId: string; amountMinor: number; reason: string },
  ): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    if (!input.reason.trim())
      return failure("invalid_state", "أكمل سبب التراجع قبل الحفظ.");
    try {
      const timestamp = this.now();
      const order = reverseOrderCollection(current.stored.order, {
        collectionEventId: input.collectionEventId,
        amountMinor: input.amountMinor,
        reason: input.reason,
        idempotencyKey: `${id}:reverse-collection-${input.collectionEventId}-${input.amountMinor}-${timestamp}`,
        createdAt: timestamp,
      });
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر التراجع عن القبض.");
    }
  }

  /* المجموعة ٢ (§10.5): تعديل السعر بعد الاتفاق من تفاصيل الطلب — تصحيح موثق
   * داخل الطلب، لا إلغاء ولا إعادة إنشاء. */
  async revisePrice(
    id: string,
    input: { newPriceMinor: number; reason: string },
  ): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    if (!input.reason.trim())
      return failure("invalid_state", "أكمل سبب تعديل السعر قبل الحفظ.");
    try {
      const timestamp = this.now();
      const order = reviseAgreedPrice(current.stored.order, {
        newPriceMinor: input.newPriceMinor,
        reason: input.reason,
        idempotencyKey: `${id}:revise-price-${input.newPriceMinor}-${timestamp}`,
        createdAt: timestamp,
      });
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر تعديل السعر.");
    }
  }

  async registerRemainingDebt(id: string): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    if (current.stored.order.status === "settled" && current.stored.order.settlementStatus === "debt")
      return current;
    if (current.stored.order.status !== "delivered")
      return failure("invalid_state", "تسجيل الدين يتطلب تسجيل التسليم أولًا.");
    if (current.stored.order.receivableMinor <= 0)
      return failure("invalid_state", "لا يوجد مبلغ متبقٍ لتسجيله كدين.");
    try {
      const timestamp = this.now();
      const amount = current.stored.order.receivableMinor;
      const order = registerDebt(current.stored.order, `${id}:register-debt-${amount}`, timestamp);
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسجيل الدين.");
    }
  }

  /* القرار ١٩: الإلغاء عبر cancelOrder وحدها (عقد ٠٢) — السبب اختياري في الواجهة،
   * والمسار الموثق يفرض نصًا غير فارغ؛ التخطي يسجل «بدون سبب محدد» بصدق.
   * العربون يبقى «يحتاج مراجعة» خيارًا صالحًا لا خطأً. */
  async cancel(id: string, reason: string): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    if (current.stored.order.status === "cancelled") return current;
    const trimmed = reason.trim() || "إلغاء بدون سبب محدد";
    try {
      const timestamp = this.now();
      const order = cancelOrder(current.stored.order, trimmed, `${id}:cancel`, timestamp);
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر إلغاء الطلب.");
    }
  }

  async refundDeposit(id: string, reason: string): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    const amount = current.stored.order.depositCollectedMinor;
    try {
      const timestamp = this.now();
      const order = settleDepositRefund(
        current.stored.order,
        amount,
        reason,
        `${id}:refund-deposit-${amount}`,
        timestamp,
      );
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر رد العربون.");
    }
  }

  async retainDeposit(id: string, reason: string): Promise<FulfillmentResult> {
    const current = await this.load(id);
    if (!current.ok) return current;
    const amount = current.stored.order.depositCollectedMinor;
    try {
      const timestamp = this.now();
      const order = settleDepositRetain(
        current.stored.order,
        amount,
        reason,
        `${id}:retain-deposit-${amount}`,
        timestamp,
      );
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) {
      return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسوية العربون.");
    }
  }

  /* إضافة المالك (القرار ١٩): قسم يجمع العربونات — كم عربونًا مقبوضًا، على أي
   * طلبات، وأيها ينتظر تسوية. قراءة فقط؛ لا تحصيل ولا تسوية من هنا. */
  async listDepositOverview(): Promise<
    { ok: true; value: DepositOverview } | Extract<FulfillmentResult, { ok: false }>
  > {
    const result = await this.store.listOrders();
    if (!result.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة الطلبات المحلية." };
    const rows = result.value
      .filter(stored => stored.order.depositCollectedMinor > 0)
      .map(stored => ({
        orderId: stored.id,
        itemName: stored.order.itemName,
        customerName: stored.order.customerName,
        depositCollectedMinor: stored.order.depositCollectedMinor,
        settlementStatus: stored.order.settlementStatus,
        depositSettlement: stored.order.depositSettlement,
      }))
      .sort((left, right) => left.orderId.localeCompare(right.orderId));
    return {
      ok: true,
      value: {
        deposits: rows,
        collectedTotalMinor: rows.reduce((total, row) => total + row.depositCollectedMinor, 0),
        awaitingSettlementCount: rows.filter(row => row.depositSettlement === "needs_review").length,
      },
    };
  }
}
