/** Slice 4 financial boundary: delivery, collection, and debt are three distinct Domain operations. */
import { collectRemaining, registerDebt, transitionOrder } from "@micro-domain/craft-order/index.js";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import type { StoredCraftOrder, PrototypeLocalStore } from "@/storage/local/types";

export type FulfillmentResult = { ok: true; stored: StoredCraftOrder } | { ok: false; code: "storage_error" | "invalid_state"; message: string };
const success = (stored: StoredCraftOrder): FulfillmentResult => ({ ok: true, stored });
const failure = (code: Extract<FulfillmentResult, { ok: false }>['code'], message: string): FulfillmentResult => ({ ok: false, code, message });

export class FulfillmentService {
  constructor(private readonly store: PrototypeLocalStore, private readonly now: () => string = () => new Date().toISOString(), private readonly schedules: ScheduleService = new ScheduleService(store, now)) {}

  private async load(id: string): Promise<FulfillmentResult> {
    const result = await this.store.getOrder(id);
    if (!result.ok) return failure("storage_error", "تعذر قراءة الطلب المحلي.");
    if (!result.value) return failure("invalid_state", "الطلب غير متاح محليًا.");
    return success(result.value);
  }

  private async persist(stored: StoredCraftOrder): Promise<FulfillmentResult> {
    const result = await this.store.saveOrder(stored);
    return result.ok ? success(result.value) : failure("storage_error", "تعذر حفظ التغيير. لم يتم تأكيد نجاح العملية.");
  }

  async markReady(id: string): Promise<FulfillmentResult> {
    const current = await this.load(id); if (!current.ok) return current;
    if (["ready", "delivered", "settled"].includes(current.stored.order.status)) return current;
    if (current.stored.order.status !== "in_progress") return failure("invalid_state", "لا يمكن تسجيل الجاهزية من حالة الطلب الحالية.");
    try {
      const timestamp = this.now();
      const order = transitionOrder(current.stored.order, { to: "ready", idempotencyKey: `${id}:mark-ready`, createdAt: timestamp });
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) { return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسجيل الجاهزية."); }
  }

  async deliver(id: string): Promise<FulfillmentResult> {
    const current = await this.load(id); if (!current.ok) return current;
    if (["delivered", "settled"].includes(current.stored.order.status) && current.stored.order.events.some(event => event.type === "status_changed" && event.toStatus === "delivered")) return current;
    if (current.stored.order.status !== "ready") return failure("invalid_state", "لا يمكن تسجيل التسليم قبل أن يصبح الطلب جاهزًا.");
    try {
      const timestamp = this.now();
      const order = transitionOrder(current.stored.order, { to: "delivered", idempotencyKey: `${id}:deliver`, createdAt: timestamp }); const saved = await this.persist({ ...current.stored, order, updatedAt: timestamp });
      if (saved.ok) await this.schedules.reconcileDelivery(id);
      return saved;
    } catch (error) { return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسجيل التسليم."); }
  }

  async collectFullRemaining(id: string): Promise<FulfillmentResult> {
    const current = await this.load(id); if (!current.ok) return current;
    if (current.stored.order.status === "settled" && current.stored.order.settlementStatus === "paid") return current;
    if (current.stored.order.status !== "delivered") return failure("invalid_state", "التحصيل المتبقي يتطلب تسجيل التسليم أولًا.");
    if (current.stored.order.receivableMinor <= 0) return failure("invalid_state", "لا يوجد مبلغ متبقٍ لتحصيله.");
    try {
      const timestamp = this.now(); const amount = current.stored.order.receivableMinor;
      const order = collectRemaining(current.stored.order, amount, `${id}:collect-full-${amount}`, timestamp);
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) { return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسجيل التحصيل."); }
  }

  async registerRemainingDebt(id: string): Promise<FulfillmentResult> {
    const current = await this.load(id); if (!current.ok) return current;
    if (current.stored.order.status === "settled" && current.stored.order.settlementStatus === "debt") return current;
    if (current.stored.order.status !== "delivered") return failure("invalid_state", "تسجيل الدين يتطلب تسجيل التسليم أولًا.");
    if (current.stored.order.receivableMinor <= 0) return failure("invalid_state", "لا يوجد مبلغ متبقٍ لتسجيله كدين.");
    try {
      const timestamp = this.now(); const amount = current.stored.order.receivableMinor;
      const order = registerDebt(current.stored.order, `${id}:register-debt-${amount}`, timestamp);
      return this.persist({ ...current.stored, order, updatedAt: timestamp });
    } catch (error) { return failure("invalid_state", error instanceof Error ? error.message : "تعذر تسجيل الدين."); }
  }
}
