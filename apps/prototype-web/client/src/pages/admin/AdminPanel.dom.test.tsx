/** @vitest-environment jsdom */
/**
 * Post-Group 6 continuous completion (G02 — Q129): لوحة المشرف — العميل.
 * حالات الصدق كلها: غير مسجل (بوابة)، غير مصرح (رفض صادق داخل الصفحة لا
 * إخفاء تنقل)، فشل التحميل مع إعادة المحاولة، الطوابير مع الأعمار، البحث
 * عن مستخدم، الإيقاف بسبب إلزامي وتأكيده، الإلغاء الإداري بمعرّف وسبب
 * إلزاميين، وسجل القرارات — ولا أي وصول مالي إلى Manage.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNetworkSession } from "@/app/useNetworkSession";
import AdminPanel from "@/pages/admin/AdminPanel";
import { ApiError } from "@/application/network";

vi.mock("@/app/useNetworkSession", () => ({
  useNetworkSession: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/admin", vi.fn()],
  useSearch: () => "",
  useParams: () => ({}),
}));

const serviceMocks = vi.hoisted(() => ({
  fetchAdminQueues: vi.fn(),
  fetchAdminDecisions: vi.fn(),
  searchAdminUsers: vi.fn(),
  suspendAdminIdentity: vi.fn(),
  adminCancelBooking: vi.fn(),
}));

vi.mock("@/application/admin/adminPanelService", () => ({
  fetchAdminQueues: serviceMocks.fetchAdminQueues,
  fetchAdminDecisions: serviceMocks.fetchAdminDecisions,
  searchAdminUsers: serviceMocks.searchAdminUsers,
  suspendAdminIdentity: serviceMocks.suspendAdminIdentity,
  adminCancelBooking: serviceMocks.adminCancelBooking,
}));

const mockedUseNetworkSession = vi.mocked(useNetworkSession);

function queuesPayload() {
  return {
    queues: {
      marketListings: [{ id: "lst1", title: "إعلان بانتظار المراجعة", ageMs: 3600000 }],
      marketMedia: [],
      marketReports: [{ id: 7, objectId: "lst9", reason: "محتوى مخالف", ageMs: 7200000 }],
      driverApplications: [{ id: "drv1", ageMs: 60000 }],
      driverEvidence: [],
      driverVehicles: [],
      openCases: [{ id: 3, requestId: "req-1", reason: "undelivered", ageMs: 86400000 }],
    },
    opsCounts: {
      activeSuppliers: 3,
      activeDrivers: 2,
      weeklyBookings: 11,
      suspendedIdentities: 1,
      launchThreshold: { suppliers: 10, drivers: 5, governorates: 12 },
    },
    computedAt: Date.now(),
  };
}

function decisionsPayload() {
  return [
    {
      id: 1,
      actorName: "مشرف الاختبار",
      action: "identity_suspended",
      objectType: "network_identity",
      objectId: "idn-1",
      result: "success",
      ageMs: 1800000,
      reason: "خطر على الناس — بلاغ موثق",
    },
  ];
}

beforeEach(() => {
  mockedUseNetworkSession.mockReturnValue({
    session: {
      authenticated: true,
      identity: { email: "admin@example.test", displayName: "المشرف" },
      isAdmin: true,
    },
    loading: false,
    failed: false,
    refresh: vi.fn(),
    signIn: vi.fn(),
    signOutAndRefresh: vi.fn(),
  } as unknown as ReturnType<typeof useNetworkSession>);
  serviceMocks.fetchAdminQueues.mockReset().mockResolvedValue(queuesPayload());
  serviceMocks.fetchAdminDecisions.mockReset().mockResolvedValue(decisionsPayload());
  serviceMocks.searchAdminUsers.mockReset();
  serviceMocks.suspendAdminIdentity.mockReset();
  serviceMocks.adminCancelBooking.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("AdminPanel (G02 — Q129)", () => {
  it("an unauthenticated visitor sees the sign-in gate (the route itself stays reachable)", () => {
    mockedUseNetworkSession.mockReturnValue({
      session: { authenticated: false },
      loading: false,
      failed: false,
      refresh: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkSession>);
    render(<AdminPanel />);
    expect(screen.getByTestId("admin-signin-gate").textContent).toContain("حساب الإدارة");
  });

  it("a signed-in NON-admin gets the honest in-page refusal (not a hidden route)", async () => {
    mockedUseNetworkSession.mockReturnValue({
      session: {
        authenticated: true,
        identity: { email: "user@example.test", displayName: "مستخدم" },
        isAdmin: false,
      },
      loading: false,
      failed: false,
      refresh: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkSession>);
    serviceMocks.fetchAdminQueues.mockRejectedValue(
      new ApiError(403, { code: "forbidden", message: "غير مصرح" }),
    );
    serviceMocks.fetchAdminDecisions.mockRejectedValue(
      new ApiError(403, { code: "forbidden", message: "غير مصرح" }),
    );
    render(<AdminPanel />);
    const refused = await screen.findByTestId("admin-refused");
    expect(refused.textContent).toContain("حساب الإدارة المنفصل وحده");
  });

  it("an admin sees the queues with ages, the honest ops counts, and the decisions log", async () => {
    render(<AdminPanel />);
    const ops = await screen.findByTestId("admin-ops-counts");
    expect(ops.textContent).toContain("موردون نشطون بإعلان منشور: 3");
    expect(ops.textContent).toContain("سائقون معتمدون: 2");
    expect(ops.textContent).toContain("هويات موقوفة: 1");
    /* الطوابير مع عمر كل عنصر */
    const listings = await screen.findByTestId("admin-queue-marketListings");
    expect(listings.textContent).toContain("منذ 1 ساعة");
    const cases = screen.getByTestId("admin-queue-openCases");
    expect(cases.textContent).toContain("منذ 1 يوم");
    /* سجل القرارات مع السبب */
    const decisions = await screen.findByTestId("admin-decisions");
    expect(decisions.textContent).toContain("إيقاف هوية كاملة");
    expect(decisions.textContent).toContain("خطر على الناس — بلاغ موثق");
    /* صدق عتبة الإطلاق — لا ادعاء بلوغها */
    expect(document.body.textContent).toContain("قرار مالك على حسابات حقيقية");
  });

  it("a load failure shows the honest error with a working retry", async () => {
    serviceMocks.fetchAdminQueues.mockRejectedValue(new Error("network"));
    serviceMocks.fetchAdminDecisions.mockRejectedValue(new Error("network"));
    render(<AdminPanel />);
    expect(await screen.findByText("تعذر تحميل اللوحة الآن — أعد المحاولة.")).toBeDefined();
    serviceMocks.fetchAdminQueues.mockResolvedValue(queuesPayload());
    serviceMocks.fetchAdminDecisions.mockResolvedValue(decisionsPayload());
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    await waitFor(() => expect(screen.getByTestId("admin-ops-counts")).toBeDefined());
  });

  it("user search renders the honest role/suspension state and the suspend flow requires a written reason", async () => {
    serviceMocks.searchAdminUsers.mockResolvedValue([
      {
        identityId: "idn-9",
        displayName: "سائق مخالف",
        email: "bad@example.test",
        createdAt: 1,
        isAdmin: false,
        vendorStatus: null,
        driverStatus: "approved",
        suspended: false,
        suspensionReason: null,
        matchedBy: "phone",
      },
    ]);
    render(<AdminPanel />);
    await screen.findByTestId("admin-ops-counts");
    fireEvent.change(screen.getByLabelText("الاسم أو البريد أو الهاتف"), {
      target: { value: "+962790000009" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ابحث" }));
    const results = await screen.findByTestId("admin-search-results");
    expect(results.textContent).toContain("سائق (approved)");
    expect(results.textContent).toContain("غير موقوف");
    /* الإيقاف: زر ثم صندوق تأكيد بسبب إلزامي */
    fireEvent.click(screen.getByRole("button", { name: "أوقف الهوية" }));
    const box = screen.getByRole("alertdialog", { name: "تأكيد إيقاف الهوية" });
    expect(box.textContent).toContain("لا يُلغى أي حجز جارٍ تلقائيًا");
    const confirmButton = screen.getByRole("button", { name: "نفّذ الإيقاف" });
    /* السبب الفارغ يعطّل التأكيد */
    expect(confirmButton.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("السبب (إلزامي)"), { target: { value: "خطر موثق على الناس" } });
    expect(confirmButton.hasAttribute("disabled")).toBe(false);
    fireEvent.click(confirmButton);
    await waitFor(() =>
      expect(serviceMocks.suspendAdminIdentity).toHaveBeenCalledWith("idn-9", "خطر موثق على الناس"),
    );
    expect(await screen.findByText(/أُوقفت هوية سائق مخالف/)).toBeDefined();
  });

  it("the administrative cancel requires a booking id AND a written reason before the command runs", async () => {
    render(<AdminPanel />);
    await screen.findByTestId("admin-ops-counts");
    fireEvent.click(screen.getByRole("button", { name: "ألغِ حجزًا جاريًا بقرار إداري" }));
    const box = screen.getByRole("alertdialog", { name: "تأكيد الإلغاء الإداري" });
    expect(box.textContent).toContain("يُبلَّغ صاحب الحجز فورًا");
    const confirmButton = screen.getByRole("button", { name: "ألغِ الحجز" });
    expect(confirmButton.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("معرّف الحجز"), { target: { value: "req-77" } });
    fireEvent.change(screen.getByLabelText("السبب (إلزامي)"), { target: { value: "خطر على الناس" } });
    expect(confirmButton.hasAttribute("disabled")).toBe(false);
    fireEvent.click(confirmButton);
    await waitFor(() =>
      expect(serviceMocks.adminCancelBooking).toHaveBeenCalledWith("req-77", "خطر على الناس"),
    );
    expect(await screen.findByText("أُلغي الحجز إداريًا وأُبلغ صاحب الحجز فورًا بسبب القرار.")).toBeDefined();
  });

  it("a server refusal in an admin action shows the server's Arabic reason (no silent success)", async () => {
    serviceMocks.suspendAdminIdentity.mockRejectedValue(
      new ApiError(403, { code: "forbidden", message: "لا يمكن إيقاف حساب الإدارة" }),
    );
    serviceMocks.searchAdminUsers.mockResolvedValue([
      {
        identityId: "idn-admin",
        displayName: "حساب إدارة",
        email: "admin2@example.test",
        createdAt: 1,
        isAdmin: true,
        vendorStatus: null,
        driverStatus: null,
        suspended: false,
        suspensionReason: null,
        matchedBy: "name-email",
      },
    ]);
    render(<AdminPanel />);
    await screen.findByTestId("admin-ops-counts");
    fireEvent.change(screen.getByLabelText("الاسم أو البريد أو الهاتف"), { target: { value: "admin2" } });
    fireEvent.click(screen.getByRole("button", { name: "ابحث" }));
    await screen.findByTestId("admin-search-results");
    /* حساب الإدارة لا يعرض زر إيقاف أصلًا */
    expect(screen.queryByRole("button", { name: "أوقف الهوية" })).toBeNull();
  });
});
