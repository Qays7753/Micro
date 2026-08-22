/**
 * Financial boundary for Slice 3. The service creates one CraftOrder from one
 * draft only after a saved cost snapshot exists; React never changes money state.
 */
import { collectDeposit, createCraftOrder, transitionOrder, type CraftOrder } from "@micro-domain/craft-order/index.js";
import type { CostService } from "@/application/cost/costService";
import type { OrderDraft, PrototypeLocalStore, StoredCraftOrder } from "@/storage/local/types";

export type AgreementInput = { agreedPriceMinor: number; deliveryDate: string; depositMinor: number; agreementSource: string | null };
export type AgreementResult = { ok: true; stored: StoredCraftOrder } | { ok: false; code: "validation_error" | "storage_error" | "missing_cost" | "inconsistent_state"; message: string };
const dateIsValid = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

function validation(message: string): Extract<AgreementResult, { ok: false }> { return { ok: false, code: "validation_error", message }; }

export class AgreementService {
  constructor(private readonly store: PrototypeLocalStore, private readonly costs: CostService, private readonly now: () => string = () => new Date().toISOString()) {}

  async list(): Promise<{ ok: true; orders: readonly StoredCraftOrder[] } | Extract<AgreementResult, { ok: false }>> {
    const result = await this.store.listOrders();
    return result.ok ? { ok: true, orders: result.value } : { ok: false, code: "storage_error", message: "تعذر قراءة الطلبات المحلية." };
  }

  async get(id: string): Promise<{ ok: true; stored: StoredCraftOrder | null } | Extract<AgreementResult, { ok: false }>> {
    const result = await this.store.getOrder(id);
    return result.ok ? { ok: true, stored: result.value } : { ok: false, code: "storage_error", message: "تعذر قراءة الطلب المحلي." };
  }

  async createFromDraft(draft: OrderDraft, input: AgreementInput): Promise<AgreementResult> {
    if (draft.linkedOrderId) {
      const current = await this.store.getOrder(draft.linkedOrderId);
      if (!current.ok) return { ok: false, code: "storage_error", message: "تعذر التحقق من الاتفاق المحفوظ." };
      if (!current.value) return { ok: false, code: "inconsistent_state", message: "توجد إشارة لاتفاق محلي غير متاح. لا تنشئ اتفاقًا جديدًا قبل المراجعة." };
      return { ok: true, stored: current.value };
    }
    if (!draft.customerName.trim()) return validation("سجل اسم العميل قبل تثبيت الاتفاق.");
    if (!draft.itemName.trim() || !draft.specifications.trim()) return validation("أكمل وصف القطعة وملاحظات التخصيص قبل تثبيت الاتفاق.");
    if (!Number.isInteger(input.agreedPriceMinor) || input.agreedPriceMinor <= 0) return validation("أدخل سعرًا متفقًا عليه أكبر من صفر.");
    if (!Number.isInteger(input.depositMinor) || input.depositMinor < 0) return validation("العربون يجب أن يكون صفرًا أو مبلغًا صحيحًا.");
    if (input.depositMinor > input.agreedPriceMinor) return validation("لا يمكن أن يتجاوز العربون السعر المتفق عليه.");
    if (!dateIsValid(input.deliveryDate)) return validation("أدخل موعد تسليم صحيحًا.");
    const active = draft.costSnapshots.find(snapshot => snapshot.id === draft.activeCostSnapshotId);
    if (!active) return { ok: false, code: "missing_cost", message: "احفظ Snapshot تكلفة أولًا قبل تثبيت الاتفاق." };
    const cost = this.costs.previewStored(active);
    if (!cost.ok) return { ok: false, code: "missing_cost", message: "Snapshot التكلفة غير صالح؛ راجع التكلفة قبل تثبيت الاتفاق." };
    const timestamp = this.now();
    const id = `order-${draft.id}`;
    try {
      let order: CraftOrder = createCraftOrder({ id, customerName: draft.customerName, itemName: draft.itemName, specifications: draft.specifications, quantity: draft.quantity, agreedPriceMinor: input.agreedPriceMinor, costSnapshot: cost.snapshot, createdAt: timestamp });
      order = transitionOrder(order, { to: "provisional_agreement", idempotencyKey: `${id}:provisional-agreement`, createdAt: timestamp, note: "agreement recorded locally" });
      if (input.depositMinor > 0) order = collectDeposit(order, input.depositMinor, `${id}:initial-deposit`, timestamp);
      const stored: StoredCraftOrder = { id, order, deliveryDate: input.deliveryDate, agreementSource: input.agreementSource?.trim() || null, createdAt: timestamp, updatedAt: timestamp };
      const linkedDraft: OrderDraft = { ...draft, linkedOrderId: id, updatedAt: timestamp };
      const commit = await this.store.commitOrderFromDraft(stored, linkedDraft);
      return commit.ok ? { ok: true, stored: commit.value.order } : { ok: false, code: "storage_error", message: "تعذر حفظ الاتفاق محليًا. لم يتم تأكيد نجاح العملية." };
    } catch (error) { return validation(error instanceof Error ? error.message : "تعذر بناء الاتفاق."); }
  }

  async startExecution(id: string): Promise<AgreementResult> {
    const existing = await this.store.getOrder(id);
    if (!existing.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة الطلب المحلي." };
    if (!existing.value) return { ok: false, code: "inconsistent_state", message: "الطلب غير متاح محليًا." };
    if (existing.value.order.status === "in_progress") return { ok: true, stored: existing.value };
    if (existing.value.order.status !== "provisional_agreement") return { ok: false, code: "inconsistent_state", message: "لا يمكن بدء التنفيذ من هذه الحالة." };
    try {
      const timestamp = this.now();
      const confirmed = transitionOrder(existing.value.order, { to: "confirmed", idempotencyKey: `${id}:confirm`, createdAt: timestamp });
      const executing = transitionOrder(confirmed, { to: "in_progress", idempotencyKey: `${id}:start-execution`, createdAt: timestamp });
      const stored = { ...existing.value, order: executing, updatedAt: timestamp };
      const saved = await this.store.saveOrder(stored);
      return saved.ok ? { ok: true, stored: saved.value } : { ok: false, code: "storage_error", message: "تعذر حفظ حالة التنفيذ. لم يتم تأكيد نجاح العملية." };
    } catch (error) { return validation(error instanceof Error ? error.message : "تعذر بدء التنفيذ."); }
  }
}
