import { describe, expect, it } from "vitest";
import { CorrectionHistoryService } from "./correctionHistoryService";
import { ProjectFinancialService } from "./projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { createDirectSale } from "@micro-domain/direct-sale/index.js";
import { createFinancialEvent, createFinancialReversal } from "@micro-domain/financial-event/index.js";

const now = () => "2026-08-23T09:00:00.000Z";

/* U-001: «السجل» يجمع التصحيحات الموثقة كما سُجّلت — لا يخترع تصنيفًا ولا يعدّل قيمة. */
describe("CorrectionHistoryService", () => {
  it("lists financial-event reversals, edits, deletes, and restores with reasons and effects", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const history = new CorrectionHistoryService(store);
    const expense = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 5000,
      occurredOn: "2026-08-02",
      note: "مصروف توصيل",
      counterparty: "ناقل",
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" },
      idempotencyKey: "u001-expense",
    });
    if (!expense.ok) throw new Error("expense should save");
    const investment = await finance.record({
      type: "owner_investment_cash",
      amountMinor: 20000,
      occurredOn: "2026-08-03",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "u001-investment",
    });
    if (!investment.ok) throw new Error("investment should save");
    /* تعديل ذرّي: تراجع + بديل بمفتاح واحد. */
    const edited = await finance.editEvent({
      sourceEventId: expense.value.id,
      amountMinor: 4500,
      occurredOn: "2026-08-02",
      note: "مصروف توصيل مصحح",
      counterparty: "ناقل",
      reason: "الفاتورة ٤٥ لا ٥٠",
      idempotencyKey: `edit:${expense.value.id}`,
    });
    if (!edited.ok) throw new Error("edit should save");
    /* حذف موثق بتراجع. */
    const deleted = await finance.deleteEvent({
      sourceEventId: investment.value.id,
      reason: "سُجل مرتين بالخطأ",
      idempotencyKey: `delete:${investment.value.id}`,
    });
    if (!deleted.ok) throw new Error("delete should save");
    /* استرجاع القيم الأصلية بمفتاح restore: الصريح. */
    const restored = await finance.restoreEvent({
      sourceEventId: investment.value.id,
      idempotencyKey: `restore:${investment.value.id}`,
    });
    if (!restored.ok) throw new Error("restore should save");

    const result = await history.list();
    if (!result.ok) throw new Error("history should read");
    const entries = result.value;
    const editEntry = entries.find(entry => entry.kind === "event_edit");
    expect(editEntry).toMatchObject({
      reason: "الفاتورة ٤٥ لا ٥٠",
      amountEffectMinor: -500,
      originalLabel: expect.stringContaining("مصروف مدفوع"),
      replacementLabel: expect.stringContaining("مصروف مدفوع"),
      /* U-001 (دورة التدقيق النهائي): وصول عميق للبديل النشط حيث التعديل/الحذف. */
      deepLink: `/finance?event=${edited.value.id}`,
    });
    const deleteEntry = entries.find(entry => entry.kind === "event_reversal");
    expect(deleteEntry).toMatchObject({
      reason: "سُجل مرتين بالخطأ",
      amountEffectMinor: -20000,
      /* التراجع/الحذف يفتح صف الأصل حيث الاسترجاع. */
      deepLink: `/finance?event=${investment.value.id}`,
    });
    const restoreEntry = entries.find(entry => entry.kind === "event_restore");
    expect(restoreEntry).toMatchObject({
      amountEffectMinor: 20000,
      reason: expect.stringContaining("استرجاع بعد تراجع"),
      /* الاسترجاع يفتح صف السجل النشط المعاد تسجيله. */
      deepLink: `/finance?event=${restored.value.id}`,
    });
    /* الأنواع الثلاثة كلها ظاهرة: تعديل (تراجع + بديل)، حذف/تراجع، استرجاع. */
    expect(entries.map(entry => entry.kind).sort()).toEqual([
      "event_edit",
      "event_restore",
      "event_reversal",
    ]);
  });

  it("lists direct-sale revisions with before-prices and a deep link to the sale", async () => {
    const store = new MemoryLocalStore();
    const history = new CorrectionHistoryService(store);
    const sale = createDirectSale({
      id: "u001-sale",
      itemName: "كوب",
      quantity: 1,
      revenueMinor: 2000,
      collectedMinor: 1600,
      catalogItemId: null,
      customerName: null,
      costMinor: 600,
      occurredOn: "2026-08-05",
      recordedAt: "2026-08-05T10:00:00.000Z",
      note: "بيع",
      idempotencyKey: "u001-sale-key",
    });
    const cut = await import("@micro-domain/direct-sale/index.js").then(module =>
      module.applyPriceCut(sale, {
        idempotencyKey: "u001-cut",
        createdAt: "2026-08-06T10:00:00.000Z",
        reason: "خفّضتُ السعر",
      }),
    );
    const cancelled = await import("@micro-domain/direct-sale/index.js").then(module =>
      module.cancelDirectSale(
        { ...cut, id: "u001-sale-2", idempotencyKey: "u001-sale-key-2" },
        {
          kind: "cancel",
          idempotencyKey: "u001-cancel",
          createdAt: "2026-08-07T10:00:00.000Z",
          reason: "أُدخل بالخطأ",
        },
      ),
    );
    await store.saveDirectSale(cut);
    await store.saveDirectSale(cancelled);
    const result = await history.list();
    if (!result.ok) throw new Error("history should read");
    const cutEntry = result.value.find(entry => entry.kind === "sale_price_cut");
    expect(cutEntry).toMatchObject({
      reason: "خفّضتُ السعر",
      amountEffectMinor: -400,
      deepLink: "/direct-sales/u001-sale",
      originalLabel: expect.stringContaining("كوب"),
    });
    const cancelEntry = result.value.find(entry => entry.kind === "sale_cancel");
    /* U-001 (دورة التدقيق النهائي): أثر الإلغاء موقّع — الإيراد المستبعد بالسالب. */
    expect(cancelEntry).toMatchObject({
      reason: "أُدخل بالخطأ",
      deepLink: "/direct-sales/u001-sale-2",
      amountEffectMinor: -1600,
    });
  });

  it("lists cash-continuity reversals with their documented reason", async () => {
    const store = new MemoryLocalStore();
    const cash = new CashContinuityService(store, now);
    const history = new CorrectionHistoryService(store);
    const opened = await cash.openWallet({
      name: "درج",
      kind: "cash_drawer",
      openingMinor: 10000,
      occurredOn: "2026-08-01",
      note: "رصيد بداية",
      operationKey: "u001-cash-open",
    });
    if (!opened.ok) throw new Error("wallet should save");
    const entries = await store.listCashContinuityEntries();
    if (!entries.ok || entries.value.length === 0) throw new Error("entries should exist");
    const reversed = await cash.reverse({
      entryId: entries.value[0]!.id,
      occurredOn: "2026-08-10",
      reason: "المبلغ غير صحيح",
      operationKey: "u001-cash-reverse",
    });
    if (!reversed.ok) throw new Error("reversal should save");
    const historyResult = await history.list();
    if (!historyResult.ok) throw new Error("history should read");
    const cashEntry = historyResult.value.find(entry => entry.kind === "cash_reversal");
    /* S1-08: الوصلة تفتح دفتر المحفظة نفسه مع تركيز صف التراجع (?entry=). */
    expect(cashEntry).toMatchObject({
      reason: "المبلغ غير صحيح",
      amountEffectMinor: -10000,
    });
    expect(cashEntry?.deepLink).toContain(`/cash/wallet/`);
    expect(cashEntry?.deepLink).toContain(`entry=`);
  });

  it("returns empty for a clean store and never invents entries", async () => {
    const store = new MemoryLocalStore();
    const history = new CorrectionHistoryService(store);
    await expect(history.list()).resolves.toMatchObject({ ok: true, value: [] });
  });
});

describe("CorrectionHistoryService.affecting — خلاصة أثر التصحيحات (المجموعة ٦، البند ٣)", () => {
  it("بلا نطاق: كل التصحيحات بعدّها وصافيها الموقع", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const history = new CorrectionHistoryService(store);
    const expense = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 5000,
      occurredOn: "2026-08-02",
      note: "مصروف",
      counterparty: null,
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" },
      idempotencyKey: "g6-affect-exp",
    });
    if (!expense.ok) throw new Error("expense should save");
    const reversal = await finance.reverse({
      sourceEventId: expense.value.id,
      occurredOn: "2026-08-04",
      reason: "سُجل خطأ",
      idempotencyKey: `g6-affect-rev:${expense.value.id}`,
    });
    if (!reversal.ok) throw new Error("reversal should save");
    const digest = await history.affecting();
    expect(digest.ok).toBe(true);
    if (!digest.ok) return;
    expect(digest.value.count).toBe(1);
    /* العرف القائم: أثر التراجع معكوس مبلغ حدث التراجع (المصروف كان سالب الكاش). */
    expect(digest.value.netAmountMinor).toBe(-5000);
    expect(digest.value.entries[0]?.reason).toBe("سُجل خطأ");
  });

  it("بنطاق: تُستبعد التصحيحات خارج [من، إلى] ويبقى الصافي صادقًا", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const history = new CorrectionHistoryService(store);
    const first = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 2000,
      occurredOn: "2026-08-05",
      note: "مصروف آب",
      counterparty: null,
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" },
      idempotencyKey: "g6-range-a",
    });
    if (!first.ok) throw new Error("first should save");
    await finance.reverse({
      sourceEventId: first.value.id,
      occurredOn: "2026-08-06",
      reason: "تصحيح آب",
      idempotencyKey: `g6-range-a-rev:${first.value.id}`,
    });
    const second = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 3000,
      occurredOn: "2026-09-05",
      note: "مصروف أيلول",
      counterparty: null,
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" },
      idempotencyKey: "g6-range-b",
    });
    if (!second.ok) throw new Error("second should save");
    await finance.reverse({
      sourceEventId: second.value.id,
      occurredOn: "2026-09-06",
      reason: "تصحيح أيلول",
      idempotencyKey: `g6-range-b-rev:${second.value.id}`,
    });
    const inSeptember = await history.affecting("2026-09-01", "2026-09-30");
    expect(inSeptember.ok).toBe(true);
    if (!inSeptember.ok) return;
    expect(inSeptember.value.count).toBe(1);
    expect(inSeptember.value.netAmountMinor).toBe(-3000);
    const inAugust = await history.affecting("2026-08-01", "2026-08-31");
    expect(inAugust.ok).toBe(true);
    if (!inAugust.ok) return;
    expect(inAugust.value.count).toBe(1);
    expect(inAugust.value.netAmountMinor).toBe(-2000);
  });
});

/* المجموعة ٥ (عقد ٣٤ — اختبار مسار التدقيق الموسّع): اقتران تعديلات المجموعة
 * ٤ الذرّية (reversal/replacement بنفس الختم)، وعائلات الأصحاب الجديدة —
 * عكس التسليم وتصنيف العربون وعكس حركة المخزون ومراجعة عقد الأصل وتراجع
 * حركة مال المالك. */
describe("CorrectionHistoryService — امتداد المجموعة ٥ (عقد ٣٤)", () => {
  it("pairs the G4 reverse+replace convention and shows from → to", async () => {
    const store = new MemoryLocalStore();
    const history = new CorrectionHistoryService(store);
    const base = {
      type: "operating_expense_cash" as const,
      occurredOn: "2026-09-01",
      note: "أصل الاقتران",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "pair-base",
      expenseContext: { relationship: "project" as const, behavior: "fixed" as const, purpose: "period" as const, knowledge: "known" as const },
    };
    const original = await store.saveFinancialEvent(
      createFinancialEvent({ id: "pair-1", amountMinor: 3000, recordedAt: now(), ...base }),
    );
    if (!original.ok) throw new Error(original.message);
    /* التراجع عبر معيّن المجال القياسي، والبديل حدث عادي بمفتاح الختم نفسه —
     * نمط مفاتيح المجموعة ٤ الحقيقي. */
    const reversal = await store.saveFinancialEvent(
      createFinancialReversal({
        id: "pair-rev",
        sourceEvent: original.value,
        occurredOn: "2026-09-02",
        recordedAt: now(),
        idempotencyKey: "x:acquisition-reversal:stamp",
        reason: "قيمة أولى خاطئة",
      }),
    );
    if (!reversal.ok) throw new Error(reversal.message);
    const patchedReversal = await store.saveFinancialEvent({
      ...reversal.value,
      idempotencyKey: "x:acquisition-reversal:stamp",
    });
    if (!patchedReversal.ok) throw new Error(patchedReversal.message);
    const replacement = await store.saveFinancialEvent(
      createFinancialEvent({
        id: "pair-repl",
        type: "operating_expense_cash",
        amountMinor: 3500,
        occurredOn: "2026-09-02",
        recordedAt: now(),
        note: "بديل",
        counterparty: null,
        relatedEventId: null,
        idempotencyKey: "x:acquisition-replacement:stamp",
      }),
    );
    if (!replacement.ok) throw new Error(replacement.message);
    const list = await history.list();
    if (!list.ok) throw new Error(list.message);
    const entry = list.value.find(item => item.id === "pair-rev");
    expect(entry?.kind).toBe("asset_correction");
    expect(entry?.replacementLabel).toContain("مصروف مدفوع");
    expect(entry?.replacementLabel).toContain("35.00 د.أ");
    expect(entry?.originalLabel).toContain("30.00 د.أ");
    expect(entry?.amountEffectMinor).toBe(500);
  });

  it("collects inventory reversals, delivery reversals, deposit classifications, asset contract revisions, and owner reversals", async () => {
    const store = new MemoryLocalStore();
    const history = new CorrectionHistoryService(store);
    /* عكس حركة مخزون موثق. */
    const committed = await store.commitInventory(
      {
        id: "mat-h",
        name: "خيط",
        unit: "piece",
        createdAt: now(),
        createdOperationKey: "mat-h",
      },
      [
        {
          id: "mov-h",
          materialId: "mat-h",
          type: "reversal",
          occurredOn: "2026-09-02",
          recordedAt: now(),
          quantityDeltaMilli: 500,
          valueDeltaMinor: 300,
          note: "عكس تسليم: خطأ كمية",
          reason: null,
          operationKey: "mov-h-rev",
          purchaseId: null,
          orderId: "order-h",
          reversesMovementId: "mov-h-original",
          wasteContext: null,
        },
      ],
    );
    if (!committed.ok) throw new Error(committed.message);
    /* طلب بعكس تسليم وتصنيف عربون. */
    const storedOrder = {
      id: "order-h",
      order: {
        id: "order-h",
        customerName: "زبون",
        itemName: "عمل",
        specifications: "مواصفة",
        quantity: 1,
        currency: "JOD",
        agreedPriceMinor: 10000,
        costSnapshot: { currency: "JOD", quantity: 1, createdAt: now() },
        costSnapshots: [],
        status: "delivered",
        settlementStatus: "paid",
        depositCollectedMinor: 2000,
        depositSettlement: "retain_deposit",
        retainedMeaning: "revenue",
        collectedMinor: 10000,
        receivableMinor: 0,
        recognizedRevenueMinor: 10000,
        recognizedCostMinor: 4000,
        profitIndicatorMinor: 6000,
        resultStatus: "final",
        nextAction: null,
        events: [
          {
            id: "ev-delivered",
            type: "status_changed",
            idempotencyKey: "o-h-delivered",
            createdAt: now(),
            toStatus: "delivered",
          },
          {
            id: "ev-delivery-reversed",
            type: "delivery_reversed",
            idempotencyKey: "o-h-delivery-reversed",
            createdAt: now(),
            reversesEventId: "ev-delivered",
            note: "مرتجع بعد التسليم",
          },
          {
            id: "ev-classified",
            type: "deposit_classified",
            idempotencyKey: "o-h-classified",
            createdAt: now(),
            note: "قرار الاحتفاظ إيرادًا",
          },
        ],
        createdAt: now(),
      },
      catalogItemId: null,
      deliveryDate: "2026-09-10",
      agreementSource: null,
      createdAt: now(),
      updatedAt: now(),
    };
    const savedOrder = await store.saveOrder(storedOrder);
    if (!savedOrder.ok) throw new Error(savedOrder.message);
    /* أصل بمراجعة عقد. */
    const committedAsset = await store.commitAssetRecord(
      {
        id: "asset-h",
        name: "ماكينة",
        categoryLabel: null,
        acquisitionAmountMinor: 9000,
        acquisitionKind: "cash",
        purchaseDate: "2026-08-01",
        lifeMonths: 60,
        depreciationStartOn: "2026-08-01",
        note: null,
        status: "active",
        acquisitionEventId: "asset-h-acq",
        disposal: null,
        writeOff: null,
        contractRevisions: [
          { revision: 1, lifeMonths: 48, depreciationStartOn: "2026-08-01", reason: "مراجعة عمر", changedAt: now() },
        ],
        operationKey: "asset-h",
        createdAt: now(),
        updatedAt: now(),
      },
      null,
    );
    if (!committedAsset.ok) throw new Error(committedAsset.message);
    /* حركة مال مالك متراجعة. */
    const committedOwner = await store.commitOwnerMovement(
      {
        id: "owner-h",
        kind: "draw",
        amountMinor: 1000,
        walletId: "wallet-h",
        occurredOn: "2026-09-01",
        recordedAt: now(),
        reason: "owner_draw",
        note: "سحب",
        idempotencyKey: "owner-h",
        relatedEntitlementId: null,
        relatedOpeningBalanceId: null,
        relatedMovementId: null,
        reversalOfId: "owner-h-original",
        reversalReason: "خطأ",
        cashDeltaMinor: -1000,
        entitlementDeltaMinor: 0,
        openingBalanceDeltaMinor: 0,
        ownerCapitalDeltaMinor: -1000,
      },
      {
        id: "cash-h",
        walletId: "wallet-h",
        type: "reversal",
        occurredOn: "2026-09-01",
        recordedAt: now(),
        cashDeltaMinor: 1000,
        note: "مرآة السحب",
        reason: null,
        operationKey: "cash-h",
        transferId: null,
        reversesEntryId: null,
      },
    );
    if (!committedOwner.ok) throw new Error(committedOwner.message);

    const list = await history.list();
    if (!list.ok) throw new Error(list.message);
    const kinds = new Set(list.value.map(entry => entry.kind));
    expect(kinds.has("inventory_reversal")).toBe(true);
    expect(kinds.has("delivery_reversal")).toBe(true);
    expect(kinds.has("deposit_classification")).toBe(true);
    expect(kinds.has("asset_contract_revision")).toBe(true);
    expect(kinds.has("owner_reversal")).toBe(true);
    const classification = list.value.find(entry => entry.kind === "deposit_classification");
    expect(classification?.replacementLabel).toContain("إيراد مشروع");
    const contractRevision = list.value.find(entry => entry.kind === "asset_contract_revision");
    expect(contractRevision?.deepLink).toBe("/assets/asset-h");
  });
});
