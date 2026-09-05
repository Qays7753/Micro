/** @vitest-environment jsdom */
/* ملف المالك (المجموعة ١ — Scope G): حالات العرض والتعديل والحماية والرجوع الآمن. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import Profile from "@/pages/Profile";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: "",
  location: "/profile",
}));

vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useSearch: () => wouterMocks.search,
  useParams: () => ({}),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

function owner(value: { ownerId: string; displayName: string | null; email: string | null }) {
  return {
    ok: true,
    value: {
      id: "local-owner-profile",
      provider: null,
      externalAccountId: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      ...value,
    },
  };
}

function mockServices(overrides: Record<string, unknown> = {}) {
  return {
    ownerProfile: {
      ensureLocal: vi
        .fn()
        .mockResolvedValue(owner({ ownerId: "owner-abc123", displayName: null, email: null })),
      read: vi.fn(),
      save: vi.fn().mockResolvedValue(owner({ ownerId: "owner-abc123", displayName: "ليان", email: null })),
    },
    profiles: {
      load: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          id: "local-profile",
          activityName: "مشغل ليان",
          currency: "JOD",
          activityType: "custom_craft",
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      }),
      save: vi
        .fn()
        .mockResolvedValue({ ok: true, profile: { id: "local-profile", activityName: "مشغل ليان" } }),
    },
    cashContinuity: {
      overview: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          wallets: [{ id: "w1", name: "الدرج", balanceMinor: 5000, entryCount: 1, openingUnknown: false }],
          totalWalletCashMinor: 5000,
          entryCount: 1,
          unknownOpeningCount: 0,
          truth: "",
        },
      }),
    },
    preferences: {
      readLastVerifiedExport: vi.fn().mockResolvedValue({ ok: true, exportedAt: null }),
    },
    dataVersion: 0,
    notifyDataChanged: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

describe("Profile — owner identity and project profile", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    wouterMocks.navigate.mockReset();
    wouterMocks.search = "";
    wouterMocks.location = "/profile";
  });

  it("يعرض الحقلين منفصلين وحالة الهوية المحلية وملاحظة مستقبلية هادئة غير تفاعلية", async () => {
    mockedUsePrototypeServices.mockReturnValue(
      mockServices({
        ownerProfile: {
          ensureLocal: vi
            .fn()
            .mockResolvedValue(owner({ ownerId: "owner-abc123", displayName: "ليان", email: null })),
          read: vi.fn(),
          save: vi.fn(),
        },
      }),
    );
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <Profile />
      </UnsavedChangesProvider>,
    );
    expect(await screen.findByText("هوية المالك")).toBeTruthy();
    expect(screen.getByText("ملف المشروع")).toBeTruthy();
    expect(screen.getByText("ليان")).toBeTruthy();
    expect(screen.getByText("محلي على هذا الجهاز")).toBeTruthy();
    expect(screen.getByText(/تسجيل الدخول والمزامنة ستتوفر لاحقًا/)).toBeTruthy();
    expect(screen.getByText("مشغل ليان")).toBeTruthy();
    expect(screen.getByText("الدرج")).toBeTruthy();
    /* لا زر دخول وهمي ولا Google في أي مكان. */
    expect(screen.queryByText(/Google/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /تسجيل الدخول/ })).toBeNull();
  });

  it("يملأ فارغًا اختياريًا بعبارة صادقة لا بقيمة وهمية", async () => {
    mockedUsePrototypeServices.mockReturnValue(mockServices());
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <Profile />
      </UnsavedChangesProvider>,
    );
    expect(await screen.findByText(/غير مكتوب بعد — اختياري/)).toBeTruthy();
    expect(screen.getByText("لا نسخة بعد")).toBeTruthy();
  });

  it("التعديل يحفظ الاسم والبريد واسم المشروع محليًا ويعود للعرض", async () => {
    const saveOwner = vi
      .fn()
      .mockResolvedValue(owner({ ownerId: "owner-abc123", displayName: "ليان خ", email: "layan@mail.com" }));
    const saveProfile = vi.fn().mockResolvedValue({ ok: true, profile: { id: "local-profile" } });
    const notify = vi.fn();
    mockedUsePrototypeServices.mockReturnValue(
      mockServices({
        ownerProfile: {
          ensureLocal: vi
            .fn()
            .mockResolvedValue(owner({ ownerId: "owner-abc123", displayName: null, email: null })),
          read: vi.fn(),
          save: saveOwner,
        },
        profiles: {
          load: vi.fn().mockResolvedValue({ ok: true, value: { activityName: "مشغل ليان" } }),
          save: saveProfile,
        },
        notifyDataChanged: notify,
      }),
    );
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <Profile />
      </UnsavedChangesProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "عدّل ملفك" }));
    fireEvent.change(screen.getByLabelText(/اسمك/), { target: { value: "ليان خ" } });
    fireEvent.change(screen.getByLabelText(/بريدك الإلكتروني/), { target: { value: "layan@mail.com" } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ ملفك" }));
    await waitFor(() =>
      expect(saveOwner).toHaveBeenCalledWith({ displayName: "ليان خ", email: "layan@mail.com" }),
    );
    await waitFor(() => expect(saveProfile).toHaveBeenCalledWith("مشغل ليان"));
    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(await screen.findByText(/حُفظ ملفك محليًا/)).toBeTruthy();
  });

  it("يرفض بريدًا معطوبًا برسالة عربية ولا يدّعي نجاحًا", async () => {
    const saveOwner = vi.fn().mockResolvedValue({
      ok: false,
      code: "validation_error",
      message: "البريد الإلكتروني اختياري؛ إن أدخلته فليكن بصيغة سليمة مثل name@mail.com.",
    });
    mockedUsePrototypeServices.mockReturnValue(
      mockServices({
        ownerProfile: {
          ensureLocal: vi
            .fn()
            .mockResolvedValue(owner({ ownerId: "owner-abc123", displayName: null, email: null })),
          read: vi.fn(),
          save: saveOwner,
        },
      }),
    );
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <Profile />
      </UnsavedChangesProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "عدّل ملفك" }));
    fireEvent.change(screen.getByLabelText(/بريدك الإلكتروني/), { target: { value: "ليس بريدًا" } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ ملفك" }));
    expect(await screen.findByText(/البريد الإلكتروني اختياري/)).toBeTruthy();
    /* لا نجاح معلنًا ولا حفظ للمشروع — الرفض عند خدمة المالك قبل أي كتابة أخرى. */
    expect(screen.queryByText(/حُفظ ملفك محليًا/)).toBeNull();
  });

  it("إلغاء التعديل يعيد الحقول لقيمها دون حفظ", async () => {
    const saveOwner = vi.fn();
    mockedUsePrototypeServices.mockReturnValue(
      mockServices({
        ownerProfile: {
          ensureLocal: vi
            .fn()
            .mockResolvedValue(owner({ ownerId: "owner-abc123", displayName: "ليان", email: null })),
          read: vi.fn(),
          save: saveOwner,
        },
      }),
    );
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <Profile />
      </UnsavedChangesProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "عدّل ملفك" }));
    fireEvent.change(screen.getByLabelText(/اسمك/), { target: { value: "اسم آخر" } });
    fireEvent.click(screen.getByRole("button", { name: "إلغاء التعديل" }));
    expect(await screen.findByText("ليان")).toBeTruthy();
    expect(saveOwner).not.toHaveBeenCalled();
  });

  it("زر الرجوع يعود للمصدر (?from) لا لهدف ثابت", async () => {
    wouterMocks.search = "?from=/settings";
    mockedUsePrototypeServices.mockReturnValue(mockServices());
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <Profile />
      </UnsavedChangesProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "رجوع" }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/settings"));
  });

  it("بلا مصدر: الرجوع للبديل القانوني (الرئيسية)", async () => {
    mockedUsePrototypeServices.mockReturnValue(mockServices());
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <Profile />
      </UnsavedChangesProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "رجوع" }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/"));
  });

  it("حالة الخطأ تعرض رسالة صادقة وزر إعادة محاولة", async () => {
    mockedUsePrototypeServices.mockReturnValue(
      mockServices({
        ownerProfile: {
          ensureLocal: vi
            .fn()
            .mockResolvedValue({ ok: false, code: "storage_error", message: "تعذر قراءة ملف المالك." }),
          read: vi.fn(),
          save: vi.fn(),
        },
      }),
    );
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <Profile />
      </UnsavedChangesProvider>,
    );
    expect(await screen.findByText("تعذر فتح ملفك")).toBeTruthy();
    expect(screen.getByRole("button", { name: "إعادة المحاولة" })).toBeTruthy();
  });

  it("رصيد افتتاحي غير محدد يظهر «غير محدد بعد» لا صفرًا", async () => {
    mockedUsePrototypeServices.mockReturnValue(
      mockServices({
        cashContinuity: {
          overview: vi.fn().mockResolvedValue({
            ok: true,
            value: {
              wallets: [{ id: "w1", name: "الدرج", balanceMinor: 0, entryCount: 0, openingUnknown: true }],
              totalWalletCashMinor: 0,
              entryCount: 0,
              unknownOpeningCount: 1,
              truth: "",
            },
          }),
        },
      }),
    );
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <Profile />
      </UnsavedChangesProvider>,
    );
    expect(await screen.findByText(/غير محدد بعد — رصيد لم يُوثَّق/)).toBeTruthy();
  });
});
