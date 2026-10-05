/** @vitest-environment jsdom */

/*
 * W7 (برنامج الإكمال ما بعد المسح — 2026-10-05): رحلات الصفحات الست التي كانت
 * Smoke-only (F-12). كل صفحة كانت مغطاة بدخان عرض المسار فقط (R2.renderSmoke)
 * أو سيطرة رقابية مجاورة؛ هذه الرحلات تتجاوز الدخان: تجهيز بيانات حقيقية عبر
 * الخدمات فوق مخزن الذاكرة، ثم ممارسة الفعل الأساسي للمستخدم عبر حدود الواجهة
 * الحقيقية (تفاعل ← خدمة ← مخزن) والتحقق من الأثر. نطاق بنيوي بحت: لا مساس
 * بأي كود إنتاج ولا CSS/DOM/tokens/تنقل/نصوص — اختبارات فقط (عقد التنفيذ W7).
 */
import "fake-indexeddb/auto";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { FinancialAnalysisService } from "@/application/financial-analysis/financialAnalysisService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { AgreementService } from "@/application/agreements/agreementService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import CashWalletEditor from "@/pages/CashWalletEditor";
import CashReversalEditor from "@/pages/CashReversalEditor";
import G5DeclarationEditor from "@/pages/G5DeclarationEditor";
import InventoryReversalEditor from "@/pages/InventoryReversalEditor";
import ReceivedLoanDetail from "@/pages/ReceivedLoanDetail";
import SharePreview from "@/pages/SharePreview";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
  getPrototypeLocalStore: () => currentStore,
}));
vi.mock("@/lib/textDelivery", () => ({
  canShareText: () => false,
  copyTextManually: vi.fn(async () => "copied" as const),
  shareTextManually: vi.fn(async () => "copied" as const),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-10-05T09:00:00.000Z";

let store: MemoryLocalStore;
let currentStore: MemoryLocalStore;
const bumpVersion = vi.fn();

function services() {
  return {
    cashContinuity: new CashContinuityService(store, () => NOW),
    projectFinance: new ProjectFinancialService(store, () => NOW),
    g5: new FinancialAnalysisService(store, () => NOW),
    inventory: new InventoryMaterialService(store, () => NOW),
    agreements: new AgreementService(store, () => NOW),
    notifyDataChanged: bumpVersion,
    dataVersion: 0,
  };
}

function Harness({ page }: { page: React.ReactNode }) {
  return <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  currentStore = store;
  wouterMocks.params = {};
  wouterMocks.location = "/";
  wouterMocks.navigate.mockReset();
  bumpVersion.mockReset();
  window.history.replaceState(null, "", "/");
  mockedUsePrototypeServices.mockReturnValue(
    services() as unknown as ReturnType<typeof usePrototypeServices>,
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("W7 journeys — pages that were render-smoke only", () => {
  it("CashWalletEditor: opening a wallet with a declared balance creates it through the service", async () => {
    render(<Harness page={<CashWalletEditor />} />);
    fireEvent.change(screen.getByPlaceholderText("مثال: درج الورشة"), { target: { value: "درج الرحلة" } });
    fireEvent.change(screen.getByLabelText("رصيد البداية"), { target: { value: "75" } });
    fireEvent.change(screen.getByPlaceholderText("مثال: عدّ الدرج في بداية استخدام Micro"), {
      target: { value: "عدّ أولي للرحلة" },
    });
    fireEvent.click(screen.getByRole("button", { name: /حفظ محفظة ورصيد البداية/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    expect(bumpVersion).toHaveBeenCalled();
    const cash = new CashContinuityService(store, () => NOW);
    const overview = await cash.overview();
    expect(overview.ok).toBe(true);
    const wallet = overview.value.wallets.find(candidate => candidate.name === "درج الرحلة");
    expect(wallet).toBeDefined();
  });

  it("CashReversalEditor: reversing a recorded cash entry archives its effect through the page", async () => {
    const cash = new CashContinuityService(store, () => NOW);
    const opened = await cash.openWallet({
      name: "درج العكس",
      kind: "cash_drawer",
      openingMinor: 5000,
      occurredOn: "2026-10-01",
      note: "بداية",
      operationKey: "w7-open",
    });
    expect(opened.ok).toBe(true);
    const adjusted = await cash.adjust({
      walletId: opened.value.wallet.id,
      deltaMinor: -1250,
      occurredOn: "2026-10-02",
      note: "ملاحظة العكس",
      reason: "مصروف نثري",
      operationKey: "w7-adjust",
    });
    expect(adjusted.ok).toBe(true);
    wouterMocks.params = { id: adjusted.value.id };
    render(<Harness page={<CashReversalEditor />} />);
    const reason = await screen.findByRole("textbox");
    fireEvent.change(reason, { target: { value: "عكس رحلة الاختبار" } });
    fireEvent.click(screen.getByRole("button", { name: /حفظ التراجع/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    expect(bumpVersion).toHaveBeenCalled();
    const entries = await cash.entries();
    const reversal = entries.value.find(entry => entry.reversesEntryId === adjusted.value.id);
    expect(reversal).toBeDefined();
  });

  it("G5DeclarationEditor: recording an expected collection creates the declaration", async () => {
    render(<Harness page={<G5DeclarationEditor />} />);
    fireEvent.change(screen.getByLabelText("مبلغ السجل المتوقع"), { target: { value: "40" } });
    fireEvent.change(screen.getByPlaceholderText("مثال: رسالة العميلة أو فاتورة المورد"), {
      target: { value: "وعدت العميلة بالتحصيل" },
    });
    fireEvent.change(screen.getByPlaceholderText("ما الذي يجعلك تتوقع هذا القبض أو الدفع؟"), {
      target: { value: "ملاحظة رحلة الاختبار" },
    });
    fireEvent.click(screen.getByRole("button", { name: /حفظ المتوقع/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    expect(bumpVersion).toHaveBeenCalled();
    const g5 = new FinancialAnalysisService(store, () => NOW);
    const declarations = await g5.listDeclarations();
    expect(declarations.ok).toBe(true);
    const found = declarations.value.find(
      declaration => declaration.kind === "declaration" && declaration.source === "وعدت العميلة بالتحصيل",
    );
    expect(found).toBeDefined();
    expect(found!.amountMinor).toBe(4000);
  });

  it("InventoryReversalEditor: reversing a material opening movement archives it", async () => {
    const inventory = new InventoryMaterialService(store, () => NOW);
    const opened = await inventory.openMaterial({
      name: "قماش الرحلة",
      unit: "meter",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 3000,
        costState: "known",
        valueMinor: 9000,
        confirmedOn: "2026-10-01",
        sourceNote: "جرد أولي",
      },
      note: "افتتاح مادة الرحلة",
      operationKey: "w7-material",
    });
    expect(opened.ok).toBe(true);
    const movement = opened.value.opening;
    expect(movement).not.toBeNull();
    wouterMocks.params = { id: movement!.id };
    render(<Harness page={<InventoryReversalEditor />} />);
    const reason = await screen.findByRole("textbox");
    fireEvent.change(reason, { target: { value: "عكس جرد الرحلة" } });
    fireEvent.click(screen.getByRole("button", { name: /حفظ التراجع/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    expect(bumpVersion).toHaveBeenCalled();
    const movements = await inventory.movements();
    const reversal = movements.value.find(
      candidate => candidate.type === "reversal" && candidate.reversesMovementId === movement!.id,
    );
    expect(reversal).toBeDefined();
  });

  it("ReceivedLoanDetail: shows the live derived reading of a created received loan", async () => {
    const { ReceivedLoanService } = await import("@/application/loans/receivedLoanService");
    const loans = new ReceivedLoanService(store, () => NOW);
    const created = await loans.create({
      lenderName: "سارة",
      lenderType: "person",
      principalMinor: 8000,
      receivedOn: "2026-09-01",
      dueOn: null,
      note: null,
    });
    expect(created.ok).toBe(true);
    window.history.replaceState(null, "", `/loans/received/${created.value.loan.id}`);
    try {
      render(<ReceivedLoanDetail />);
      expect(await screen.findByRole("heading", { name: "سارة" })).toBeTruthy();
      expect(screen.getByText("قرض مستلم قائم")).toBeTruthy();
      expect(screen.getByText(/قرض مستلم قائم/)).toBeTruthy();
      expect(document.body.textContent ?? "").toMatch(/80(\.00)?/);
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("SharePreview: shows the draft body and reports the copy outcome; empty state without a draft", async () => {
    window.history.replaceState({ draft: { body: "نص مشاركة الرحلة" } }, "", "/share/preview");
    try {
      const { rerender } = render(<SharePreview />);
      const body = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(body.value).toContain("نص مشاركة الرحلة");
      const copyButton = screen.getByRole("button", { name: /انسخ/ });
      fireEvent.click(copyButton);
      expect(await screen.findByText("نُسخ النص للحافظة — الصقه حيث شئت.")).toBeTruthy();
      window.history.replaceState(null, "", "/share/preview");
      rerender(<SharePreview />);
      expect(screen.getByText("لا نص للمشاركة")).toBeTruthy();
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });
});
