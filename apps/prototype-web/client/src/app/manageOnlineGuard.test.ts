/** @vitest-environment jsdom */
/**
 * EX-D23 (M6) + MNG-LOCAL-02 (إصلاح 2026-11-23 — WS-254/DOC-044) + متابعة
 * 2026-11-24 (أمر المالك FOLLOW-UP-REMEDIATION): حارس الوضع المتصل-فقط بثلاث
 * حالات — «local» المؤكَد، «online_only» المقطوع، و«unknown» غير القابل
 * للتحقق. الكتابة المالية الحساسة:
 *  - تُرفض رفضًا صادقًا في وضع القطع (كما كان M6)؛
 *  - وتُرفض الآن أيضًا في الوضع المجهول (الفشل المغلق الذي تطلبه النتيجة
 *    المفتوحة MNG-LOCAL-02 وقرار المالك Q270: «لم يُحفظ» وتبقى البيانات في
 *    النموذج) — لا فتحًا صامتًا نحو المحلي عند أي فشل بعد الآن، وبما فيه
 *    صراحةً 503 network_not_configured (خادم البيانات غائب — لا يُشتق منه
 *    إذن كتابة مالية محلية)؛
 *  - والرفض نتيجة تخزين موحدة {ok:false} فلا يسقط زر ولا تُبتلع رسالة؛
 *  - والقراءة والاستبدال المحمي والمسودات والتصدير لا تُمس في أي وضع.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COMMIT_FINANCIAL_RECIPES,
  currentManageOnlineMode,
  guardLocalStoreForOnlineMode,
  MANAGE_MODE_UNKNOWN_MESSAGE,
  MANAGE_ONLINE_ONLY_MESSAGE,
  NON_FINANCIAL_WRITE_RECIPES,
  refreshManageOnlineMode,
  resetManageOnlineModeForTest,
  retryManageOnlineModeRefresh,
  SAVE_FINANCIAL_RECIPES,
  setManageOnlineModeForTest,
} from "@/app/manageOnlineGuard";
import { ApiError, fetchManageMode } from "@/application/network";
import type { PrototypeLocalStore } from "@/storage/local/types";

vi.mock("@/application/network", () => ({
  ApiError: class ApiError extends Error {
    readonly status: number;
    readonly code: string;
    constructor(status: number, shape: { code: string; message: string }) {
      super(shape.message);
      this.status = status;
      this.code = shape.code;
    }
  },
  fetchManageMode: vi.fn(),
}));

const mockedFetchMode = vi.mocked(fetchManageMode);

const apiError = (status: number, code: string) => new ApiError(status, { code, message: "خطأ اختباري" });

afterEach(() => {
  resetManageOnlineModeForTest();
  vi.clearAllMocks();
});

describe("manage online mode guard (M6 + MNG-LOCAL-02)", () => {
  it("starts UNKNOWN and refuses sensitive local writes until a definitive read (fail closed)", () => {
    expect(currentManageOnlineMode()).toBe("unknown");
    const fakeStore = {
      commitAssetRecord: vi.fn(() => "committed"),
      readSnapshot: vi.fn(() => "read"),
    } as unknown as PrototypeLocalStore;
    const guarded = guardLocalStoreForOnlineMode(fakeStore);
    const refusal = (guarded.commitAssetRecord as unknown as () => Promise<unknown>)() as Promise<{
      ok: false;
      message: string;
    }>;
    void expect(refusal).resolves.toMatchObject({ ok: false, message: MANAGE_MODE_UNKNOWN_MESSAGE });
  });

  it("a definitive NEGATIVE answer (401 unauthenticated) confirms local — writes flow again", async () => {
    mockedFetchMode.mockRejectedValue(apiError(401, "unauthorized"));
    expect(await refreshManageOnlineMode()).toBe("local");
    expect(currentManageOnlineMode()).toBe("local");
  });

  it("a definitive NEGATIVE answer (403 not the linked manage owner) confirms local", async () => {
    mockedFetchMode.mockRejectedValue(apiError(403, "manage_not_linked"));
    expect(await refreshManageOnlineMode()).toBe("local");
  });

  it("MNG-LOCAL-02 follow-up (Q270 enforced exactly): the unconfigured backend (503 network_not_configured) leaves the mode UNKNOWN — an absent backend never permits local financial writes", async () => {
    mockedFetchMode.mockRejectedValue(apiError(503, "network_not_configured"));
    expect(await refreshManageOnlineMode()).toBe("unknown");
    expect(currentManageOnlineMode()).toBe("unknown");
    // The honest Q270 refusal: «لم يُحفظ» and the data stays in the form —
    // no silent fail-open to a local financial write when the data backend
    // is absent (the owner's follow-up remediation order 2026-11-24).
    const fakeStore = { saveOrder: vi.fn(() => "saved") } as unknown as PrototypeLocalStore;
    const guarded = guardLocalStoreForOnlineMode(fakeStore);
    await expect((guarded.saveOrder as unknown as () => Promise<unknown>)()).resolves.toMatchObject({
      ok: false,
      message: MANAGE_MODE_UNKNOWN_MESSAGE,
    });
    expect(fakeStore.saveOrder).not.toHaveBeenCalled();
  });

  it("MNG-LOCAL-02: a NON-definitive failure (network down / other 5xx) leaves the mode UNKNOWN — no silent fail-open to local", async () => {
    mockedFetchMode.mockRejectedValue(new TypeError("fetch failed"));
    expect(await refreshManageOnlineMode()).toBe("unknown");
    expect(currentManageOnlineMode()).toBe("unknown");
    // A server error that is not the documented unconfigured code is also unknown.
    mockedFetchMode.mockRejectedValue(apiError(503, "internal_error"));
    expect(await refreshManageOnlineMode()).toBe("unknown");
    // And a definitive LOCAL known before does not survive an unreadable later refresh:
    // the fresh read is what matters (the operator may have flipped the flag since).
    mockedFetchMode.mockResolvedValue({ workspaceId: "ws-1", onlineOnly: false });
    expect(await refreshManageOnlineMode()).toBe("local");
    mockedFetchMode.mockRejectedValue(new TypeError("fetch failed"));
    expect(await refreshManageOnlineMode()).toBe("unknown");
  });

  it("MNG-LOCAL-02: a KNOWN online-only mode keeps refusing on later read failures (sticky refusal, no local fallback)", async () => {
    mockedFetchMode.mockResolvedValue({ workspaceId: "ws-1", onlineOnly: true });
    expect(await refreshManageOnlineMode()).toBe("online_only");
    mockedFetchMode.mockRejectedValue(new TypeError("fetch failed"));
    expect(await refreshManageOnlineMode()).toBe("unknown");
    // Unknown refuses writes exactly like the cut-over mode — never falls open.
    expect(currentManageOnlineMode()).toBe("unknown");
  });

  it("refuses local financial writes honestly in the cut-over mode (MO-14) with the M6 message", async () => {
    mockedFetchMode.mockResolvedValue({ workspaceId: "ws-1", onlineOnly: true });
    expect(await refreshManageOnlineMode()).toBe("online_only");
    const fakeStore = { commitAssetRecord: vi.fn(() => "committed") } as unknown as PrototypeLocalStore;
    const guarded = guardLocalStoreForOnlineMode(fakeStore);
    await expect((guarded.commitAssetRecord as unknown as () => Promise<unknown>)()).resolves.toMatchObject({
      ok: false,
      message: MANAGE_ONLINE_ONLY_MESSAGE,
    });
    expect(MANAGE_ONLINE_ONLY_MESSAGE).toContain("متصلة فقط");
    expect(MANAGE_ONLINE_ONLY_MESSAGE).toContain("التصدير المحلي متاح دائمًا");
  });

  it("the Q270 unknown-state message states honestly that nothing was saved and the data stays in the form", () => {
    expect(MANAGE_MODE_UNKNOWN_MESSAGE).toContain("لم يُحفظ");
    expect(MANAGE_MODE_UNKNOWN_MESSAGE).toContain("تبقى بياناتك في النموذج");
    expect(MANAGE_MODE_UNKNOWN_MESSAGE).toContain("لم يُكتب شيء");
  });

  it("a refused write on the unknown state schedules a throttled automatic re-read (connectivity recovery without reload)", async () => {
    mockedFetchMode.mockResolvedValue({ workspaceId: "ws-1", onlineOnly: false });
    const fakeStore = { saveOrder: vi.fn(() => "saved") } as unknown as PrototypeLocalStore;
    const guarded = guardLocalStoreForOnlineMode(fakeStore);
    setManageOnlineModeForTest("unknown");
    // currentManageOnlineMode reflects the manual set; the refused write triggers a re-read.
    await expect((guarded.saveOrder as unknown as () => Promise<unknown>)()).resolves.toMatchObject({
      ok: false,
      message: MANAGE_MODE_UNKNOWN_MESSAGE,
    });
    // The auto-retry ran (throttled): the re-read resolved the mode to local.
    expect(mockedFetchMode).toHaveBeenCalled();
    expect(currentManageOnlineMode()).toBe("local");
    // Now the same write flows through to the real store method.
    expect((guarded.saveOrder as unknown as () => string)()).toBe("saved");
  });

  it("the throttled retry does not storm: a second refused write within the window makes no extra fetch", async () => {
    mockedFetchMode.mockRejectedValue(new TypeError("fetch failed"));
    setManageOnlineModeForTest("unknown");
    await retryManageOnlineModeRefresh();
    const callsAfterFirst = mockedFetchMode.mock.calls.length;
    await retryManageOnlineModeRefresh();
    expect(mockedFetchMode.mock.calls.length).toBe(callsAfterFirst);
  });

  it("guards ONLY the classified financial enumeration — non-financial commits (theme/profile/schedules…) and every recovery surface pass through untouched", () => {
    const fakeStore = {
      commitAssetRecord: vi.fn(() => "committed"),
      commitPreferencesUpdate: vi.fn(() => "preferences"),
      commitProfileCreate: vi.fn(() => "profile"),
      commitScheduleCreate: vi.fn(() => "schedule"),
      commitCostEstimateCreate: vi.fn(() => "estimate"),
      readSnapshot: vi.fn(() => "read"),
      replaceSnapshot: vi.fn(() => "replaced"),
      runProtectedReplacement: vi.fn(() => "recovery"),
      saveFormDraft: vi.fn(() => "draft"),
    } as unknown as PrototypeLocalStore;
    const guarded = guardLocalStoreForOnlineMode(fakeStore);

    // Unknown mode: the financial commit refuses honestly…
    setManageOnlineModeForTest("unknown");
    void expect((guarded.commitAssetRecord as unknown as () => Promise<unknown>)()).resolves.toMatchObject({
      ok: false,
    });
    // …while the NON-financial commits, reads, the protected replacement
    // (recovery), and drafts stay available in every mode (the MNG-LOCAL-02
    // fix: the old commit* PREFIX wrongly captured these — a dark-mode toggle
    // would have been refused while offline).
    expect((guarded.commitPreferencesUpdate as unknown as () => string)()).toBe("preferences");
    expect((guarded.commitProfileCreate as unknown as () => string)()).toBe("profile");
    expect((guarded.commitScheduleCreate as unknown as () => string)()).toBe("schedule");
    expect((guarded.commitCostEstimateCreate as unknown as () => string)()).toBe("estimate");
    expect((guarded.readSnapshot as unknown as () => string)()).toBe("read");
    expect((guarded.replaceSnapshot as unknown as () => string)()).toBe("replaced");
    expect((guarded as unknown as Record<string, () => string>).runProtectedReplacement()).toBe("recovery");
    expect((guarded.saveFormDraft as unknown as () => string)()).toBe("draft");

    // Definitive local mode: everything passes through exactly as before.
    setManageOnlineModeForTest("local");
    expect((guarded.commitAssetRecord as unknown as () => string)()).toBe("committed");
  });

  /* Post-Group 6 W1 (EX-D24 / MNG-LOCAL-01 — أمر المالك bd242b3e): تعداد
   * كل وصفة كتابة مالية محروسة — كل واحدة تُرفض رفضًا صادقًا في الوضعين
   * المرفوضين، وكل وصفة غير مالية (مسودة/تفضيلات/تهيئة/كتالوج/قراءة) تمر
   * كما هي. هذا هو اختبار التعداد الذي يتطلبه إغلاق النتيجة. */
  it("MNG-LOCAL-01: enumerates EVERY guarded financial mutation — each refuses honestly under unknown AND online-only", () => {
    /* المصفوفات المصدَّرة من الوحدة نفسها (لا نسخ يدوي ينحرف) — الاكتمال
     * الكامل لكل وصفات commit وsave موكد وقت الترجمة داخل الوحدة بتوكيدَي
     * النفي؛ هذا الاختبار يثبت السلوك. */
    const financialRecipes = [...COMMIT_FINANCIAL_RECIPES, ...SAVE_FINANCIAL_RECIPES];
    const passThroughRecipes = [
      ...NON_FINANCIAL_WRITE_RECIPES,
      "readSnapshot",
      "replaceSnapshot",
      "runProtectedReplacement",
      "listFinancialEvents",
      "listExpenseBudgets",
    ];
    const fakeStore: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const recipe of [...financialRecipes, ...passThroughRecipes]) {
      fakeStore[recipe] = vi.fn(() => `ok:${recipe}`);
    }
    const guarded = guardLocalStoreForOnlineMode(fakeStore as unknown as PrototypeLocalStore);

    // Definitive local: everything passes (today's behavior, byte-for-byte).
    setManageOnlineModeForTest("local");
    for (const recipe of [...financialRecipes, ...passThroughRecipes]) {
      expect((guarded[recipe as keyof PrototypeLocalStore] as unknown as () => string)()).toBe(
        `ok:${recipe}`,
      );
    }

    // Unknown (MNG-LOCAL-02) AND online-only (M6): every FINANCIAL mutation
    // refuses honestly as a storage failure — no bypass, no throw.
    for (const mode of ["unknown", "online_only"] as const) {
      setManageOnlineModeForTest(mode);
      for (const recipe of financialRecipes) {
        const refusal = (
          guarded[recipe as keyof PrototypeLocalStore] as unknown as () => Promise<{
            ok: boolean;
            code: string;
          }>
        )() as Promise<{ ok: boolean; code: string }>;
        void expect(refusal).resolves.toMatchObject({ ok: false, code: "storage_error" });
      }
      // Non-financial local surfaces stay available in every mode.
      for (const recipe of passThroughRecipes) {
        expect((guarded[recipe as keyof PrototypeLocalStore] as unknown as () => string)()).toBe(
          `ok:${recipe}`,
        );
      }
    }
  });
});
