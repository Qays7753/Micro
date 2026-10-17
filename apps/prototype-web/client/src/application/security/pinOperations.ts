/**
 * المجموعة ٥/٦ (عقد ٣٧ — عمليات الرمز الكسولة): كل ما تحتاجه خدمة القفل
 * فقط عند involvement رمز فعلي — اشتقاق البصمة (PBKDF2-SHA256 بمئة وعشرين
 * ألف دورة؛ وsha256 المفردة لمسار الإرث الذي يُرقّى بعد أول فتح صحيح)،
 * والمطابقة، وأجسام التفعيل/الفتح/التعطيل مع عدّاد المحاولات ووقفتها.
 *
 * R11 Lock Remediation (2026-10-15): وحدة كسولة داخل أسرة خدمة القفل —
 * تُحمَّل عند أول عملية رمز فعلًا فلا تدخل كومة الإقلاع ذات السقف المحروس
 * (D-034/ADR-017: gzip 155,300 لا يستوعب أي نمو)، وهي مُسبقة في precache
 * الـPWA فتعمل دون اتصال كما كل الشظايا. الواجهة العامة للخدمة لم تتغير:
 * الأساليب الثلاثة غير متزامنة أصلًا، والتحقق من صحة المدخلات وحارس الزمن
 * الفاشل-الإغلاق (OD-LOCK-ROLLBACK=A) يعملان في الخدمة قبل أي تفويض،
 * والتأكيدات الحتمية للبصمة/الملح/الترقية/العدّاد تثبت التطابق حرفيًا.
 * موثق بسجل إرساء الحجم في نفس الـPR (ARCH-011).
 */
import type { LocalSecurityRecord } from "@/storage/local/types";
import { localSecurityId } from "@/storage/local/types";
import { storageFailure } from "@/application/resultCodes";
import type { Clock } from "@/application/time/clock";
import type {
  LocalLockServiceStore,
  LockDisableResult,
  LockEnableResult,
  LockVerifyResult,
} from "./localLockService";
import { backoffWaitMessage, delayForAttempts } from "./localLockBackoff";

const PIN_KDF_ITERATIONS = 120_000;

export async function pbkdf2Hex(salt: string, pin: string): Promise<string> {
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

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** يُطابق الرمز مع بصمة السجل بالمسار المناسب لإصدارها، ثم يُعيد البصمة
 * الجديدة إن وجب ترقية سجل قديم إلى المشتق البطيء (null = لا ترقية).
 * (منقول حرفيًا من الخدمة — R11 Lock Remediation، نفس الأسرة.) */
export async function verifyPin(
  record: LocalSecurityRecord,
  normalized: string,
): Promise<{ matches: boolean; upgradedHash: string | null }> {
  if (record.hashAlgo === "pbkdf2") {
    const pinHash = await pbkdf2Hex(record.salt, normalized);
    return { matches: pinHash === record.pinHash, upgradedHash: null };
  }
  const legacyHash = await sha256Hex(`${record.salt}:${normalized}`);
  if (legacyHash !== record.pinHash) return { matches: false, upgradedHash: null };
  /* فتح ناجح على السجل القديم: بصمة الرقمية تُرقّى للمشتق البطيء فورًا —
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

/** جسم التفعيل بعد تحقق صحة المدخلات في الخدمة — بصمة جديدة بملح عشوائي. */
export async function performEnable(
  store: LocalLockServiceStore,
  now: Clock,
  normalized: string,
  autoLockMinutes: number | null,
): Promise<LockEnableResult> {
  const salt = randomSalt();
  const pinHash = await pbkdf2Hex(salt, normalized);
  const timestamp = now();
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
  const saved = await store.saveLocalSecurity(record);
  if (!saved.ok) return storageFailure(saved.message);
  return { ok: true, value: saved.value };
}

/** جسم الفتح بعد حارس الزمن الفاشل-الإغلاق في الخدمة — (منقول حرفيًا). */
export async function performUnlock(
  store: LocalLockServiceStore,
  now: Clock,
  record: LocalSecurityRecord,
  normalized: string | null,
): Promise<LockVerifyResult> {
  if (normalized !== null) {
    const { matches, upgradedHash } = await verifyPin(record, normalized);
    if (matches) {
      await store.saveLocalSecurity({
        ...record,
        ...(upgradedHash === null ? {} : { pinHash: upgradedHash, hashAlgo: "pbkdf2" as const }),
        failedAttempts: 0,
        lastFailedAt: null,
        lastActiveAt: now(),
        updatedAt: now(),
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
    const elapsed = Date.parse(now()) - Date.parse(record.lastFailedAt);
    if (elapsed >= 0 && elapsed < backoffMs) {
      return {
        ok: true,
        value: { unlocked: false, failedAttempts: previousAttempts, retryInMs: backoffMs - elapsed },
      };
    }
  }
  const failedAttempts = previousAttempts + 1;
  await store.saveLocalSecurity({
    ...record,
    failedAttempts,
    lastFailedAt: now(),
    updatedAt: now(),
  });
  return {
    ok: true,
    value: { unlocked: false, failedAttempts, retryInMs: delayForAttempts(failedAttempts) },
  };
}

/** جسم التعطيل بعد حارس الزمن الفاشل-الإغلاق في الخدمة — (منقول حرفيًا). */
export async function performDisable(
  store: LocalLockServiceStore,
  now: Clock,
  record: LocalSecurityRecord,
  normalized: string | null,
): Promise<LockDisableResult> {
  if (normalized !== null) {
    const { matches } = await verifyPin(record, normalized);
    if (matches) {
      /* التعطيل يحذف السجل نهائيًا — لا بصمة ولا ملح يبقيان على الجهاز. */
      const removed = await store.deleteLocalSecurity();
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
    const elapsed = Date.parse(now()) - Date.parse(record.lastFailedAt);
    if (elapsed >= 0 && elapsed < backoffMs) {
      return { ok: false, code: "wrong_pin", message: backoffWaitMessage(backoffMs - elapsed) };
    }
  }
  await store.saveLocalSecurity({
    ...record,
    failedAttempts: previousAttempts + 1,
    lastFailedAt: now(),
    updatedAt: now(),
  });
  return { ok: false, code: "wrong_pin", message: "الرمز غير صحيح — التعطيل يحتاج الرمز الحالي." };
}
