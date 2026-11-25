/**
 * MNG-LOCAL-03 (أمر المالك 12AA — 2026-11-24): مظروف نسخ Micro المشفّر — غلاف
 * ثنائي واحد لكل ملفات النسخ المنزّلة الجديدة. AES-256-GCM من Web Crypto فقط
 * (لا تشفير مخصص)، وnonce عشوائي 96-بت يُولَّد جديدًا لكل تشفير (لا إعادة
 * استخدام أبدًا)، والمفتاح غير قابل للاستخراج ولا يغادر الجلسة/الذاكرة.
 *
 * صيغة المظروف (ثنائية عمدًا لا JSON بترميز base64 — كي لا يتضخم الملف
 * 1.33× فيتجاوز سقف حجم الاستيراد القائم عند الحدود القصوى الصادقة؛ المظروف
 * الثنائي يزيد الملف نحو 30 بايتًا فقط فوق النص الصافي، فلا يُرفع سقف ولا
 * يُلَيَّن أي حد قائم):
 *
 *   بايت 0..3   السحر "MCR1" (0x4D 0x43 0x52 0x31)
 *   بايت 4      إصدار المظروف (1)
 *   بايت 5..6   طول معرّف الاعتماد u16 صغير-النهاية
 *   بايت 7..    معرّف الاعتماد (bytes كما أعاده المتصفح)
 *   +16         ملح PRF (16 بايتًا)
 *   +12         nonce التشفير هذا (96-بت)
 *   الباقي      النص المشفّر + وسم GCM (16 بايتًا يضيفها Web Crypto)
 *
 * الملف وصف-ذاتي: الاستيراد يقرأ معرّف الاعتماد والملح من المظروف نفسه
 * فيجري مراسم تأكيد الجهاز مقيدة بهما — لا يحتاج أي حالة على الجهاز، ويصمد
 * على أي جهاز يملك الاعتماد نفسه (مفتاح منصة متزامن) ويفشل مغلقًا فيما
 * عدا ذلك. الملفات النصية القديمة تبقى مقبولة كوارث عبر مسار النص القائم.
 */
import { localDataKeySlotId, type LocalDataKeySlot } from "@/storage/local/types";

export const SEALED_BACKUP_MAGIC: readonly [number, number, number, number] = [0x4d, 0x43, 0x52, 0x31];
export const SEALED_BACKUP_VERSION = 1;
/** إجمالي ثابت overhead فوق النص: سحر(4)+إصدار(1)+طول(2)+ملح(16)+nonce(12)+وسم(16) = 51. */
export const SEALED_BACKUP_OVERHEAD_BYTES = 4 + 1 + 2 + 16 + 12 + 16;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** علامة تحقق فتحة المفتاح — سطر ثابت يُشفَّر عند الإنشاء ويُفكّ عند كل مراسم. */
export const KEY_SLOT_VERIFICATION_MARKER = "micro-local-data-key-verification-v1";

/* ---- helpers ---- */

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

function hexToBytes(hex: string, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string, expectedLength?: number): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (expectedLength !== undefined && bytes.length !== expectedLength) {
    throw new Error(`طول غير متوقع لقيمة base64url (متوقع ${expectedLength}، وصل ${bytes.length}).`);
  }
  return bytes;
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function view(buffer: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (buffer instanceof Uint8Array) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  }
  return buffer;
}

/* ---- detection ---- */

/** هل هذه البايتات مظروف نسخ مشفّر؟ فحص السحر والبنية الدنيا فقط — بلا أي فك. */
export function isSealedBackupFile(bytes: Uint8Array): boolean {
  if (bytes.length < SEALED_BACKUP_OVERHEAD_BYTES + 1) return false;
  return (
    bytes[0] === SEALED_BACKUP_MAGIC[0] &&
    bytes[1] === SEALED_BACKUP_MAGIC[1] &&
    bytes[2] === SEALED_BACKUP_MAGIC[2] &&
    bytes[3] === SEALED_BACKUP_MAGIC[3]
  );
}

/* ---- header ---- */

export type SealedBackupHeader = {
  version: number;
  credentialId: Uint8Array;
  prfSalt: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
};

/** قراءة رأس المظروف — ترمي عند بنية غير صالحة (يحملها المستدعي برسالة صادقة). */
export function parseSealedBackupHeader(bytes: Uint8Array): SealedBackupHeader {
  if (!isSealedBackupFile(bytes)) throw new Error("ليس ملف نسخ مشفّرًا صالحًا.");
  const version = bytes[4];
  if (version !== SEALED_BACKUP_VERSION) {
    throw new Error(`إصدار ملف النسخ المشفّر غير مدعوم في هذا الإصدار من التطبيق (${version}).`);
  }
  const credentialLength = bytes[5] | (bytes[6] << 8);
  const headerEnd = 7 + credentialLength + 16 + 12;
  if (bytes.length < headerEnd + 16) {
    throw new Error("ملف النسخ المشفّر ناقص أو تالف — بقي طول ثابت.");
  }
  let offset = 7;
  const credentialId = bytes.slice(offset, offset + credentialLength);
  offset += credentialLength;
  const prfSalt = bytes.slice(offset, offset + 16);
  offset += 16;
  const nonce = bytes.slice(offset, offset + 12);
  offset += 12;
  const ciphertext = bytes.slice(offset);
  return { version, credentialId, prfSalt, nonce, ciphertext };
}

/* ---- seal / open ---- */

export async function sealBackupFile(
  plaintext: string,
  key: CryptoKey,
  credentialId: ArrayBuffer | Uint8Array,
  prfSalt: Uint8Array,
): Promise<Uint8Array> {
  const credentialBytes = credentialId instanceof Uint8Array ? credentialId : new Uint8Array(credentialId);
  if (credentialBytes.length > 0xffff) throw new Error("معرّف الاعتماد أطول من المسموح في المظروف.");
  const nonce = randomBytes(12);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, key, encoder.encode(plaintext));
  const total = 7 + credentialBytes.length + 16 + 12 + cipher.byteLength;
  const sealed = new Uint8Array(total);
  sealed.set(SEALED_BACKUP_MAGIC, 0);
  sealed[4] = SEALED_BACKUP_VERSION;
  sealed[5] = credentialBytes.length & 0xff;
  sealed[6] = (credentialBytes.length >> 8) & 0xff;
  let offset = 7;
  sealed.set(credentialBytes, offset);
  offset += credentialBytes.length;
  sealed.set(prfSalt.slice(0, 16), offset);
  offset += 16;
  sealed.set(nonce, offset);
  offset += 12;
  sealed.set(new Uint8Array(cipher), offset);
  return sealed;
}

/** فك المظروف — يرمي (GCM) عند أي عبث أو مفتاح غير مطابق؛ لا يُبدي أي جزء نصي. */
export async function openSealedBackup(bytes: Uint8Array, key: CryptoKey): Promise<string> {
  const header = parseSealedBackupHeader(bytes);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: header.nonce, tagLength: 128 },
    key,
    view(header.ciphertext),
  );
  return decoder.decode(plain);
}

/* ---- key slot mapping (hex/base64url للسجل المفهرس) ---- */

export function headerToSlotFields(header: SealedBackupHeader): { credentialId: string; prfSalt: string } {
  return { credentialId: bytesToBase64Url(header.credentialId), prfSalt: bytesToHex(header.prfSalt) };
}

export function slotFieldsToBytes(slot: Pick<LocalDataKeySlot, "credentialId" | "prfSalt">): {
  credentialId: Uint8Array;
  prfSalt: Uint8Array;
} {
  return {
    credentialId: base64UrlToBytes(slot.credentialId),
    prfSalt: hexToBytes(slot.prfSalt, 16),
  };
}

export function makeVerificationEnvelope(key: CryptoKey): Promise<LocalDataKeySlot["verification"]> {
  const nonce = randomBytes(12);
  return crypto.subtle
    .encrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      key,
      encoder.encode(KEY_SLOT_VERIFICATION_MARKER),
    )
    .then(cipher => ({
      nonce: bytesToBase64Url(nonce),
      ciphertext: bytesToBase64Url(new Uint8Array(cipher)),
    }));
}

export async function verifyKeyAgainstSlot(key: CryptoKey, slot: LocalDataKeySlot): Promise<boolean> {
  try {
    const nonce = base64UrlToBytes(slot.verification.nonce, 12);
    const cipher = base64UrlToBytes(slot.verification.ciphertext);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      key,
      view(cipher),
    );
    return decoder.decode(plain) === KEY_SLOT_VERIFICATION_MARKER;
  } catch {
    return false;
  }
}

export function keySlotDocument(prfSalt: Uint8Array, credentialId: ArrayBuffer | Uint8Array, createdAt: string, verification: LocalDataKeySlot["verification"]): LocalDataKeySlot {
  const credentialBytes = credentialId instanceof Uint8Array ? credentialId : new Uint8Array(credentialId);
  return {
    id: localDataKeySlotId,
    prfSalt: bytesToHex(prfSalt),
    credentialId: bytesToBase64Url(credentialBytes),
    createdAt,
    verification,
  };
}
