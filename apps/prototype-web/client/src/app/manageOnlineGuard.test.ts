/** @vitest-environment jsdom */
/**
 * EX-D23 (M6): حارس الوضع المتصل-فقط — الفتح نحو المحلي عند أي فشل (الواقع
 * الحالي)، الرفض الصادق للكتابة المالية المحلية عند تفعيل الوضع (اختبارًا
 * فقط)، ومرور كل شيء كما هو عند الإطفاء (سلوك اليوم)، مع بقاء التصدير
 * والاستبدال المحمي والقراءة غير معترضة إطلاقًا (مصدر الاسترداد باقٍ).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertLocalFinancialWriteAllowed,
  currentManageOnlineMode,
  guardLocalStoreForOnlineMode,
  ManageOnlineOnlyError,
  refreshManageOnlineMode,
  resetManageOnlineModeForTest,
  setManageOnlineModeForTest,
} from "@/app/manageOnlineGuard";
import { fetchManageMode } from "@/application/network";
import type { PrototypeLocalStore } from "@/storage/local/types";

vi.mock("@/application/network", () => ({
  fetchManageMode: vi.fn(),
}));

const mockedFetchMode = vi.mocked(fetchManageMode);

afterEach(() => {
  resetManageOnlineModeForTest();
  vi.clearAllMocks();
});

describe("manage online mode guard (M6)", () => {
  it("defaults to local — the cutover flag is structurally off until the operator acts", () => {
    expect(currentManageOnlineMode()).toBe("local");
    expect(() => assertLocalFinancialWriteAllowed()).not.toThrow();
  });

  it("fails OPEN to local on any read failure (unauthenticated/unlinked/offline/unconfigured)", async () => {
    mockedFetchMode.mockRejectedValue(new Error("network down"));
    expect(await refreshManageOnlineMode()).toBe("local");
    expect(currentManageOnlineMode()).toBe("local");
  });

  it("keeps local when the server reports onlineOnly=false", async () => {
    mockedFetchMode.mockResolvedValue({ workspaceId: "ws-1", onlineOnly: false });
    expect(await refreshManageOnlineMode()).toBe("local");
  });

  it("refuses local financial writes honestly when the operator has enabled online-only (MO-14)", async () => {
    mockedFetchMode.mockResolvedValue({ workspaceId: "ws-1", onlineOnly: true });
    expect(await refreshManageOnlineMode()).toBe("online_only");
    expect(() => assertLocalFinancialWriteAllowed()).toThrow(ManageOnlineOnlyError);
    try {
      assertLocalFinancialWriteAllowed();
    } catch (error) {
      expect((error as ManageOnlineOnlyError).message).toContain("متصلة فقط");
      expect((error as ManageOnlineOnlyError).message).toContain("التصدير المحلي متاح دائمًا");
    }
  });

  it("guards ONLY commit* recipes — reads, replacement, and recovery pass through untouched", () => {
    const calls: string[] = [];
    const fakeStore = {
      commitAssetRecord: vi.fn(() => "committed"),
      readSnapshot: vi.fn(() => "read"),
      replaceSnapshot: vi.fn(() => "replaced"),
      runProtectedReplacement: vi.fn(() => "protected"),
      saveFormDraft: vi.fn(() => "draft"),
    } as unknown as PrototypeLocalStore;
    const guarded = guardLocalStoreForOnlineMode(fakeStore);

    // Mode OFF (today): everything passes through exactly as before.
    expect((guarded.commitAssetRecord as unknown as () => string)()).toBe("committed");
    expect((guarded.readSnapshot as unknown as () => string)()).toBe("read");

    // Mode ON (operator-gated, test-only): the financial commit refuses…
    setManageOnlineModeForTest("online_only");
    expect(() => (guarded.commitAssetRecord as unknown as () => string)()).toThrow(ManageOnlineOnlyError);
    // …while reads, the protected replacement (recovery), and drafts stay available.
    expect((guarded.readSnapshot as unknown as () => string)()).toBe("read");
    expect((guarded.replaceSnapshot as unknown as () => string)()).toBe("replaced");
    expect((guarded.runProtectedReplacement as unknown as () => string)()).toBe("protected");
    expect((guarded.saveFormDraft as unknown as () => string)()).toBe("draft");
    void calls;
  });
});
