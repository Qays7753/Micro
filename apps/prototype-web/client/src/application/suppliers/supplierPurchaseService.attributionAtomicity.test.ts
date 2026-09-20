import { describe, expect, it } from "vitest";
import { SupplierPurchaseService } from "./supplierPurchaseService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { StatementService } from "@/application/finance/statementService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import { summarizeCashContinuity } from "@micro-domain/cash-continuity/index.js";
import { createCashContinuityEntry } from "@micro-domain/cash-continuity/index.js";

/* G-002 (تدقيق الإدارة المالية المتدرجة 2026-09-19): تخصيص دفعة المورد
 * لمحفظته ذرّي أو حتمي الشفاء — الدفعة وقيد تغطيتها في معاملة واحدة؛ إعادة
 * الإرسال بعد فشل/انقطاع تشفي التخصيص الناقص من الحقيقة المخزّنة داخل
 * المعاملة نفسها (لا تُتخطى لأن الدفعة reused)، والفشل المحقون لا يترك
 * حالة نصفية، وفحص MIC-17 يكشف أي بقايا تاريخية للمراجعة — قراءة فقط. */

const now = () => "2026-09-20T09:00:00.000Z";

async function openWallet(store: MemoryLocalStore, name: string, openingMinor: number) {
  const cash = new CashContinuityService(store, () => now());
  const opened = await cash.openWallet({
    name,
    kind: name.startsWith("بنك") ? "bank_account" : "cash_drawer",
    openingMinor,
    occurredOn: "2026-09-01",
    note: "رصيد بداية",
    operationKey: `g002-open-${name}`,
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

async function supplierAllocations(store: MemoryLocalStore) {
  const entries = await store.listCashContinuityEntries();
  if (!entries.ok) throw new Error(entries.message);
  return entries.value.filter(
    entry => entry.type === "allocation" && entry.sourceRefKind === "supplier_purchase",
  );
}

/* محوّل يفشل الالتزام الذرّي فشلًا تخزينيًا حقيقيًا — محاكاة انقطاع قبل أي
 * كتابة: لا شراء ولا دفعة ولا تخصيص (حقن الفشل آلي لا إثبات متصفح حي). */
class FailingAtomicStore extends MemoryLocalStore {
  public failed = false;
  override async commitSupplierPurchaseWithAttribution(
    commit: Parameters<MemoryLocalStore["commitSupplierPurchaseWithAttribution"]>[0],
    attribution: Parameters<MemoryLocalStore["commitSupplierPurchaseWithAttribution"]>[1],
  ) {
    this.failed = true;
    void commit;
    void attribution;
    return {
      ok: false as const,
      code: "storage_error" as const,
      message: "فشل تخزيني مفبرك للاختبار قبل أي كتابة.",
    };
  }
}

async function mic17(store: MemoryLocalStore) {
  const projectFinance = new ProjectFinancialService(store, () => now());
  const statement = new StatementService(store, projectFinance);
  const cashContinuity = new CashContinuityService(store, () => now());
  const integrity = new IntegrityCheckService(store, projectFinance, statement, cashContinuity, () => now());
  const report = await integrity.run();
  return report.checks.find(check => check.id === "MIC-17")!;
}

describe("G-002 — supplier payment wallet attribution atomicity and healing", () => {
  it("cash purchase (no wallet): payment recorded with zero allocation entries", async () => {
    const store = new MemoryLocalStore();
    const suppliers = new SupplierPurchaseService(store, () => now());
    const result = await suppliers.recordPurchase({
      supplierName: "مورد-كاش",
      note: "شراء نقدي",
      purchasedOn: "2026-09-20",
      dueOn: null,
      totalMinor: 500,
      initialPaidMinor: 500,
      idempotencyKey: "g002-cash-purchase",
      initialPaymentWalletId: null,
    });
    expect(result.ok).toBe(true);
    expect(await supplierAllocations(store)).toHaveLength(0);
  });

  it("credit purchase with initial wallet payment: purchase and allocation commit atomically", async () => {
    const store = new MemoryLocalStore();
    const wallet = await openWallet(store, "درج-G002", 10000);
    const suppliers = new SupplierPurchaseService(store, () => now());
    const result = await suppliers.recordPurchase({
      supplierName: "مورد-G002",
      note: "خامات",
      purchasedOn: "2026-09-20",
      dueOn: null,
      totalMinor: 1000,
      initialPaidMinor: 400,
      idempotencyKey: "g002-credit-purchase",
      initialPaymentWalletId: wallet.id,
    });
    expect(result.ok).toBe(true);
    const allocations = await supplierAllocations(store);
    expect(allocations).toHaveLength(1);
    expect(allocations[0]).toMatchObject({
      walletId: wallet.id,
      cashDeltaMinor: -400,
      sourceRefId: result.value.id,
      sourceRefKind: "supplier_purchase",
      operationKey: "g002-credit-purchase:initial-attribute",
    });
    expect(await walletBalance(store, wallet.id)).toBe(9600);
    expect(result.value.paidMinor).toBe(400);
    expect(result.value.payableMinor).toBe(600);
  });

  it("later supplier payment with wallet: one allocation entry with the derived key", async () => {
    const store = new MemoryLocalStore();
    const wallet = await openWallet(store, "درج-G002", 10000);
    const suppliers = new SupplierPurchaseService(store, () => now());
    const created = await suppliers.recordPurchase({
      supplierName: "مورد-G002",
      note: "خامات",
      purchasedOn: "2026-09-20",
      dueOn: null,
      totalMinor: 1000,
      initialPaidMinor: 0,
      idempotencyKey: "g002-later-purchase",
      initialPaymentWalletId: null,
    });
    if (!created.ok) throw new Error(created.message);
    const paid = await suppliers.recordPayment({
      purchaseId: created.value.id,
      amountMinor: 300,
      occurredOn: "2026-09-21",
      note: "دفعة",
      idempotencyKey: "g002-later-payment",
      walletId: wallet.id,
    });
    expect(paid.ok).toBe(true);
    expect(await walletBalance(store, wallet.id)).toBe(9700);
    const allocations = await supplierAllocations(store);
    expect(allocations).toHaveLength(1);
    expect(allocations[0]).toMatchObject({ operationKey: "g002-later-payment:attribute" });
  });

  it("invalid wallet id: honest rejection before any write (no purchase, no entry)", async () => {
    const store = new MemoryLocalStore();
    await openWallet(store, "درج-G002", 10000);
    const suppliers = new SupplierPurchaseService(store, () => now());
    const result = await suppliers.recordPurchase({
      supplierName: "مورد-G002",
      note: "خامات",
      purchasedOn: "2026-09-20",
      dueOn: null,
      totalMinor: 1000,
      initialPaidMinor: 400,
      idempotencyKey: "g002-invalid-wallet",
      initialPaymentWalletId: "wallet-does-not-exist",
    });
    expect(result).toMatchObject({ ok: false, code: "validation_error" });
    const purchases = await store.listSupplierPurchases();
    if (!purchases.ok) throw new Error(purchases.message);
    expect(purchases.value).toHaveLength(0);
    expect(await supplierAllocations(store)).toHaveLength(0);
  });

  it("injected failure after input validation aborts the whole call — no half state", async () => {
    const store = new FailingAtomicStore();
    const wallet = await openWallet(store, "درج-G002", 10000);
    const suppliers = new SupplierPurchaseService(store, () => now());
    const result = await suppliers.recordPurchase({
      supplierName: "مورد-G002",
      note: "خامات",
      purchasedOn: "2026-09-20",
      dueOn: null,
      totalMinor: 1000,
      initialPaidMinor: 400,
      idempotencyKey: "g002-injected-failure",
      initialPaymentWalletId: wallet.id,
    });
    expect(result).toMatchObject({ ok: false, code: "storage_error" });
    expect(store.failed).toBe(true);
    const purchases = await store.listSupplierPurchases();
    if (!purchases.ok) throw new Error(purchases.message);
    expect(purchases.value).toHaveLength(0);
    expect(await supplierAllocations(store)).toHaveLength(0);
  });

  it("retry after a legacy half state heals the missing attribution without duplicating the payment", async () => {
    const store = new MemoryLocalStore();
    const wallet = await openWallet(store, "درج-G002", 10000);
    const suppliers = new SupplierPurchaseService(store, () => now());
    const created = await suppliers.recordPurchase({
      supplierName: "مورد-G002",
      note: "خامات",
      purchasedOn: "2026-09-20",
      dueOn: null,
      totalMinor: 1000,
      initialPaidMinor: 0,
      idempotencyKey: "g002-heal-purchase",
      initialPaymentWalletId: null,
    });
    if (!created.ok) throw new Error(created.message);
    const paid = await suppliers.recordPayment({
      purchaseId: created.value.id,
      amountMinor: 300,
      occurredOn: "2026-09-21",
      note: "دفعة",
      idempotencyKey: "g002-heal-payment",
      walletId: wallet.id,
    });
    expect(paid.ok).toBe(true);
    /* محاكاة بقايا ما قبل الإصلاح: حذف قيد التغطية يدويًا وبقاء الدفعة
     * بمحفظتها — الحالة النصفية التاريخية نفسها التي وصفها التدقيق. */
    const entries = await store.listCashContinuityEntries();
    if (!entries.ok) throw new Error(entries.message);
    const allocation = entries.value.find(entry => entry.operationKey === "g002-heal-payment:attribute")!;
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.message);
    const stripped = {
      ...snapshot.value,
      cashContinuityEntries: snapshot.value.cashContinuityEntries.filter(entry => entry.id !== allocation.id),
    };
    const replaced = await store.replaceSnapshot(stripped);
    if (!replaced.ok) throw new Error(replaced.message);
    expect(await walletBalance(store, wallet.id)).toBe(10000);
    /* MIC-17 يكشف الناقص — قراءة فقط. */
    expect((await mic17(store)).status).toBe("FAIL");
    /* إعادة إرسال الدفعة نفسها بمفتاحها: الدفعة reused والتخصيص يُشفي
     * داخل المعاملة من الحقيقة المخزّنة — بلا تكرار دفعة ولا خصم مزدوج. */
    const healed = await suppliers.recordPayment({
      purchaseId: created.value.id,
      amountMinor: 300,
      occurredOn: "2026-09-21",
      note: "دفعة",
      idempotencyKey: "g002-heal-payment",
      walletId: wallet.id,
    });
    expect(healed.ok).toBe(true);
    if (healed.ok) expect(healed.reused).toBe(true);
    const purchases = await store.listSupplierPurchases();
    if (!purchases.ok) throw new Error(purchases.message);
    const purchase = purchases.value.find(candidate => candidate.id === created.value.id)!;
    expect(purchase.payments.filter(payment => payment.idempotencyKey === "g002-heal-payment")).toHaveLength(
      1,
    );
    expect(await walletBalance(store, wallet.id)).toBe(9700);
    expect((await mic17(store)).status).toBe("PASS");
  });

  it("double click: two concurrent identical payments produce one payment and one allocation", async () => {
    const store = new MemoryLocalStore();
    const wallet = await openWallet(store, "درج-G002", 10000);
    const suppliers = new SupplierPurchaseService(store, () => now());
    const created = await suppliers.recordPurchase({
      supplierName: "مورد-G002",
      note: "خامات",
      purchasedOn: "2026-09-20",
      dueOn: null,
      totalMinor: 1000,
      initialPaidMinor: 0,
      idempotencyKey: "g002-double-purchase",
      initialPaymentWalletId: null,
    });
    if (!created.ok) throw new Error(created.message);
    const [first, second] = await Promise.all([
      suppliers.recordPayment({
        purchaseId: created.value.id,
        amountMinor: 250,
        occurredOn: "2026-09-21",
        note: "دفعة",
        idempotencyKey: "g002-double-payment",
        walletId: wallet.id,
      }),
      suppliers.recordPayment({
        purchaseId: created.value.id,
        amountMinor: 250,
        occurredOn: "2026-09-21",
        note: "دفعة",
        idempotencyKey: "g002-double-payment",
        walletId: wallet.id,
      }),
    ]);
    const successes = [first, second].filter(result => result.ok);
    expect(successes.length).toBeGreaterThan(0);
    const purchases = await store.listSupplierPurchases();
    if (!purchases.ok) throw new Error(purchases.message);
    const purchase = purchases.value.find(candidate => candidate.id === created.value.id)!;
    expect(
      purchase.payments.filter(payment => payment.idempotencyKey === "g002-double-payment"),
    ).toHaveLength(1);
    expect(await walletBalance(store, wallet.id)).toBe(9750);
    expect(await supplierAllocations(store)).toHaveLength(1);
  });

  it("repeated idempotency key after full success: honest reuse with zero new writes", async () => {
    const store = new MemoryLocalStore();
    const wallet = await openWallet(store, "درج-G002", 10000);
    const suppliers = new SupplierPurchaseService(store, () => now());
    const first = await suppliers.recordPurchase({
      supplierName: "مورد-G002",
      note: "خامات",
      purchasedOn: "2026-09-20",
      dueOn: null,
      totalMinor: 1000,
      initialPaidMinor: 400,
      idempotencyKey: "g002-replay-purchase",
      initialPaymentWalletId: wallet.id,
    });
    expect(first.ok).toBe(true);
    const second = await suppliers.recordPurchase({
      supplierName: "مورد-G002",
      note: "خامات",
      purchasedOn: "2026-09-20",
      dueOn: null,
      totalMinor: 1000,
      initialPaidMinor: 400,
      idempotencyKey: "g002-replay-purchase",
      initialPaymentWalletId: wallet.id,
    });
    expect(second).toMatchObject({ ok: true });
    if (second.ok) expect(second.reused).toBe(true);
    const purchases = await store.listSupplierPurchases();
    if (!purchases.ok) throw new Error(purchases.message);
    expect(purchases.value).toHaveLength(1);
    expect(await walletBalance(store, wallet.id)).toBe(9600);
    expect(await supplierAllocations(store)).toHaveLength(1);
  });

  it("multiple wallets: each payment attributes to its chosen wallet only", async () => {
    const store = new MemoryLocalStore();
    const drawer = await openWallet(store, "درج-G002", 10000);
    const bank = await openWallet(store, "بنك-G002", 20000);
    const suppliers = new SupplierPurchaseService(store, () => now());
    const created = await suppliers.recordPurchase({
      supplierName: "مورد-G002",
      note: "خامات",
      purchasedOn: "2026-09-20",
      dueOn: null,
      totalMinor: 2000,
      initialPaidMinor: 500,
      idempotencyKey: "g002-multi-wallet-purchase",
      initialPaymentWalletId: drawer.id,
    });
    if (!created.ok) throw new Error(created.message);
    const paid = await suppliers.recordPayment({
      purchaseId: created.value.id,
      amountMinor: 700,
      occurredOn: "2026-09-22",
      note: "دفعة",
      idempotencyKey: "g002-multi-wallet-payment",
      walletId: bank.id,
    });
    expect(paid.ok).toBe(true);
    expect(await walletBalance(store, drawer.id)).toBe(9500);
    expect(await walletBalance(store, bank.id)).toBe(19300);
    const allocations = await supplierAllocations(store);
    expect(allocations).toHaveLength(2);
    expect(allocations.filter(entry => entry.walletId === drawer.id)).toHaveLength(1);
    expect(allocations.filter(entry => entry.walletId === bank.id)).toHaveLength(1);
  });

  it("integrity check: MIC-17 passes on healthy wallet-attributed and wallet-less payments", async () => {
    const store = new MemoryLocalStore();
    const wallet = await openWallet(store, "درج-G002", 10000);
    const suppliers = new SupplierPurchaseService(store, () => now());
    await suppliers.recordPurchase({
      supplierName: "مورد-G002",
      note: "خامات",
      purchasedOn: "2026-09-20",
      dueOn: null,
      totalMinor: 1000,
      initialPaidMinor: 400,
      idempotencyKey: "g002-healthy-wallet",
      initialPaymentWalletId: wallet.id,
    });
    await suppliers.recordPurchase({
      supplierName: "مورد-كاش",
      note: "شراء نقدي",
      purchasedOn: "2026-09-20",
      dueOn: null,
      totalMinor: 300,
      initialPaidMinor: 300,
      idempotencyKey: "g002-healthy-cash",
      initialPaymentWalletId: null,
    });
    const check = await mic17(store);
    expect(check.status).toBe("PASS");
  });

  it("integrity check: an intentionally incomplete wallet-attributed payment fails MIC-17", async () => {
    const store = new MemoryLocalStore();
    const wallet = await openWallet(store, "درج-G002", 10000);
    const suppliers = new SupplierPurchaseService(store, () => now());
    const created = await suppliers.recordPurchase({
      supplierName: "مورد-G002",
      note: "خامات",
      purchasedOn: "2026-09-20",
      dueOn: null,
      totalMinor: 1000,
      initialPaidMinor: 400,
      idempotencyKey: "g002-incomplete",
      initialPaymentWalletId: wallet.id,
    });
    if (!created.ok) throw new Error(created.message);
    /* حذف قيد التغطية: الحالة الناقصة يكشفها الفحص للمراجعة. */
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.message);
    const stripped = {
      ...snapshot.value,
      cashContinuityEntries: snapshot.value.cashContinuityEntries.filter(
        entry => entry.operationKey !== "g002-incomplete:initial-attribute",
      ),
    };
    const replaced = await store.replaceSnapshot(stripped);
    if (!replaced.ok) throw new Error(replaced.message);
    const check = await mic17(store);
    expect(check.status).toBe("FAIL");
    expect(check.offenderCount).toBe(1);
  });

  it("export/restore round-trip preserves the purchase and its attribution pair", async () => {
    const store = new MemoryLocalStore();
    const wallet = await openWallet(store, "درج-G002", 10000);
    const suppliers = new SupplierPurchaseService(store, () => now());
    const created = await suppliers.recordPurchase({
      supplierName: "مورد-G002",
      note: "خامات",
      purchasedOn: "2026-09-20",
      dueOn: null,
      totalMinor: 1000,
      initialPaidMinor: 400,
      idempotencyKey: "g002-roundtrip",
      initialPaymentWalletId: wallet.id,
    });
    if (!created.ok) throw new Error(created.message);
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.message);
    const restored = await store.replaceSnapshot(snapshot.value);
    if (!restored.ok) throw new Error(restored.message);
    const allocations = await supplierAllocations(store);
    expect(allocations).toHaveLength(1);
    expect(allocations[0]).toMatchObject({
      sourceRefId: created.value.id,
      operationKey: "g002-roundtrip:initial-attribute",
      walletId: wallet.id,
    });
    expect(await walletBalance(store, wallet.id)).toBe(9600);
    expect((await mic17(store)).status).toBe("PASS");
    const postRestore = await suppliers.recordPayment({
      purchaseId: created.value.id,
      amountMinor: 100,
      occurredOn: "2026-09-23",
      note: "دفعة بعد الاستعادة",
      idempotencyKey: "g002-roundtrip-payment",
      walletId: wallet.id,
    });
    expect(postRestore.ok).toBe(true);
    expect(await walletBalance(store, wallet.id)).toBe(9500);
  });
});

/* حقن الفشل آلي (fault injection) — إثبات سلوك الكود تحت الفشل، لا إثبات
 * متصفح حي: التصنيف NOT_EXECUTED للتحقق الحي يبقى في تقرير التنفيذ. */
void createCashContinuityEntry;
void ({} as CashContinuityEntry);
