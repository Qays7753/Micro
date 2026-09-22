import { describe, expect, it } from "vitest";
import { G5Service } from "./g5Service";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { createSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";

/* FIN-005 (WS-175 — Wave 3): قراءة أفق الكاش القصير على مستوى الخدمة —
 * الأفق مثبّت على «اليوم» المحلي عمان من الساعة القابلة للحقن، والصيغة
 * والمحرك كما هما (لا مسار حساب ثاني)، والقراءة لا تكتب شيئًا إطلاقًا
 * (دليل عمق: لقطة المخزن قبل/بعد متطابقة تمامًا). */
const now = () => "2026-09-23T09:00:00.000Z"; // 12:00 بتوقيت عمان → اليوم المحلي 2026-09-23

async function snapshot(store: MemoryLocalStore) {
  const read = await store.readSnapshot();
  if (!read.ok) throw new Error("snapshot read failed");
  return JSON.stringify(read.value);
}

describe("G5Service.readShortCashHorizon (FIN-005 — WS-175)", () => {
  it("anchors the window on the injected clock's Amman local today and keeps the formula unchanged", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, finance, now);
    await finance.record({
      type: "operating_expense_cash",
      amountMinor: 1000,
      occurredOn: "2026-09-20",
      note: "مصروف نقدي",
      counterparty: null,
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
      idempotencyKey: "horizon-expense",
    });
    const declared = await g5.createDeclaration({
      direction: "collection",
      amountMinor: 4000,
      dueOn: "2026-10-10",
      source: "عميلة — تحصيل مؤكد",
      knowledge: "known",
      note: "داخل أفق ٣٠ يومًا",
      relatedOrderId: null,
      relatedEventId: null,
      idempotencyKey: "horizon-collection",
    });
    expect(declared).toMatchObject({ ok: true });
    const reading = await g5.readShortCashHorizon(30);
    expect(reading).toMatchObject({
      ok: true,
      value: {
        horizon: { horizonDays: 30, from: "2026-09-23", to: "2026-10-22" },
        shortCash: {
          status: "available",
          recordedCashMinor: -1000,
          declaredCollectionsMinor: 4000,
          declaredCommitmentsMinor: 0,
          projectedCashMinor: 3000,
        },
      },
    });
  });

  it("includes dated balances exactly on both horizon edges and excludes them one day outside", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, finance, now);
    /* ثلاثة التزامات مؤرخة: على بداية الأفق، على نهاية أفق ٣٠، وخارجها بيوم واحد
     * (داخل أفق ٩٠ وحده — الفروق بين الأفقال ظاهرة لا مكتومة). */
    for (const [id, dueOn] of [
      ["edge-start", "2026-09-23"],
      ["edge-end-30", "2026-10-22"],
      ["outside-30", "2026-10-23"],
    ] as const) {
      await store.saveSupplierPurchase(
        createSupplierPurchase({
          id,
          supplierName: "مورد",
          note: "التزام مؤرخ",
          purchasedOn: "2026-09-01",
          dueOn,
          totalMinor: 1000,
          initialPaidMinor: 0,
          recordedAt: now(),
          idempotencyKey: id,
        }),
      );
    }
    const reading = await g5.readShortCashHorizon(30);
    expect(reading).toMatchObject({
      ok: true,
      value: {
        horizon: { from: "2026-09-23", to: "2026-10-22" },
        shortCash: {
          status: "available",
          declaredCommitmentsMinor: 2000,
          projectedCashMinor: -2000,
        },
      },
    });
    /* أفق ٧ أيام يلتقط التزام بداية الأفق وحده — الطرفان شاملان والحدّ صارم. */
    const week = await g5.readShortCashHorizon(7);
    expect(week).toMatchObject({
      ok: true,
      value: {
        horizon: { horizonDays: 7, from: "2026-09-23", to: "2026-09-29" },
        shortCash: { status: "available", declaredCommitmentsMinor: 1000, projectedCashMinor: -1000 },
      },
    });
    /* أفق ٩٠ يومًا يلتقط الثلاثة — اليوم الواحد خارج أفق ٣٠ يظل مؤرخًا صادقًا في أفق أوسع. */
    const quarter = await g5.readShortCashHorizon(90);
    expect(quarter).toMatchObject({
      ok: true,
      value: {
        horizon: { horizonDays: 90, from: "2026-09-23", to: "2026-12-21" },
        shortCash: { status: "available", declaredCommitmentsMinor: 3000, projectedCashMinor: -3000 },
      },
    });
  });

  it("keeps undated material balances visibly incomplete instead of inventing a forecast", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, finance, now);
    await store.saveSupplierPurchase(
      createSupplierPurchase({
        id: "undated-purchase",
        supplierName: "مورد",
        note: "التزام بلا تاريخ",
        purchasedOn: "2026-09-01",
        dueOn: null,
        totalMinor: 5000,
        initialPaidMinor: 0,
        recordedAt: now(),
        idempotencyKey: "undated-purchase",
      }),
    );
    const reading = await g5.readShortCashHorizon(30);
    expect(reading).toMatchObject({
      ok: true,
      value: {
        shortCash: {
          status: "incomplete",
          undatedPayablesMinor: 5000,
          projectedCashMinor: null,
        },
      },
    });
  });

  it("never mutates cash, debt, events, declarations, or storage while reading every horizon", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, finance, now);
    await finance.record({
      type: "operating_expense_cash",
      amountMinor: 1000,
      occurredOn: "2026-09-20",
      note: "مصروف نقدي",
      counterparty: null,
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
      idempotencyKey: "no-write-expense",
    });
    await g5.createDeclaration({
      direction: "commitment",
      amountMinor: 2000,
      dueOn: "2026-09-28",
      source: "سداد مورد",
      knowledge: "estimated",
      note: "تقدير معلن",
      relatedOrderId: null,
      relatedEventId: null,
      idempotencyKey: "no-write-commitment",
    });
    const before = await snapshot(store);
    for (const horizonDays of [7, 30, 90] as const) {
      const reading = await g5.readShortCashHorizon(horizonDays);
      expect(reading).toMatchObject({ ok: true, value: { horizon: { horizonDays } } });
    }
    expect(await snapshot(store)).toBe(before);
  });

  it("shows a negative projected cash honestly without blocking or hiding it", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, finance, now);
    await store.saveSupplierPurchase(
      createSupplierPurchase({
        id: "heavy-commitment",
        supplierName: "مورد",
        note: "التزام ثقيل مؤرخ",
        purchasedOn: "2026-09-01",
        dueOn: "2026-10-01",
        totalMinor: 9000,
        initialPaidMinor: 0,
        recordedAt: now(),
        idempotencyKey: "heavy-commitment",
      }),
    );
    const reading = await g5.readShortCashHorizon(30);
    expect(reading).toMatchObject({
      ok: true,
      value: { shortCash: { status: "available", projectedCashMinor: -9000 } },
    });
  });
});
