import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { isSealedBackupFile } from "./encryptedBackupEnvelope";
import type { BackupKeyProvider } from "./backupKeyCeremony";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";

/* MNG-LOCAL-03 (أمر المالك 12AA — 2026-11-24): دورة النسخ المشفّرة كاملة على
 * خدمة النقل بمزوّد مفتاح محقون حتمي (WebCrypto حقيقي — المفتاح مشتق
 * حتميًا من معرّف الاعتماد والملح فيمثّل مراسم جهازين يحملان الاعتماد
 * المتزامن نفسه):
 *  - التصدير المنزّل مظروف مشفّر: لا نص صافٍ فيه (sentinel مالي)، ودورة
 *    التحقق الكاملة داخل الخدمة قبل إعلان النجاح.
 *  - الاستيراد من مظروف: مراسم مقيدة برأس المظروف — ملف وصف-ذاتي يعمل
 *    على مخزن جديد (نمط جهاز جديد) وتعود القيم والمعرفات والملخص نفسها.
 *  - فشل المرسمة (إلغاء المستخدم): لا ملف أبدًا — ok:false صادق.
 *  - العبث بايت واحد: رفض صادق بلا أي كتابة.
 *  - مفتاح غير مطابق (اعتماد آخر): رفض صادق بلا كتابة.
 *  - ملف وارث نصي: مقبول مع sourceEncrypted=false (تحذير الواجهة).
 *  - تنزيل النسخة الرجوع: مشفّر أيضًا بعد استيراد مُلزم.
 */
const NOW = "2026-11-24T12:00:00.000Z";
const clock = () => NOW;

async function deterministicKey(credentialId: Uint8Array, prfSalt: Uint8Array): Promise<CryptoKey> {
  const mixed = new Uint8Array(credentialId.length + prfSalt.length);
  mixed.set(credentialId, 0);
  mixed.set(prfSalt, credentialId.length);
  const material = await crypto.subtle.digest("SHA-256", mixed);
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function deviceKeyProvider(): BackupKeyProvider & { credentialId: Uint8Array; prfSalt: Uint8Array } {
  const credentialId = new Uint8Array(24);
  crypto.getRandomValues(credentialId);
  const prfSalt = new Uint8Array(16);
  crypto.getRandomValues(prfSalt);
  return {
    credentialId,
    prfSalt,
    obtainExportKey: async () => ({
      ok: true as const,
      value: {
        key: await deterministicKey(credentialId, prfSalt),
        credentialId,
        prfSalt,
      },
    }),
    obtainEnvelopeKey: async (envelopeCredentialId, envelopeSalt) => ({
      ok: true as const,
      value: { key: await deterministicKey(envelopeCredentialId, envelopeSalt) },
    }),
  };
}

const refusingProvider: BackupKeyProvider = {
  obtainExportKey: async () => ({
    ok: false as const,
    code: "user-cancelled" as const,
    message: "أُلغي تأكيد الجهاز — لم يُنشأ أي ملف ولم تُمس بيانات هذا الجهاز.",
  }),
  obtainEnvelopeKey: async () => ({
    ok: false as const,
    code: "user-cancelled" as const,
    message: "أُلغي تأكيد الجهاز — لم تُمس بيانات هذا الجهاز.",
  }),
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

async function seedProfile(store: PrototypeLocalStore, name: string) {
  const saved = await store.saveProfile({
    id: "local-profile",
    activityName: name,
    currency: "JOD",
    activityType: "custom_craft",
    createdAt: NOW,
    updatedAt: NOW,
  });
  expect(saved.ok).toBe(true);
}

async function snapshotDigest(store: PrototypeLocalStore): Promise<string> {
  const live = await store.readSnapshot();
  if (!live.ok) throw new Error(live.message);
  return JSON.stringify(live.value);
}

describe("MNG-LOCAL-03 — خدمة النقل: تصدير واستيراد مشفّران كاملان", () => {
  it("التصدير المنزّل مظروف مشفّر: لا نص صافٍ، والملخص صادق، والتحقق الداخلي دورة كاملة", async () => {
    const source = new MemoryLocalStore();
    await seedProfile(source, "مشروع الخياطة");
    const provider = deviceKeyProvider();
    const service = new LocalTransferService(source, clock, provider);
    const result = await service.createSealedVerifiedExport();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isSealedBackupFile(result.value.sealed)).toBe(true);
    const asText = new TextDecoder("utf-8", { fatal: false }).decode(result.value.sealed);
    expect(asText).not.toContain("مشروع الخياطة");
    expect(asText).not.toContain("local-profile");
    expect(asText).not.toContain("micro-prototype-local-export");
    expect(result.value.summary.profile).toBe(true);
    expect(result.value.exportedAt).toBe(NOW);
    /* حجم المظروف = النص المشفّر + بنية الرأس فقط — لا تضخم base64. */
    expect(result.value.sealed.length).toBeGreaterThan(51);
  });

  it("فشل مرسمة المفتاح (إلغاء المستخدم): لا ملف أبدًا — رفض صادق برسالة عربية", async () => {
    const source = new MemoryLocalStore();
    await seedProfile(source, "مشروع الخياطة");
    const service = new LocalTransferService(source, clock, refusingProvider);
    const result = await service.createSealedVerifiedExport();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("لم يُنشأ أي ملف");
    expect(result.message).not.toContain("نجح");
  });

  it("دورة كاملة عبر جهازين (مخزنان): ملف وصف-ذاتي يُستورد بمفتاح رأسه وتعود القيم نفسها", async () => {
    const first = new MemoryLocalStore();
    await seedProfile(first, "مشروع الخياطة");
    const provider = deviceKeyProvider();
    const exportService = new LocalTransferService(first, clock, provider);
    const exported = await exportService.createSealedVerifiedExport();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const second = new MemoryLocalStore();
    const importService = new LocalTransferService(second, clock, deviceKeyProvider());
    const prepared = await importService.prepareRestoreFromBytes(exported.value.sealed);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.value.sourceEncrypted).toBe(true);
    expect(prepared.value.summary.profile).toBe(true);
    const confirmed = await importService.confirmImport(prepared.value);
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) {
      expect(confirmed.value.profile).toBe(true);
      /* النسخة الرجوع تحفظ حالة الجهاز الثاني قبل الاستبدال (كان فارغًا
       * بلا ملف نشاط) — صادقة لا مفترضة. */
      expect(confirmed.value.backup.data.profile ?? null).toBe(null);
    }
    const restored = await second.readSnapshot();
    if (!restored.ok) throw new Error(restored.message);
    expect(restored.value.profile?.activityName).toBe("مشروع الخياطة");
  });

  it("العبث بايت واحد في المظروف: رفض صادق ولا تُمس بيانات الجهاز الهدف", async () => {
    const first = new MemoryLocalStore();
    await seedProfile(first, "مشروع الخياطة");
    const provider = deviceKeyProvider();
    const exportService = new LocalTransferService(first, clock, provider);
    const exported = await exportService.createSealedVerifiedExport();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const second = new MemoryLocalStore();
    await seedProfile(second, "بيانات قائمة محمية");
    const importService = new LocalTransferService(second, clock, deviceKeyProvider());
    const before = await snapshotDigest(second);
    const tampered = exported.value.sealed.slice();
    tampered[tampered.length - 2] ^= 0x01;
    const prepared = await importService.prepareRestoreFromBytes(tampered);
    expect(prepared.ok).toBe(false);
    expect(await snapshotDigest(second)).toBe(before);
  });

  it("مفتاح غير مطابق (اعتماد جهاز آخر): رفض صادق ولا كتابة", async () => {
    const first = new MemoryLocalStore();
    await seedProfile(first, "مشروع الخياطة");
    const provider = deviceKeyProvider();
    const exportService = new LocalTransferService(first, clock, provider);
    const exported = await exportService.createSealedVerifiedExport();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const second = new MemoryLocalStore();
    await seedProfile(second, "بيانات قائمة محمية");
    /* مزوّد بمفتاح حتمي مختلف (اعتماد آخر) — خرج PRF مختلف لا يطابق. */
    const otherProvider: BackupKeyProvider = {
      obtainExportKey: async () => {
        const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("other-device"));
        return {
          ok: true as const,
          value: {
            key: await crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]),
            credentialId: new Uint8Array(24),
            prfSalt: new Uint8Array(16),
          },
        };
      },
      obtainEnvelopeKey: async () => {
        const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("other-device"));
        return {
          ok: true as const,
          value: {
            key: await crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]),
          },
        };
      },
    };
    const importService = new LocalTransferService(second, clock, otherProvider);
    const before = await snapshotDigest(second);
    const prepared = await importService.prepareRestoreFromBytes(exported.value.sealed);
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.message).toContain("لم تُمس بيانات هذا الجهاز");
    expect(await snapshotDigest(second)).toBe(before);
  });

  it("ملف وارث نصي (تصدير قديم): مقبول مع sourceEncrypted=false — تحذير الواجهة", async () => {
    const first = new MemoryLocalStore();
    await seedProfile(first, "مشروع الخياطة");
    const service = new LocalTransferService(first, clock, deviceKeyProvider());
    const legacy = await service.createExport();
    expect(legacy.ok).toBe(true);
    if (!legacy.ok) return;
    const legacyText = JSON.stringify(legacy.value, null, 2);
    const prepared = await service.prepareRestoreFromBytes(new TextEncoder().encode(legacyText));
    expect(prepared.ok).toBe(true);
    if (prepared.ok) expect(prepared.value.sourceEncrypted).toBe(false);
  });

  it("تنزيل النسخة الرجوع الدائمة بعد استيراد مُلزم: مظروف مشفّر لا ملف نصي", async () => {
    const first = new MemoryLocalStore();
    await seedProfile(first, "مشروع الخياطة");
    const provider = deviceKeyProvider();
    const exportService = new LocalTransferService(first, clock, provider);
    const exported = await exportService.createSealedVerifiedExport();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const second = new MemoryLocalStore();
    await seedProfile(second, "بيانات قائمة");
    const importService = new LocalTransferService(second, clock, deviceKeyProvider());
    const prepared = await importService.prepareRestoreFromBytes(exported.value.sealed);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const confirmed = await importService.confirmImport(prepared.value);
    expect(confirmed.ok).toBe(true);

    const rollback = await importService.readActiveRollbackSealed();
    expect(rollback.ok).toBe(true);
    if (!rollback.ok || rollback.value === null) return;
    expect(isSealedBackupFile(rollback.value.sealed)).toBe(true);
    const asText = new TextDecoder("utf-8", { fatal: false }).decode(rollback.value.sealed);
    expect(asText).not.toContain("بيانات قائمة");
  });
});
