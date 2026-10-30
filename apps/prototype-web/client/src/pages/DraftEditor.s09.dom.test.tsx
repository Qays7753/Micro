/** @vitest-environment jsdom */
/* S09 (UNIT-007/029 / DOC-018 — أمر ad133bae القسم ٢): رحلات DOM لمحرر
 * المسودة الموسّع — المجموعات بهوية ثابتة وتكرار واحد، والمرجع المحفوظ
 * الموسوم (لقطة مستقلة بمراجعتها لا «الأحدث وقت القراءة»)، والسعر المقترح
 * الحر (0 صريح صحيح والنص غير الصالح يُحفظ خامًا ويُمنع الالتزام)، و«حفظ
 * لاستخدامه مرة أخرى» الصريح التكراري، واستعادة النص الخام غير الصالح بعد
 * إعادة الفتح (U007-AC03)، وعدم إنشاء مسودة من الكمية الافتراضية وحدها أو
 * من مجموعة بلا تسمية (U007-AC01/AC02). */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { FormDraftService } from "@/application/drafts/formDraftService";
import { DraftService } from "@/application/drafts/draftService";
import { CostService } from "@/application/cost/costService";
import { CatalogService } from "@/application/catalog/catalogService";
import { createFormDraftHarness } from "@/application/drafts/formDraftTestHarness";
import type { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import DraftEditor from "./DraftEditor";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn() }));
const routeState = vi.hoisted(() => ({ id: "new", search: "" }));

vi.mock("wouter", () => ({
  useSearch: () => routeState.search,
  useLocation: () => [`/orders/draft/${routeState.id}`, wouterMocks.navigate],
  useParams: () => ({ id: routeState.id }),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-10-30T18:00:00.000Z";

function renderEditor(store: MemoryLocalStore) {
  mockedUsePrototypeServices.mockReturnValue({
    formDrafts: new FormDraftService(store, () => NOW),
    drafts: new DraftService(store, () => NOW),
    catalog: new CatalogService(store, () => NOW),
    costs: new CostService(store, () => NOW),
    costEstimates: { get: vi.fn().mockResolvedValue({ ok: true, value: null }) },
    dataVersion: 0,
    notifyDataChanged: vi.fn(),
  } as unknown as ReturnType<typeof usePrototypeServices>);
  render(
    <UnsavedChangesProvider navigate={() => undefined}>
      <DraftEditor />
    </UnsavedChangesProvider>,
  );
}

async function seedCatalogItem(store: MemoryLocalStore, name: string, kind: "product" | "service") {
  const service = new CatalogService(store, () => NOW);
  const result = await service.create({
    kind,
    name,
    unitLabel: null,
    operationKey: `seed-${name}`,
  });
  if (!result.ok) throw new Error("seed catalog item failed");
  return result.item;
}

beforeEach(() => {
  routeState.id = "new";
  routeState.search = "";
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DraftEditor S09 journeys", () => {
  it("U007-AC01/AC02: opening with default quantity 1 alone creates no draft; an empty-label group alone creates none either", async () => {
    const store = createFormDraftHarness().store;
    renderEditor(store);
    expect(await screen.findByText("طلب من عميل")).toBeTruthy();
    /* الكمية الافتراضية 1 وحدها ليست إدخالًا حقيقيًا — لا سجل. */
    await waitFor(() => {
      expect(screen.getByLabelText(/الكمية بالأرقام/i)).toBeTruthy();
    });
    const saved = await store.listDrafts();
    expect(saved.ok && saved.value).toHaveLength(0);
    /* إضافة مجموعة بلا تسمية وحدها ليست إدخالًا حقيقيًا كذلك. */
    await userEvent.click(screen.getByRole("button", { name: /أضف مجموعة/i }));
    await waitFor(() => {
      expect(screen.getByText(/اسم المجموعة/i)).toBeTruthy();
    });
    const stillNone = await store.listDrafts();
    expect(stillNone.ok && stillNone.value).toHaveLength(0);
  });

  it("creates a draft with two groups and a suggested price; the derived repeat total is shown and the record keeps the groups verbatim", async () => {
    const store = createFormDraftHarness().store;
    renderEditor(store);
    await userEvent.type(await screen.findByLabelText(/وصف القطعة/i), "صندوق شوكولاتة مخصص");
    await userEvent.type(screen.getByLabelText(/السعر المقترح للبيع/i), "15.50");
    await userEvent.click(screen.getByRole("button", { name: /أضف مجموعة/i }));
    const groupLabels = screen.getAllByLabelText(/اسم المجموعة/i);
    await userEvent.type(groupLabels[0], "شوكولاتة فاخرة");
    const repeats = screen.getAllByLabelText(/تكرار .* بالأرقام 0–9/i);
    await userEvent.clear(repeats[0]);
    await userEvent.type(repeats[0], "10");
    await userEvent.click(screen.getByRole("button", { name: /أضف مجموعة/i }));
    const groupLabelsAfter = screen.getAllByLabelText(/اسم المجموعة/i);
    await userEvent.type(groupLabelsAfter[1], "تغليف مخملي");
    const repeatsAfter = screen.getAllByLabelText(/تكرار .* بالأرقام 0–9/i);
    await userEvent.clear(repeatsAfter[1]);
    await userEvent.type(repeatsAfter[1], "2");
    await waitFor(() => {
      expect(screen.getByText("12", { selector: "bdi" })).toBeTruthy();
    });
    await userEvent.click(screen.getByRole("button", { name: /حفظ مسودة/i }));
    await waitFor(() => {
      expect(screen.getByText(/تم حفظ المسودة على هذا الجهاز/i)).toBeTruthy();
    });
    const drafts = await store.listDrafts();
    if (!drafts.ok) throw new Error("list failed");
    expect(drafts.value).toHaveLength(1);
    const saved = drafts.value[0];
    expect(saved.suggestedPriceMinor).toBe(1550);
    expect(saved.groups).toEqual([
      expect.objectContaining({ label: "شوكولاتة فاخرة", repeatQuantity: 10, offeringType: "product" }),
      expect.objectContaining({ label: "تغليف مخملي", repeatQuantity: 2 }),
    ]);
    expect(saved.quantity).toBe(1);
  });

  it("U007-AC03 + SDF-029: an invalid quantity keeps its raw text in the field, blocks the commit (disabled action), and recovers verbatim after reopening", async () => {
    const store = createFormDraftHarness().store;
    renderEditor(store);
    await userEvent.type(await screen.findByLabelText(/وصف القطعة/i), "مسودة كمية مكسورة");
    const quantity = screen.getByLabelText(/الكمية بالأرقام/i);
    await userEvent.clear(quantity);
    await userEvent.type(quantity, "3x5");
    /* النص غير الصالح يبقى خامًا أمام المستخدم ويحمل علامة الخطأ، والالتزام
     * محجوز (الزر معطّل والعلامة الميدانية ظاهرة) — لا مسودة بقيمة مكسورة. */
    expect((quantity as HTMLInputElement).value).toBe("3x5");
    const saveButton = screen.getByRole("button", { name: /حفظ مسودة/i });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
    /* السجل المُنشأ من الوصف يحمل آخر كمية صالحة فقط — النص المكسور «3x5»
     * لا يدخل السجل أبدًا؛ يبقى خامًا في الحقل ومسودة النموذج وحدها. */
    const drafts = await store.listDrafts();
    if (!drafts.ok || !drafts.value[0]) throw new Error("draft should exist from real input");
    /* و٥: السجل يُنشأ عند أول إدخال حقيقي ويتحدّث بالحفظ الصريح — المهم هنا
     * أن الكمية المكسورة لم تدخله أبدًا. */
    expect(drafts.value[0].quantity).toBe(1);
    expect(JSON.stringify(drafts.value[0])).not.toContain("3x5");
    /* إعادة الفتح: عرض استعادة صريح يستعيد النص الخام نفسه كما كان. */
    cleanup();
    renderEditor(store);
    const restoreButton = await screen.findByRole("button", { name: /استرجع/i });
    await userEvent.click(restoreButton);
    const restored = await screen.findByLabelText(/الكمية بالأرقام/i);
    expect((restored as HTMLInputElement).value).toBe("3x5");
    expect((screen.getByLabelText(/وصف القطعة/i) as HTMLInputElement).value).toBe("مسودة كمية مكسورة");
    const blockedAgain = screen.getByRole("button", { name: /حفظ مسودة/i });
    expect((blockedAgain as HTMLButtonElement).disabled).toBe(true);
  });

  it("U029-AC31/D03: choosing a saved offering stamps a versioned snapshot with the active template revision — not latest-at-read", async () => {
    const store = createFormDraftHarness().store;
    const item = await seedCatalogItem(store, "صندوق هدايا فاخر", "product");
    const catalog = new CatalogService(store, () => NOW);
    const template = await catalog.createTemplate({
      catalogItemId: item.id,
      title: null,
      note: null,
      components: [],
      yield: null,
      operationKey: "seed-template-1",
    });
    if (!template.ok) throw new Error("seed template failed");
    renderEditor(store);
    await userEvent.type(await screen.findByLabelText(/وصف القطعة/i), "طلب صندوق");
    const refSelect = screen.getByLabelText(/مرجع العمل/i) as HTMLSelectElement;
    await userEvent.selectOptions(refSelect, item.id);
    await waitFor(() => {
      expect(screen.getByText(/لقطة مختومة بمراجعتها وقت الاختيار/i)).toBeTruthy();
    });
    await userEvent.click(screen.getByRole("button", { name: /حفظ مسودة/i }));
    await waitFor(() => {
      expect(screen.getByText(/تم حفظ المسودة على هذا الجهاز/i)).toBeTruthy();
    });
    const drafts = await store.listDrafts();
    if (!drafts.ok || !drafts.value[0]) throw new Error("draft should exist");
    const ref = drafts.value[0].offeringRef;
    expect(ref).toEqual({
      catalogItemId: item.id,
      templateId: template.template.id,
      revision: 1,
      nameSnapshot: "صندوق هدايا فاخر",
      takenAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
    });
    /* D03/AC33: أرشفة المصدر بعد الختم لا تغيّر اللقطة المختومة. */
    await catalog.deactivate(item.id);
    const afterArchive = await store.getDraft(drafts.value[0].id);
    expect(afterArchive.ok && afterArchive.value?.offeringRef).toEqual(ref);
  });

  it("U029-AC32/AC37: explicit save-for-reuse creates the definition once; repeated taps return the same item with no duplicate", async () => {
    const store = createFormDraftHarness().store;
    renderEditor(store);
    await userEvent.type(await screen.findByLabelText(/وصف القطعة/i), "كيكة طبقات");
    await userEvent.click(screen.getByRole("button", { name: /حفظ مسودة/i }));
    await waitFor(() => {
      expect(screen.getByText(/تم حفظ المسودة على هذا الجهاز/i)).toBeTruthy();
    });
    const saveForReuse = await screen.findByRole("button", { name: /احفظه لاستخدامه مرة أخرى/i });
    await userEvent.click(saveForReuse);
    await waitFor(() => {
      expect(screen.getByText(/حُفظ «كيكة طبقات» في منتجاتي وخدماتي/i)).toBeTruthy();
    });
    await userEvent.click(screen.getByRole("button", { name: /احفظه لاستخدامه مرة أخرى/i }));
    await waitFor(() => {
      expect(screen.getByText(/محفوظ أصلًا بنفس الاسم والنوع — لم نُنشئ نسخة ثانية/i)).toBeTruthy();
    });
    const items = await store.listCatalogItems();
    expect(items.ok && items.value).toHaveLength(1);
    /* لا أثر مالي: لا أحداث ولا طلبات من الحفظ للكتالوج. */
    const events = await store.listFinancialEvents();
    expect(events.ok && events.value).toHaveLength(0);
  });

  it("shows the linked-order protected view and blocks editing (U007-AC19)", async () => {
    const store = createFormDraftHarness().store;
    const drafts = new DraftService(store, () => NOW);
    const created = await drafts.create("customer_order", { itemName: "طلب مرتبط" });
    if (!created.ok) throw new Error("create failed");
    const linked = await drafts.save({
      ...created.draft,
      linkedOrderId: "order-1",
    });
    if (!linked.ok) throw new Error("link failed");
    routeState.id = linked.draft.id;
    renderEditor(store);
    expect(await screen.findByText(/هذه المسودة أصبحت طلبًا محليًا/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /فتح الطلب/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /حفظ مسودة/i })).toBeNull();
  });
});
