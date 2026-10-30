/** @vitest-environment jsdom */
/* S09 (UNIT-008/SH-13 / DOC-018 — أمر ad133bae القسم ٢): رحلات DOM لمحرر
 * التكلفة المجمّعة — سيناريو قبول المرحلة: صندوق بشوكولاتتين بثمن للحبة
 * يتكرر 10 ومجموعة ثانية مختلفة، والتوصيل 3 د.أ مرة واحدة على نطاق الطلب،
 * والضرب مرة واحدة قبل تقريب النواة الواحدة (لا 10.02 من إجمالي 10)،
 * والمجهول لا يصير صفرًا (حفظ ناقص صادق)، ومراجعة تغيّر الكمية صريحة،
 * واستعادة مدخلات التكلفة بعد إعادة الفتح بلا فقد صامت. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { FormDraftService } from "@/application/drafts/formDraftService";
import { DraftService } from "@/application/drafts/draftService";
import { CostService } from "@/application/cost/costService";
import { createFormDraftHarness } from "@/application/drafts/formDraftTestHarness";
import type { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import CostEditor from "./CostEditor";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn() }));
const routeState = vi.hoisted(() => ({ id: "draft-1" }));

vi.mock("wouter", () => ({
  useLocation: () => [`/orders/draft/${routeState.id}/cost`, wouterMocks.navigate],
  useParams: () => ({ id: routeState.id }),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-10-30T18:00:00.000Z";

function renderEditor(store: MemoryLocalStore) {
  mockedUsePrototypeServices.mockReturnValue({
    formDrafts: new FormDraftService(store, () => NOW),
    drafts: new DraftService(store, () => NOW),
    costs: new CostService(store, () => NOW),
    costEstimates: { get: vi.fn().mockResolvedValue({ ok: true, value: null }) },
    inventory: {
      overview: vi.fn().mockResolvedValue({ ok: true, value: { materials: [] } }),
      movements: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    },
    dataVersion: 0,
    notifyDataChanged: vi.fn(),
  } as unknown as ReturnType<typeof usePrototypeServices>);
  render(
    <UnsavedChangesProvider navigate={() => undefined}>
      <CostEditor />
    </UnsavedChangesProvider>,
  );
}

/* بذرة مسودة مجمّعة: شوكولاتتان بثمن للحبة (35+25 قرشًا للوحدة) تتكرر 10،
 * ومجموعة تغليف مخملي تتكرر 2 بوحدة 1.50 د.أ — التوسيع مرة واحدة. */
async function seedGroupedDraft(store: MemoryLocalStore) {
  const drafts = new DraftService(store, () => NOW);
  const created = await drafts.create("customer_order", {
    itemName: "صندوق شوكولاتة مخصص",
    groups: [
      {
        id: "group-choco",
        label: "شوكولاتة فاخرة",
        repeatQuantity: 10,
        offeringType: "product",
        offeringRef: null,
        note: null,
      },
      {
        id: "group-wrap",
        label: "تغليف مخملي",
        repeatQuantity: 2,
        offeringType: "product",
        offeringRef: null,
        note: null,
      },
    ],
  });
  if (!created.ok) throw new Error("seed draft failed");
  return created.draft;
}

async function addUnitMaterial(groupLabel: string, name: string, unitPriceDinars: string) {
  const section = screen
    .getAllByRole("region")
    .find(region => region.getAttribute("aria-label")?.includes(groupLabel));
  if (!section) throw new Error(`group section ${groupLabel} not found`);
  /* vaul (Drawer) يتعطل بأحداث المؤشر في jsdom (setPointerCapture/translate
   * غير متاحين) — fireEvent بلا أحداث مؤشر يتجنب العطل البيئي للمكتبة دون
   * تغيير سلوك المكون أو ما يثبته الاختبار. */
  fireEvent.click(
    within(section).getByRole("button", { name: new RegExp(`إضافة مادة إلى وحدة ${groupLabel}`) }),
  );
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText(/^المادة$/), { target: { value: name } });
  fireEvent.change(within(dialog).getByLabelText(/تكلفة الوحدة/i), { target: { value: unitPriceDinars } });
  fireEvent.click(within(dialog).getByRole("button", { name: /حفظ بند المادة/i }));
  await waitFor(() => {
    expect(screen.getByText(name)).toBeTruthy();
  });
}

beforeEach(() => {
  routeState.id = "draft-1";
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CostEditor S09 grouped journeys", () => {
  it("stage acceptance: two chocolates per unit ×10, a second group ×2, delivery 3 once — one multiplication, order-scope levels, honest unit cost", async () => {
    const store = createFormDraftHarness().store;
    const seeded = await seedGroupedDraft(store);
    routeState.id = seeded.id;
    renderEditor(store);
    await screen.findByText(/صندوق شوكولاتة مخصص/i);
    /* أساس الوحدة للمجموعة الأولى: شوكولاتتان بثمن للحبة. */
    await addUnitMaterial("شوكولاتة فاخرة", "شوكولاتة داكنة", "0.35");
    await addUnitMaterial("شوكولاتة فاخرة", "شوكولاتة بالبندق", "0.25");
    await addUnitMaterial("تغليف مخملي", "قماش مخملي", "1.50");
    /* التوصيل 3 د.أ مرة واحدة على نطاق الطلب — لا يُضرب مع أي تكرار. */
    fireEvent.click(screen.getByRole("button", { name: /أضف توصيل/i }));
    const delivery = screen.getByLabelText(/توصيل بالأرقام/i);
    await userEvent.clear(delivery);
    await userEvent.type(delivery, "3");
    fireEvent.click(screen.getByRole("button", { name: /حفظ نسخة التكلفة|حفظ مسودة تكلفة ناقصة/i }));
    await waitFor(() => {
      expect(screen.getByText(/تم حفظ/i)).toBeTruthy();
    });
    const drafts = await store.listDrafts();
    if (!drafts.ok || !drafts.value[0]) throw new Error("draft should exist");
    const saved = drafts.value[0];
    expect(saved.costSnapshots).toHaveLength(1);
    const snapshot = saved.costSnapshots[0];
    /* القيم المحسوبة من النواة عبر المعاينة المخزنة — لا حقول محسوبة مخزنة. */
    const previewed = new CostService(store, () => NOW).previewStored(snapshot);
    if (!previewed.ok) throw new Error("stored snapshot should preview");
    /* التوسيع مرة واحدة: 0.35+0.25=0.60 للوحدة ×10 = 6.00، والتغليف 1.50×2=3.00،
     * والتوصيل 3.00 مرة واحدة — المجموع 12.00 على كمية مشتقة 12 (وحدة=1.00). */
    expect(previewed.snapshot.materialCostMinor).toBe(900);
    expect(snapshot.deliveryMinor).toBe(300);
    expect(previewed.snapshot.plannedCostMinor).toBe(1200);
    expect(snapshot.quantity).toBe(12);
    expect(previewed.snapshot.unitCostMinor).toBe(100);
    /* أساس المجموعات الموثق محفوظ مع اللقطة كما دخل — وحدة كل مجموعة قبل التوسيع. */
    expect(snapshot.groupBasis).toEqual([
      expect.objectContaining({
        groupId: "group-choco",
        repeatQuantity: 10,
        unitMaterialItems: [
          expect.objectContaining({ name: "شوكولاتة داكنة", unitPriceMinor: 35 }),
          expect.objectContaining({ name: "شوكولاتة بالبندق", unitPriceMinor: 25 }),
        ],
      }),
      expect.objectContaining({
        groupId: "group-wrap",
        repeatQuantity: 2,
        unitMaterialItems: [expect.objectContaining({ name: "قماش مخملي", unitPriceMinor: 150 })],
      }),
    ]);
    /* لا أثر مالي: لا أحداث ولا طلبات من حساب التكلفة أو حفظها. */
    const events = await store.listFinancialEvents();
    expect(events.ok && events.value).toHaveLength(0);
    const orders = await store.listOrders();
    expect(orders.ok && orders.value).toHaveLength(0);
  });

  it("unknown stays unknown — no time entered saves an honest incomplete draft, never a zero", async () => {
    const store = createFormDraftHarness().store;
    const seeded = await seedGroupedDraft(store);
    routeState.id = seeded.id;
    renderEditor(store);
    await screen.findByText(/صندوق شوكولاتة مخصص/i);
    await addUnitMaterial("شوكولاتة فاخرة", "شوكولاتة داكنة", "0.35");
    expect(screen.getByText(/وقت العمل غير معروف؛ ستبقى النتيجة ناقصة/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /حفظ مسودة تكلفة ناقصة/i }));
    await waitFor(() => {
      expect(screen.getByText(/تم حفظ مسودة تكلفة ناقصة/i)).toBeTruthy();
    });
    const drafts = await store.listDrafts();
    if (!drafts.ok || !drafts.value[0]) throw new Error("draft should exist");
    const snapshot = drafts.value[0].costSnapshots[0];
    expect(snapshot.time).toBeNull();
    const previewed = new CostService(store, () => NOW).previewStored(snapshot);
    if (!previewed.ok) throw new Error("stored snapshot should preview");
    expect(previewed.snapshot.timeCostMinor).toBe(0);
    /* المجهول لا يصير صفر معرفة: الحالة ناقصة والفجوة الإلزامية معلنة. */
    expect(previewed.snapshot.knowledgeState).toBe("incomplete");
  });

  it("U008-AC12: a quantity change after the last snapshot shows an explicit review notice without rewriting history", async () => {
    const store = createFormDraftHarness().store;
    const seeded = await seedGroupedDraft(store);
    routeState.id = seeded.id;
    renderEditor(store);
    await screen.findByText(/صندوق شوكولاتة مخصص/i);
    await addUnitMaterial("شوكولاتة فاخرة", "شوكولاتة داكنة", "0.35");
    fireEvent.click(screen.getByRole("button", { name: /حفظ مسودة تكلفة ناقصة|حفظ نسخة التكلفة/i }));
    await waitFor(() => {
      expect(screen.getByText(/تم حفظ/i)).toBeTruthy();
    });
    cleanup();
    /* المالك يغيّر تكرار المجموعة في المسودة بعد حفظ نسخة التكلفة — من
     * السجل الحي لا من نسخة قديمة في اليد. */
    const drafts = new DraftService(store, () => NOW);
    const live = await store.getDraft(seeded.id);
    if (!live.ok || !live.value) throw new Error("live draft should exist");
    const updated = await drafts.save({
      ...live.value,
      groups: [
        {
          id: "group-choco",
          label: "شوكولاتة فاخرة",
          repeatQuantity: 12,
          offeringType: "product",
          offeringRef: null,
          note: null,
        },
        {
          id: "group-wrap",
          label: "تغليف مخملي",
          repeatQuantity: 2,
          offeringType: "product",
          offeringRef: null,
          note: null,
        },
      ],
    });
    if (!updated.ok) throw new Error("update failed");
    renderEditor(store);
    await screen.findByText(/صندوق شوكولاتة مخصص/i);
    expect(
      await screen.findByText(
        /كمية الطلب المشتقة من المجموعات صارت 14 بينما آخر نسخة تكلفة حُفظت على كمية 12/i,
      ),
    ).toBeTruthy();
    /* النسخة القديمة لم تُغيَّر — تاريخها كما حُفظ. */
    const list = await store.listDrafts();
    if (!list.ok || !list.value[0]) throw new Error("draft should exist");
    expect(list.value[0].costSnapshots).toHaveLength(1);
    expect(list.value[0].costSnapshots[0].quantity).toBe(12);
  });

  it("U008-AC09: cost inputs survive a reopen through the explicit form-draft restore", async () => {
    const store = createFormDraftHarness().store;
    const seeded = await seedGroupedDraft(store);
    routeState.id = seeded.id;
    renderEditor(store);
    await screen.findByText(/صندوق شوكولاتة مخصص/i);
    await addUnitMaterial("شوكولاتة فاخرة", "شوكولاتة داكنة", "0.35");
    /* إغلاق بلا حفظ النسخة ثم إعادة الفتح — لا فقد صامت. */
    cleanup();
    renderEditor(store);
    const restoreButton = await screen.findByRole("button", { name: /استرجع/i });
    fireEvent.click(restoreButton);
    await waitFor(() => {
      expect(screen.getByText(/شوكولاتة داكنة/i)).toBeTruthy();
    });
    const drafts = await store.listDrafts();
    if (!drafts.ok || !drafts.value[0]) throw new Error("draft should exist");
    /* لم تُحفظ نسخة تكلفة من مجرد الاستعادة — الحفظ وحده يوثّق النسخة. */
    expect(drafts.value[0].costSnapshots).toHaveLength(0);
  });
});
