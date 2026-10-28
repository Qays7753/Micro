/** @vitest-environment jsdom */
/* S03 (UNIT-038 P3.2 + UNIT-039 P3.1/P3.2 — عقد §17): أقسام «بيانات المشروع»
 * و«ما يقدّمه مشروعك» داخل الإعدادات — محرر الاسم المحروس (CAS) بحفظ/إلغاء
 * وتعارض معلن وحالات تحميل/غياب/تعذر مستقلة، ومحرر تفضيل العرض من مصدره
 * الواحد بحفظ الحقل المتغير وحده. خدمات حقيقية فوق مخزن حقيقي — التحقق
 * بإعادة القراءة لا بمضاعفات. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { PreferenceService } from "@/application/preferences/preferenceService";
import { ProfileService } from "@/application/profile/profileService";
import Settings from "@/pages/Settings";
import { ThemeProvider } from "@/contexts/ThemeContext";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => ["/settings", wouterMocks.navigate],
  useParams: () => ({}),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-10-28T09:00:00.000Z";

function buildServices(store: MemoryLocalStore) {
  return {
    formDrafts: { clearAll: vi.fn(async () => ({ ok: true })) },
    integrityCheck: { run: vi.fn(async () => ({ overall: "PASS", checks: [] })) },
    preferences: new PreferenceService(store, () => NOW),
    profiles: new ProfileService(store, () => NOW),
    /* أشكال نتائج الخدمات كما تستهلكها قسم القدرات الحقيقي (عدّادات
     * السجلات القائمة) — قيم فارغة صادقة لا مضاعفات ناقصة. */
    agreements: { list: vi.fn(async () => ({ ok: true, orders: [] })) },
    inventory: { overview: vi.fn(async () => ({ ok: true, value: { materials: [] } })) },
    supplierPurchases: { readSummary: vi.fn(async () => ({ ok: true, value: { purchaseCount: 0 } })) },
    catalog: { list: vi.fn(async () => ({ ok: true, items: [] })) },
    actualTime: {
      readOperatingMode: vi.fn(async () => ({
        ok: true,
        value: { workMode: null, actualTimeTrackingEnabled: false },
      })),
      saveOperatingMode: vi.fn(),
    },
    transfers: undefined,
    guidedOpeningImport: undefined,
    dataVersion: 0,
    notifyDataChanged: vi.fn(),
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

async function seedProfile(store: MemoryLocalStore, name: string) {
  const created = await new ProfileService(store, () => NOW).create(name);
  if (!created.ok) throw new Error(created.message);
  return created.profile;
}

describe("S03 Settings — بيانات المشروع (guarded rename) + ما يقدّمه مشروعك (single-source preference)", () => {
  let store: MemoryLocalStore;

  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    store = new MemoryLocalStore();
    mockedUsePrototypeServices.mockReturnValue(buildServices(store));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
    wouterMocks.navigate.mockReset();
  });

  it("project data section: ready state shows the current name and the fixed local identity — then rename saves through the guarded CAS boundary", async () => {
    await seedProfile(store, "ورشة أم جهاد");
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    expect(await screen.findByText("ورشة أم جهاد")).toBeTruthy();
    /* الهوية الثابتة معروضة — المعرّف لا يتغير مع الاسم. */
    expect(screen.getByText(/المعرّف لا يتغير مع تعديل الاسم/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "عدّل اسم المشروع" }));
    const input = screen.getByTestId("project-name-input") as HTMLInputElement;
    expect(input.value).toBe("ورشة أم جهاد");
    fireEvent.change(input, { target: { value: "  ورشة أم جهاد للتفصيل  " } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ الاسم" }));
    await waitFor(() => expect(screen.getByText("ورشة أم جهاد للتفصيل")).toBeTruthy());
    const stored = await store.getProfile();
    expect(stored).toMatchObject({
      ok: true,
      value: { activityName: "ورشة أم جهاد للتفصيل", id: "local-profile" },
    });
    /* المعرّف وتاريخ الإنشاء كما هما — الاسم وحده تغيّر. */
    const seed = await store.getProfile();
    if (!seed.ok || !seed.value) throw new Error("profile should exist");
    expect(seed.value.createdAt).toBeTruthy();
  });

  it("project data section: cancel discards the edit without any write", async () => {
    await seedProfile(store, "الاسم الأصلي");
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    await screen.findByText("الاسم الأصلي");
    fireEvent.click(screen.getByRole("button", { name: "عدّل اسم المشروع" }));
    fireEvent.change(screen.getByTestId("project-name-input"), { target: { value: "اسم لن يُحفظ" } });
    fireEvent.click(screen.getByRole("button", { name: "إلغاء التعديل" }));
    await waitFor(() => expect(screen.getByText("الاسم الأصلي")).toBeTruthy());
    const stored = await store.getProfile();
    expect(stored).toMatchObject({ ok: true, value: { activityName: "الاسم الأصلي" } });
  });

  it("project data section: an empty name is rejected near the field — no write, honest focus", async () => {
    await seedProfile(store, "اسم قائم");
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    await screen.findByText("اسم قائم");
    fireEvent.click(screen.getByRole("button", { name: "عدّل اسم المشروع" }));
    fireEvent.change(screen.getByTestId("project-name-input"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ الاسم" }));
    const error = await screen.findByRole("alert");
    expect(error.textContent).toContain("اكتب اسم مشروعك، أو ألغِ التعديل");
    const stored = await store.getProfile();
    expect(stored).toMatchObject({ ok: true, value: { activityName: "اسم قائم" } });
  });

  it("project data section: a concurrent rename is an announced conflict — the newer name survives and the stale form never silently overwrites it", async () => {
    await seedProfile(store, "الاسم الأساسي");
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    await screen.findByText("الاسم الأساسي");
    fireEvent.click(screen.getByRole("button", { name: "عدّل اسم المشروع" }));
    /* نافذة أخرى تعدّل الاسم بعد فتح المحرر — محرر الإعدادات يحمل النسخة القديمة. */
    const current = await store.getProfile();
    if (!current.ok || !current.value) throw new Error("profile should exist");
    const other = await new ProfileService(store, () => "2026-10-28T10:00:00.000Z").rename(
      "اسم أحدث من نافذة أخرى",
      current.value.updatedAt,
    );
    if (!other.ok) throw new Error(other.message);
    fireEvent.change(screen.getByTestId("project-name-input"), { target: { value: "اسم متقادم" } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ الاسم" }));
    const conflict = await screen.findByTestId("rename-conflict-note");
    expect(conflict.getAttribute("role")).toBe("alert");
    expect(conflict.textContent).toContain("الاسم المحفوظ الآن");
    expect(conflict.textContent).toContain("اسم أحدث من نافذة أخرى");
    const stored = await store.getProfile();
    expect(stored).toMatchObject({ ok: true, value: { activityName: "اسم أحدث من نافذة أخرى" } });
  });

  it("project data section: an absent profile is an honest independent state with one setup entry — never a second project from Settings", async () => {
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    const absent = await screen.findByText("لا يوجد ملف مشروع على هذا الجهاز بعد");
    /* S03-R3-F01: الغياب فراغ محايد (عقد EmptyState الكنوني: رمز هادئ +
     * عنوان موجّه + فعل واحد) — لا قالب خطأ التخزين الأحمر، وحاله
     * المستقلة role=status تبقى كما هي. */
    expect(absent.closest("section")!.getAttribute("role")).toBe("status");
    expect(absent.closest(".micro-storage-error")).toBeNull();
    expect(screen.getByTestId("settings-project-absent")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "افتح إعداد المشروع" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(expect.stringContaining("/setup"));
    const stored = await store.getProfile();
    expect(stored).toMatchObject({ ok: true, value: null });
  });

  it("S03-R3-F04: opening the rename editor moves focus into the field, and closing it returns focus to the begin button", async () => {
    await seedProfile(store, "ورشة التركيز");
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    const begin = (await screen.findByRole("button", {
      name: "عدّل اسم المشروع",
    })) as HTMLButtonElement;
    begin.focus();
    expect(document.activeElement).toBe(begin);
    /* الفتح: زر البدء يُستبدل بالمحرر فيفقد التركيز — الحقل يستقر فيه
     * التركيز (autoFocus كسابقة المحررات الداخلية) لا يسقط إلى body. */
    fireEvent.click(begin);
    const input = screen.getByTestId("project-name-input") as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(input));
    /* الإلغاء: التركيز يعود إلى زر التعديل المعاد ظهوره — لا ضياع مكان
     * المستخدم لوحة المفاتيح/قارئ الشاشة في كلا الاتجاهين. */
    fireEvent.click(screen.getByRole("button", { name: "إلغاء التعديل" }));
    const beginAfter = (await screen.findByRole("button", {
      name: "عدّل اسم المشروع",
    })) as HTMLButtonElement;
    await waitFor(() => expect(document.activeElement).toBe(beginAfter));
  });

  it("offering section: neutral default, canonical save through the single source, and unrelated preferences preserved", async () => {
    await seedProfile(store, "مشغل الاختبار");
    /* بذر تفضيلات أخرى غير مرتبطة — يجب أن تنجو من كتابة تفضيل العرض. */
    await new PreferenceService(store, () => NOW).save("dark");
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    const editor = await screen.findByTestId("offering-editor");
    const radios = Array.from(editor.querySelectorAll("input[type=radio]")) as HTMLInputElement[];
    expect(radios).toHaveLength(4);
    expect(radios.find(r => r.checked)!.value).toBe("");
    fireEvent.click(editor.querySelector('input[type=radio][value="services"]')!);
    fireEvent.click(screen.getByRole("button", { name: "احفظ تفضيل ما يقدّمه مشروعك" }));
    await waitFor(() => expect(screen.getByText(/تم حفظ تفضيل ما يقدّمه مشروعك/)).toBeTruthy());
    const record = await store.getPreferences();
    if (!record.ok || !record.value) throw new Error("preferences should exist");
    expect(record.value.offeringPreference).toBe("services");
    expect(record.value.theme).toBe("dark");
  });

  it("offering section: a save failure is announced honestly with the selection kept — retry stays in the owner's hands", async () => {
    await seedProfile(store, "مشغل الاختبار");
    const originalSave = store.savePreferences.bind(store);
    let failed = false;
    store.savePreferences = (async (record: unknown) => {
      if (!failed) {
        failed = true;
        return { ok: false, code: "storage_error", message: "quota" };
      }
      return originalSave(record as never);
    }) as never;
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    const editor = await screen.findByTestId("offering-editor");
    fireEvent.click(editor.querySelector('input[type=radio][value="both"]')!);
    fireEvent.click(screen.getByRole("button", { name: "احفظ تفضيل ما يقدّمه مشروعك" }));
    const error = await screen.findByRole("alert");
    expect(error.textContent).toContain("تعذر حفظ التفضيل");
    /* الاختيار باقٍ أمام المالك — لم يُبتلع ولم يُدّع نجاح. */
    expect((editor.querySelector('input[type=radio][value="both"]') as HTMLInputElement).checked).toBe(true);
    /* زوال السبب ثم إعادة المحاولة تنجح من المصدر نفسه. */
    fireEvent.click(screen.getByRole("button", { name: "احفظ تفضيل ما يقدّمه مشروعك" }));
    await waitFor(() => expect(screen.getByText(/تم حفظ تفضيل ما يقدّمه مشروعك/)).toBeTruthy());
    const record = await store.getPreferences();
    expect(record).toMatchObject({ ok: true, value: { offeringPreference: "both" } });
  });
});
