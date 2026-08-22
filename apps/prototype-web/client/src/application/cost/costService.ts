/**
 * Financial boundary: this service maps draft persistence records to the Domain
 * calculator. React never calculates planned cost, knowledge, or price floor.
 */
import { calculateCostSnapshot, type CostSnapshot } from "../../../../../../src/domain/craft-order/index.js";
import type { DraftCostSnapshot, OrderDraft, PrototypeLocalStore } from "@/storage/local/types";

export type CostEditorInput = Omit<DraftCostSnapshot, "id" | "revision" | "createdAt" | "currency">;
export type CostResult = { ok: true; snapshot: CostSnapshot } | { ok: false; code: "validation_error" | "storage_error"; message: string };
export type SaveCostResult = { ok: true; snapshot: CostSnapshot; draft: OrderDraft } | { ok: false; code: "validation_error" | "storage_error"; message: string };

const newId = (prefix: string) => typeof crypto !== "undefined" && "randomUUID" in crypto ? `${prefix}-${crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function toDomainSnapshot(id: string, input: CostEditorInput, createdAt: string): CostSnapshot {
  return calculateCostSnapshot(id, { currency: "JOD", materialItems: input.materialItems.map(item => ({ ...item, source: "user_input", priceDate: createdAt })), time: input.time, packagingMinor: input.packagingMinor, deliveryMinor: input.deliveryMinor, wasteMinor: input.wasteMinor, safetyBufferMinor: input.safetyBufferMinor, quantity: input.quantity, createdAt, source: "draft" });
}

function validationMessage(): Extract<CostResult, { ok: false }> { return { ok: false, code: "validation_error", message: "راجع الكمية وبنود التكلفة والوقت. لا يمكن اعتبار الوقت المفقود صفرًا، ولا تُقبل المبالغ أو الكميات السالبة." }; }

export class CostService {
  constructor(private readonly store: PrototypeLocalStore, private readonly now: () => string = () => new Date().toISOString()) {}
  preview(input: CostEditorInput): CostResult {
    try { return { ok: true, snapshot: toDomainSnapshot("cost-preview", input, this.now()) }; }
    catch { return validationMessage(); }
  }
  previewStored(snapshot: DraftCostSnapshot): CostResult {
    try { return { ok: true, snapshot: toDomainSnapshot(snapshot.id, snapshot, snapshot.createdAt) }; }
    catch { return validationMessage(); }
  }
  async saveSnapshot(draft: OrderDraft, input: CostEditorInput): Promise<SaveCostResult> {
    const timestamp = this.now();
    const id = newId("cost");
    let snapshot: CostSnapshot;
    try { snapshot = toDomainSnapshot(id, input, timestamp); } catch { return validationMessage(); }
    const record: DraftCostSnapshot = { ...input, id, revision: draft.costSnapshots.length + 1, currency: "JOD", materialItems: input.materialItems.map(item => ({ ...item })), time: input.time ? { ...input.time } : null, createdAt: timestamp };
    const saved = await this.store.saveDraft({ ...draft, costSnapshots: [...draft.costSnapshots, record], activeCostSnapshotId: id, updatedAt: timestamp });
    return saved.ok ? { ok: true, snapshot, draft: saved.value } : { ok: false, code: "storage_error", message: "تعذر حفظ نسخة التكلفة. بقيت المدخلات أمامك؛ أعد المحاولة." };
  }
}
