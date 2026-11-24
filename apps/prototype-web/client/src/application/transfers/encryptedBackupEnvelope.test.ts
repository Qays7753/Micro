import { describe, expect, it } from "vitest";
import {
  KEY_SLOT_VERIFICATION_MARKER,
  SEALED_BACKUP_OVERHEAD_BYTES,
  SEALED_BACKUP_VERSION,
  isSealedBackupFile,
  headerToSlotFields,
  keySlotDocument,
  makeVerificationEnvelope,
  openSealedBackup,
  parseSealedBackupHeader,
  randomBytes,
  sealBackupFile,
  verifyKeyAgainstSlot,
} from "./encryptedBackupEnvelope";

/* MNG-LOCAL-03 (أمر المالك 12AA — 2026-11-24): اختبارات مركزة لمظروف النسخ
 * المشفّر — Web Crypto الحقيقي (AES-256-GCM) على الشجرة الحية:
 *  - التفاف/فك دورة كاملة بنص عربي كامل (قيم ومحارف).
 *  - لا نص صافٍ في المظروف (sentinel مالي صريح لا يظهر).
 *  - العبث (بايت واحد) يُرفض — GCM وسم التلاعب.
 *  - المفتاح الخطأ يُرفض.
 *  - nonce جديد لكل تشفير (لا إعادة استخدام أبدًا) — المظروفان مختلفان
 *    والثاني يفتح أيضًا.
 *  - الكشف عن الرأس والفتحة بلا أي مفتاح، وحجم المظروف = النص + ٥١ بايتًا.
 */
const PLAIN = JSON.stringify(
  {
    format: "micro-prototype-local-export",
    data: { amounts: [1250, 300], note: "قيمة مالية حساسة: 1,250.000 دينار" },
  },
  null,
  2,
);

async function freshKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", randomBytes(32), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

describe("MNG-LOCAL-03 — مظروف النسخ المشفّر (AES-256-GCM)", () => {
  it("دورة كاملة: التفاف ثم فك يعيد النص نفسه بايتًا-بايتًا، والمظروف ليس ملف نصي", async () => {
    const key = await freshKey();
    const credentialId = randomBytes(24);
    const salt = randomBytes(16);
    const sealed = await sealBackupFile(PLAIN, key, credentialId, salt);
    expect(isSealedBackupFile(sealed)).toBe(true);
    expect(sealed.length).toBe(
      new TextEncoder().encode(PLAIN).length + SEALED_BACKUP_OVERHEAD_BYTES + credentialId.length,
    );
    const reopened = await openSealedBackup(sealed, key);
    expect(reopened).toBe(PLAIN);
  });

  it("لا نص صافٍ في المظروف — sentinel القيم المالية غير موجود في بايتات الملف", async () => {
    const key = await freshKey();
    const sealed = await sealBackupFile(PLAIN, key, randomBytes(24), randomBytes(16));
    const asText = new TextDecoder("utf-8", { fatal: false }).decode(sealed);
    expect(asText).not.toContain("قيمة مالية حساسة");
    expect(asText).not.toContain("1250");
    expect(asText).not.toContain("micro-prototype-local-export");
    /* الملف لا يبدأ بـ{ (نص JSON) — يبدأ بالسحر الثنائي. */
    expect(sealed[0]).toBe(0x4d);
    expect(sealed[1]).toBe(0x43);
    expect(sealed[2]).toBe(0x52);
    expect(sealed[3]).toBe(0x31);
    expect(sealed[4]).toBe(SEALED_BACKUP_VERSION);
  });

  it("العبث: قلب بايت واحد في النص المشفّر يُرفض بلا أي نص معاد", async () => {
    const key = await freshKey();
    const sealed = await sealBackupFile(PLAIN, key, randomBytes(24), randomBytes(16));
    sealed[sealed.length - 3] ^= 0x01;
    await expect(openSealedBackup(sealed, key)).rejects.toThrow();
  });

  it("المفتاح الخطأ يُرفض (مفتاح جهاز آخر/مفتاح مُعاد إنشاؤه)", async () => {
    const key = await freshKey();
    const other = await freshKey();
    const sealed = await sealBackupFile(PLAIN, key, randomBytes(24), randomBytes(16));
    await expect(openSealedBackup(sealed, other)).rejects.toThrow();
  });

  it("nonce جديد لكل تشفير — مظروفان لنفس النص مختلفان وكلاهما يفتح بالمفتاح نفسه", async () => {
    const key = await freshKey();
    const credentialId = randomBytes(24);
    const salt = randomBytes(16);
    const first = await sealBackupFile(PLAIN, key, credentialId, salt);
    const second = await sealBackupFile(PLAIN, key, credentialId, salt);
    /* nonce (بايت 7+len(cred)+16 .. +12) مختلف — لا إعادة استخدام. */
    const offset = 7 + credentialId.length + 16;
    const firstNonce = first.slice(offset, offset + 12).join(",");
    const secondNonce = second.slice(offset, offset + 12).join(",");
    expect(firstNonce).not.toBe(secondNonce);
    expect(await openSealedBackup(first, key)).toBe(PLAIN);
    expect(await openSealedBackup(second, key)).toBe(PLAIN);
  });

  it("رأس المظروف وصف-ذاتي: معرّف الاعتماد والملح يُستخرجان بلا أي مفتاح", async () => {
    const key = await freshKey();
    const credentialId = randomBytes(24);
    const salt = randomBytes(16);
    const sealed = await sealBackupFile(PLAIN, key, credentialId, salt);
    const header = parseSealedBackupHeader(sealed);
    expect(Array.from(header.credentialId)).toEqual(Array.from(credentialId));
    expect(Array.from(header.prfSalt)).toEqual(Array.from(salt));
    const fields = headerToSlotFields(header);
    expect(fields.prfSalt).toMatch(/^[0-9a-f]{32}$/);
    expect(typeof fields.credentialId).toBe("string");
    expect(fields.credentialId.length).toBeGreaterThan(0);
  });

  it("ملف نصي قائم (JSON) ليس مظروفًا مشفّرًا — الوارث يُميَّز قبل أي فك", () => {
    expect(isSealedBackupFile(new TextEncoder().encode(PLAIN))).toBe(false);
    expect(isSealedBackupFile(new Uint8Array(10))).toBe(false);
  });

  it("مظروف ناقص/نسّابة بنية سيئة يرفضها رأس المظروف قبل أي فك", () => {
    const truncated = randomBytes(SEALED_BACKUP_OVERHEAD_BYTES - 10);
    expect(isSealedBackupFile(truncated)).toBe(false);
    expect(() => parseSealedBackupHeader(truncated)).toThrow();
  });

  it("مظروف التحقق للفتحة: يُفك بالمفتاح الصحيح ويرفض بالمفتاح الخطأ — بلا مادة مفتاح في السجل", async () => {
    const key = await freshKey();
    const other = await freshKey();
    const verification = await makeVerificationEnvelope(key);
    const slot = keySlotDocument(randomBytes(16), randomBytes(24), "2026-11-24T00:00:00.000Z", verification);
    expect(JSON.stringify(slot)).not.toContain(KEY_SLOT_VERIFICATION_MARKER);
    expect(JSON.stringify(slot)).not.toMatch(/"key"|rawKey|keyMaterial/);
    expect(await verifyKeyAgainstSlot(key, slot)).toBe(true);
    expect(await verifyKeyAgainstSlot(other, slot)).toBe(false);
  });
});
