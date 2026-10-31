import { describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { PartyDirectoryService } from "./partyLedgerService";
import { createDirectSale, updateDirectSale } from "@micro-domain/direct-sale/index.js";
import { createSupplierPurchase, updateSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import { localSchemaVersion, localExportVersion } from "@/storage/local/types";

/* S05 (DOC-014 / UNIT-037 P3.6): بطارية السلوك المركزية لحالات القبول
 * المشتركة المملوكة هنا — SDF-009/010/011/027/028/041 على مهايئ الذاكرة
 * (المطابقة البنيوية مع محوّل IndexedDB عبر نواة قرار الحد المشتركة تثبتها
 * IndexedDbLocalStore.counterparty.test.ts). كل حالة سلوك حقيقي عند حد
 * الخدمة/التخزين — لا محاكاة. */

const NOW = "2026-10-29T09:00:00.000Z";
/* ساعة متقدمة: عمليات متتالية تحمل طوابع مختلفة فلا تتساوى نسخ CAS
 * المتعاقبة (سلوك الزمن الحقيقي الصادق في الاختبار). */
let tick = 0;
const clock = () => `2026-10-29T09:${String(10 + tick++).padStart(2, "0")}:00.000Z`;

async function saveCreditSale(
  store: MemoryLocalStore,
  input: {
    id: string;
    customerName?: string | null;
    customerPartyId?: string | null;
    revenueMinor: number;
    collectedMinor: number;
    collectionStatus?: "partial_debt" | "partial_needs_review" | "collected_in_full";
  },
) {
  const saved = await store.saveDirectSale(
    createDirectSale({
      id: input.id,
      itemName: "قطعة",
      quantity: 1,
      revenueMinor: input.revenueMinor,
      collectedMinor: input.collectedMinor,
      collectionStatus: input.collectionStatus ?? "partial_debt",
      catalogItemId: null,
      customerName: input.customerName ?? null,
      customerPartyId: input.customerPartyId ?? null,
      costMinor: null,
      occurredOn: "2026-10-20",
      recordedAt: NOW,
      note: "بيع لاختبار الدليل",
      idempotencyKey: `${input.id}-key`,
    }),
  );
  if (!saved.ok) throw new Error(saved.message);
  return saved.value;
}

async function savePurchase(
  store: MemoryLocalStore,
  input: {
    id: string;
    supplierName?: string | null;
    supplierPartyId?: string | null;
    totalMinor: number;
    initialPaidMinor: number;
  },
) {
  const purchase = createSupplierPurchase({
    id: input.id,
    supplierName: input.supplierName ?? null,
    supplierPartyId: input.supplierPartyId ?? null,
    note: "مواد",
    purchasedOn: "2026-10-20",
    dueOn: null,
    totalMinor: input.totalMinor,
    initialPaidMinor: input.initialPaidMinor,
    recordedAt: NOW,
    idempotencyKey: `${input.id}-key`,
    materialId: null,
    expectedQuantityMilli: null,
  });
  const saved = await store.commitSupplierPurchase({
    kind: "create",
    purchase,
    idempotencyKey: `${input.id}-key`,
  });
  if (!saved.ok) throw new Error(saved.message);
  return saved.value.purchase;
}

async function saveParty(directory: PartyDirectoryService, label: string, operationKey: string) {
  const saved = await directory.save({ label, phone: null, note: null, operationKey });
  if (!saved.ok) throw new Error(saved.message);
  return saved.value.party;
}

async function readEntry(directory: PartyDirectoryService, partyId: string) {
  const overview = await directory.read();
  if (!overview.ok) throw new Error(overview.message);
  const all = [...overview.value.parties, ...overview.value.archivedParties];
  return all.find(entry => entry.party.id === partyId);
}

describe("S05 — SDF-009: طرفان بالاسم نفسه لا يندمجان أبدًا", () => {
  it("two same-label parties with two different rights stay separate — no merge, no wrong-source collection", async () => {
    const store = new MemoryLocalStore();
    const directory = new PartyDirectoryService(store, clock);
    const first = await saveParty(directory, "خالد", "op-party-1");
    const second = await saveParty(directory, "خالد", "op-party-2");
    expect(first.id).not.toBe(second.id);

    /* حقان مختلفان لطرفين مختلفين بالتسمية نفسها: باقي 7 لأول و باقي 4 لثاني. */
    await saveCreditSale(store, {
      id: "sale-first",
      customerName: "خالد",
      customerPartyId: first.id,
      revenueMinor: 7_000,
      collectedMinor: 0,
    });
    await saveCreditSale(store, {
      id: "sale-second",
      customerName: "خالد",
      customerPartyId: second.id,
      revenueMinor: 4_000,
      collectedMinor: 0,
    });
    const firstEntry = await readEntry(directory, first.id);
    const secondEntry = await readEntry(directory, second.id);
    expect(firstEntry?.receivableMinor).toBe(7_000);
    expect(secondEntry?.receivableMinor).toBe(4_000);
    /* الاختيار صريح: مصدر كل حق مربوط بمعرفه هو — لا تحصيل من مصدر خاطئ
     * (اختصار التحصيل يفتح دين الطرف نفسه فقط). */
    expect(firstEntry?.movements[0]?.href).toBe("/direct-sales/sale-first");
    expect(secondEntry?.movements[0]?.href).toBe("/direct-sales/sale-second");
  });

  it("a name-only sale is not claimed as a saved party's account — no name aggregation", async () => {
    const store = new MemoryLocalStore();
    const directory = new PartyDirectoryService(store, clock);
    const saved = await saveParty(directory, "خالد", "op-party-1");
    /* بيع بنفس الاسم نصًا وبلا ربط مؤكد — لا يدخل حساب الطرف المحفوظ. */
    await saveCreditSale(store, {
      id: "sale-unlinked",
      customerName: "خالد",
      customerPartyId: null,
      revenueMinor: 9_000,
      collectedMinor: 0,
    });
    const entry = await readEntry(directory, saved.id);
    expect(entry?.receivableMinor).toBe(0);
    expect(entry?.movements).toHaveLength(0);
    /* القائمة نفسها لا تعرض طرفًا ثالثًا من الاسم وحده. */
    const overview = await directory.read();
    expect(overview.ok && [...overview.value.parties, ...overview.value.archivedParties]).toHaveLength(1);
  });
});

describe("S05 — SDF-010: المسدد كاملًا بلا طرف يبقى صحيحًا", () => {
  it("a fully paid sale saves without any customer — no forced identity, no fake cash customer", async () => {
    const store = new MemoryLocalStore();
    const sale = await saveCreditSale(store, {
      id: "sale-paid",
      revenueMinor: 12_000,
      collectedMinor: 12_000,
      collectionStatus: "collected_in_full",
    });
    expect(sale.customerName).toBeNull();
    expect(sale.customerPartyId).toBeNull();
  });

  it("a fully paid purchase saves without any supplier — no forced name, no shared «unregistered» party", async () => {
    const store = new MemoryLocalStore();
    const purchase = await savePurchase(store, {
      id: "purchase-paid",
      supplierName: null,
      supplierPartyId: null,
      totalMinor: 30_000,
      initialPaidMinor: 30_000,
    });
    expect(purchase.supplierName).toBeNull();
    expect(purchase.supplierPartyId).toBeNull();
  });

  it("a new right refuses to save without a simple definition — sale side (A1 «على مَن المبلغ؟»)", async () => {
    const store = new MemoryLocalStore();
    expect(() =>
      createDirectSale({
        id: "sale-bare-debt",
        itemName: "قطعة",
        quantity: 1,
        revenueMinor: 12_000,
        collectedMinor: 5_000,
        collectionStatus: "partial_debt",
        catalogItemId: null,
        customerName: null,
        customerPartyId: null,
        costMinor: null,
        occurredOn: "2026-10-20",
        recordedAt: NOW,
        note: "بلا تعريف",
        idempotencyKey: "sale-bare-debt-key",
      }),
    ).toThrow("اكتب اسمًا أو وصفًا يعرّف صاحب المبلغ المتبقي");
  });

  it("a new payable refuses to save without a simple definition — purchase side (A1 «لِمَن المبلغ؟»)", async () => {
    expect(() =>
      createSupplierPurchase({
        id: "purchase-bare-payable",
        supplierName: null,
        note: "مواد",
        purchasedOn: "2026-10-20",
        dueOn: null,
        totalMinor: 30_000,
        initialPaidMinor: 10_000,
        recordedAt: NOW,
        idempotencyKey: "purchase-bare-key",
        materialId: null,
        expectedQuantityMilli: null,
      }),
    ).toThrow("اكتب اسمًا أو وصفًا يعرّف جهة المبلغ المستحق");
  });

  it("an undecided difference (needs review) stays valid without identity — not a right yet", async () => {
    const store = new MemoryLocalStore();
    const sale = await saveCreditSale(store, {
      id: "sale-review",
      revenueMinor: 12_000,
      collectedMinor: 5_000,
      collectionStatus: "partial_needs_review",
    });
    expect(sale.collectionStatus).toBe("partial_needs_review");
  });
});

describe("S05 — SDF-011: التعديل والأرشفة يحفظان اللقطات والحقوق", () => {
  it("renaming a used party keeps source snapshots and rights intact — no cascade rewrite", async () => {
    const store = new MemoryLocalStore();
    const directory = new PartyDirectoryService(store, clock);
    const party = await saveParty(directory, "محمد — محل الزهور", "op-party-1");
    await saveCreditSale(store, {
      id: "sale-linked",
      customerName: "محمد — محل الزهور",
      customerPartyId: party.id,
      revenueMinor: 7_000,
      collectedMinor: 2_000,
    });
    await savePurchase(store, {
      id: "purchase-linked",
      supplierName: "محمد — محل الزهور",
      supplierPartyId: party.id,
      totalMinor: 5_000,
      initialPaidMinor: 1_000,
    });

    const renamed = await directory.rename({
      partyId: party.id,
      label: "محمد الزهور",
      expectedUpdatedAt: party.updatedAt,
      operationKey: "op-rename-1",
    });
    expect(renamed.ok).toBe(true);

    /* لقطات المصادر كما سُجلت وقت الحفظ — لا إعادة كتابة تاريخ. */
    const sales = await store.listDirectSales();
    expect(sales.ok && sales.value[0]?.customerName).toBe("محمد — محل الزهور");
    const purchases = await store.listSupplierPurchases();
    expect(purchases.ok && purchases.value[0]?.supplierName).toBe("محمد — محل الزهور");

    /* الحقوق باقية بمقاديرها والربط بمعرفه الثابت لم يتغير. */
    const entry = await readEntry(directory, party.id);
    expect(entry?.party.label).toBe("محمد الزهور");
    expect(entry?.receivableMinor).toBe(5_000);
    expect(entry?.payableMinor).toBe(4_000);
  });

  it("archiving hides the suggestion only — identity, label, rights, and links all survive", async () => {
    const store = new MemoryLocalStore();
    const directory = new PartyDirectoryService(store, clock);
    const party = await saveParty(directory, "أم أحمد", "op-party-1");
    await saveCreditSale(store, {
      id: "sale-archived-party",
      customerName: "أم أحمد",
      customerPartyId: party.id,
      revenueMinor: 7_000,
      collectedMinor: 0,
    });
    const archived = await directory.setArchived({
      partyId: party.id,
      archived: true,
      expectedUpdatedAt: party.updatedAt,
      operationKey: "op-archive-1",
    });
    expect(archived.ok).toBe(true);

    const overview = await directory.read();
    expect(overview.ok && overview.value.parties).toHaveLength(0);
    expect(overview.ok && overview.value.archivedParties).toHaveLength(1);
    const archivedEntry = overview.ok ? overview.value.archivedParties[0] : undefined;
    expect(archivedEntry?.party.id).toBe(party.id);
    /* الحق والمرجع قائمان — الأرشفة لا تحذف مالًا ولا مرجعًا (SDF-011). */
    expect(archivedEntry?.receivableMinor).toBe(7_000);
    expect(archivedEntry?.movements[0]?.href).toBe("/direct-sales/sale-archived-party");

    /* الاقتراحات تخفي المؤرشف؛ إعادة الإظهار تعيده. */
    const labelsWhileArchived = await directory.suggestLabels();
    expect(labelsWhileArchived.ok && labelsWhileArchived.value).toHaveLength(0);
    const restored = await directory.setArchived({
      partyId: party.id,
      archived: false,
      expectedUpdatedAt: archivedEntry?.party.updatedAt ?? party.updatedAt,
      operationKey: "op-restore-1",
    });
    expect(restored.ok).toBe(true);
    const labelsAfterRestore = await directory.suggestLabels();
    expect(labelsAfterRestore.ok && labelsAfterRestore.value).toEqual(["أم أحمد"]);
  });

  it("a stale rename from a late window is rejected honestly — no silent overwrite", async () => {
    const store = new MemoryLocalStore();
    const directory = new PartyDirectoryService(store, clock);
    const party = await saveParty(directory, "خالد", "op-party-1");
    const firstRename = await directory.rename({
      partyId: party.id,
      label: "خالد الأول",
      expectedUpdatedAt: party.updatedAt,
      operationKey: "op-rename-1",
    });
    expect(firstRename.ok).toBe(true);
    /* نافذة متأخرة فوق النسخة القديمة — رفض صادق بلا كتابة. */
    const lateRename = await directory.rename({
      partyId: party.id,
      label: "خالد المتأخر",
      expectedUpdatedAt: party.updatedAt,
      operationKey: "op-rename-2",
    });
    expect(lateRename.ok).toBe(false);
    if (!lateRename.ok) expect(lateRename.code).toBe("storage_stale");
    const entry = await readEntry(directory, party.id);
    expect(entry?.party.label).toBe("خالد الأول");
  });
});

describe("S05 — SDF-027: لا حق مُختلق ولا ازدواج مصدر ولا بديل قرض", () => {
  it("linking a saved party to a fully paid sale creates no right and no duplicate source", async () => {
    const store = new MemoryLocalStore();
    const directory = new PartyDirectoryService(store, clock);
    const party = await saveParty(directory, "سمير", "op-party-1");
    await saveCreditSale(store, {
      id: "sale-paid-linked",
      customerName: "سمير",
      customerPartyId: party.id,
      revenueMinor: 6_000,
      collectedMinor: 6_000,
      collectionStatus: "collected_in_full",
    });
    const entry = await readEntry(directory, party.id);
    /* حفظ الطرف وربطه لا يستحدثان حقًا — البيع مسدد كاملًا (لا مبيعات اليوم
     * من الربط، ولا يزدوج مصدر). */
    expect(entry?.receivableMinor).toBe(0);
    expect(entry?.movements).toHaveLength(0);
    /* لا قروض جديدة من أي مسار هنا: عائلة القروض فارغة تمامًا. */
    const loans = await store.listReceivedLoans();
    expect(loans.ok && loans.value).toHaveLength(0);
    const outgoingLoans = await store.listLoans();
    expect(outgoingLoans.ok && outgoingLoans.value).toHaveLength(0);
  });

  it("the account reads each linked source exactly once — no double counting of debt and collection", async () => {
    const store = new MemoryLocalStore();
    const directory = new PartyDirectoryService(store, clock);
    const party = await saveParty(directory, "سمير", "op-party-1");
    /* بيع 12 قبض 5: الحق المتبقي 7 مرة واحدة — لا يجمع المتفق مع المتبقي. */
    await saveCreditSale(store, {
      id: "sale-once",
      customerName: "سمير",
      customerPartyId: party.id,
      revenueMinor: 12_000,
      collectedMinor: 5_000,
    });
    const entry = await readEntry(directory, party.id);
    expect(entry?.receivableMinor).toBe(7_000);
    expect(entry?.movements).toHaveLength(1);
  });
});

describe("S05 — SDF-028: القبض التاريخي مجهول المدين يبقى محدود المعرفة", () => {
  it("a historical collection without a debtor is not attached to any party or claim", async () => {
    const store = new MemoryLocalStore();
    const directory = new PartyDirectoryService(store, clock);
    /* قبض تاريخي معلوم المبلغ بلا مدين أصلي: بيع قديم مقبوض جزئيًا بلا اسم
     * ولا ربط — معرفة محدودة لا تُسند لطرف بالتخمين. */
    await saveCreditSale(store, {
      id: "sale-historical-unknown",
      customerName: null,
      customerPartyId: null,
      revenueMinor: 10_000,
      collectedMinor: 10_000,
      collectionStatus: "collected_in_full",
    });
    await saveParty(directory, "زبون لاحق", "op-party-1");
    const overview = await directory.read();
    expect(overview.ok && overview.value.parties).toHaveLength(1);
    const entry = overview.ok ? overview.value.parties[0] : undefined;
    expect(entry?.receivableMinor).toBe(0);
    expect(entry?.movements).toHaveLength(0);
  });

  it("saving a party with a similar name never claims an unlinked historical record", async () => {
    const store = new MemoryLocalStore();
    const directory = new PartyDirectoryService(store, clock);
    /* سجل قديم باسم نصي فقط (قبل عصر الربط) — حفظ طرف بالاسم نفسه لا
     * يستولي على السجل ولا يسدد به حقًا (لا مطابقة بالاسم إطلاقًا). */
    await saveCreditSale(store, {
      id: "sale-legacy-named",
      customerName: "أم أحمد — الجارة",
      customerPartyId: null,
      revenueMinor: 8_000,
      collectedMinor: 3_000,
    });
    const party = await saveParty(directory, "أم أحمد — الجارة", "op-party-1");
    const entry = await readEntry(directory, party.id);
    expect(entry?.receivableMinor).toBe(0);
    expect(entry?.movements).toHaveLength(0);
  });
});

describe("S05 — SDF-041: فشل حفظ الطرف الاختياري لا يعيد بيعًا نجح", () => {
  it("sale succeeds, optional party save fails — the sale stays saved and retrying the party alone works", async () => {
    const store = new MemoryLocalStore();
    const directory = new PartyDirectoryService(store, clock);
    /* البيع أولًا — نجاح معلن بمفتاحه. */
    const sale = await saveCreditSale(store, {
      id: "sale-sdf041",
      customerName: "ليلى",
      customerPartyId: null,
      revenueMinor: 12_000,
      collectedMinor: 5_000,
    });
    /* فشل الحفظ الاختياري: تسمية فارغة تُرفض عند حد المجال — البيع لا يُعاد
     * ولا يُتراجع ولا يتكرر. */
    const failedSave = await directory.save({
      label: "   ",
      phone: null,
      note: null,
      operationKey: "op-fail",
    });
    expect(failedSave.ok).toBe(false);
    const salesAfterFailure = await store.listDirectSales();
    expect(salesAfterFailure.ok && salesAfterFailure.value).toHaveLength(1);
    expect(salesAfterFailure.ok && salesAfterFailure.value[0]?.id).toBe(sale.id);

    /* إعادة محاولة حفظ الطرف وحده بمفتاح نية صحيح تنجح — بلا إعادة البيع. */
    const retried = await directory.save({
      label: "ليلى",
      phone: null,
      note: null,
      operationKey: "op-retry",
    });
    expect(retried.ok).toBe(true);
    const salesAfterRetry = await store.listDirectSales();
    expect(salesAfterRetry.ok && salesAfterRetry.value).toHaveLength(1);
    const parties = await store.listCounterparties();
    expect(parties.ok && parties.value).toHaveLength(1);
  });

  it("replaying the same party-save operation key reuses honestly — no duplicate identity", async () => {
    const store = new MemoryLocalStore();
    const directory = new PartyDirectoryService(store, clock);
    const first = await directory.save({
      label: "ليلى",
      phone: null,
      note: null,
      operationKey: "op-idempotent",
    });
    expect(first.ok).toBe(true);
    /* إعادة إرسال نفس الأمر بعد فشل شبكة مزعوم — إعادة استخدام لا طرف ثانٍ. */
    const replay = await directory.save({
      label: "ليلى",
      phone: null,
      note: null,
      operationKey: "op-idempotent",
    });
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.value.reused).toBe(true);
    const parties = await store.listCounterparties();
    expect(parties.ok && parties.value).toHaveLength(1);
  });
});

describe("S05 — حدود التعديل على المصدر (UNIT-037 AC06/AC14)", () => {
  it("editing a fully paid sale into debt demands a definition — inputs stay intact", async () => {
    const store = new MemoryLocalStore();
    const sale = await saveCreditSale(store, {
      id: "sale-edit-debt",
      revenueMinor: 12_000,
      collectedMinor: 12_000,
      collectionStatus: "collected_in_full",
    });
    expect(() =>
      updateDirectSale(
        sale,
        {
          itemName: "قطعة",
          quantity: 1,
          revenueMinor: 12_000,
          collectedMinor: 5_000,
          collectionStatus: "partial_debt",
          catalogItemId: null,
          customerName: null,
          customerPartyId: null,
          costMinor: null,
          occurredOn: "2026-10-20",
          note: "بلا تعريف",
        },
        { kind: "edit", idempotencyKey: "edit-key", createdAt: NOW, reason: "تصحيح" },
      ),
    ).toThrow("اكتب اسمًا أو وصفًا يعرّف صاحب المبلغ المتبقي");
  });

  it("editing a legacy unnamed debt keeps it editable — no retroactive definition forced", async () => {
    const store = new MemoryLocalStore();
    /* قديم غير مسمى: لا يمكن إنشاؤه اليوم، لكنه قائم في البيانات التاريخية —
     * نموذجه هنا يُكتب مباشرة عبر حد التخزين ثم يُعدل بنجاح (AC14). */
    await store.saveDirectSale({
      ...createDirectSale({
        id: "sale-legacy",
        itemName: "قطعة قديمة",
        quantity: 1,
        revenueMinor: 10_000,
        collectedMinor: 4_000,
        collectionStatus: "partial_needs_review",
        catalogItemId: null,
        customerName: null,
        customerPartyId: null,
        costMinor: null,
        occurredOn: "2026-01-10",
        recordedAt: "2026-01-10T09:00:00.000Z",
        note: "قديم بلا اسم",
        idempotencyKey: "sale-legacy-key",
      }),
      collectionStatus: "partial_debt",
    });
    const sales = await store.listDirectSales();
    const legacy = sales.ok ? sales.value[0] : undefined;
    if (!legacy) throw new Error("السجل القديم غائب");
    const corrected = updateDirectSale(
      legacy,
      {
        itemName: "قطعة قديمة",
        quantity: 1,
        revenueMinor: 11_000,
        collectedMinor: 4_000,
        collectionStatus: "partial_debt",
        catalogItemId: null,
        customerName: undefined,
        customerPartyId: undefined,
        costMinor: null,
        occurredOn: "2026-01-10",
        note: "تصحيح سعر قديم",
      },
      { kind: "edit", idempotencyKey: "legacy-edit-key", createdAt: NOW, reason: "تصحيح سعر" },
    );
    expect(corrected.revenueMinor).toBe(11_000);
    expect(corrected.customerName).toBeNull();
  });

  it("editing a purchase to fully paid allows clearing the supplier honestly", async () => {
    const store = new MemoryLocalStore();
    const purchase = await savePurchase(store, {
      id: "purchase-clear-supplier",
      supplierName: "مورد الخشب",
      totalMinor: 30_000,
      initialPaidMinor: 10_000,
    });
    const updated = updateSupplierPurchase(purchase, {
      supplierName: null,
      supplierPartyId: null,
      note: "مواد",
      purchasedOn: "2026-10-20",
      dueOn: null,
      totalMinor: 30_000,
      initialPaidMinor: 30_000,
      recordedAt: NOW,
      idempotencyKey: "edit-clear-key",
      reason: "سُدد كاملًا وصحح المورد",
      materialId: null,
      expectedQuantityMilli: null,
    });
    expect(updated.supplierName).toBeNull();
    expect(updated.payableMinor).toBe(0);
  });

  it("editing a purchase back into payable demands a supplier definition", async () => {
    const store = new MemoryLocalStore();
    const purchase = await savePurchase(store, {
      id: "purchase-reopen",
      supplierName: null,
      totalMinor: 30_000,
      initialPaidMinor: 30_000,
    });
    expect(() =>
      updateSupplierPurchase(purchase, {
        supplierName: null,
        supplierPartyId: null,
        note: "مواد",
        purchasedOn: "2026-10-20",
        dueOn: null,
        totalMinor: 40_000,
        initialPaidMinor: 30_000,
        recordedAt: NOW,
        idempotencyKey: "edit-reopen-key",
        reason: "ظهر جزء غير مسدد",
        materialId: null,
        expectedQuantityMilli: null,
      }),
    ).toThrow("اكتب اسمًا أو وصفًا يعرّف جهة المبلغ المستحق");
  });
});

describe("S05 — زوج المخطط/التصدير الحي (DOC-014)", () => {
  it("the live pair is 40/32 — the counterparty family carries it", () => {
    expect(localSchemaVersion).toBe(40);
    expect(localExportVersion).toBe(32);
  });
});
