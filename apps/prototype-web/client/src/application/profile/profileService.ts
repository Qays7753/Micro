/** Application boundary for local setup. It validates profile inputs before any LocalStore write. */
import { localProfileId, type ActivityProfile, type PrototypeLocalStore } from "@/storage/local/types";

/** R3 (بطاقة R3-SC-01/11): عدسة الخدمة — زوج الملف فقط. */
/* U001-IR-002 (مراجعة مستقلة 2026-10-18): الإنشاء الذرّي حدُّ الكتابة الجديد
 * يُضاف للعدسة — القراءة/الكتابة المنفصلتان كانتا تسمحان بنافذتين متزامنتين
 * بطمس أول هوية؛ الحد الذرّي يغلق السباق عند الجذر. */
export type ProfileServiceStore = Pick<
  PrototypeLocalStore,
  "getProfile" | "saveProfile" | "commitProfileCreate"
>;
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
   * UNIT-001 V2 (R02/R07، DUP-002) + U001-IR-002 (مراجعة مستقلة 2026-10-18):
   * إنشاء الهوية وحده — مسار الإنشاء idempotent ذرّيًا ولا يعدّل هوية قائمة
   * أبدًا: الحد commitProfileCreate يقرأ ويكتب في معاملة واحدة فوجود الملف
   * سلفًا يعيده كما هو دون أي كتابة (reused → created:false الصادق) وغيابه
   * يُنشأه مرة واحدة؛ نافذتان متزامنتان لا تطمسان أول هوية منشأة أبدًا.
   * فشل الحد فشل صريح لا كتابة بديلة بعده. (التعديل ملك 039 عبر save.)
   */
  async create(activityName: string): Promise<ProfileCreateResult> {
    const normalizedName = activityName.trim();
    if (!normalizedName)
      return validationFailure("اسم النشاط: اكتب اسم النشاط أو اسمك أولًا، ثم أعد المحاولة.");
    const timestamp = this.now();
    const profile: ActivityProfile = {
      id: localProfileId,
      activityName: normalizedName,
      currency: "JOD",
      activityType: "custom_craft",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const committed = await this.store.commitProfileCreate(profile);
    return committed.ok
      ? { ok: true, profile: committed.value.profile, created: !committed.value.reused }
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
