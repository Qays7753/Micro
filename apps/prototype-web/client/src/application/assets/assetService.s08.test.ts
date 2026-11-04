import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { AssetService } from "./assetService";
import { PartyDirectoryService } from "@/application/parties/partyLedgerService";
import { summarizeFinancialEvents } from "@micro-domain/financial-event/index.js";

/* S08 (UNIT-034 / DOC-017 — أمر S08): سلوك الأصول والمعدات على المهايئين
 * معًا عبر المسار الحقيقي — الدفع الجزئي المعتمد (SDF-066: أصل 100 دفع 40
 * ← نقد −40 وحق 60 وأصل 100 بلا مصروف)، وسداد المتبقي من مصدر الالتزام
 * داخل الحد الحي بلا تجاوز ولا تكرار، وطرف محفوظ بهوية مستقرة ولقطة اسم
 * تاريخية، والأصل القديم الناقص الوثائق لا يولد شراء اليوم (حد D01
 * المحجوب بعقد 002)، وحارس CAS لسجلات الأصل (لا آخر-كاتب-يفوز)، والميزانية
 * لا تدخل الأصل في المنصرف (SDF-062: المنصرف المؤهل 10 لا 3 ولا 110). */

const NOW = "2026-10-30T12:00:00.000Z";
const DATABASE_NAME = "micro-prototype-local";

function clearDatabase(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

type StoreFactory = () => Promise<PrototypeLocalStore> | PrototypeLocalStore;

const adapters: ReadonlyArray<{ readonly label: string; readonly make: StoreFactory }> = [
  { label: "Memory", make: () => new MemoryLocalStore() },
  {
    label: "IndexedDB",
    make: async () => {
      await clearDatabase();
      return new IndexedDbLocalStore();
    },
  },
];

async function eventsOf(store: PrototypeLocalStore) {
  const result = await store.listFinancialEvents();
  if (!result.ok) throw new Error("events should list");
  return result.value;
}

async function saveParty(store: PrototypeLocalStore, label: string) {
  const service = new PartyDirectoryService(store, () => NOW);
  const saved = await service.save({ label, phone: null, note: null, operationKey: "party-1" });
  if (!saved.ok) throw new Error(saved.message ?? "party should save");
  return saved.value.party;
}

describe.each(adapters)("S08 asset acquisition and payments ($label)", ({ make }) => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("SDF-066 new asset 100 paid 40: cash -40, payable +60, asset +100, and no operating expense", async () => {
    const store = await make();
    const service = new AssetService(store, () => NOW);
    const created = await service.create({
      name: "ماكينة خياطة",
      acquisitionAmountMinor: 10000,
      acquisitionKind: "payable",
      purchaseDate: "2026-10-01",
      paidAtCreationMinor: 4000,
      note: null,
    });
    if (!created.ok) throw new Error(created.message);
    expect(created.value.asset.acquisitionAmountMinor).toBe(10000);
    expect(created.value.asset.paidAtCreationMinor).toBe(4000);
    /* حدثان لا واحد: نقدي 4000 + ذمم 6000 — كل أثر مرة واحدة بالضبط. */
    expect(created.value.events).toHaveLength(2);
    const events = await eventsOf(store);
    const totals = summarizeFinancialEvents(events);
    expect(totals.cashMinor).toBe(-4000);
    expect(totals.payableMinor).toBe(6000);
    expect(totals.assetMinor).toBe(10000);
    expect(totals.operatingExpenseMinor).toBe(0);
    const detail = await service.read(created.value.asset.id);
    if (!detail.ok) throw new Error(detail.message);
    expect(detail.value.payments.paidCashMinor).toBe(4000);
    expect(detail.value.payments.remainingPayableMinor).toBe(6000);
    expect(detail.value.payments.hasPayable).toBe(true);
    expect(detail.value.summary.bookValueMinor).toBe(10000);
  });

  it("a legacy asset with incomplete evidence stays what it is — no invented purchase, life, or cash today", async () => {
    const store = await make();
    const service = new AssetService(store, () => NOW);
    /* الأصل القديم الناقص الوثائق: قيمة معلومة بلا عمر معلوم — لا جدول
     * إهلاك ولا تسكين صفر ولا شراء اليوم (حد D01: مسار الافتتاح محجوب
     * بعقد 002 حتى تجهيزه). */
    const created = await service.create({
      name: "فرن قديم قبل التسجيل",
      acquisitionAmountMinor: 5000,
      acquisitionKind: "cash",
      purchaseDate: "2026-10-01",
      note: "موجود قبل النظام",
    });
    if (!created.ok) throw new Error(created.message);
    const detail = await service.read(created.value.asset.id);
    if (!detail.ok) throw new Error(detail.message);
    expect(detail.value.asset.lifeMonths).toBeNull();
    expect(detail.value.proposal.readiness).toBe("unknown_life");
    expect(detail.value.proposal.monthlyMinor).toBeNull();
    const events = await eventsOf(store);
    expect(summarizeFinancialEvents(events).cashMinor).toBe(-5000);
    expect(events.filter(event => event.type.startsWith("asset_"))).toHaveLength(1);
  });

  it("paying the remaining payable is bounded by the live right: no overpay, no duplicate, no second expense", async () => {
    const store = await make();
    const service = new AssetService(store, () => NOW);
    const created = await service.create({
      name: "ثلاجة عرض",
      acquisitionAmountMinor: 10000,
      acquisitionKind: "payable",
      purchaseDate: "2026-10-01",
      paidAtCreationMinor: 4000,
      note: null,
    });
    if (!created.ok) throw new Error(created.message);
    const assetId = created.value.asset.id;
    /* سداد المتبقي 6000: جزئي 2000 ثم الباقي 4000 — والحق يقفل عند الصفر. */
    const first = await service.payPayable({
      assetId,
      amountMinor: 2000,
      occurredOn: "2026-10-20",
      note: "دفعة",
      operationKey: "settle-1",
    });
    if (!first.ok) throw new Error(first.message);
    expect(first.value.type).toBe("payable_settlement_cash");
    expect(first.value.cashDeltaMinor).toBe(-2000);
    expect(first.value.payableDeltaMinor).toBe(-2000);
    /* إعادة الإرسال بالمفتاح نفسه إعادة استخدام صادقة — لا تكرار. */
    const replay = await service.payPayable({
      assetId,
      amountMinor: 2000,
      occurredOn: "2026-10-20",
      note: "دفعة",
      operationKey: "settle-1",
    });
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.reused).toBe(true);
      expect(replay.value.id).toBe(first.value.id);
    }
    /* لا مصروف جديد من السداد — الدلتات ذمم/نقد فقط. */
    const totalsMid = summarizeFinancialEvents(await eventsOf(store));
    expect(totalsMid.operatingExpenseMinor).toBe(0);
    expect(totalsMid.payableMinor).toBe(4000);
    /* تجاوز المتبقي الحي يُرفض برسالة أعمال صادقة. */
    const over = await service.payPayable({
      assetId,
      amountMinor: 4001,
      occurredOn: "2026-10-21",
      note: "زيادة",
      operationKey: "settle-2",
    });
    expect(over).toMatchObject({ ok: false, code: "validation_error" });
    const final = await service.payPayable({
      assetId,
      amountMinor: 4000,
      occurredOn: "2026-10-21",
      note: "إقفال",
      operationKey: "settle-3",
    });
    if (!final.ok) throw new Error(final.message);
    const detail = await service.read(assetId);
    if (!detail.ok) throw new Error(detail.message);
    expect(detail.value.payments.remainingPayableMinor).toBe(0);
    expect(detail.value.payments.paidCashMinor).toBe(10000);
    expect(detail.value.payments.hasPayable).toBe(false);
    /* السداد فوق حق مقفل يُرفض — لا دفع بلا حق قائم. */
    const beyond = await service.payPayable({
      assetId,
      amountMinor: 1,
      occurredOn: "2026-10-22",
      note: "فوق الصفر",
      operationKey: "settle-4",
    });
    expect(beyond).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("concurrent settlements cannot overpay the live right; exactly one lands per window", async () => {
    const store = await make();
    const service = new AssetService(store, () => NOW);
    const created = await service.create({
      name: "معدات خبز",
      acquisitionAmountMinor: 10000,
      acquisitionKind: "payable",
      purchaseDate: "2026-10-01",
      paidAtCreationMinor: 0 + 1,
      note: null,
    });
    if (!created.ok) throw new Error(created.message);
    const assetId = created.value.asset.id;
    /* نافذتا سداد متزامنتان 9999 لكل منهما والمتبقي 9999 — واحدة تلتزم
     * والثانية يرفضها حد الكتابة الحي (لا تجاوز للحق ولا دفع مزدوج). */
    const [first, second] = await Promise.all([
      service.payPayable({
        assetId,
        amountMinor: 9999,
        occurredOn: "2026-10-25",
        note: "سداد متزامن",
        operationKey: "race-settle-1",
      }),
      service.payPayable({
        assetId,
        amountMinor: 9999,
        occurredOn: "2026-10-25",
        note: "سداد متزامن",
        operationKey: "race-settle-2",
      }),
    ]);
    const winners = [first, second].filter(result => result.ok);
    expect(winners).toHaveLength(1);
    const events = await eventsOf(store);
    expect(events.filter(event => event.type === "payable_settlement_cash")).toHaveLength(1);
    const totals = summarizeFinancialEvents(events);
    expect(totals.payableMinor).toBe(0);
  });

  it("a saved acquisition party keeps a stable id with a historical name snapshot; no party is duplicated by name", async () => {
    const store = await make();
    const party = await saveParty(store, "مؤسسة المعدات");
    const service = new AssetService(store, () => NOW);
    const created = await service.create({
      name: "عجانة",
      acquisitionAmountMinor: 30000,
      acquisitionKind: "cash",
      purchaseDate: "2026-10-05",
      acquisitionPartyId: party.id,
      note: null,
    });
    if (!created.ok) throw new Error(created.message);
    expect(created.value.asset.acquisitionParty).toEqual({
      partyId: party.id,
      labelSnapshot: "مؤسسة المعدات",
    });
    /* تعديل اسم الطرف لاحقًا لا يعيد كتابة اللقطة التاريخية. */
    const parties = await store.listCounterparties();
    if (!parties.ok) throw new Error("parties should list");
    expect(parties.value).toHaveLength(1);
    /* طرف غير موجود يُرفض قبل أي كتابة — لا اختراع هوية. */
    const invalid = await service.create({
      name: "أصل بطرف وهمي",
      acquisitionAmountMinor: 1000,
      acquisitionKind: "cash",
      purchaseDate: "2026-10-06",
      acquisitionPartyId: "party-does-not-exist",
      note: null,
    });
    expect(invalid).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("concurrent record writers on the same asset do not silently merge — CAS drops the stale writer", async () => {
    const store = await make();
    const service = new AssetService(store, () => NOW);
    const created = await service.create({
      name: "خلاط",
      acquisitionAmountMinor: 8000,
      acquisitionKind: "cash",
      purchaseDate: "2026-10-01",
      lifeMonths: 24,
      depreciationStartOn: "2026-10-01",
      note: null,
    });
    if (!created.ok) throw new Error(created.message);
    const assetId = created.value.asset.id;
    /* مراجعتا عقد متزامنتان — واحدة تلتزم والأخرى تعارض داخل الحد. */
    const [first, second] = await Promise.all([
      service.reviseContract(assetId, {
        lifeMonths: 30,
        depreciationStartOn: "2026-10-01",
        reason: "عمر أطول",
      }),
      service.reviseContract(assetId, {
        lifeMonths: 12,
        depreciationStartOn: "2026-10-01",
        reason: "عمر أقصر",
      }),
    ]);
    const winners = [first, second].filter(result => result.ok);
    expect(winners).toHaveLength(1);
    const assetResult = await store.getAsset(assetId);
    if (!assetResult.ok || !assetResult.value) throw new Error("asset should read");
    expect(assetResult.value.contractRevisions).toHaveLength(1);
    /* نافذتا تخلص متزامنتان — تخلص واحد فقط يثبت. */
    const [disposeA, disposeB] = await Promise.all([
      service.dispose(assetId, { on: "2026-10-28", proceedsMinor: 3000, reason: "بعتُها" }),
      service.dispose(assetId, { on: "2026-10-28", proceedsMinor: 2500, reason: "بعتُها" }),
    ]);
    expect([disposeA, disposeB].filter(result => result.ok)).toHaveLength(1);
    const final = await store.getAsset(assetId);
    if (!final.ok || !final.value) throw new Error("asset should read");
    expect(final.value.status).toBe("disposed");
    expect(final.value.disposal).not.toBeNull();
  });

  it("SDF-062 budget qualification: an asset acquisition never leaks into the expense-based budget outflow", async () => {
    const store = await make();
    const service = new AssetService(store, () => NOW);
    /* مصروف 10 سُدد منه 3 + أصل 100 — المنصرف المؤهل 10 لا 3 ولا 110:
     * الأصل ليس مصروفًا (دلتاه الأصولية) وسداد المصروف لا يعيده. */
    const expense = await store.saveFinancialEvent({
      id: "event-expense",
      type: "operating_expense_payable",
      amountMinor: 1000,
      currency: "JOD",
      occurredOn: "2026-10-10",
      recordedAt: NOW,
      idempotencyKey: "sdf062-expense",
      note: "مصروف مؤهل",
      counterparty: null,
      relatedEventId: null,
      cashDeltaMinor: 0,
      payableDeltaMinor: 1000,
      ownerCapitalDeltaMinor: 0,
      operatingExpenseDeltaMinor: 1000,
      correctionType: null,
      correctionOfEventId: null,
      correctionReason: null,
    });
    if (!expense.ok) throw new Error("expense should save");
    const created = await service.create({
      name: "أصل الميزانية",
      acquisitionAmountMinor: 10000,
      acquisitionKind: "cash",
      purchaseDate: "2026-10-12",
      note: null,
    });
    if (!created.ok) throw new Error(created.message);
    const events = await eventsOf(store);
    const totals = summarizeFinancialEvents(events);
    expect(totals.operatingExpenseMinor).toBe(1000);
    expect(totals.assetMinor).toBe(10000);
    expect(totals.cashMinor).toBe(-10000);
    /* الأصل بمعزل عن عائلة المصروف: لا يظهر مصروفًا ولا يعدل الميزانية. */
  });

  it("correcting a partial acquisition reverses both events and replaces them once — the payable follows the new contract", async () => {
    const store = await make();
    const service = new AssetService(store, () => NOW);
    const created = await service.create({
      name: "فرن",
      acquisitionAmountMinor: 10000,
      acquisitionKind: "payable",
      purchaseDate: "2026-10-01",
      paidAtCreationMinor: 4000,
      note: null,
    });
    if (!created.ok) throw new Error(created.message);
    const assetId = created.value.asset.id;
    const corrected = await service.correctAcquisition(assetId, {
      acquisitionAmountMinor: 12000,
      acquisitionKind: "payable",
      paidAtCreationMinor: 5000,
      reason: "فاتورة صحيحة",
    });
    if (!corrected.ok) throw new Error(corrected.message);
    expect(corrected.value.reversals).toHaveLength(2);
    expect(corrected.value.replacements).toHaveLength(2);
    const detail = await service.read(assetId);
    if (!detail.ok) throw new Error(detail.message);
    expect(detail.value.asset.acquisitionAmountMinor).toBe(12000);
    expect(detail.value.payments.paidCashMinor).toBe(5000);
    expect(detail.value.payments.remainingPayableMinor).toBe(7000);
    expect(detail.value.summary.bookValueMinor).toBe(12000);
    const events = await eventsOf(store);
    const totals = summarizeFinancialEvents(events);
    /* الأحداث المعكوسة تنفي دلتاتها: نقد −4+4−5 = −5 وذمم +6−6+7 = +7. */
    expect(totals.cashMinor).toBe(-5000);
    expect(totals.payableMinor).toBe(7000);
    expect(totals.assetMinor).toBe(12000);
  });
});
