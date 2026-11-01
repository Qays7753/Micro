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

      it("تاريخ/null: لا جدول يتيمًا — سجل الفائز وحاله فقط، والثاني يعيد الاستخدام", async () => {
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
        if (!second.ok) throw new Error(second.message);
        expect(second.reused).toBe(true);
        expect(second.stored).toEqual(first.stored);
        const schedules = await store.listSchedules();
        const orderSchedules = schedules.ok
          ? schedules.value.filter(entry => entry.orderId === first.stored.id)
          : [];
        expect(orderSchedules).toHaveLength(first.stored.deliveryDate === null ? 0 : 1);
        const snapshot = await store.readSnapshot();
        expect(snapshot.ok && snapshot.value?.orders).toHaveLength(1);
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
