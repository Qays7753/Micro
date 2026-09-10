/** @vitest-environment jsdom */

/* التحصين الكامل (المجموعة ٣): بطاقة تحديث عامل الخدمة — «حدّث الآن» محجوب
 * فوق نموذج قذر بشرح صادق (عقد ٣٨)، والإغلاق اليدوي قرار المستخدم، والتحديث
 * النظيف يستدعي applyPwaUpdate. الحالة عبر سجل القذارة الحقيقي لا عبر محاكاة. */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setDirtyForms } from "@/pwa/dirtyRegistry";

const pwaState = vi.hoisted(() => ({
  state: { serviceWorkerSupported: true, updateAvailable: false, offlineReady: false, error: null },
}));

vi.mock("@/pwa/register", () => ({
  getPwaRuntimeState: () => pwaState.state,
  subscribePwa: vi.fn(),
  applyPwaUpdate: vi.fn(),
}));

import { PwaRuntimeNotice } from "@/pwa/PwaRuntimeNotice";
import { applyPwaUpdate } from "@/pwa/register";

describe("PwaRuntimeNotice — dirty-safe manual update card", () => {
  beforeEach(() => {
    pwaState.state = {
      serviceWorkerSupported: true,
      updateAvailable: true,
      offlineReady: false,
      error: null,
    };
    setDirtyForms(0);
    vi.mocked(applyPwaUpdate).mockClear().mockResolvedValue(undefined);
  });
  afterEach(() => {
    cleanup();
    setDirtyForms(0);
    vi.clearAllMocks();
  });

  it("clean path: update card offers the manual update and applies it once", async () => {
    render(<PwaRuntimeNotice />);
    const updateButton = await screen.findByRole("button", { name: "حدّث الآن" });
    fireEvent.click(updateButton);
    await waitFor(() => expect(applyPwaUpdate).toHaveBeenCalledTimes(1));
    /* لا تحذير قذارة في المسار النظيف. */
    expect(screen.queryByText(/مدخلات غير محفوظة/)).toBeNull();
  });

  it("dirty path: the update button refuses with an honest warning and never applies", () => {
    setDirtyForms(1);
    render(<PwaRuntimeNotice />);
    fireEvent.click(screen.getByRole("button", { name: "حدّث الآن" }));
    expect(applyPwaUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("مدخلات غير محفوظة");
  });

  it("manual dismissal hides the card — the user decides, not the runtime", () => {
    render(<PwaRuntimeNotice />);
    fireEvent.click(screen.getByRole("button", { name: "لاحقًا" }));
    expect(screen.queryByRole("button", { name: "حدّث الآن" })).toBeNull();
  });

  it("offline card states the local-only truth without update controls", () => {
    pwaState.state = {
      serviceWorkerSupported: true,
      updateAvailable: false,
      offlineReady: false,
      error: null,
    };
    const onlineGetter = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<PwaRuntimeNotice />);
    expect(screen.getByText("أنت غير متصل الآن")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "حدّث الآن" })).toBeNull();
    onlineGetter.mockRestore();
  });
});
