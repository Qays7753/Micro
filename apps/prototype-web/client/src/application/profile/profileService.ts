/** Application boundary for local setup. It validates profile inputs before any LocalStore write. */
import { localProfileId, type ActivityProfile, type PrototypeLocalStore } from "@/storage/local/types";
import {
  STORAGE_ERROR,
  VALIDATION_ERROR,
  storageFailure,
  validationFailure,
} from "@/application/resultCodes";
import { systemClock, type Clock } from "@/application/time/clock";

export type ProfileSaveResult =
  | { ok: true; profile: ActivityProfile }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };

export class ProfileService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: Clock = systemClock,
  ) {}
  async load() {
    return this.store.getProfile();
  }
  async save(activityName: string): Promise<ProfileSaveResult> {
    const normalizedName = activityName.trim();
    if (!normalizedName)
      return validationFailure("اسم النشاط: اكتب اسم النشاط أو اسمك أولًا، ثم أعد المحاولة.");
    const current = await this.store.getProfile();
    if (!current.ok) return storageFailure("تعذر قراءة التأسيس المحلي. حاول مرة أخرى.");
    const timestamp = this.now();
    const profile: ActivityProfile = {
      id: localProfileId,
      activityName: normalizedName,
      currency: "JOD",
      activityType: "custom_craft",
      createdAt: current.value?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    const saved = await this.store.saveProfile(profile);
    return saved.ok
      ? { ok: true, profile: saved.value }
      : storageFailure("لم يتم حفظ التأسيس على هذا الجهاز. تحقق من مساحة التخزين ثم أعد المحاولة.");
  }
}
