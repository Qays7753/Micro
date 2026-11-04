/**
 * S10-MR-001 (أمر S11 — القسم ٥، b33a8877): انحدار حتمية مفتاح النية في
 * حفظ حساب T01 عند التزامن. المكتشف المستقل: مسار الحفظ القديم كان
 * يقرأ القائمة ثم يكتب سجلًا بمعرّف جديد في خطوتين منفصلتين، فنداءان
 * متزامنان بمفتاح النية نفسه (ضغط مزدوج/إعادة محاولة متقاطعة عبر خدمتي
 * تطبيق مستقلتين فوق المخزن الواحد) يكملان القراءة قبل أي كتابة فينشئان
 * حسابين. الانحدار هنا يثبت العقد المحروس عند حد الكتابة للمهايئين
 * معًا (الذاكرة وIndexedDB/fake-indexeddb):
 *  - التزامن بمفتاح النية نفسه = سجل واحد بعهدة واحدة (نفس المعرّف).
 *  - المدخلات المختلفة بمفتاح مقيم = رفض صادق برسالة صريحة، بلا كتابة
 *    ثانية ولا إرجاع السجل القديم كأنه حفظ للمدخلات الجديدة.
 *  - الإعادة بعد النجاح = لا كتابة إطلاقًا (no-op: السجل بايت-بالبايت
 *    كما هو، بلا تحديث updatedAt).
 *  - فشل حد التخزين = فشل تخزين صادق بلا أي سجل.
 */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { PlanningCalculationLifecycleService } from "./planningCalculationLifecycle";
import { CostEstimateService } from "./costEstimateService";
import type { CostEstimateStore } from "@/storage/local/capabilities/costEstimateStore";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import type { CostEstimate } from "@/storage/local/types";

const NOW = "2026-10-31T09:00:00.000Z";
const now = () => NOW;

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function planningInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "صناديق المناسبة",
    groups: [
      {
        groupId: "g-1",
        label: "صندوق هدايا",
        offeringType: "product" as const,
        repeatQuantity: 10,
        costMode: "details" as const,
        unitComponents: [
          { name: "صندوق خشب", quantity: 1, unit: "قطعة", unitPriceMinor: 200, confidence: "known" as const },
          { name: "شوكولاتة", quantity: 2, unit: "حبة", unitPriceMinor: 50, confidence: "known" as const },
        ],
        totalCostMinor: null,
        sellingPriceMinor: 1000,
      },
    ],
    time: null,
    packagingMinor: 0,
    wasteMinor: 0,
    deliveryMinor: 0,
    otherRevenues: [],
    otherExpenses: [],
    discount: null,
    commission: null,
    ...overrides,
  };
}

/** نداءان متزامنان بمفتاح النية نفسه عبر خدمتي تطبيق مستقلتين فوق المخزن الواحد. */
async function concurrentSameKeySaves(store: CostEstimateStore, key: string) {
  const serviceA = new PlanningCalculationLifecycleService(store, now);
  const serviceB = new PlanningCalculationLifecycleService(store, now);
  const [a, b] = await Promise.all([
    serviceA.savePlanning(planningInput(), key),
    serviceB.savePlanning(planningInput(), key),
  ]);
  return { a, b };
}

describe("S10-MR-001 — حتمية مفتاح نية حفظ حساب T01 عند التزامن (الذاكرة وIndexedDB)", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("الذاكرة: نداءان متزامنان بمفتاح النية نفسه = حساب واحد بعهدة واحدة", async () => {
    const store = new MemoryLocalStore();
    const { a, b } = await concurrentSameKeySaves(store, "op-concurrent-memory");
    if (!a.ok) throw new Error(a.message);
    if (!b.ok) throw new Error(b.message);
    /* الحكم الحاسم: المعرّف نفسه — لا حسابان بمفتاح نية واحد. */
    expect(a.value.id).toBe(b.value.id);
    expect(a.value.createdOperationKey).toBe("op-concurrent-memory");
    const list = await new CostEstimateService(store, now).list();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(1);
  });

  it("IndexedDB (fake-indexeddb): النداءان المتزامنان بالمفتاح نفسه = حساب واحد بعهدة واحدة", async () => {
    await clearDatabase();
    try {
      const store = new IndexedDbLocalStore();
      const { a, b } = await concurrentSameKeySaves(store, "op-concurrent-idb");
      if (!a.ok) throw new Error(a.message);
      if (!b.ok) throw new Error(b.message);
      expect(a.value.id).toBe(b.value.id);
      expect(a.value.createdOperationKey).toBe("op-concurrent-idb");
      const list = await new CostEstimateService(store, now).list();
      if (!list.ok) throw new Error(list.message);
      expect(list.value).toHaveLength(1);
    } finally {
      await clearDatabase();
    }
  });

  it("الذاكرة: تزامن بمفتاح واحد ومدخلات مختلفة = سجل واحد ورفض صادق للخاسر", async () => {
    const store = new MemoryLocalStore();
    const serviceA = new PlanningCalculationLifecycleService(store, now);
    const serviceB = new PlanningCalculationLifecycleService(store, now);
    const [a, b] = await Promise.all([
      serviceA.savePlanning(planningInput(), "op-clash-memory"),
      serviceB.savePlanning(planningInput({ title: "مدخلات مختلفة" }), "op-clash-memory"),
    ]);
    /* سجل واحد بالضبط؛ الفاشل يحمل رفضًا صريحًا لا نجاحًا بصيغة سجل قديم. */
    const outcomes = [a, b];
    const winners = outcomes.filter(outcome => outcome.ok);
    const losers = outcomes.filter(outcome => !outcome.ok);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    const loser = losers[0];
    if (loser.ok) throw new Error("unreachable");
    expect(loser.message).toContain("نية");
    expect(loser.message).toContain("لم يُحفظ تعديلك");
    const list = await new CostEstimateService(store, now).list();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(1);
  });

  it("IndexedDB (fake-indexeddb): تزامن بمفتاح واحد ومدخلات مختلفة = السلوك نفسه", async () => {
    await clearDatabase();
    try {
      const store = new IndexedDbLocalStore();
      const serviceA = new PlanningCalculationLifecycleService(store, now);
      const serviceB = new PlanningCalculationLifecycleService(store, now);
      const [a, b] = await Promise.all([
        serviceA.savePlanning(planningInput(), "op-clash-idb"),
        serviceB.savePlanning(planningInput({ title: "مدخلات مختلفة" }), "op-clash-idb"),
      ]);
      const outcomes = [a, b];
      const winners = outcomes.filter(outcome => outcome.ok);
      const losers = outcomes.filter(outcome => !outcome.ok);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      const loser = losers[0];
      if (loser.ok) throw new Error("unreachable");
      expect(loser.message).toContain("لم يُحفظ تعديلك");
      const list = await new CostEstimateService(store, now).list();
      if (!list.ok) throw new Error(list.message);
      expect(list.value).toHaveLength(1);
    } finally {
      await clearDatabase();
    }
  });

  it("إعادة متتابعة بمفتاح مقيم ومدخلات مختلفة = رفض صادق بلا كتابة فوق المحفوظ", async () => {
    const store = new MemoryLocalStore();
    const planning = new PlanningCalculationLifecycleService(store, now);
    const first = await planning.savePlanning(planningInput(), "op-changed-input");
    if (!first.ok) throw new Error(first.message);
    const before = await new CostEstimateService(store, now).get(first.value.id);
    if (!before.ok || !before.value) throw new Error(before.ok ? "missing" : before.message);
    /* المدخلات تغيّرت والنية مقيمة: لا يُعاد السجل القديم كأنه حفظ للجديد. */
    const retry = await planning.savePlanning(
      planningInput({ title: "عنوان مختلف بعد النجاح" }),
      "op-changed-input",
    );
    expect(retry.ok).toBe(false);
    if (retry.ok) return;
    expect(retry.message).toContain("لم يُحفظ تعديلك");
    expect(retry.message).toContain("حفظ نسخة");
    /* المحفوظ لم يُمس بايت-بالبايت — لا كتابة فوق سجل نية مقيمة. */
    const after = await new CostEstimateService(store, now).get(first.value.id);
    if (!after.ok || !after.value) throw new Error(after.ok ? "missing" : after.message);
    expect(after.value).toEqual(before.value);
    const list = await new CostEstimateService(store, now).list();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(1);
  });

  it("الإعادة بعد النجاح بالمفتاح والمدخلات نفسها = no-op كامل: السجل كما هو بلا أي كتابة", async () => {
    const store = new MemoryLocalStore();
    const planning = new PlanningCalculationLifecycleService(store, now);
    const reader = new CostEstimateService(store, now);
    const first = await planning.savePlanning(planningInput(), "op-noop");
    if (!first.ok) throw new Error(first.message);
    const stored = await reader.get(first.value.id);
    if (!stored.ok || !stored.value) throw new Error(stored.ok ? "missing" : stored.message);
    /* الإعادة النظيفة: نفس السجل بعهدة، وupdatedAt لا يتقدم (لا كتابة إطلاقًا). */
    const retry = await planning.savePlanning(planningInput(), "op-noop");
    if (!retry.ok) throw new Error(retry.message);
    expect(retry.value.id).toBe(first.value.id);
    expect(retry.reused).toBe(true);
    const reread = await reader.get(first.value.id);
    if (!reread.ok || !reread.value) throw new Error(reread.ok ? "missing" : reread.message);
    expect(reread.value.updatedAt).toBe(stored.value.updatedAt);
    expect(reread.value).toEqual(stored.value);
    const list = await reader.list();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(1);
  });

  it("فشل حد التخزين عند الالتزام = فشل تخزين صادق بلا أي سجل وبلا كتابة ناجحة مزيفة", async () => {
    let plainSaves = 0;
    const stub: CostEstimateStore = {
      async listCostEstimates() {
        return { ok: true as const, value: [] as readonly CostEstimate[] };
      },
      async getCostEstimate() {
        return { ok: true as const, value: null as CostEstimate | null };
      },
      async saveCostEstimate(estimate: CostEstimate) {
        plainSaves += 1;
        return { ok: true as const, value: estimate };
      },
      async deleteCostEstimate() {
        return { ok: true as const, value: null };
      },
      async commitCostEstimateCreate() {
        /* حد الكتابة نفسه يفشل (تعذر الاتصال مثلًا) — الفشل صادق لا مُلفّق. */
        return { ok: false as const, code: "storage_error" as const, message: "تعذر فتح قاعدة البيانات." };
      },
    };
    const planning = new PlanningCalculationLifecycleService(stub, now);
    const outcome = await planning.savePlanning(planningInput(), "op-storage-failure");
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe("storage_error");
    expect(outcome.message).toBe("تعذر حفظ الحساب.");
    /* لا مسار كتابة بديل: الالتزام الفاشل هو الالتزام الوحيد — لا saveCostEstimate. */
    expect(plainSaves).toBe(0);
  });
});
