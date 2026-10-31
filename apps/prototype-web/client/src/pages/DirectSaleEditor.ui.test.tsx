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
    mockedUsePrototypeServices.mockReturnValue({
      /* كعب خدمة المسودة — قراءة فارغة وحفظ ناجح؛ الصفحة تُختبر لا المخزن. */
      formDrafts: {
        read: vi.fn().mockResolvedValue({ ok: true, value: null }),
        save: vi.fn().mockResolvedValue({ ok: true, value: { updatedAt: "2026-09-04T12:00:00.000Z" } }),
        discard: vi.fn().mockResolvedValue({ ok: true, value: null }),
      },
      catalog: {
        list: vi.fn().mockResolvedValue({ ok: true, items: [catalogItem] }),
      },
      directSales: {
        create,
      },
      /* المجموعة ٣ (Scope D): خدمتا وجهة القبض — موجودتان في السياق الحقيقي. */
      cashContinuity: {
        overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets: [] } }),
      },
      /* EXE-010 (AUD-NEW-04): قسم عكس التحصيل يقرأ القيود القابلة للعكس —
       * كعب فارغ يكفي لاختبارات التحرير والإلغاء هنا. */
      saleCollectionReversal: {
        listReversibleCollections: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        preview: vi.fn(),
        reverse: vi.fn(),
      },
      projectFinance: {
        distributeUnallocated: vi.fn(),
      },
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DirectSaleEditor />
      </UnsavedChangesProvider>,
    );

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

    /* كمية ٢ ثم اختيار مرجع له اقتراح سعر: لا تعبئة تلقائية ولا ضرب عن المالك. */
    fireEvent.change(screen.getByLabelText("الكمية"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("ربط مرجع"), { target: { value: "ref-1" } });
    expect(
      await screen.findByText(
        (content, element) => element?.tagName === "SMALL" && content.includes("سعرٌ للقطعة الواحدة"),
      ),
    ).toBeTruthy();
    /* السعر الفعلي بقي بيد المالك: لم يُعبّأ رقمًا عنه. */
    expect((screen.getByLabelText("السعر المتفق عليه") as HTMLInputElement).value).toBe("0.00");

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

  it("loads a saved sale and submits its corrected values", async () => {
    const update = vi.fn().mockResolvedValue({ ok: true, value: sale });
    const notifyDataChanged = vi.fn();
    mockedUsePrototypeServices.mockReturnValue({
      /* كعب خدمة المسودة — قراءة فارغة وحفظ ناجح؛ الصفحة تُختبر لا المخزن. */
      formDrafts: {
        read: vi.fn().mockResolvedValue({ ok: true, value: null }),
        save: vi.fn().mockResolvedValue({ ok: true, value: { updatedAt: "2026-09-04T12:00:00.000Z" } }),
        discard: vi.fn().mockResolvedValue({ ok: true, value: null }),
      },
      catalog: {
        list: vi.fn().mockResolvedValue({ ok: true, items: [] }),
      },
      directSales: {
        get: vi.fn().mockResolvedValue({ ok: true, value: sale }),
        update,
      },
      cashContinuity: {
        overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets: [] } }),
      },
      /* EXE-010 (AUD-NEW-04): قسم عكس التحصيل يقرأ القيود القابلة للعكس —
       * كعب فارغ يكفي لاختبارات التحرير والإلغاء هنا. */
      saleCollectionReversal: {
        listReversibleCollections: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        preview: vi.fn(),
        reverse: vi.fn(),
      },
      projectFinance: {
        distributeUnallocated: vi.fn(),
      },
      notifyDataChanged,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DirectSaleEditor />
      </UnsavedChangesProvider>,
    );

    await screen.findByRole("heading", { name: "تصحيح بيع مباشر" });
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
          costMinor: 500,
        }),
      ),
    );
    expect(notifyDataChanged).toHaveBeenCalledOnce();
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/orders");
  });

  it("requires a reason and records cancellation without deleting the sale", async () => {
    const cancel = vi.fn().mockResolvedValue({
      ok: true,
      value: { ...sale, status: "cancelled" },
    });
    mockedUsePrototypeServices.mockReturnValue({
      /* كعب خدمة المسودة — قراءة فارغة وحفظ ناجح؛ الصفحة تُختبر لا المخزن. */
      formDrafts: {
        read: vi.fn().mockResolvedValue({ ok: true, value: null }),
        save: vi.fn().mockResolvedValue({ ok: true, value: { updatedAt: "2026-09-04T12:00:00.000Z" } }),
        discard: vi.fn().mockResolvedValue({ ok: true, value: null }),
      },
      catalog: {
        list: vi.fn().mockResolvedValue({ ok: true, items: [] }),
      },
      directSales: {
        get: vi.fn().mockResolvedValue({ ok: true, value: sale }),
        cancel,
      },
      cashContinuity: {
        overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets: [] } }),
      },
      /* EXE-010 (AUD-NEW-04): قسم عكس التحصيل يقرأ القيود القابلة للعكس —
       * كعب فارغ يكفي لاختبارات التحرير والإلغاء هنا. */
      saleCollectionReversal: {
        listReversibleCollections: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        preview: vi.fn(),
        reverse: vi.fn(),
      },
      projectFinance: {
        distributeUnallocated: vi.fn(),
      },
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DirectSaleEditor />
      </UnsavedChangesProvider>,
    );

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
    const notifyDataChanged = vi.fn();
    mockedUsePrototypeServices.mockReturnValue({
      /* كعب خدمة المسودة — قراءة فارغة وحفظ ناجح؛ الصفحة تُختبر لا المخزن. */
      formDrafts: {
        read: vi.fn().mockResolvedValue({ ok: true, value: null }),
        save: vi.fn().mockResolvedValue({ ok: true, value: { updatedAt: "2026-09-04T12:00:00.000Z" } }),
        discard: vi.fn().mockResolvedValue({ ok: true, value: null }),
      },
      catalog: {
        list: vi.fn().mockResolvedValue({ ok: true, items: [] }),
      },
      directSales: {
        record,
      },
      cashContinuity: {
        overview: vi.fn().mockResolvedValue({
          ok: true,
          value: { wallets: [{ id: "drawer-partial", name: "درج النقد", kind: "cash_drawer" }] },
        }),
      },
      saleCollectionReversal: {
        listReversibleCollections: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        preview: vi.fn(),
        reverse: vi.fn(),
      },
      projectFinance: {
        distributeUnallocated,
      },
      notifyDataChanged,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DirectSaleEditor />
      </UnsavedChangesProvider>,
    );

    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    fireEvent.change(screen.getByLabelText("السعر المتفق عليه"), { target: { value: "12.00" } });
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
    expect(notifyDataChanged).not.toHaveBeenCalled();
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
    const notifyDataChanged = vi.fn();
    mockedUsePrototypeServices.mockReturnValue({
      formDrafts: {
        read: vi.fn().mockResolvedValue({ ok: true, value: null }),
        save: vi.fn().mockResolvedValue({ ok: true, value: { updatedAt: "2026-09-04T12:00:00.000Z" } }),
        discard: vi.fn().mockResolvedValue({ ok: true, value: null }),
      },
      catalog: { list: vi.fn().mockResolvedValue({ ok: true, items: [] }) },
      directSales: { get: vi.fn().mockResolvedValue({ ok: true, value: sale }) },
      cashContinuity: { overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets: [] } }) },
      saleCollectionReversal: {
        listReversibleCollections: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        preview: vi.fn(),
        reverse: vi.fn(),
      },
      projectFinance: { distributeUnallocated: vi.fn() },
      saleMovements: { fullReturn, payRefund: vi.fn() },
      notifyDataChanged,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DirectSaleEditor />
      </UnsavedChangesProvider>,
    );

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
    expect(notifyDataChanged).toHaveBeenCalledOnce();
    /* تصحيح المراجعة R5-007: نجاح المرتجع يغلق الإفصاح ويبقى النص خارجه —
     * مرئيًا معلنًا في المتصفح الحقيقي (المطوي لا يعرض ولا يُعلن). */
    const success = await screen.findByText(/سُجّل المرتجع الكامل/);
    expect(success.closest("details")).toBeNull();
    const disclosure = screen.getByText("المرتجع الكامل").closest("details");
    expect(disclosure?.open).toBe(false);
  });

  /* S11 (تصحيح المراجعة R5-001): زر «إبقاء البيع» يغلق الإفصاح فعلًا —
   * لا زرًا صامتًا بجوار فعل مدمّر. */
  it("S11 المرتجع الكامل: زر الإبقاء يغلق الإفصاح والسبب محفوظ", async () => {
    mockedUsePrototypeServices.mockReturnValue({
      formDrafts: {
        read: vi.fn().mockResolvedValue({ ok: true, value: null }),
        save: vi.fn().mockResolvedValue({ ok: true, value: { updatedAt: "2026-09-04T12:00:00.000Z" } }),
        discard: vi.fn().mockResolvedValue({ ok: true, value: null }),
      },
      catalog: { list: vi.fn().mockResolvedValue({ ok: true, items: [] }) },
      directSales: { get: vi.fn().mockResolvedValue({ ok: true, value: sale }) },
      cashContinuity: { overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets: [] } }) },
      saleCollectionReversal: {
        listReversibleCollections: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        preview: vi.fn(),
        reverse: vi.fn(),
      },
      projectFinance: { distributeUnallocated: vi.fn() },
      saleMovements: { fullReturn: vi.fn(), payRefund: vi.fn() },
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DirectSaleEditor />
      </UnsavedChangesProvider>,
    );

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
    mockedUsePrototypeServices.mockReturnValue({
      formDrafts: {
        read: vi.fn().mockResolvedValue({ ok: true, value: null }),
        save: vi.fn().mockResolvedValue({ ok: true, value: { updatedAt: "2026-09-04T12:00:00.000Z" } }),
        discard: vi.fn().mockResolvedValue({ ok: true, value: null }),
      },
      catalog: { list: vi.fn().mockResolvedValue({ ok: true, items: [] }) },
      directSales: { get: vi.fn().mockResolvedValue({ ok: true, value: sale }) },
      cashContinuity: { overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets: [] } }) },
      saleCollectionReversal: {
        listReversibleCollections: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        preview: vi.fn(),
        reverse: vi.fn(),
      },
      projectFinance: { distributeUnallocated: vi.fn() },
      saleMovements: { fullReturn: vi.fn(), payRefund: vi.fn() },
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DirectSaleEditor />
      </UnsavedChangesProvider>,
    );

    await screen.findByRole("heading", { name: "تصحيح بيع مباشر" });
    fireEvent.click(screen.getByText("المرتجع الكامل"));
    /* خطأ تحقق يظهر خارج الإفصاح ثم الإبقاء يمسحه. */
    fireEvent.click(screen.getByRole("button", { name: "تأكيد المرتجع الكامل" }));
    expect(await screen.findByText("اكتب سبب المرتجع قبل تأكيده.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "إبقاء البيع" }));
    expect(screen.queryByText("اكتب سبب المرتجع قبل تأكيده.")).toBeNull();
  });

  /* S11 (تصحيح المراجعة R5-003): نص غير صالح في مبلغ الرد يمنع الدفع — لا
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
    mockedUsePrototypeServices.mockReturnValue({
      formDrafts: {
        read: vi.fn().mockResolvedValue({ ok: true, value: null }),
        save: vi.fn().mockResolvedValue({ ok: true, value: { updatedAt: "2026-09-04T12:00:00.000Z" } }),
        discard: vi.fn().mockResolvedValue({ ok: true, value: null }),
      },
      catalog: { list: vi.fn().mockResolvedValue({ ok: true, items: [] }) },
      directSales: { get: vi.fn().mockResolvedValue({ ok: true, value: returnedSale }) },
      cashContinuity: { overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets: [] } }) },
      saleCollectionReversal: {
        listReversibleCollections: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        preview: vi.fn(),
        reverse: vi.fn(),
      },
      projectFinance: { distributeUnallocated: vi.fn() },
      saleMovements: { fullReturn: vi.fn(), payRefund },
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DirectSaleEditor />
      </UnsavedChangesProvider>,
    );

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
    mockedUsePrototypeServices.mockReturnValue({
      formDrafts: {
        read: vi.fn().mockResolvedValue({ ok: true, value: null }),
        save: vi.fn().mockResolvedValue({ ok: true, value: { updatedAt: "2026-09-04T12:00:00.000Z" } }),
        discard: vi.fn().mockResolvedValue({ ok: true, value: null }),
      },
      catalog: { list: vi.fn().mockResolvedValue({ ok: true, items: [] }) },
      directSales: { get: vi.fn().mockResolvedValue({ ok: true, value: returnedSale }) },
      cashContinuity: {
        overview: vi.fn().mockResolvedValue({
          ok: true,
          value: { wallets: [{ id: "drawer-1", name: "درج النقد", kind: "cash_drawer" }] },
        }),
      },
      saleCollectionReversal: {
        listReversibleCollections: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        preview: vi.fn(),
        reverse: vi.fn(),
      },
      projectFinance: { distributeUnallocated: vi.fn() },
      saleMovements: { fullReturn: vi.fn(), payRefund },
      notifyDataChanged,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DirectSaleEditor />
      </UnsavedChangesProvider>,
    );

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
   * ثانيًا. */
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
    mockedUsePrototypeServices.mockReturnValue({
      formDrafts: {
        read: vi.fn().mockResolvedValue({ ok: true, value: null }),
        save: vi.fn().mockResolvedValue({ ok: true, value: { updatedAt: "2026-09-04T12:00:00.000Z" } }),
        discard: vi.fn().mockResolvedValue({ ok: true, value: null }),
      },
      catalog: { list: vi.fn().mockResolvedValue({ ok: true, items: [] }) },
      directSales: { record },
      cashContinuity: {
        overview: vi.fn().mockResolvedValue({
          ok: true,
          value: { wallets: [{ id: "drawer-party", name: "درج النقد", kind: "cash_drawer" }] },
        }),
      },
      saleCollectionReversal: {
        listReversibleCollections: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        preview: vi.fn(),
        reverse: vi.fn(),
      },
      projectFinance: { distributeUnallocated },
      partyDirectory: { save: partySave, suggestParties: vi.fn().mockResolvedValue({ ok: true, value: [] }) },
      notifyDataChanged,
    } as unknown as ReturnType<typeof usePrototypeServices>);

    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DirectSaleEditor />
      </UnsavedChangesProvider>,
    );

    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    fireEvent.change(screen.getByLabelText("السعر المتفق عليه"), { target: { value: "12.00" } });
    fireEvent.change(screen.getByLabelText("ما قبضت الآن"), { target: { value: "5.00" } });
    /* فرق 7 دينار يوجب قرارًا صريحًا: الضغط الأول يكشف لوحة الفرق (لا يقرر
     * النظام مكانها)، ثم يُختار «الباقي عليه» ويُعاد الضغط على الحفظ. */
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));
    await screen.findByText("النظام لا يقرّر عنك — اختر ما حدث فعلًا:");
    fireEvent.click(screen.getByRole("radio", { name: /الباقي عليه/ }));
    await waitFor(() => expect(screen.getByLabelText("على مَن المبلغ؟ — اسم أو وصف")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("على مَن المبلغ؟ — اسم أو وصف"), {
      target: { value: "أم أحمد — الجارة" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /حفظه لإعادة الاستخدام/ }));
    fireEvent.click(screen.getByRole("button", { name: "أكمل الحفظ بالقرار المختار" }));

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
    /* البيع لم يُعاد أبدًا — نداء واحد قبل إعادة المحاولة وبعدها. */
    expect(record).toHaveBeenCalledTimes(1);
    expect(notifyDataChanged).toHaveBeenCalled();
  });
});
