import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { GuidedOpeningImportService } from "./guidedOpeningImportService";
import { isSealedBackupFile, sealBackupFile } from "./encryptedBackupEnvelope";
import type { BackupKeyProvider } from "./backupKeyCeremony";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

/* MNG-LOCAL-03 (أمر المالك 12AA — 2026-11-24): مدخل الإدخال الافتتاحي
 * الموجّه بالبايتات — نفس مظروف النسخ المشفّر ومفتاح الجهاز:
 *  - ملف مظروف يُفتح بمرسمة مقيدة برأسه ثم بوابات النص القائمة نفسها.
 *  - الملف الوارث النصي يُقبل كما كان مع sourceEncrypted=false.
 *  - مرسمة فاشلة/عبث: رفض مغلق بلا أي كتابة.
 */
const NOW = "2026-11-24T12:00:00.000Z";
const clock = () => NOW;

const VALID_GUIDED = {
  format: "micro-guided-opening-import",
  version: 1,
  importId: "opening-2026-11-24-encrypted",
  profile: {
    activityName: "مخبز صغير",
    currency: "JOD",
    activityType: "custom_craft",
    source: "عد يدوي",
    knowledge: "known",
    occurredOn: "2026-08-01",
    note: "بداية معلنة",
  },
  cashWallets: [
    {
      id: "drawer",
      name: "درج",
      kind: "cash_drawer",
      openingMinor: 12500,
      source: "عد يدوي",
      knowledge: "known",
      occurredOn: "2026-08-01",
      note: "عد المالك",
    },
  ],
  materials: [
    {
      id: "flour",
      name: "طحين",
      unit: "kilogram",
      openingQuantityMilli: 2500,
      openingValueMinor: 8750,
      source: "جرد",
      knowledge: "estimated",
      occurredOn: "2026-08-01",
      note: "تقدير آخر شراء",
    },
  ],
};

const CREDENTIAL = new Uint8Array(24);
crypto.getRandomValues(CREDENTIAL);
const SALT = new Uint8Array(16);
crypto.getRandomValues(SALT);

async function keyFor(): Promise<CryptoKey> {
  const mixed = new Uint8Array(CREDENTIAL.length + SALT.length);
  mixed.set(CREDENTIAL, 0);
  mixed.set(SALT, CREDENTIAL.length);
  const material = await crypto.subtle.digest("SHA-256", mixed);
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

const provider: BackupKeyProvider = {
  obtainExportKey: async () => ({ ok: true, value: { key: await keyFor(), credentialId: CREDENTIAL, prfSalt: SALT } }),
  obtainEnvelopeKey: async () => ({ ok: true, value: { key: await keyFor() } }),
};

const refusing: BackupKeyProvider = {
  obtainExportKey: async () => ({ ok: false, code: "user-cancelled", message: "أُلغي تأكيد الجهاز — لم تُمس بيانات هذا الجهاز." }),
  obtainEnvelopeKey: async () => ({ ok: false, code: "user-cancelled", message: "أُلغي تأكيد الجهاز — لم تُمس بيانات هذا الجهاز." }),
};

async function clearDatabases() {
  const request = indexedDB.deleteDatabase("micro-prototype-local");
  await new Promise<void>((resolve, reject) => {
    request.onerror = () => reject(new Error("main delete error"));
    request.onsuccess = () => resolve();
    request.onblocked = () => reject(new Error("main delete BLOCKED"));
  });
  const restore = indexedDB.deleteDatabase("micro-prototype-restore");
  await new Promise<void>((resolve, reject) => {
    restore.onerror = () => reject(new Error("restore delete error"));
    restore.onsuccess = () => resolve();
    restore.onblocked = () => reject(new Error("restore delete BLOCKED"));
  });
}
afterEach(clearDatabases);

function service(provider: BackupKeyProvider): GuidedOpeningImportService {
  return new GuidedOpeningImportService(new MemoryLocalStore(), async () => {
    throw new Error("لا يُستدعى في هذه الحالات");
  }, clock, provider);
}

describe("MNG-LOCAL-03 — الإدخال الافتتاحي بالبايتات: مظروف مشفّر ووارث نصي", () => {
  it("ملف مظروف مشفّر: يُفتح بمفتاح رأسه ويُعَد مثل النص تمامًا — sourceEncrypted=true", async () => {
    const key = await keyFor();
    const sealed = await sealBackupFile(JSON.stringify(VALID_GUIDED), key, CREDENTIAL, SALT);
    expect(isSealedBackupFile(sealed)).toBe(true);
    const prepared = await service(provider).prepareFromBytes(sealed);
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.value.sourceEncrypted).toBe(true);
      expect(prepared.value.file.importId).toBe(VALID_GUIDED.importId);
      expect(prepared.value.summary.acceptedWallets).toBe(1);
      expect(prepared.value.summary.acceptedMaterials).toBe(1);
    }
  });

  it("الملف الوارث النصي كما كان: مقبول مع sourceEncrypted=false", async () => {
    const prepared = await service(provider).prepareFromBytes(
      new TextEncoder().encode(JSON.stringify(VALID_GUIDED)),
    );
    expect(prepared.ok).toBe(true);
    if (prepared.ok) expect(prepared.value.sourceEncrypted).toBe(false);
  });

  it("مرسمة فاشلة (إلغاء المستخدم): رفض مغلق بلا أي كتابة", async () => {
    const key = await keyFor();
    const sealed = await sealBackupFile(JSON.stringify(VALID_GUIDED), key, CREDENTIAL, SALT);
    const prepared = await service(refusing).prepareFromBytes(sealed);
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.message).toContain("لم تُمس بيانات هذا الجهاز");
  });

  it("عبث بايت واحد في المظروف: رفض صادق قبل أي تحليل أو كتابة", async () => {
    const key = await keyFor();
    const sealed = await sealBackupFile(JSON.stringify(VALID_GUIDED), key, CREDENTIAL, SALT);
    sealed[sealed.length - 1] ^= 0x01;
    const prepared = await service(provider).prepareFromBytes(sealed);
    expect(prepared.ok).toBe(false);
  });

  it("النص الصافي غير موجود في المظروف (sentinel النشاط محجوب)", async () => {
    const key = await keyFor();
    const sealed = await sealBackupFile(JSON.stringify(VALID_GUIDED), key, CREDENTIAL, SALT);
    const asText = new TextDecoder("utf-8", { fatal: false }).decode(sealed);
    expect(asText).not.toContain("مخبز صغير");
    expect(asText).not.toContain("micro-guided-opening-import");
  });
});
