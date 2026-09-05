/** المجموعة ٥ (عقد ٣٢ — اختبار تقرير الفترة المحلي): بنية Markdown عربية من
 * قراءة كاملة، والمجهول «غير متاح» لا صفر، والحقائق والأمانات حاضرة،
 * والنسخة اللحظية معلنة. */
import { describe, expect, it } from "vitest";
import { StatementMarkdownService } from "./statementMarkdownService";
import type { StatementReading } from "./statementService";
import type { RecordedPeriodResult, ProjectFinancialPosition } from "./projectFinancialService";

const baseResult: RecordedPeriodResult = {
  from: "2026-09-01",
  to: "2026-09-05",
  inventoryManagedFrom: null,
  recognizedRevenueMinor: 15000,
  recognizedDirectCostMinor: 4000,
  snapshotDirectCostMinor: 3000,
  recordedCogsMinor: 1000,
  effectiveDirectCostMinor: 5000,
  cogsStatus: "recorded",
  cogsMissingOrderCount: 0,
  unallocatedInventoryCostMinor: 0,
  generalInventoryWasteMinor: 0,
  cogsReasons: [],
  recordedOperatingExpenseMinor: 2000,
  projectOperatingExpenseMinor: 2000,
  sharedProjectExpenseMinor: 0,
  sharedUnallocatedExpenseMinor: 0,
  legacyUnclassifiedExpenseMinor: 0,
  sharedEstimatedExpenseCount: 0,
  sharedMissingBasisCount: 0,
  sharedUnallocatedExpenseCount: 0,
  legacyUnclassifiedExpenseCount: 0,
  directSaleCount: 0,
  directSaleCancelledCount: 0,
  directSaleRevenueMinor: 0,
  directSaleCostKnownMinor: 0,
  directSaleCostUnknownCount: 0,
  assetDepreciationMinor: 2500,
  assetWriteOffLossMinor: 0,
  assetDisposalResultMinor: 500,
  retainedDepositRevenueMinor: 3000,
  resultMinor: 9000,
  finalOrderCount: 1,
  excludedOrderCount: 0,
  expenseNeedsReviewCount: 0,
  status: "recorded_only",
  reasons: [],
};

const basePosition: ProjectFinancialPosition = {
  recordedCashMinor: 20000,
  customerReceivablesMinor: 10000,
  supplierPayablesMinor: 4000,
  ownerCapitalRecordedMinor: 5000,
  operatingExpensesRecordedMinor: 2000,
  orderCollectionsMinor: 8000,
  projectEventCount: 4,
  supplierPurchaseCount: 1,
  supplierMaterialPayablesMinor: 4000,
  walletCashMinor: 12000,
  unallocatedCashMinor: 8000,
  cashWalletCount: 1,
  amanahHeldMinor: 500,
  allocatedToWalletsMinor: 4000,
  assetBookValueMinor: 12500,
  loansOutstandingMinor: 6000,
  pendingRetainedDepositsMinor: 3000,
};

function reading(overrides: Partial<StatementReading> = {}): StatementReading {
  return {
    from: "2026-09-01",
    to: "2026-09-05",
    blocks: {
      cashIn: [
        {
          id: "in-1",
          label: "استثمار المالك",
          amountMinor: 5000,
          qualifier: "ليس إيرادًا",
          sources: [],
        },
      ],
      cashOut: [
        {
          id: "out-1",
          label: "مصروف مدفوع — بنزين",
          amountMinor: 1500,
          qualifier: null,
          sources: [],
        },
      ],
      corrections: {
        lines: [
          {
            id: "corr-1",
            occurredOn: "2026-09-02",
            familyLabel: "مصروف مدفوع",
            reason: "خطأ إدخال",
            netEffectMinor: -800,
            sourceHref: "/finance?event=x",
            sourceLabel: "مصروف",
          },
        ],
        netMinor: -800,
      },
      owner: { investedMinor: 5000, withdrawnMinor: 0, sources: [] },
      amanah: { heldInPeriodMinor: 500, releasedInPeriodMinor: 0, heldNowMinor: 500, trustLine: "أمانات بأمانتك" },
      receivablesPayables: {
        receivablesNowMinor: 10000,
        payablesNowMinor: 4000,
        collectionsInPeriodMinor: 2000,
        payableEventsInPeriodMinor: 0,
        supplierPurchasesInPeriodMinor: 4000,
        supplierPaymentsInPeriodMinor: 0,
      },
      deepFinance: {
        depreciationMinor: 2500,
        writeOffLossMinor: 0,
        disposalResultMinor: 500,
        retainedDepositRevenueMinor: 3000,
        assetBookValueNowMinor: 12500,
        loansOutstandingNowMinor: 6000,
        pendingRetainedDepositsNowMinor: 3000,
        unresolved: [
          { id: "pending-deposits", label: "عربونات محتفظة بانتظار قرارك", amountMinor: 3000, count: null },
        ],
      },
    },
    result: baseResult,
    position: basePosition,
    cashNetMinor: 3700,
    recognizedRevenueTotalMinor: 15000,
    expenseCategories: [],
    truthLines: ["الكاش ليس النتيجة"],
    ...overrides,
  };
}

describe("statement markdown service (المجموعة ٥ — عقد ٣٢)", () => {
  it("renders the full Arabic structure from the canonical reading alone", () => {
    const service = new StatementMarkdownService();
    const rendered = service.render(reading());
    if (!rendered.ok) throw new Error(rendered.message);
    const { markdown, filename } = rendered.value;
    expect(markdown).toContain("# كشف فترة — Micro");
    expect(markdown).toContain("من 01/09/2026 إلى 05/09/2026");
    expect(markdown).toContain("ليست حدثًا ماليًا");
    expect(markdown).toContain("## صافي حركة الكاش");
    expect(markdown).toContain("37.00 د.أ");
    expect(markdown).toContain("## ما دخل من كاش");
    expect(markdown).toContain("## التصحيحات الموثقة في الفترة");
    expect(markdown).toContain("السبب: خطأ إدخال");
    expect(markdown).toContain("## نتيجة الفترة");
    expect(markdown).toContain("90.00 د.أ");
    expect(markdown).toContain("إهلاك الأصول");
    expect(markdown).toContain("25.00 د.أ");
    expect(markdown).toContain("## طبقات مستقلة — الآن");
    expect(markdown).toContain("أمانات");
    expect(markdown).toContain("القروض القائمة");
    expect(markdown).toContain("60.00 د.أ");
    expect(markdown).toContain("## قيم غير محلولة");
    expect(markdown).toContain("30.00 د.أ");
    expect(markdown).toContain("## الحقائق");
    expect(markdown).toContain("الكاش ليس النتيجة");
    expect(filename).toBe("micro-statement-2026-09-01-2026-09-05.md");
  });

  it("unavailable result is written «غير متاحة» — never a fake number", () => {
    const service = new StatementMarkdownService();
    const withUnknown = reading({
      result: { ...baseResult, resultMinor: null, directSaleCostUnknownCount: 2 },
      blocks: {
        ...reading().blocks,
        deepFinance: {
          ...reading().blocks.deepFinance,
          unresolved: [
            {
              id: "direct-sale-cost-unknown",
              label: "بيوع مباشرة بتكلفة غير معروفة — النتيجة غير متاحة حتى تُدخل",
              amountMinor: null,
              count: 2,
            },
          ],
        },
      },
    });
    const rendered = service.render(withUnknown);
    if (!rendered.ok) throw new Error(rendered.message);
    expect(rendered.value.markdown).toContain("غير متاحة");
    expect(rendered.value.markdown).toContain("بيوع مباشرة بتكلفة غير معروفة");
  });

  it("refuses a broken reading honestly", () => {
    const service = new StatementMarkdownService();
    const broken = service.render(null as unknown as StatementReading);
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.code).toBe("validation_error");
  });
});
