/** @vitest-environment jsdom */

/* UNIT-001 V3 (مواصفة 2026-10-18 — قسم U001-ORG-20261018): بوابات القبول
 * التنظيمية الجديدة U001-ORG-AC01..03 وبوابة Q01 — اختبارات حتمية تربط كل
 * بوابة بدليل تشغيلي مسمّى باسمها (شرط DOC-008: «بدليل اختبار مستقل»).
 *
 * النطاق المستمد من مواصفة V3 وحدها:
 * - ORG-AC01: إتمام الاسم يفتح المشروع دون أثر مالي أو اشتراط حقول اختيارية.
 * - ORG-AC02: وجود بيانات سابقة أو فشل قراءتها لا ينشئ مشروعًا ثانيًا.
 * - ORG-AC03/Q01: الاستعادة وإلغاؤها والرجوع منها يحافظان على سياق الإعداد،
 *   ونجاحها يفتح المشروع المستعاد بلا هوية ثانية (مسار الاستعادة الفعلي:
 *   مدخل ثانوي في /setup يفوّض لمالك 044 القائم في /settings عبر عقد التنقل
 *   returnTo — لا صفحة استيراد ثانية في 001).
 *
 * دمج Q01 الحقيقي (موجة 2026-10-19 — تعليق المالك على PR #378): اختبارا
 * الاستعادة/الرفض هنا يقطعان المسار الفعلي كاملًا عبر مالك 044 الحي لا
 * محاكاة نتيجته: /setup (مسودة) → الرابط القانوني ‎/settings?returnTo=/setup
 * → صفحة الإعدادات الحقيقية (قسم حماية البيانات) → رفع ملف نسخة حقيقي عبر
 * حد الإدخال العام → prepareImport الفعلي (تحقق المظروف/الترحيل/العدادات)
 * → زر «استبدال البيانات المحلية» → (S02-B: بوابة رمز القفل أُلغيت بقرار
 * المالك — التأكيد الصريح بعد المراجعة وحده، والحماية تقنية داخل حد
 * الكتابة: نسخة رجوع دائمة وسياج ونية وجيل — بروتوكول S02-A) →
 * confirmImport/replaceSnapshot الفعليان على المخزن الحي (مع نسخة ما قبل
 * الاستبدال الدائمة) → زر الرجوع الحقيقي بعقد returnTo → /setup يكتشف الهوية
 * المستعادة ويفتح المشروع في الرئيسية. ملف النسخة نفسه يُصنَّع بالطريق
 * الإنتاجي الحقيقي على جهاز مصدر مستقل (إنشاء هوية عبر حد الإنشاء الإنتاجي
 * ثم createVerifiedExport): هذا هو السبيل الوحيد الصادق لوجود هوية داخل
 * ملف نسخة — ولا يستدعي حد الإنشاء إطلاقًا على جهاز الاختبار المستهدف؛
 * الهوية هناك لا تصل إلا عبر استبدال 044 (يُحرس بجواسيس المراقبة).
 *
 * القيود: لا تغيير إنتاج — هذا ملف اختبار فقط؛ نفس عدة اختبار الشاشة
 * (خدمات حقيقية فوق مخزن حقيقي عبر جسر formDraftTestHarness القانوني لطبقة
 * الصفحات) بلا مسودات وهمية للسلوك المفحوص؛ ساعة ثابتة محقونة (عقد الساعة
 * العام) فلا مؤقتات اعتباطية ولا شبكة ولا عشوائية. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { QuickRecordingProvider } from "@/app/quickRecording";
import { ProfileService } from "@/application/profile/profileService";
import { FormDraftService } from "@/application/drafts/formDraftService";
import { createFormDraftHarness } from "@/application/drafts/formDraftTestHarness";
import { LocalTransferService } from "@/application/transfers/localTransferService";
import { GuidedOpeningImportService } from "@/application/transfers/guidedOpeningImportService";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { StatementService } from "@/application/finance/statementService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { PreferenceService } from "@/application/preferences/preferenceService";
import { AgreementService } from "@/application/agreements/agreementService";
import { CostService } from "@/application/cost/costService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { CatalogService } from "@/application/catalog/catalogService";
import { ActualTimeService } from "@/application/time/actualTimeService";
import { DailyFollowUpService } from "@/application/follow-up/dailyFollowUpService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { ActivityService } from "@/application/activity/activityService";
import { HomeControlCenterService } from "@/application/home/homeControlCenterService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { ThemeProvider } from "@/contexts/ThemeContext";
import type { PrototypeLocalStore } from "@/storage/local/types";
import Setup from "@/pages/Setup";
import Settings from "@/pages/Settings";
import Home from "@/pages/Home";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

/* S02-A (SH-03): باني النسخة الرجوع المُتحقق منها للاختبار — من
 * خدمة النقل نفسها فوق المخزن نفسه (باني الإنتاج يُمرَّر من جذر التركيب). */
function testBackupBuilder(
  store: ConstructorParameters<typeof LocalTransferService>[0],
): ReturnType<typeof LocalTransferService.verifiedBackupBuilder> {
  return LocalTransferService.verifiedBackupBuilder(new LocalTransferService(store));
}

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/setup",
  search: "",
}));

vi.mock("wouter", () => ({
  useSearch: () => wouterMocks.search,
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => ({}),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

/* خدمات حقيقية فوق مخزن حقيقي — الهوية والمسودة والسجلات المالية تُقرأ من
 * المخزن نفسه بعد كل فعل؛ لا تخدم نقدية في السياق أصلًا (سلبي DUP-001). */
function setupServices(options: { store?: PrototypeLocalStore } = {}) {
  const store = options.store ?? createFormDraftHarness().store;
  const notifyDataChanged = vi.fn();
  const services = {
    profiles: new ProfileService(store),
    notifyDataChanged,
    formDrafts: new FormDraftService(store),
  } as unknown as ReturnType<typeof usePrototypeServices>;
  return { services, store, notifyDataChanged };
}

/* ── عدة الدمج الحقيقي لـQ01: ساعة ثابتة + حزمة خدمات كاملة حقيقية فوق
 * مخزن واحد (جهاز الاختبار) — الإعدادات/044 والإعداد والرئيسية تقرأ وتكتب
 * المخزن نفسه عبر الحدود العامة وحدها. ── */
const NOW = "2026-10-18T12:00:00.000Z";
const clock = () => NOW;
const RESTORED_NAME = "مشروع الاستعادة من النسخة";

function buildDeviceServices(store: PrototypeLocalStore) {
  const projectFinance = new ProjectFinancialService(store);
  const statement = new StatementService(store, projectFinance);
  return {
    profiles: new ProfileService(store, clock),
    notifyDataChanged: vi.fn(),
    formDrafts: new FormDraftService(store, clock),
    transfers: new LocalTransferService(store, clock),
    guidedOpeningImport: new GuidedOpeningImportService(store, testBackupBuilder(store), clock),
    integrityCheck: new IntegrityCheckService(
      store,
      projectFinance,
      statement,
      new CashContinuityService(store),
    ),
    preferences: new PreferenceService(store),
    agreements: new AgreementService(store, new CostService(store)),
    inventory: new InventoryMaterialService(store),
    supplierPurchases: new SupplierPurchaseService(store),
    catalog: new CatalogService(store),
    actualTime: new ActualTimeService(store),
    projectFinance,
    homeControlCenter: new HomeControlCenterService(
      store,
      new DailyFollowUpService(store),
      new ProjectFinancialService(store, clock),
      new SupplierPurchaseService(store, clock),
      new InventoryMaterialService(store, clock),
      new AgreementContextService(store, clock),
      new ActivityService(store),
      clock,
    ),
    dataVersion: 0,
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

/* ملف نسخة حقيقي من جهاز مصدر مستقل: هوية أُنشئت بالطريق الإنتاجي ثم
 * تصدير مُتحقق منه من 044 نفسه — المصنع الوحيد الصادق لملف نسخة يحمل
 * هوية. جهاز الاختبار لا يرى هذا المخزن إطلاقًا؛ يصل الملف نصًا فقط. */
async function buildVerifiedBackupFile() {
  const sourceStore = createFormDraftHarness(clock).store;
  const created = await new ProfileService(sourceStore, clock).create(RESTORED_NAME);
  if (!created.ok) throw new Error(created.message);
  const sourceIdentity = await sourceStore.getProfile();
  const sourceTransfers = new LocalTransferService(sourceStore, clock);
  const exported = await sourceTransfers.createVerifiedExport();
  if (!exported.ok) throw new Error(exported.message);
  return {
    backupJson: JSON.stringify(exported.value.file, null, 2),
    sourceIdentity: sourceIdentity.ok ? sourceIdentity.value : null,
  };
}

/* jsdom: files للقراءة فقط وBlob.text غائب — كعب القراءة هنا قانوني لأن
 * الإنتاج يقرأ الملفات في المتصفح الحقيقي حيث كلاهما موجود (نمط الأجنحة
 * القائمة نفسه). الإدخال نفسه (input[type=file]) حقيقي ومن صفحة 044. */
const pickFile = (input: HTMLInputElement, content: string, name: string) => {
  const file = new File([content], name, { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => content, configurable: true });
  fireEvent.change(input, { target: { files: [file] } });
};
const importFileInput = () =>
  Array.from(document.querySelectorAll('input[type="file"]'))[0] as HTMLInputElement;

const mountSettings = () => {
  render(
    <ThemeProvider defaultTheme="system" switchable>
      <Settings />
    </ThemeProvider>,
  );
  return waitFor(() => expect(screen.getByRole("heading", { name: "احمِ بياناتك" })).toBeTruthy());
};

const mountHome = () => {
  render(
    <QuickRecordingProvider>
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <Home />
      </UnsavedChangesProvider>
    </QuickRecordingProvider>,
  );
};

beforeEach(() => {
  wouterMocks.navigate.mockReset();
  wouterMocks.location = "/setup";
  wouterMocks.search = "";
});

afterEach(() => {
  cleanup();
  globalThis.localStorage?.clear();
});

/* ── U001-ORG-AC01: إتمام الاسم وحده يفتح المشروع بلا أثر مالي ── */
describe("UNIT-001 V3 ORG-AC01 — name completion opens the project, no financial effect, no optional-field requirement", () => {
  it("completing the name alone opens Home with exactly one identity and zero financial records (ORG-AC01)", async () => {
    const { services, store } = setupServices();
    const createSpy = vi.spyOn(services.profiles, "create");
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  حلويات ليان  " } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ وابدأ" }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/?setup=1", { replace: true }));
    /* هوية واحدة بالضبط بالاسم بعد trim. */
    expect(createSpy).toHaveBeenCalledTimes(1);
    const stored = await store.getProfile();
    expect(stored).toMatchObject({ ok: true, value: { activityName: "حلويات ليان" } });
    /* صفر أثر مالي: لا محافظ ولا أحداث ولا آثار افتتاح/تحويل/تصحيح. */
    const wallets = await store.listCashWallets();
    expect(wallets).toMatchObject({ ok: true, value: [] });
    const events = await store.listFinancialEvents();
    expect(events.ok).toBe(true);
    if (events.ok) expect(events.value).toHaveLength(0);
    const continuity = await store.listCashContinuityEntries();
    expect(continuity).toMatchObject({ ok: true, value: [] });
  });

  it("the form carries the name field alone — no optional field is conditioned for completion (ORG-AC01)", async () => {
    const { services } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    await screen.findByRole("heading", { name: "إعداد مشروعك" });
    /* كل الحقول النصية داخل النموذج = حقل الاسم وحده؛ لا حقل اختياري يُشترط
     * إكماله ولا أي إدخال نقدي إطلاقًا. */
    const form = document.querySelector("form.micro-setup-decision");
    expect(form).not.toBeNull();
    const inputs = Array.from(form!.querySelectorAll("input, select, textarea"));
    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.getAttribute("id")).toBe("setup-activity-name");
    expect(document.querySelector("input[type=file]")).toBeNull();
  });
});

/* ── U001-ORG-AC02: البيانات السابقة أو فشل القراءة لا ينشئان مشروعًا ثانيًا ── */
describe("UNIT-001 V3 ORG-AC02 — prior data or a read failure never creates a second project", () => {
  it("prior data opens the existing project and never invokes the create path (ORG-AC02)", async () => {
    const { services, store } = setupServices();
    await new ProfileService(store).create("مشروع قائم مسبقًا");
    const createSpy = vi.spyOn(services.profiles, "create");
    const saveSpy = vi.spyOn(services.profiles, "save");
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/", { replace: true }));
    expect(createSpy).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
    const stored = await store.getProfile();
    expect(stored).toMatchObject({ ok: true, value: { activityName: "مشروع قائم مسبقًا" } });
  });

  it("a failed read shows recovery — it is never treated as empty data and never written over (ORG-AC02)", async () => {
    const { services, store } = setupServices();
    const createSpy = vi.spyOn(services.profiles, "create");
    vi.spyOn(services.profiles, "load").mockResolvedValue({
      ok: false,
      code: "storage_error" as const,
      message: "read failed",
    });
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const recovery = await screen.findByTestId("setup-storage-recovery");
    expect(recovery.getAttribute("role")).toBe("alert");
    expect(screen.queryByLabelText("اسم المشروع")).toBeNull();
    expect(createSpy).not.toHaveBeenCalled();
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    /* المخزن نفسه لم يُمس: بلا هوية — فشل القراءة ليس بيانات فارغة. */
    const stored = await store.getProfile();
    expect(stored).toMatchObject({ ok: true, value: null });
  });

  it("two concurrent creators keep exactly one identity — the boundary itself forbids a second project (ORG-AC02/U001-IR-002)", async () => {
    const store = createFormDraftHarness().store;
    const windowA = new ProfileService(store);
    const windowB = new ProfileService(store);
    const [first, second] = await Promise.all([windowA.create("نافذة أولى"), windowB.create("نافذة ثانية")]);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      const winners = [first, second].filter(result => result.created);
      expect(winners).toHaveLength(1);
      /* الخاسر يستعيد الهوية القائمة نفسها — لا هوية ثانية ولا طمس. */
      expect(first.profile.id).toBe("local-profile");
      expect(second.profile.id).toBe("local-profile");
      expect(first.profile.activityName).toBe(second.profile.activityName);
    }
    const stored = await store.getProfile();
    expect(stored).toMatchObject({ ok: true, value: { id: "local-profile" } });
  });
});

/* ── U001-ORG-AC03 + Q01: الاستعادة وإلغاؤها يحافظان على السياق ── */
describe("UNIT-001 V3 ORG-AC03/Q01 — restore, cancel, back, failure, and second-identity behavior", () => {
  it("Q01 route: the restore entry delegates to the 044 owner with the exact legal return link (Q01/DUP-005)", async () => {
    const { services } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    await screen.findByRole("heading", { name: "إعداد مشروعك" });
    fireEvent.click(screen.getByRole("button", { name: "استعادة نسخة احتياطية" }));
    /* الرابط المحدد المسجل: مدخل ثانوي إلى مالك 044 في /settings عبر
     * returnTo=/setup — لا صفحة استيراد ثانية داخل 001 أبدًا. */
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/settings?returnTo=%2Fsetup");
    expect(document.querySelector("input[type=file]")).toBeNull();
  });

  it("Q01 cancel/back: leaving for restore and returning re-offers the draft — context kept, no identity created (ORG-AC03)", async () => {
    const { services, store } = setupServices();
    const createSpy = vi.spyOn(services.profiles, "create");
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "اسم قبل الاستعادة" } });
    await waitFor(async () => {
      const saved = await store.getFormDraft("setup:new");
      expect(saved.ok && saved.value).not.toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: "استعادة نسخة احتياطية" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/settings?returnTo=%2Fsetup");
    /* العودة من الاستعادة (إلغاء أو زر الرجوع في /settings): إعادة فتح /setup —
     * المسودة تُعرض صراحة والقيم لا تُطبق تلقائيًا. */
    cleanup();
    wouterMocks.navigate.mockReset();
    const returned = setupServices({ store });
    const returnedCreateSpy = vi.spyOn(returned.services.profiles, "create");
    mockedUsePrototypeServices.mockReturnValue(returned.services);
    render(<Setup />);
    const offer = await screen.findByTestId("setup-draft-offer");
    expect(offer.textContent).toContain("إعداد غير مكتمل");
    expect(offer.textContent).toContain("أكمل الإعداد");
    expect(offer.textContent).toContain("تجاهل المسودة");
    fireEvent.click(screen.getByRole("button", { name: "أكمل الإعداد" }));
    const inputAfterReturn = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    expect(inputAfterReturn.value).toBe("اسم قبل الاستعادة");
    expect(returnedCreateSpy).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
    const stored = await store.getProfile();
    expect(stored).toMatchObject({ ok: true, value: null });
  });

  /* الدليل الحقيقي المطلوب (تعليق المالك 2026-10-19): المسار الكامل عبر
   * مالك 044 الحي — لا محاكاة نتيجة الاستعادة بإنشاء مباشر على جهاز
   * الاختبار. المراحل: (أ) مسودة إعداد بلا هوية ثم التفويض القانوني،
   * (ب) صفحة الإعدادات الحقيقية: رفع الملف → prepareImport → بوابة رمز
   * القفل → confirmImport/replaceSnapshot → الرجوع بعقد returnTo،
   * (ج) العودة إلى /setup تكتشف الهوية المستعادة وتفتح الرئيسية،
   * (د) الرئيسية تعرض المشروع المستعاد. جواسيس المراقبة (بلا تغيير سلوك)
   * يثبتون أن حد الإنشاء/التعديل لم يُستدعَ على جهاز الاختبار إطلاقًا وأن
   * حد الاستبدال استُدعي مرة واحدة بالضبط. */
  it("Q01 real restore: Setup draft → 044 prepareImport + PIN-gated confirmImport/replaceSnapshot → returnTo back → Setup opens the restored project on Home — no second identity (Q01/ORG-AC03/R11)", async () => {
    /* جهاز مصدر مستقل يصنع ملف النسخة بالطريق الإنتاجي (لا يراه الجهاز
     * المستهدف إلا نصًا) — والهوية داخله هوية الإنتاج نفسها. */
    const { backupJson, sourceIdentity } = await buildVerifiedBackupFile();
    expect(sourceIdentity).not.toBeNull();
    /* جهاز الاختبار: مخزن فارغ بلا هوية + خدمات حقيقية واحدة فوقه. */
    const store = createFormDraftHarness(clock).store;
    const services = buildDeviceServices(store);
    const createSpy = vi.spyOn(services.profiles, "create");
    const saveSpy = vi.spyOn(services.profiles, "save");
    const replaceSnapshotSpy = vi.spyOn(store, "replaceSnapshot");
    mockedUsePrototypeServices.mockReturnValue(services);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    vi.stubGlobal(
      "URL",
      class MockBlobURL extends URL {
        static createObjectURL = vi.fn(() => "blob:mock");
        static revokeObjectURL = vi.fn();
      },
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    (globalThis.Element.prototype as { scrollIntoView?: () => void }).scrollIntoView ??= () => undefined;
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn(async () => undefined) },
      configurable: true,
    });
    try {
      /* (أ) الإعداد بلا هوية: مسودة اسم حقيقية ثم التفويض لمالك 044. */
      render(<Setup />);
      const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "مسودة قبل الاستعادة" } });
      await waitFor(async () => {
        const saved = await store.getFormDraft("setup:new");
        expect(saved.ok && saved.value).not.toBeNull();
      });
      const beforeRestore = await store.getProfile();
      expect(beforeRestore).toMatchObject({ ok: true, value: null });
      fireEvent.click(screen.getByRole("button", { name: "استعادة نسخة احتياطية" }));
      expect(wouterMocks.navigate).toHaveBeenCalledWith("/settings?returnTo=%2Fsetup");
      expect(createSpy).not.toHaveBeenCalled();
      cleanup();
      wouterMocks.navigate.mockReset();
      /* (ب) مالك 044 الحي (S02-B: بلا رمز — بوابة PIN أُلغيت بقرار المالك
       * 2026-10-24، وحماية الاستبدال تقنية داخل حد الكتابة): المسار الكامل
       * من الواجهة: ملف → معاينة → تأكيد صريح → استبدال محروس → رجوع. */
      wouterMocks.location = "/settings";
      wouterMocks.search = "?returnTo=%2Fsetup";
      await mountSettings();
      pickFile(importFileInput(), backupJson, "micro-backup.json");
      const confirmButton = await screen.findByRole("button", { name: "استبدال البيانات المحلية" });
      expect(screen.getByText("ملف نشاط واحد")).toBeTruthy();
      /* المعاينة قراءة خالصة: لا كتابة قبل التأكيد (عقد 044). */
      const afterPreview = await store.getProfile();
      expect(afterPreview).toMatchObject({ ok: true, value: null });
      expect(replaceSnapshotSpy).not.toHaveBeenCalled();
      fireEvent.click(confirmButton);
      /* الاستبدال الحقيقي تم: إشعار الإكمال + المسودة العابرة عُزلت مع
       * اللقطة القديمة في نسخة الرجوع الدائمة (S02-A/عقد ٠٤٤ B6 — لم تعد
       * تبقى فوق بيانات استُبدلت) + الفحص بعدها. */
      expect(await screen.findByText(/تم استبدال البيانات المحلية بالملف الذي راجعته/)).toBeTruthy();
      expect((await screen.findAllByText(/نسخة ما قبل الاستبدال جاهزة/)).length).toBeGreaterThan(0);
      expect(await screen.findByText(/فحص السلامة بعد الاستعادة/)).toBeTruthy();
      /* حد الالتزام الحقيقي: استبدال واحد بالضبط، والهوية الناتجة تطابق
       * هوية النسخة (المصدر) حرفيًا — لا ثانية ولا تعديل. */
      expect(replaceSnapshotSpy).toHaveBeenCalledTimes(1);
      const restored = await store.getProfile();
      expect(restored).toMatchObject({ ok: true, value: sourceIdentity });
      expect(createSpy).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
      /* النجاح لا يقفز من 044: بلا ملاحة تلقائية (اللقنة فيها ملف نشاط
       * فالقرار للمالك) — والرجوع يتم بالزر الحقيقي بعقد returnTo. */
      expect(wouterMocks.navigate).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "رجوع" }));
      expect(wouterMocks.navigate).toHaveBeenCalledWith("/setup");
      cleanup();
      wouterMocks.navigate.mockReset();
      /* (ج) العودة إلى /setup: بوابة الهوية تكتشف المستعاد وتفتح المشروع
       * فورًا — بلا إنشاء ولا تعديل ولا مسح للمسودة. */
      wouterMocks.location = "/setup";
      wouterMocks.search = "";
      render(<Setup />);
      await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/", { replace: true }));
      expect(createSpy).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
      const afterReturn = await store.getProfile();
      expect(afterReturn).toMatchObject({ ok: true, value: sourceIdentity });
      /* S02-A (عقد ٠٤٤ B6): مسودة الإعداد العابرة لم تعد تُستأنف فوق المشروع
       * المستعاد — عُزلت مع اللقطة القديمة في نسخة الرجوع الدائمة. */
      const draft = await store.getFormDraft("setup:new");
      expect(draft).toMatchObject({ ok: true, value: null });
      cleanup();
      wouterMocks.navigate.mockReset();
      /* (د) الرئيسية تفتح المشروع المستعاد نفسه من المصدر الواحد. */
      wouterMocks.location = "/";
      wouterMocks.search = "";
      mountHome();
      expect(await screen.findByRole("heading", { level: 1, name: RESTORED_NAME })).toBeTruthy();
      expect(screen.queryByText("تعذر تحميل مشروعك")).toBeNull();
      const finalProfile = await store.getProfile();
      expect(finalProfile).toMatchObject({ ok: true, value: sourceIdentity });
      expect(createSpy).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      cleanup();
    }
  });

  /* الرفض الحقيقي من 044 نفسه: ملف ليس ملف Micro يُرفض عند prepareImport
   * برسالة الخدمة الحرفية قبل أي بوابة أو كتابة — اللقطة الكاملة تبقى
   * متطابقة حرفيًا (لا كتابة جزئية) والعودة تحافظ على سياق الإعداد. */
  it("Q01 real rejection: a non-Micro file is rejected by the real 044 boundary — no partial write, no confirm boundary reached, Setup context preserved (Q01/ORG-AC03)", async () => {
    const store = createFormDraftHarness(clock).store;
    const services = buildDeviceServices(store);
    const createSpy = vi.spyOn(services.profiles, "create");
    const replaceSnapshotSpy = vi.spyOn(store, "replaceSnapshot");
    mockedUsePrototypeServices.mockReturnValue(services);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    vi.stubGlobal(
      "URL",
      class MockBlobURL extends URL {
        static createObjectURL = vi.fn(() => "blob:mock");
        static revokeObjectURL = vi.fn();
      },
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    (globalThis.Element.prototype as { scrollIntoView?: () => void }).scrollIntoView ??= () => undefined;
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn(async () => undefined) },
      configurable: true,
    });
    try {
      /* (أ) مسودة إعداد حقيقية ثم التفويض لمالك 044. */
      render(<Setup />);
      const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "مسودة بعد رفض الملف" } });
      await waitFor(async () => {
        const saved = await store.getFormDraft("setup:new");
        expect(saved.ok && saved.value).not.toBeNull();
      });
      fireEvent.click(screen.getByRole("button", { name: "استعادة نسخة احتياطية" }));
      expect(wouterMocks.navigate).toHaveBeenCalledWith("/settings?returnTo=%2Fsetup");
      cleanup();
      wouterMocks.navigate.mockReset();
      /* (ب) مالك 044 الحي: ملف أجنبي → رفض prepareImport الحقيقي برسالته
       * الحرفية — لا معاينة ولا زر استبدال ولا أي كتابة. */
      wouterMocks.location = "/settings";
      wouterMocks.search = "?returnTo=%2Fsetup";
      const snapshotBefore = (await store.readSnapshot()) as { ok: boolean; value: unknown };
      await mountSettings();
      pickFile(
        importFileInput(),
        JSON.stringify({ format: "other-app", version: 1, data: {} }),
        "not-a-micro-backup.json",
      );
      expect(
        await screen.findByText("هذا ليس ملف تصدير Micro المحلي. بقيت بيانات هذا الجهاز دون تغيير."),
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: "استبدال البيانات المحلية" })).toBeNull();
      expect(replaceSnapshotSpy).not.toHaveBeenCalled();
      const snapshotAfter = (await store.readSnapshot()) as { ok: boolean; value: unknown };
      expect(snapshotAfter).toEqual(snapshotBefore);
      const stillEmpty = await store.getProfile();
      expect(stillEmpty).toMatchObject({ ok: true, value: null });
      /* الرجوع الحقيقي بعقد returnTo ثم سياق الإعداد محفوظ كما هو. */
      fireEvent.click(screen.getByRole("button", { name: "رجوع" }));
      expect(wouterMocks.navigate).toHaveBeenCalledWith("/setup");
      cleanup();
      wouterMocks.navigate.mockReset();
      /* (ج) العودة: عرض المسودة الصريح وقيمها سليمة — بلا هوية إطلاقًا. */
      wouterMocks.location = "/setup";
      wouterMocks.search = "";
      render(<Setup />);
      const offer = await screen.findByTestId("setup-draft-offer");
      expect(offer.textContent).toContain("إعداد غير مكتمل");
      fireEvent.click(screen.getByRole("button", { name: "أكمل الإعداد" }));
      const inputAfterReturn = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
      expect(inputAfterReturn.value).toBe("مسودة بعد رفض الملف");
      expect(createSpy).not.toHaveBeenCalled();
      expect(wouterMocks.navigate).not.toHaveBeenCalled();
      const stored = await store.getProfile();
      expect(stored).toMatchObject({ ok: true, value: null });
    } finally {
      vi.unstubAllGlobals();
      cleanup();
    }
  });
});
