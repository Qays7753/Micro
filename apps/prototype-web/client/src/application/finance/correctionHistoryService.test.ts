import { describe, expect, it } from "vitest";
import { CorrectionHistoryService } from "./correctionHistoryService";
import { ProjectFinancialService } from "./projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { createDirectSale } from "@micro-domain/direct-sale/index.js";

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
    expect(cashEntry).toMatchObject({
      reason: "المبلغ غير صحيح",
      amountEffectMinor: -10000,
      /* U-001 (دورة التدقيق النهائي): القيد المصدر ظاهر في سطح المحافظ. */
      deepLink: "/cash",
    });
  });

  it("returns empty for a clean store and never invents entries", async () => {
    const store = new MemoryLocalStore();
    const history = new CorrectionHistoryService(store);
    await expect(history.list()).resolves.toMatchObject({ ok: true, value: [] });
  });
});
