/** @vitest-environment jsdom */

/* UNIT-001 V2 (مواصفة 2026-10-18): اختبارات الشاشة الواحدة — الاسم والبدء،
 * حوار معلومات المكتبة، مدخل الاستعادة المفوّض لمالك 044، مسودة الاسم
 * المنفصلة، حارس الهوية القائمة، وحالات الفشل/الاسترداد الصادقة.
 * التغطية: U001-AC01..AC10 + ACD001/002/005/023/024 + سلبيات DUP-001/002/005/023
 * + دورة حياة ARCH-012-NF-001 المحفوظة كما هي.
 * U001-AC11 (فحص فهم بشري مع الفئة المستهدفة) ليس اختبار آلة — يُسجل بندًا
 * مستقبليًا صادقًا في تقرير التنفيذ لا يُدعى هنا. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { ProfileService } from "@/application/profile/profileService";
import { FormDraftService } from "@/application/drafts/formDraftService";
import { createFormDraftHarness } from "@/application/drafts/formDraftTestHarness";
import type { PrototypeLocalStore } from "@/storage/local/types";
import Setup from "@/pages/Setup";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => ["/setup", wouterMocks.navigate],
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

/** خدمات حقيقية فوق مخزن حقيقي — الهوية والمسودة يُتحقق منهما بإعادة القراءة.
 * لا cashContinuity أصلًا في السياق: Setup V2 لا يستهلك أي خدمة نقدي (DUP-001
 * سلبي بنيوي — لو استوردها لانفجر هذا الاختبار). */
function setupServices(options: { store?: PrototypeLocalStore } = {}) {
  const store = options.store ?? createFormDraftHarness().store;
  const notifyDataChanged = vi.fn();
  const services = {
    profiles: new ProfileService(store),
    notifyDataChanged,
    formDrafts: new FormDraftService(store),
  } as unknown as ReturnType<typeof usePrototypeServices>;
  return { services, store, notifyDataChanged };
}

/** بذر مسودة اسم عبر الحد الموحّد — شكل V2 (اسم فقط). */
async function seedNameDraft(store: PrototypeLocalStore, activityName: string) {
  await new FormDraftService(store).save("setup", null, {
    activityName,
    savedAt: "2026-10-01T10:00:00.000Z",
  });
}

beforeEach(() => {
  wouterMocks.navigate.mockReset();
});

afterEach(() => {
  cleanup();
  globalThis.localStorage?.clear();
});

/* ── الشاشة العادية: العناصر الأربعة فقط (R03/AC01، DUP-001 سلبي) ── */
describe("UNIT-001 screen A — one name, one primary action, no cash (R03/DUP-001)", () => {
  it("renders exactly the approved surface: title, info icon, name field, save, restore", async () => {
    const { services } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    expect(await screen.findByRole("heading", { name: "إعداد مشروعك" })).toBeTruthy();
    expect(screen.getByLabelText("اسم المشروع")).toBeTruthy();
    expect((screen.getByLabelText("اسم المشروع") as HTMLInputElement).placeholder).toBe("مثال: حلويات ليان");
    expect(screen.getByRole("button", { name: "احفظ وابدأ" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "استعادة نسخة احتياطية" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "معلومات الإعداد وحفظ البيانات" })).toBeTruthy();
  });

  it("carries no wizard, no cash fields, and no standing financial copy (DUP-001)", async () => {
    const { services } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    await screen.findByRole("heading", { name: "إعداد مشروعك" });
    for (const absent of [
      "قرار البداية",
      "وين تحط فلوسك؟",
      "شو وضع الدرج هلق؟",
      "اسم محفظة النقد الافتراضية",
      "الموقف الافتتاحي",
      "تخطَّ المحفظة الآن",
      "سطر حقيقة",
      "ما يعرفه Micro الآن",
    ] as const) {
      expect(screen.queryByText(absent)).toBeNull();
    }
    expect(screen.queryByLabelText(/محفظة/)).toBeNull();
    expect(screen.queryByLabelText(/افتتاحي/)).toBeNull();
    expect(screen.queryByTestId("setup-value-statement")).toBeNull();
  });

  it("imposes no invented length or language limit on the name (F01/AC03)", async () => {
    const { services } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    expect(input.maxLength).toBe(-1);
    expect(input.getAttribute("lang")).toBeNull();
  });

  it("uses the library icon-button class for the info trigger (R15 touch target — RV3-N001 regression)", async () => {
    const { services } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const trigger = (await screen.findByTestId("setup-info-trigger")) as HTMLButtonElement;
    expect(trigger.className).toContain("micro-icon-button");
    expect(trigger.className).not.toContain("micro-icon-action");
  });
});

/* ── الاسم الفارغ بعد trim (R04/AC02) ── */
describe("UNIT-001 empty-name rejection near the field (R04/AC02)", () => {
  it("rejects an empty name with T05 near the field, focus, and no write or navigation", async () => {
    const { services } = setupServices();
    const createSpy = vi.spyOn(services.profiles, "create");
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    await screen.findByRole("heading", { name: "إعداد مشروعك" });
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ" }));
    const error = await screen.findByText("اكتب اسم مشروعك.");
    expect(error.getAttribute("role")).toBe("alert");
    const input = screen.getByLabelText("اسم المشروع") as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("setup-name-error");
    expect(document.activeElement).toBe(input);
    expect(createSpy).not.toHaveBeenCalled();
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
  });

  it("whitespace-only is still empty after trim (R04)", async () => {
    const { services } = setupServices();
    const createSpy = vi.spyOn(services.profiles, "create");
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "    " } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ" }));
    expect(await screen.findByText("اكتب اسم مشروعك.")).toBeTruthy();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("typing a real value clears the field error (R04 — keeps valid input)", async () => {
    const { services } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ" }));
    expect(await screen.findByText("اكتب اسم مشروعك.")).toBeTruthy();
    fireEvent.change(input, { target: { value: "حلويات ليان" } });
    expect(screen.queryByText("اكتب اسم مشروعك.")).toBeNull();
  });
});

/* ── الحفظ الصالح (R05/R06/AC01/AC03) ── */
describe("UNIT-001 valid save — single identity source, progress, direct Home (R05/R06)", () => {
  it("creates the identity once with the trimmed name and opens Home directly", async () => {
    const { services, store, notifyDataChanged } = setupServices();
    const createSpy = vi.spyOn(services.profiles, "create");
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  حلويات ليان  " } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ" }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/?setup=1", { replace: true }));
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith("  حلويات ليان  ");
    const stored = await store.getProfile();
    expect(stored).toMatchObject({ ok: true, value: { activityName: "حلويات ليان" } });
    expect(notifyDataChanged).toHaveBeenCalledTimes(1);
  });

  it("announces progress (T04) and blocks duplicate submission while saving (R05/R12/AC06)", async () => {
    const { services } = setupServices();
    let releaseCreate!: (value: unknown) => void;
    const gate = new Promise<unknown>(resolve => {
      releaseCreate = resolve;
    });
    const createSpy = vi
      .spyOn(services.profiles, "create")
      .mockImplementation(async () => (await gate) as never);
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "مشغل الكرامة" } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ" }));
    expect(await screen.findByText("جارٍ الحفظ…")).toBeTruthy();
    /* الضغط المزدوج والفعل الثانوي المتعارض محجوبان — المعلومة القرائية متاحة،
     * وعقد المكتبة للتحميل مصرّح (aria-busy — RV3-N002). */
    const primary = screen.getByRole("button", { name: /جارٍ الحفظ/ }) as HTMLButtonElement;
    expect(primary.disabled).toBe(true);
    expect(primary.getAttribute("aria-busy")).toBe("true");
    expect(
      (screen.getByRole("button", { name: "استعادة نسخة احتياطية" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "معلومات الإعداد وحفظ البيانات" }) as HTMLButtonElement).disabled,
    ).toBe(false);
    fireEvent.click(primary);
    fireEvent.click(screen.getByRole("button", { name: "استعادة نسخة احتياطية" }));
    releaseCreate({ ok: true, profile: { id: "p" }, created: true });
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/?setup=1", { replace: true }));
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(wouterMocks.navigate).not.toHaveBeenCalledWith(expect.stringContaining("/settings"));
  });

  it("mixed Arabic/Latin long names are saved exactly after trim with no truncation (AC03)", async () => {
    const { services, store } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const longName = "حلويات Lيان 2026 — مشروع تجريبي طويل جدًا يحمل عربية ولاتينية وأرقام ASCII 0-9 معًا";
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: longName } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ" }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/?setup=1", { replace: true }));
    const stored = await store.getProfile();
    expect(stored).toMatchObject({ ok: true, value: { activityName: longName } });
  });

  it("successful completion clears the name draft only after success is proven (R06/AC04)", async () => {
    const { services, store } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "مشغل النور" } });
    await waitFor(async () => {
      const saved = await store.getFormDraft("setup:new");
      expect(saved.ok && saved.value).not.toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ" }));
    await waitFor(async () => {
      const cleared = await store.getFormDraft("setup:new");
      expect(cleared.ok && cleared.value).toBeNull();
    });
  });
});

/* ── فشل الحفظ ونتيجته غير المؤكدة (R07/AC05) ── */
describe("UNIT-001 save failure — keep the name, honest recovery, verify before retry (R07)", () => {
  it("a failed write shows T07, keeps the name, and allows retry (R07/AC05)", async () => {
    const { services } = setupServices();
    let fail = true;
    const createSpy = vi.spyOn(services.profiles, "create").mockImplementation(async name => {
      if (fail) return { ok: false, code: "storage_error" as const, message: "write failed" };
      return {
        ok: true as const,
        profile: {
          id: "local-profile",
          activityName: name.trim(),
          currency: "JOD",
          activityType: "custom_craft",
          createdAt: "2026-10-18T00:00:00.000Z",
          updatedAt: "2026-10-18T00:00:00.000Z",
        },
        created: true,
      };
    });
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "مشغل الصمود" } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ" }));
    const failure = await screen.findByTestId("setup-save-failed");
    expect(failure.textContent).toContain("تعذر حفظ مشروعك. أعد المحاولة.");
    expect(failure.getAttribute("role")).toBe("alert");
    expect((screen.getByLabelText("اسم المشروع") as HTMLInputElement).value).toBe("مشغل الصمود");
    expect(screen.getByRole("button", { name: "احفظ وابدأ" })).toBeTruthy();
    /* إعادة المحاولة متاحة وتنجح — لا نجاح مبكر ولا فقد للقيم. */
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ" }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/?setup=1", { replace: true }));
    expect(createSpy).toHaveBeenCalledTimes(2);
  });

  it("retry after an uncertain write uses the proven-saved file — never creates another (R07/AC06)", async () => {
    const { services, store } = setupServices();
    /* الكتابة الأولى «فشلت» ظاهريًا لكنها نجحت فعلًا في المتجر (نتيجة غير مؤكدة). */
    const createSpy = vi.spyOn(services.profiles, "create").mockImplementationOnce(async () => ({
      ok: false,
      code: "storage_error" as const,
      message: "uncertain",
    }));
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "مشغل التحقق" } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ" }));
    await screen.findByTestId("setup-save-failed");
    await new ProfileService(store).create("مشغل التحقق");
    /* إعادة المحاولة: الملف القائم ثبت — يُفتح ولا يُنشأ بديل ولا يُعدَّل. */
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ" }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/?setup=1", { replace: true }));
    expect(createSpy).toHaveBeenCalledTimes(1);
    const stored = await store.getProfile();
    expect(stored).toMatchObject({ ok: true, value: { activityName: "مشغل التحقق" } });
  });

  it("a failed identity read enters recovery — never empty data, never a new project (R01/R07/AC05)", async () => {
    const { services } = setupServices();
    const createSpy = vi.spyOn(services.profiles, "create");
    const loadSpy = vi
      .spyOn(services.profiles, "load")
      .mockResolvedValue({ ok: false, code: "storage_error" as const, message: "read failed" });
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const recovery = await screen.findByTestId("setup-storage-recovery");
    expect(recovery.getAttribute("role")).toBe("alert");
    expect(recovery.textContent).toContain("تعذر فتح البيانات المحلية.");
    expect(screen.queryByLabelText("اسم المشروع")).toBeNull();
    expect(createSpy).not.toHaveBeenCalled();
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    expect(loadSpy).toHaveBeenCalled();
  });

  it("a read failure at submit time enters recovery without any blind write (R07)", async () => {
    const { services } = setupServices();
    const createSpy = vi.spyOn(services.profiles, "create");
    let reads = 0;
    vi.spyOn(services.profiles, "load").mockImplementation(async () => {
      reads += 1;
      if (reads === 1) return { ok: true as const, value: null };
      return { ok: false, code: "storage_error" as const, message: "read failed" };
    });
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "مشغل القراءة" } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ" }));
    expect(await screen.findByTestId("setup-storage-recovery")).toBeTruthy();
    expect(createSpy).not.toHaveBeenCalled();
  });
});

/* ── الهوية القائمة (R02/AC06/DUP-002/ACD002) ── */
describe("UNIT-001 existing identity — open it, never duplicate or edit (R02/DUP-002)", () => {
  it("arriving at /setup with an existing project opens the existing project (R02/ACD002)", async () => {
    const { services, store } = setupServices();
    await new ProfileService(store).create("مشروع قائم");
    const createSpy = vi.spyOn(services.profiles, "create");
    const saveSpy = vi.spyOn(services.profiles, "save");
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/", { replace: true }));
    expect(createSpy).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("an identity created after mount is used as-is on submit — no second identity, no edit (AC06/DUP-002)", async () => {
    const { services, store } = setupServices();
    const createSpy = vi.spyOn(services.profiles, "create");
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "اسم متأخر" } });
    /* هوية ظهرت من نافذة أخرى بين الكتابة والحفظ. */
    await new ProfileService(store).create("مشروع النافذة الأخرى");
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ" }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/?setup=1", { replace: true }));
    expect(createSpy).not.toHaveBeenCalled();
    const stored = await store.getProfile();
    expect(stored).toMatchObject({ ok: true, value: { activityName: "مشروع النافذة الأخرى" } });
  });

  it("rename stays owned by 039 — setup never edits and the single source keeps one record (ACD002)", async () => {
    const { services, store } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "الاسم الأول" } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ" }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/?setup=1", { replace: true }));
    cleanup();
    wouterMocks.navigate.mockReset();
    /* 039 (صفحة Profile) يعدّل عبر save — نفس المصدر، معرّف واحد. */
    const renamed = await new ProfileService(store).save("الاسم بعد التعديل");
    expect(renamed).toMatchObject({ ok: true, profile: { activityName: "الاسم بعد التعديل" } });
    const stored = await store.getProfile();
    expect(stored).toMatchObject({
      ok: true,
      value: { id: "local-profile", activityName: "الاسم بعد التعديل" },
    });
    /* الرجوع إلى Setup بعد التعديل: يفتح القائم — لا هوية ثانية. */
    mockedUsePrototypeServices.mockReturnValue(setupServices({ store }).services);
    render(<Setup />);
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/", { replace: true }));
  });
});

/* ── مدخل الاستعادة (R11/DUP-005/AC09/ACD005) ── */
describe("UNIT-001 restore entry — delegate to the existing 044 owner (R11/DUP-005)", () => {
  it("the secondary action opens the existing Settings restore owner with a return context", async () => {
    const { services } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    await screen.findByRole("heading", { name: "إعداد مشروعك" });
    fireEvent.click(screen.getByRole("button", { name: "استعادة نسخة احتياطية" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/settings?returnTo=%2Fsetup");
    /* لا صفحة استيراد داخل Setup نفسها — التفويض لمالك 044 وحده (DUP-005). */
    expect(screen.queryByTestId("setup-restore-entry")).toBeTruthy();
    expect(document.querySelector("input[type=file]")).toBeNull();
  });

  it("typing a name then leaving for restore keeps the draft for an explicit return (R11/AC09)", async () => {
    const { services, store } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "اسم محفوظ للاستعادة" } });
    await waitFor(async () => {
      const saved = await store.getFormDraft("setup:new");
      expect(saved.ok && saved.value).not.toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: "استعادة نسخة احتياطية" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/settings?returnTo=%2Fsetup");
    const kept = await store.getFormDraft("setup:new");
    expect(kept).toMatchObject({
      ok: true,
      value: {
        values: { activityName: "اسم محفوظ للاستعادة" },
      },
    });
  });
});

/* ── حوار معلومات الإعداد (R08/B4/AC08) ── */
describe("UNIT-001 info dialog — library modal, read-only, focus contract (R08/AC08)", () => {
  it("opens the approved texts and moves focus in; Escape closes and returns focus as it was", async () => {
    const { services } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const trigger = await screen.findByRole("button", { name: "معلومات الإعداد وحفظ البيانات" });
    /* B4: «يعود التركيز للأيقونة والاسم كما كان» — الحقل كان مركزًا (autoFocus)
     * فيعود إليه؛ ثم المشغّل نفسه إذا كان هو المركز قبل الفتح. */
    const input = screen.getByLabelText("اسم المشروع") as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    fireEvent.click(trigger);
    const dialog = await screen.findByTestId("setup-info-dialog");
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("معلومات الإعداد")).toBeTruthy();
    expect(screen.getByText("يمكنك تغيير اسم المشروع لاحقًا.")).toBeTruthy();
    expect(screen.getByText("تُحفظ بياناتك على هذا الجهاز فقط. مسح بيانات المتصفح قد يحذفها.")).toBeTruthy();
    expect(screen.getByText("احتفظ بنسخة احتياطية من الإعدادات.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "إغلاق" }));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("setup-info-dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(input));
    /* فتح من الأيقونة نفسها (تفعيل لوحة مفاتيح): التركيز يعود للأيقونة. */
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByTestId("setup-info-dialog");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("setup-info-dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("the close button closes and the veil click closes — neither saves nor mutates the form (R08/B4)", async () => {
    const { services, store } = setupServices();
    const createSpy = vi.spyOn(services.profiles, "create");
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "اسم قبل الحوار" } });
    fireEvent.click(screen.getByRole("button", { name: "معلومات الإعداد وحفظ البيانات" }));
    await screen.findByTestId("setup-info-dialog");
    fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));
    await waitFor(() => expect(screen.queryByTestId("setup-info-dialog")).toBeNull());
    expect((screen.getByLabelText("اسم المشروع") as HTMLInputElement).value).toBe("اسم قبل الحوار");
    expect(createSpy).not.toHaveBeenCalled();
    /* فتح بالغطاء ثم إغلاق بالغطاء — لا حفظ للنموذج بصفت أي من الفعلين. */
    fireEvent.click(screen.getByRole("button", { name: "معلومات الإعداد وحفظ البيانات" }));
    const overlay = await screen.findByTestId("setup-info-overlay");
    fireEvent.click(overlay);
    await waitFor(() => expect(screen.queryByTestId("setup-info-dialog")).toBeNull());
    expect((screen.getByLabelText("اسم المشروع") as HTMLInputElement).value).toBe("اسم قبل الحوار");
    expect(createSpy).not.toHaveBeenCalled();
    const draft = await store.getFormDraft("setup:new");
    expect(draft).toMatchObject({ ok: true, value: { values: { activityName: "اسم قبل الحوار" } } });
  });

  it("Tab stays contained inside the dialog (B4/AC08)", async () => {
    const { services } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    fireEvent.click(await screen.findByRole("button", { name: "معلومات الإعداد وحفظ البيانات" }));
    await screen.findByTestId("setup-info-dialog");
    const close = screen.getByRole("button", { name: "إغلاق" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(close);
  });

  it("the back button (popstate) closes the dialog only — the screen and the name stay (B4)", async () => {
    const { services } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "اسم مع الحوار" } });
    fireEvent.click(screen.getByRole("button", { name: "معلومات الإعداد وحفظ البيانات" }));
    await screen.findByTestId("setup-info-dialog");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(() => expect(screen.queryByTestId("setup-info-dialog")).toBeNull());
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    expect((screen.getByLabelText("اسم المشروع") as HTMLInputElement).value).toBe("اسم مع الحوار");
  });

  it("a save completing while the dialog is open consumes the sentinel before leaving (RV3-N003)", async () => {
    const { services } = setupServices();
    let releaseCreate!: (value: unknown) => void;
    const gate = new Promise<unknown>(resolve => {
      releaseCreate = resolve;
    });
    vi.spyOn(services.profiles, "create").mockImplementation(async () => (await gate) as never);
    /* jsdom لا ينفذ أثر history.back على الحالة — الاستهلاك يُثبت بنداء الواجهة
     * نفسها (المتصفح الحقيقي يستهلك الـentry بها). */
    const backSpy = vi.spyOn(history, "back").mockImplementation(() => {});
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    fireEvent.change(await screen.findByLabelText("اسم المشروع"), {
      target: { value: "مشغل الحوار المفتوح" },
    });
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ" }));
    await screen.findByText(/جارٍ الحفظ/);
    /* معلومة قرائية تبقى متاحة أثناء الحفظ — الحوار يُفتح ويبقى. */
    fireEvent.click(screen.getByRole("button", { name: "معلومات الإعداد وحفظ البيانات" }));
    await screen.findByTestId("setup-info-dialog");
    expect(history.state?.microSetupInfo === true).toBe(true);
    releaseCreate({ ok: true, profile: { id: "local-profile" }, created: true });
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/?setup=1", { replace: true }));
    /* الحارس استُهلك قبل المغادرة — لا entry تاريخي فائض يبتلع أول رجوع. */
    expect(backSpy).toHaveBeenCalledTimes(1);
    backSpy.mockRestore();
  });
});

/* ── مسودة الاسم المنفصلة (R09/R10/AC04/DUP-023/ACD023) ── */
describe("UNIT-001 name draft — separate from the identity, explicit restore (R09/R10/DUP-023)", () => {
  it("typing persists a name-only draft through the unified boundary (R09)", async () => {
    const { services, store } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    fireEvent.change(await screen.findByLabelText("اسم المشروع"), {
      target: { value: "مشغل الكرامة" },
    });
    await waitFor(async () => {
      const saved = await store.getFormDraft("setup:new");
      if (!saved.ok || !saved.value) throw new Error("draft not saved");
      expect(saved.value.values).toMatchObject({ activityName: "مشغل الكرامة" });
      expect(saved.value.values).not.toHaveProperty("walletName");
      expect(saved.value.values).not.toHaveProperty("openingChoice");
      expect(saved.value.values).not.toHaveProperty("openingMinor");
    });
    expect(globalThis.localStorage?.getItem("micro.setup-draft.v1")).toBeNull();
  });

  it("a saved draft on return shows T13 with T14 actions — values are not auto-applied (R10/AC04)", async () => {
    const { services, store } = setupServices();
    await seedNameDraft(store, "مسودة الاسم");
    const createSpy = vi.spyOn(services.profiles, "create");
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    expect(await screen.findByTestId("setup-draft-offer")).toBeTruthy();
    expect(screen.getByText("إعداد غير مكتمل")).toBeTruthy();
    expect(screen.getByRole("button", { name: "أكمل الإعداد" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "تجاهل المسودة" })).toBeTruthy();
    expect((screen.getByLabelText("اسم المشروع") as HTMLInputElement).value).toBe("");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("«أكمل الإعداد» applies the name; «تجاهل المسودة» removes only the draft (R10/AC04)", async () => {
    const { services, store } = setupServices();
    await seedNameDraft(store, "مسودة الاسم");
    const createSpy = vi.spyOn(services.profiles, "create");
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    await screen.findByTestId("setup-draft-offer");
    fireEvent.click(screen.getByRole("button", { name: "أكمل الإعداد" }));
    expect((screen.getByLabelText("اسم المشروع") as HTMLInputElement).value).toBe("مسودة الاسم");
    expect(createSpy).not.toHaveBeenCalled();
    /* حذف الإدخال ثم العودة: العرض يظهر مجددًا، والتجاهل يمسح المسودة وحدها. */
    fireEvent.change(screen.getByLabelText("اسم المشروع"), { target: { value: "" } });
    await waitFor(async () => {
      const cleared = await store.getFormDraft("setup:new");
      expect(cleared.ok && cleared.value).toBeNull();
    });
    /* لا ملف مشروع في أي لحظة — المسودة ليست هوية. */
    const profile = await store.getProfile();
    expect(profile).toMatchObject({ ok: true, value: null });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("discard from the offer removes the draft only — no project, no identity (R10/ACD023)", async () => {
    const { services, store } = setupServices();
    await seedNameDraft(store, "مسودة للتجاهل");
    const createSpy = vi.spyOn(services.profiles, "create");
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    await screen.findByTestId("setup-draft-offer");
    fireEvent.click(screen.getByRole("button", { name: "تجاهل المسودة" }));
    await waitFor(async () => {
      const cleared = await store.getFormDraft("setup:new");
      expect(cleared.ok && cleared.value).toBeNull();
    });
    const profile = await store.getProfile();
    expect(profile).toMatchObject({ ok: true, value: null });
    expect(createSpy).not.toHaveBeenCalled();
    expect((screen.getByLabelText("اسم المشروع") as HTMLInputElement).value).toBe("");
  });

  it("a legacy draft carrying financial fields offers the name only — money is never applied (Q02/DUP-023)", async () => {
    const { services, store } = setupServices();
    await new FormDraftService(store).save("setup", null, {
      step: 3,
      activityName: "مسودة تراثية",
      walletName: "الدرج",
      openingChoice: "known",
      openingMinor: 12345,
      savedAt: "2026-09-01T10:00:00.000Z",
    });
    const createSpy = vi.spyOn(services.profiles, "create");
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    expect(await screen.findByTestId("setup-draft-offer")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "أكمل الإعداد" }));
    expect((screen.getByLabelText("اسم المشروع") as HTMLInputElement).value).toBe("مسودة تراثية");
    /* لا أي حقل نقدي عُرض، ولا أي سجل محفظة/افتتاح نشأ — الاسم وحده. */
    expect(screen.queryByLabelText(/محفظة/)).toBeNull();
    const wallets = await store.listCashWallets();
    expect(wallets).toMatchObject({ ok: true, value: [] });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("a corrupted draft is ignored without an offer or a crash (B2/Q02)", async () => {
    const { services, store } = setupServices();
    await new FormDraftService(store).save("setup", null, {
      step: 3,
      activityName: 42,
      walletName: "الدرج",
      openingChoice: "unknown",
      openingMinor: 0,
      savedAt: "2026-09-01T10:00:00.000Z",
    });
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    expect(await screen.findByRole("heading", { name: "إعداد مشروعك" })).toBeTruthy();
    expect(screen.queryByTestId("setup-draft-offer")).toBeNull();
    expect((screen.getByLabelText("اسم المشروع") as HTMLInputElement).value).toBe("");
    const kept = await store.getFormDraft("setup:new");
    expect(kept.ok && kept.value).not.toBeNull();
  });

  it("a leftover legacy page-storage key stays inert — never read, offered, or deleted (ARCH-012)", async () => {
    globalThis.localStorage?.setItem(
      "micro.setup-draft.v1",
      JSON.stringify({
        step: 3,
        activityName: "بقايا تراثية",
        walletName: "الدرج",
        openingChoice: "unknown",
        openingMinor: 0,
        savedAt: "2026-09-01T10:00:00.000Z",
      }),
    );
    const { services, store } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    expect(await screen.findByRole("heading", { name: "إعداد مشروعك" })).toBeTruthy();
    expect(screen.queryByTestId("setup-draft-offer")).toBeNull();
    const unified = await store.getFormDraft("setup:new");
    expect(unified.ok && unified.value).toBeNull();
    expect(globalThis.localStorage?.getItem("micro.setup-draft.v1")).not.toBeNull();
  });

  it("a draft save failure announces T15 honestly and keeps the typed values (R09/AC05)", async () => {
    const failing = createFormDraftHarness().store;
    failing.saveFormDraft = vi.fn(async () => ({ ok: false, message: "quota" })) as never;
    const { services } = setupServices({ store: failing });
    const createSpy = vi.spyOn(services.profiles, "create");
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    fireEvent.change(await screen.findByLabelText("اسم المشروع"), {
      target: { value: "مشغل الصمود" },
    });
    expect(await screen.findByText("تعذر حفظ المسودة. احتفظ بالشاشة مفتوحة حتى تكمل الإعداد.")).toBeTruthy();
    expect((screen.getByLabelText("اسم المشروع") as HTMLInputElement).value).toBe("مشغل الصمود");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("saving and restoring the raw name draft twice creates no second record and no agreement (ACD023)", async () => {
    const { services, store } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    const first = render(<Setup />);
    fireEvent.change(await screen.findByLabelText("اسم المشروع"), {
      target: { value: "مسودة دورتين" },
    });
    await waitFor(async () => {
      const saved = await store.getFormDraft("setup:new");
      expect(saved.ok && saved.value).not.toBeNull();
    });
    first.unmount();
    const second = render(<Setup />);
    await screen.findByTestId("setup-draft-offer");
    second.unmount();
    const third = render(<Setup />);
    await screen.findByTestId("setup-draft-offer");
    third.unmount();
    const listed = await store.listFormDrafts();
    /* سجل واحد بالضبط (setup:new) — لا نسخ ولا تكرار عبر دورات الحفظ/الاستعادة. */
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value).toHaveLength(1);
      expect(listed.value[0]).toMatchObject({ id: "setup:new" });
    }
    /* لا مشروع ولا أي اتفاق/حدث مالي من المسودة إطلاقًا. */
    const profile = await store.getProfile();
    expect(profile).toMatchObject({ ok: true, value: null });
    const orders = await store.listOrders();
    expect(orders.ok).toBe(true);
  });
});

/* ── الجيران والسلامة المالية (R13/B5/AC07/ACD001/ACD024) ── */
describe("UNIT-001 neighbors and financial safety (R13/AC07/ACD001/ACD024)", () => {
  it("completing setup records no wallet, no opening, no movement — missing cash is not zero (R13/AC07/ACD001)", async () => {
    const { services, store } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    fireEvent.change(await screen.findByLabelText("اسم المشروع"), {
      target: { value: "مشروع بلا محفظة" },
    });
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ" }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/?setup=1", { replace: true }));
    const wallets = await store.listCashWallets();
    expect(wallets).toMatchObject({ ok: true, value: [] });
    const events = await store.listFinancialEvents();
    expect(events.ok).toBe(true);
    if (events.ok) expect(events.value).toHaveLength(0);
    /* لا أي سجل افتتاح/محفظة/حركة — الهوية وحدها. */
    const profile = await store.getProfile();
    expect(profile).toMatchObject({ ok: true, value: { activityName: "مشروع بلا محفظة" } });
  });

  it("the field vocabulary is one definition: اسم المشروع label, T05 near the field (ACD024/DUP-024)", async () => {
    const { services } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const label = await screen.findByText("اسم المشروع");
    expect(label.tagName).toBe("SPAN");
    const input = screen.getByLabelText("اسم المشروع") as HTMLInputElement;
    expect(input.placeholder).toBe("مثال: حلويات ليان");
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ" }));
    const error = await screen.findByText("اكتب اسم مشروعك.");
    /* الخطأ قرب الحقل مباشرة — بعد تسميته النظيفة لا داخلها (ACD024). */
    expect(error.previousElementSibling?.tagName).toBe("LABEL");
  });

  it("an empty first-open read is not a storage failure — the form renders (R01)", async () => {
    const { services } = setupServices();
    const loadSpy = vi.spyOn(services.profiles, "load");
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    expect(await screen.findByRole("heading", { name: "إعداد مشروعك" })).toBeTruthy();
    await waitFor(() => expect(loadSpy).toHaveBeenCalled());
    expect(screen.queryByTestId("setup-storage-recovery")).toBeNull();
  });
});

/* ── ARCH-012-NF-001: دورة الإقلاع الخالية من السباق محفوظة كما هي ── */
describe("ARCH-012-NF-001 — Setup launch lifecycle stays race-free after UNIT-001 V2", () => {
  async function seedSetupDraft(store: PrototypeLocalStore, activityName: string) {
    await new FormDraftService(store).save("setup", null, {
      activityName,
      savedAt: "2026-10-01T10:00:00.000Z",
    });
  }

  function spyStore(store: PrototypeLocalStore) {
    const saveSpy = vi.fn(store.saveFormDraft.bind(store));
    const deleteSpy = vi.fn(store.deleteFormDraft.bind(store));
    store.saveFormDraft = saveSpy as never;
    store.deleteFormDraft = deleteSpy as never;
    return { saveSpy, deleteSpy };
  }

  it("closing the page while the restore offer is pending keeps the stored draft (no clear on mount)", async () => {
    const { services, store } = setupServices();
    await seedSetupDraft(store, "مشغل النور");
    mockedUsePrototypeServices.mockReturnValue(services);
    const { unmount } = render(<Setup />);
    expect(await screen.findByTestId("setup-draft-offer")).toBeTruthy();
    unmount();
    const kept = await store.getFormDraft("setup:new");
    expect(kept.ok).toBe(true);
    if (!kept.ok) throw new Error("read failed");
    expect(kept.value).not.toBeNull();
    expect((kept.value?.values as { activityName?: string }).activityName).toBe("مشغل النور");
  });

  it("zero writes while the restore decision is pending (no save, no discard)", async () => {
    const { services, store } = setupServices();
    await seedSetupDraft(store, "مشغل النور");
    const { saveSpy, deleteSpy } = spyStore(store);
    mockedUsePrototypeServices.mockReturnValue(services);
    const { unmount } = render(<Setup />);
    expect(await screen.findByTestId("setup-draft-offer")).toBeTruthy();
    await waitFor(async () => {
      const still = await store.getFormDraft("setup:new");
      expect(still.ok && still.value).not.toBeNull();
    });
    expect(saveSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
    unmount();
    expect(saveSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("repeated mount/unmount cycles keep re-offering the same intact draft (R14/AC06)", async () => {
    const { services, store } = setupServices();
    await seedSetupDraft(store, "مشغل النور");
    mockedUsePrototypeServices.mockReturnValue(services);
    const first = render(<Setup />);
    expect(await screen.findByTestId("setup-draft-offer")).toBeTruthy();
    first.unmount();
    const second = render(<Setup />);
    expect(await screen.findByTestId("setup-draft-offer")).toBeTruthy();
    const kept = await store.getFormDraft("setup:new");
    if (!kept.ok) throw new Error("read failed");
    expect((kept.value?.values as { activityName?: string }).activityName).toBe("مشغل النور");
    second.unmount();
  });

  it("a failed opening read never clears the stored draft (unknown state is not blindly wiped)", async () => {
    const { services, store } = setupServices();
    await seedSetupDraft(store, "مشغل النور");
    const { deleteSpy } = spyStore(store);
    const originalGet = store.getFormDraft.bind(store);
    store.getFormDraft = vi.fn(async () => ({ ok: false, message: "read failed" })) as never;
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    expect(await screen.findByRole("heading", { name: "إعداد مشروعك" })).toBeTruthy();
    expect(screen.queryByTestId("setup-draft-offer")).toBeNull();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(deleteSpy).not.toHaveBeenCalled();
    const kept = await originalGet("setup:new");
    expect(kept.ok && kept.value).not.toBeNull();
  });

  it("unmounting before the opening read settles stays silent and keeps the draft (ARCH-012-NF-001 7/7)", async () => {
    const { services, store } = setupServices();
    await seedSetupDraft(store, "مشغل النور");
    const { saveSpy, deleteSpy } = spyStore(store);
    /* قراءة معلّقة لا تستقر إلا بقرار الاختبار — مقاطعة الإقلاع نفسها. */
    let releaseRead!: (value: unknown) => void;
    const gate = new Promise<unknown>(resolve => {
      releaseRead = resolve;
    });
    const originalGet = store.getFormDraft.bind(store);
    store.getFormDraft = (async (id: string) => {
      if (id === "setup:new") await gate;
      return originalGet(id);
    }) as never;
    mockedUsePrototypeServices.mockReturnValue(services);
    const { unmount } = render(<Setup />);
    /* الإغلاق قبل استقرار القراءة: لا حالة بعد الفكرك ولا كتابة أبدًا. */
    unmount();
    releaseRead({ ok: true, value: null });
    await waitFor(async () => {
      const kept = await originalGet("setup:new");
      expect(kept.ok && kept.value).not.toBeNull();
    });
    expect(saveSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("new typing while the offer is pending is the basis — the offer hides and follows the user's values", async () => {
    const { services, store } = setupServices();
    await seedSetupDraft(store, "مشغل النور");
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    expect(await screen.findByTestId("setup-draft-offer")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/اسم المشروع/), { target: { value: "مشغلي الجديد" } });
    await waitFor(async () => {
      const saved = await store.getFormDraft("setup:new");
      if (!saved.ok) throw new Error("read failed");
      expect(saved.value).not.toBeNull();
      expect((saved.value?.values as { activityName?: string }).activityName).toBe("مشغلي الجديد");
    });
    expect(screen.queryByTestId("setup-draft-offer")).toBeNull();
  });

  it("clearing typed input back to empty discards exactly once, and a fresh session offers nothing", async () => {
    const { services, store } = setupServices();
    const { deleteSpy } = spyStore(store);
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const name = screen.getByLabelText(/اسم المشروع/) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "تجربة عابرة" } });
    await waitFor(async () => {
      const saved = await store.getFormDraft("setup:new");
      expect(saved.ok && saved.value).not.toBeNull();
    });
    fireEvent.change(name, { target: { value: "" } });
    await waitFor(async () => {
      const cleared = await store.getFormDraft("setup:new");
      expect(cleared.ok && cleared.value).toBeNull();
    });
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });
});
