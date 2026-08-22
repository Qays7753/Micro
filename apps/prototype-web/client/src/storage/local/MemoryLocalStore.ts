/** Test adapter only. It mirrors the LocalStore port without making browser APIs part of application tests. */
import type { ActivityProfile, OrderDraft, PrototypeLocalStore, StorageResult } from "./types";

const clone = <T,>(value: T): T => structuredClone(value);

export class MemoryLocalStore implements PrototypeLocalStore {
  private profile: ActivityProfile | null = null;
  private drafts = new Map<string, OrderDraft>();

  async getProfile(): Promise<StorageResult<ActivityProfile | null>> { return { ok: true, value: this.profile ? clone(this.profile) : null }; }
  async saveProfile(profile: ActivityProfile): Promise<StorageResult<ActivityProfile>> { this.profile = clone(profile); return { ok: true, value: clone(profile) }; }
  async listDrafts(): Promise<StorageResult<readonly OrderDraft[]>> {
    return { ok: true, value: Array.from(this.drafts.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(clone) };
  }
  async getDraft(id: string): Promise<StorageResult<OrderDraft | null>> { const draft = this.drafts.get(id); return { ok: true, value: draft ? clone(draft) : null }; }
  async saveDraft(draft: OrderDraft): Promise<StorageResult<OrderDraft>> { this.drafts.set(draft.id, clone(draft)); return { ok: true, value: clone(draft) }; }
}
