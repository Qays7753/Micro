/** @vitest-environment jsdom */
/* Stage 2 — OPS-002: تنبيه انخفاض المخزون على سطح المواد — التنبيه يظهر فقط
 * تحت الحد المعلن بكمية معروفة؛ المساواة والمجهول وغياب السياسة صمت صادق؛
 * إدخال الحد داخل <details> منهار يحفظ عبر بوابة التفضيلات ثم يعاد اشتقاق
 * القراءة؛ تعطيل قدرة المخزون يخفي المحرر ويُبقي التنبيه (G-004). */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { PreferenceService } from "@/application/preferences/preferenceService";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { localPreferencesId, type LocalPreferences } from "@/storage/local/types";
import InventoryMaterials from "@/pages/InventoryMaterials";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterState = vi.hoisted(() => ({ navigate: vi.fn(), path: "/inventory" }));
vi.mock("wouter", () => ({
  useLocation: () => [wouterState.path, wouterState.navigate],
  useParams: () => ({}),
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-16T09:00:00.000Z";

async function seedStore(options: { thresholdMilli?: number; disabledInventory?: boolean }) {
  const store = new MemoryLocalStore();
  const inventory = new InventoryMaterialService(store, () => NOW);
  const wood = await inventory.openMaterial({
    name: "خشب",
    unit: "piece",
    tracking: "tracked",
    opening: {
      quantityState: "confirmed",
      quantityMilli: 5000,
      costState: "known",
      valueMinor: 2000,
      confirmedOn: "2026-08-01",
      sourceNote: null,
    },
    note: "افتتاح",
    operationKey: "ops2-dom-wood",
  });
  if (!wood.ok) throw new Error("wood should open");
  const cloth = await inventory.openMaterial({
    name: "قماش",
    unit: "meter",
    tracking: "tracked",
    opening: {
      quantityState: "unconfirmed",
      quantityMilli: null,
      costState: "unknown",
      valueMinor: null,
      confirmedOn: "2026-08-01",
      sourceNote: null,
    },
    note: "افتتاح غير محدد",
    operationKey: "ops2-dom-cloth",
  });
  if (!cloth.ok) throw new Error("cloth should open");
  const preferences: LocalPreferences = {
    id: localPreferencesId,
    theme: "system",
    dailyScheduleCapacityMinutes: null,
    workMode: null,
    actualTimeTrackingEnabled: false,
    installBannerDismissedAt: null,
    lastVerifiedExportAt: null,
    backupReminderEnabled: true,
    disabledCapabilities: options.disabledInventory ? ["inventory"] : [],
    lowStockThresholdsMilli:
      options.thresholdMilli !== undefined ? { [wood.value.material.id]: options.thresholdMilli } : null,
    updatedAt: NOW,
  };
  await store.savePreferences(preferences);
  return { store, inventory, woodId: wood.value.material.id };
}

function renderPage(store: MemoryLocalStore, inventory: InventoryMaterialService) {
  const preferenceService = new PreferenceService(store, () => NOW);
  const contextRef: { current: Record<string, unknown> } = { current: {} };
  mockedUsePrototypeServices.mockImplementation(
    () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
  );
  function Harness() {
    const [version, setVersion] = React.useState(0);
    contextRef.current = {
      inventory,
      preferences: preferenceService,
      dataVersion: version,
      notifyDataChanged: () => setVersion(current => current + 1),
    };
    return (
      <UnsavedChangesProvider navigate={wouterState.navigate}>
        <InventoryMaterials />
      </UnsavedChangesProvider>
    );
  }
  render(<Harness />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.body.replaceChildren();
});

describe("Stage 2 — OPS-002: سطح المواد يعرض تنبيه انخفاض المخزون بصدق", () => {
  it("بلا حد معلن: لا تنبيه لأي مادة، ومحرر الحدود داخل تفاصيل منهارة", async () => {
    const { store, inventory } = await seedStore({});
    renderPage(store, inventory);
    expect((await screen.findAllByText("خشب")).length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector('[data-testid="low-stock-alert-خشب"]')).toBeNull();
    expect(document.querySelector('[data-testid="low-stock-alert-قماش"]')).toBeNull();
    /* محرر الحدود موجود ومنهار (summary فقط في السكون). */
    expect(document.querySelector('[data-testid="low-stock-settings"] summary')?.textContent).toContain(
      "حدود تنبيه المخزون",
    );
  });

  it("تحت الحد بكمية معروفة: التنبيه يظهر بقيمته المفهومة؛ الكمية غير المؤكدة صمت صادق", async () => {
    const { store, inventory } = await seedStore({ thresholdMilli: 8000 });
    renderPage(store, inventory);
    const alert = await screen.findByTestId("low-stock-alert-خشب");
    expect(alert.textContent).toContain("المخزون تحت الحد الذي حددته");
    expect(alert.textContent).toContain("8");
    /* قماش غير محدد البداية — كمية مجهولة: لا تنبيه مهما وُضع حد. */
    expect(document.querySelector('[data-testid="low-stock-alert-قماش"]')).toBeNull();
  });

  it("المساواة ليست تنبيهًا — لا شريحة عند الحد تمامًا", async () => {
    const { store, inventory } = await seedStore({ thresholdMilli: 5000 });
    renderPage(store, inventory);
    expect((await screen.findAllByText("خشب")).length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector('[data-testid="low-stock-alert-خشب"]')).toBeNull();
  });

  it("إدخال حد وحفظه داخل التفاصيل يفعّل التنبيه بعد إعادة الاشتقاق — بلا إعادة تحميل", async () => {
    const { store, inventory } = await seedStore({});
    renderPage(store, inventory);
    expect((await screen.findAllByText("خشب")).length).toBeGreaterThanOrEqual(1);
    const settings = document.querySelector('[data-testid="low-stock-settings"]');
    expect(settings).toBeTruthy();
    fireEvent.click(settings?.querySelector("summary") as HTMLElement);
    const input = await screen.findByTestId("low-stock-input-خشب");
    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.click((await screen.findAllByText("احفظ الحد"))[0]!);
    const alert = await screen.findByTestId("low-stock-alert-خشب");
    expect(alert.textContent).toContain("المخزون تحت الحد الذي حددته");
    /* الحفظ تفضيل حقيقي في المتجر — يبقى بعد أي إعادة قراءة. */
    const preferences = await store.getPreferences();
    expect(
      preferences.ok && preferences.value ? preferences.value.lowStockThresholdsMilli : null,
    ).toBeTruthy();
  });

  it("تعطيل قدرة المخزون يخفي محرر الحدود ويُبقي قراءة التنبيه (G-004)", async () => {
    const { store, inventory } = await seedStore({ thresholdMilli: 8000, disabledInventory: true });
    renderPage(store, inventory);
    const alert = await screen.findByTestId("low-stock-alert-خشب");
    expect(alert.textContent).toContain("المخزون تحت الحد الذي حددته");
    await waitFor(() => {
      expect(document.querySelector('[data-testid="low-stock-settings"]')).toBeNull();
    });
  });
});
