/** @vitest-environment jsdom */
/* Wave 4.4 — P-4.4-3: العربية وRTL وسلامة المحتوى.
 * ---------------------------------------------------------------------------
 * ١) الشدّة في كل فعل تسجيل ظاهر — «سجّل التسليم» لا «سجل التسليم»
 *    (قرار الموجة 4.2 الموحد: الشدة في كل أزرار سجل).
 * ٢) عزل Bidi للقيم التقنية في سياق عربي: معرّف الطلب داخل bdi dir="ltr"
 *    كي لا تنعكس الشرطات بين الأرقام والحروف بصريًا في RTL.
 * ٣) dir="auto" للأسماء الحرة التي يدخلها المستخدم (عميل/مقترض/مورد/
 *    بند) — الاسم العربي يبقى RTL والاسم الإنجليزي يعزل كتلة LTR صحيحة.
 * ٤) فحص تركيب النص العربي المرئي: لا مسافة قبل الترقيم، لا التصاق بعد
 *    الفاصلة العربية، لا مسافات مزدوجة، لا التصاق عربي-لاتيني في السلاسل
 *    المرئية (فحص مصدر ثابت يدوم بعد الموجة).
 * ٥) المعجم الرسمي حاضر في نصوص الإنتاج: وزّع/غطِّ، تراجع موثق،
 *    سُجّل التوزيع ✓ — لا مرادفات منافسة.
 */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CostEstimateService } from "@/application/estimates/costEstimateService";
import { DraftService } from "@/application/drafts/draftService";
import { CostService, type CostEditorInput } from "@/application/cost/costService";
import { AgreementService } from "@/application/agreements/agreementService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { DeliveryReviewService } from "@/application/fulfillment/deliveryReviewService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { ActualTimeService } from "@/application/time/actualTimeService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { CollectionReversalService } from "@/application/collections/collectionReversalService";
import { LoanService } from "@/application/loans/loanService";
import { ProfileService } from "@/application/profile/profileService";
import { OwnerProfileService } from "@/application/owner/ownerProfileService";
import { CashContinuityService as CashContinuityForProfile } from "@/application/cash/cashContinuityService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import OrderDetail from "@/pages/OrderDetail";
import Loans from "@/pages/Loans";
import Profile from "@/pages/Profile";
import { getAgreementPresentation } from "@/presentation/orderAgreementPresentation";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/orders/o1",
  params: {} as Record<string, string | undefined>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => {
    const query = wouterMocks.location.split("?")[1] ?? "";
    return query ? `?${query}` : "";
  },
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-16T10:00:00.000Z";

let store: MemoryLocalStore;
let costs: CostService;
let agreements: AgreementService;
let fulfillment: FulfillmentService;
let deliveryReview: DeliveryReviewService;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    costs,
    agreements,
    fulfillment,
    deliveryReview,
    inventory: new InventoryMaterialService(store, () => NOW),
    costEstimates: new CostEstimateService(store, () => NOW),
    drafts: new DraftService(store, () => NOW),
    cashContinuity: new CashContinuityService(store, () => NOW),
    actualTime: new ActualTimeService(store, () => NOW),
    agreementContext: new AgreementContextService(store, () => NOW),
    collectionReversal: new CollectionReversalService(store, new ProjectFinancialService(store, () => NOW)),
    schedules: new ScheduleService(store, () => NOW),
    loans: new LoanService(store, () => NOW),
    profile: new ProfileService(store, () => NOW),
    ownerProfile: new OwnerProfileService(store, () => NOW),
    profiles: new ProfileService(store, () => NOW),
    cashContinuityProfile: new CashContinuityForProfile(store, () => NOW),
    preferences: {
      load: async () => ({ ok: true, preference: { theme: "light" } }),
      save: async () => ({ ok: true }),
      readAllocationPolicy: async () => ({ ok: true, policy: null }),
      readDisabledCapabilities: async () => ({ ok: true, disabled: [] }),
      readLastVerifiedExport: async () => ({ ok: true, info: null }),
    },
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  mockedUsePrototypeServices.mockImplementation(
    () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
  );
  return <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>;
}

const costInput: CostEditorInput = {
  materialItems: [],
  time: { minutes: 60, hourlyRateMinor: 400, confidence: "known" },
  packagingMinor: 0,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 0,
  quantity: 1,
};

async function agreedOrder() {
  const drafts = new DraftService(store, () => NOW);
  const created = await drafts.create("customer_order");
  if (!created.ok) throw new Error(created.message);
  const saved = await drafts.save({
    ...created.draft,
    customerName: "سارة",
    itemName: "رف خشبي",
    specifications: "مقاس كبير",
    quantity: 1,
  });
  if (!saved.ok) throw new Error(saved.message);
  const withCost = await costs.saveSnapshot(saved.draft, costInput);
  if (!withCost.ok) throw new Error(withCost.message);
  const agreed = await agreements.createFromDraft(withCost.draft, {
    agreedPriceMinor: 5000,
    deliveryDate: "2026-09-20",
    depositMinor: 0,
    agreementSource: null,
  });
  if (!agreed.ok) throw new Error(agreed.message);
  return agreed.stored;
}

describe("Wave 4.4 — P-4.4-3: الشدّة وعزل Bidi والأسماء الحرة", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockReset();
    wouterMocks.params = {};
    vi.clearAllMocks();
    store = new MemoryLocalStore();
    costs = new CostService(store, () => NOW);
    agreements = new AgreementService(store, costs, () => NOW);
    fulfillment = new FulfillmentService(store, () => NOW);
    deliveryReview = new DeliveryReviewService(store, () => NOW);
  });
  afterEach(cleanup);

  it("فعل التسجيل الظاهر بالشدّة — «سجّل التسليم» لا «سجل التسليم»", () => {
    const presentation = getAgreementPresentation({
      status: "ready",
      agreedPriceMinor: 5000,
      deliveryDate: "2026-09-20",
      nextAction: null,
    });
    expect(presentation.nextAction).toBe("سجّل التسليم");
    expect(presentation.nextAction).not.toBe("سجل التسليم");
  });

  it("معرّف الطلب داخل لافتة النجاح معزول LTR — لا انعكاس شرطات UUID في RTL", async () => {
    const stored = await agreedOrder();
    wouterMocks.params = { id: stored.id };
    wouterMocks.location = `/orders/${stored.id}?created=1`;
    render(<Harness page={<OrderDetail />} />);
    const banner = await screen.findByTestId("order-created-banner");
    const idBdi = banner.querySelector("bdi[dir='ltr']");
    expect(idBdi).not.toBeNull();
    expect(idBdi?.textContent).toBe(stored.id);
    /* القيمة كاملة داخل العزل — نص البانر ما زال يحملها للقارئ */
    expect(banner.textContent).toContain(stored.id);
  });

  it("اسم المقترض الحر داخل strong باتجاه auto — الاسم الإنجليزي يعزل والاسم العربي يبقى", async () => {
    const profile = await new ProfileService(store, () => NOW).save("مالك");
    if (!profile.ok) throw new Error(profile.message);
    const loans = new LoanService(store, () => NOW);
    const created = await loans.create({
      borrowerName: "Ahmad Suppliers Ltd",
      principalMinor: 10000,
      loanDate: "2026-09-16",
    });
    if (!created.ok) throw new Error(created.message);
    wouterMocks.location = "/loans";
    render(<Harness page={<Loans />} />);
    const nameStrong = await waitFor(() => {
      const strong = screen.getByText("Ahmad Suppliers Ltd");
      if (strong.tagName !== "STRONG") throw new Error("not the name strong yet");
      return strong;
    });
    expect(nameStrong.getAttribute("dir")).toBe("auto");
  });

  it("بريد المالك يُعرض معزولًا LTR داخل بيانات الملف — لا التصاق بالسياق العربي", async () => {
    const ownerProfile = new OwnerProfileService(store, () => NOW);
    const ensured = await ownerProfile.ensureLocal();
    if (!ensured.ok) throw new Error(ensured.message);
    const saved = await ownerProfile.save({ displayName: "مالك", email: "owner@workshop.example" });
    if (!saved.ok) throw new Error(saved.message);
    wouterMocks.location = "/profile";
    render(<Harness page={<Profile />} />);
    await waitFor(() => expect(screen.getByText("اسمك")).toBeTruthy());
    const emailBdi = document.querySelector("dd bdi[dir='ltr']");
    expect(emailBdi).not.toBeNull();
    expect(emailBdi?.textContent).toBe("owner@workshop.example");
  });
});

describe("Wave 4.4 — P-4.4-3: فحص تركيب النص العربي المرئي (فحص مصدر ثابت)", () => {
  /* ملف الاختبار يقيم داخل client/src — الجذر هو مجلده نفسه. */
  const CLIENT_SRC = import.meta.dirname;

  function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  }

  const files = [
    "pages/OrderDetail.tsx",
    "pages/Orders.tsx",
    "pages/Home.tsx",
    "pages/Parties.tsx",
    "pages/Loans.tsx",
    "pages/Suppliers.tsx",
    "pages/Profile.tsx",
    "pages/DeliveryReview.tsx",
    "pages/Settings.tsx",
    "pages/Finance.tsx",
    "pages/Catalog.tsx",
    "presentation/orderAgreementPresentation.ts",
  ];

  it("لا مسافة قبل الترقيم، لا التصاق بعد الفاصلة العربية، لا مسافات مزدوجة، لا التصاق عربي-لاتيني", () => {
    const arabic = /[\u0600-\u06FF]/;
    for (const rel of files) {
      const raw = readFileSync(resolve(CLIENT_SRC, rel), "utf8");
      const code = stripComments(raw);
      const literals = [...code.matchAll(/"([^"\n]*)"/g)].map(m => m[1]);
      for (const text of literals) {
        if (!arabic.test(text)) continue;
        expect.soft(text, `${rel}: مسافة قبل ترقيم`).not.toMatch(/[\u0600-\u06FF] +[،؛؟!:]/);
        expect.soft(text, `${rel}: التصاق بعد الفاصلة`).not.toMatch(/،[\u0600-\u06FF]/);
        expect.soft(text, `${rel}: مسافات مزدوجة`).not.toMatch(/\S  +\S/);
        expect
          .soft(text, `${rel}: التصاق عربي-لاتيني`)
          .not.toMatch(/[\u0600-\u06FF][A-Za-z]|[A-Za-z][\u0600-\u06FF]/);
      }
    }
  });

  it("المعجم الرسمي حاضر في مواضعه الإنتاجية — لا مرادفات منافسة", () => {
    const distribution = readFileSync(resolve(CLIENT_SRC, "pages/CashDistribution.tsx"), "utf8");
    expect(distribution).toContain("سُجّل التوزيع ✓");
    const finance = readFileSync(resolve(CLIENT_SRC, "pages/Finance.tsx"), "utf8");
    expect(finance).toContain("وزّع");
    const quickExpense = readFileSync(resolve(CLIENT_SRC, "components/finance/QuickExpenseForm.tsx"), "utf8");
    expect(quickExpense.includes("غطِّ") || finance.includes("غطِّ")).toBe(true);
    /* تراجع موثق ظاهر في أسطح الأثر لا مدفونًا */
    const orderDetail = readFileSync(resolve(CLIENT_SRC, "pages/OrderDetail.tsx"), "utf8");
    expect(orderDetail).toContain("تراجع موثق");
    /* لا يعود الفعل الأمري بلا شدّة في نصوص العرض المرئية */
    const presentation = readFileSync(
      resolve(CLIENT_SRC, "presentation/orderAgreementPresentation.ts"),
      "utf8",
    );
    expect(presentation).not.toMatch(/nextAction: "سجل /);
  });
});
