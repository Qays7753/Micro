import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";
import { syncSha256Hex } from "@/lib/syncSha256";
import { exportCountsOf } from "./transferCounters";
import { countedArrayFamilyKeys, verifyTransferArrayFamilies } from "./transferArrayFamilyRoles";
import {
  createOwnerEntitlementPolicy,
  createOwnerEntitlementRecord,
} from "@micro-domain/owner-entitlement/index.js";

/* R10-B2/RC-1 (R10A-F-009 + R10B-NF-009 + عائلة غسل إعادة الختم): بوابة
 * البنية الخام للملف الحالي. قبل هذا الإصلاح كانت بوابات البنية العلوية
 * تعمل على البيانات بعد الترحيل — والترحيل يسوّي كل قيمة معطوبة إلى [] —
 * فكان الملف الحالي «المُعاد ختمه» (بصمة وعدادات معاد حسابهما) يستطيع حذف
 * عائلات مال المالك (أو أي عائلة) أو جعلها غير مصفوفة ويمر، فتُمحى مخازن
 * المالك عند الاستبدال ويعاد التصدير فيغسل التاريخ. هذه الرحلات تثبت
 * الرفض على كل مسار من المسارات، وتبقى الأزواج الموروثة اختيارية-عند-
 * الغياب كما ثبتها ownerEntitlementTransfer.test.ts. */

const NOW = "2026-10-11T08:00:00.000Z";

const policy = createOwnerEntitlementPolicy({
  id: "policy-rc1",
  version: 1,
  family: "time_period",
  kind: "monthly",
  amountMinor: 1500,
  percentageBps: null,
  unitLabel: null,
  startsOn: "2026-08-01",
  endsOn: null,
  source: "اتفاق",
  note: "شهري",
  status: "active",
  idempotencyKey: "policy-rc1",
  createdAt: NOW,
});
const record = createOwnerEntitlementRecord({
  id: "rec-rc1",
  policyId: policy.id,
  policyVersion: policy.version,
  periodFrom: "2026-08-01",
  periodTo: "2026-08-31",
  occurredOn: "2026-08-31",
  recordedAt: NOW,
  amountMinor: 1500,
  knowledge: "known",
  calculationBasis: "time_period",
  baseMinor: null,
  quantity: null,
  sourceKeys: ["period:policy-rc1:2026-08-01:2026-08-31"],
  note: "آب",
  idempotencyKey: "rec-rc1",
  reversalOfId: null,
  reversalReason: null,
});

/** نسخة مُعاد ختمها بأمانة كاملة (بصمة + عدادات معاد حسابهما) — هجوم
 * المهاجم الذي يملك الملف ويعيد بناء المظروف كله. */
function resealed(file: Record<string, unknown>, mutate: (data: Record<string, unknown>) => void): string {
  const copy = JSON.parse(JSON.stringify(file)) as Record<string, unknown>;
  const data = copy.data as Record<string, unknown>;
  mutate(data);
  copy.integrity = { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(data)) };
  /* العدادات تُعاد من البيانات المتلاعب بها نفسها — كما يفعل المهاجم:
   * كل مفتاح من مفاتيح السجل الكنوني بعدد صادق على القيمة الجديدة. */
  const counts: Record<string, number> = {};
  for (const key of countedArrayFamilyKeys()) {
    const value = data[key];
    counts[key] = Array.isArray(value) ? value.length : 0;
  }
  copy.counts = counts;
  return JSON.stringify(copy);
}

async function seededExport(): Promise<{ service: LocalTransferService; file: Record<string, unknown> }> {
  const store = new MemoryLocalStore();
  await store.saveOwnerEntitlementPolicy(policy);
  await store.saveOwnerEntitlementRecord(record);
  const service = new LocalTransferService(store, () => NOW);
  const exported = await service.createVerifiedExport();
  if (!exported.ok) throw new Error(exported.message);
  return { service, file: exported.value.file as unknown as Record<string, unknown> };
}

describe("R10-B2/RC-1 — current-pair raw-array gate (re-sealed laundering closed)", () => {
  it("new exports carry the 4 owner count keys (additive; pair stays 30/38)", async () => {
    const { file } = await seededExport();
    expect(file.version).toBe(localExportVersion);
    expect(file.schemaVersion).toBe(localSchemaVersion);
    const counts = file.counts as Record<string, number>;
    expect(counts.ownerEntitlementPolicies).toBe(1);
    expect(counts.ownerEntitlementRecords).toBe(1);
    expect(counts.ownerEntitlementOpeningBalances).toBe(0);
    expect(counts.ownerMovements).toBe(0);
  });

  it("rejects a re-sealed current file with the 4 owner families deleted (the F-009 exploit)", async () => {
    const { service, file } = await seededExport();
    const tampered = resealed(file, data => {
      delete data.ownerEntitlementPolicies;
      delete data.ownerEntitlementRecords;
      delete data.ownerEntitlementOpeningBalances;
      delete data.ownerMovements;
    });
    const prepared = service.prepareImport(tampered);
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.message).toContain("غائبة");
  });

  it("rejects a re-sealed current file with a non-array owner family (NF-009 silent coercion closed)", async () => {
    const { service, file } = await seededExport();
    const prepared = service.prepareImport(
      resealed(file, data => {
        data.ownerEntitlementPolicies = { nope: true };
      }),
    );
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.message).toContain("ليست مصفوفة");
  });

  it("rejects present-but-non-array for the historical optional families too (same defect family)", async () => {
    const { service, file } = await seededExport();
    for (const family of ["inventoryShortages", "assets", "loans", "receivedLoans", "expenseBudgets"]) {
      const prepared = service.prepareImport(
        resealed(file, data => {
          data[family] = { nope: true };
        }),
      );
      expect(prepared.ok, family).toBe(false);
    }
  });

  it("rejects DELETION of a historical optional family on a re-sealed current file (RV5/D1 — the loan-wipe vector)", async () => {
    const { service, file } = await seededExport();
    for (const family of [
      "loans",
      "receivedLoans",
      "assets",
      "inventoryShortages",
      "expenseBudgets",
      "recurringExpenseSeries",
    ]) {
      const prepared = service.prepareImport(
        resealed(file, data => {
          delete data[family];
        }),
      );
      expect(prepared.ok, family).toBe(false);
      if (!prepared.ok) expect(prepared.message, family).toContain("غائبة");
    }
  });

  it("rejects JSON null for any family on a re-sealed current file (null is absence, not an array)", async () => {
    const { service, file } = await seededExport();
    for (const family of ["loans", "ownerMovements", "drafts"]) {
      const prepared = service.prepareImport(
        resealed(file, data => {
          data[family] = null;
        }),
      );
      expect(prepared.ok, family).toBe(false);
    }
  });

  it("rejects a re-sealed current file with a REQUIRED family deleted (e.g. drafts — laundering beyond owner money)", async () => {
    const { service, file } = await seededExport();
    const prepared = service.prepareImport(
      resealed(file, data => {
        delete data.drafts;
      }),
    );
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.message).toContain("غائبة");
  });

  it("still accepts an untampered current export round-trip", async () => {
    const { service, file } = await seededExport();
    const prepared = service.prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(true);
  });

  it("legacy absence (undefined AND null) stays acceptable and present-but-non-array rejects on legacy pairs too", () => {
    const legacyMinimal = {
      profile: null,
      preferences: null,
      drafts: [],
      orders: [],
      schedules: [],
      financialEvents: [],
    };
    /* غياب كل العائلات الاختيارية على موروث: مقبول (اختياري-عند-الغياب). */
    expect(verifyTransferArrayFamilies(legacyMinimal as Record<string, unknown>, false)).toBeNull();
    /* null على موروث: غياب مقبول كundefined (عقد التوافق). */
    expect(
      verifyTransferArrayFamilies({ ...legacyMinimal, loans: null } as Record<string, unknown>, false),
    ).toBeNull();
    /* موجود معطوب على موروث: مرفوض — «الموجود المعطوب يُرفض» بلا فرق عصر. */
    expect(
      verifyTransferArrayFamilies(
        { ...legacyMinimal, ownerEntitlementRecords: { nope: true } } as Record<string, unknown>,
        false,
      ),
    ).toContain("ليست مصفوفة");
    /* أي عائلة غائبة على الحالي — صارمة أو اختيارية أو مالك: مرفوضة
     * (سياسة العصر الموحدة؛ تصحيح RV5). */
    expect(verifyTransferArrayFamilies(legacyMinimal as Record<string, unknown>, true)).toContain("غائبة");
    expect(
      verifyTransferArrayFamilies(
        { ...legacyMinimal, loans: [], assets: [] } as Record<string, unknown>,
        true,
      ),
    ).toContain("غائبة");
  });

  it("counted registry keys match exportCountsOf output exactly (compile-complete census)", () => {
    const empty = { drafts: [], orders: [], schedules: [], financialEvents: [] } as never as Parameters<
      typeof exportCountsOf
    >[0];
    expect(Object.keys(exportCountsOf(empty)).sort()).toEqual([...countedArrayFamilyKeys()].sort());
  });
});
