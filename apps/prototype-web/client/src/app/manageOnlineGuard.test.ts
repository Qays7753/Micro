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

  /* MNG-LOCAL-02 (Post-Group 6 W1): الوضع المعروف لزج — بعد قراءة ناجحة
   * «online_only»، فشل قراءة لاحق لا يُرجع الوضع بصمت إلى المحلي. */
  it("keeps the KNOWN online-only mode on a later read failure (no silent local fallback)", async () => {
    mockedFetchMode.mockResolvedValue({ workspaceId: "ws-1", onlineOnly: true });
    expect(await refreshManageOnlineMode()).toBe("online_only");
    mockedFetchMode.mockRejectedValue(new Error("network down"));
    expect(await refreshManageOnlineMode()).toBe("online_only");
    expect(currentManageOnlineMode()).toBe("online_only");
    expect(() => assertLocalFinancialWriteAllowed()).toThrow(ManageOnlineOnlyError);
  });

  it("keeps the KNOWN local mode on a later read failure (no flapping either)", async () => {
    mockedFetchMode.mockResolvedValue({ workspaceId: "ws-1", onlineOnly: false });
    expect(await refreshManageOnlineMode()).toBe("local");
    mockedFetchMode.mockRejectedValue(new Error("network down"));
    expect(await refreshManageOnlineMode()).toBe("local");
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
    expect((guarded.saveFormDraft as unknown as () => string)()).toBe("draft");
    void calls;
  });

  /* Post-Group 6 W1 (EX-D24 / MNG-LOCAL-01 — أمر المالك bd242b3e): تعداد
   * كل وصفة كتابة مالية محروسة — كل واحدة تُرفض رفضًا صادقًا في وضع القطع،
   * وكل وصفة غير مالية (مسودة/تفضيلات/تهيئة/كتالوج/قراءة) تمر كما هي.
   * هذا هو اختبار التعداد الذي يتطلبه إغلاق النتيجة. */
  it("MNG-LOCAL-01: enumerates EVERY guarded financial mutation — each refuses honestly under online-only", () => {
    const financialRecipes = [
      "commitAssetRecord",
      "commitFinancialEventCorrection",
      "commitOrderUpdate",
      "commitCashContinuity",
      "saveOrder",
      "saveDirectSale",
      "saveFinancialEvent",
      "saveSupplierPurchase",
      "saveShortCashDeclaration",
      "saveOwnerEntitlementRecord",
      "saveOwnerEntitlementOpeningBalance",
      "saveActualTimeRecord",
      "saveInventoryActivation",
      "saveExpenseBudget",
      "saveExpenseBudgetRevisionPair",
    ];
    const passThroughRecipes = [
      "readSnapshot",
      "replaceSnapshot",
      "runProtectedReplacement",
      "listFinancialEvents",
      "listExpenseBudgets",
      "saveDraft",
      "savePreferences",
      "saveProfile",
      "saveOwnerProfile",
      "saveCatalogItem",
      "saveMeasurementUnit",
      "saveCatalogTemplate",
      "saveAllocationPolicy",
      "saveSchedule",
      "saveRecurrence",
    ];
    const fakeStore: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const recipe of [...financialRecipes, ...passThroughRecipes]) {
      fakeStore[recipe] = vi.fn(() => `ok:${recipe}`);
    }
    const guarded = guardLocalStoreForOnlineMode(fakeStore as unknown as PrototypeLocalStore);

    // Mode OFF: everything passes (today's behavior, byte-for-byte).
    for (const recipe of [...financialRecipes, ...passThroughRecipes]) {
      expect((guarded[recipe as keyof PrototypeLocalStore] as unknown as () => string)()).toBe(
        `ok:${recipe}`,
      );
    }

    // Mode ON: every FINANCIAL mutation refuses honestly (MNG-LOCAL-01: no
    // local financial write may bypass the guard when online-only is active).
    setManageOnlineModeForTest("online_only");
    for (const recipe of financialRecipes) {
      expect(() => (guarded[recipe as keyof PrototypeLocalStore] as unknown as () => string)()).toThrow(
        ManageOnlineOnlyError,
      );
    }
    // Non-financial local surfaces stay available in every mode.
    for (const recipe of passThroughRecipes) {
      expect((guarded[recipe as keyof PrototypeLocalStore] as unknown as () => string)()).toBe(
        `ok:${recipe}`,
      );
    }
  });
});
