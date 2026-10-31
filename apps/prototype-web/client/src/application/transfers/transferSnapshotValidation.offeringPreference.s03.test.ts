import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import {
  localExportFormat,
  localExportVersion,
  localSchemaVersion,
  type PrototypeLocalStore,
} from "@/storage/local/types";
import { exportCountsOf } from "./transferCounters";
import { syncSha256Hex } from "@/lib/syncSha256";

/*
 * S03 (UNIT-038 P3.2 / UNIT-001 P3.2 — عقد §5.1/§15.1): تفضيل ما يقدمه
 * المشروع داخل سجل التفضيلات بالملف — حقل اختياري اختيار صادق: الغياب أو
 * null (محايد) أو واحدة من قيم المعجم المغلق حصرًا؛ أي قيمة أخرى ترفض
 * الملف كله بلا استيراد أفضل-جهد، وبقيت بيانات الجهاز دون تغيير. الملفات
 * القديمة بلا الحقل مقبولة كما هي (ترحيل الصدق: لا يُطلب الحقل أبدًا).
 */

const store = {} as PrototypeLocalStore; /* prepareImport لا يلمس التخزين — نقي. */
const emptySnapshot = LocalTransferService.emptySnapshot();

function envelope(data: unknown): string {
  return JSON.stringify({
    format: localExportFormat,
    version: localExportVersion,
    schemaVersion: localSchemaVersion,
    exportedAt: "2026-10-28T10:00:00.000Z",
    data,
    integrity: { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(data)) },
    counts: exportCountsOf(data as Parameters<typeof exportCountsOf>[0]),
  });
}

/* سجل تفضيلات صالح كامل بلا حقل العرض — الحالة التراثية القانونية. */
function legacyPreferences() {
  return {
    id: "local-preferences",
    theme: "light",
    dailyScheduleCapacityMinutes: null,
    workMode: null,
    actualTimeTrackingEnabled: false,
    installBannerDismissedAt: null,
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

describe("S03 — offeringPreference in the import wire: optional, neutral, closed vocabulary", () => {
  it("a legacy preferences record without the field imports as-is (old files never break)", () => {
    const service = new LocalTransferService(store);
    const withLegacy = { ...emptySnapshot, preferences: legacyPreferences() };
    const prepared = service.prepareImport(envelope(withLegacy));
    expect(prepared.ok).toBe(true);
  });

  it("null (neutral) and each canonical value import cleanly", () => {
    const service = new LocalTransferService(store);
    for (const offering of [null, "products", "services", "both"] as const) {
      const snapshot = {
        ...emptySnapshot,
        preferences: { ...legacyPreferences(), offeringPreference: offering },
      };
      const prepared = service.prepareImport(envelope(snapshot));
      expect(prepared.ok, `offering=${JSON.stringify(offering)}`).toBe(true);
    }
  });

  it("an out-of-vocabulary value rejects the whole file — no best-effort import, device data untouched", () => {
    const service = new LocalTransferService(store);
    for (const poisoned of ["PRODUCTS", "product", "everything", 0, false, {}]) {
      const snapshot = {
        ...emptySnapshot,
        preferences: { ...legacyPreferences(), offeringPreference: poisoned },
      };
      const prepared = service.prepareImport(envelope(snapshot));
      expect(prepared.ok, `offering=${JSON.stringify(poisoned)}`).toBe(false);
      if (!prepared.ok) {
        expect(prepared.code).toBe("validation_error");
        expect(prepared.message).toContain("بقيت بيانات هذا الجهاز دون تغيير");
      }
    }
  });

  it("an imported offering preference rides the snapshot into the store and back (round trip, Memory adapter)", async () => {
    const memory = await import("@/storage/local/MemoryLocalStore").then(m => new m.MemoryLocalStore());
    const snapshot = {
      ...emptySnapshot,
      preferences: { ...legacyPreferences(), offeringPreference: "services" as const },
    };
    const transfers = new LocalTransferService(memory, () => "2026-10-28T10:00:00.000Z");
    const preview = await transfers.prepareRestore(envelope(snapshot));
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    const confirmed = await transfers.confirmImport(preview.value);
    expect(confirmed.ok).toBe(true);
    const record = await memory.getPreferences();
    if (!record.ok || !record.value) throw new Error("preferences should exist after import");
    expect(record.value.offeringPreference).toBe("services");
  });
});
