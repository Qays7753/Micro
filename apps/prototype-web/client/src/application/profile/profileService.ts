/** Application boundary for local setup. It validates profile inputs before any LocalStore write. */
import { localProfileId, type ActivityProfile, type PrototypeLocalStore } from "@/storage/local/types";

/** R3 (بطاقة R3-SC-01/11): عدسة الخدمة — زوج الملف فقط. */
export type ProfileServiceStore = Pick<PrototypeLocalStore, "getProfile" | "saveProfile">;
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

/** UNIT-001 V2 / DUP-002: نتيجة الإنشاء — الهوية القائمة تُعاد كما هي دون كتابة. */
export type ProfileCreateResult =
  | { ok: true; profile: ActivityProfile; created: boolean }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };

export class ProfileService {
  constructor(
    private readonly store: ProfileServiceStore,
    private readonly now: Clock = systemClock,
  ) {}
  async load() {
    return this.store.getProfile();
  }
  /**
   * UNIT-001 V2 (R02/R07، DUP-002): إنشاء الهوية وحدها — مسار الإنشاء idempotent
   * ولا يعدّل هوية قائمة أبدًا: يقرأ الملف أولًا؛ وجوده يعيده كما هو دون أي كتابة
   * (التعديل ملك 039 عبر save)، وغيابه ينشئه مرة واحدة بمصدر الهوية الواحد
   * الثابت. فشل القراءة فشل صريح لا كتابة بديلة بعده.
   */
  async create(activityName: string): Promise<ProfileCreateResult> {
    const normalizedName = activityName.trim();
    if (!normalizedName)
      return validationFailure("اسم النشاط: اكتب اسم النشاط أو اسمك أولًا، ثم أعد المحاولة.");
    const current = await this.store.getProfile();
    if (!current.ok) return storageFailure("تعذر قراءة التأسيس المحلي. حاول مرة أخرى.");
    if (current.value) return { ok: true, profile: current.value, created: false };
    const timestamp = this.now();
    const profile: ActivityProfile = {
      id: localProfileId,
      activityName: normalizedName,
      currency: "JOD",
      activityType: "custom_craft",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const saved = await this.store.saveProfile(profile);
    return saved.ok
      ? { ok: true, profile: saved.value, created: true }
      : storageFailure("لم يتم حفظ التأسيس على هذا الجهاز. تحقق من مساحة التخزين ثم أعد المحاولة.");
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
