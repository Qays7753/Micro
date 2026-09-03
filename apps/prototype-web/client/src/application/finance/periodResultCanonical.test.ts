import { describe, expect, it, vi } from "vitest";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { StatementService } from "@/application/finance/statementService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const now = () => "2026-09-03T09:00:00.000Z";

/* المجموعة ١ (قراءة الفترة الواحدة — TR-01): `readRecordedPeriodResult` هو
 * المنتج الكنسي الوحيد لرقم الفترة. القفل: الكشف والمؤشرات يستهلكانه (تطابق
 * كائن كامل + استدعاء فعلي)، ولا يبقى أي حساب فترة داخل الصفحات؛ null قيمة
 * معلنة تتطابق أسبابها عبر الأسطح — هذا الاختبار نفسه هو حارس «لا تنفيذ
 * ثانٍ منافس»: أي مسار موازٍ ينحرف فيفشل التطابق. */

describe("canonical period result (قراءة الفترة الواحدة)", () => {
  it("locks the canonical reader: statement and insights consume the same full object", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const statement = new StatementService(store, finance);
    await finance.record({
      type: "owner_investment_cash",
      amountMinor: 100000,
      occurredOn: "2026-09-01",
      note: "استثمار افتتاحي",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "canonical-inv",
    });
    await finance.record({
      type: "operating_expense_cash",
      amountMinor: 2500,
      occurredOn: "2026-09-02",
      note: "بنزين",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "variable",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
        categoryLabel: "بنزين",
      },
      idempotencyKey: "canonical-expense",
    });
    const from = "2026-09-01";
    const to = "2026-09-30";
    const reader = await finance.readRecordedPeriodResult(from, to);
    const reading = await statement.read(from, to);
    const insights = await finance.readFinancialInsights(from, to);
    if (!reader.ok || !reading.ok || !insights.ok) throw new Error("reads should succeed");
    expect(reading.value.result).toEqual(reader.value);
    expect(insights.value.period).toEqual(reader.value);
    expect(reading.value.resultMinor ?? reading.value.result.resultMinor).toBeDefined();
  });

  it("spies that statement.read and readFinancialInsights invoke the canonical reader", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const spy = vi.spyOn(finance, "readRecordedPeriodResult");
    const statement = new StatementService(store, finance);
    await statement.read("2026-09-01", "2026-09-30");
    expect(spy).toHaveBeenCalled();
    await finance.readFinancialInsights("2026-09-01", "2026-09-30");
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("null is a cross-checked value: unknown cost shows the same unavailable state everywhere", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const statement = new StatementService(store, finance);
    const sales = new DirectSaleService(store, now);
    await sales.record({
      itemName: "بيع بلا تكلفة معروفة",
      quantity: 1,
      revenueMinor: 8000,
      collectedMinor: undefined,
      costMinor: null,
      occurredOn: "2026-09-02",
      note: "بيع نقدي",
      idempotencyKey: "canonical-unknown-cost",
    });
    const from = "2026-09-01";
    const to = "2026-09-30";
    const reader = await finance.readRecordedPeriodResult(from, to);
    const reading = await statement.read(from, to);
    const insights = await finance.readFinancialInsights(from, to);
    if (!reader.ok || !reading.ok || !insights.ok) throw new Error("reads should succeed");
    expect(reader.value.resultMinor).toBeNull();
    expect(reader.value.directSaleCostUnknownCount).toBe(1);
    expect(reader.value.reasons.length).toBeGreaterThan(0);
    expect(reading.value.result.resultMinor).toBeNull();
    expect(insights.value.period.resultMinor).toBeNull();
    expect(reading.value.result).toEqual(reader.value);
    expect(insights.value.period).toEqual(reader.value);
  });

  it("shared estimated expense keeps the same honest result and reasons on every surface", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const statement = new StatementService(store, finance);
    await finance.record({
      type: "operating_expense_cash",
      amountMinor: 4000,
      occurredOn: "2026-09-02",
      note: "كهرباء مشتركة تقديرية",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "shared",
        behavior: "mixed",
        purpose: "project_general",
        knowledge: "estimated",
        sharedProjectShare: { basis: "owner_estimate", note: "تقدير", allocation: "allocated" },
        categoryLabel: "كهرباء",
      },
      idempotencyKey: "canonical-estimated",
    });
    const from = "2026-09-01";
    const to = "2026-09-30";
    const reader = await finance.readRecordedPeriodResult(from, to);
    const reading = await statement.read(from, to);
    if (!reader.ok || !reading.ok) throw new Error("reads should succeed");
    expect(reader.value.sharedEstimatedExpenseCount).toBe(1);
    expect(reading.value.result).toEqual(reader.value);
    /* الإيراد المعترف به الكلي مشتق في الخدمة — لا جمع داخل الصفحة. */
    expect(reading.value.recognizedRevenueTotalMinor).toBe(
      reader.value.recognizedRevenueMinor + reader.value.directSaleRevenueMinor,
    );
  });
});
