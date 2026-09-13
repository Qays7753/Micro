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
import { FormDraftService } from "@/application/drafts/formDraftService";
import { legacyFinanceDraftKey } from "@/application/drafts/legacyFormDraftMigration";
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
      formDrafts: new FormDraftService(store),
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
    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "تأكيد رمز القفل" })).toBeNull());

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

/* ─── المجموعة ٥ (التحصين الكامل): حماية الاستبدال التدميري وبنية إعادة
 * التعيين والتشخيص المحلي — جدول الحقيقة الكامل لمسارات الحساسية. ─── */

const importSummary = {
  profile: { id: "p", activityName: "مشغل" },
  preferences: null,
  drafts: 0,
  orders: 0,
  directSales: 0,
  schedules: 0,
  supplierPurchases: 0,
  cashWallets: 1,
  cashContinuityEntries: 0,
  materials: 0,
  inventoryMovements: 0,
  snapshots: 0,
  events: 0,
  actualTimeRecords: 0,
  costEstimates: 0,
  financialEvents: 0,
  exportedAt: NOW,
};

const guidedSummary = {
  acceptedWallets: 1,
  acceptedCashMinor: 5000,
  acceptedMaterials: 2,
  acceptedMaterialQuantityMilli: 3000,
  estimatedRecords: 1,
};

const pickFile = (input: HTMLInputElement, content: string, name: string) => {
  /* jsdom: files للقراءة فقط وBlob.text غائب — كعب القراءة هنا قانوني لأن
   * الإنتاج يقرأ الملفات في المتصفح الحقيقي حيث كلاهما موجود. */
  const file = new File([content], name, { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => content, configurable: true });
  fireEvent.change(input, { target: { files: [file] } });
};

const guidedFileInput = () =>
  Array.from(document.querySelectorAll('input[type="file"]')).at(-1) as HTMLInputElement;
const importFileInput = () =>
  Array.from(document.querySelectorAll('input[type="file"]'))[0] as HTMLInputElement;

describe("Group 5 — destructive replacement protection, reset policy, and local diagnostics", () => {
  let store: MemoryLocalStore;
  let localLock: LocalLockService;
  let confirmImport: ReturnType<typeof vi.fn>;
  let guidedConfirm: ReturnType<typeof vi.fn>;
  let resetAll: ReturnType<typeof vi.fn>;
  let clipboardWrite: ReturnType<typeof vi.fn>;

  const mountSettings = () => {
    mockedUsePrototypeServices.mockReturnValue({
      localLock,
      formDrafts: new FormDraftService(store),
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
        markVerifiedExport: vi.fn(async () => ({ ok: true })),
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
        prepareImport: vi.fn(() => ({ ok: true, value: { summary: importSummary } })),
        confirmImport,
        createVerifiedExport: vi.fn(async () => ({
          ok: true,
          value: { file: { exportedAt: NOW }, summary: importSummary },
        })),
        resetAll,
      },
      guidedOpeningImport: {
        prepare: vi.fn(async () => ({ ok: true, value: { summary: guidedSummary } })),
        confirm: guidedConfirm,
      },
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    return waitFor(() => expect(screen.getByRole("heading", { name: "احمِ بياناتك" })).toBeTruthy());
  };

  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    vi.stubGlobal("URL", {
      ...(globalThis.URL as object),
      createObjectURL: vi.fn(() => "blob:mock"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    (globalThis.Element.prototype as { scrollIntoView?: () => void }).scrollIntoView ??= () => undefined;
    window.localStorage.clear();
    clipboardWrite = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardWrite },
      configurable: true,
    });
    store = new MemoryLocalStore();
    localLock = new LocalLockService(store, () => NOW);
    confirmImport = vi.fn(async () => ({ ok: true, value: { profile: importSummary.profile } }));
    guidedConfirm = vi.fn(async () => ({ ok: true, value: guidedSummary }));
    resetAll = vi.fn(async () => ({ ok: true, value: null }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("guided opening preview alone writes nothing; confirmation requires the PIN when a lock exists", async () => {
    await localLock.enable("4179", 10);
    await mountSettings();
    pickFile(guidedFileInput(), JSON.stringify({}), "opening.json");
    /* المعاينة وحدها لا تكتب شيئًا أبدًا. */
    await waitFor(() => expect(screen.getByText("لم نغير بياناتك بعد")).toBeTruthy());
    expect(guidedConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "تأكيد إدخال البداية" }));
    const pinInput = await waitFor(() => screen.getByLabelText("رمز القفل", { selector: "input" }));
    /* رمز خاطئ: لا كتابة ولا إدخال. */
    fireEvent.change(pinInput, { target: { value: "0000" } });
    fireEvent.submit(pinInput.closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(guidedConfirm).not.toHaveBeenCalled();
    /* الرمز الصحيح يفتح الإجراء مرة واحدة. */
    fireEvent.change(pinInput, { target: { value: "4179" } });
    fireEvent.submit(pinInput.closest("form")!);
    await waitFor(() => expect(guidedConfirm).toHaveBeenCalledOnce());
  });

  it("guided opening confirmation without a lock is blocked with the bootstrap guidance — never silently authorized", async () => {
    await mountSettings();
    pickFile(guidedFileInput(), JSON.stringify({}), "opening.json");
    await waitFor(() => expect(screen.getByText("لم نغير بياناتك بعد")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "تأكيد إدخال البداية" }));
    const dialog = await waitFor(() => screen.getByRole("alertdialog", { name: "تأكيد رمز القفل" }));
    expect(dialog.textContent).toContain("فعّل «قفل التطبيق المحلي»");
    expect(guidedConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "حسنًا" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("full import confirmation without a lock is blocked too — preview stays read-only", async () => {
    await mountSettings();
    /* المعاينة قراءة خالصة قبل أي بوابة. */
    pickFile(importFileInput(), JSON.stringify({ format: "micro-prototype-local-export" }), "backup.json");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "استبدال البيانات المحلية" })).toBeTruthy(),
    );
    expect(confirmImport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "استبدال البيانات المحلية" }));
    await waitFor(() =>
      expect(screen.getByRole("alertdialog", { name: "استبدال بياناتك يحتاج رمز القفل" })).toBeTruthy(),
    );
    expect(confirmImport).not.toHaveBeenCalled();
  });

  it("a lock read failure fails closed for destructive import — honest error, no data change", async () => {
    await mountSettings();
    const statusSpy = vi.spyOn(localLock, "status").mockResolvedValue({
      ok: false,
      code: "storage_error",
      message: "read failed",
    } as never);
    pickFile(importFileInput(), JSON.stringify({}), "backup.json");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "استبدال البيانات المحلية" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "استبدال البيانات المحلية" }));
    const dialog = await waitFor(() =>
      screen.getByRole("alertdialog", { name: "استبدال بياناتك يحتاج رمز القفل" }),
    );
    expect(dialog.textContent).toContain("لم نستطع قراءة إعداد القفل");
    expect(dialog.textContent).toContain("لم يتغير أي شيء");
    expect(confirmImport).not.toHaveBeenCalled();
    statusSpy.mockRestore();
  });

  it("a wrong PIN performs no import write; the correct PIN imports once", async () => {
    await localLock.enable("4179", 10);
    await mountSettings();
    pickFile(importFileInput(), JSON.stringify({}), "backup.json");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "استبدال البيانات المحلية" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "استبدال البيانات المحلية" }));
    const pinInput = await waitFor(() => screen.getByLabelText("رمز القفل", { selector: "input" }));
    fireEvent.change(pinInput, { target: { value: "0000" } });
    fireEvent.submit(pinInput.closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(confirmImport).not.toHaveBeenCalled();
    fireEvent.change(pinInput, { target: { value: "4179" } });
    fireEvent.submit(pinInput.closest("form")!);
    await waitFor(() => expect(confirmImport).toHaveBeenCalledOnce());
  });

  it("repeated guided opening confirmation is idempotent (reused) and duplicates nothing", async () => {
    await localLock.enable("4179", 10);
    await mountSettings();
    pickFile(guidedFileInput(), JSON.stringify({}), "opening.json");
    await waitFor(() => expect(screen.getByText("لم نغير بياناتك بعد")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "تأكيد إدخال البداية" }));
    const pinInput = await waitFor(() => screen.getByLabelText("رمز القفل", { selector: "input" }));
    fireEvent.change(pinInput, { target: { value: "4179" } });
    fireEvent.submit(pinInput.closest("form")!);
    await waitFor(() => expect(guidedConfirm).toHaveBeenCalledOnce());
    /* الضغط الثاني بعد النجاح: الخدمة تعيد reused — لا أثر مزدوج. */
    guidedConfirm.mockResolvedValueOnce({ ok: true, value: guidedSummary, reused: true });
    cleanup();
    await mountSettings();
    pickFile(guidedFileInput(), JSON.stringify({}), "opening.json");
    await waitFor(() => expect(screen.getByText("لم نغير بياناتك بعد")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "تأكيد إدخال البداية" }));
    /* مثيل جديد = تحقق جديد — البوابة تُفتح بالرمز ثم يعاد الاستخدام بلا أثر. */
    const secondPin = await waitFor(() => screen.getByLabelText("رمز القفل", { selector: "input" }));
    fireEvent.change(secondPin, { target: { value: "4179" } });
    fireEvent.submit(secondPin.closest("form")!);
    expect(await screen.findByText(/تم التعرف على هذه المحاولة مسبقًا؛ لم يتكرر أي أثر/)).toBeTruthy();
  });

  it("a successful import announces the preserved ephemeral drafts truthfully", async () => {
    const drafts = new FormDraftService(store, () => NOW);
    await drafts.save("asset", "new", { name: "مسودة محفوظة" });
    await localLock.enable("4179", 10);
    await mountSettings();
    pickFile(importFileInput(), JSON.stringify({}), "backup.json");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "استبدال البيانات المحلية" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "استبدال البيانات المحلية" }));
    const pinInput = await waitFor(() => screen.getByLabelText("رمز القفل", { selector: "input" }));
    fireEvent.change(pinInput, { target: { value: "4179" } });
    fireEvent.submit(pinInput.closest("form")!);
    await waitFor(() => expect(confirmImport).toHaveBeenCalledOnce());
    expect(
      await screen.findByText(/أُبقيت 1 مسودة نموذج غير مُسلّمة/, undefined, { timeout: 3000 }),
    ).toBeTruthy();
    /* المسودة نفسها لم تُمس ولم تُستبدل — إعادة القراءة دليلًا. */
    const kept = await store.getFormDraft("asset:new");
    expect(kept.ok && (kept.value?.values as { name?: string }).name).toBe("مسودة محفوظة");
  });

  it("reset follows the declared draft policy and preserves the local lock", async () => {
    await localLock.enable("4179", 10);
    const drafts = new FormDraftService(store, () => NOW);
    await drafts.save("setup", null, { activityName: "مسودة إعداد" });
    window.localStorage.setItem(legacyFinanceDraftKey("loss_non_cash"), JSON.stringify({ note: "بقايا" }));
    await mountSettings();
    fireEvent.click(screen.getByRole("button", { name: "بدء مسار المشروع الجديد" }));
    /* بوابة الرمز أولًا (التصدير نفسه إجراء مغادرة بيانات) ثم التصدير
     * الإلزامي المُتحقق وتأكيد الاسم المكتوب. */
    const pinInput = await waitFor(() => screen.getByLabelText("رمز القفل", { selector: "input" }));
    fireEvent.change(pinInput, { target: { value: "4179" } });
    fireEvent.submit(pinInput.closest("form")!);
    await waitFor(() => expect(screen.getByText(/النسخة الاحتياطية جاهزة ومُتحقق منها/)).toBeTruthy());
    /* السياسة معلنة في نص التأكيد نفسه قبل أي مسح. */
    expect(screen.getByText(/مسودات النماذج غير المُسلّمة/)).toBeTruthy();
    expect(screen.getByText(/يبقى قفل التطبيق المحلي مفعّل/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/اكتب «ابدأ من جديد» للتأكيد/), {
      target: { value: "ابدأ من جديد" },
    });
    fireEvent.click(screen.getByRole("button", { name: "امسح وابدأ من جديد" }));
    /* التحقق مرة واحدة في الجلسة يفتح المسح النهائي بلا بوابة ثانية. */
    await waitFor(() => expect(resetAll).toHaveBeenCalledOnce());
    /* المسح جاء بعد التصفير فقط وبالسياسة المعلنة: المسودات والبقايا القديمة
     * زالت، وسجل القفل بقي كما هو — الحماية لا تُمس بإعادة التعيين. */
    await waitFor(async () => {
      const after = await store.listFormDrafts();
      expect(after.ok && after.value).toHaveLength(0);
    });
    expect(window.localStorage.getItem(legacyFinanceDraftKey("loss_non_cash"))).toBeNull();
    const status = await localLock.status();
    expect(status.ok && status.value.enabled).toBe(true);
  });

  it("no sensitive operation creates any network request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await localLock.enable("4179", 10);
    await mountSettings();
    /* تصدير مُتحقق. */
    fireEvent.click(screen.getByRole("button", { name: "تصدير البيانات المحلية" }));
    const pinInput = await waitFor(() => screen.getByLabelText("رمز القفل", { selector: "input" }));
    fireEvent.change(pinInput, { target: { value: "4179" } });
    fireEvent.submit(pinInput.closest("form")!);
    /* بدء مسار إعادة التعيين (بوابة الرمز ثم التصدير الإلزامي). */
    fireEvent.click(screen.getByRole("button", { name: "بدء مسار المشروع الجديد" }));
    const resetPin = await waitFor(() => screen.getByLabelText("رمز القفل", { selector: "input" }));
    fireEvent.change(resetPin, { target: { value: "4179" } });
    fireEvent.submit(resetPin.closest("form")!);
    await waitFor(() => expect(screen.getByText(/النسخة الاحتياطية جاهزة ومُتحقق منها/)).toBeTruthy());
    /* معاينة إدخال البداية. */
    pickFile(guidedFileInput(), JSON.stringify({}), "opening.json");
    await waitFor(() => expect(screen.getByText("لم نغير بياناتك بعد")).toBeTruthy());
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("the local diagnostics report copies manually with only safe fields — visibly local", async () => {
    await mountSettings();
    window.localStorage.setItem(
      "micro.diagnostics.v1",
      JSON.stringify([
        {
          errorId: "MIC-0123456789",
          appVersion: "micro-local-dev",
          schemaVersion: 35,
          routeTemplate: "/orders/:id",
          operation: "errorBoundary",
          errorCode: "render_crash",
          timestamp: NOW,
          safeMessage: "تعذر عرض الشاشة ولم تتغير أي بيانات.",
        },
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: "نسخ التقرير المحلي" }));
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledOnce());
    const copied = clipboardWrite.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(copied) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(["appVersion", "entries", "generatedAt", "schemaVersion"]);
    expect(parsed.entries as unknown[]).toHaveLength(1);
    expect(copied).not.toContain("pin");
    expect(copied).not.toContain("token");
    expect(await screen.findByText(/نُسخ تقرير التشخيص إلى الحافظة/)).toBeTruthy();
    expect(screen.getByText(/لا يُرسل شيء تلقائيًا/)).toBeTruthy();
  });
});
