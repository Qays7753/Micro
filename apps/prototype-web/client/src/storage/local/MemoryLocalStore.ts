/** Test adapter only. It mirrors the LocalStore port without making browser APIs part of application tests. */
import type { ActivityProfile, LocalPreferences, LocalStoreSnapshot, OrderDraft, PrototypeLocalStore, StorageResult, StoredCraftOrder } from "./types";

const clone = <T,>(value: T): T => structuredClone(value);

export class MemoryLocalStore implements PrototypeLocalStore {
  private profile: ActivityProfile | null = null;
  private preferences: LocalPreferences | null = null;
  private drafts = new Map<string, OrderDraft>();
  private orders = new Map<string, StoredCraftOrder>();

  async getProfile(): Promise<StorageResult<ActivityProfile | null>> { return { ok: true, value: this.profile ? clone(this.profile) : null }; }
  async saveProfile(profile: ActivityProfile): Promise<StorageResult<ActivityProfile>> { this.profile = clone(profile); return { ok: true, value: clone(profile) }; }
  async getPreferences(): Promise<StorageResult<LocalPreferences | null>> { return { ok: true, value: this.preferences ? clone(this.preferences) : null }; }
  async savePreferences(preferences: LocalPreferences): Promise<StorageResult<LocalPreferences>> { this.preferences = clone(preferences); return { ok: true, value: clone(preferences) }; }
  async listDrafts(): Promise<StorageResult<readonly OrderDraft[]>> {
    return { ok: true, value: Array.from(this.drafts.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(clone) };
  }
  async getDraft(id: string): Promise<StorageResult<OrderDraft | null>> { const draft = this.drafts.get(id); return { ok: true, value: draft ? clone(draft) : null }; }
  async saveDraft(draft: OrderDraft): Promise<StorageResult<OrderDraft>> { this.drafts.set(draft.id, clone(draft)); return { ok: true, value: clone(draft) }; }
  async listOrders(): Promise<StorageResult<readonly StoredCraftOrder[]>> { return { ok: true, value: Array.from(this.orders.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(clone) }; }
  async getOrder(id: string): Promise<StorageResult<StoredCraftOrder | null>> { const order = this.orders.get(id); return { ok: true, value: order ? clone(order) : null }; }
  async saveOrder(order: StoredCraftOrder): Promise<StorageResult<StoredCraftOrder>> { this.orders.set(order.id, clone(order)); return { ok: true, value: clone(order) }; }
  async commitOrderFromDraft(order: StoredCraftOrder, draft: OrderDraft): Promise<StorageResult<{ order: StoredCraftOrder; draft: OrderDraft }>> { this.orders.set(order.id, clone(order)); this.drafts.set(draft.id, clone(draft)); return { ok: true, value: { order: clone(order), draft: clone(draft) } }; }
  async readSnapshot(): Promise<StorageResult<LocalStoreSnapshot>> { return { ok: true, value: { profile: this.profile ? clone(this.profile) : null, preferences: this.preferences ? clone(this.preferences) : null, drafts: Array.from(this.drafts.values()).map(clone), orders: Array.from(this.orders.values()).map(clone) } }; }
  async replaceSnapshot(snapshot: LocalStoreSnapshot): Promise<StorageResult<LocalStoreSnapshot>> {
    const safe = clone(snapshot); this.profile = safe.profile; this.preferences = safe.preferences; this.drafts = new Map(safe.drafts.map(draft => [draft.id, draft])); this.orders = new Map(safe.orders.map(order => [order.id, order]));
    return { ok: true, value: clone(safe) };
  }
}
