/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import DirectSaleEditor from "@/pages/DirectSaleEditor";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  location: "/direct-sales/sale-1",
  navigate: vi.fn(),
}));

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

const sale: DirectSale = {
  id: "sale-1",
  itemName: "كوب جاهز",
  quantity: 2,
  currency: "JOD",
  revenueMinor: 1200,
  collectedMinor: 1200,
  costMinor: 500,
  profitMinor: 700,
  occurredOn: "2026-08-29",
  recordedAt: "2026-08-29T09:00:00.000Z",
  note: "بيع مباشر",
  idempotencyKey: "sale-create-1",
  status: "active",
  cancelledAt: null,
  cancellationReason: null,
  revisions: [],
};

/* كعب الخدمات المشترك — كل اختبار يخصّص ما يحتاجه فوقه. */
function baseServices(overrides: Record<string, unknown> = {}) {
  return {
    formDrafts: {
      read: vi.fn().mockResolvedValue({ ok: true, value: null }),
      save: vi.fn().mockResolvedValue({ ok: true, value: { updatedAt: "2026-09-04T12:00:00.000Z" } }),
      discard: vi.fn().mockResolvedValue({ ok: true, value: null }),
    },
    catalog: { list: vi.fn().mockResolvedValue({ ok: true, items: [] }) },
    directSales: {},
    cashContinuity: { overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets: [] } }) },
    saleCollectionReversal: {
      listReversibleCollections: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      preview: vi.fn(),
      reverse: vi.fn(),
    },
    projectFinance: { distributeUnallocated: vi.fn() },
    notifyDataChanged: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

function renderEditor() {
  return render(
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <DirectSaleEditor />
    </UnsavedChangesProvider>,
  );
}

describe("DirectSaleEditor", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    wouterMocks.location = "/direct-sales/sale-1";
    wouterMocks.navigate.mockReset();
  });

  /* بند ٢٥ (قرارات المالك): دلالة الكمية معلنة — السعر إجمالي البيع كاملًا لا سعر
   * القطعة، والاقتراح من المرجع سعرٌ للقطعة لا يُضرب تلقائيًا مع كمية أكبر. */
  it("declares total-price semantics under the quantity field and never auto-multiplies a per-unit suggestion (item 25)", async () => {
    wouterMocks.location = "/direct-sales/new";
    const catalogItem = {
      id: "ref-1",
      kind: "product",
      name: "كوب جاهز",
      unitLabel: null,
      unitId: null,
      defaultPriceMinor: 600,
      defaultUnitCostMinor: 250,
      active: true,
      createdAt: "2026-08-20T10:00:00.000Z",
      updatedAt: "2026-08-20T10:00:00.000Z",
      createdOperationKey: "catalog-op-1",
    };
    const create = vi.fn().mockResolvedValue({ ok: true, value: { ...sale, id: "sale-new" } });
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        catalog: { list: vi.fn().mockResolvedValue({ ok: true, items: [catalogItem] }) },
        directSales: { create, record: create },
      }),
    );

    renderEditor();

    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    /* المجموعة ٦ (البند ٤ — S3-12): دلالة الكمية خلف إفصاح «معنى الكمية» —
     * موجودة في الصفحة (تُقرأ بالفتح) ولم تُحذف؛ القاعدة نفسها بند ٢٥. */
    expect(
      screen.getByText(
        (content, element) =>
          (element?.tagName === "SMALL" || element?.tagName === "P") &&
          content.includes("إجمالي البيع كاملًا") &&
          content.includes("لا سعر"),
      ),
    ).toBeTruthy();
    expect(screen.getByText("معنى الكمية")).toBeTruthy();

    /* كمية ٢ ثم اختيار مرجع له اقتراح سعر: لا تعبئة تلقائية ولا ضرب عن المالك —
     * بعد جاهزية خيارات المرجع نفسها (قراءة الكتالوج غير متزامنة). */
    await screen.findByRole("option", { name: /كوب جاهز/ });
    fireEvent.change(screen.getByLabelText("الكمية"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("ربط مرجع"), { target: { value: "ref-1" } });
    expect(
      await screen.findByText(
        (content, element) => element?.tagName === "SMALL" && content.includes("سعرٌ للقطعة الواحدة"),
      ),
    ).toBeTruthy();
    /* السعر الفعلي بقي بيد المالك: لم يُعبّأ رقمًا عنه. */
    expect((screen.getByLabelText("إجمالي البيع — د.أ") as HTMLInputElement).value).toBe("0.00");

    /* كمية ١ مع مرجع له اقتراح: تُعرض التعبئة كاقتراح قابل للتعديل. */
    fireEvent.change(screen.getByLabelText("الكمية"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("ربط مرجع"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("ربط مرجع"), { target: { value: "ref-1" } });
    expect(
      await screen.findByText(
        (content, element) => element?.tagName === "SMALL" && content.includes("سعر مقترح من المرجع"),
      ),
    ).toBeTruthy();
  });

  /* S11-MR-001 (A2/س1+س2): إجمالي البيع أولًا ثم الدفع الصريح — الترتيب
   * البنيوي للشاشة كما في جدول A2، لا مقترحات النموذج القديم. */
  it("S11-MR-001: الإجمالي أولًا ثم مجموعة الدفع — ترتيب A2", async () => {
    wouterMocks.location = "/direct-sales/new";
    mockedUsePrototypeServices.mockReturnValue(baseServices());

    renderEditor();
    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });

    const total = screen.getByLabelText("إجمالي البيع — د.أ");
    const payment = screen.getByRole("group", { name: "الدفع" });
    const date = document.querySelector('input[type="date"]') as HTMLElement;
    const details = screen.getByText("تفاصيل إضافية").closest("details");
    expect(total.compareDocumentPosition(payment) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(payment.compareDocumentPosition(date) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(date.compareDocumentPosition(details as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    /* الوصف/الكمية/المرجع داخل المجموعة المطوية لا في وجه الشاشة. */
    expect(screen.getByPlaceholderText("مثال: كوب جاهز").closest("details")).toBe(details);
    expect(screen.getByLabelText("الكمية").closest("details")).toBe(details);
    expect(screen.getByLabelText("ربط مرجع").closest("details")).toBe(details);
  });

  it("S11-MR-001: الأوضاع الثلاثة صريحة — الكامل مقترح، والجزء يكشف المبلغ، و«لم أستلم» بلا مبلغ", async () => {
    wouterMocks.location = "/direct-sales/new";
    mockedUsePrototypeServices.mockReturnValue(baseServices());

    renderEditor();
    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });

    const full = screen.getByRole("radio", { name: /استلمت كامل المبلغ/ });
    const partial = screen.getByRole("radio", { name: /استلمت جزءًا والباقي دَين/ });
    const none = screen.getByRole("radio", { name: /لم أستلم والمبلغ دَين/ });
    expect((full as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByLabelText("المقبوض الآن — د.أ")).toBeNull();

    fireEvent.click(partial);
    expect((partial as HTMLInputElement).checked).toBe(true);
    expect(screen.getByLabelText("المقبوض الآن — د.أ")).toBeTruthy();

    fireEvent.click(none);
    expect((none as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByLabelText("المقبوض الآن — د.أ")).toBeNull();
  });

  it("S11-MR-001: وضع الكامل يحفظ المقبوض = الإجمالي بحالة قبض كامل ويمرر المحفظة", async () => {
    wouterMocks.location = "/direct-sales/new";
    const record = vi.fn().mockResolvedValue({
      ok: true,
      value: { ...sale, id: "sale-full", collections: [] },
    });
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        directSales: { record },
        cashContinuity: {
          overview: vi.fn().mockResolvedValue({
            ok: true,
            value: { wallets: [{ id: "drawer-1", name: "درج النقد", kind: "cash_drawer" }] },
          }),
        },
      }),
    );

    renderEditor();
    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    fireEvent.change(screen.getByLabelText("إجمالي البيع — د.أ"), { target: { value: "12.00" } });
    await waitFor(() => expect(screen.getByLabelText("وجهة القبض")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));

    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    expect(record.mock.calls[0][0]).toMatchObject({
      revenueMinor: 1200,
      collectedMinor: 1200,
      collectionStatus: "collected_in_full",
      priceCut: false,
      wallet: { walletId: "drawer-1" },
    });
  });

  it("S11-MR-001: مبلغ الجزء فراغ/صفر/مساوٍ للإجمالي/fائض = رفض صادق بلا استدعاء", async () => {
    wouterMocks.location = "/direct-sales/new";
    const record = vi.fn();
    mockedUsePrototypeServices.mockReturnValue(baseServices({ directSales: { record } }));

    renderEditor();
    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    fireEvent.change(screen.getByLabelText("إجمالي البيع — د.أ"), { target: { value: "12.00" } });
    fireEvent.click(screen.getByRole("radio", { name: /استلمت جزءًا والباقي دَين/ }));

    /* فراغ: لا يُفسَّر قبضًا كاملًا ولا صفرًا. */
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));
    expect(await screen.findByText(/أدخل مبلغ ما قُبض الآن/)).toBeTruthy();
    expect(record).not.toHaveBeenCalled();

    /* صفر: ليست «لم أستلم» — القرار صريح لا يُستنتج. */
    fireEvent.change(screen.getByLabelText("المقبوض الآن — د.أ"), { target: { value: "0.00" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));
    expect(await screen.findByText(/أدخل مبلغ ما قُبض الآن/)).toBeTruthy();
    expect(record).not.toHaveBeenCalled();

    /* مساوٍ للإجمالي: إشارة إلى وضع الكامل. */
    fireEvent.change(screen.getByLabelText("المقبوض الآن — د.أ"), { target: { value: "12.00" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));
    expect(await screen.findByText(/اختر «استلمت كامل المبلغ»/)).toBeTruthy();
    expect(record).not.toHaveBeenCalled();

    /* فوق الإجمالي: القبض لا يتجاوز السعر. */
    fireEvent.change(screen.getByLabelText("المقبوض الآن — د.أ"), { target: { value: "13.00" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));
    expect(await screen.findByText(/المقبوض لا يتجاوز السعر المتفق عليه/)).toBeTruthy();
    expect(record).not.toHaveBeenCalled();
  });

  it("S11-MR-001: الدين صريح من الوضع — لا سؤال فرق ثانٍ، والتعريف مطلوب للدين (D03)", async () => {
    wouterMocks.location = "/direct-sales/new";
    /* الحفظ بلا تعريف يرفضه حد D03 في المصدر — الكعب يحاكي رفض المجال بصدق. */
    const partyDefinitionRequired = {
      ok: false,
      code: "validation_error",
      message:
        "اكتب اسمًا أو وصفًا يعرّف صاحب المبلغ المتبقي، أو اختر عميلًا محفوظًا — المتبقي بلا تعريف يضيع من المتابعة.",
    };
    const record = vi
      .fn()
      .mockResolvedValueOnce(partyDefinitionRequired)
      .mockResolvedValueOnce({
        ok: true,
        value: { ...sale, id: "sale-debt", collections: [] },
      });
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        directSales: { record },
        partyDirectory: { save: vi.fn(), suggestParties: vi.fn().mockResolvedValue({ ok: true, value: [] }) },
      }),
    );

    renderEditor();
    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    fireEvent.change(screen.getByLabelText("إجمالي البيع — د.أ"), { target: { value: "12.00" } });
    fireEvent.click(screen.getByRole("radio", { name: /استلمت جزءًا والباقي دَين/ }));
    fireEvent.change(screen.getByLabelText("المقبوض الآن — د.أ"), { target: { value: "5.00" } });

    /* تعريف صاحب المتبقي ظاهر مع وضع الدين (يجهز تعريفه) وخطأه صادق. */
    expect(screen.getByLabelText("على مَن المبلغ؟ — اسم أو وصف")).toBeTruthy();
    expect(screen.getByText(/المتبقي بلا تعريف يضيع من المتابعة/).getAttribute("role")).toBe("alert");

    /* حفظ بلا تعريف: رفض المصدر ظاهر — لا شاشة نتيجة ولا دين بلا متبوع. */
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));
    const rejection = await screen.findByText(/المتبقي بلا تعريف يضيع من المتابعة/);
    expect(rejection.getAttribute("role")).toBe("alert");
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toMatchObject({
      revenueMinor: 1200,
      collectedMinor: 500,
      collectionStatus: "partial_debt",
      customerName: null,
    });
    expect(screen.queryByRole("heading", { name: "سُجّل البيع" })).toBeNull();

    /* بالتعريف يمر البيع بالوضع نفسه — ولا لوحة قرار فرق ظهرت في الرحلة كلها. */
    fireEvent.change(screen.getByLabelText("على مَن المبلغ؟ — اسم أو وصف"), { target: { value: "ليان" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));
    await screen.findByRole("heading", { name: "سُجّل البيع" });
    expect(record).toHaveBeenCalledTimes(2);
    expect(record.mock.calls[1][0]).toMatchObject({ customerName: "ليان", collectionStatus: "partial_debt" });
    expect(screen.queryByText(/النظام لا يقرّر عنك/)).toBeNull();
  });

  it("S11-MR-001: «حالة مختلفة؟» — تخفيض بمعاينة السعر الفعلي، ومراجعة بلا تحويل تلقائي", async () => {
    wouterMocks.location = "/direct-sales/new";
    const record = vi.fn().mockResolvedValue({
      ok: true,
      value: { ...sale, id: "sale-cut", collections: [] },
    });
    mockedUsePrototypeServices.mockReturnValue(baseServices({ directSales: { record } }));

    renderEditor();
    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    fireEvent.change(screen.getByLabelText("إجمالي البيع — د.أ"), { target: { value: "12.00" } });
    fireEvent.click(screen.getByRole("radio", { name: /استلمت جزءًا والباقي دَين/ }));
    fireEvent.change(screen.getByLabelText("المقبوض الآن — د.أ"), { target: { value: "5.00" } });

    /* الإفصاح يفتح بالقرار الفعّال، والتخفيض بمعاينة السعر الفعلي. */
    const differentCase = screen.getByText("حالة مختلفة؟").closest("details");
    fireEvent.click(screen.getByRole("radio", { name: /خفّضتُ السعر فعلًا/ }));
    await waitFor(() => expect(differentCase?.open).toBe(true));
    expect(screen.getByText(/البيع يصير 5.00 د.أ/)).toBeTruthy();
    expect(screen.getByText(/البيع يصير 5.00 · المقبوض 5.00 · لا دين/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));
    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    /* التخفيض يصل الخدمة بعلمه الموثق والسعر المتفق كما اتُفق — والخدمة تحطّه
     * إلى المقبوض بسجل يحفظ الأصل (applyPriceCut). */
    expect(record.mock.calls[0][0]).toMatchObject({
      revenueMinor: 1200,
      collectedMinor: 500,
      priceCut: true,
    });

    /* المراجعة: فرق معلق لا دين — والعودة إلى دين الوضع فعل صريح. (شاشة
     * النتيجة أغلقت النموذج بعد الحفظ الأول — جولة جديدة للجزء الثاني.) */
    cleanup();
    const recordReview = vi.fn().mockResolvedValue({
      ok: true,
      value: { ...sale, id: "sale-review", collections: [] },
    });
    mockedUsePrototypeServices.mockReturnValue(baseServices({ directSales: { record: recordReview } }));

    renderEditor();

    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    fireEvent.change(screen.getByLabelText("إجمالي البيع — د.أ"), { target: { value: "12.00" } });
    fireEvent.click(screen.getByRole("radio", { name: /استلمت جزءًا والباقي دَين/ }));
    fireEvent.change(screen.getByLabelText("المقبوض الآن — د.أ"), { target: { value: "5.00" } });
    fireEvent.click(screen.getByRole("radio", { name: /الفرق يحتاج مراجعة/ }));
    expect(screen.getByText(/فرق 7.00 يحتاج مراجعة/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));
    await waitFor(() => expect(recordReview).toHaveBeenCalledTimes(1));
    expect(recordReview.mock.calls[0][0]).toMatchObject({
      revenueMinor: 1200,
      collectedMinor: 500,
      collectionStatus: "partial_needs_review",
      priceCut: false,
    });
  });

  it("S11-MR-001: «لم أستلم» صفرٌ صريح بلا وجهة قبض، والدين بتعريفه", async () => {
    wouterMocks.location = "/direct-sales/new";
    const record = vi.fn().mockResolvedValue({
      ok: true,
      value: { ...sale, id: "sale-none", collections: [] },
    });
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        directSales: { record },
        cashContinuity: {
          overview: vi.fn().mockResolvedValue({
            ok: true,
            value: { wallets: [{ id: "drawer-1", name: "درج النقد", kind: "cash_drawer" }] },
          }),
        },
      }),
    );

    renderEditor();
    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    fireEvent.change(screen.getByLabelText("إجمالي البيع — د.أ"), { target: { value: "12.00" } });
    fireEvent.click(screen.getByRole("radio", { name: /لم أستلم والمبلغ دَين/ }));

    /* لا وجهة قبض عند صفر فعلي — لا تخصيص بلا مال. */
    await waitFor(() => expect(screen.queryByLabelText("وجهة القبض")).toBeNull());
    expect(screen.getByText(/البيع 12.00 · لم يُقبض · دين 12.00/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("على مَن المبلغ؟ — اسم أو وصف"), { target: { value: "ليان" } });
    expect(screen.getByText(/البيع 12.00 · لم يُقبض · دين 12.00 على ليان/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));

    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    expect(record.mock.calls[0][0]).toMatchObject({
      revenueMinor: 1200,
      collectedMinor: 0,
      collectionStatus: "partial_debt",
      customerName: "ليان",
      wallet: null,
    });
  });

  /* S11-MR-002: العميل الاختياري متاح للبيع المدفوع كاملًا حتى بلا فرق ولا
   * اسم مُدخل سابقًا — دون إنشاء طرف دائم ولا استنتاج هوية من تشابه اسم. */
  it("S11-MR-002: «إضافة عميل — اختياري» متاح للدفع الكامل ويمرر الاسم دون بطاقة إجبارية", async () => {
    wouterMocks.location = "/direct-sales/new";
    const record = vi.fn().mockResolvedValue({
      ok: true,
      value: { ...sale, id: "sale-full-customer", collections: [] },
    });
    const partySave = vi.fn();
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        directSales: { record },
        partyDirectory: {
          save: partySave,
          suggestParties: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        },
      }),
    );

    renderEditor();
    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    fireEvent.change(screen.getByLabelText("إجمالي البيع — د.أ"), { target: { value: "12.00" } });

    /* الحقل موجود من البداية — لا ينتظر دينًا ولا اسمًا (MR-002). */
    const optionalCustomer = screen.getByLabelText("إضافة عميل — اختياري");
    expect(screen.queryByLabelText("على مَن المبلغ؟ — اسم أو وصف")).toBeNull();
    fireEvent.change(optionalCustomer, { target: { value: "ليان" } });

    /* «حفظه لإعادة الاستخدام» غير محدد مسبقًا — لا بطاقة عميل إجبارية. */
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));
    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    expect(record.mock.calls[0][0]).toMatchObject({
      revenueMinor: 1200,
      collectedMinor: 1200,
      customerName: "ليان",
    });
    expect(partySave).not.toHaveBeenCalled();
  });

  it("S11-MR-001: المعاينة من النية الفعّالة وتختفي عند مدخل غير صالح", async () => {
    wouterMocks.location = "/direct-sales/new";
    mockedUsePrototypeServices.mockReturnValue(baseServices());

    renderEditor();
    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    expect(screen.queryByText(/البيع 0.00/)).toBeNull();

    fireEvent.change(screen.getByLabelText("إجمالي البيع — د.أ"), { target: { value: "12.00" } });
    expect(screen.getByText(/البيع 12.00 · المقبوض 12.00 · قُبض كاملًا/)).toBeTruthy();

    /* نص غير صالح في الإجمالي: لا رقم من نص فاسد. */
    fireEvent.change(screen.getByLabelText("إجمالي البيع — د.أ"), { target: { value: "اثنا عشر" } });
    expect(screen.queryByText(/قُبض كاملًا/)).toBeNull();

    fireEvent.change(screen.getByLabelText("إجمالي البيع — د.أ"), { target: { value: "12.00" } });
    fireEvent.click(screen.getByRole("radio", { name: /استلمت جزءًا والباقي دَين/ }));
    fireEvent.change(screen.getByLabelText("المقبوض الآن — د.أ"), { target: { value: "5.00" } });
    expect(screen.getByText(/البيع 12.00 · المقبوض 5.00 · دين 7.00/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("على مَن المبلغ؟ — اسم أو وصف"), { target: { value: "ليان" } });
    expect(screen.getByText(/البيع 12.00 · المقبوض 5.00 · دين 7.00 على ليان/)).toBeTruthy();

    /* نص غير صالح في مبلغ الجزء: المعاينة لا تعرض رقمًا فاسدًا. */
    fireEvent.change(screen.getByLabelText("المقبوض الآن — د.أ"), { target: { value: "خمسة" } });
    expect(screen.queryByText(/دين 7.00/)).toBeNull();
  });

  /* S11-MR-001 (البند ٨): هجرة مسودة ما قبل الأوضاع — collectedEmpty بمعناه
   * الأصلي، والفرق غير المحسوم لا يُمنح دينًا بصمت بل يُقرر صراحةً. */
  it("S11-MR-001: مسودة قديمة بفرق غير محسوم — تُستعاد بوضعها ويُطلب قرار المعنى قبل الحفظ", async () => {
    wouterMocks.location = "/direct-sales/new";
    const record = vi.fn().mockResolvedValue({
      ok: true,
      value: { ...sale, id: "sale-legacy", collections: [] },
    });
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        directSales: { record },
        formDrafts: {
          read: vi.fn().mockResolvedValue({
            ok: true,
            value: {
              values: {
                itemName: "صندوق حلويات",
                quantity: 1,
                revenueMinor: 1200,
                /* شكل ما قبل الأوضاع: لا paymentMode، والفرق لم يُقرر. */
                collectedEmpty: false,
                collectedMinor: 500,
                costKnown: false,
                costMinor: 0,
                customerName: "ليان",
                customerPartyId: "",
                saveForReuse: false,
                catalogItemId: "",
                occurredOn: "2026-10-20",
                note: "",
              },
              updatedAt: "2026-10-20T10:00:00.000Z",
            },
          }),
          save: vi.fn().mockResolvedValue({ ok: true, value: { updatedAt: "2026-10-20T10:00:00.000Z" } }),
          discard: vi.fn().mockResolvedValue({ ok: true, value: null }),
        },
      }),
    );

    renderEditor();
    await screen.findByText("استرجع المسودة");
    fireEvent.click(screen.getByRole("button", { name: "استرجع المسودة" }));

    /* الوضع المسترجع: جزء بمبلغه، والقرار معلقًا يفتح «حالة مختلفة؟». */
    await waitFor(() =>
      expect(
        (screen.getByRole("radio", { name: /استلمت جزءًا والباقي دَين/ }) as HTMLInputElement).checked,
      ).toBe(true),
    );
    expect((screen.getByLabelText("المقبوض الآن — د.أ") as HTMLInputElement).value).toBe("5.00");
    await waitFor(() => expect(screen.getByText("حالة مختلفة؟").closest("details")?.open).toBe(true));
    expect(screen.getByText(/قرار الفرق من مسودتك السابقة ما زال معلقًا/)).toBeTruthy();

    /* الحفظ محجوب حتى القرار — لا دين بصمت (X-06 كما كان للمسودة القديمة). */
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));
    expect(await screen.findByText(/اختر معناه في «حالة مختلفة؟» قبل الحفظ/)).toBeTruthy();
    expect(record).not.toHaveBeenCalled();

    /* القرار الصريح يفك القفل: تخفيض موثق بالسعر الفعلي (الخدمة تحطّ السعر
     * وتحفظ الأصل) فوق مسودة استُعيدت بمعناها القديم. */
    fireEvent.click(screen.getByRole("radio", { name: /خفّضتُ السعر فعلًا/ }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));
    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    expect(record.mock.calls[0][0]).toMatchObject({
      revenueMinor: 1200,
      collectedMinor: 500,
      priceCut: true,
      customerName: "ليان",
    });
  });

  it("S11-MR-001: مسودة بنمط اليوم تُستعاد بوضعها «لم أستلم» بلا سؤال قرار", async () => {
    wouterMocks.location = "/direct-sales/new";
    const record = vi.fn().mockResolvedValue({
      ok: true,
      value: { ...sale, id: "sale-newdraft", collections: [] },
    });
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        directSales: { record },
        formDrafts: {
          read: vi.fn().mockResolvedValue({
            ok: true,
            value: {
              values: {
                itemName: "صندوق حلويات",
                quantity: 1,
                revenueMinor: 1200,
                paymentMode: "none",
                collectedEmpty: false,
                collectedMinor: 0,
                differenceChoice: null,
                differenceUndecided: false,
                costKnown: false,
                costMinor: 0,
                customerName: "ليان",
                customerPartyId: "",
                saveForReuse: false,
                catalogItemId: "",
                occurredOn: "2026-10-20",
                note: "",
              },
              updatedAt: "2026-10-20T10:00:00.000Z",
            },
          }),
          save: vi.fn().mockResolvedValue({ ok: true, value: { updatedAt: "2026-10-20T10:00:00.000Z" } }),
          discard: vi.fn().mockResolvedValue({ ok: true, value: null }),
        },
      }),
    );

    renderEditor();
    await screen.findByText("استرجع المسودة");
    fireEvent.click(screen.getByRole("button", { name: "استرجع المسودة" }));

    await waitFor(() =>
      expect((screen.getByRole("radio", { name: /لم أستلم والمبلغ دَين/ }) as HTMLInputElement).checked).toBe(
        true,
      ),
    );
    /* الوضع صريح من المسودة نفسها — لا قرار معلق ولا بوابة إضافية. */
    expect(screen.queryByText(/قرار الفرق من مسودتك السابقة/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));
    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    expect(record.mock.calls[0][0]).toMatchObject({
      revenueMinor: 1200,
      collectedMinor: 0,
      collectionStatus: "partial_debt",
      customerName: "ليان",
    });
  });

  it("S11-MR-001: تبديل الأوضاع والإفصاحات لا يستدعي أي كتابة مالية", async () => {
    wouterMocks.location = "/direct-sales/new";
    const record = vi.fn();
    mockedUsePrototypeServices.mockReturnValue(baseServices({ directSales: { record } }));

    renderEditor();
    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    fireEvent.change(screen.getByLabelText("إجمالي البيع — د.أ"), { target: { value: "12.00" } });
    fireEvent.click(screen.getByRole("radio", { name: /استلمت جزءًا والباقي دَين/ }));
    fireEvent.change(screen.getByLabelText("المقبوض الآن — د.أ"), { target: { value: "5.00" } });
    fireEvent.click(screen.getByRole("radio", { name: /خفّضتُ السعر فعلًا/ }));
    fireEvent.click(screen.getByRole("radio", { name: /الفرق يحتاج مراجعة/ }));
    fireEvent.click(screen.getByText("ألغِ الحالة الخاصة — الباقي دَين كما اخترت في الدفع"));
    fireEvent.click(screen.getByRole("radio", { name: /لم أستلم والمبلغ دَين/ }));
    fireEvent.click(screen.getByRole("radio", { name: /استلمت كامل المبلغ/ }));
    /* فتح تفاصيل إضافية وتغيير الوصف والكمية — كلها واجهة صرفة. */
    fireEvent.click(screen.getByText("تفاصيل إضافية"));
    fireEvent.change(screen.getByPlaceholderText("مثال: كوب جاهز"), { target: { value: "كوب" } });
    fireEvent.change(screen.getByLabelText("الكمية"), { target: { value: "3" } });

    expect(record).not.toHaveBeenCalled();
  });

  it("S11-MR-001: فشل قراءة المحافظ صادق — القبض باقٍ وإعادة القراءة فعل صريح", async () => {
    wouterMocks.location = "/direct-sales/new";
    const overview = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, message: "تعذر" })
      .mockResolvedValueOnce({
        ok: true,
        value: { wallets: [{ id: "drawer-1", name: "درج النقد", kind: "cash_drawer" }] },
      });
    mockedUsePrototypeServices.mockReturnValue(baseServices({ cashContinuity: { overview } }));

    renderEditor();
    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    fireEvent.change(screen.getByLabelText("إجمالي البيع — د.أ"), { target: { value: "12.00" } });

    /* الفشل ليس «لا محافظ» — الحقل ظاهر بغير الموزع الصريح وخطأ معلن. */
    await waitFor(() => expect(screen.getByLabelText("وجهة القبض")).toBeTruthy());
    expect(await screen.findByText(/تعذّرت قراءة المحافظ/)).toBeTruthy();
    expect((screen.getByLabelText("وجهة القبض") as HTMLSelectElement).value).toBe("");

    /* إعادة القراءة تُجهّز الخيارات فعلًا. */
    fireEvent.click(screen.getByRole("button", { name: "أعد قراءة المحافظ" }));
    await waitFor(() =>
      expect((screen.getByLabelText("وجهة القبض") as HTMLSelectElement).value).toBe("drawer-1"),
    );
    expect(overview).toHaveBeenCalledTimes(2);
  });

  it("loads a saved sale and submits its corrected values", async () => {
    const update = vi.fn().mockResolvedValue({ ok: true, value: sale });
    const notifyDataChanged = vi.fn();
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        directSales: { get: vi.fn().mockResolvedValue({ ok: true, value: sale }), update },
        notifyDataChanged,
      }),
    );

    renderEditor();

    await screen.findByRole("heading", { name: "تصحيح بيع مباشر" });
    /* السجل المدفوع كاملًا يفتح على وضع الكامل — لا افتراض إنشائي فوق قائم. */
    await waitFor(() =>
      expect((screen.getByRole("radio", { name: /استلمت كامل المبلغ/ }) as HTMLInputElement).checked).toBe(
        true,
      ),
    );
    expect(screen.getByDisplayValue("كوب جاهز")).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue("كوب جاهز"), { target: { value: "كوب مصحح" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ تصحيح البيع" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        "sale-1",
        expect.objectContaining({
          itemName: "كوب مصحح",
          quantity: 2,
          revenueMinor: 1200,
          collectedMinor: 1200,
          costMinor: 500,
        }),
      ),
    );
    expect(notifyDataChanged).toHaveBeenCalledOnce();
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/orders");
  });

  it("edit mode maps a partially-collected sale to the partial payment mode", async () => {
    const partialSale: DirectSale = {
      ...sale,
      revenueMinor: 1200,
      collectedMinor: 500,
      collectionStatus: "partial_debt",
      customerName: "ليان",
    };
    const update = vi.fn().mockResolvedValue({ ok: true, value: partialSale });
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        directSales: { get: vi.fn().mockResolvedValue({ ok: true, value: partialSale }), update },
      }),
    );

    renderEditor();

    await screen.findByRole("heading", { name: "تصحيح بيع مباشر" });
    await waitFor(() =>
      expect(
        (screen.getByRole("radio", { name: /استلمت جزءًا والباقي دَين/ }) as HTMLInputElement).checked,
      ).toBe(true),
    );
    expect((screen.getByLabelText("المقبوض الآن — د.أ") as HTMLInputElement).value).toBe("5.00");
    expect((screen.getByLabelText("على مَن المبلغ؟ — اسم أو وصف") as HTMLInputElement).value).toBe("ليان");

    /* تصحيح المبلغ يمر بالوضع نفسه: جزء بدين قائم. */
    fireEvent.change(screen.getByLabelText("المقبوض الآن — د.أ"), { target: { value: "6.00" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ تصحيح البيع" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        "sale-1",
        expect.objectContaining({
          revenueMinor: 1200,
          collectedMinor: 600,
          collectionStatus: "partial_debt",
        }),
      ),
    );
  });

  it("requires a reason and records cancellation without deleting the sale", async () => {
    const cancel = vi.fn().mockResolvedValue({
      ok: true,
      value: { ...sale, status: "cancelled" },
    });
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({ directSales: { get: vi.fn().mockResolvedValue({ ok: true, value: sale }), cancel } }),
    );

    renderEditor();

    await screen.findByRole("heading", { name: "تصحيح بيع مباشر" });
    fireEvent.click(screen.getByRole("button", { name: "إظهار تأكيد الإلغاء" }));
    fireEvent.click(screen.getByRole("button", { name: "تأكيد إلغاء البيع" }));
    expect(await screen.findByText("اكتب سبب الإلغاء قبل تأكيده.")).toBeTruthy();
    expect(cancel).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("مثال: أُدخل المبلغ بالخطأ"), {
      target: { value: "سُجل البيع بالخطأ" },
    });
    fireEvent.click(screen.getByRole("button", { name: "تأكيد إلغاء البيع" }));

    await waitFor(() =>
      expect(cancel).toHaveBeenCalledWith("sale-1", "سُجل البيع بالخطأ", expect.any(String), 0),
    );
  });

  /* Z2.3 (§3.4 — Partial Success): البيع سُجل وقُبضه محفوظ، لكن نسبة المحفظة
   * فشلت — شاشة النتيجة تفصل المنجز عن الناقص بصراحة (مع السبب)، ولا تعرض
   * أي مسار إعادة تسجيل للبيع؛ الفعل التالي فتح السجل المسجل فقط. */
  it("S11 الذرية: فشل وجهة القبض يمنع البيع كله — لا نتيجة جزئية ولا إعادة تسجيل", async () => {
    wouterMocks.location = "/direct-sales/new";
    /* S11 (UNIT-005 §6): البيع والقبض الابتدائي وتخصيص المحفظة المختار
     * التزام واحد — وجهة غير صالحة تُرفض قبل أي كتابة بلا نجاح جزئي. */
    const record = vi.fn().mockResolvedValue({
      ok: false,
      code: "validation_error",
      message: "اختر محفظة موجودة لقبض البيع — أو اتركه غير موزع.",
    });
    const distributeUnallocated = vi.fn();
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        directSales: { record },
        distributeUnallocated,
        cashContinuity: {
          overview: vi.fn().mockResolvedValue({
            ok: true,
            value: { wallets: [{ id: "drawer-partial", name: "درج النقد", kind: "cash_drawer" }] },
          }),
        },
      }),
    );

    renderEditor();

    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    fireEvent.change(screen.getByLabelText("إجمالي البيع — د.أ"), { target: { value: "12.00" } });
    /* وجهة القبض تُقرأ عند الإنشاء — الدرج معيَّن مسبقًا فيمر مع البيع. */
    await waitFor(() => expect(screen.getByLabelText("وجهة القبض")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));

    /* لا شاشة نتيجة أصلًا: الرفض عند الحقل بمدخلات المستخدم كما هي. */
    const failure = await screen.findByText(/اختر محفظة موجودة لقبض البيع/);
    expect(failure.getAttribute("role")).toBe("alert");
    expect(screen.queryByRole("heading", { name: "سُجّل البيع" })).toBeNull();
    expect(screen.getByRole("button", { name: "حفظ البيع المباشر" })).toBeTruthy();
    /* لا إعادة تسجيل ولا نية تخصيص مستقلة — نداء واحد والنموذج محفوظ. */
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toMatchObject({ wallet: { walletId: "drawer-partial" } });
    expect(distributeUnallocated).not.toHaveBeenCalled();
  });

  /* S11 (UNIT-005/PD-02 — تصحيح المراجعة R2-004): مسار المرتجع الكامل —
   * السبب إلزامي، والفعل يمر بمالك الحركات (نية واحدة بمفتاح ثابت)، ولا
   * يُدفع رد بمجرد إعلان المرتجع. */
  it("S11 المرتجع الكامل: السبب إلزامي والفعل بمالك الحركات بمفتاح نية واحد", async () => {
    const fullReturn = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        sale: {
          ...sale,
          collectionStatus: "returned_full" as const,
          return: {
            occurredOn: "2026-10-05",
            refundDueMinor: 1200,
            operationKey: "return-key",
            recordedAt: "2026-10-05T09:00:00.000Z",
            reason: "أُرجع كاملًا",
          },
        },
        cashEntry: null,
        reused: false,
      },
    });
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        directSales: { get: vi.fn().mockResolvedValue({ ok: true, value: sale }) },
        saleMovements: { fullReturn, payRefund: vi.fn() },
      }),
    );

    renderEditor();

    await screen.findByRole("heading", { name: "تصحيح بيع مباشر" });
    /* إفصاح المرتجع الكامل يُفتح، والضغط بلا سبب يُخبر بصدق ولا يستدعي شيئًا. */
    fireEvent.click(screen.getByText("المرتجع الكامل"));
    fireEvent.click(screen.getByRole("button", { name: "تأكيد المرتجع الكامل" }));
    expect(await screen.findByText("اكتب سبب المرتجع قبل تأكيده.")).toBeTruthy();
    expect(fullReturn).not.toHaveBeenCalled();

    /* بالسبب يُنفَّذ الفعل بمالك الحركات: تاريخ وسبب ومفتاح نية واحد. */
    fireEvent.change(screen.getByPlaceholderText("مثال: أُرجع كاملًا"), {
      target: { value: "أرجعت الزبونة الصندوق كاملًا" },
    });
    fireEvent.click(screen.getByRole("button", { name: "تأكيد المرتجع الكامل" }));

    await waitFor(() => expect(fullReturn).toHaveBeenCalledTimes(1));
    expect(fullReturn).toHaveBeenCalledWith(
      "sale-1",
      expect.objectContaining({ reason: "أرجعت الزبونة الصندوق كاملًا" }),
    );
    expect((fullReturn.mock.calls[0] as [string, { operationKey: string }])[1].operationKey).toMatch(
      /direct-sale-return-ui-/,
    );
    expect(mockedUsePrototypeServices().notifyDataChanged).toHaveBeenCalledOnce();
    /* تصحيح المراجعة R5-007: نجاح المرتجع يغلق الإفصاح ويبقى النص خارجه —
     * مرئيًا معلنًا في المتصفح الحقيقي (المطوي لا يعرض ولا يُعلن). */
    const success = await screen.findByText(/سُجّل المرتجع الكامل/);
    expect(success.closest("details")).toBeNull();
    const disclosure = screen.getByText("المرتجع الكامل").closest("details");
    expect(disclosure?.open).toBe(false);
  });

  /* S11 §5 (ملاحظة المالك «جارٍ…» على أزرار S11 الثلاثة): زر المرتجع وزر دفع
   * الرد يعلنان الجري أثناء التنفيذ — لا تعطيل صامت بلا بيان. */
  it("S11 أزرار المرتجع ودفع الرد تعلن «جارٍ…» أثناء التنفيذ", async () => {
    let resolveReturn: (value: unknown) => void = () => {};
    const fullReturn = vi.fn().mockImplementation(
      () =>
        new Promise(resolve => {
          resolveReturn = resolve;
        }),
    );
    let resolveRefund: (value: unknown) => void = () => {};
    const payRefund = vi.fn().mockImplementation(
      () =>
        new Promise(resolve => {
          resolveRefund = resolve;
        }),
    );
    const returnedSale: DirectSale = {
      ...sale,
      collectionStatus: "returned_full",
      return: {
        occurredOn: "2026-10-05",
        refundDueMinor: 1200,
        operationKey: "return-key-1",
        recordedAt: "2026-10-05T09:00:00.000Z",
        reason: "أُرجع كاملًا",
      },
      refundPayments: [],
      refundedMinor: 0,
    };
    /* (١) بيع نشط غير مُرتجع — فعل المرتجع الكامل معلن الجري. */
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        directSales: { get: vi.fn().mockResolvedValue({ ok: true, value: sale }) },
        saleMovements: { fullReturn, payRefund },
      }),
    );

    renderEditor();

    await screen.findByRole("heading", { name: "تصحيح بيع مباشر" });
    fireEvent.click(screen.getByText("المرتجع الكامل"));
    fireEvent.change(screen.getByPlaceholderText("مثال: أُرجع كاملًا"), {
      target: { value: "أرجعت الزبونة الصندوق كاملًا" },
    });
    fireEvent.click(screen.getByRole("button", { name: "تأكيد المرتجع الكامل" }));
    expect(await screen.findByText("جارٍ تسجيل المرتجع…")).toBeTruthy();
    resolveReturn({ ok: true, value: { sale, cashEntry: null, reused: false } });

    /* (٢) بيع مُرتجع — دفع الرد معلن الجري أثناء مالك الحركات. */
    cleanup();
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        directSales: { get: vi.fn().mockResolvedValue({ ok: true, value: returnedSale }) },
        saleMovements: { fullReturn: vi.fn(), payRefund },
      }),
    );

    renderEditor();

    await screen.findByRole("heading", { name: "تصحيح بيع مباشر" });
    fireEvent.change(screen.getByLabelText("مبلغ دفع الرد"), { target: { value: "3.00" } });
    fireEvent.click(screen.getByRole("button", { name: "سجّل دفع الرد" }));
    expect(await screen.findByText("جارٍ تسجيل دفع الرد…")).toBeTruthy();
    resolveRefund({
      ok: true,
      value: { sale: returnedSale, cashEntry: null, reused: false },
    });
    await screen.findByText("سُجّل دفع الرد بتاريخه.");
  });

  /* S11 §5 (ملاحظة المالك — تغطية حالة خدمة الحركات الفارغة/التعارض):
   * الخدمة الكسولة غير الجاهزة والتعارض كلاهما ظاهر بصدق بلا انفجار. */
  it("S11 حركات البيع: الخدمة غير الجاهزة تُخبر بصدق، والتعارض يعيد القراءة ويحفظ المدخلات", async () => {
    const get = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        value: { ...sale, collectedMinor: 500, collectionStatus: "partial_debt", customerName: "ليان" },
      });
    const notifyDataChanged = vi.fn();
    /* (أ) الخدمة الكسولة لم تجهز بعد — لا استدعاء ولا انفجار. */
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({ directSales: { get }, saleMovements: undefined, notifyDataChanged }),
    );

    renderEditor();

    await screen.findByRole("heading", { name: "تصحيح بيع مباشر" });
    fireEvent.click(screen.getByText("المرتجع الكامل"));
    fireEvent.change(screen.getByPlaceholderText("مثال: أُرجع كاملًا"), {
      target: { value: "أُرجع كاملًا" },
    });
    fireEvent.click(screen.getByRole("button", { name: "تأكيد المرتجع الكامل" }));
    expect(await screen.findByText("جارٍ تجهيز خدمة الحفظ — لحظة ثم أعد المحاولة.")).toBeTruthy();

    /* (ب) التعارض: رسالة صادقة وإعادة قراءة السجل مع حفظ مدخلات المستخدم. */
    cleanup();
    wouterMocks.location = "/direct-sales/sale-1";
    const fullReturnConflict = vi.fn().mockResolvedValue({
      ok: false,
      code: "conflict",
      message: "تغيّر البيع من نافذة أخرى؛ راجع التغييرات قبل الحفظ.",
    });
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        directSales: { get },
        saleMovements: { fullReturn: fullReturnConflict, payRefund: vi.fn() },
        notifyDataChanged,
      }),
    );

    renderEditor();

    await screen.findByRole("heading", { name: "تصحيح بيع مباشر" });
    fireEvent.click(screen.getByText("المرتجع الكامل"));
    fireEvent.change(screen.getByPlaceholderText("مثال: أُرجع كاملًا"), {
      target: { value: "أرجعت الزبونة الصندوق" },
    });
    fireEvent.click(screen.getByRole("button", { name: "تأكيد المرتجع الكامل" }));
    expect(await screen.findByText(/تغيّر البيع من نافذة أخرى/)).toBeTruthy();
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThanOrEqual(2));
    /* المدخلات لم تُسحق بإعادة القراءة (preserveFormRef). */
    expect((screen.getByPlaceholderText("مثال: أُرجع كاملًا") as HTMLTextAreaElement).value).toBe(
      "أرجعت الزبونة الصندوق",
    );
    expect(fullReturnConflict).toHaveBeenCalledTimes(1);
  });

  /* S11 (تصحيح المراجعة R5-001): زر «إبقاء البيع» يغلق الإفصاح فعلًا —
   * لا زرًا صامتًا بجوار فعل مدمّر. */
  it("S11 المرتجع الكامل: زر الإبقاء يغلق الإفصاح والسبب محفوظ", async () => {
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        directSales: { get: vi.fn().mockResolvedValue({ ok: true, value: sale }) },
        saleMovements: { fullReturn: vi.fn(), payRefund: vi.fn() },
      }),
    );

    renderEditor();

    await screen.findByRole("heading", { name: "تصحيح بيع مباشر" });
    fireEvent.click(screen.getByText("المرتجع الكامل"));
    const summary = screen.getByText("المرتجع الكامل").closest("details");
    expect(summary?.open).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("مثال: أُرجع كاملًا"), {
      target: { value: "أرجعت الزبونة الصندوق" },
    });
    /* زر الإبقاء يغلق الإفصاح فعلًا والسبب محفوظ (لا فقدان مدخل). */
    fireEvent.click(screen.getByRole("button", { name: "إبقاء البيع" }));
    expect(summary?.open).toBe(false);
    fireEvent.click(screen.getByText("المرتجع الكامل"));
    expect((screen.getByPlaceholderText("مثال: أُرجع كاملًا") as HTMLTextAreaElement).value).toBe(
      "أرجعت الزبونة الصندوق",
    );
  });

  /* تصحيح المراجعة R5-007: الإبقاء يمسح التغذية الراجعة القديمة — لا يبقى
   * نص خطأ أو نجاح مثبت تحت إفصاح مغلق. */
  it("S11 المرتجع الكامل: الإبقاء يمسح التغذية الراجعة القديمة", async () => {
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        directSales: { get: vi.fn().mockResolvedValue({ ok: true, value: sale }) },
        saleMovements: { fullReturn: vi.fn(), payRefund: vi.fn() },
      }),
    );

    renderEditor();

    await screen.findByRole("heading", { name: "تصحيح بيع مباشر" });
    fireEvent.click(screen.getByText("المرتجع الكامل"));
    /* خطأ تحقق يظهر خارج الإفصاح ثم الإبقاء يمسحه. */
    fireEvent.click(screen.getByRole("button", { name: "تأكيد المرتجع الكامل" }));
    expect(await screen.findByText("اكتب سبب المرتجع قبل تأكيده.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "إبقاء البيع" }));
    expect(screen.queryByText("اكتب سبب المرتجع قبل تأكيده.")).toBeNull();
  });

  /* تصحيح المراجعة R5-003: نص غير صالح في مبلغ الرد يمنع الدفع — لا
   * يُدفع رصيد نموذج قديم والشاشة تعرض نصًا آخر. */
  it("S11 دفع الرد: نص غير صالح في المبلغ يمنع الدفع بلا استدعاء", async () => {
    const returnedSale: DirectSale = {
      ...sale,
      collectionStatus: "returned_full",
      return: {
        occurredOn: "2026-10-05",
        refundDueMinor: 1200,
        operationKey: "return-key-1",
        recordedAt: "2026-10-05T09:00:00.000Z",
        reason: "أرجعت الزبونة الصندوق كاملًا",
      },
      refundPayments: [],
      refundedMinor: 0,
    };
    const payRefund = vi.fn();
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        directSales: { get: vi.fn().mockResolvedValue({ ok: true, value: returnedSale }) },
        saleMovements: { fullReturn: vi.fn(), payRefund },
      }),
    );

    renderEditor();

    await screen.findByRole("heading", { name: "تصحيح بيع مباشر" });
    /* رقم صالح ثم نص غير صالح فوقه: البوابة تمنع الدفع ولا يستدعي المالك. */
    fireEvent.change(screen.getByLabelText("مبلغ دفع الرد"), { target: { value: "3.00" } });
    fireEvent.change(screen.getByLabelText("مبلغ دفع الرد"), { target: { value: "ثلاثة" } });
    fireEvent.click(screen.getByRole("button", { name: "سجّل دفع الرد" }));
    expect(await screen.findByText("أدخل مبلغ دفع الرد بالأرقام 0–9.")).toBeTruthy();
    expect(payRefund).not.toHaveBeenCalled();
  });

  /* S11 (UNIT-026 sale-slice / SDF-054 — تصحيح المراجعة R2-004): دفع رد فعلي
   * مؤرخ على بيع مُرتجع — الحق القائم معروض بالمقبوض فقط، والدفع بمالك
   * الحركات بمفتاح واحد، والصرف من محفظة مختارة. */
  it("S11 دفع الرد: الحق القائم بالمقبوض فقط والدفع المؤرخ بمفتاح واحد ومحفظة", async () => {
    const returnedSale: DirectSale = {
      ...sale,
      collectionStatus: "returned_full",
      return: {
        occurredOn: "2026-10-05",
        refundDueMinor: 1200,
        operationKey: "return-key-1",
        recordedAt: "2026-10-05T09:00:00.000Z",
        reason: "أرجعت الزبونة الصندوق كاملًا",
      },
      refundPayments: [],
      refundedMinor: 0,
    };
    const payRefund = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        sale: {
          ...returnedSale,
          refundedMinor: 300,
          refundPayments: [
            {
              id: "sale-1:refund:op",
              amountMinor: 300,
              occurredOn: "2026-10-07",
              operationKey: "refund-key",
              recordedAt: "2026-10-07T09:00:00.000Z",
              note: null,
              allocationEntryId: "cash-1",
            },
          ],
        },
        cashEntry: { id: "cash-1", walletId: "drawer-1", cashDeltaMinor: -300 },
        reused: false,
      },
    });
    const notifyDataChanged = vi.fn();
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        directSales: { get: vi.fn().mockResolvedValue({ ok: true, value: returnedSale }) },
        cashContinuity: {
          overview: vi.fn().mockResolvedValue({
            ok: true,
            value: { wallets: [{ id: "drawer-1", name: "درج النقد", kind: "cash_drawer" }] },
          }),
        },
        saleMovements: { fullReturn: vi.fn(), payRefund },
        notifyDataChanged,
      }),
    );

    renderEditor();

    await screen.findByRole("heading", { name: "تصحيح بيع مباشر" });
    /* الحق القائم بالمقبوض فقط (12.00 من أصل 12.00 مقبوض) — لا بالإيراد مرتين. */
    const standing = await screen.findByText(/الحق القائم/);
    expect(standing.textContent).toContain("12.00");
    expect(standing.textContent).toContain("مقبوض");

    /* مبلغ غير مدخل يُخبر بصدق. */
    fireEvent.click(screen.getByRole("button", { name: "سجّل دفع الرد" }));
    expect(await screen.findByText("أدخل مبلغ دفع الرد بالأرقام 0–9.")).toBeTruthy();
    expect(payRefund).not.toHaveBeenCalled();

    /* المبلغ والتاريخ والمحفظة تمر بمالك الحركات بمفتاح نية واحد. */
    fireEvent.change(screen.getByLabelText("مبلغ دفع الرد"), { target: { value: "3.00" } });
    /* خيارات المحفظة تُحمَّل من نظرة الكاش — انتظر ظهور الدرج قبل الاختيار. */
    await waitFor(() => expect(screen.getByRole("option", { name: "درج النقد" })).toBeTruthy());
    fireEvent.change(screen.getByLabelText("من أي محفظة؟ (اختياري)"), { target: { value: "drawer-1" } });
    fireEvent.click(screen.getByRole("button", { name: "سجّل دفع الرد" }));

    await waitFor(() => expect(payRefund).toHaveBeenCalledTimes(1));
    expect(payRefund).toHaveBeenCalledWith(
      "sale-1",
      expect.objectContaining({ amountMinor: 300, walletId: "drawer-1" }),
    );
    expect((payRefund.mock.calls[0] as [string, { operationKey: string }])[1].operationKey).toMatch(
      /direct-sale-refund-ui-/,
    );
    expect(await screen.findByText("سُجّل دفع الرد بتاريخه.")).toBeTruthy();
    expect(notifyDataChanged).toHaveBeenCalledOnce();
  });

  /* S05 (DOC-014 / UNIT-037 B3 + SDF-041): فشل حفظ الطرف الاختياري نتيجة
   * جزئية صادقة، وإعادة المحاولة على شاشة النتيجة تحفظ الطرف وحده — لا
   * يُعاد البيع ولا يُتراجع ولا يتكرر، والمفتاح المشتق نفسه لا ينشئ طرفًا
   * ثانيًا. (مسار S11-MR-001 الجديد: وضع الدفع الجزئي الصريح بلا سؤال فرق.) */
  it("shows the party-save partial failure and the retry button saves the party alone without re-recording the sale", async () => {
    wouterMocks.location = "/direct-sales/new";
    const recorded: DirectSale = { ...sale, id: "sale-party-retry" };
    const record = vi.fn().mockResolvedValue({ ok: true, value: recorded });
    const distributeUnallocated = vi.fn().mockResolvedValue({ ok: true, value: { walletName: "درج النقد" } });
    const notifyDataChanged = vi.fn();
    const partySave = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        code: "storage_error",
        message: "تعذر حفظ العميل في القائمة الآن.",
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { party: { id: "party-1", label: "أم أحمد — الجارة" }, reused: false },
      });
    mockedUsePrototypeServices.mockReturnValue(
      baseServices({
        directSales: { record },
        distributeUnallocated,
        partyDirectory: {
          save: partySave,
          suggestParties: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        },
        notifyDataChanged,
      }),
    );

    renderEditor();

    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    fireEvent.change(screen.getByLabelText("إجمالي البيع — د.أ"), { target: { value: "12.00" } });
    /* الوضع الجزئي الصريح: الدين من الاختيار — لا لوحة قرار فرق. */
    fireEvent.click(screen.getByRole("radio", { name: /استلمت جزءًا والباقي دَين/ }));
    fireEvent.change(screen.getByLabelText("المقبوض الآن — د.أ"), { target: { value: "5.00" } });
    fireEvent.change(screen.getByLabelText("على مَن المبلغ؟ — اسم أو وصف"), {
      target: { value: "أم أحمد — الجارة" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /حفظه لإعادة الاستخدام/ }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));

    /* الجزء المنجز: البيع سُجل. الجزء الناقص ظاهر بسببه (role=status). */
    await screen.findByRole("heading", { name: "سُجّل البيع" });
    const partial = await screen.findByText(/لم يُحفظ العميل في القائمة/);
    expect(partial.getAttribute("role")).toBe("status");
    expect(partial.textContent).toContain("تعذر حفظ العميل في القائمة الآن.");

    /* إعادة المحاولة تحفظ الطرف وحده: نفس المفتاح المشتق، البيع لا يُعاد. */
    expect(record).toHaveBeenCalledTimes(1);
    expect(partySave).toHaveBeenCalledTimes(1);
    const firstKey = vi.mocked(partySave).mock.calls[0][0].operationKey;
    fireEvent.click(screen.getByRole("button", { name: "أعد محاولة حفظه في القائمة" }));
    await waitFor(() => expect(screen.queryByText(/لم يُحفظ العميل في القائمة/)).toBeNull());
    expect(partySave).toHaveBeenCalledTimes(2);
    expect(vi.mocked(partySave).mock.calls[1][0].operationKey).toBe(firstKey);
    expect(firstKey).toMatch(/:party-save$/);
    /* البيع لم يُعَد أبدًا — نداء واحد قبل إعادة المحاولة وبعدها. */
    expect(record).toHaveBeenCalledTimes(1);
    expect(notifyDataChanged).toHaveBeenCalled();
  });
});
