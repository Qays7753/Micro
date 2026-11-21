/** @vitest-environment jsdom */
/**
 * Post-Group 6 continuous completion (قرار ب/Q5 — G01): قسم «أدوارك» في ملف
 * الحساب — إلغاء المسودة الفوري، إزالة الدور المفعّل بتأكيد صريح، رفض
 * الحجز الجارئ بسببه الخادم، الحالة المُزالة الصادقة بلا زر عودة، ودور
 * صاحب المشروع بلا زر حذف (الحد غير معرّف — عند المالك).
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { useNetworkSession } from "@/app/useNetworkSession";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import Profile from "@/pages/Profile";
import { ApiError } from "@/application/network";

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

const sessionMocks = vi.hoisted(() => ({
  session: {
    authenticated: true as boolean,
    identity: { email: "roles@example.test", displayName: "صاحب الأدوار" } as
      { email: string; displayName: string } | undefined,
    workspaces: [] as
      | {
          id: string;
          displayName: string;
          role: string;
          capabilities: { market: boolean; delivery: boolean };
        }[]
      | undefined,
    vendor: null as { status: string; supplierProfileId: string } | null,
    driver: null as { status: string } | null,
  },
  loading: false,
  failed: false,
  refresh: vi.fn(),
}));

vi.mock("@/app/useNetworkSession", () => ({
  useNetworkSession: () => sessionMocks,
}));

const serviceMocks = vi.hoisted(() => ({
  fetchManageOnlineState: vi.fn(),
  fetchManageFamilies: vi.fn(),
  startManageLink: vi.fn(),
  confirmManageLink: vi.fn(),
  unlinkManage: vi.fn(),
  fetchDeviceSessions: vi.fn(),
  signOutAllDevices: vi.fn(),
  registerPushSubscription: vi.fn(),
  removePushSubscription: vi.fn(),
  cancelSupplierDraft: vi.fn(),
  cancelDriverDraft: vi.fn(),
  removeSupplierRole: vi.fn(),
  removeDriverRole: vi.fn(),
}));

vi.mock("@/application/network", async importOriginal => {
  const actual = await importOriginal<typeof import("@/application/network")>();
  return {
    ...actual,
    ApiError: actual.ApiError,
    fetchManageOnlineState: serviceMocks.fetchManageOnlineState,
    fetchManageFamilies: serviceMocks.fetchManageFamilies,
    startManageLink: serviceMocks.startManageLink,
    confirmManageLink: serviceMocks.confirmManageLink,
    unlinkManage: serviceMocks.unlinkManage,
    fetchDeviceSessions: serviceMocks.fetchDeviceSessions,
    signOutAllDevices: serviceMocks.signOutAllDevices,
    registerPushSubscription: serviceMocks.registerPushSubscription,
    removePushSubscription: serviceMocks.removePushSubscription,
    cancelSupplierDraft: serviceMocks.cancelSupplierDraft,
    cancelDriverDraft: serviceMocks.cancelDriverDraft,
    removeSupplierRole: serviceMocks.removeSupplierRole,
    removeDriverRole: serviceMocks.removeDriverRole,
  };
});

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

function mockServices() {
  return {
    ownerProfile: {
      ensureLocal: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          id: "local-owner-profile",
          provider: null,
          externalAccountId: null,
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
          ownerId: "owner-abc123",
          displayName: null,
          email: null,
        },
      }),
      read: vi.fn(),
      save: vi.fn(),
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
    },
    cashContinuity: {
      overview: vi.fn().mockResolvedValue({
        ok: true,
        value: { wallets: [], unknownOpeningCount: 0 },
      }),
    },
    preferences: {
      readLastVerifiedExport: vi.fn().mockResolvedValue({ ok: true, exportedAt: null }),
    },
    dataVersion: 1,
    notifyDataChanged: vi.fn(),
  };
}

beforeEach(() => {
  mockedUsePrototypeServices.mockReturnValue(
    mockServices() as unknown as ReturnType<typeof usePrototypeServices>,
  );
  sessionMocks.loading = false;
  sessionMocks.failed = false;
  sessionMocks.refresh.mockReset();
  sessionMocks.session = {
    authenticated: true,
    identity: { email: "roles@example.test", displayName: "صاحب الأدوار" },
    workspaces: [
      {
        id: "ws_roles",
        displayName: "مشروع الأدوار",
        role: "owner",
        capabilities: { market: true, delivery: true },
      },
    ],
    vendor: null,
    driver: null,
  };
  serviceMocks.fetchManageOnlineState.mockReset().mockResolvedValue({ configured: true, workspaces: [] });
  serviceMocks.fetchManageFamilies
    .mockReset()
    .mockResolvedValue({ configured: true, workspaces: [], families: [], totalRecords: 0 });
  serviceMocks.fetchDeviceSessions
    .mockReset()
    .mockResolvedValue([{ id: "s1", createdAt: Date.now(), expiresAt: Date.now() + 1000, current: true }]);
  serviceMocks.signOutAllDevices.mockReset();
  serviceMocks.cancelSupplierDraft.mockReset();
  serviceMocks.cancelDriverDraft.mockReset();
  serviceMocks.removeSupplierRole.mockReset();
  serviceMocks.removeDriverRole.mockReset();
});

afterEach(() => {
  cleanup();
});

function renderProfile() {
  return render(
    <UnsavedChangesProvider navigate={() => undefined}>
      <Profile />
    </UnsavedChangesProvider>,
  );
}

describe("Profile roles section (G01 — دورة الدور)", () => {
  it("shows the honest empty state for an account with no roles and no project", async () => {
    sessionMocks.session = {
      authenticated: true,
      identity: { email: "roles@example.test", displayName: "بلا أدوار" },
      workspaces: [],
      vendor: null,
      driver: null,
    };
    renderProfile();
    const section = await screen.findByTestId("account-roles");
    expect(section).toBeDefined();
    expect(section.textContent).toContain("لا أدوار بعد على حسابك");
  });

  it("an ACTIVE supplier removal asks for explicit confirmation, then calls the command and refreshes", async () => {
    sessionMocks.session.vendor = { status: "active", supplierProfileId: "sp1" };
    serviceMocks.removeSupplierRole.mockResolvedValue({ ok: true, removed: "supplier" });
    renderProfile();
    const removeButton = await screen.findByRole("button", { name: "إزالة دور المورد" });
    fireEvent.click(removeButton);
    const confirmBox = await screen.findByRole("alertdialog", { name: "تأكيد إزالة دور المورد" });
    expect(confirmBox.textContent).toContain("تخفي إعلاناتك فورًا وتؤرشفها");
    expect(confirmBox.textContent).toContain("لا يُحذف أي سجل");
    /* لا استدعاء قبل التأكيد الصريح */
    expect(serviceMocks.removeSupplierRole).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "أزل الدور" }));
    await waitFor(() => expect(serviceMocks.removeSupplierRole).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("أُزيل دور المورد — إعلاناتك مخفية ومؤرشفة.")).toBeDefined();
    expect(sessionMocks.refresh).toHaveBeenCalled();
  });

  it("a DRAFT supplier cancels immediately after the confirm (draft-only deletion)", async () => {
    sessionMocks.session.vendor = { status: "draft", supplierProfileId: "sp2" };
    serviceMocks.cancelSupplierDraft.mockResolvedValue({ ok: true, cancelled: "supplier_draft" });
    renderProfile();
    fireEvent.click(await screen.findByRole("button", { name: "إلغاء مسودة المورد" }));
    fireEvent.click(await screen.findByRole("button", { name: "ألغِ المسودة" }));
    await waitFor(() => expect(serviceMocks.cancelSupplierDraft).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("أُلغيت مسودة المورد.")).toBeDefined();
  });

  it("the ongoing-booking refusal shows the server's Arabic reason (no silent success)", async () => {
    sessionMocks.session.driver = { status: "approved" };
    serviceMocks.removeDriverRole.mockRejectedValue(
      new ApiError(409, {
        code: "conflict",
        message: "لا يمكن إزالة دور السائق الآن: لديك حجز جارٍ. أكمل الحجز أولًا.",
      }),
    );
    renderProfile();
    fireEvent.click(await screen.findByRole("button", { name: "إزالة دور السائق" }));
    fireEvent.click(await screen.findByRole("button", { name: "أزل الدور" }));
    await waitFor(() => expect(serviceMocks.removeDriverRole).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText("لا يمكن إزالة دور السائق الآن: لديك حجز جارٍ. أكمل الحجز أولًا."),
    ).toBeDefined();
  });

  it("a REMOVED role shows the honest note with NO revive button", async () => {
    sessionMocks.session.vendor = { status: "removed", supplierProfileId: "sp3" };
    sessionMocks.session.driver = { status: "removed" };
    renderProfile();
    const section = await screen.findByTestId("account-roles");
    expect(section.textContent).toContain("مُزال بطلبك");
    expect(section.textContent).toContain("إعادة الدور خطوة لاحقة عند المالك");
    expect(screen.queryByRole("button", { name: "إزالة دور المورد" })).toBeNull();
    expect(screen.queryByRole("button", { name: "إزالة دور السائق" })).toBeNull();
  });

  it("the project-owner row never offers a delete button (the destructive boundary is undecided)", async () => {
    renderProfile();
    const section = await screen.findByTestId("account-roles");
    expect(section.textContent).toContain("صاحب المشروع");
    expect(section.textContent).toContain("تعريف حدود حذف بيانات المشروع");
    const buttons = section.querySelectorAll("button");
    for (const button of buttons) {
      expect(button.textContent).not.toContain("حذف");
    }
  });
});
