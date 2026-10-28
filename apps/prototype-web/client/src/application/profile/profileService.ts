/** Application boundary for local setup. It validates profile inputs before any LocalStore write. */
import { localProfileId, type ActivityProfile, type PrototypeLocalStore } from "@/storage/local/types";

/** R3 (بطاقة R3-SC-01/11): عدسة الخدمة — زوج الملف فقط.
 * U001-IR-002 (مراجعة مستقلة 2026-10-18): الإنشاء الذرّي حدُّ الكتابة الجديد
 * يُضاف للعدسة — القراءة/الكتابة المنفصلتان كانتا تسمحان بنافذتين متزامنتين
 * بطمس أول هوية؛ الحد الذرّي يغلق السباق عند الجذر.
 * S03 (UNIT-039 B2/عقد §17): التعديل المحروس commitProfileRename يحل محل
 * save غير المحروس كليًا — لا مسار كتابة اسم ثانٍ بلا CAS أبدًا. */
export type ProfileServiceStore = Pick<
  PrototypeLocalStore,
  "getProfile" | "commitProfileCreate" | "commitProfileRename"
>;
import {
  STORAGE_ERROR,
  VALIDATION_ERROR,
  storageFailure,
  validationFailure,
} from "@/application/resultCodes";
import { systemClock, type Clock } from "@/application/time/clock";

/** UNIT-001 V2 / DUP-002: نتيجة الإنشاء — الهوية القائمة تُعاد كما هي دون كتابة. */
export type ProfileCreateResult =
  | { ok: true; profile: ActivityProfile; created: boolean }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };

/* S03 (UNIT-039 A/B2/عقد §17): نتيجة تعديل الاسم — التعارض حالة صادقة
 * مستقلة عن فشل التخزين: نجاح مثبت، أو تعارض نسخة يُعاد بعده القراءة، أو
 * فشل تخزين بلا كتابة. */
export type ProfileRenameResult =
  | { ok: true; profile: ActivityProfile; outcome: "renamed" }
  | { ok: true; profile: ActivityProfile | null; outcome: "conflict"; message: string }
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
  /**
   * S03 (UNIT-039 A1/B2 — عقد §17 «نافذتان تعدلان المصدر»): تعديل اسم
   * الهوية القائمة كتابة محروسة واحدة — الحد commitProfileRename يقرأ
   * ويقارن النسخة ويكتب داخل معاملة واحدة (CAS على updatedAt المتوقع من
   * قراءة المحرر): النجاح يغيّر الاسم وحده بنفس المعرف وcreatedAt ودون أي
   * أثر مالي أو مرجعي، والتعارض (نافذة أخرى سبقت أو غاب الملف) يعيد
   * الحالة الحالية كاملة بلا كتابة ليعاد القراءة والقرار بيد المالك — لا
   * lost update ولا سحق للاسم الأحدث ولا إنشاء هوية من مسار التعديل.
   * إعادة المحاولة بعد فشل التخزين آمنة: الفشل بلا كتابة والنسخة المتوقعة
   * لم تتغير.
   */
  async rename(activityName: string, expectedUpdatedAt: string): Promise<ProfileRenameResult> {
    const normalizedName = activityName.trim();
    if (!normalizedName) return validationFailure("اسم المشروع: اكتب اسم مشروعك، أو ألغِ التعديل.");
    const current = await this.store.getProfile();
    if (!current.ok) return storageFailure("تعذر قراءة التأسيس المحلي. حاول مرة أخرى.");
    if (current.value === null)
      return {
        ok: true,
        profile: null,
        outcome: "conflict",
        message: "لم يعد ملف المشروع موجودًا على هذا الجهاز — أعد قراءة الحالة قبل أي حفظ.",
      };
    const next: ActivityProfile = {
      ...current.value,
      activityName: normalizedName,
      updatedAt: this.now(),
    };
    const committed = await this.store.commitProfileRename(next, expectedUpdatedAt);
    if (!committed.ok)
      return storageFailure("لم يتم حفظ اسم المشروع على هذا الجهاز. تحقق من مساحة التخزين ثم أعد المحاولة.");
    if (committed.value.outcome === "conflict")
      return {
        ok: true,
        profile: committed.value.profile,
        outcome: "conflict",
        message: "تغيّر اسم المشروع من نافذة أخرى بعد فتحك المحرر — أعد قراءة الاسم الحالي ثم قرر.",
      };
    return { ok: true, profile: committed.value.profile, outcome: "renamed" };
  }
}
