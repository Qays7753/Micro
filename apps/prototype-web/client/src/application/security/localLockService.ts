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

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

/* المجموعة ٦ (تدقيق A1 — SP-02): بصمة مفردة قابلة للكسر بجدول مسبق على
 * مساحة أرقام صغيرة؛ المشتق البطيء PBKDF2-SHA256 بمئة وعشرين ألف دورة
 * يجعل كل تخمين محلي مكلفًا زمنيًا. الدالة لا تعتمد أي شيء بعيد — WebCrypto
 * نفسه المستخدم في sha256Hex أعلاه. */
const PIN_KDF_ITERATIONS = 120_000;

async function pbkdf2Hex(salt: string, pin: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: PIN_KDF_ITERATIONS },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** يُطابق الرمز مع بصمة السجل بالمسار المناسب لإصدارها، ثم يُعيد البصمة الجديدة
 * إن وجب ترقية سجل قديم إلى المشتق البطيء (null = لا ترقية). */
async function verifyPin(
  record: LocalSecurityRecord,
  normalized: string,
): Promise<{ matches: boolean; upgradedHash: string | null }> {
  if (record.hashAlgo === "pbkdf2") {
    const pinHash = await pbkdf2Hex(record.salt, normalized);
    return { matches: pinHash === record.pinHash, upgradedHash: null };
  }
  const legacyHash = await sha256Hex(`${record.salt}:${normalized}`);
  if (legacyHash !== record.pinHash) return { matches: false, upgradedHash: null };
  /* فتح ناجح على السجل القديم: رقمية البصمة تُرقّى للمشتق البطيء فورًا —
   * لا يبقى سجل ضعيف على الجهاز بعد أن أثبت المالك رمزه. */
  const upgradedHash = await pbkdf2Hex(record.salt, normalized);
  return { matches: true, upgradedHash };
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizePin(pin: string): string | null {
  const trimmed = pin.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  if (trimmed.length < MIN_PIN_LENGTH || trimmed.length > MAX_PIN_LENGTH) return null;
  return trimmed;
}

/** محاولات متتالية تستوجب وقفة قصيرة قبل المحاولة التالية (احترام آدمي بلا قفل دائم). */
function delayForAttempts(failedAttempts: number): number {
  if (failedAttempts >= 8) return 30_000;
  if (failedAttempts >= 5) return 10_000;
  if (failedAttempts >= 3) return 3_000;
  return 0;
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
    if (backoffMs <= 0 || !record.lastFailedAt) return null;
    const lastFailedMs = Date.parse(record.lastFailedAt);
    const nowMs = Date.parse(this.now());
    if (Number.isNaN(lastFailedMs) || Number.isNaN(nowMs) || nowMs < lastFailedMs) return backoffMs;
    return null;
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
    const salt = randomSalt();
    const pinHash = await pbkdf2Hex(salt, normalized);
    const timestamp = this.now();
    const record: LocalSecurityRecord = {
      id: localSecurityId,
      pinHash,
      salt,
      hashAlgo: "pbkdf2",
      autoLockMinutes,
      lastActiveAt: timestamp,
      failedAttempts: 0,
      lastFailedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const saved = await this.store.saveLocalSecurity(record);
    if (!saved.ok) return storageFailure(saved.message);
    return { ok: true, value: saved.value };
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
    const normalized = normalizePin(pin);
    if (normalized !== null) {
      const { matches, upgradedHash } = await verifyPin(record, normalized);
      if (matches) {
        await this.store.saveLocalSecurity({
          ...record,
          ...(upgradedHash === null ? {} : { pinHash: upgradedHash, hashAlgo: "pbkdf2" as const }),
          failedAttempts: 0,
          lastFailedAt: null,
          lastActiveAt: this.now(),
          updatedAt: this.now(),
        });
        return { ok: true, value: { unlocked: true, failedAttempts: 0 } };
      }
    }
    /* المجموعة ٦ (تدقيق A1 — SP-04): الوقفة التصاعدية مُنفَّذة لا معلنة فقط —
     * المحاولة داخل نافذة الوقفة تُرفض مبكرًا بلا زيادة العدّاد، فلا يُبنى قفل
     * دائم من نقر متكرر، ويبقى العدّاد المرئي صادقًا. */
    const previousAttempts = record.failedAttempts;
    const backoffMs = delayForAttempts(previousAttempts);
    if (backoffMs > 0 && record.lastFailedAt) {
      const elapsed = Date.parse(this.now()) - Date.parse(record.lastFailedAt);
      if (elapsed >= 0 && elapsed < backoffMs) {
        return {
          ok: true,
          value: { unlocked: false, failedAttempts: previousAttempts, retryInMs: backoffMs - elapsed },
        };
      }
    }
    const failedAttempts = previousAttempts + 1;
    await this.store.saveLocalSecurity({
      ...record,
      failedAttempts,
      lastFailedAt: this.now(),
      updatedAt: this.now(),
    });
    return {
      ok: true,
      value: { unlocked: false, failedAttempts, retryInMs: delayForAttempts(failedAttempts) },
    };
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
    if (Number.isNaN(lastActiveMs) || Number.isNaN(nowMs)) return { ok: true, value: true };
    const elapsedMinutes = (nowMs - lastActiveMs) / 60_000;
    if (elapsedMinutes < 0) return { ok: true, value: true };
    return { ok: true, value: elapsedMinutes >= record.autoLockMinutes };
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
      return {
        ok: false,
        code: "wrong_pin",
        message: `انتظر قليلًا قبل المحاولة التالية (${Math.ceil(unverifiableBackoffMs / 1000)} ثانية تقريبًا).`,
      };
    }
    const normalized = normalizePin(pin);
    if (normalized !== null) {
      const { matches, upgradedHash } = await verifyPin(record, normalized);
      if (matches) {
        /* التعطيل يحذف السجل نهائيًا — لا بصمة ولا ملح يبقيان على الجهاز. */
        const removed = await this.store.deleteLocalSecurity();
        if (!removed.ok) return storageFailure(removed.message);
        return { ok: true, value: null };
      }
    }
    /* المجموعة ٦ (تدقيق A1 — DP-05): مسار التعطيل يخضع لنفس عدّاد المحاولات
     * والوقفة المُنفَّذة — النافذة التي تُفتح بلا قفل (SP-01) لا تُستعمل لهدر
     * التخمين بلا كلفة. */
    const previousAttempts = record.failedAttempts;
    const backoffMs = delayForAttempts(previousAttempts);
    if (backoffMs > 0 && record.lastFailedAt) {
      const elapsed = Date.parse(this.now()) - Date.parse(record.lastFailedAt);
      if (elapsed >= 0 && elapsed < backoffMs) {
        return {
          ok: false,
          code: "wrong_pin",
          message: `انتظر قليلًا قبل المحاولة التالية (${Math.ceil((backoffMs - elapsed) / 1000)} ثانية تقريبًا).`,
        };
      }
    }
    await this.store.saveLocalSecurity({
      ...record,
      failedAttempts: previousAttempts + 1,
      lastFailedAt: this.now(),
      updatedAt: this.now(),
    });
    return { ok: false, code: "wrong_pin", message: "الرمز غير صحيح — التعطيل يحتاج الرمز الحالي." };
  }
}
