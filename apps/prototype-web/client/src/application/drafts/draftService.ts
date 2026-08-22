/** Application boundary for pre-domain drafts. A draft is not a CraftOrder and has no price, cash, or result effect. */
import type { DraftIntent, OrderDraft, PrototypeLocalStore } from "@/storage/local/types";

export type DraftInput = Pick<OrderDraft, "intent" | "customerName" | "itemName" | "specifications" | "quantity" | "costSnapshots" | "activeCostSnapshotId" | "linkedOrderId">;
export type DraftSaveResult = { ok: true; draft: OrderDraft } | { ok: false; code: "validation_error" | "storage_error"; message: string };

const createId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export class DraftService {
  constructor(private readonly store: PrototypeLocalStore, private readonly now: () => string = () => new Date().toISOString()) {}
  list() { return this.store.listDrafts(); }
  get(id: string) { return this.store.getDraft(id); }
  async create(intent: DraftIntent): Promise<DraftSaveResult> { return this.save({ id: createId(), intent, customerName: "", itemName: "", specifications: "", quantity: 1, costSnapshots: [], activeCostSnapshotId: null, linkedOrderId: null, createdAt: this.now() }); }
  async save(input: DraftInput & Pick<OrderDraft, "id" | "createdAt">): Promise<DraftSaveResult> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) return { ok: false, code: "validation_error", message: "الكمية يجب أن تكون قطعة واحدة أو أكثر." };
    const draft: OrderDraft = { ...input, customerName: input.customerName.trim(), itemName: input.itemName.trim(), specifications: input.specifications.trim(), updatedAt: this.now() };
    const saved = await this.store.saveDraft(draft);
    return saved.ok ? { ok: true, draft: saved.value } : { ok: false, code: "storage_error", message: "تعذر حفظ المسودة على هذا الجهاز. بقيت بيانات النموذج أمامك؛ أعد المحاولة." };
  }
}
