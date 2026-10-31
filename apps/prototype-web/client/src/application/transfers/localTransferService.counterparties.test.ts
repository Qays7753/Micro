import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { createSavedParty, renameSavedParty, setSavedPartyArchive } from "@micro-domain/party/index.js";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";
import { syncSha256Hex } from "@/lib/syncSha256";

/* S05 (DOC-014 / UNIT-037 — عقد ٠٤٤/العقد المشترك §5.1/§16): مغلف التصدير ٣٢ —
 * عائلة الأطراف المحفوظة داخل اللقطة والعدادات الصارمة ذهابًا وإيابًا؛ وملف
 * ٣١/٣٩ الموروث (زوج S04) يُقبل بلا اختراع أطراف (الغياب = قائمة فارغة
 * صادقة)؛ والملف المكسور (معرّف مكرر / تسمية فارغة / مصفوفة ليست مصفوفة /
 * مفتاح عملية فارغ) يُرفض قبل أي استبدال — وبيانات هذا الجهاز لا تُمس بعد
 * أي رفض. لا دمج بالاسم أبدًا: طرفان بالتسمية نفسها يعبران معًا كما هما. */

const NOW = "2026-10-29T08:00:00.000Z";

function seededParties() {
  const active = createSavedParty({
    id: "party-1",
    label: "محمد — محل الزهور",
    phone: null,
    note: "عميل متكرر",
    operationKey: "party-1:create",
    recordedAt: NOW,
  });
  const renamed = renameSavedParty(active, {
    label: "محمد الزهور",
    operationKey: "party-1:rename",
    recordedAt: "2026-10-29T09:00:00.000Z",
  });
  const sameLabelOtherIdentity = createSavedParty({
    id: "party-2",
    label: "محمد الزهور",
    phone: "0790000000",
    note: null,
    operationKey: "party-2:create",
    recordedAt: "2026-10-29T09:30:00.000Z",
  });
  const archived = setSavedPartyArchive(sameLabelOtherIdentity, {
    archived: true,
    operationKey: "party-2:archive",
    recordedAt: "2026-10-29T10:00:00.000Z",
  });
  return { renamed, archived };
}

async function seedStore() {
  const store = new MemoryLocalStore();
  const { renamed, archived } = seededParties();
  const first = await store.commitCounterpartyWrite({
    kind: "create",
    baseUpdatedAt: null,
    next: renamed,
    operationKey: renamed.operationKey,
  });
  if (!first.ok) throw new Error(first.message);
  const second = await store.commitCounterpartyWrite({
    kind: "create",
    baseUpdatedAt: null,
    next: archived,
    operationKey: archived.operationKey,
  });
  if (!second.ok) throw new Error(second.message);
  return store;
}

/** ملف ٣١/٣٩ كما صدر فعلًا من S04 — بعائلة رصد الأرصدة وبلا عائلة الأطراف. */
function legacy3139File(): Record<string, unknown> {
  return {
    format: "micro-prototype-local-export",
    version: 31,
    schemaVersion: 39,
    exportedAt: NOW,
    data: {
      profile: null,
      preferences: null,
      drafts: [],
      orders: [],
      directSales: [],
      schedules: [],
      recurrences: [],
      financialEvents: [],
      supplierPurchases: [],
      cashWallets: [],
      cashContinuityEntries: [],
      materials: [],
      inventoryMovements: [],
      inventoryShortages: [],
      inventoryActivation: null,
      catalogItems: [],
      measurementUnits: [],
      directConversions: [],
      catalogTemplates: [],
      actualTimeRecords: [],
      shortCashDeclarations: [],
      ownerEntitlementPolicies: [],
      ownerEntitlementRecords: [],
      ownerEntitlementOpeningBalances: [],
      ownerMovements: [],
      allocationPolicies: [],
      costEstimates: [],
      assets: [],
      loans: [],
      receivedLoans: [],
      recurringExpenseSeries: [],
      recurringExpenseRevisions: [],
      recurringExpenseOccurrences: [],
      expenseBudgets: [],
      balanceObservations: [],
      /* لا counterparties هنا عمدًا — الزوج صدر قبل S05. */
    },
  };
}

function currentPairFile(parties: unknown): Record<string, unknown> {
  const data: Record<string, unknown> = legacy3139File().data as Record<string, unknown>;
  data.counterparties = parties;
  const file: Record<string, unknown> = {
    format: "micro-prototype-local-export",
    version: localExportVersion,
    schemaVersion: localSchemaVersion,
    exportedAt: NOW,
    data,
  };
  file.integrity = { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(data)) };
  file.counts = { counterparties: Array.isArray(parties) ? parties.length : 0 };
  return file;
}

describe("export envelope v32 (S05 — DOC-014 / UNIT-037)", () => {
  it("round-trips the counterparty family verbatim through a verified export — same-label identities stay distinct", async () => {
    const store = await seedStore();
    const sourceSnapshot = await store.readSnapshot();
    if (!sourceSnapshot.ok) throw new Error(sourceSnapshot.message);
    const service = new LocalTransferService(store, () => NOW);
    const exported = await service.createVerifiedExport();
    if (!exported.ok) throw new Error(exported.message);
    expect(exported.value.file.version).toBe(32);
    expect(exported.value.file.schemaVersion).toBe(40);
    expect(exported.value.file.version).toBe(localExportVersion);
    expect(exported.value.file.schemaVersion).toBe(localSchemaVersion);
    expect(exported.value.file.data.counterparties).toHaveLength(2);
    expect(exported.value.file.counts?.counterparties).toBe(2);
    expect(exported.value.summary.counterparties).toBe(2);

    const target = new MemoryLocalStore();
    const targetService = new LocalTransferService(target, () => NOW);
    const restored = await targetService.prepareRestore(JSON.stringify(exported.value.file));
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error(restored.message);
    const applied = await targetService.confirmImport(restored.value);
    if (!applied.ok) throw new Error(applied.message);
    const targetSnapshot = await target.readSnapshot();
    if (!targetSnapshot.ok) throw new Error(targetSnapshot.message);
    expect(targetSnapshot.value).toEqual(JSON.parse(JSON.stringify(sourceSnapshot.value)));
    const partiesAfter = await target.listCounterparties();
    expect(partiesAfter.ok && partiesAfter.value).toHaveLength(2);
    /* الطرفان بالتسمية نفسها يعبران هويتين مستقلتين — لا دمج ولا تفضيل. */
    const labels = (partiesAfter.ok ? partiesAfter.value : []).map(party => party.label);
    expect(labels).toEqual(["محمد الزهور", "محمد الزهور"]);
    const ids = (partiesAfter.ok ? partiesAfter.value : []).map(party => party.id).sort();
    expect(ids).toEqual(["party-1", "party-2"]);
    const archived = partiesAfter.ok ? partiesAfter.value.find(party => party.id === "party-2") : undefined;
    expect(archived?.archivedAt).toBe("2026-10-29T10:00:00.000Z");
    expect(archived?.phone).toBe("0790000000");
  });

  it("accepts a legacy 31/39 file and seeds empty counterparties (migration v39→v40 never invents identities)", async () => {
    const target = new MemoryLocalStore();
    const service = new LocalTransferService(target, () => NOW);
    const prepared = service.prepareImport(JSON.stringify(legacy3139File()));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(prepared.message);
    expect(prepared.value.file.data.counterparties).toEqual([]);
    expect(prepared.value.summary.counterparties).toBe(0);
    const restored = await service.prepareRestore(JSON.stringify(legacy3139File()));
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error(restored.message);
    const applied = await service.confirmImport(restored.value);
    if (!applied.ok) throw new Error(applied.message);
    const parties = await target.listCounterparties();
    expect(parties.ok && parties.value).toHaveLength(0);
  });

  it("rejects a duplicate counterparty id before any preview — no silent merge", async () => {
    const { renamed } = seededParties();
    const duplicated = { ...renamed, id: renamed.id };
    const file = currentPairFile([renamed, duplicated]);
    const service = new LocalTransferService(new MemoryLocalStore(), () => NOW);
    const prepared = service.prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
  });

  it("rejects an empty label — a fake identity never enters the snapshot", async () => {
    const broken = { ...seededParties().renamed, label: "   " };
    const file = currentPairFile([broken]);
    const service = new LocalTransferService(new MemoryLocalStore(), () => NOW);
    const prepared = service.prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
  });

  it("rejects a non-array counterparties family on the current pair — no family washing", async () => {
    const file = currentPairFile("ليست مصفوفة" as unknown);
    const service = new LocalTransferService(new MemoryLocalStore(), () => NOW);
    const prepared = service.prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;
    expect(prepared.message).toContain("بقيت بيانات هذا الجهاز دون تغيير");
  });

  it("rejects a missing operationKey — the record loses its idempotency truth", async () => {
    const broken = { ...seededParties().renamed, operationKey: "" };
    const file = currentPairFile([broken]);
    const service = new LocalTransferService(new MemoryLocalStore(), () => NOW);
    const prepared = service.prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
  });
});
