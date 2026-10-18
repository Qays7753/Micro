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
 * القيود: لا تغيير إنتاج — هذا ملف اختبار فقط؛ نفس عدة اختبار الشاشة
 * (خدمات حقيقية فوق مخزن حقيقي) بلا مسودات وهمية للسلوك المفحوص. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { ProfileService } from "@/application/profile/profileService";
import { FormDraftService } from "@/application/drafts/formDraftService";
import { createFormDraftHarness } from "@/application/drafts/formDraftTestHarness";
import type { PrototypeLocalStore } from "@/storage/local/types";
import Setup from "@/pages/Setup";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => ["/setup", wouterMocks.navigate],
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

beforeEach(() => {
  wouterMocks.navigate.mockReset();
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

  it("Q01 restore success: a profile restored while away opens the restored project on return — no second identity (ORG-AC03/R11)", async () => {
    const { services, store } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "اسم محلي مؤقت" } });
    await waitFor(async () => {
      const saved = await store.getFormDraft("setup:new");
      expect(saved.ok && saved.value).not.toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: "استعادة نسخة احتياطية" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/settings?returnTo=%2Fsetup");
    cleanup();
    wouterMocks.navigate.mockReset();
    /* الاستعادة نجحت في /settings (ملك 044): replaceSnapshot كتب هوية النسخة
     * خلف شاشة الإعداد — نحاكي أثر الكتابة النهائي هنا بالطريق القانوني نفسه
     * (كتابة الهوية عبر حد التخزين) ثم نعود إلى /setup كما يفعل زر الرجوع. */
    await new ProfileService(store).create("المشروع المستعاد");
    const returned = setupServices({ store });
    const returnedCreateSpy = vi.spyOn(returned.services.profiles, "create");
    mockedUsePrototypeServices.mockReturnValue(returned.services);
    render(<Setup />);
    /* العودة تفتح المشروع المستعاد — لا إنشاء ولا تعديل ولا هوية ثانية. */
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledWith("/", { replace: true }));
    expect(returnedCreateSpy).not.toHaveBeenCalled();
    const stored = await store.getProfile();
    expect(stored).toMatchObject({
      ok: true,
      value: { id: "local-profile", activityName: "المشروع المستعاد" },
    });
    /* المسودة المحلية تبقى مسودة (خارج اللقطة — عقد ٣٦) ولا تصير هوية أبدًا. */
    const draft = await store.getFormDraft("setup:new");
    expect(draft).toMatchObject({
      ok: true,
      value: { values: { activityName: "اسم محلي مؤقت" } },
    });
  });

  it("Q01 restore failure: nothing written while away — return shows the setup with the draft intact, no recovery lie (ORG-AC03)", async () => {
    const { services, store } = setupServices();
    mockedUsePrototypeServices.mockReturnValue(services);
    render(<Setup />);
    const input = (await screen.findByLabelText("اسم المشروع")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "اسم بعد فشل الاستعادة" } });
    await waitFor(async () => {
      const saved = await store.getFormDraft("setup:new");
      expect(saved.ok && saved.value).not.toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: "استعادة نسخة احتياطية" }));
    cleanup();
    wouterMocks.navigate.mockReset();
    /* فشل الاستعادة/الإلغاء في /settings لم يكتب شيئًا — العودة تجد الفراغ
     * الحقيقي نفسه: الإعداد سليم والمسودة معروضة ولا استرداد كذبًا. */
    const returned = setupServices({ store });
    const returnedCreateSpy = vi.spyOn(returned.services.profiles, "create");
    mockedUsePrototypeServices.mockReturnValue(returned.services);
    render(<Setup />);
    const offer = await screen.findByTestId("setup-draft-offer");
    expect(offer.textContent).toContain("إعداد غير مكتمل");
    expect(screen.queryByTestId("setup-storage-recovery")).toBeNull();
    expect(returnedCreateSpy).not.toHaveBeenCalled();
    const stored = await store.getProfile();
    expect(stored).toMatchObject({ ok: true, value: null });
    const draft = await store.getFormDraft("setup:new");
    expect(draft).toMatchObject({
      ok: true,
      value: { values: { activityName: "اسم بعد فشل الاستعادة" } },
    });
  });
});
