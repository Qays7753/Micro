/** @vitest-environment jsdom */
/*
 * R9-W3 (WS-216/ARCH-007): اختبار مباشر لحدود صفحة تراجع أثر الكاش — حالات
 * التحميل والعدم والبوابة والعكس الموثق عبر الخدمة الحقيقية فوق مخزن
 * الذاكرة. لا يُثبَّت عيب العرض المكتشف (ابتلاع فشل التخزين داخل فرع
 * «لم نجد») — مسجل بقرار محمي R9-GA-F3.1 ولا يُنصّ هنا على سلوكه.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { AgreementService } from "@/application/agreements/agreementService";
import { CostService } from "@/application/cost/costService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import CashReversalEditor from "@/pages/CashReversalEditor";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
  getPrototypeLocalStore: () => currentStore,
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/",
  params: {} as Record<string, string>,
  search: "",
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-10-10T09:00:00.000Z";

let store: MemoryLocalStore;
let currentStore: MemoryLocalStore;
const bumpVersion = vi.fn();

function services() {
  return {
    cashContinuity: new CashContinuityService(store, () => NOW),
    agreements: new AgreementService(store, new CostService(store, () => NOW), () => NOW),
    notifyDataChanged: bumpVersion,
    dataVersion: 0,
  };
}

function Harness() {
  return (
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <CashReversalEditor />
    </UnsavedChangesProvider>
  );
}

async function seedAdjustment() {
  const cash = new CashContinuityService(store, () => NOW);
  const opened = await cash.openWallet({
    name: "درج العكس المباشر",
    kind: "cash_drawer",
    openingMinor: 5_000,
    occurredOn: "2026-10-01",
    note: "بداية",
    operationKey: "w3-open",
  });
  if (!opened.ok) throw new Error(opened.message);
  const adjusted = await cash.adjust({
    walletId: opened.value.wallet.id,
    deltaMinor: -1_250,
    occurredOn: "2026-10-02",
    note: "ملاحظة العكس",
    reason: "مصروف نثري",
    operationKey: "w3-adjust",
  });
  if (!adjusted.ok) throw new Error(adjusted.message);
  return adjusted.value.id;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  currentStore = store;
  wouterMocks.search = "";
  wouterMocks.params = {};
  wouterMocks.navigate.mockReset();
  bumpVersion.mockReset();
  mockedUsePrototypeServices.mockReturnValue(
    services() as unknown as ReturnType<typeof usePrototypeServices>,
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CashReversalEditor — direct page-boundary behavior (R9-W3)", () => {
  it("an unknown entry id neither navigates nor writes anything (the not-found surface itself is unreachable today — defect R9-W3-F1, not enshrined here)", async () => {
    wouterMocks.params = { id: "missing-entry" };
    render(<Harness />);
    expect(screen.getByRole("status")).toBeTruthy();
    /* نجازي مهلة قصيرة ثم نثبت الحد الصادق الخالي من الأثر: لا تنقل ولا
     * كتابة. سطح «لم نجد أثر الكاش» غير قابل للوصول عبر مسار النجاح
     * (entry=null وmessage=null يبقيان حالة التحميل) — عيب موثق بقرار
     * محمي، لا يُثبَّت سلوكه هنا. */
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    expect(bumpVersion).not.toHaveBeenCalled();
    const cash = new CashContinuityService(store, () => NOW);
    const entries = await cash.entries();
    if (!entries.ok) throw new Error(entries.message);
    expect(entries.value).toHaveLength(0);
  });

  it("requires a reason before any reversal is written", async () => {
    const entryId = await seedAdjustment();
    wouterMocks.params = { id: entryId };
    render(<Harness />);
    await screen.findByRole("textbox");
    fireEvent.click(screen.getByRole("button", { name: /حفظ التراجع/ }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("اذكر سبب التراجع قبل الحفظ.")).toBeTruthy();
    const cash = new CashContinuityService(store, () => NOW);
    const entries = await cash.entries();
    if (!entries.ok) throw new Error(entries.message);
    expect(entries.value.some(entry => entry.reversesEntryId === entryId)).toBe(false);
  });

  it("archives the reversal through the page with the documented link to the original entry", async () => {
    const entryId = await seedAdjustment();
    wouterMocks.params = { id: entryId };
    render(<Harness />);
    const reason = await screen.findByRole("textbox");
    fireEvent.change(reason, { target: { value: "عكس مباشر موثق" } });
    fireEvent.click(screen.getByRole("button", { name: /حفظ التراجع/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    expect(bumpVersion).toHaveBeenCalled();
    const cash = new CashContinuityService(store, () => NOW);
    const entries = await cash.entries();
    if (!entries.ok) throw new Error(entries.message);
    const reversal = entries.value.find(entry => entry.reversesEntryId === entryId);
    expect(reversal).toBeDefined();
    expect(reversal?.reason).toBe("عكس مباشر موثق");
  });

  it("rejects a second reversal of the same entry honestly through the service boundary", async () => {
    const entryId = await seedAdjustment();
    const cash = new CashContinuityService(store, () => NOW);
    const first = await cash.reverse({
      entryId,
      occurredOn: "2026-10-03",
      reason: "تراجع أول خارج الصفحة",
      operationKey: "w3-reverse-1",
    });
    if (!first.ok) throw new Error(first.message);
    wouterMocks.params = { id: entryId };
    render(<Harness />);
    const reason = await screen.findByRole("textbox");
    fireEvent.change(reason, { target: { value: "محاولة تراجع ثانٍ" } });
    fireEvent.click(screen.getByRole("button", { name: /حفظ التراجع/ }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("تم التراجع عن هذا الأثر سابقًا. لا يمكن التراجع عنه مرة ثانية.")).toBeTruthy();
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    const entries = await cash.entries();
    if (!entries.ok) throw new Error(entries.message);
    expect(entries.value.filter(entry => entry.reversesEntryId === entryId)).toHaveLength(1);
  });
});
