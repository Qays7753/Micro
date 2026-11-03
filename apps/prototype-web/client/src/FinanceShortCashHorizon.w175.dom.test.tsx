/** @vitest-environment jsdom */
/* UNIT-021 (تنفيذ S15 بالأمر الموحد §5): التوقعات النقدية المتقدمة مؤجلة —
 * بطاقة أفق الكاش القصير (FIN-005/WS-175 سابقًا) غادرت النطاق الأساسي مع
 * قراءتها، ولا يُبنى بديل يوحي بوجودها. هذا الحراس يثبت الغياب الصادق:
 * - لا مجموعة «أفق قراءة الكاش» ولا مفاتيح ٧/٣٠/٩٠ ولا نقد متوقع ولا
 *   «دفع متوقع قريب» ولا توصية سحب آمن داخل سطح المالية.
 * - الحقيقة التاريخية تبقى بمعناها: الالتزام المؤرخ المقروء من مركزه
 *   (readPosition) لا يفقد قيمته بغياب بطاقة التوقع.
 * - الزيارة قراءة صرفة: notifyDataChanged لا يُستدعى من العرض أبدًا.
 * الأفق المؤجل بلا بديل: أي إعادة إدراج مستقبلية لهذه الأسطح تفشل هنا
 * بالاسم حتى يفوضها المالك صراحة. */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CorrectionHistoryService } from "@/application/financial-records/correctionHistoryService";
import { OwnerEntitlementService } from "@/application/owner-money/ownerEntitlementService";
import { G5Service } from "@/application/financial-analysis/financialAnalysisService";
import { FinancialPulseService } from "@/application/financial-pulse/financialPulseService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { ProfitToCashBridgeService } from "@/application/finance/profitToCashBridgeService";
import { createSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import Finance from "@/pages/Finance";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/finance",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-23T09:00:00.000Z";

describe("UNIT-021 (تنفيذ S15) — أفق الكاش القصير مؤجل بلا بديل", () => {
  let store: MemoryLocalStore;
  let projectFinance: ProjectFinancialService;
  let notifyDataChanged: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    store = new MemoryLocalStore();
    const now = () => NOW;
    projectFinance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, projectFinance, now);

    /* التزام مؤرخ واحد (2026-10-01) — كان وقود بطاقة التوقع السابقة؛
     * بقاء معناه يُثبت الآن من مركزه لا من توقع. */
    await store.saveSupplierPurchase(
      createSupplierPurchase({
        id: "w175-commitment",
        supplierName: "مورد",
        note: "التزام مؤرخ",
        purchasedOn: "2026-09-01",
        dueOn: "2026-10-01",
        totalMinor: 2500,
        initialPaidMinor: 0,
        recordedAt: NOW,
        idempotencyKey: "w175-commitment",
      }),
    );
    notifyDataChanged = vi.fn();

    mockedUsePrototypeServices.mockReturnValue({
      projectFinance,
      correctionHistory: new CorrectionHistoryService(store),
      ownerEntitlement: new OwnerEntitlementService(
        store,
        (from: string, to: string) => projectFinance.readRecordedPeriodResult(from, to),
        now,
      ),
      g5,
      financialPulse: new FinancialPulseService(store),
      inventory: new InventoryMaterialService(store, now),
      profitToCashBridge: new ProfitToCashBridgeService(store, now),
      dataVersion: 0,
      notifyDataChanged,
    } as unknown as ReturnType<typeof usePrototypeServices>);
  });

  afterEach(() => {
    cleanup();
  });

  it("لا أفق قراءة ولا مفاتيح أيام ولا نقد متوقع ولا سحب آمن داخل المالية", async () => {
    render(<Finance />);
    expect(await screen.findByRole("heading", { name: "المالية" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("جارٍ قراءة الوضع المالي المحلي…")).not.toBeTruthy());

    /* غياب عائلة الأفق كاملة — لا مجموعة ولا مفاتيح ولا نافذة مؤرخة. */
    expect(screen.queryByRole("group", { name: "أفق قراءة الكاش" })).toBeNull();
    for (const label of ["٧ أيام", "٣٠ يومًا", "٩٠ يومًا"]) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
    for (const absent of ["دفع متوقع قريب", "النقد المتوقع", "سحب آمن", "احتياطي الجلسة"]) {
      expect(screen.queryByText(absent), `سطح توقع محجوب ظهر: ${absent}`).toBeNull();
    }
  });

  it("الحقيقة التاريخية تبقى بمعناها من مركزها — والزيارة قراءة صرفة", async () => {
    render(<Finance />);
    expect(await screen.findByRole("heading", { name: "المالية" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("جارٍ قراءة الوضع المالي المحلي…")).not.toBeTruthy());

    /* الالتزام المؤرخ مقروء بقيمته من قراءة المركز — التاريخ لم يُمس. */
    const position = await projectFinance.readPosition();
    expect(position.ok && position.value.supplierMaterialPayablesMinor).toBe(2500);

    /* بطاقات «الآن» الحية باقية بمصادرها — غياب التوقع ليس صفحة فارغة. */
    expect(
      screen.getByRole("region", { name: "تفاصيل الوضع المالي المسجل · المبالغ بالدينار الأردني" }),
    ).toBeTruthy();

    /* الزيارة كلها لم تكتب شيئًا (قراءة صرفة فوق المخزن). */
    expect(notifyDataChanged).not.toHaveBeenCalled();
  });
});
