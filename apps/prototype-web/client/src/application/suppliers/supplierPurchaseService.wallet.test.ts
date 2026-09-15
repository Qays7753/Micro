import { describe, expect, it } from "vitest";
import { SupplierPurchaseService } from "./supplierPurchaseService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { summarizeCashContinuity } from "@micro-domain/cash-continuity/index.js";

/* FIN-003 (قرار المالك المعتمد ٢٠٢٦-٠٩-١٦): دفعة المورد تنسب لمصدرها وقت
 * التسجيل — محفظة تُغطى من رصيدها مرة واحدة (لا خصم مزدوج ولا سالب غير
 * موزع)، أو الكاش غير الموزع صراحةً. الرصيد غير الكافي يُرفض قبل أي كتابة،
 * والإعادة بمفتاح الحتمية نفسه لا تكرر أثرًا، والدفعات التاريخية بلا مصدر
 * تبقى مقروءة من غير الموزع. معادلة الكاش محفوظة في كل مسار. */

const now = () => "2026-09-16T09:00:00.000Z";

async function openWallet(store: MemoryLocalStore, name: string, openingMinor: number) {
  const cash = new CashContinuityService(store, () => now());
  const opened = await cash.openWallet({
    name,
    kind: name.startsWith("بنك") ? "bank_account" : "cash_drawer",
    openingMinor,
    occurredOn: "2026-09-01",
    note: "رصيد بداية",
    operationKey: `fin003-open-${name}`,
  });
  if (!opened.ok) throw new Error(opened.message);
  const overview = await cash.overview();
  if (!overview.ok) throw new Error("overview failed");
  return overview.value.wallets.find(wallet => wallet.name === name)!;
}

async function walletBalance(store: MemoryLocalStore, walletId: string) {
  const entries = await store.listCashContinuityEntries();
  if (!entries.ok) throw new Error("entries should read");
  return summarizeCashContinuity(entries.value.filter(entry => entry.walletId === walletId));
}

describe("SupplierPurchaseService wallet-funded payments (FIN-003)", () => {
  it("covers an initial supplier payment from the single wallet once — no double subtraction", async () => {
    const store = new MemoryLocalStore();
    const wallet = await openWallet(store, "درج-FIN003", 10000);
    const suppliers = new SupplierPurchaseService(store, () => now());
    const result = await suppliers.recordPurchase({
      supplierName: "مورد-FIN003",
      note: "خامات",
      purchasedOn: "2026-09-16",
      dueOn: null,
      totalMinor: 1000,
      initialPaidMinor: 400,
      idempotencyKey: "fin003-purchase-1",
      initialPaymentWalletId: wallet.id,
    });
    if (!result.ok) throw new Error(result.message);
    expect(result.value.paidMinor).toBe(400);
    expect(result.value.payableMinor).toBe(600);
    /* الدفعة مسجلة بمصدرها. */
    const initial = result.value.payments.find(payment => payment.id === `${result.value.id}:initial`);
    expect(initial?.walletId).toBe(wallet.id);
    /* المحفظة خُصمت مرة واحدة: 100.00 − 4.00 = 96.00. */
    expect(await walletBalance(store, wallet.id)).toBe(9600);
    /* معادلة الكاش: غير الموزع 0 + محافظ 9600 = إجمالي 9600 (96.00). */
    const finance = new ProjectFinancialService(store, () => now());
    const position = await finance.readPosition();
    if (!position.ok) throw new Error(position.message);
    expect(position.value.unallocatedCashMinor).toBe(0);
    expect(position.value.walletCashMinor).toBe(9600);
    expect(position.value.recordedCashMinor).toBe(9600);
    expect(position.value.supplierPayablesMinor).toBe(600);
    expect(result.attributionNote ?? null).toBeNull();
  });

  it("covers a later supplier payment from the wallet and keeps the equation exact", async () => {
    const store = new MemoryLocalStore();
    const wallet = await openWallet(store, "درج-FIN003", 10000);
    const suppliers = new SupplierPurchaseService(store, () => now());
    const created = await suppliers.recordPurchase({
      supplierName: "مورد-FIN003",
      note: "خامات",
      purchasedOn: "2026-09-16",
      dueOn: null,
      totalMinor: 1000,
      initialPaidMinor: 0,
      idempotencyKey: "fin003-purchase-2",
    });
    if (!created.ok) throw new Error(created.message);
    const paid = await suppliers.recordPayment({
      purchaseId: created.value.id,
      amountMinor: 200,
      occurredOn: "2026-09-16",
      note: "دفعة لاحقة",
      idempotencyKey: "fin003-pay-2",
      walletId: wallet.id,
    });
    if (!paid.ok) throw new Error(paid.message);
    /* المحفظة 98.00 وغير الموزع 0 والإجمالي 98.00 — دفعة واحدة لا مرتين. */
    expect(await walletBalance(store, wallet.id)).toBe(9800);
    const finance = new ProjectFinancialService(store, () => now());
    const position = await finance.readPosition();
    if (!position.ok) throw new Error(position.message);
    expect(position.value.unallocatedCashMinor).toBe(0);
    expect(position.value.walletCashMinor).toBe(9800);
    expect(position.value.recordedCashMinor).toBe(9800);
    expect(position.value.supplierPayablesMinor).toBe(800);
    const payment = paid.value.payments.find(entry => entry.idempotencyKey === "fin003-pay-2");
    expect(payment?.walletId).toBe(wallet.id);
  });

  it("records explicit unallocated payments exactly as before — the honest fallback", async () => {
    const store = new MemoryLocalStore();
    const wallet = await openWallet(store, "درج-FIN003", 10000);
    const suppliers = new SupplierPurchaseService(store, () => now());
    const created = await suppliers.recordPurchase({
      supplierName: "مورد-FIN003",
      note: "خامات",
      purchasedOn: "2026-09-16",
      dueOn: null,
      totalMinor: 1000,
      initialPaidMinor: 0,
      idempotencyKey: "fin003-purchase-3",
    });
    if (!created.ok) throw new Error(created.message);
    const paid = await suppliers.recordPayment({
      purchaseId: created.value.id,
      amountMinor: 300,
      occurredOn: "2026-09-16",
      note: "دفعة غير موزعة",
      idempotencyKey: "fin003-pay-3",
      walletId: null,
    });
    if (!paid.ok) throw new Error(paid.message);
    /* اختيار صريح لغير الموزع: المحفظة لا تُمس، والسالب الظاهر صادق معروف المصدر. */
    expect(await walletBalance(store, wallet.id)).toBe(10000);
    const finance = new ProjectFinancialService(store, () => now());
    const position = await finance.readPosition();
    if (!position.ok) throw new Error(position.message);
    expect(position.value.unallocatedCashMinor).toBe(-300);
    expect(position.value.walletCashMinor).toBe(10000);
    expect(position.value.recordedCashMinor).toBe(9700);
  });

  it("rejects a wallet-funded payment that exceeds the wallet balance before writing anything", async () => {
    const store = new MemoryLocalStore();
    const wallet = await openWallet(store, "درج-FIN003", 1000);
    const suppliers = new SupplierPurchaseService(store, () => now());
    const created = await suppliers.recordPurchase({
      supplierName: "مورد-FIN003",
      note: "خامات",
      purchasedOn: "2026-09-16",
      dueOn: null,
      totalMinor: 5000,
      initialPaidMinor: 0,
      idempotencyKey: "fin003-purchase-4",
    });
    if (!created.ok) throw new Error(created.message);
    const rejected = await suppliers.recordPayment({
      purchaseId: created.value.id,
      amountMinor: 2000,
      occurredOn: "2026-09-16",
      note: "أكبر من الرصيد",
      idempotencyKey: "fin003-pay-4",
      walletId: wallet.id,
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.code).toBe("validation_error");
    if (!rejected.ok) expect(rejected.message).toContain("رصيد المحفظة لا يغطي");
    /* لا حفظ جزئي: الشراء بلا دفعات والمحفظة كما هي. */
    const purchases = await store.listSupplierPurchases();
    if (!purchases.ok) throw new Error("purchases should read");
    expect(purchases.value[0]?.payments).toHaveLength(0);
    expect(await walletBalance(store, wallet.id)).toBe(1000);
  });

  it("is idempotent: replaying the same payment key does not double-subtract", async () => {
    const store = new MemoryLocalStore();
    const wallet = await openWallet(store, "درج-FIN003", 10000);
    const suppliers = new SupplierPurchaseService(store, () => now());
    const created = await suppliers.recordPurchase({
      supplierName: "مورد-FIN003",
      note: "خامات",
      purchasedOn: "2026-09-16",
      dueOn: null,
      totalMinor: 1000,
      initialPaidMinor: 0,
      idempotencyKey: "fin003-purchase-5",
    });
    if (!created.ok) throw new Error(created.message);
    const input = {
      purchaseId: created.value.id,
      amountMinor: 250,
      occurredOn: "2026-09-16",
      note: "دفعة مكررة",
      idempotencyKey: "fin003-pay-5",
      walletId: wallet.id,
    };
    const first = await suppliers.recordPayment(input);
    const second = await suppliers.recordPayment(input);
    if (!first.ok || !second.ok) throw new Error("both should succeed");
    expect(second.reused).toBe(true);
    /* محفظة واحدة خُصمت 2.50 مرة واحدة رغم الإعادة. */
    expect(await walletBalance(store, wallet.id)).toBe(9750);
    const entries = await store.listCashContinuityEntries();
    if (!entries.ok) throw new Error("entries should read");
    const attributionEntries = entries.value.filter(entry => entry.sourceRefKind === "supplier_purchase");
    expect(attributionEntries).toHaveLength(1);
    expect(attributionEntries[0]?.operationKey).toBe("fin003-pay-5:attribute");
    expect(attributionEntries[0]?.cashDeltaMinor).toBe(-250);
  });

  it("keeps historical wallet-less purchases readable as unallocated sources", async () => {
    const store = new MemoryLocalStore();
    const saved = await store.saveSupplierPurchase({
      id: "fin003-historical",
      supplierName: "مورد قديم",
      note: "شراء قبل المصادر",
      purchasedOn: "2026-08-01",
      dueOn: null,
      totalMinor: 2000,
      paidMinor: 800,
      payableMinor: 1200,
      status: "partially_paid",
      idempotencyKey: "fin003-historical-key",
      payments: [
        {
          id: "fin003-historical:initial",
          amountMinor: 800,
          occurredOn: "2026-08-01",
          recordedAt: "2026-08-01T09:00:00.000Z",
          idempotencyKey: "fin003-historical-key:initial",
          note: "دفعة عند تسجيل الشراء",
        },
      ],
      createdAt: "2026-08-01T09:00:00.000Z",
      updatedAt: "2026-08-01T09:00:00.000Z",
    });
    if (!saved.ok) throw new Error(saved.message);
    const suppliers = new SupplierPurchaseService(store, () => now());
    const list = await suppliers.list();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(1);
    expect(list.value[0]?.payments[0]?.walletId ?? null).toBeNull();
    const finance = new ProjectFinancialService(store, () => now());
    const position = await finance.readPosition();
    if (!position.ok) throw new Error(position.message);
    /* الدفعة التاريخية بلا مصدر تبقى ضمن الكاش غير الموزع — لا إسناد رجعي. */
    expect(position.value.unallocatedCashMinor).toBe(-800);
    expect(position.value.supplierPayablesMinor).toBe(1200);
  });
});
