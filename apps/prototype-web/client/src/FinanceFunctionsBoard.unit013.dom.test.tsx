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
 */
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

/** فتح اللوحة من زرها الظاهر — تُعاد بعد جاهزية الصفحة. الزر الظاهر في
 * أعمال الصفحة هو الأول؛ رابط الحقيقة أسفل الصفحة يفتح اللوحة نفسها. */
async function openBoard() {
  const [button] = await screen.findAllByRole("button", { name: /وظائف المالية/ });
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
    /* أفعال التسجيل الثلاثة ظاهرة بلا فتح اللوحة (لا تفتح اللوحة لتسجيل الأساسي). */
    for (const label of ["تسجيل بيع", "تسجيل مصروف", "تسجيل شراء"]) {
      expect(screen.getAllByRole("button", { name: new RegExp(label) }).length).toBeGreaterThan(0);
    }
    /* زر اللوحة مسمى وواضح — أعلى الصفحة ورابط الحقيقة يفتحانه معًا. */
    expect((await screen.findAllByRole("button", { name: /وظائف المالية/ })).length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("AF-AC02/AC09: المجموعات الست و15 مدخلًا مسمى — بلا قروض أو مشاركة أو توقعات", async () => {
    await seedProfile();
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    const board = await openBoard();
    for (const group of [
      "تسجيل عملية",
      "النقد والمستحقات",
      "الكشوف والسجلات",
      "المنتجات والجهات",
      "مال المالك",
      "عند الحاجة",
    ]) {
      expect(within(board).getByRole("heading", { level: 3, name: group })).toBeTruthy();
    }
    const entries = within(board)
      .getAllByRole("button", { name: /.+/ })
      .filter(node => !node.textContent?.includes("إغلاق"));
    /* 15 مدخلًا مسمى — لا زر مستقل لكل مكوّن ولا قائمة ثالثة. */
    expect(entries).toHaveLength(15);
    /* القدرات المتوقفة/المؤجلة غائبة من المالية كلها — لا إعادة إدراج من الدليل القديم. */
    const boardText = board.textContent ?? "";
    for (const forbidden of ["قرض", "اقتراض", "مشاركة", "توقع", "سحب آمن", "أمانة"]) {
      expect(boardText.includes(forbidden), `كلمة ممنوعة داخل اللوحة: ${forbidden}`).toBe(false);
    }
  });

  it("عقد ٢٦ قاعدة ٤: المداخل تفتح أصحابها بreturnTo=/finance واللوحة تُغلق خلفها", async () => {
    await seedProfile();
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    /* كل مدخل يفتح من لوحة حية (اللوحة تُغلق خلف كل تنقل — AF-C) فتُعاد
     * فتحًا لكل هدف بترتيب الاستدعاءات الحي. */
    const openEntry = async (label: string) => {
      const board = await openBoard();
      fireEvent.click(within(board).getByRole("button", { name: new RegExp(label) }));
    };
    const cases: readonly (readonly [string, string])[] = [
      ["النقد", "/cash"],
      ["ديون العملاء", "/finance/upcoming"],
      ["سجل العمليات", "/finance/activity"],
      ["مال المالك", "/finance/owner-entitlement"],
      ["المخزون", "/inventory"],
    ];
    for (const [label, target] of cases) {
      wouterMocks.navigate.mockClear();
      await openEntry(label);
      expect(wouterMocks.navigate).toHaveBeenCalledWith(withReturnTo(target, "/finance"));
    }
    /* كل تنقل أغلق اللوحة أولًا (AF-AC03: لا حفظ ولا كتابة من الفتح نفسه). */
    expect(screen.queryByRole("dialog")).toBeNull();
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

  it("UNIT-013B: مدخل ميزانيات المصروف سياقي — يكشف قسمها في الصفحة نفسها لا وجهة جديدة", async () => {
    await seedProfile();
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    const board = await openBoard();
    fireEvent.click(within(board).getByRole("button", { name: /ميزانيات المصروف/ }));
    /* لا تنقل إطلاقًا — القسم موجود في الصفحة نفسها (سطح 013B واحد بموضع واحد). */
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("region", { name: "ميزانيات المصروف" })).toBeTruthy();
  });

  it("AF-AC07: الإغلاق (زر/Escape) يعيد التركيز لزر اللوحة ولا يغير شيئًا آخر", async () => {
    await seedProfile();
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    await openBoard();
    const [functionsButton] = screen.getAllByRole("button", { name: /وظائف المالية/ });
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
    /* تحديث موثق واحد مع وصول فحص السلامة: بديله الكنوني صار المالية مباشرة. */
    expect(canonicalReturnFor("/tools/integrity")).toBe("/finance");
    /* وجهة غير صالحة تسقط للبديل العام — لا حلقة (قاعدة §2.1-6). */
    expect(canonicalReturnFor("/finance/more?returnTo=/finance/more")).toBe("/finance");
  });
});
