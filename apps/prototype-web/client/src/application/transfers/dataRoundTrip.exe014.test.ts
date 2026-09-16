/** EXE-014 (DATA-001 / AUD-NEW-09): الاستيراد والاستعادة دون فقد.
 *
 * أربع حقائق تُثبت هنا بالخدمات الحية والمخازن الحقيقية:
 * ١) بوابة الاستيراد الافتتاحي تغطي كل العائلات المؤثرة عبر السجل التعاقدي
 *    الموحّد — سجل واحد في أي عائلة (التفضيلات، ملف المالك، البيع المباشر،
 *    الأصل، القرض، دفتر المالك…) يمنع الاستيراد فوق بيانات قائمة بلا مسح صامت.
 * ٢) دورة تصدير → تغيير بيانات → استعادة كاملة تعيد كل العائلات المشمولة
 *    بالقيم نفسها، مع نسخة ما قبل الاستبدال قابلة للاسترجاع فعلًا (تُختبر
 *    بدورتها الخاصة).
 * ٣) الملف غير الصالح أو الإصدار غير المدعوم لا يغير أي بيانات.
 * ٤) فشل الاستبدال يترك الحالة السابقة كاملة — لا نصف استعادة.
 */
import { describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { influentialFamilyCounts } from "@/storage/local/influentialSnapshotFamilies";
import { GuidedOpeningImportService } from "@/application/transfers/guidedOpeningImportService";
import { LocalTransferService } from "@/application/transfers/localTransferService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { OwnerEntitlementService } from "@/application/finance/ownerEntitlementService";
import { LoanService } from "@/application/loans/loanService";
import { AssetService } from "@/application/assets/assetService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { createDirectSale } from "@micro-domain/direct-sale/index.js";
import {
  calculateCostSnapshot,
  createCraftOrder,
  collectDeposit,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import type { StoredCraftOrder } from "@/storage/local/types";

const NOW = "2026-09-17T09:00:00.000Z";
const now = () => NOW;

const openingFile = JSON.stringify({
  format: "micro-guided-opening-import",
  version: 1,
  importId: "exe014-opening-import",
  profile: {
    source: "جرد يدوي",
    knowledge: "known",
    occurredOn: "2026-09-01",
    note: "بداية موثقة",
    activityName: "مشروع الاختبار",
    currency: "JOD",
    activityType: "custom_craft",
  },
  cashWallets: [
    {
      source: "جرد يدوي",
      knowledge: "known",
      occurredOn: "2026-09-01",
      note: "درج النقدي",
      id: "drawer",
      name: "الدرج",
      kind: "cash_drawer",
      openingMinor: 5000,
    },
  ],
  materials: [
    {
      source: "جرد يدوي",
      knowledge: "known",
      occurredOn: "2026-09-01",
      note: "خشب البداية",
      id: "wood",
      name: "خشب",
      unit: "piece",
      openingQuantityMilli: 2000,
      openingValueMinor: 2000,
    },
  ],
});

/* ═══════ ١) بوابة الفراغ تغطي كل عائلة مؤثرة ═══════ */

describe("EXE-014 opening-import gate refuses any occupied influential family", () => {
  const requiredSeeds: readonly [string, (store: PrototypeLocalStore) => Promise<void>][] = [
    [
      "preferences",
      async store => {
        const saved = await store.savePreferences({
          id: "local-preferences",
          theme: "light",
          dailyScheduleCapacityMinutes: null,
          workMode: null,
          actualTimeTrackingEnabled: false,
          installBannerDismissedAt: null,
          updatedAt: NOW,
        });
        if (!saved.ok) throw new Error(saved.message);
      },
    ],
    [
      "ownerProfile",
      async store => {
        const saved = await store.saveOwnerProfile({
          id: "local-owner-profile",
          ownerId: "owner-exe014",
          displayName: "المالكة",
          email: null,
          provider: null,
          externalAccountId: null,
          createdAt: NOW,
          updatedAt: NOW,
        });
        if (!saved.ok) throw new Error(saved.message);
      },
    ],
    [
      "directSales",
      async store => {
        const saved = await store.saveDirectSale(
          createDirectSale({
            id: "sale-exe014",
            itemName: "قطعة",
            quantity: 1,
            revenueMinor: 3000,
            collectedMinor: 3000,
            catalogItemId: null,
            customerName: null,
            costMinor: 1000,
            occurredOn: "2026-09-10",
            recordedAt: NOW,
            note: "بيع نقدي",
            idempotencyKey: "exe014-sale",
          }),
        );
        if (!saved.ok) throw new Error(saved.message);
      },
    ],
    [
      "loans",
      async store => {
        const loans = new LoanService(store, now);
        const created = await loans.create({
          borrowerName: "سليم",
          principalMinor: 2000,
          loanDate: "2026-09-10",
          purposeNote: "قرض اختبار البوابة",
        });
        if (!created.ok) throw new Error(created.message);
      },
    ],
    [
      "assets",
      async store => {
        const assets = new AssetService(store, now);
        const created = await assets.create({
          name: "طاولة",
          acquisitionAmountMinor: 4000,
          acquisitionKind: "cash",
          purchaseDate: "2026-09-10",
          lifeMonths: 24,
          depreciationStartOn: "2026-09-10",
          note: "أصل اختبار البوابة",
        });
        if (!created.ok) throw new Error(created.message);
      },
    ],
    [
      "ownerMovements",
      async store => {
        const cash = new CashContinuityService(store, now);
        const wallet = await cash.openWallet({
          name: "الدرج",
          kind: "cash_drawer",
          openingMinor: 1000,
          occurredOn: "2026-09-01",
          note: "افتتاح",
          operationKey: "exe014-gate-wallet",
        });
        if (!wallet.ok) throw new Error(wallet.message);
        const owner = new OwnerEntitlementService(store, now);
        const saved = await owner.recordMovement({
          kind: "draw",
          amountMinor: 500,
          walletId: wallet.value.wallet.id,
          occurredOn: "2026-09-12",
          note: "سحب شخصي",
          reason: "owner_draw",
          idempotencyKey: "exe014-owner-move",
        });
        if (!saved.ok) throw new Error(saved.message);
      },
    ],
  ];

  for (const [family, seed] of requiredSeeds) {
    it(`a single ${family} record blocks the opening import without touching anything`, async () => {
      const store = new MemoryLocalStore();
      await seed(store);
      const before = await store.readSnapshot();
      if (!before.ok) throw new Error(before.message);
      const service = new GuidedOpeningImportService(store, now);
      const prepared = await service.prepare(openingFile);
      expect(prepared.ok).toBe(false);
      if (prepared.ok) return;
      expect(prepared.code).toBe("non_empty_store");
      /* لا مسح صامت: اللقطة نفسها قبل الرفض وبعده حرفيًا. */
      const after = await store.readSnapshot();
      if (!after.ok) throw new Error(after.message);
      expect(after.value).toEqual(before.value);
    });
  }

  it("an empty system still accepts the opening position through the same registry gate", async () => {
    const store = new MemoryLocalStore();
    const service = new GuidedOpeningImportService(store, now);
    const prepared = await service.prepare(openingFile);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const confirmed = await service.confirm(prepared.value);
    expect(confirmed.ok).toBe(true);
    const counts = influentialFamilyCounts((await store.readSnapshot()).value!);
    /* الكتابة حدثت فعلًا: محفظة ومادة وحركة وقيود — لا بوابة تمنع كل شيء. */
    expect(counts.find(family => family.key === "cashWallets")?.count).toBe(1);
    expect(counts.find(family => family.key === "materials")?.count).toBe(1);
  });
});

/* ═══════ ٢) دورة التصدير والتغيير والاستعادة بلا فقد ═══════ */

describe("EXE-014 export → change → restore returns every covered family intact", () => {
  it("round-trips the full snapshot with a genuinely restorable pre-replace backup", async () => {
    /* المصدر: بيانات حية عبر الخدمات في كل العائلات الجوهرية. */
    const source = new MemoryLocalStore();
    const cash = new CashContinuityService(source, now);
    const finance = new ProjectFinancialService(source, now);
    const suppliers = new SupplierPurchaseService(source, now);
    const owner = new OwnerEntitlementService(source, now);
    const loans = new LoanService(source, now);
    const assets = new AssetService(source, now);
    const inventory = new InventoryMaterialService(source, now);

    const wallet = await cash.openWallet({
      name: "الدرج",
      kind: "cash_drawer",
      openingMinor: 8000,
      occurredOn: "2026-09-01",
      note: "افتتاح",
      operationKey: "exe014-wallet",
    });
    if (!wallet.ok) throw new Error(wallet.message);
    const expense = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 250,
      occurredOn: "2026-09-05",
      note: "توصيل",
      counterparty: null,
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" },
      idempotencyKey: "exe014-expense",
    });
    if (!expense.ok) throw new Error(expense.message);
    const purchase = await suppliers.recordPurchase({
      supplierName: "مورد",
      note: "خامات",
      purchasedOn: "2026-09-06",
      dueOn: null,
      totalMinor: 1500,
      initialPaidMinor: 500,
      idempotencyKey: "exe014-purchase",
    });
    if (!purchase.ok) throw new Error(purchase.message);
    const draw = await owner.recordMovement({
      kind: "draw",
      amountMinor: 700,
      walletId: wallet.value.wallet.id,
      occurredOn: "2026-09-07",
      note: "سحب شخصي",
      reason: "owner_draw",
      idempotencyKey: "exe014-draw",
    });
    if (!draw.ok) throw new Error(draw.message);
    const loan = await loans.create({
      borrowerName: "سليم",
      principalMinor: 3000,
      loanDate: "2026-09-08",
      purposeNote: "قرض",
    });
    if (!loan.ok) throw new Error(loan.message);
    const asset = await assets.create({
      name: "ماكينة",
      acquisitionAmountMinor: 5000,
      acquisitionKind: "cash",
      purchaseDate: "2026-09-08",
      lifeMonths: 24,
      depreciationStartOn: "2026-09-08",
      note: "أصل",
    });
    if (!asset.ok) throw new Error(asset.message);
    const material = await inventory.openMaterial({
      name: "خشب",
      unit: "piece",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 5000,
        costState: "known",
        valueMinor: 2500,
        confirmedOn: "2026-09-01",
        sourceNote: "جرد",
      },
      note: "رصيد",
      operationKey: "exe014-material",
    });
    if (!material.ok) throw new Error(material.message);
    const snapshotCost = calculateCostSnapshot("exe014-cost", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 90, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: NOW,
      freshnessDays: null,
    });
    let order = createCraftOrder({
      id: "order-exe014",
      customerName: "عميلة",
      itemName: "قطعة",
      specifications: "دورة الاستعادة",
      quantity: 1,
      agreedPriceMinor: 4000,
      costSnapshot: snapshotCost,
      createdAt: NOW,
    });
    order = collectDeposit(order, 1500, "exe014-deposit", NOW);
    order = transitionOrder(order, { to: "provisional_agreement", idempotencyKey: "exe014-prov", createdAt: NOW });
    order = transitionOrder(order, { to: "confirmed", idempotencyKey: "exe014-confirm", createdAt: NOW });
    const storedOrder: StoredCraftOrder = {
      id: order.id,
      order,
      catalogItemId: null,
      deliveryDate: "2026-09-20",
      agreementSource: "whatsapp",
      followUpSummary: null,
      followUpDate: null,
      followUpReason: null,
      followUpEvents: [],
      createdAt: NOW,
      updatedAt: NOW,
    };
    const savedOrder = await source.saveOrder(storedOrder);
    if (!savedOrder.ok) throw new Error("order should save");
    const savedSchedule = await source.saveSchedule({
      id: "schedule-exe014",
      orderId: order.id,
      kind: "delivery",
      scheduledFor: "2026-09-20",
      scheduledTime: "10:00",
      durationMinutes: 60,
      status: "scheduled",
      postponeReason: null,
      events: [],
      createdAt: NOW,
      updatedAt: NOW,
    });
    if (!savedSchedule.ok) throw new Error(savedSchedule.message);
    const savedPrefs = await source.savePreferences({
      id: "local-preferences",
      theme: "dark",
      dailyScheduleCapacityMinutes: 120,
      workMode: "mixed",
      actualTimeTrackingEnabled: true,
      installBannerDismissedAt: null,
      updatedAt: NOW,
    });
    if (!savedPrefs.ok) throw new Error(savedPrefs.message);
    const savedSale = await source.saveDirectSale(
      createDirectSale({
        id: "sale-exe014",
        itemName: "قطعة",
        quantity: 2,
        revenueMinor: 6000,
        collectedMinor: 2000,
        collectionStatus: "partial_debt",
        catalogItemId: null,
        customerName: "زبونة",
        costMinor: 2000,
        occurredOn: "2026-09-11",
        recordedAt: NOW,
        note: "بيع بدين جزئي",
        idempotencyKey: "exe014-sale",
      }),
    );
    if (!savedSale.ok) throw new Error(savedSale.message);

    const sourceSnapshot = await source.readSnapshot();
    if (!sourceSnapshot.ok) throw new Error(sourceSnapshot.message);
    const sourceCounts = influentialFamilyCounts(sourceSnapshot.value);

    /* التصدير المُتحقق منه. */
    const sourceTransfers = new LocalTransferService(source, now);
    const exported = await sourceTransfers.createVerifiedExport();
    if (!exported.ok) throw new Error(exported.message);
    const serialized = JSON.stringify(exported.value.file, null, 2);

    /* الهدف: بيانات مختلفة قائمة تُستبدل — التفضيلات وملف المالك قبل أي شيء. */
    const target = new MemoryLocalStore();
    const targetTransfers = new LocalTransferService(target, now);
    const savedTargetPrefs = await target.savePreferences({
      id: "local-preferences",
      theme: "light",
      dailyScheduleCapacityMinutes: null,
      workMode: null,
      actualTimeTrackingEnabled: false,
      installBannerDismissedAt: null,
      updatedAt: NOW,
    });
    if (!savedTargetPrefs.ok) throw new Error(savedTargetPrefs.message);
    const targetBefore = await target.readSnapshot();
    if (!targetBefore.ok) throw new Error(targetBefore.message);

    const prepared = targetTransfers.prepareImport(serialized);
    if (!prepared.ok) throw new Error(prepared.message);
    const restored = await targetTransfers.confirmImport(prepared.value);
    if (!restored.ok) throw new Error(restored.message);

    /* كل عائلة مشمولة عادت بالعدّ نفسه — لا نصف استعادة ولا فقد. */
    const targetAfter = await target.readSnapshot();
    if (!targetAfter.ok) throw new Error(targetAfter.message);
    const targetCounts = influentialFamilyCounts(targetAfter.value);
    expect(targetCounts).toEqual(sourceCounts);
    /* العائلات المزروعة فعلًا غير فارغة — الدورة غير تافهة. */
    for (const key of [
      "preferences",
      "orders",
      "directSales",
      "schedules",
      "financialEvents",
      "supplierPurchases",
      "cashWallets",
      "cashContinuityEntries",
      "materials",
      "ownerMovements",
      "loans",
      "assets",
    ] as const)
      expect(targetCounts.find(family => family.key === key)?.count).toBeGreaterThan(0);
    /* القيم نفسها لا العدد فقط: اللقطة المستعادة تطابق بيانات الملف المُرحَّلة. */
    expect(targetAfter.value).toEqual(prepared.value.file.data);

    /* النسخة الاحتياطية قابلة للاسترجاع فعلًا: تعيد حالة الهدف قبل الاستبدال.
     * (الترحيل يُفصح الحقول الاختيارية الغائبة كـ null — نفس المعنى؛ فالمقارنة
     * بالعدادات لكل عائلة + قيم الحقول الجوهرية.) */
    const backup = restored.value.backup;
    expect(influentialFamilyCounts(backup.data)).toEqual(influentialFamilyCounts(targetBefore.value));
    expect(backup.data.preferences?.theme).toBe("light");
    expect(backup.data.orders).toHaveLength(0);
    const third = new MemoryLocalStore();
    const thirdTransfers = new LocalTransferService(third, now);
    const backupPrepared = thirdTransfers.prepareImport(JSON.stringify(backup, null, 2));
    if (!backupPrepared.ok) throw new Error(backupPrepared.message);
    const backupRestored = await thirdTransfers.confirmImport(backupPrepared.value);
    if (!backupRestored.ok) throw new Error(backupRestored.message);
    const thirdSnapshot = await third.readSnapshot();
    if (!thirdSnapshot.ok) throw new Error(thirdSnapshot.message);
    expect(influentialFamilyCounts(thirdSnapshot.value)).toEqual(influentialFamilyCounts(targetBefore.value));
    expect(thirdSnapshot.value.preferences?.theme).toBe("light");
    expect(thirdSnapshot.value.orders).toHaveLength(0);
  });
});

/* ═══════ ٣) الملف غير الصالح لا يغير شيئًا ═══════ */

describe("EXE-014 invalid or unsupported files change nothing", () => {
  it("rejects broken JSON, a wrong format, and an unsupported version without any write", async () => {
    const store = new MemoryLocalStore();
    const savedPrefs = await store.savePreferences({
      id: "local-preferences",
      theme: "light",
      dailyScheduleCapacityMinutes: null,
      workMode: null,
      actualTimeTrackingEnabled: false,
      installBannerDismissedAt: null,
      updatedAt: NOW,
    });
    if (!savedPrefs.ok) throw new Error(savedPrefs.message);
    const before = await store.readSnapshot();
    if (!before.ok) throw new Error(before.message);
    const transfers = new LocalTransferService(store, now);
    expect(transfers.prepareImport("{broken")).toMatchObject({ ok: false, code: "validation_error" });
    expect(
      transfers.prepareImport(JSON.stringify({ format: "other-app", version: 1, data: {} })),
    ).toMatchObject({ ok: false, code: "validation_error" });
    expect(
      transfers.prepareImport(
        JSON.stringify({
          format: "micro-local-backup",
          version: 999,
          schemaVersion: 35,
          exportedAt: NOW,
          data: {},
        }),
      ),
    ).toMatchObject({ ok: false, code: "validation_error" });
    const after = await store.readSnapshot();
    if (!after.ok) throw new Error(after.message);
    expect(after.value).toEqual(before.value);
  });
});

/* ═══════ ٤) فشل الاستبدال يترك الحالة كاملة ═══════ */

describe("EXE-014 a failed replacement leaves the previous state whole", () => {
  it("confirmImport fails honestly and the old snapshot stays complete", async () => {
    const source = new MemoryLocalStore();
    const sourceTransfers = new LocalTransferService(source, now);
    const exported = await sourceTransfers.createVerifiedExport();
    if (!exported.ok) throw new Error(exported.message);
    const serialized = JSON.stringify(exported.value.file, null, 2);

    const savedPrefs = await source.savePreferences({
      id: "local-preferences",
      theme: "dark",
      dailyScheduleCapacityMinutes: null,
      workMode: null,
      actualTimeTrackingEnabled: false,
      installBannerDismissedAt: null,
      updatedAt: NOW,
    });
    if (!savedPrefs.ok) throw new Error(savedPrefs.message);
    const before = await source.readSnapshot();
    if (!before.ok) throw new Error(before.message);

    /* مخزن يفشل الاستبدال عمدًا — البوابة تصدق الفشل ولا توهم بنجاح. */
    const failing = new (class extends MemoryLocalStore {
      public override async replaceSnapshot() {
        return { ok: false as const, code: "storage_error" as const, message: "تعذر مُتعَمد" };
      }
    })();
    const savedFailingPrefs = await failing.savePreferences({
      id: "local-preferences",
      theme: "light",
      dailyScheduleCapacityMinutes: null,
      workMode: null,
      actualTimeTrackingEnabled: false,
      installBannerDismissedAt: null,
      updatedAt: NOW,
    });
    if (!savedFailingPrefs.ok) throw new Error(savedFailingPrefs.message);
    const failingBefore = await failing.readSnapshot();
    if (!failingBefore.ok) throw new Error(failingBefore.message);

    const failingTransfers = new LocalTransferService(failing, now);
    const prepared = failingTransfers.prepareImport(serialized);
    if (!prepared.ok) throw new Error(prepared.message);
    const result = await failingTransfers.confirmImport(prepared.value);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("storage_error");
    const failingAfter = await failing.readSnapshot();
    if (!failingAfter.ok) throw new Error(failingAfter.message);
    /* الحالة السابقة كاملة — لا نصف استعادة. */
    expect(failingAfter.value).toEqual(failingBefore.value);
    void before;
  });
});
