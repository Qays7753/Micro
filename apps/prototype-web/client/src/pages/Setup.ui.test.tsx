/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
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
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(<Setup />);

    fireEvent.change(screen.getByLabelText("اسم المشروع"), { target: { value: "مشغل ليان" } });
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));

    const skipButton = await screen.findByRole("button", { name: /تخطَّ المحفظة الآن/ });
    fireEvent.click(skipButton);

    await waitFor(() => expect(save).toHaveBeenCalledWith("مشغل ليان"));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/foundation", { replace: true }));
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
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(<Setup />);

    fireEvent.change(screen.getByLabelText("اسم المشروع"), { target: { value: "مشغل ليان" } });
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    await screen.findByRole("button", { name: /تخطَّ المحفظة الآن/ });
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));

    expect(await screen.findByText("شو وضع الدرج هلق؟")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("الموقف الافتتاحي"), { target: { value: "zero" } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ وافتح صفحة الأساس" }));

    await waitFor(() =>
      expect(openWallet).toHaveBeenCalledWith(
        expect.objectContaining({ name: "الدرج", openingMinor: 0, openingStatus: "known" }),
      ),
    );
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/foundation", { replace: true }));
  });
});

/* المجموعة ١ (Scope F — التدرج حتى أول فعل مفيد): مسودة الإعداد تُحفظ أثناء
 * الكتابة وتُستعاد بإشعار واضح عند العودة؛ الثلاث حالات الافتتاحية صادقة. */
describe("Setup progressive draft persistence (group 1 scope F)", () => {
  afterEach(() => {
    cleanup();
    globalThis.localStorage?.clear();
  });

  const draftServices = () => ({
    profiles: { save: vi.fn().mockResolvedValue({ ok: true, profile: { id: "p" } }) },
    cashContinuity: { openWallet: vi.fn().mockResolvedValue({ ok: true, value: {} }) },
    notifyDataChanged: vi.fn(),
  });

  it("restores a previously typed draft with a clear notice and the same values", async () => {
    globalThis.localStorage?.setItem(
      "micro.setup-draft.v1",
      JSON.stringify({
        step: 3,
        activityName: "مشغل ليان",
        walletName: "الدرج",
        openingChoice: "unknown",
        openingMinor: 0,
        savedAt: "2026-09-01T10:00:00.000Z",
      }),
    );
    mockedUsePrototypeServices.mockReturnValue(
      draftServices() as unknown as ReturnType<typeof usePrototypeServices>,
    );

    render(<Setup />);

    expect(await screen.findByText(/استعدنا مسودة إعدادك من آخر مرة/)).toBeTruthy();
    /* المسودة عند الخطوة ٣: يعود مباشرة إلى سؤال الموقف الافتتاحي بالقيمة المحفوظة. */
    expect(await screen.findByText("شو وضع الدرج هلق؟")).toBeTruthy();
    expect((screen.getByLabelText(/الموقف الافتتاحي/) as HTMLSelectElement).value).toBe("unknown");
  });

  it("corrupted draft data is ignored without breaking setup", async () => {
    globalThis.localStorage?.setItem("micro.setup-draft.v1", "{not-json");
    mockedUsePrototypeServices.mockReturnValue(
      draftServices() as unknown as ReturnType<typeof usePrototypeServices>,
    );

    render(<Setup />);

    expect(await screen.findByText("ما اسم مشروعك؟")).toBeTruthy();
    expect(screen.queryByText(/استعدنا مسودة/)).toBeNull();
    expect((screen.getByLabelText(/اسم المشروع/) as HTMLInputElement).value).toBe("");
  });

  it("the unknown opening stays unknown — never saved as a zero wallet", async () => {
    const openWallet = vi.fn().mockResolvedValue({ ok: true, value: {} });
    mockedUsePrototypeServices.mockReturnValue({
      profiles: { save: vi.fn().mockResolvedValue({ ok: true, profile: { id: "p" } }) },
      cashContinuity: { openWallet },
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(<Setup />);
    fireEvent.change(screen.getByLabelText(/اسم المشروع/), { target: { value: "مشغل ليان" } });
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    await screen.findByRole("button", { name: /تخطَّ المحفظة الآن/ });
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    await screen.findByText("شو وضع الدرج هلق؟");
    fireEvent.change(screen.getByLabelText(/الموقف الافتتاحي/), { target: { value: "unknown" } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ وافتح صفحة الأساس" }));

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

  it("successful completion clears the draft so it never returns as data", async () => {
    globalThis.localStorage?.setItem(
      "micro.setup-draft.v1",
      JSON.stringify({
        step: 3,
        activityName: "مشغل ليان",
        walletName: "الدرج",
        openingChoice: "zero",
        openingMinor: 0,
        savedAt: "2026-09-01T10:00:00.000Z",
      }),
    );
    mockedUsePrototypeServices.mockReturnValue(
      draftServices() as unknown as ReturnType<typeof usePrototypeServices>,
    );

    render(<Setup />);
    await screen.findByText("شو وضع الدرج هلق؟");
    fireEvent.click(screen.getByRole("button", { name: "احفظ وافتح صفحة الأساس" }));
    await waitFor(() => expect(globalThis.localStorage?.getItem("micro.setup-draft.v1")).toBeNull());
  });
});
