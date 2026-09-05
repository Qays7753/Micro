/** @vitest-environment jsdom */

/* المجموعة ٦ (تدقيق A1 — SP-01/DP-04): مسار الاسترداد معفى من غطاء القفل
 * (الطوارئ لا تُقفل) لكن إجراءات مغادرة البيانات نفسها (تصدير/استيراد/تصفير)
 * تتطلب إثبات الرمز مرة واحدة في الجلسة — الجهاز المقفل لا يُصدّر أرقامه ولا
 * يُمسح بلا رمز. القفل معطّل = لا بوابة إطلاقًا. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { LocalLockService } from "@/application/security/localLockService";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { StatementService } from "@/application/finance/statementService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import Settings from "@/pages/Settings";
import { ThemeProvider } from "@/contexts/ThemeContext";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => ["/settings", vi.fn()],
  useParams: () => ({}),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-05T10:00:00.000Z";

describe("Settings data actions are gated behind the local lock (Group 6 — SP-01)", () => {
  let store: MemoryLocalStore;
  let localLock: LocalLockService;
  let createVerifiedExport: ReturnType<typeof vi.fn>;
  let resetAll: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    /* jsdom لا تنفّذ تنزيل الملف — نكتفي بالتحقق من بدء الإجراء لا من آلية المتصفح.
     * نقر الرابط الوهمي يُحاكى بلا ملاحة حقيقية تدمّر المستند. */
    vi.stubGlobal("URL", {
      ...(globalThis.URL as object),
      createObjectURL: vi.fn(() => "blob:mock"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    /* jsdom بلا scrollIntoView — إشعار التخزين يفتح الطبقة ويمرر إليها. */
    (globalThis.Element.prototype as { scrollIntoView?: () => void }).scrollIntoView ??= () => undefined;
    store = new MemoryLocalStore();
    localLock = new LocalLockService(store, () => NOW);
    createVerifiedExport = vi.fn(async () => ({
      ok: true,
      value: {
        file: {
          format: "micro-prototype-local-export",
          version: 27,
          schemaVersion: 35,
          exportedAt: NOW,
          data: {},
        },
        summary: { orders: 0, directSales: 0, financialEvents: 0 },
      },
    }));
    resetAll = vi.fn(async () => ({ ok: true, value: null }));
    mockedUsePrototypeServices.mockReturnValue({
      localLock,
      integrityCheck: new IntegrityCheckService(
        store,
        new ProjectFinancialService(store),
        new StatementService(store, new ProjectFinancialService(store)),
        new CashContinuityService(store),
      ),
      preferences: {
        load: vi.fn(async () => ({ ok: true, preference: "system" })),
        save: vi.fn(async () => ({ ok: true, preference: "dark" })),
        readBrowserPersistence: vi.fn(async () => ({
          state: "unsupported",
          title: "التخزين الدائم غير مدعوم في هذا المتصفح",
          text: "لا يعلن هذا المتصفح حالة الدوام.",
        })),
        readLastVerifiedExport: vi.fn(async () => ({ ok: true, exportedAt: null })),
        markVerifiedExport: vi.fn(async () => ({ ok: true, preference: "system" })),
        readBackupReminderEnabled: vi.fn(async () => ({ ok: true, enabled: true })),
        saveBackupReminderEnabled: vi.fn(async (enabled: boolean) => ({ ok: true, enabled })),
      },
      actualTime: {
        readOperatingMode: vi.fn(async () => ({
          ok: true,
          value: { workMode: null, actualTimeTrackingEnabled: false },
        })),
        saveOperatingMode: vi.fn(),
      },
      transfers: {
        createExport: vi.fn(async () => ({ ok: false })),
        prepareImport: vi.fn(),
        confirmImport: vi.fn(),
        createVerifiedExport,
        resetAll,
      },
      guidedOpeningImport: { prepare: vi.fn(), confirm: vi.fn() },
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("export asks for the PIN when the lock is enabled and refuses a wrong PIN", async () => {
    await localLock.enable("4179", 10);
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "احمِ بياناتك" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "تصدير البيانات المحلية" }));
    await waitFor(() => expect(screen.getByRole("alertdialog", { name: "تأكيد رمز القفل" })).toBeTruthy());
    expect(createVerifiedExport).not.toHaveBeenCalled();

    const pinInput = screen.getByLabelText("رمز القفل", { selector: "input" });
    fireEvent.change(pinInput, { target: { value: "0000" } });
    fireEvent.submit(pinInput.closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(createVerifiedExport).not.toHaveBeenCalled();
  });

  it("the correct PIN opens the action, and verification holds for the session", async () => {
    await localLock.enable("4179", 10);
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "احمِ بياناتك" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "تصدير البيانات المحلية" }));
    const pinInput = await waitFor(() => screen.getByLabelText("رمز القفل", { selector: "input" }));
    fireEvent.change(pinInput, { target: { value: "4179" } });
    fireEvent.submit(pinInput.closest("form")!);
    await waitFor(() => expect(createVerifiedExport).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog", { name: "تأكيد رمز القفل" })).toBeNull(),
    );

    /* الإثبات مرة واحدة في الجلسة — الضغطة الثانية تمضي مباشرة بلا بوابة. */
    fireEvent.click(screen.getByRole("button", { name: "تصدير البيانات المحلية" }));
    await waitFor(() => expect(createVerifiedExport).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alertdialog", { name: "تأكيد رمز القفل" })).toBeNull();
  });

  it("Arabic-Indic digits typed in the PIN dialog keep their numeric meaning", async () => {
    await localLock.enable("4179", 10);
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "احمِ بياناتك" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "تصدير البيانات المحلية" }));
    const pinInput = await waitFor(() => screen.getByLabelText("رمز القفل", { selector: "input" }));
    /* لوحة مفاتيح عربية ترسل ٤١٧٩ — المعنى الرقمي لا يتغير (UX-01). */
    fireEvent.change(pinInput, { target: { value: "٤١٧٩" } });
    expect((pinInput as HTMLInputElement).value).toBe("4179");
  });

  it("no gate at all when the lock is disabled — export proceeds directly", async () => {
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "احمِ بياناتك" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "تصدير البيانات المحلية" }));
    await waitFor(() => expect(createVerifiedExport).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog", { name: "تأكيد رمز القفل" })).toBeNull();
  });
});
