/**
 * S11 (UNIT-004/005/026 sale-slice + SH-15 — أمر b33a8877): اختبارات نطاق
 * شريحة البيع المباشر والتحصيل والمرتجع — أمثلة الأمر المالية الخمسة من
 * الإثبات الدائم عند حد النطاق النقي:
 *  1) بيع 15 قبض 5 تكلفة 6: نقد 5 وإيراد 15 ومساهمة 9 وحق 10؛ تحصيل الـ10
 *     لاحقًا: نقد 10 وحق 0 ولا إيراد/مساهمة جديدة.
 *  2) محاولتا قبض متزامنتان تُحسمان عند حد كتابة المخزن (اختبارات
 *     التخزين/التطبيق) — هنا: المبلغ لا يتجاوز المتبقي الحي أبدًا.
 *  3) مرتجع كامل بعد قبض 5 وبقاء 10: إلغاء الحق 10 وحق رد 5 فقط؛ النقد لا
 *     يتغير قبل دفع رد فعلي، والدفع اللاحق مؤرخ لا يتجاوز الحق ولا يُكرر.
 *  4) شهر البيع وشهر القبض منفصلان؛ الإجمالي المجمل القديم بلا تواريخ مؤلفة.
 *  5) التكلفة المجهولة ≠ الصفر؛ الأسماء المتشابهة هويات مستقلة.
 */
import { describe, expect, it } from "vitest";
import {
  applyFullReturn,
  cancelDirectSale,
  collectDirectSalePayment,
  createDirectSale,
  directSaleOutstandingMinor,
  payDirectSaleRefund,
  reverseDirectSaleCollection,
  updateDirectSale,
} from "./index.js";

const CREATE = {
  id: "sale-s11",
  itemName: "صندوق هدايا",
  quantity: 1,
  revenueMinor: 1500,
  costMinor: null,
  occurredOn: "2026-09-15",
  recordedAt: "2026-09-15T10:00:00.000Z",
  note: "بيع مباشر",
  idempotencyKey: "sale-s11-op",
};

/** المثال ١: بيع 15 د.أ قبض 5 د.أ تكلفة 6 د.أ — دين مؤكد على زبون معرّف. */
function sale_15_5_6() {
  return createDirectSale({
    ...CREATE,
    collectedMinor: 500,
    collectionStatus: "partial_debt",
    customerName: "ليان — جارة المحل",
    costMinor: 600,
  });
}

/** مدخل قبضة التحصيل الجاهز — المفتاح والتاريخ قابلان للتمييز لكل حالة. */
const collectInput = (operationKey: string, amountMinor = 1000, occurredOn = "2026-10-01") => ({
  entryId: `sale-s11:col:${operationKey}`,
  amountMinor,
  occurredOn,
  operationKey,
  recordedAt: `${occurredOn}T09:00:00.000Z`,
});

/** إثبات البنية المالية الثابتة للبيع 15/5/6 قبل أي حركة لاحقة. */
function expectSaleBasis(sale: ReturnType<typeof sale_15_5_6>) {
  expect(sale.revenueMinor).toBe(1500);
  expect(sale.profitMinor).toBe(900);
  expect(directSaleOutstandingMinor(sale)).toBe(1000);
}

describe("S11 — مثال ١: بيع 15/قبض 5/تكلفة 6 ثم تحصيل 10", () => {
  it("القبض الابتدائي سطر مؤرخ بهوية ومفتاح حتميين والمساهمة 9 والحق 10", () => {
    const sale = sale_15_5_6();
    expectSaleBasis(sale);
    expect(sale.collectedMinor).toBe(500);
    expect(sale.collectionStatus).toBe("partial_debt");
    /* القبض الابتدائي موثق كسطر بتاريخ البيع نفسه (جزء من واقعة التسجيل). */
    expect(sale.collections).toHaveLength(1);
    const initial = sale.collections?.[0];
    if (!initial) throw new Error("missing initial entry");
    expect(initial.amountMinor).toBe(500);
    expect(initial.occurredOn).toBe("2026-09-15");
    expect(initial.operationKey).toBe("sale-s11-op:initial");
    expect(initial.id).toBe("sale-s11:initial");
  });

  it("تحصيل المتبقي 10 بتاريخه المستقل: الحق 0 ولا إيراد ولا مساهمة جديدة", () => {
    const sale = sale_15_5_6();
    const after = collectDirectSalePayment(sale, { ...collectInput("collect-op-1"), note: "تحصيل المتبقي" });
    expect(after.collectedMinor).toBe(1500);
    expect(after.collectionStatus).toBe("collected_in_full");
    expect(directSaleOutstandingMinor(after)).toBe(0);
    /* الإيراد والمساهمة لا يتغيران بالتحصيل — القبض ليس ربحًا. */
    expect(after.revenueMinor).toBe(1500);
    expect(after.profitMinor).toBe(900);
    /* سطرا القبض مؤرخان بتاريخين مختلفين: شهر البيع وشهر القبض منفصلان (مثال ٤). */
    expect(after.collections).toHaveLength(2);
    expect(after.collections?.map(entry => entry.occurredOn)).toEqual(["2026-09-15", "2026-10-01"]);
    expect(after.collections?.[1]?.operationKey).toBe("collect-op-1");
  });

  it("تحصيل جزئي ثانٍ يبقي الحق حيًا صادقًا", () => {
    const sale = sale_15_5_6();
    const after = collectDirectSalePayment(sale, collectInput("collect-op-part", 400, "2026-09-20"));
    expect(after.collectedMinor).toBe(900);
    expect(after.collectionStatus).toBe("partial_debt");
    expect(directSaleOutstandingMinor(after)).toBe(600);
  });
});

describe("S11 — حدود التحصيل عند حد النطاق (مثال ٢: الحق لا يكون سالبًا)", () => {
  it("المبلغ الأكبر من المتبقي الحي يُرفض — لا قبض مزدوج ولا حق سالب", () => {
    const sale = sale_15_5_6();
    expect(() => collectDirectSalePayment(sale, collectInput("op-over", 1001))).toThrow("يتجاوز المتبقي");
  });

  it("مفتاح النية المكرر يُرفض داخل النطاق — لا سطر ثانٍ للقبضة نفسها", () => {
    const sale = sale_15_5_6();
    /* قبضة جزئية تبقي البيع مؤهل المتبقي — ثم إعادة المفتاح نفسه مرفوضة. */
    const once = collectDirectSalePayment(sale, collectInput("collect-op-1", 400));
    expect(once.collectionStatus).toBe("partial_debt");
    expect(() => collectDirectSalePayment(once, collectInput("collect-op-1", 400))).toThrow("سابقًا");
  });

  it("بيع ملغى أو مُرتجع أو غير مؤكد المتبقي ليس مصدرًا مؤهلًا للتحصيل", () => {
    const sale = sale_15_5_6();
    const cancelled = cancelDirectSale(sale, {
      kind: "cancel",
      idempotencyKey: "cancel-op",
      createdAt: "2026-09-16T09:00:00.000Z",
      reason: "خطأ إدخال",
    });
    expect(() => collectDirectSalePayment(cancelled, collectInput("op-x", 100, "2026-09-16"))).toThrow(
      "ملغى",
    );
    const undecided = createDirectSale({
      ...CREATE,
      collectedMinor: 500,
      collectionStatus: "partial_needs_review",
      customerName: null,
    });
    expect(() => collectDirectSalePayment(undecided, collectInput("op-y", 100, "2026-09-16"))).toThrow(
      "مؤكد المتبقي",
    );
  });
});

describe("S11 — مثال ٣: المرتجع الكامل PD-02 ثم دفع الرد الفعلي", () => {
  it("المرتجع يلغي الحق 10 ويثبت رد 5 فقط: الأصل والتاريخ محفوظان والنقد لا يتغير", () => {
    const sale = sale_15_5_6();
    const returned = applyFullReturn(sale, {
      occurredOn: "2026-10-05",
      operationKey: "return-op-1",
      recordedAt: "2026-10-05T09:00:00.000Z",
      reason: "أرجعت الزبونة الصندوق كاملًا",
    });
    /* الحق المتبقي أُلغي — لا يُحصّل ولا يظهر دينًا. */
    expect(returned.collectionStatus).toBe("returned_full");
    expect(() => collectDirectSalePayment(returned, collectInput("op-z", 100, "2026-10-06"))).toThrow(
      "مُرتجع",
    );
    /* حق الرد = المقبوض فعليًا فقط (5) لا الإيراد (15). */
    expect(returned.return?.refundDueMinor).toBe(500);
    /* الأصل محفوظ حرفيًا: الإيراد والتكلفة والمساهمة والقبض وسجل التغييرات. */
    expect(returned.revenueMinor).toBe(1500);
    expect(returned.profitMinor).toBe(900);
    expect(returned.collectedMinor).toBe(500);
    expect(returned.refundedMinor ?? 0).toBe(0);
    expect(returned.occurredOn).toBe("2026-09-15");
    expect(returned.return?.occurredOn).toBe("2026-10-05");
  });
});

describe("S11 — مثال ٣ (دفع الرد): مؤرخ ولا يتجاوز الحق ولا يُدفع مرتين (SDF-054)", () => {
  it("دفع جزئي ثم إكمال ثم رفض الزيادة — والمفتاح لا يُدفع به مرتين", () => {
    const returned = applyFullReturn(sale_15_5_6(), {
      occurredOn: "2026-10-05",
      operationKey: "return-op-1",
      recordedAt: "2026-10-05T09:00:00.000Z",
      reason: "مرتجع كامل",
    });
    const paid = payDirectSaleRefund(returned, {
      entryId: "sale-s11:refund-1",
      amountMinor: 300,
      occurredOn: "2026-10-07",
      operationKey: "refund-op-1",
      recordedAt: "2026-10-07T09:00:00.000Z",
    });
    expect(paid.refundedMinor).toBe(300);
    expect(paid.refundPayments).toHaveLength(1);
    expect(paid.refundPayments?.[0]?.occurredOn).toBe("2026-10-07");
    /* والمفتاح نفسه لا يُدفع به مرتين (بعد دفع جزئي يبقي الحق قائمًا). */
    expect(() =>
      payDirectSaleRefund(paid, {
        entryId: "sale-s11:refund-1b",
        amountMinor: 200,
        occurredOn: "2026-10-08",
        operationKey: "refund-op-1",
        recordedAt: "2026-10-08T09:00:00.000Z",
      }),
    ).toThrow("سابقًا");
    /* والحق استُنفد بعد الرد كاملًا: الدفع الزائد مرفوض. */
    const paidFull = payDirectSaleRefund(paid, {
      entryId: "sale-s11:refund-2",
      amountMinor: 200,
      occurredOn: "2026-10-09",
      operationKey: "refund-op-2",
      recordedAt: "2026-10-09T09:00:00.000Z",
    });
    expect(paidFull.refundedMinor).toBe(500);
    expect(() =>
      payDirectSaleRefund(paidFull, {
        entryId: "sale-s11:refund-3",
        amountMinor: 1,
        occurredOn: "2026-10-10",
        operationKey: "refund-op-3",
        recordedAt: "2026-10-10T09:00:00.000Z",
      }),
    ).toThrow("يتجاوز حق الرد");
  });
});

describe("S11 — مثال ٣ (تكملة): المرتجع نهائي ماليًا", () => {
  it("لا تعديل ولا تخفيض ولا إلغاء بعده ولا مرتجع ثانٍ", () => {
    const returned = applyFullReturn(sale_15_5_6(), {
      occurredOn: "2026-10-05",
      operationKey: "return-op-1",
      recordedAt: "2026-10-05T09:00:00.000Z",
      reason: "مرتجع كامل",
    });
    expect(() =>
      updateDirectSale(
        returned,
        {
          itemName: "اسم جديد",
          quantity: 1,
          revenueMinor: 1500,
          collectedMinor: 500,
          collectionStatus: "partial_debt",
          costMinor: 600,
          occurredOn: "2026-09-15",
          note: "بيع مباشر",
        },
        {
          kind: "edit",
          idempotencyKey: "edit-after-return",
          createdAt: "2026-10-06T09:00:00.000Z",
          reason: null,
        },
      ),
    ).toThrow("مُرتجع");
    expect(() =>
      cancelDirectSale(returned, {
        kind: "cancel",
        idempotencyKey: "cancel-after-return",
        createdAt: "2026-10-06T09:00:00.000Z",
        reason: "إلغاء خاطئ",
      }),
    ).toThrow("مُرتجع");
    expect(() =>
      applyFullReturn(returned, {
        occurredOn: "2026-10-06",
        operationKey: "return-op-2",
        recordedAt: "2026-10-06T09:00:00.000Z",
        reason: "مرتجع ثانٍ",
      }),
    ).toThrow("مسبقًا");
    /* والدفع بلا مرتجع مرفوض. */
    expect(() =>
      payDirectSaleRefund(sale_15_5_6(), {
        entryId: "r",
        amountMinor: 100,
        occurredOn: "2026-10-05",
        operationKey: "refund-no-return",
        recordedAt: "2026-10-05T09:00:00.000Z",
      }),
    ).toThrow("مُرتجعًا");
  });
});

describe("S11 — مثال ٤ و٥: فصل التواريخ والإرث المجمل والمعرفة والهويات", () => {
  it("القبض الابتدائي سطر مؤرخ عند وجوده وصفر لا ينشئ سطرًا؛ والإرث المجمل بلا تواريخ مؤلفة", () => {
    const cashSale = createDirectSale({ ...CREATE, collectedMinor: 1500 });
    /* البيع النقدي الكامل: القبض الابتدائي سطر مؤرخ واحد بتاريخ البيع. */
    expect(cashSale.collections).toHaveLength(1);
    expect(cashSale.collections?.[0]?.amountMinor).toBe(1500);
    /* «لم أُقبض»: صفر صريح بلا أي سطر (لا حركة بلا مال). */
    const unpaidSale = createDirectSale({
      ...CREATE,
      collectedMinor: 0,
      collectionStatus: "partial_debt",
      customerName: "زبون آجل كامل",
    });
    expect(unpaidSale.collections ?? []).toHaveLength(0);
    /* سجل قديم (محاكاة): collectedMinor بلا collections — يقرأ إجماله ولا
     * تؤلف تواريخ دفعاته أبدًا (SDF-014). */
    const legacy: typeof cashSale = {
      ...cashSale,
      collectedMinor: 500,
      collectionStatus: "partial_debt",
    };
    delete (legacy as { collections?: unknown }).collections;
    expect(legacy.collections ?? []).toHaveLength(0);
    expect(legacy.collectedMinor).toBe(500);
    /* والتحصيل عليه يضيف سطرًا مؤرخًا جديدًا دون لمس الإجمالي القديم. */
    const after = collectDirectSalePayment(legacy, {
      ...collectInput("legacy-col-op", 300, "2026-10-02"),
      entryId: "legacy:col-1",
    });
    expect(after.collectedMinor).toBe(800);
    expect(after.collections).toHaveLength(1);
  });
});

describe("S11 — مثال ٥: المعرفة والهويات والتعديل الوصفي", () => {
  it("التكلفة المجهولة ليست صفرًا: مجهول يحجب النتيجة وصفر مؤكد لا يحجبها", () => {
    const unknownCost = createDirectSale({ ...CREATE, collectedMinor: 1500, costMinor: null });
    expect(unknownCost.costMinor).toBeNull();
    expect(unknownCost.profitMinor).toBeNull();
    const zeroCost = createDirectSale({ ...CREATE, collectedMinor: 1500, costMinor: 0 });
    expect(zeroCost.costMinor).toBe(0);
    expect(zeroCost.profitMinor).toBe(1500);
  });

  it("التعديل الوصفي يحفظ خطوط القبض المؤرخة وحق الرد ومدفوعاته حرفيًا", () => {
    const sale = sale_15_5_6();
    const collected = collectDirectSalePayment(sale, collectInput("collect-op-1"));
    const edited = updateDirectSale(
      collected,
      {
        itemName: "صندوق هدايا فاخر",
        quantity: 2,
        revenueMinor: 1500,
        collectedMinor: 1500,
        collectionStatus: "collected_in_full",
        costMinor: 600,
        occurredOn: "2026-09-15",
        note: "بيع مباشر",
      },
      {
        kind: "edit",
        idempotencyKey: "edit-op-1",
        createdAt: "2026-10-02T09:00:00.000Z",
        reason: "تصحيح وصف",
      },
    );
    expect(edited.collections).toEqual(collected.collections);
    expect(edited.itemName).toBe("صندوق هدايا فاخر");
    expect(edited.revisions).toHaveLength(1);
    /* والأسماء المتشابهة هويات مستقلة: بيعان لنفس الاسم سجلان مستقلان. */
    const other = createDirectSale({
      ...CREATE,
      id: "sale-s11-b",
      idempotencyKey: "sale-s11-op-b",
      collectedMinor: 500,
      collectionStatus: "partial_debt",
      customerName: "ليان — جارة المحل",
    });
    expect(other.id).not.toBe(collected.id);
    expect(other.collectedMinor).toBe(500);
    expect(collected.collectedMinor).toBe(1500);
  });
});

/** R2: بيع قديم (ما قبل S11) — قبض مجمل بلا خطوط مؤرخة. */
function legacyAggregateSale() {
  const sale = createDirectSale({
    ...CREATE,
    id: "legacy-1",
    idempotencyKey: "legacy-key",
    revenueMinor: 8000,
    collectedMinor: 3000,
    collectionStatus: "partial_debt",
    customerName: "زبون قديم",
    occurredOn: "2026-06-05",
  });
  return { ...sale, collections: undefined } as unknown as ReturnType<typeof sale_15_5_6>;
}

/** R2: مدخل تعديل كامل من قالب البيع نفسه مع تجاوزات موضعية فقط. */
function editInputFor(
  sale: ReturnType<typeof sale_15_5_6>,
  overrides: Partial<{ itemName: string; collectedMinor: number; occurredOn: string }> = {},
) {
  return {
    itemName: overrides.itemName ?? sale.itemName,
    quantity: sale.quantity,
    revenueMinor: sale.revenueMinor,
    collectedMinor: overrides.collectedMinor ?? sale.collectedMinor,
    collectionStatus: sale.collectionStatus,
    catalogItemId: sale.catalogItemId,
    customerName: sale.customerName ?? undefined,
    costMinor: sale.costMinor,
    occurredOn: overrides.occurredOn ?? sale.occurredOn,
    note: sale.note ?? "",
  };
}

/** R2: مراجعة تعديل موثقة بمفتاح ووقت وسبب. */
function editRevision(idempotencyKey: string, createdAt: string, reason: string) {
  return { kind: "edit" as const, idempotencyKey, createdAt, reason };
}

/* S11 (تصحيح المراجعة R1 — انحدار دائم): عكس التحصيل دالة نطاق واحدة تمسك
 * المجموع المحروس والسطر السالب المؤرخ معًا — لا تركيب حالة مجال بيد طبقة
 * التطبيق أبدًا (عقد الأنواع: collectedMinor وحركاته يعدلان معًا داخل دالة
 * نطاق واحدة حصرًا). */
describe("S11 (R1) — عكس التحصيل: المجموع والتفصيل داخل دالة واحدة وعهدة المفتاح", () => {
  const reversalInput = (operationKey: string, amountMinor = 400, occurredOn = "2026-10-03") => ({
    amountMinor,
    occurredOn,
    operationKey,
    recordedAt: `${occurredOn}T09:00:00.000Z`,
    reason: "عكس تحصيل: خطأ في المبلغ",
    note: "عكس تحصيل: خطأ في المبلغ",
  });

  it("ينقص المجموع المحروس ويكتب السطر السالب المؤرخ بمفتاح الواقعة نفسه في نداء واحد", () => {
    const sale = collectDirectSalePayment(sale_15_5_6(), collectInput("collect-then-reverse"));
    const reversed = reverseDirectSaleCollection(sale, reversalInput("sale-collect-reverse:op-1"));
    /* المجموع المحروس: 1500 - 400 = 1100، والحق يعود حيًا 400. */
    expect(reversed.collectedMinor).toBe(1100);
    expect(directSaleOutstandingMinor(reversed)).toBe(400);
    expect(reversed.collectionStatus).toBe("partial_debt");
    /* التفصيل المؤرخ: سطر القبض الابتدائي ثم المحصل ثم السالب بتاريخه ومفتاحه. */
    expect(reversed.collections).toHaveLength(3);
    const negative = reversed.collections?.[2];
    expect(negative?.amountMinor).toBe(-400);
    expect(negative?.occurredOn).toBe("2026-10-03");
    expect(negative?.operationKey).toBe("sale-collect-reverse:op-1");
    expect(negative?.allocationEntryId).toBeNull();
    /* المراجعة الموثقة بنفس مفتاح الواقعة — واقعة عكس واحدة. */
    expect(reversed.revisions?.[0]?.idempotencyKey).toBe("sale-collect-reverse:op-1");
    expect(reversed.revisions).toHaveLength(1);
  });

  it("عهدة المفتاح: مفتاح مستخدم (قبض/مراجعة/إنشاء) يُرفض — لا عكس فوق واقعة قائمة", () => {
    const sale = collectDirectSalePayment(sale_15_5_6(), collectInput("occupied-key"));
    expect(() => reverseDirectSaleCollection(sale, reversalInput("occupied-key"))).toThrow();
    expect(() => reverseDirectSaleCollection(sale, reversalInput("sale-s11-op"))).toThrow();
  });

  it("العكس فوق المقبوض الفعلي أو على بيع ملغى/مُرتجع يُرفض — لا مقبوض سالب ولا عكس بعد الإغلاق", () => {
    const sale = sale_15_5_6(); /* المقبوض 500 فقط. */
    expect(() => reverseDirectSaleCollection(sale, reversalInput("too-much", 600))).toThrow();
    const cancelled = cancelDirectSale(sale, {
      kind: "cancel",
      idempotencyKey: "cancel-op",
      createdAt: "2026-10-02T09:00:00.000Z",
      reason: "إلغاء",
    });
    expect(() => reverseDirectSaleCollection(cancelled, reversalInput("after-cancel", 100))).toThrow();
    const returned = applyFullReturn(collectDirectSalePayment(sale, collectInput("before-return")), {
      occurredOn: "2026-10-05",
      operationKey: "return-op",
      recordedAt: "2026-10-05T09:00:00.000Z",
      reason: "مرتجع كامل",
    });
    expect(() => reverseDirectSaleCollection(returned, reversalInput("after-return", 100))).toThrow();
  });
});

/* S11 (تصحيح المراجعة R2 — انحدار دائم): الإرث المجمل لا تُؤلف تواريخه
 * (المثال ٤/SDF-014) — التعديل والعكس على بيع قديم بلا خطوط مؤرخة لا
 * يصطنعان سطر :initial أبدًا. */
describe("S11 (R2) — الإرث المجمل القديم لا تُؤلف تواريخه (المثال ٤/SDF-014)", () => {
  it("تعديل وصفي أو مالي أو تاريخي للمجمل القديم لا يصطنع سطرًا مؤرخًا", () => {
    const legacy = legacyAggregateSale();
    expect(legacy.collections).toBeUndefined();
    const edited = updateDirectSale(
      legacy,
      editInputFor(legacy, { itemName: "قطعة قديمة معدلة الوصف", collectedMinor: 2500 }),
      editRevision("legacy-edit-1", "2026-10-20T09:00:00.000Z", "تصحيح وصف"),
    );
    /* لا سطر مؤرخ إطلاقًا — الإجمالي المجمل بقي مجملًا ودرجته كما هي. */
    expect(edited.collections).toBeUndefined();
    expect(edited.collectedMinor).toBe(2500);
    /* وحتى لو تغير تاريخ البيع لا يُعاد تأريخ قبض مجمل. */
    const reDated = updateDirectSale(
      legacy,
      editInputFor(legacy, { occurredOn: "2026-07-01" }),
      editRevision("legacy-edit-2", "2026-10-20T09:00:00.000Z", "تصحيح تاريخ"),
    );
    expect(reDated.collections).toBeUndefined();
    expect(reDated.occurredOn).toBe("2026-07-01");
  });

  it("عكس تحصيل على بيع مجمل قديم: السطر السالب وحده مؤرخ والمجموع المجمل يبقى مجملًا", () => {
    const reversed = reverseDirectSaleCollection(legacyAggregateSale(), {
      amountMinor: 1000,
      occurredOn: "2026-10-03",
      operationKey: "legacy-reverse-1",
      recordedAt: "2026-10-03T09:00:00.000Z",
      reason: "عكس تحصيل: خطأ",
      note: "عكس تحصيل: خطأ",
    });
    expect(reversed.collectedMinor).toBe(2000);
    /* الحركة السالبة وحدها مؤرخة — لا سطر موجب مصطنع للإجمالي القديم. */
    expect(reversed.collections).toHaveLength(1);
    expect(reversed.collections?.[0]?.amountMinor).toBe(-1000);
    expect(reversed.collections?.[0]?.occurredOn).toBe("2026-10-03");
    expect(reversed.revisions?.[0]?.idempotencyKey).toBe("legacy-reverse-1");
  });
});

/* S11 (تصحيح المراجعة R2 — تكملة): دلتا تعديل المقبض على بيع مؤرخ حركة
 * مؤرخة بتاريخ التصحيح (المجموع والتفصيل معًا)؛ وعهدة المفتاح عبر البيوت؛
 * وقرار الفرق لا يُحسم بالعكس. */
describe("S11 (R2) — الدلتا المؤرخة وعهدة المفتاح وقرار الفرق", () => {
  it("تعديل المقبض يكتب دلتا مؤرخة بتاريخ التصحيح — المجموع والتفصيل معًا", () => {
    const sale = sale_15_5_6(); /* سطر ابتدائي +500 بتاريخ البيع. */
    expect(sale.collections).toHaveLength(1);
    const edited = updateDirectSale(
      sale,
      editInputFor(sale, { collectedMinor: 300 }),
      editRevision("collected-fix-1", "2026-10-20T22:30:00.000Z", "صححت المقبوض"),
    );
    expect(edited.collectedMinor).toBe(300);
    /* الدلتا −200 سطر مؤرخ بتاريخ التصحيح (تاريخ عمّان المحلي: 22:30Z =
     * اليوم التالي في عمّان) بمفتاح المراجعة نفسه — النواة مصدر التاريخ. */
    expect(edited.collections).toHaveLength(2);
    const delta = edited.collections?.[1];
    expect(delta?.amountMinor).toBe(-200);
    expect(delta?.operationKey).toBe("collected-fix-1");
    expect(delta?.occurredOn).toBe("2026-10-21");
    /* مجموع الخطوط = المجموع المحروس بالضبط. */
    const sum = (edited.collections ?? []).reduce((total, line) => total + line.amountMinor, 0);
    expect(sum).toBe(edited.collectedMinor);
    /* تعديل بلا تغيير المقبض لا يكتب سطرًا (لا حركة بلا مال). */
    const noDelta = updateDirectSale(
      edited,
      editInputFor(edited, { itemName: "صندوق هدايا فاخر" }),
      editRevision("desc-fix-1", "2026-10-21T09:00:00.000Z", "تصحيح وصف"),
    );
    expect(noDelta.collections).toHaveLength(2);
  });

  it("مفتاح تعديل مستخدم لحركة قائمة يُرفض — عهدة المفتاح عبر البيوت كلها", () => {
    const sale = sale_15_5_6();
    expect(() =>
      updateDirectSale(
        sale,
        editInputFor(sale, { collectedMinor: 700 }),
        editRevision("sale-s11-op:initial", "2026-10-20T09:00:00.000Z", "تكرار مفتاح"),
      ),
    ).toThrow();
  });

  it("العكس على بيع مراجعةٍ يبقي الفرق في مراجعته — لا دين مؤكد بصمت", () => {
    const review = createDirectSale({
      ...CREATE,
      collectedMinor: 500,
      collectionStatus: "partial_needs_review",
      customerName: "زبون بلا تعريف",
    });
    expect(review.collectionStatus).toBe("partial_needs_review");
    const reversed = reverseDirectSaleCollection(review, {
      amountMinor: 200,
      occurredOn: "2026-10-03",
      operationKey: "review-reverse-1",
      recordedAt: "2026-10-03T09:00:00.000Z",
      reason: "عكس تحصيل: خطأ",
      note: "عكس تحصيل: خطأ",
    });
    expect(reversed.collectedMinor).toBe(300);
    expect(reversed.collectionStatus).toBe("partial_needs_review");
  });
});
