/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
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

/** مخزن حقيقي لكل اختبار — التحقق بإعادة القراءة لا بجس النبض فقط. */
function draftServices(options: { store?: PrototypeLocalStore } = {}) {
  const store = options.store ?? createFormDraftHarness().store;
  return {
    services: {
      profiles: { save: vi.fn().mockResolvedValue({ ok: true, profile: { id: "p" } }) },
      cashContinuity: { openWallet: vi.fn().mockResolvedValue({ ok: true, value: {} }) },
      notifyDataChanged: vi.fn(),
      formDrafts: new FormDraftService(store),
    } as unknown as ReturnType<typeof usePrototypeServices>,
    store,
  };
}

/* F-002 (انحدار): كان تخطّي المحفظة يعرض سؤال الموقف الافتتاحي ثم يهمل جوابه عند
 * الحفظ. الحارس هنا: التخطّي يحفظ المشروع مباشرة، ولا يُسأل سؤال يُهمل جوابه أبدًا. */
describe("Setup wallet-skip path never asks and discards (F-002 regression)", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    wouterMocks.navigate.mockReset();
  });

  it("skipping the wallet saves the profile directly and never shows the opening-position step", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, profile: { id: "profile-1" } });
    const openWallet = vi.fn();
    const notifyDataChanged = vi.fn();
    mockedUsePrototypeServices.mockReturnValue({
      profiles: { save },
      cashContinuity: { openWallet },
      notifyDataChanged,
      formDrafts: new FormDraftService(createFormDraftHarness().store),
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(<Setup />);

    fireEvent.change(screen.getByLabelText("اسم المشروع"), { target: { value: "مشغل ليان" } });
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));

    const skipButton = await screen.findByRole("button", { name: /تخطَّ المحفظة الآن/ });
    fireEvent.click(skipButton);

    await waitFor(() => expect(save).toHaveBeenCalledWith("مشغل ليان"));
    /* SET-002 (2026-09-16): البداية السريعة — الإتمام يفتح مشروعي الآن
   مباشرة بلافتة نجاح؛ صفحة الأساس بقيت اختيارية من الرئيسية. */
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/?setup=1", { replace: true }));
    expect(openWallet).not.toHaveBeenCalled();
    expect(screen.queryByText("شو وضع الدرج هلق؟")).toBeNull();
  });

  it("keeping the wallet still asks the opening question and persists the wallet with it", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, profile: { id: "profile-2" } });
    const openWallet = vi.fn().mockResolvedValue({ ok: true, value: {} });
    const notifyDataChanged = vi.fn();
    mockedUsePrototypeServices.mockReturnValue({
      profiles: { save },
      cashContinuity: { openWallet },
      notifyDataChanged,
      formDrafts: new FormDraftService(createFormDraftHarness().store),
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(<Setup />);

    fireEvent.change(screen.getByLabelText("اسم المشروع"), { target: { value: "مشغل ليان" } });
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    await screen.findByRole("button", { name: /تخطَّ المحفظة الآن/ });
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));

    expect(await screen.findByText("شو وضع الدرج هلق؟")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("الموقف الافتتاحي"), { target: { value: "zero" } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ في مشروعي الآن" }));

    await waitFor(() =>
      expect(openWallet).toHaveBeenCalledWith(
        expect.objectContaining({ name: "الدرج", openingMinor: 0, openingStatus: "known" }),
      ),
    );
    /* SET-002 (2026-09-16): البداية السريعة — الإتمام يفتح مشروعي الآن
   مباشرة بلافتة نجاح؛ صفحة الأساس بقيت اختيارية من الرئيسية. */
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/?setup=1", { replace: true }));
  });
});

/* المجموعة ١ (Scope F) + المجموعة ٥ (التحصين الكامل): مسودة الإعداد داخل الحد
 * الموحّد — الاستعادة فعل صريح من المالك (لا تطبيق صامت عند الفتح)، ولا حدث
 * مالي قبل التأكيد.
 * R11 ARCH-012 (2026-10-15): ترحيل مفتاح الصفحة القديم تقاعد قبل الإطلاق —
 * البذر هنا من الحد الموحّد مباشرة، والمفتاح التراثي المتروك يختبر خموله
 * (لا قراءة ولا عرض ولا حذف تخريبي). */
describe("Setup progressive draft persistence (group 1 scope F, group 5 unified boundary)", () => {
  afterEach(() => {
    cleanup();
    globalThis.localStorage?.clear();
  });

  it("offers an explicit restore for a saved draft from the unified boundary and applies it only when accepted", async () => {
    const { services, store } = draftServices();
    await new FormDraftService(store).save("setup", null, {
      step: 3,
      activityName: "مشغل ليان",
      walletName: "الدرج",
      openingChoice: "unknown",
      openingMinor: 0,
      savedAt: "2026-09-01T10:00:00.000Z",
    });
    const profilesSave = services.profiles.save as ReturnType<typeof vi.fn>;
    const openWallet = services.cashContinuity.openWallet as ReturnType<typeof vi.fn>;
    mockedUsePrototypeServices.mockReturnValue(services);

    render(<Setup />);

    /* العرض صريح — القيم لم تُطبّق بعد ولا سجل مالي. */
    expect(await screen.findByText(/عندك مسودة إعداد من آخر مرة/)).toBeTruthy();
    expect((screen.getByLabelText(/اسم المشروع/) as HTMLInputElement).value).toBe("");
    expect(profilesSave).not.toHaveBeenCalled();
    expect(openWallet).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "استعدها وأكمل" }));
    /* التطبيق بعد القبول: الخطوة ٣ بقيمها المحفوظة. */
    expect(await screen.findByText("شو وضع الدرج هلق؟")).toBeTruthy();
    expect((screen.getByLabelText(/الموقف الافتتاحي/) as HTMLSelectElement).value).toBe("unknown");
    expect(profilesSave).not.toHaveBeenCalled();
  });

  it("the offer discard clears the draft and starts pristine", async () => {
    const { services, store } = draftServices();
    await new FormDraftService(store).save("setup", null, {
      step: 2,
      activityName: "مشغل قديم",
      walletName: "الدرج",
      openingChoice: null,
      openingMinor: 0,
      savedAt: "2026-09-01T10:00:00.000Z",
    });
    mockedUsePrototypeServices.mockReturnValue(services);

    render(<Setup />);
    expect(await screen.findByText(/عندك مسودة إعداد من آخر مرة/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ابدأ الإعداد من جديد" }));

    await waitFor(async () => {
      const cleared = await store.getFormDraft("setup:new");
      expect(cleared.ok && cleared.value).toBeNull();
    });
    expect((screen.getByLabelText(/اسم المشروع/) as HTMLInputElement).value).toBe("");
    expect(screen.getByText("ما اسم مشروعك؟")).toBeTruthy();
  });

  it("a leftover legacy page-storage key is inert — never read, offered, or deleted (ARCH-012)", async () => {
    /* R11 ARCH-012 (2026-10-15): المفتاح التراثي المتروك في متصفح مالك
     * سابق لا يُقرأ ولا يُعرض ولا يُحذف — لا مسح تخزين تخريبي؛ السلوك
     * الحي من الحد الموحّد وحده. */
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
    const { services, store } = draftServices();
    mockedUsePrototypeServices.mockReturnValue(services);

    render(<Setup />);

    expect(await screen.findByText("ما اسم مشروعك؟")).toBeTruthy();
    expect(screen.queryByText(/عندك مسودة إعداد من آخر مرة/)).toBeNull();
    expect((screen.getByLabelText(/اسم المشروع/) as HTMLInputElement).value).toBe("");
    /* لا تحويل صامت — الحد الموحّد بقي فارغًا والمفتاح في مكانه خاملًا. */
    const notMigrated = await store.getFormDraft("setup:new");
    expect(notMigrated.ok && notMigrated.value).toBeNull();
    expect(globalThis.localStorage?.getItem("micro.setup-draft.v1")).not.toBeNull();
  });

  it("corrupted draft values are ignored without breaking setup and are never converted", async () => {
    const { services, store } = draftServices();
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

    expect(await screen.findByText("ما اسم مشروعك؟")).toBeTruthy();
    expect(screen.queryByText(/عندك مسودة إعداد من آخر مرة/)).toBeNull();
    expect((screen.getByLabelText(/اسم المشروع/) as HTMLInputElement).value).toBe("");
    /* القيم غير القابلة للإكراه تُرفض بلا عرض ولا انفجار ولا تحويل صامت —
     * لو كان الإكراه ناجحًا لظهر العرض (قراءة الإقلاع تسبق مسح النموذج
     * الفارغ في النافذة نفسها). ملاحظة سلوك قائمة (ARCH-012-NF-001،
     * مسجلة في التقرير خارج نطاق الموجة): كتلة المسح عند الإقلاع تمسح
     * سجل المسودة للنموذج الفارغ حتى مع عرض الاستعادة — سلوك main الحالي
     * قبل ARCH-012 وبعده. */
  });

  it("the unknown opening stays unknown — never saved as a zero wallet", async () => {
    const openWallet = vi.fn().mockResolvedValue({ ok: true, value: {} });
    mockedUsePrototypeServices.mockReturnValue({
      profiles: { save: vi.fn().mockResolvedValue({ ok: true, profile: { id: "p" } }) },
      cashContinuity: { openWallet },
      notifyDataChanged: vi.fn(),
      formDrafts: new FormDraftService(createFormDraftHarness().store),
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(<Setup />);
    fireEvent.change(screen.getByLabelText(/اسم المشروع/), { target: { value: "مشغل ليان" } });
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    await screen.findByRole("button", { name: /تخطَّ المحفظة الآن/ });
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    await screen.findByText("شو وضع الدرج هلق؟");
    fireEvent.change(screen.getByLabelText(/الموقف الافتتاحي/), { target: { value: "unknown" } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ في مشروعي الآن" }));

    await waitFor(() =>
      expect(openWallet).toHaveBeenCalledWith(
        expect.objectContaining({ openingMinor: 0, openingStatus: "unknown" }),
      ),
    );
    /* الإشعار نفسه يشرح الحقيقة: مجهول معلن لا صفر. */
    expect(
      await screen.findByText(
        /ستبقى المحفظة «غير محددة» — تُظهر طريقًا لإدخال رصيد موثق لاحقًا، ولا تُعرض صفرًا أبدًا./,
      ),
    ).toBeTruthy();
  });

  it("typing persists the draft through the unified boundary — not page storage", async () => {
    const { services, store } = draftServices();
    mockedUsePrototypeServices.mockReturnValue(services);

    render(<Setup />);
    fireEvent.change(screen.getByLabelText(/اسم المشروع/), { target: { value: "مشغل الكرامة" } });

    await waitFor(async () => {
      const saved = await store.getFormDraft("setup:new");
      if (!saved.ok) throw new Error("read failed");
      expect(saved.value).not.toBeNull();
      expect((saved.value?.values as { activityName?: string }).activityName).toBe("مشغل الكرامة");
    });
    /* لا يُنشأ مفتاح مسودة في تخزين الصفحة أبدًا — الحد وحده يكتب
     * (ARCH-012: لا عودة لمسودات الصفحة المباشرة). */
    expect(globalThis.localStorage?.getItem("micro.setup-draft.v1")).toBeNull();
  });

  it("a draft save failure is announced honestly and keeps the typed values", async () => {
    /* مخزن يفشل في الكتابة فقط — القيم في الذاكرة والنص صادق بلا أي أثر مالي. */
    const failing = createFormDraftHarness().store;
    const originalSave = failing.saveFormDraft.bind(failing);
    failing.saveFormDraft = vi.fn(async () => ({ ok: false, message: "quota" })) as never;
    void originalSave;
    const { services } = draftServices({ store: failing });
    mockedUsePrototypeServices.mockReturnValue(services);

    render(<Setup />);
    fireEvent.change(screen.getByLabelText(/اسم المشروع/), { target: { value: "مشغل الصمود" } });

    expect(await screen.findByText(/تعذر حفظ مسودة الإعداد محليًا/)).toBeTruthy();
    expect((screen.getByLabelText(/اسم المشروع/) as HTMLInputElement).value).toBe("مشغل الصمود");
    const profilesSave = services.profiles.save as ReturnType<typeof vi.fn>;
    expect(profilesSave).not.toHaveBeenCalled();
  });

  it("successful completion clears the draft so it never returns as data", async () => {
    const { services, store } = draftServices();
    await new FormDraftService(store).save("setup", null, {
      step: 3,
      activityName: "مشغل ليان",
      walletName: "الدرج",
      openingChoice: "zero",
      openingMinor: 0,
      savedAt: "2026-09-01T10:00:00.000Z",
    });
    mockedUsePrototypeServices.mockReturnValue(services);

    render(<Setup />);
    await screen.findByText(/عندك مسودة إعداد من آخر مرة/);
    fireEvent.click(screen.getByRole("button", { name: "استعدها وأكمل" }));
    expect(await screen.findByText("شو وضع الدرج هلق؟")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ في مشروعي الآن" }));
    await waitFor(async () => {
      const cleared = await store.getFormDraft("setup:new");
      expect(cleared.ok && cleared.value).toBeNull();
    });
  });
});
