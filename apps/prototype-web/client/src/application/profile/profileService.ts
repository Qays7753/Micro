/** Application boundary for local setup. It validates profile inputs before any LocalStore write. */
import { localProfileId, type ActivityProfile, type PrototypeLocalStore } from "@/storage/local/types";

export type ProfileSaveResult = { ok: true; profile: ActivityProfile } | { ok: false; code: "validation_error" | "storage_error"; message: string };

export class ProfileService {
  constructor(private readonly store: PrototypeLocalStore, private readonly now: () => string = () => new Date().toISOString()) {}
  async load() { return this.store.getProfile(); }
  async save(activityName: string): Promise<ProfileSaveResult> {
    const normalizedName = activityName.trim();
    if (!normalizedName) return { ok: false, code: "validation_error", message: "اسم النشاط: اكتب اسم النشاط أو اسمك أولًا، ثم أعد المحاولة." };
    const current = await this.store.getProfile();
    if (!current.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة التأسيس المحلي. حاول مرة أخرى." };
    const timestamp = this.now();
    const profile: ActivityProfile = { id: localProfileId, activityName: normalizedName, currency: "JOD", activityType: "custom_craft", createdAt: current.value?.createdAt ?? timestamp, updatedAt: timestamp };
    const saved = await this.store.saveProfile(profile);
    return saved.ok ? { ok: true, profile: saved.value } : { ok: false, code: "storage_error", message: "لم يتم حفظ التأسيس على هذا الجهاز. تحقق من مساحة التخزين ثم أعد المحاولة." };
  }
}
