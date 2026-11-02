import { describe, expect, it } from "vitest";
import { AgreementService } from "@/application/agreements/agreementService";
import { CostService, type CostEditorInput } from "@/application/cost/costService";
import { DraftService } from "@/application/drafts/draftService";
import { LocalTransferService } from "@/application/transfers/localTransferService";
import { RELEASED_LEGACY_EXPORT_PAIRS } from "@/application/transfers/transferEnvelope";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { knowledgeGapsOf } from "@micro-domain/craft-order/index.js";

/* S12 (DOC-021 / UNIT-009 — أمر 2e645802 §5): سلوكيات الاتفاق الجديدة —
 * الموعد المجهول الصريح (J002-DEC02: لا جدول ولا تاريخ صوري)، والتكلفة
 * المجهولة الصريحة (J002-DEC01: مرجع مجهول موثق لا تكلفة 0)، ونموذج شروط
 * النقل الجديد (P3.3: لا رسوم زبون ولا تقاسم في الإنشاء الجديد؛ «لا يوجد
 * توصيل» بلا أي مبلغ)، وسقف العربون بالسعر وحده، ودورة النقل للزوج 33/40
 * مع بقاء الزوج الموروث 32/40 مقبولًا. */

const NOW = "2026-11-01T09:00:00.000Z";

const costInput: CostEditorInput = {
  materialItems: [{ name: "قماش", quantity: 2, unit: "متر", unitPriceMinor: 500, confidence: "known" }],
  time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
  packagingMinor: 0,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 0,
  quantity: 1,
};

async function draftWithCost(cost = true) {
  const store = new MemoryLocalStore();
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
  if (!cost) return { store, draft: saved.draft, costs: new CostService(store, () => NOW) };
  const costs = new CostService(store, () => NOW);
  const withCost = await costs.saveSnapshot(saved.draft, costInput);
  if (!withCost.ok) throw new Error(withCost.message);
  return { store, draft: withCost.draft, costs };
}

describe("S12 UNIT-009 — الموعد المجهول الصريح (J002-DEC02)", () => {
  it("اتفاق بلا موعد يُحفظ بصدق: deliveryDate = null ولا يُنشأ أي جدول", async () => {
    const { store, draft, costs } = await draftWithCost();
    const agreements = new AgreementService(store, costs, () => NOW);
    const agreed = await agreements.createFromDraft(draft, {
      agreedPriceMinor: 5000,
      deliveryDate: null,
      depositMinor: 0,
      agreementSource: null,
    });
    if (!agreed.ok) throw new Error(agreed.message);
    expect(agreed.stored.deliveryDate).toBeNull();
    expect(agreed.stored.order.status).toBe("provisional_agreement");
    /* غياب الموعد لا يكتب جدولًا — لا موعد زائف في التقويم. */
    const schedules = await store.listSchedules();
    expect(schedules.ok && schedules.value).toHaveLength(0);
  });

  it("الموعد المعلوم يُنشئ جدوله كما كان — التمييز محفوظ بين المجهول والمعلوم", async () => {
    const { store, draft, costs } = await draftWithCost();
    const agreements = new AgreementService(store, costs, () => NOW);
    const agreed = await agreements.createFromDraft(draft, {
      agreedPriceMinor: 5000,
      deliveryDate: "2026-11-20",
      depositMinor: 0,
      agreementSource: null,
    });
    if (!agreed.ok) throw new Error(agreed.message);
    expect(agreed.stored.deliveryDate).toBe("2026-11-20");
    const schedules = await store.listSchedules();
    expect(schedules.ok && schedules.value).toHaveLength(1);
    expect(schedules.ok && schedules.value[0]?.scheduledFor).toBe("2026-11-20");
  });

  it("تاريخ غير صالح مع القيمة النصية يُرفض — لا يمر ك مجهول ولا كتاريخ", async () => {
    const { store, draft, costs } = await draftWithCost();
    const agreements = new AgreementService(store, costs, () => NOW);
    const rejected = await agreements.createFromDraft(draft, {
      agreedPriceMinor: 5000,
      deliveryDate: "not-a-date",
      depositMinor: 0,
      agreementSource: null,
    });
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.message).toContain("موعد تسليم");
  });
});

describe("S12 UNIT-009 — التكلفة المجهولة الصريحة (J002-DEC01)", () => {
  it("اتفاق بلا مرجع تكلفة مع اختيار المجهول: مرجع مجهول موثق لا تكلفة 0", async () => {
    const { store, draft, costs } = await draftWithCost(false);
    const agreements = new AgreementService(store, costs, () => NOW);
    const agreed = await agreements.createFromDraft(draft, {
      agreedPriceMinor: 5000,
      deliveryDate: "2026-11-20",
      depositMinor: 0,
      agreementSource: null,
      costUnknown: true,
    });
    if (!agreed.ok) throw new Error(agreed.message);
    const snapshot = agreed.stored.order.costSnapshot;
    /* المجهول معلَم لا مُقنع بصفر: حالة معرفة ناقصة بعلم إلزامي. */
    expect(snapshot.knowledgeState).toBe("incomplete");
    expect(knowledgeGapsOf(snapshot).some(gap => gap.id === "no_cost_components" && gap.mandatory)).toBe(
      true,
    );
    expect(agreed.stored.order.resultStatus).toBe("incomplete");
    expect(agreed.stored.order.profitIndicatorMinor).toBeNull();
  });

  it("المجهول الصريح لا يُقبل مع مرجع تكلفة قائم — لا يطمس مرجعًا أفضل بصمت", async () => {
    const { store, draft, costs } = await draftWithCost();
    const agreements = new AgreementService(store, costs, () => NOW);
    const rejected = await agreements.createFromDraft(draft, {
      agreedPriceMinor: 5000,
      deliveryDate: "2026-11-20",
      depositMinor: 0,
      agreementSource: null,
      costUnknown: true,
    });
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.message).toContain("نسخة تكلفة قائمة");
  });

  it("بلا مرجع وبلا اختيار المجهول: missing_cost صادق يذكر الخيارين", async () => {
    const { store, draft, costs } = await draftWithCost(false);
    const agreements = new AgreementService(store, costs, () => NOW);
    const missing = await agreements.createFromDraft(draft, {
      agreedPriceMinor: 5000,
      deliveryDate: "2026-11-20",
      depositMinor: 0,
      agreementSource: null,
    });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.code).toBe("missing_cost");
    expect(missing.message).toContain("غير معروفة الآن");
  });
});

describe("S12 UNIT-009 P3.3 — نموذج شروط النقل الجديد في الإنشاء", () => {
  it("«لا يوجد توصيل» يُسجَّل بلا أي مبلغ وقيمة الطلب هي السعر وحده", async () => {
    const { store, draft, costs } = await draftWithCost();
    const agreements = new AgreementService(store, costs, () => NOW);
    const agreed = await agreements.createFromDraft(draft, {
      agreedPriceMinor: 5000,
      deliveryDate: "2026-11-20",
      depositMinor: 0,
      agreementSource: null,
      deliveryTerms: {
        responsibility: "none",
        feeIncludedInPrice: false,
        costIncludedInProductCost: false,
        feeChargedMinor: null,
        costPaidMinor: null,
        projectShareMinor: null,
        customerShareMinor: null,
      },
    });
    if (!agreed.ok) throw new Error(agreed.message);
    expect(agreed.stored.order.deliveryTerms?.responsibility).toBe("none");
    expect(agreed.stored.order.receivableMinor).toBe(5000);
    const termsEvent = agreed.stored.order.events.find(event => event.type === "delivery_terms_recorded");
    expect(termsEvent?.amountMinor).toBeUndefined();
  });

  it("«لا يوجد توصيل» مع أي مبلغ يُرفض عند حد الخدمة", async () => {
    const { store, draft, costs } = await draftWithCost();
    const agreements = new AgreementService(store, costs, () => NOW);
    const rejected = await agreements.createFromDraft(draft, {
      agreedPriceMinor: 5000,
      deliveryDate: "2026-11-20",
      depositMinor: 0,
      agreementSource: null,
      deliveryTerms: {
        responsibility: "none",
        feeIncludedInPrice: false,
        costIncludedInProductCost: false,
        feeChargedMinor: null,
        costPaidMinor: 300,
        projectShareMinor: null,
        customerShareMinor: null,
      },
    });
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.message).toContain("لا يحمل أي مبلغ");
  });

  it("توصيل المشروع: الكلفة على المشروع مرة، والسقف والقيمة بالسعر وحده", async () => {
    const { store, draft, costs } = await draftWithCost();
    const agreements = new AgreementService(store, costs, () => NOW);
    const agreed = await agreements.createFromDraft(draft, {
      agreedPriceMinor: 5000,
      deliveryDate: "2026-11-20",
      depositMinor: 0,
      agreementSource: null,
      deliveryTerms: {
        responsibility: "project_pays",
        feeIncludedInPrice: false,
        costIncludedInProductCost: false,
        feeChargedMinor: null,
        costPaidMinor: 300,
        projectShareMinor: null,
        customerShareMinor: null,
      },
    });
    if (!agreed.ok) throw new Error(agreed.message);
    expect(agreed.stored.order.deliveryTerms?.costPaidMinor).toBe(300);
    /* كلفة المشروع لا ترفع القيمة القابلة للتحصيل — سقف القبض هو السعر. */
    expect(agreed.stored.order.receivableMinor).toBe(5000);
  });

  it("العربون لا يتجاوز السعر المتفق عليه — لا أجرة تُخترع لرفع السقف", async () => {
    const { store, draft, costs } = await draftWithCost();
    const agreements = new AgreementService(store, costs, () => NOW);
    const rejected = await agreements.createFromDraft(draft, {
      agreedPriceMinor: 5000,
      deliveryDate: "2026-11-20",
      depositMinor: 5001,
      agreementSource: null,
    });
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.message).toContain("يتجاوز العربون");
  });
});

describe("S12 UNIT-009 §8 — دورة النقل للزوج 33/40 مع بقاء الموروث 32/40", () => {
  it("طلب بموعد مجهول و«لا يوجد توصيل» يعبر تصديرًا واستعادة حرفيًا (33/40)", async () => {
    const { store, draft, costs } = await draftWithCost(false);
    const agreements = new AgreementService(store, costs, () => NOW);
    const agreed = await agreements.createFromDraft(draft, {
      agreedPriceMinor: 5000,
      deliveryDate: null,
      depositMinor: 1000,
      agreementSource: null,
      costUnknown: true,
      deliveryTerms: {
        responsibility: "none",
        feeIncludedInPrice: false,
        costIncludedInProductCost: false,
        feeChargedMinor: null,
        costPaidMinor: null,
        projectShareMinor: null,
        customerShareMinor: null,
      },
    });
    if (!agreed.ok) throw new Error(agreed.message);

    const transfers = new LocalTransferService(store, () => NOW);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    expect(exported.value.version).toBe(localExportVersion);
    expect(exported.value.schemaVersion).toBe(localSchemaVersion);
    /* S14 (DOC-023): 41/34 بعد عائلتي المنسق. */
    expect(localExportVersion).toBe(34);
    expect(localSchemaVersion).toBe(41);

    /* الاستعادة تحفظ الشكل الجديد حرفيًا: مجهول يبقى مجهولًا وnone تبقى none. */
    const target = new MemoryLocalStore();
    const targetTransfers = new LocalTransferService(target, () => NOW);
    const prepared = await targetTransfers.prepareRestore(JSON.stringify(exported.value));
    if (!prepared.ok) throw new Error(prepared.message);
    const confirmed = await targetTransfers.confirmImport(prepared.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    const orders = await target.listOrders();
    const restored = orders.ok ? orders.value.find(order => order.id === agreed.stored.id) : null;
    expect(restored?.deliveryDate).toBeNull();
    expect(restored?.order.deliveryTerms?.responsibility).toBe("none");
    expect(restored?.order.depositCollectedMinor).toBe(1000);
  });

  it("الزوج الموروث 32/40 مسجل مقبولًا في قائمة الاستيراد", () => {
    expect(RELEASED_LEGACY_EXPORT_PAIRS.has("32/40")).toBe(true);
    /* S14 (DOC-023 — أمر ba2ce7b4 §5): 33/40 صار زوجًا موروثًا مقبولًا
     * مع عائلتي المنسق في 34/41. */
    expect(RELEASED_LEGACY_EXPORT_PAIRS.has("33/40")).toBe(true);
    expect(RELEASED_LEGACY_EXPORT_PAIRS.has("34/41")).toBe(false);
  });
});
