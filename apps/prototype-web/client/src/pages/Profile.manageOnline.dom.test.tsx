/** @vitest-environment jsdom */
/**
 * EX-D23 (M3): قسم «ربط Manage المتصل» داخل ملف الحساب — كل حالات الصدق:
 * غير مهيأ، القدرة معطلة، غير مربوط (نموذج الربط المزدوج)، بانتظار التأكيد،
 * مربوط + حالة بيانات الخادم (غير مهاجرة بعد)، وفشل صادق بلا نجاح كاذب.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { useNetworkSession } from "@/app/useNetworkSession";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import Profile from "@/pages/Profile";
import type { ManageLinkStartResult, ManageOnlineState } from "@/application/network";
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
    identity: { email: "owner@example.test", displayName: "المالك" } as
      { email: string; displayName: string } | undefined,
  },
  loading: false,
  failed: false,
}));

vi.mock("@/app/useNetworkSession", () => ({
  useNetworkSession: () => ({
    ...sessionMocks,
    refresh: vi.fn(),
    signIn: vi.fn(),
    signOutAndRefresh: vi.fn(),
  }),
}));

const serviceMocks = vi.hoisted(() => ({
  fetchManageOnlineState: vi.fn(),
  fetchManageFamilies: vi.fn(),
  startManageLink: vi.fn(),
  confirmManageLink: vi.fn(),
  unlinkManage: vi.fn(),
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
  };
});

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

function owner() {
  return {
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
  };
}

function mockServices() {
  return {
    ownerProfile: { ensureLocal: vi.fn().mockResolvedValue(owner()), read: vi.fn(), save: vi.fn() },
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

function stateOfWorkspaces(workspaces: ManageOnlineState["workspaces"]): ManageOnlineState {
  return { configured: true, workspaces };
}

beforeEach(() => {
  mockedUsePrototypeServices.mockReturnValue(
    mockServices() as unknown as ReturnType<typeof usePrototypeServices>,
  );
  sessionMocks.loading = false;
  sessionMocks.failed = false;
  sessionMocks.session = {
    authenticated: true,
    identity: { email: "owner@example.test", displayName: "المالك" },
  };
  serviceMocks.fetchManageOnlineState.mockReset();
  serviceMocks.fetchManageFamilies.mockReset();
  serviceMocks.startManageLink.mockReset();
  serviceMocks.confirmManageLink.mockReset();
  serviceMocks.unlinkManage.mockReset();
});

afterEach(() => {
  cleanup();
});

function renderProfile() {
  return render(
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <Profile />
    </UnsavedChangesProvider>,
  );
}

describe("Profile manage-online section (M3): truthful states", () => {
  it("shows the capability-disabled state honestly when no workspace has manage enabled", async () => {
    serviceMocks.fetchManageOnlineState.mockResolvedValue(
      stateOfWorkspaces([
        { id: "ws-1", displayName: "مساحة", role: "owner", manageEnabled: false, linkStatus: "none" },
      ]),
    );
    renderProfile();
    expect(await screen.findByTestId("manage-capability-disabled")).toBeDefined();
    expect(screen.queryByTestId("manage-proof-input")).toBeNull();
  });

  it("shows the not-linked link form with the local proof generator", async () => {
    serviceMocks.fetchManageOnlineState.mockResolvedValue(
      stateOfWorkspaces([
        { id: "ws-1", displayName: "مساحة", role: "owner", manageEnabled: true, linkStatus: "none" },
      ]),
    );
    renderProfile();
    const input = await screen.findByTestId("manage-proof-input");
    expect(input).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "ولّد سرًا" }));
    await waitFor(() => {
      expect((input as HTMLInputElement).value.length).toBeGreaterThanOrEqual(32);
    });
    // Start stays disabled below the minimum proof length until generated.
    expect((input as HTMLInputElement).value).toMatch(/^[0-9a-f]{64}$/);
  });

  it("completes the double-confirmation flow honestly: start → pending → confirm → linked", async () => {
    serviceMocks.fetchManageOnlineState
      .mockResolvedValueOnce(
        stateOfWorkspaces([
          { id: "ws-1", displayName: "مساحة", role: "owner", manageEnabled: true, linkStatus: "none" },
        ]),
      )
      .mockResolvedValue(
        stateOfWorkspaces([
          { id: "ws-1", displayName: "مساحة", role: "owner", manageEnabled: true, linkStatus: "linked" },
        ]),
      );
    const pending: ManageLinkStartResult = {
      pending: true,
      workspaceId: "ws-1",
      nonce: "nonce-value-123456",
      expiresAt: Date.now() + 900000,
    };
    serviceMocks.startManageLink.mockResolvedValue(pending);
    serviceMocks.confirmManageLink.mockResolvedValue({ linked: true, workspaceId: "ws-1" });
    serviceMocks.fetchManageFamilies.mockResolvedValue({
      workspaceId: "ws-1",
      families: [],
      totalRecords: 0,
    });
    renderProfile();
    const input = (await screen.findByTestId("manage-proof-input")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "a".repeat(40) } });
    fireEvent.click(screen.getByRole("button", { name: "ابدأ الربط" }));
    expect(await screen.findByTestId("manage-link-pending")).toBeDefined();
    expect(serviceMocks.startManageLink).toHaveBeenCalledWith("a".repeat(40));
    fireEvent.click(screen.getByRole("button", { name: "أكّد الربط" }));
    await waitFor(() => {
      expect(serviceMocks.confirmManageLink).toHaveBeenCalledWith("nonce-value-123456");
    });
    expect(await screen.findByTestId("manage-linked")).toBeDefined();
    // The honest not-migrated server state (local copy stays the working source).
    expect(
      await screen.findByText(
        /الخادم لا يحمل بيانات مهاجرة بعد — نسختك المحلية على هذا الجهاز هي مصدر العمل/,
      ),
    ).toBeDefined();
  });

  it("surfaces a start failure honestly (no false success)", async () => {
    serviceMocks.fetchManageOnlineState.mockResolvedValue(
      stateOfWorkspaces([
        { id: "ws-1", displayName: "مساحة", role: "owner", manageEnabled: true, linkStatus: "none" },
      ]),
    );
    serviceMocks.startManageLink.mockRejectedValue(
      new ApiError(403, { code: "manage_capability_disabled", message: "رسالة الخادم الصادقة" }),
    );
    renderProfile();
    const input = (await screen.findByTestId("manage-proof-input")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "a".repeat(40) } });
    fireEvent.click(screen.getByRole("button", { name: "ابدأ الربط" }));
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toContain("رسالة الخادم الصادقة");
    // The form is back (idle), not a fake pending/linked state.
    expect(screen.getByTestId("manage-proof-input")).toBeDefined();
  });

  it("shows the state-read failure with a retry (network down is not 'not signed in')", async () => {
    serviceMocks.fetchManageOnlineState.mockRejectedValue(new Error("network"));
    renderProfile();
    expect(
      await screen.findByText(/تعذر قراءة حالة ربط Manage الآن — بيانات مشروعك المحلية سليمة/),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "إعادة المحاولة" })).toBeDefined();
  });

  it("does not render the section for an unauthenticated visitor", async () => {
    sessionMocks.session = { authenticated: false, identity: undefined };
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText(/لديك حساب Micro واحد لكل المنتجات/)).toBeDefined();
    });
    expect(screen.queryByTestId("manage-online-section")).toBeNull();
    expect(serviceMocks.fetchManageOnlineState).not.toHaveBeenCalled();
  });
});
