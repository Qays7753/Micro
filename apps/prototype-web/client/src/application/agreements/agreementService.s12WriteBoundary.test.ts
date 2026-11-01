import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { AgreementService } from "@/application/agreements/agreementService";
import { CostService, type CostEditorInput } from "@/application/cost/costService";
import { DraftService } from "@/application/drafts/draftService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";

/* S12 (DOC-021 — أمر 2e645802 §9/§10، تصحيحات R3-F01 + R3-F02): حدود كتابة
 * الإنشاء على المهايئين معًا — إنشاءان متزامنان من المسودة نفسها لا يطمر
 * أحدهما الآخر (فحص الوجود داخل حد الكتابة: الثاني يعيد الاستخدام بصدق)،
 * ولا جدول يتيمًا لموعد/null، ولا طمر لمرجع تكلفة مجهول أفضل؛ وتسديد
 * المواعيد الافتراضي يتخطى طلب الموعد المجهول على المهايئين، وطلب
 * deliveryDate = null يُحفظ ويُقرأ عبر IndexedDB كما في Memory. */

const databaseName = "micro-prototype-local";
function clearDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
afterEach(clearDatabase);

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

async function unlinkedDraft(store: PrototypeLocalStore, withCost: boolean) {
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
  if (!withCost) return saved.draft;
  const costs = new CostService(store, () => NOW);
  const withSnapshot = await costs.saveSnapshot(saved.draft, costInput);
  if (!withSnapshot.ok) throw new Error(withSnapshot.message);
  return withSnapshot.draft;
}

const ADAPTERS: ReadonlyArray<readonly [string, () => PrototypeLocalStore]> = [
  ["Memory", () => new MemoryLocalStore()],
  ["IndexedDB", () => new IndexedDbLocalStore()],
];

describe("S12 (تصحيح R3-F01) — حد كتابة الإنشاء: إنشاءان متزامنان من المسودة نفسها", () => {
  for (const [label, makeStore] of ADAPTERS) {
    describe(label, () => {
      it("النية نفسها: واحد يكتب والثاني يعيد الاستخدام بصدق — نفس السجل، لا طمر آخر-كاتب-يفوز", async () => {
        const store = makeStore();
        const draft = await unlinkedDraft(store, true);
        const agreements = new AgreementService(store, new CostService(store, () => NOW), () => NOW);
        const [first, second] = await Promise.all([
          agreements.createFromDraft(draft, {
            agreedPriceMinor: 5000,
            deliveryDate: "2026-11-20",
            depositMinor: 0,
            agreementSource: null,
          }),
          agreements.createFromDraft(draft, {
            agreedPriceMinor: 5000,
            deliveryDate: "2026-11-20",
            depositMinor: 0,
            agreementSource: null,
          }),
        ]);
        if (!first.ok) throw new Error(first.message);
        if (!second.ok) throw new Error(second.message);
        expect(second.stored).toEqual(first.stored);
        expect([first, second].filter(result => result.reused === true)).toHaveLength(1);
        const snapshot = await store.readSnapshot();
        expect(snapshot.ok && snapshot.value?.orders).toHaveLength(1);
      });

      it("S12-FIN-001: تاريخ معلوم/مجهول متعارضان — الفائز يكتب والثاني تعارض صريح بلا كتابة ولا جدول يتيم", async () => {
        const store = makeStore();
        const draft = await unlinkedDraft(store, true);
        const agreements = new AgreementService(store, new CostService(store, () => NOW), () => NOW);
        const [first, second] = await Promise.all([
          agreements.createFromDraft(draft, {
            agreedPriceMinor: 5000,
            deliveryDate: "2026-11-20",
            depositMinor: 0,
            agreementSource: null,
          }),
          agreements.createFromDraft(draft, {
            agreedPriceMinor: 5000,
            deliveryDate: null,
            depositMinor: 0,
            agreementSource: null,
          }),
        ]);
        if (!first.ok) throw new Error(first.message);
        /* الحمولة المتغيرة (معلوم ↔ مجهول) تعارض صريح — لا إعادة استخدام
         * كاذبة تحجب الموعد الذي كتبه الفائز الأول (أمر 2158b0fc §5). */
        expect(second.ok).toBe(false);
        if (second.ok) throw new Error("unreachable");
        expect(second.code).toBe("storage_stale");
        expect(second.message).toContain("بحمولة مختلفة");
        /* السجل القائم وحده: موعده كما كتبه الفائز، وجدوله واحد لا يتيم. */
        const snapshot = await store.readSnapshot();
        expect(snapshot.ok && snapshot.value?.orders).toHaveLength(1);
        const persisted = snapshot.ok ? snapshot.value?.orders[0] : undefined;
        expect(persisted?.deliveryDate).toBe(first.stored.deliveryDate);
        const schedules = await store.listSchedules();
        const orderSchedules = schedules.ok
          ? schedules.value.filter(entry => entry.orderId === first.stored.id)
          : [];
        expect(orderSchedules).toHaveLength(first.stored.deliveryDate === null ? 0 : 1);
      });

      it("تكلفة مجهولة/تكلفة مجهولة: الثاني يعيد الاستخدام — لا طمر لمرجع مجهول", async () => {
        const store = makeStore();
        const draft = await unlinkedDraft(store, false);
        const agreements = new AgreementService(store, new CostService(store, () => NOW), () => NOW);
        const [first, second] = await Promise.all([
          agreements.createFromDraft(draft, {
            agreedPriceMinor: 5000,
            deliveryDate: "2026-11-20",
            depositMinor: 0,
            agreementSource: null,
            costUnknown: true,
          }),
          agreements.createFromDraft(draft, {
            agreedPriceMinor: 5000,
            deliveryDate: "2026-11-20",
            depositMinor: 0,
            agreementSource: null,
            costUnknown: true,
          }),
        ]);
        if (!first.ok) throw new Error(first.message);
        if (!second.ok) throw new Error(second.message);
        expect(second.reused).toBe(true);
        expect(second.stored).toEqual(first.stored);
        const snapshot = await store.readSnapshot();
        expect(snapshot.ok && snapshot.value?.orders).toHaveLength(1);
      });
    });
  }
});

describe("S12 (تصحيح R3-F02-أ) — تسديد المواعيد الافتراضي يتخطى طلب الموعد المجهول", () => {
  for (const [label, makeStore] of ADAPTERS) {
    it(`${label}: المسودة الافتراضية لا تُكتب لموعد مجهول وتُكتب لموعد معلوم في المسح نفسه`, async () => {
      const store = makeStore();
      /* بذرة مباشرة بلا جدول (نمط saveOrder للإنشاء والبذور فقط) — طلبان
       * بلا مواعيد مسجلة: موعده مجهول (null) وموعده معلوم؛ يمر الاثنان في
       * مسح التسديد الافتراضي نفسه فيثبت الفلتر بالتقاطه لا بغياب المدخل. */
      for (const [id, deliveryDate] of [
        ["order-unknown", null],
        ["order-known", "2026-11-25"],
      ] as const) {
        const cost = await import("@micro-domain/craft-order/index.js").then(module =>
          module.calculateCostSnapshot(`${id}-cost`, {
            source: "draft",
            currency: "JOD",
            materialItems: [],
            time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
            packagingMinor: 0,
            deliveryMinor: 0,
            wasteMinor: 0,
            safetyBufferMinor: 0,
            quantity: 1,
            createdAt: NOW,
            freshnessDays: null,
          }),
        );
        const order = await import("@micro-domain/craft-order/index.js").then(module =>
          module.createCraftOrder({
            id,
            customerName: "سارة",
            itemName: `طلب ${id}`,
            specifications: "اختبار",
            quantity: 1,
            agreedPriceMinor: 2000,
            costSnapshot: cost,
            createdAt: NOW,
          }),
        );
        const saved = await store.saveOrder({
          catalogItemId: null,
          id,
          order: { ...order, status: "in_progress", nextAction: "أكمل التنفيذ" },
          deliveryDate,
          agreementSource: null,
          createdAt: NOW,
          updatedAt: NOW,
        });
        if (!saved.ok) throw new Error(saved.message);
      }
      const schedules = new ScheduleService(store, () => NOW);
      const overview = await schedules.overview();
      if (!overview.ok) throw new Error(overview.message);
      const after = await store.listSchedules();
      const byOrder = new Map((after.ok ? after.value : []).map(entry => [entry.orderId, entry]));
      expect(byOrder.get("order-unknown")).toBeUndefined();
      expect(byOrder.get("order-known")?.scheduledFor).toBe("2026-11-25");
    });
  }
});

describe("S12 (تصحيح R3-F02-ب) — طلب الموعد المجهول يُحفظ ويُقرأ عبر IndexedDB", () => {
  it("commitOrderFromDraft بلا جدول ثم قراءة جديدة فوق قاعدة البيانات نفسها", async () => {
    const store = new IndexedDbLocalStore();
    const draft = await unlinkedDraft(store, true);
    const agreements = new AgreementService(store, new CostService(store, () => NOW), () => NOW);
    const agreed = await agreements.createFromDraft(draft, {
      agreedPriceMinor: 5000,
      deliveryDate: null,
      depositMinor: 1000,
      agreementSource: null,
    });
    if (!agreed.ok) throw new Error(agreed.message);
    expect(agreed.reused).toBe(false);
    expect(agreed.stored.deliveryDate).toBeNull();
    const reopened = new IndexedDbLocalStore();
    const read = await reopened.getOrder(agreed.stored.id);
    expect(read.ok && read.value?.deliveryDate).toBeNull();
    expect(read.ok && read.value?.order.collectedMinor).toBe(1000);
    const schedules = await reopened.listSchedules();
    expect(schedules.ok && schedules.value).toHaveLength(0);
  });
});

/* S12-FIN-001 (أمر S13 2158b0fc §5 — موجدة المراجعة المستقلة عند ac4429ef):
 * المفتاح نفسه يقبل حمولة اتفاق متغيرة — المقارنة الكنونية لكل حقل إنشاء
 * فعال عند المهايئين معًا وقبل المسار السريع: النية نفسها إعادة استخدام
 * بلا كتابة ثانية، والحمولة المتغيرة تعارضًا صريحًا بلا كتابة ولا أثر
 * جدول/قبض/مصروف جانبي ولا تغيير للسجل القائم. */
describe("S12-FIN-001 — المفتاح نفسه بحمولة مختلفة: تعارض صريح عند الحد (المهايئان معًا)", () => {
  const baseInput = {
    agreedPriceMinor: 5000,
    deliveryDate: "2026-11-20" as string | null,
    depositMinor: 0,
    agreementSource: null as string | null,
  };

  for (const [label, makeStore] of ADAPTERS) {
    describe(label, () => {
      it("إعادة المحاولة المتسلسلة بالحمولة نفسها: إعادة استخدام صادقة بلا كتابة ثانية", async () => {
        const store = makeStore();
        const draft = await unlinkedDraft(store, true);
        const agreements = new AgreementService(store, new CostService(store, () => NOW), () => NOW);
        const first = await agreements.createFromDraft(draft, baseInput);
        if (!first.ok) throw new Error(first.message);
        /* المحاولة الثانية بعد النجاح (مسودة مرتبطة الآن) — المسار السريع
         * يقارن نية الإنشاء: نفس الحمولة تعيد السجل القائم كما هو. */
        const second = await agreements.createFromDraft(
          { ...draft, linkedOrderId: first.stored.id },
          baseInput,
        );
        if (!second.ok) throw new Error(second.message);
        expect(second.reused).toBe(true);
        expect(second.stored).toEqual(first.stored);
        const snapshot = await store.readSnapshot();
        expect(snapshot.ok && snapshot.value?.orders).toHaveLength(1);
      });

      const changedPayloads: ReadonlyArray<readonly [string, typeof baseInput]> = [
        ["السعر المتغير", { ...baseInput, agreedPriceMinor: 6000 }],
        ["العربون المتغير", { ...baseInput, depositMinor: 1000 }],
        ["الموعد معلوم/مجهول", { ...baseInput, deliveryDate: null }],
        ["مصدر الاتفاق المتغير", { ...baseInput, agreementSource: "conversation" }],
      ];
      for (const [caseLabel, changed] of changedPayloads) {
        it(`المسار السريع (مسودة مرتبطة) بحمولة ${caseLabel}: تعارض صريح بلا كتابة ولا تغيير للقائم`, async () => {
          const store = makeStore();
          const draft = await unlinkedDraft(store, true);
          const agreements = new AgreementService(store, new CostService(store, () => NOW), () => NOW);
          const first = await agreements.createFromDraft(draft, baseInput);
          if (!first.ok) throw new Error(first.message);
          const before = await store.readSnapshot();
          const rejected = await agreements.createFromDraft(
            { ...draft, linkedOrderId: first.stored.id },
            changed,
          );
          expect(rejected.ok).toBe(false);
          if (rejected.ok) throw new Error("unreachable");
          expect(rejected.code).toBe("storage_stale");
          expect(rejected.message).toContain("بحمولة مختلفة");
          /* لا كتابة إطلاقًا: اللقطة بالبايت كما كانت (لا طمس للسجل القائم
           * ولا جدول يتيم ولا نقد مزدوج ولا مسودة معدلة). */
          const after = await store.readSnapshot();
          expect(after.ok && JSON.stringify(after.value)).toBe(before.ok ? JSON.stringify(before.value) : "");
        });
      }

      it("المسار السريع: التكلفة المعروفة/المجهولة المتغيرة تعارض صريح", async () => {
        const store = makeStore();
        const draft = await unlinkedDraft(store, true);
        const agreements = new AgreementService(store, new CostService(store, () => NOW), () => NOW);
        const first = await agreements.createFromDraft(draft, baseInput);
        if (!first.ok) throw new Error(first.message);
        /* المجهول الصريح مع نسخة قائمة يرفضه التحقق قبل المقارنة — الرفض
         * الصادق ليس تعارضًا؛ التعارض يثبت بالاتجاه المعاكس: مسودة بلا نسخة
         * أنشأت مجهولًا ثم أعيدت المحاولة بمرجع معروف. */
        const bare = await unlinkedDraft(store, false);
        const unknownFirst = await agreements.createFromDraft(bare, {
          ...baseInput,
          costUnknown: true,
        });
        if (!unknownFirst.ok) throw new Error(unknownFirst.message);
        const costs = new CostService(store, () => NOW);
        const withSnapshot = await costs.saveSnapshot(bare, costInput);
        if (!withSnapshot.ok) throw new Error(withSnapshot.ok ? "" : withSnapshot.message);
        const rejected = await agreements.createFromDraft(
          { ...withSnapshot.draft, linkedOrderId: unknownFirst.stored.id },
          { ...baseInput },
        );
        expect(rejected.ok).toBe(false);
        if (rejected.ok) throw new Error("unreachable");
        expect(rejected.code).toBe("storage_stale");
        expect(rejected.message).toContain("بحمولة مختلفة");
        /* مرجع المجهول المحفوظ لم يُطمس — السجل القائم كما كتبه فائزه. */
        const read = await store.getOrder(unknownFirst.stored.id);
        expect(read.ok && read.value?.order.costSnapshots[0]?.id).toContain("unknown-cost");
      });

      it("المسار السريع: شروط النقل المتغيرة تعارض صريح", async () => {
        const store = makeStore();
        const draft = await unlinkedDraft(store, true);
        const agreements = new AgreementService(store, new CostService(store, () => NOW), () => NOW);
        const first = await agreements.createFromDraft(draft, {
          ...baseInput,
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
        if (!first.ok) throw new Error(first.message);
        const rejected = await agreements.createFromDraft(
          { ...draft, linkedOrderId: first.stored.id },
          {
            ...baseInput,
            deliveryTerms: {
              responsibility: "project_pays",
              feeIncludedInPrice: false,
              costIncludedInProductCost: true,
              feeChargedMinor: null,
              costPaidMinor: 700,
              projectShareMinor: null,
              customerShareMinor: null,
            },
          },
        );
        expect(rejected.ok).toBe(false);
        if (rejected.ok) throw new Error("unreachable");
        expect(rejected.code).toBe("storage_stale");
        /* شروط الفائز الأول باقية كما سُجلت. */
        const read = await store.getOrder(first.stored.id);
        expect(read.ok && read.value?.order.deliveryTerms?.responsibility).toBe("none");
      });

      it("إنشاءان متزامنان بحمولتين مختلفتين: فائز واحد وتعارض صريح للثاني بلا كتابة", async () => {
        const store = makeStore();
        const draft = await unlinkedDraft(store, true);
        const agreements = new AgreementService(store, new CostService(store, () => NOW), () => NOW);
        const results = await Promise.all([
          agreements.createFromDraft(draft, { ...baseInput, agreedPriceMinor: 5000 }),
          agreements.createFromDraft(draft, { ...baseInput, agreedPriceMinor: 7000 }),
        ]);
        const winners = results.filter(result => result.ok);
        const losers = results.filter(result => !result.ok);
        expect(winners).toHaveLength(1);
        expect(losers).toHaveLength(1);
        for (const loser of losers) {
          expect(loser.code).toBe("storage_stale");
          expect(loser.message).toContain("بحمولة مختلفة");
        }
        /* سجل واحد بالسعر الذي كتبه الفائز — لا طمس ولا دمج. */
        const snapshot = await store.readSnapshot();
        expect(snapshot.ok && snapshot.value?.orders).toHaveLength(1);
        const persisted = snapshot.ok ? snapshot.value?.orders[0] : undefined;
        expect(winners[0]?.ok ? persisted?.order.agreedPriceMinor : null).toBe(
          winners[0]?.ok ? winners[0].stored.order.agreedPriceMinor : null,
        );
        /* لا نقد مزدوج: القبض في السجل القائم هو عربون الفائز وحده. */
        const cashEntries = await store.listCashContinuityEntries();
        expect(cashEntries.ok && cashEntries.value).toHaveLength(0);
      });

      it("إعادة المحاولة بعد تطور السجل (تعديل سعر لاحق) بالنية نفسها: إعادة استخدام لا تعارض", async () => {
        const store = makeStore();
        const draft = await unlinkedDraft(store, true);
        const agreements = new AgreementService(store, new CostService(store, () => NOW), () => NOW);
        const first = await agreements.createFromDraft(draft, baseInput);
        if (!first.ok) throw new Error(first.message);
        /* تطور مشروع لاحق: تعديل سعر فوق السجل القائم بنيته الخاصة. */
        const { reviseAgreedPrice } = await import("@micro-domain/craft-order/index.js");
        const revised = reviseAgreedPrice(first.stored.order, {
          newPriceMinor: 8000,
          reason: "اتفاق لاحق",
          idempotencyKey: `${first.stored.id}:price-later`,
          createdAt: NOW,
        });
        const saved = await store.saveOrder({ ...first.stored, order: revised, updatedAt: NOW });
        if (!saved.ok) throw new Error(saved.message);
        /* إعادة محاولة الإنشاء بالحمولة الأصلية نفسها — السعر عند الإنشاء
         * يُستخرج من سلسلة التعديل فتبقى النية متطابقة: إعادة استخدام صادقة
         * للسجل الحي المتطور (حفظ دلالة outcome_unknown وإعادة المحاولة). */
        const retry = await agreements.createFromDraft(
          { ...draft, linkedOrderId: first.stored.id },
          baseInput,
        );
        if (!retry.ok) throw new Error(retry.message);
        expect(retry.reused).toBe(true);
        expect(retry.stored.order.agreedPriceMinor).toBe(8000);
      });
    });
  }
});
