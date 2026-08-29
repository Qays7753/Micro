/** Application boundary for direct sales. Order collections never enter this service. */
import { createDirectSale, type DirectSale } from "@micro-domain/direct-sale/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";

export type DirectSaleRecordInput = {
  itemName: string;
  quantity: number;
  revenueMinor: number;
  costMinor: number | null;
  occurredOn: string;
  note: string;
  idempotencyKey: string;
};

export type DirectSaleResult<T> =
  | { ok: true; value: T; reused?: boolean }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `direct-sale-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export class DirectSaleService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async list(): Promise<DirectSaleResult<readonly DirectSale[]>> {
    const result = await this.store.listDirectSales();
    return result.ok
      ? { ok: true, value: result.value }
      : { ok: false, code: "storage_error", message: "تعذر قراءة المبيعات المباشرة المحلية." };
  }

  async record(input: DirectSaleRecordInput): Promise<DirectSaleResult<DirectSale>> {
    const existing = await this.store.listDirectSales();
    if (!existing.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجل المبيعات قبل الحفظ." };
    const reused = existing.value.find(sale => sale.idempotencyKey === input.idempotencyKey);
    if (reused) return { ok: true, value: reused, reused: true };

    let sale: DirectSale;
    try {
      sale = createDirectSale({
        id: createId(),
        itemName: input.itemName,
        quantity: input.quantity,
        revenueMinor: input.revenueMinor,
        costMinor: input.costMinor,
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        note: input.note,
        idempotencyKey: input.idempotencyKey,
      });
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات البيع المباشر غير صالحة.",
      };
    }

    const saved = await this.store.saveDirectSale(sale);
    return saved.ok
      ? { ok: true, value: saved.value }
      : {
          ok: false,
          code: "storage_error",
          message: "تعذر حفظ البيع المباشر محليًا. بقيت بيانات النموذج أمامك؛ أعد المحاولة.",
        };
  }
}