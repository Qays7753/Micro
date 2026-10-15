/** @vitest-environment jsdom */
/**
 * R11 W4 / D-14 (موجة المتابعة 2026-10-15 — OD-A11Y الخيار B): عقد تركيز
 * المودالين الحقيقيين الناقصين — بوابة رمز تدمير البيانات (DataActionPinGate)
 * وغطاء الحجب التدميري في الإعدادات (protectionBlocked) — على النمط الذهبي
 * نفسه المعتبر في AppLockGate/UnsavedChangesGuard: ستار + focus-in + احتواء
 * Tab (يلتف الأول/الأخير — ترتيب DOM فيبقى ترتيب Tab في RTL) + Escape بمسار
 * الإغلاق الآمن + استعادة التركيز لمُشغّل الفتح. دلالات وتركيز فقط — لا
 * تغيير بصري ولا منطق حماية.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { LocalLockService } from "@/application/security";
import { FormDraftService } from "@/application/drafts/formDraftService";
import { AgreementService } from "@/application/agreements/agreementService";
import { CostService } from "@/application/cost/costService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { CatalogService } from "@/application/catalog/catalogService";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { ProjectFinancialService } from "@/application/finance";
import { StatementService } from "@/application/finance";
import { CashContinuityService } from "@/application/cash";
import { PreferenceService } from "@/application/preferences/preferenceService";
import Settings from "@/pages/Settings";
import { ThemeProvider } from "@/contexts/ThemeContext";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => ["/settings", vi.fn()],
  useParams: () => ({}),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-10-15T00:00:00.000Z";

const importSummary = {
  profile: { id: "p", activityName: "مشغل" },
  preferences: null,
  drafts: 0,
  orders: 0,
  directSales: 0,
  schedules: 0,
  supplierPurchases: 0,
  cashWallets: 1,
  cashContinuityEntries: 0,
  materials: 0,
  inventoryMovements: 0,
  snapshots: 0,
  events: 0,
  actualTimeRecords: 0,
  costEstimates: 0,
  financialEvents: 0,
  exportedAt: NOW,
};

const pickFile = (input: HTMLInputElement, content: string, name: string) => {
  const file = new File([content], name, { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => content, configurable: true });
  fireEvent.change(input, { target: { files: [file] } });
};

const importFileInput = () =>
  Array.from(document.querySelectorAll('input[type="file"]'))[0] as HTMLInputElement;

describe("R11 W4 / D-14 — true-modal focus contracts (OD-A11Y semantics-only)", () => {
  let store: InstanceType<typeof import("@/storage/local/MemoryLocalStore").MemoryLocalStore>;
  let localLock: LocalLockService;
  let confirmImport: ReturnType<typeof vi.fn>;
  let resetAll: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    vi.stubGlobal(
      "URL",
      class MockBlobURL extends URL {
        static createObjectURL = vi.fn(() => "blob:mock");
        static revokeObjectURL = vi.fn();
      },
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    (globalThis.Element.prototype as { scrollIntoView?: () => void }).scrollIntoView ??= () => undefined;
    const { MemoryLocalStore } = await import("@/storage/local/MemoryLocalStore");
    store = new MemoryLocalStore();
    localLock = new LocalLockService(store, () => NOW);
    confirmImport = vi.fn(async () => ({ ok: true, value: { applied: true } }));
    resetAll = vi.fn(async () => ({ ok: true, value: null }));
    mockedUsePrototypeServices.mockReturnValue({
      localLock,
      formDrafts: new FormDraftService(store),
      integrityCheck: new IntegrityCheckService(
        store,
        new ProjectFinancialService(store),
        new StatementService(store, new ProjectFinancialService(store)),
        new CashContinuityService(store),
      ),
      preferences: new PreferenceService(store),
      agreements: new AgreementService(store, new CostService(store)),
      inventory: new InventoryMaterialService(store),
      supplierPurchases: new SupplierPurchaseService(store),
      catalog: new CatalogService(store),
      actualTime: {
        readOperatingMode: vi.fn(async () => ({
          ok: true,
          value: { workMode: null, actualTimeTrackingEnabled: false },
        })),
        saveOperatingMode: vi.fn(),
      },
      transfers: {
        createExport: vi.fn(async () => ({ ok: false })),
        prepareImport: vi.fn(() => ({ ok: true, value: { summary: importSummary } })),
        confirmImport,
        createVerifiedExport: vi.fn(async () => ({ ok: true, value: { file: {}, summary: importSummary } })),
        resetAll,
      },
      guidedOpeningImport: { prepare: vi.fn(), confirm: vi.fn() },
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  const mount = async (withLock = true) => {
    if (withLock) await localLock.enable("4179", 10);
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "احمِ بياناتك" })).toBeTruthy());
  };

  it("PIN gate: veil + focus moves into the PIN input when the gate opens (focus-in)", async () => {
    await mount();
    const trigger = screen.getByRole("button", { name: "تصدير البيانات المحلية" });
    trigger.focus();
    fireEvent.click(trigger);
    const overlay = await waitFor(() => screen.getByRole("alertdialog", { name: "تأكيد رمز القفل" }));
    expect(document.querySelector(".micro-lock-veil")).not.toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(overlay.querySelector<HTMLInputElement>("input[type='password']")),
    );
  });

  it("PIN gate: Tab wraps inside the overlay (containment — DOM order keeps RTL tab order)", async () => {
    await mount();
    const trigger = screen.getByRole("button", { name: "تصدير البيانات المحلية" });
    trigger.focus();
    fireEvent.click(trigger);
    const overlay = await waitFor(() => screen.getByRole("alertdialog", { name: "تأكيد رمز القفل" }));
    const pinInput = overlay.querySelector<HTMLInputElement>("input[type='password']") as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(pinInput));
    /* زر الإكمال معطّل والرمز أقل من ٤ أرقام — المعطّل خارج سلسلة التركيز
     * (عقد التحديد)، فالترتيب الفعلي: مدخل الرمز ← إلغاء ← يلتف إلى المدخل. */
    fireEvent.keyDown(document, { key: "Tab" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "إلغاء" })));
    fireEvent.keyDown(document, { key: "Tab" });
    await waitFor(() => expect(document.activeElement).toBe(pinInput));
    /* الرجوع من الأول يلتف إلى الأخير */
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "إلغاء" })));
    /* بعد كتابة رمز كامل يصبح زر الإكمال داخل السلسلة: تقدم من المدخل يصل إليه */
    await userEvent.type(pinInput, "4179");
    fireEvent.keyDown(document, { key: "Tab" });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: /أكمل الإجراء/ })),
    );
  });

  it("PIN gate: Escape cancels safely and restores focus to the trigger that opened it", async () => {
    await mount();
    const trigger = screen.getByRole("button", { name: "تصدير البيانات المحلية" });
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("alertdialog", { name: "تأكيد رمز القفل" })).toBeTruthy());
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("PIN gate: focus outside the overlay is pulled back inside on Tab (no focus travel under the veil)", async () => {
    await mount();
    const trigger = screen.getByRole("button", { name: "تصدير البيانات المحلية" });
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("alertdialog", { name: "تأكيد رمز القفل" })).toBeTruthy());
    /* تركيز خارجي مصطنع (محرّك برمجيًا خارج الحاوية) ثم Tab — يُسحب إلى الداخل */
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(document, { key: "Tab" });
    const overlay2 = screen.getByRole("alertdialog", { name: "تأكيد رمز القفل" });
    const pinInput = overlay2.querySelector<HTMLInputElement>("input[type='password']") as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(pinInput));
  });

  it("protectionBlocked overlay: veil + focus moves to the acknowledge button (focus-in)", async () => {
    await mount(false);
    pickFile(importFileInput(), JSON.stringify({ format: "micro-prototype-local-export" }), "backup.json");
    const replace = await waitFor(() => screen.getByRole("button", { name: "استبدال البيانات المحلية" }));
    replace.focus();
    fireEvent.click(replace);
    const overlay = await waitFor(() =>
      screen.getByRole("alertdialog", { name: "استبدال بياناتك يحتاج رمز القفل" }),
    );
    expect(document.querySelector(".micro-lock-veil")).not.toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "حسنًا" })));
    expect(confirmImport).not.toHaveBeenCalled();
    expect(overlay.textContent).toContain("قفل التطبيق");
  });

  it("protectionBlocked overlay: Escape acknowledges safely and restores focus to the replace trigger", async () => {
    await mount(false);
    pickFile(importFileInput(), JSON.stringify({ format: "micro-prototype-local-export" }), "backup.json");
    const replace = await waitFor(() => screen.getByRole("button", { name: "استبدال البيانات المحلية" }));
    replace.focus();
    fireEvent.click(replace);
    await waitFor(() =>
      expect(screen.getByRole("alertdialog", { name: "استبدال بياناتك يحتاج رمز القفل" })).toBeTruthy(),
    );
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog", { name: "استبدال بياناتك يحتاج رمز القفل" })).toBeNull(),
    );
    await waitFor(() => expect(document.activeElement).toBe(replace));
    expect(confirmImport).not.toHaveBeenCalled();
  });

  it("PIN gate: typing and correct PIN still work exactly as before (no protection-logic change)", async () => {
    await mount();
    const trigger = screen.getByRole("button", { name: "تصدير البيانات المحلية" });
    fireEvent.click(trigger);
    const pinInput = (
      await waitFor(() => screen.getByRole("alertdialog", { name: "تأكيد رمز القفل" }))
    ).querySelector<HTMLInputElement>("input[type='password']") as HTMLInputElement;
    await userEvent.type(pinInput, "4179");
    fireEvent.submit(pinInput.closest("form")!);
    /* البوابة تُغلق بعد الرمز الصحيح ويُنفَّذ التصدير (المسار القائم) */
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
});
