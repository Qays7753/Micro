/**
 * المجموعة ٥ (عقد ٣٧ — القفل المحلي): قفل جهاز اختياري للنظرة العابرة —
 * ليس تشفيرًا ولا حسابًا سحابيًا ولا مصادقة بعيدة.
 *
 * عقد القفل:
 * - الرمز لا يُخزن أبدًا: بصمة مشتقة ببطء (PBKDF2-SHA256، ١٢٠ ألف دورة) من
 *   (salt + pin)؛ السجلات القديمة ببصمة sha256 المفردة تُفتح بمسارها القديم
 *   ثم تُرقّى تلقائيًا للمشتق البطيء بعد أول فتح ناجح — لا قفل خارج صاحب الرمز.
 * - الخمول بمراقبة إخفاء/ظهور التطبيق (visibilitychange) مع آخر نشاط محفوظ —
 *   يعمل مع تبديل التطبيق وقفل الشاشة وإعادة فتح PWA بعد ساعات.
 * - سياسة الزمن الفاشلة-الإغلاق (R11 Lock Remediation — OD-LOCK-ROLLBACK=A):
 *   ساعة الجهاز المتأخرة عن آخر نشاط تقفل لا تنتظر للأبد، والمتأخرة عن آخر
 *   فشل تُبقي وقفة التخمين كاملة بلا تخمين ولا كتابة، والطوابع التالفة
 *   تُعامل بالمثل — حماية البيانات تُقدَّم على زمن لا يمكن تصديقه.
 * - محاولات الفتح الفاشلة تُعدّ وتُصفّر عند النجاح — عدّاد ظاهر لا قفل دائم،
 *   ووقفة تصاعدية مُنفَّذة فعليًا (٣/١٠/٣٠ ثانية) بعد ٣/٥/٨ محاولات فاشلة.
 * - التعطيل يتطلب الرمز الصحيح؛ والتخزين بلا حالة سوى السجل الواحد.
 */
import type { LocalSecurityRecord, PrototypeLocalStore } from "@/storage/local/types";

/** R3 (بطاقة R3-SC-01/11): عدسة الخدمة — ثالوث القفل المحلي فقط (عائلة KEEP R3-SC-18). */
export type LocalLockServiceStore = Pick<
  PrototypeLocalStore,
  "getLocalSecurity" | "saveLocalSecurity" | "deleteLocalSecurity"
>;
import { localSecurityId } from "@/storage/local/types";
import {
  STORAGE_ERROR,
  VALIDATION_ERROR,
  storageFailure,
  validationFailure,
} from "@/application/resultCodes";
import { systemClock, type Clock } from "@/application/time/clock";
import { backoffWaitMessage, delayForAttempts } from "./localLockBackoff";

export type LockStatusResult =
  | { ok: true; value: { enabled: boolean; autoLockMinutes: number | null; lastActiveAt: string | null } }
  | { ok: false; code: "storage_error"; message: string };

export type LockEnableResult =
  | { ok: true; value: LocalSecurityRecord }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };

export type LockVerifyResult =
  | { ok: true; value: { unlocked: boolean; failedAttempts: number; retryInMs?: number } }
  | { ok: false; code: "storage_error"; message: string };

export type LockDisableResult =
  { ok: true; value: null } | { ok: false; code: "wrong_pin" | "storage_error"; message: string };

const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 8;
const ALLOWED_AUTO_LOCK_MINUTES = [1, 5, 10, 30, null] as const;

export const LOCK_AUTO_LOCK_OPTIONS: readonly (typeof ALLOWED_AUTO_LOCK_MINUTES)[number][] =
  ALLOWED_AUTO_LOCK_MINUTES;

/* المجموعة ٦ (تدقيق A1 — SP-02): بصمة مفردة قابلة للكسر بجدول مسبق على
 * مساحة أرقام صغيرة؛ المشتق البطيء PBKDF2-SHA256 بمئة وعشرين ألف دورة
 * يجعل كل تخمين محلي مكلفًا زمنيًا. R11 Lock Remediation: عمليات الرمز
 * (الاشتقاق والمطابقة وأجسام التفعيل/الفتح/التعطيل) وحدة كسولة داخل أسرة
 * الخدمة (pinOperations.ts) — تُحمَّل عند أول عملية رمز فعلًا فلا تدخل كومة
 * الإقلاع المحروسة السقف (D-034/ADR-017)؛ الأساليب الثلاثة غير متزامنة
 * أصلًا والتحقق وحارس الزمن يعملان هنا قبل أي تفويض فلا يتغير سلوك. */

/** محمّل وحدة عمليات الرمز — موقع استيراد كسول واحد للتفعيل/الفتح/التعطيل. */
const loadPinOperations = () => import("./pinOperations");

function normalizePin(pin: string): string | null {
  const trimmed = pin.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  if (trimmed.length < MIN_PIN_LENGTH || trimmed.length > MAX_PIN_LENGTH) return null;
  return trimmed;
}

export class LocalLockService {
  constructor(
    private readonly store: LocalLockServiceStore,
    private readonly now: Clock = systemClock,
  ) {}

  /** R11 Lock Remediation (OD-LOCK-ROLLBACK=A — R11-W1B4-NF-002): كامل
   * الوقفة عندما لا يمكن تصديق الزمن — ساعة متأخرة عن آخر فشل أو طابع
   * تالف؛ وnull فيغادر المسار للنافذة الأمامية القائمة كما هي. لا كتابة
   * سجل هنا أبدًا فلا تُعاد إرساءة lastFailedAt إلى الوراء ولا يُزاد العدّاد. */
  private backoffWhenTimeUnverifiable(record: LocalSecurityRecord): number | null {
    const backoffMs = delayForAttempts(record.failedAttempts);
    /* تعبير واحد فاشل-الإغلاق: لا وقفة نشطة أو طابع غائب = null (المسار
     * الأمامي القائم)؛ وطابع تالف (NaN لا يحقق >=) أو ساعة خلفية = كامل
     * الوقفة — زمن غير موثوق لا يُقبل أبدًا. */
    return backoffMs > 0 && record.lastFailedAt
      ? !(Date.parse(this.now()) >= Date.parse(record.lastFailedAt))
        ? backoffMs
        : null
      : null;
  }

  async status(): Promise<LockStatusResult> {
    const result = await this.store.getLocalSecurity();
    if (!result.ok) return storageFailure(result.message);
    const record = result.value;
    return {
      ok: true,
      value: {
        enabled: record !== null,
        autoLockMinutes: record?.autoLockMinutes ?? null,
        lastActiveAt: record?.lastActiveAt ?? null,
      },
    };
  }

  async enable(pin: string, autoLockMinutes: number | null): Promise<LockEnableResult> {
    const normalized = normalizePin(pin);
    if (normalized === null)
      return {
        ok: false,
        code: VALIDATION_ERROR,
        message: `الرمز ${MIN_PIN_LENGTH}–${MAX_PIN_LENGTH} أرقام إنجليزية — ولا يُخزَّن الرمز نفسه أبدًا.`,
      };
    if (!ALLOWED_AUTO_LOCK_MINUTES.includes(autoLockMinutes as never))
      return validationFailure("اختر مدة الخمول من الخيارات المعروضة.");
    return loadPinOperations().then(m => m.performEnable(this.store, this.now, normalized, autoLockMinutes));
  }

  async unlock(pin: string): Promise<LockVerifyResult> {
    const result = await this.store.getLocalSecurity();
    if (!result.ok) return storageFailure(result.message);
    const record = result.value;
    if (record === null) return { ok: true, value: { unlocked: true, failedAttempts: 0 } };
    /* R11 Lock Remediation (OD-LOCK-ROLLBACK=A — R11-W1B4-NF-002): الوقفة لا
     * تُستبق — الزمن غير القابل للتصديق يُعامل داخل النافذة بكاملها قبل أي
     * تحقق: لا تخمين منفّذ، لا زيادة عدّاد، لا كتابة سجل. */
    const unverifiableBackoffMs = this.backoffWhenTimeUnverifiable(record);
    if (unverifiableBackoffMs !== null) {
      return {
        ok: true,
        value: { unlocked: false, failedAttempts: record.failedAttempts, retryInMs: unverifiableBackoffMs },
      };
    }
    /* جسم المحاولة (المطابقة والنافذة الأمامية والكتابة) في وحدة عمليات
     * الرمز الكسولة — السلوك منقول حرفيًا (SP-04 كما وثقته W1b). */
    return loadPinOperations().then(m => m.performUnlock(this.store, this.now, record, normalizePin(pin)));
  }

  static retryDelayMs(failedAttempts: number): number {
    return delayForAttempts(failedAttempts);
  }

  async shouldLockNow(): Promise<
    { ok: true; value: boolean } | { ok: false; code: "storage_error"; message: string }
  > {
    const result = await this.store.getLocalSecurity();
    if (!result.ok) return storageFailure(result.message);
    const record = result.value;
    if (record === null || record.autoLockMinutes === null) return { ok: true, value: false };
    if (record.lastActiveAt === null) return { ok: true, value: true };
    /* R11 Lock Remediation (OD-LOCK-ROLLBACK=A — R11-W1B4-NF-001): سياسة
     * واحدة صريحة للترتيب الزمني غير الصالح — طابع غير قابل للتحليل أو ساعة
     * متأخرة عن آخر نشاط يقفلان فورًا؛ لا يُفتح المحتوى المحمي على زمن لا
     * يمكن تصديقه أبدًا (الحدّ الشامل >= يبقى للزمن الأمامي الصالح). */
    const lastActiveMs = Date.parse(record.lastActiveAt);
    const nowMs = Date.parse(this.now());
    /* تعبير واحد فاشل-الإغلاق: NaN لا يحقق >= أبدًا (طابع تالف) والسالب
     * كذلك (ساعة خلفية) — كلاهما يقفل؛ الحد الشامل >= للزمن الأمامي فقط. */
    return {
      ok: true,
      value: !(nowMs >= lastActiveMs) || (nowMs - lastActiveMs) / 60_000 >= record.autoLockMinutes,
    };
  }

  async touchActivity(): Promise<void> {
    const result = await this.store.getLocalSecurity();
    if (!result.ok || result.value === null) return;
    const timestamp = this.now();
    await this.store.saveLocalSecurity({ ...result.value, lastActiveAt: timestamp, updatedAt: timestamp });
  }

  async disable(pin: string): Promise<LockDisableResult> {
    const result = await this.store.getLocalSecurity();
    if (!result.ok) return storageFailure(result.message);
    const record = result.value;
    if (record === null) return { ok: true, value: null };
    /* R11 Lock Remediation (OD-LOCK-ROLLBACK=A — R11-W1B4-NF-002): مسار
     * التعطيل يخضع للسياسة نفسها — لا نافذة أضعف تحت زمن غير قابل للتصديق. */
    const unverifiableBackoffMs = this.backoffWhenTimeUnverifiable(record);
    if (unverifiableBackoffMs !== null) {
      return { ok: false, code: "wrong_pin", message: backoffWaitMessage(unverifiableBackoffMs) };
    }
    /* جسم التعطيل (المطابقة والنافذة والكتابة) في وحدة عمليات الرمز الكسولة —
     * السلوك منقول حرفيًا (DP-05 كما وثقته المجموعة ٦). */
    return loadPinOperations().then(m => m.performDisable(this.store, this.now, record, normalizePin(pin)));
  }
}
