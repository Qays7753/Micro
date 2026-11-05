/** @vitest-environment jsdom */

/* UNIT-013 (تنفيذ S15 بالأمر الموحد §5) — حارس لوحة «وظائف المالية» وخلفها
 * قرار إلغاء استقلال دليل «المزيد» (014):
 * - AF-AC01: المالية تفتح بلوحة مغلقة؛ التسجيل والأرقام والكشف ظاهرون.
 * - AF-AC02: الزر مسمى واللوحة تعرض المجموعات الست و15 مدخلًا بلا قائمة ثالثة.
 * - AF-AC03/عقد ٢٦ قاعدة ٤: كل مدخل يفتح أصله بreturnTo=/finance.
 * - AF-AC05: كشف الفترة من اللوحة بنطاق 013 المطبق نفسه.
 * - AF-AC07: الإغلاق (زر/Escape) يعيد التركيز لزر اللوحة.
 * - AF-AC09: لا قروض أو مشاركة أو توقعات مؤجلة أو أدوات تخطيط داخل المالية؛
 *   الروابط القديمة محفوظة: /finance/more إحالة إلى المالية (تصنيف المسار
 *   يثبته routeKnowledgeSync، والرندر الفعلي للمسار يحرسه R2.renderSmoke).
 * - 013B: مدخل ميزانيات المصروف سياقي إلى قسمها في الصفحة نفسها — لا وجهة.
 * - S15-MR-001 (إصلاح جذري بعد مراجعة S15): رجوع الهاتف/المتصفح أثناء فتح
 *   اللوحة يغلقها وحدها — entry تاريخي واحد مملوك للوحة عند الفتح (نمط
 *   Setup.tsx القائم)، وإغلاق غير-Back (زر/Escape/مدخل) يستهلكه بلا تراكم،
 *   والمغادرة والتنظيف لا يتركان stale يبتلع رجوعًا لاحقًا.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { canonicalReturnFor, withReturnTo } from "@/app/navigationContract";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { CorrectionHistoryService } from "@/application/financial-records/correctionHistoryService";
import { OwnerEntitlementService } from "@/application/owner-money/ownerEntitlementService";
import { G5Service } from "@/application/financial-analysis/financialAnalysisService";
import { FinancialPulseService } from "@/application/financial-pulse/financialPulseService";
import { ProfitToCashBridgeService } from "@/application/finance/profitToCashBridgeService";
import { ProfileService } from "@/application/profile/profileService";
import { todayInAmman } from "@/application/time";
import Finance from "@/pages/Finance";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/finance",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-12T09:00:00.000Z";

let store: MemoryLocalStore;
let dataVersion = 0;

function buildServices() {
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  return {
    projectFinance,
    correctionHistory: new CorrectionHistoryService(store),
    ownerEntitlement: new OwnerEntitlementService(
      store,
      (from, to) => projectFinance.readRecordedPeriodResult(from, to),
      () => NOW,
    ),
    g5: new G5Service(store, projectFinance, () => NOW),
    financialPulse: new FinancialPulseService(store),
    inventory: new InventoryMaterialService(store, () => NOW),
    profitToCashBridge: new ProfitToCashBridgeService(store, () => NOW),
    cashContinuity: new CashContinuityService(store, () => NOW),
    dataVersion,
    notifyDataChanged: () => {
      dataVersion += 1;
    },
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  dataVersion = 0;
  /* jsdom لا ينفّذ scrollIntoView — مدخل 013B السياقي يكشف قسم الميزانيات
   * في الصفحة نفسها؛ التعويض القياسي للبيئة لا تخفيفًا للأثر. */
  Element.prototype.scrollIntoView = vi.fn();
  mockedUsePrototypeServices.mockReturnValue(buildServices());
});

afterEach(() => {
  delete (Element.prototype as Partial<Element>).scrollIntoView;
  cleanup();
  vi.clearAllMocks();
});

async function seedProfile() {
  const result = await new ProfileService(store, () => NOW).create("مشغل اختبار اللوحة");
  if (!result.ok) throw new Error(result.message);
}

function renderFinance() {
  return render(
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <Finance />
    </UnsavedChangesProvider>,
  );
}

/** فتح الفهرس من زره الظاهر — تُعاد بعد جاهزية الصفحة. F-005/UXR-03:
 * المشغّل الظاهر واحد («كل الوظائف») — رابط الحقيقة أسفل الصفحة أُذيب
 * في الفهرس فلا مشغّل ثانٍ لنفس الوظيفة. */
async function openBoard() {
  const button = await screen.findByRole("button", { name: "كل الوظائف" });
  fireEvent.click(button);
  return screen.getByRole("dialog", { name: "وظائف المالية" }) as HTMLElement;
}

describe("UNIT-013 — لوحة وظائف المالية (AF-B) وإلغاء استقلال 014 (AF-D)", () => {
  it("AF-AC01: المالية تفتح بلوحة مغلقة — التسجيل والأرقام ظاهرة ولا لوحة بلا طلب", async () => {
    await seedProfile();
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    /* اللوحة مغلقة أولًا: لا مجموعات ولا مداخل قبل الطلب. */
    expect(screen.queryByRole("dialog")).toBeNull();
    /* أفعال التسجيل الثلاثة ظاهرة بلا فتح الفهرس (لا يفتح الفهرس للتسجيل الأساسي)
     * — المحتوى الحرفي لعقد 02-FIN: «بيع»/«مصروف»/«شراء» (F-002: المصروف
     * يفتح سؤال حالة الدفع — لا وجهة مباشرة). */
    for (const label of ["بيع", "مصروف", "شراء"]) {
      expect(screen.getAllByRole("button", { name: new RegExp(label) }).length).toBeGreaterThan(0);
    }
    /* مشغّل الفهرس مسمى وواضح وواحد — لا رابط ثانٍ لنفس الوظيفة (F-005). */
    expect(await screen.findAllByRole("button", { name: "كل الوظائف" })).toHaveLength(1);
  });

  it("AF-AC02/AC09 + 02-FIN/F-016: فهرس الوظائف الكنوني — خمس مجموعات و19 مدخلًا مسمى بلا قروض أو مشاركة أو توقعات", async () => {
    await seedProfile();
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    const board = await openBoard();
    /* المجموعات الخمس الكنونية من عقد 02-FIN «فهرس الوظائف» — تنظيم وصول
     * لا كيانات جديدة؛ الفرق عن Vالس15: دمج مدخلَي /suppliers المتكررين
     * (F-016)، ونقل «سجل العمليات» و«مال المالك» و«المشتريات» إلى
     * مجموعاتهم القانونية، وإضافة «عدّ الصندوق» المنتقل من جذر المالية،
     * ومداخل سياقية لأقسام الطبقة الثانية (مستحقات عليك/الجسر/التعادل/
     * السياسات) بنمط 013B القائم. */
    for (const group of [
      "التسجيل والسجلات",
      "النقد والمستحقات",
      "التقارير والتخطيط",
      "المنتجات والجهات",
      "المخزون والأصول عند الحاجة",
    ]) {
      expect(within(board).getByRole("heading", { level: 3, name: group })).toBeTruthy();
    }
    const entries = within(board)
      .getAllByRole("button", { name: /.+/ })
      .filter(node => !node.textContent?.includes("إغلاق"));
    /* 19 مدخلًا مسمى — لا زر مستقل لكل مكوّن ولا قائمة ثالثة ولا مدخل
     * مكرر لوجهة واحدة بنية واحدة (F-016). */
    expect(entries).toHaveLength(19);
    /* لا ازدواج وجهات: مدخل واحد فقط يفتح /suppliers (سجل الشراء والدفع). */
    const suppliersEntries = entries.filter(
      node =>
        node.getAttribute("class") === "micro-functions-board-entry" &&
        node.textContent?.includes("المشتريات"),
    );
    expect(within(board).getAllByRole("button", { name: /المشتريات/ })).toHaveLength(1);
    /* القدرات المتوقفة/المؤجلة غائبة من المالية كلها — لا إعادة إدراج من الدليل القديم. */
    const boardText = board.textContent ?? "";
    for (const forbidden of ["قرض", "اقتراض", "مشاركة", "توقع", "سحب آمن", "أمانة"]) {
      expect(boardText.includes(forbidden), `كلمة ممنوعة داخل اللوحة: ${forbidden}`).toBe(false);
    }
  });

  it("عقد ٢٦ قاعدة ٤ + F-003: المداخل تنتقل فعليًا فوق مدخل الحارس — بلا back() مؤجل وبreturnTo=/finance", async () => {
    await seedProfile();
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    const backSpy = vi.spyOn(history, "back").mockImplementation(() => {});
    try {
      /* كل مدخل يفتح من لوحة حية (اللوحة تُغلق خلف كل تنقل — AF-C) فتُعاد
       * فتحًا لكل هدف بترتيب الاستدعاءات الحي. */
      const openEntry = async (label: string) => {
        const board = await openBoard();
        /* 02-FIN: أسماء المداخل الفعلية — الارتكاز على بداية الاسم يمنع
         * التقاط «فرق النقد والنتيجة» عند فتح «النقد» مثلًا. */
        fireEvent.click(within(board).getByRole("button", { name: new RegExp(`^${label}`) }));
      };
      const cases: readonly (readonly [string, string])[] = [
        ["النقد", "/cash"],
        ["لك عند العملاء", "/finance/upcoming?kind=receivable"],
        ["المشتريات", "/suppliers"],
        ["سجل العمليات", "/finance/activity"],
        ["مال المالك", "/finance/owner-entitlement"],
        ["المخزون", "/inventory"],
        ["عدّ الصندوق", "/cash/count"],
      ];
      for (const [label, target] of cases) {
        wouterMocks.navigate.mockClear();
        backSpy.mockClear();
        await openEntry(label);
        /* F-003 (المصدر: المسح الشامل 2026-11-04): الرابط النهائي يصل وجهته
         * فعليًا — لا back() مؤجلًا يُنفّذ بعد pushState فيسحب المستخدم من
         * وجهته الجديدة إلى /finance. */
        expect(wouterMocks.navigate).toHaveBeenCalledWith(withReturnTo(target, "/finance"));
        expect(backSpy).not.toHaveBeenCalled();
      }
      /* كل تنقل أغلق اللوحة أولًا (AF-AC03: لا حفظ ولا كتابة من الفتح نفسه). */
      expect(screen.queryByRole("dialog")).toBeNull();
    } finally {
      backSpy.mockRestore();
    }
  });

  it("AF-AC05: كشف الفترة من اللوحة بنطاق 013 المطبق نفسه لا الافتراضي المستقل", async () => {
    await seedProfile();
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    const board = await openBoard();
    const month = todayInAmman().slice(0, 7);
    const statementEntry = within(board).getByRole("button", { name: /كشف الفترة/ });
    fireEvent.click(statementEntry);
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      withReturnTo(`/finance/statement?from=${month}&to=${month}`, "/finance"),
    );
  });

  it("UNIT-013B: مدخل ميزانيات المصروف سياقي — يكشف قسمها بعد استقرار المساحة الفرعية بلا back() ولا وجهة جديدة", async () => {
    await seedProfile();
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    const backSpy = vi.spyOn(history, "back").mockImplementation(() => {});
    try {
      const board = await openBoard();
      backSpy.mockClear();
      fireEvent.click(within(board).getByRole("button", { name: /ميزانيات المصروف/ }));
      /* F-003: لا تنقل ولا back() — القسم موجود في الصفحة نفسها (سطح 013B
       * واحد بموضع واحد)، والكشف يُجدولة إطارًا بعد إغلاق اللوحة فيثبت فوق 0
       * ولا يستعيد المتصفح تمرير مدخل الحارس لإلغائه. */
      expect(wouterMocks.navigate).not.toHaveBeenCalled();
      expect(backSpy).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).toBeNull();
      await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: "start" }));
      expect(screen.getByRole("region", { name: "ميزانيات المصروف" })).toBeTruthy();
    } finally {
      backSpy.mockRestore();
    }
  });

  it("AF-AC07: الإغلاق (زر/Escape) يعيد التركيز لزر اللوحة ولا يغير شيئًا آخر", async () => {
    await seedProfile();
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    await openBoard();
    const functionsButton = screen.getByRole("button", { name: "كل الوظائف" });
    /* الإغلاق بزر «إغلاق». */
    fireEvent.click(screen.getByRole("button", { name: /إغلاق/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(functionsButton);
    /* الإغلاق بEscape. */
    fireEvent.click(functionsButton);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(functionsButton);
  });

  it("AF-AC09: الروابط القديمة محفوظة — بدائل قانونية موثقة بعد إلغاء استقلال 014", () => {
    /* مسار /finance/more بقي حيًا كإحالة إلى المالية (يثبته تصنيف المسارات
     * في routeKnowledgeSync ورندره الفعلي في R2.renderSmoke)؛ بديله الكنوني
     * هو المالية نفسها. */
    expect(canonicalReturnFor("/finance/more")).toBe("/finance");
    /* S17 (DOC-026 / UNIT-033): بديل فحص البيانات الكنوني صار الإعدادات —
     * بيت «فحص البيانات» الجديد داخلها والمسار المستقل يوجه إليها. */
    expect(canonicalReturnFor("/tools/integrity")).toBe("/settings");
    /* وجهة غير صالحة تسقط للبديل العام — لا حلقة (قاعدة §2.1-6). */
    expect(canonicalReturnFor("/finance/more?returnTo=/finance/more")).toBe("/finance");
  });
});

/* ── S15-MR-001 (إصلاح جذري): رجوع الهاتف/المتصفح يغلق اللوحة وحدها ──
 * الأحمر أولًا: تثبت هذه المجموعة الغيابَ قبل أي تعديل منتج (الدليل المرجعي
 * في 20a-S15-REVIEW-ADDENDUM-2026-11-03.md). نمط الاختبار هو نمط Setup.tsx
 * القائم: PopStateEvent لرجوع الهاتف، وspy على history.back لأن jsdom لا
 * ينفّذ أثر back على الحالة (المتصفح الحقيقي يسلّم pop غير المتزامن لتوه —
 * يحاكيه الاختبار صراحة بعد كل إغلاق غير-Back كما في Setup.ui.test.tsx). */
describe("S15-MR-001 — رجوع الهاتف/المتصفح يغلق اللوحة وحدها بلا أثر آخر", () => {
  /** يسلّم pop غير المتزامن الذي كان history.back سيولّده في المتصفح الحقيقي
   * بعد إغلاق غير-Back — jsdom لا ينفّذ أثر back فيجب إيصاله يدويًا. */
  function deliverPendingBackPop() {
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
  }

  it("الفتح يملك entry واحد للوحة وBack يغلقها وحدها — لا تنقل ولا كتابة والفترة محفوظة والتركيز يعود", async () => {
    await seedProfile();
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    const functionsButton = screen.getByRole("button", { name: "كل الوظائف" });
    await openBoard();
    /* فتح اللوحة يملك entry تاريخي واحدًا لهذه الحالة (نفس الصفحة) — لا أكثر. */
    expect((history.state as { microFinanceBoard?: boolean } | null)?.microFinanceBoard === true).toBe(true);
    /* رجوع الهاتف/المتصفح: المتصفح نزع الـentry وسلّم popstate. */
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    /* يغلق اللوحة وحدها: لا تنقل (المسار /finance باقٍ)، لا كتابة بيانات،
     * والتركيز يعود لمشغّل الفتح (AF-AC07 نفسه على مسار Back). */
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    expect(dataVersion).toBe(0);
    expect(document.activeElement).toBe(functionsButton);
    /* الفترة المطبقة لم تتأثر: إعادة الفتح تحمل كشف الفترة النطاق نفسه. */
    const month = todayInAmman().slice(0, 7);
    const board = await openBoard();
    wouterMocks.navigate.mockClear();
    fireEvent.click(within(board).getByRole("button", { name: /كشف الفترة/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      withReturnTo(`/finance/statement?from=${month}&to=${month}`, "/finance"),
    );
    /* مدخل اللوحة إغلاق غير-Back — يستهلك الـentry (يُثبت في الحالة التالية). */
    expect(screen.queryByRole("dialog")).toBeNull();
    deliverPendingBackPop();
  });

  it("إغلاق غير-Back (زر/Escape) يستهلك الـentry — ورجوع لاحق لا يُبتلع", async () => {
    /* jsdom لا ينفّذ أثر history.back على الحالة — الاستهلاك يُثبت بنداء
     * الواجهة نفسها (نمط Setup.ui.test.tsx). */
    const backSpy = vi.spyOn(history, "back").mockImplementation(() => {});
    try {
      await seedProfile();
      renderFinance();
      expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
      /* الإغلاق بزر «إغلاق» يستهلك الـentry تاريخي متزامنًا مع الإغلاق. */
      await openBoard();
      fireEvent.click(screen.getByRole("button", { name: /إغلاق/ }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(backSpy).toHaveBeenCalledTimes(1);
      /* المتصفح الحقيقي يسلّم pop غير المتزامن لذلك back — لا أثر مرئيًا. */
      deliverPendingBackPop();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(backSpy).toHaveBeenCalledTimes(1);
      /* رجوع لاحق بعد إغلاق غير-Back لا يُبتلع: فتح جديد ثم Back يغلق وحده. */
      const functionsButton = screen.getByRole("button", { name: "كل الوظائف" });
      fireEvent.click(functionsButton);
      await screen.findByRole("dialog", { name: "وظائف المالية" });
      backSpy.mockClear();
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(backSpy).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(functionsButton);
      /* مسار Escape نفسه: يستهلك الـentry مرة واحدة ويعيد التركيز. */
      fireEvent.click(functionsButton);
      await screen.findByRole("dialog", { name: "وظائف المالية" });
      backSpy.mockClear();
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(backSpy).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(functionsButton);
      deliverPendingBackPop();
    } finally {
      backSpy.mockRestore();
    }
  });

  it("دورات فتح/إغلاق متكررة لا تتراكم — pushState واحد لكل فتح وback واحد لكل إغلاق غير-Back", async () => {
    /* spy بلا mockImplementation: السلوك الحقيقي يبقى (history.state يعمل)
     * والعدّ يثبت عدم التراكم عبر الدورات. */
    const pushSpy = vi.spyOn(history, "pushState");
    const backSpy = vi.spyOn(history, "back").mockImplementation(() => {});
    try {
      await seedProfile();
      renderFinance();
      expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
      /* دورة ١ و٢: فتح ثم Back. */
      for (let cycle = 1; cycle <= 2; cycle += 1) {
        await openBoard();
        window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        expect(pushSpy).toHaveBeenCalledTimes(cycle);
        expect((history.state as { microFinanceBoard?: boolean } | null)?.microFinanceBoard === true).toBe(
          true,
        );
      }
      /* دورة ٣: فتح ثم إغلاق بالزر — الاستهلاك عبر back لا عبر pop. */
      await openBoard();
      expect(pushSpy).toHaveBeenCalledTimes(3);
      fireEvent.click(screen.getByRole("button", { name: /إغلاق/ }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(backSpy).toHaveBeenCalledTimes(1);
      deliverPendingBackPop();
      /* بعد ثلاث دورات: لا sentinel نشط — فتح رابع يحصل على entry جديد واحد. */
      await openBoard();
      expect(pushSpy).toHaveBeenCalledTimes(4);
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    } finally {
      pushSpy.mockRestore();
      backSpy.mockRestore();
    }
  });

  it("مغادرة الشاشة واللوحة مفتوحة تعلّم الحارس مستهلكًا بلا back() وتنظف المستمع — لا اجتياح مؤجل لوجهة جديدة", async () => {
    /* F-003: المغادرة عبر تنقل خارجي (الشريط السفلي مثلًا) واللوحة مفتوحة —
     * back() المؤجل كان سينفّذ بعد وصول الوجهة الجديدة فيسحب المستخدم
     * إليها. العقد الجديد: تعليم الحارس مستهلكًا فقط؛ مدخل الحارس يبقى
     * /finance نفسه فرجوع الهاتف من الوجهة يسقط عليه (سلوك returnTo
     * المرجو) ولا يُبتلع رجوع لاحق ولا يُسحب المستخدم. */
    const backSpy = vi.spyOn(history, "back").mockImplementation(() => {});
    try {
      await seedProfile();
      const view = renderFinance();
      expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
      await openBoard();
      view.unmount();
      expect(backSpy).not.toHaveBeenCalled();
      /* المستمع انطفأ: popstate لاحق بعد المغادرة خامل — لا back إضافي. */
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
      expect(backSpy).not.toHaveBeenCalled();
    } finally {
      backSpy.mockRestore();
    }
  });
});
