import { describe, expect, it } from "vitest";
import { PartyLedgerService } from "./partyLedgerService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";

const baseSale = (overrides: Partial<DirectSale>): DirectSale => ({
  id: "sale-ledger-1",
  itemName: "بوكس كيك",
  quantity: 1,
  currency: "JOD",
  revenueMinor: 1500,
  collectedMinor: 900,
  collectionStatus: "partial_debt",
  costMinor: null,
  profitMinor: null,
  occurredOn: "2026-08-29",
  recordedAt: "2026-08-29T09:00:00.000Z",
  note: "بيع آجل",
  idempotencyKey: "ledger-sale-1",
  status: "active",
  cancelledAt: null,
  cancellationReason: null,
  revisions: [],
  ...overrides,
});

/* D-001 (انحدار): دفتر الناس يجمع ديون البيع المباشر من حقل الزبون المستقل؛
 * والملاحظة القديمة مصدر احتياطي لمن سبق الحقل — بلا وصف مصدر يلتبس بالاسم. */
describe("party ledger reads the structured credit-sale customer name", () => {
  it("aggregates the debt under the structured customer name", async () => {
    const store = new MemoryLocalStore();
    await store.saveDirectSale(
      baseSale({ id: "s-structured", customerName: "خالد", idempotencyKey: "ik-structured" }),
    );
    const ledger = new PartyLedgerService(store);
    const result = await ledger.read();
    if (!result.ok) throw new Error(result.message);
    const party = result.value.parties.find(entry => entry.name === "خالد");
    expect(party?.receivableMinor).toBe(600);
  });

  it("falls back to the legacy note name without the source descriptor", async () => {
    const store = new MemoryLocalStore();
    await store.saveDirectSale(
      baseSale({
        id: "s-legacy",
        note: "عميل: خالد — بيع آجل من ورقة الإضافة",
        idempotencyKey: "ik-legacy",
      }),
    );
    const ledger = new PartyLedgerService(store);
    const result = await ledger.read();
    if (!result.ok) throw new Error(result.message);
    const names = result.value.parties.map(entry => entry.name);
    expect(names).toContain("خالد");
    expect(names.some(name => name.includes("بيع آجل من ورقة الإضافة"))).toBe(false);
  });

  it("prefers the structured field when both exist, and skips sales with no customer at all", async () => {
    const store = new MemoryLocalStore();
    await store.saveDirectSale(
      baseSale({
        id: "s-both",
        customerName: "سامي",
        note: "عميل: خالد — بيع آجل من ورقة الإضافة",
        idempotencyKey: "ik-both",
      }),
    );
    await store.saveDirectSale(
      baseSale({ id: "s-anon", customerName: null, note: "بيع آجل", idempotencyKey: "ik-anon" }),
    );
    const ledger = new PartyLedgerService(store);
    const result = await ledger.read();
    if (!result.ok) throw new Error(result.message);
    const names = result.value.parties.map(entry => entry.name);
    expect(names).toContain("سامي");
    expect(names).not.toContain("خالد");
  });
});

/* S2-08 (انحدار G5): دفتر الناس يلتمس الدفع الأولي بمعرفه لا بترتيب المصفوفة،
 * ولا تعرض «دفعات سُددت» أبدًا بعد تراجع موثق يُعيد paidMinor إلى مستوى الدفع الأولي. */
describe("party ledger supplier payments survive a documented payment reversal", () => {
  it("does not show paid-after-initial after the later payment was reversed", async () => {
    const store = new MemoryLocalStore();
    const saved = await store.saveSupplierPurchase({
      id: "purchase-pl-1",
      supplierName: "مورد الأقطان",
      note: "أقطان",
      purchasedOn: "2026-09-02",
      dueOn: null,
      totalMinor: 5000,
      /* paidMinor صافي التراجع كما يعيد حسابه المجال (إصلاح S2-01): 2000+1000−1000. */
      paidMinor: 2000,
      payableMinor: 2000,
      status: "partially_paid",
      idempotencyKey: "pl-1-key",
      payments: [
        { id: "purchase-pl-1:initial", amountMinor: 2000, occurredOn: "2026-09-02", recordedAt: "2026-09-02T09:00:00.000Z", idempotencyKey: "pl-init", note: "دفعة أولى" },
        { id: "purchase-pl-1:pay-1", amountMinor: 1000, occurredOn: "2026-09-03", recordedAt: "2026-09-03T09:00:00.000Z", idempotencyKey: "pl-pay-1", note: "دفعة ثانية" },
      ],
      paymentReversals: [
        { id: "purchase-pl-1:rev-1", paymentId: "purchase-pl-1:pay-1", amountMinor: 1000, reason: "خطأ مزدوج", occurredOn: "2026-09-03", recordedAt: "2026-09-03T10:00:00.000Z", idempotencyKey: "pl-rev-1" },
      ],
      revisions: [],
      createdAt: "2026-09-02T09:00:00.000Z",
      updatedAt: "2026-09-03T10:00:00.000Z",
    });
    if (!saved.ok) throw new Error(saved.message);
    /* paidMinor الحقيقي بعد التراجع = 2000 (الأولي فقط) — كما يحسبه إصلاح S2-01. */
    const ledger = new PartyLedgerService(store);
    const result = await ledger.read();
    if (!result.ok) throw new Error(result.message);
    const supplier = result.value.parties.find(entry => entry.name === "مورد الأقطان");
    expect(supplier).toBeDefined();
    expect(supplier?.payableMinor).toBe(2000);
    const paidMovement = supplier?.movements.find(movement => movement.kind === "purchase_payment");
    expect(paidMovement).toBeUndefined();
  });
});
