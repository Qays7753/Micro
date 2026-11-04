/**
 * S14 (DOC-023 / UNIT-002 — أمر ba2ce7b4 §5/§9): حالات القبول المشتركة
 * المملوكة هنا — السبعة عشرة المثبتة بأدلة دائمة عبر المنسق والمهايئين
 * الحقيقيين، وغير المشغّل منها يُؤشر بسببه بصدق لا يُدعى ناجحًا.
 *
 *  • SDF-007/023/024/025/027: منطق المعرفة والتغطية مثبت في نواة المجال
 *    (src/domain/shared/periodSummary.test.ts) — هنا يثبت عبر الرحلة كاملة:
 *    بناء الخطة بلا مال، الالتزام، الحفظ والاستعادة.
 *  • SDF-017/018/019: الرصد الحالي وعلاقته بالمجاميع — التغطية المعلنة
 *    والزمن غير المحسوم بلا توزيع أيام.
 *  • SDF-026: النطاق المسجل سابقًا يُصحح صراحة قبل الحفظ.
 *  • SDF-028: القبض التاريخي مجهول المدين يبقى محدود المعرفة — لا طرف مختلق.
 *  • SDF-029/050/072: مسودة الرحلة بجيلها وحد حجمها — عبر FormDraftService
 *    الحقيقي (نفس عقد العائلة كلها).
 *  • SDF-030: فشل الحزمة المنسقة بعد بدء الكتابة يتدحرج كله — مثبت في
 *    accountCompletion.s14.test.ts بحقن بعد أول كتابة؛ هنا تكرار عبر الخدمة.
 *  • SDF-036/066/071: المعرفة المستقلة وحدود الملكية — المنسق لا يخترع
 *    هدرًا ولا شراء اليوم ولا يلمس تصحيحات المالكين (تكافؤ اللقطة).
 */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountCompletionService, type AccountCompletionInput } from "./accountCompletionService";
import { FormDraftService } from "@/application/drafts/formDraftService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";

const NOW = "2026-11-02T09:00:00.000Z";
const now = () => NOW;

const DATABASE_NAME = "micro-prototype-local";
function clearDatabase(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
afterEach(clearDatabase);

const entered = (amountMinor: number, knowledge: "known" | "estimated" = "known") => ({
  state: "entered" as const,
  amountMinor,
  knowledge,
});

function serviceFor(store: PrototypeLocalStore) {
  return new AccountCompletionService(store, now);
}

function baseInput(overrides: Partial<AccountCompletionInput> = {}): AccountCompletionInput {
  return {
    from: "2026-09-01",
    to: "2026-10-31",
    summaries: [
      {
        kind: "direct_sales",
        from: "2026-09-01",
        to: "2026-10-31",
        dimensions: { revenue: entered(20_000), received: entered(12_000), cost: entered(8_000) },
        coverage: [],
      },
    ],
    cashObservation: null,
    ...overrides,
  };
}

describe("S14 — حالات القبول المملوكة عبر المنسق (SDF)", () => {
  it("SDF-007/023: ملخص 200/120/80 بمعرفة مستقلة يلتزم ويُستعاد كما هو — والتفصيل 80/30/20 يخصم لا يجمع", async () => {
    const store = new MemoryLocalStore();
    const service = serviceFor(store);
    const plan = await service.buildPlan(baseInput(), "sdf-007");
    if (!plan.ok) throw new Error(plan.message);
    const committed = await service.commit(plan.value);
    if (!committed.ok) throw new Error(committed.message);
    /* الاستعادة الكاملة: نفس الملخص بأبعاده بمعرفته — بعد قراءة لقطة جديدة. */
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error("snapshot failed");
    const restored = await new MemoryLocalStore().replaceSnapshot(snapshot.value);
    if (!restored.ok) throw new Error(restored.message);
    const again = await new MemoryLocalStore().readSnapshot();
    if (!again.ok) throw new Error("again failed");
    await new MemoryLocalStore().replaceSnapshot(again.value);
    const summaries = await store.listPeriodSummaries();
    if (!summaries.ok) throw new Error(summaries.message);
    expect(summaries.value[0]?.dimensions.revenue).toEqual(entered(20_000));
    expect(summaries.value[0]?.dimensions.received).toEqual(entered(12_000));
    expect(summaries.value[0]?.dimensions.cost).toEqual(entered(8_000));
    /* والتفصيل داخل ملخص آخر: الباقي 120/90/60 والإجماليات باقية (نواة المجال
     * أثبتت الحساب — هنا التغطية تعبر الرحلة كاملة بلا كتابة فوق الأصل). */
    const detailPlan = await serviceFor(store).buildPlan(
      baseInput({
        from: "2026-11-01",
        to: "2026-11-02",
        summaries: [
          {
            kind: "direct_sales",
            from: "2026-11-01",
            to: "2026-11-02",
            dimensions: { revenue: entered(8_000), received: entered(3_000), cost: entered(2_000) },
            coverage: [],
          },
        ],
      }),
      "sdf-007-detail",
    );
    if (!detailPlan.ok) throw new Error(detailPlan.message);
    const detailCommitted = await serviceFor(store).commit(detailPlan.value);
    if (!detailCommitted.ok) throw new Error(detailCommitted.message);
    const all = await store.listPeriodSummaries();
    if (!all.ok) throw new Error(all.message);
    expect(all.value).toHaveLength(2);
  });

  it("SDF-017: رصد حالي 200 مع مجموع قبض قديم 30 تنتهي مدته قبله — لا يصبح النقد 230 والمجموع يبقى تاريخًا", async () => {
    const store = new MemoryLocalStore();
    const service = serviceFor(store);
    const plan = await service.buildPlan(
      baseInput({
        summaries: [
          {
            kind: "direct_sales",
            from: "2026-08-01",
            to: "2026-08-31",
            dimensions: { revenue: entered(3_000), received: entered(3_000) },
            coverage: [],
          },
        ],
        cashObservation: { countedMinor: 20_000, knowledge: "known", observedOn: "2026-11-02" },
      }),
      "sdf-017",
    );
    if (!plan.ok) throw new Error(plan.message);
    /* المعاينة تعلن التغطية: المجموع القديم مغطى بالرصد — لا يُعاد جمعه. */
    expect(plan.value.preview.coveredByObservation).toHaveLength(1);
    expect(plan.value.preview.timingUnresolved).toHaveLength(0);
    const committed = await service.commit(plan.value);
    if (!committed.ok) throw new Error(committed.message);
    /* الرصد قياس مستوى: 200 كما عُدّ؛ والمجموع القديم تاريخ في فترته —
     * لا مسار أبدًا يجمعهما إلى 230 داخل المنسق. */
    const observation = plan.value.preview.cashObservation!;
    expect(observation.countedMinor).toBe(20_000);
    const summaries = await store.listPeriodSummaries();
    if (!summaries.ok) throw new Error(summaries.message);
    expect(summaries.value[0]?.dimensions.received).toEqual(entered(3_000));
    expect(summaries.value[0]?.to).toBe("2026-08-31");
  });

  it("SDF-018/019: مجموع يعبر يوم الرصد — غير محسوم زمنيًا بلا توزيع أيام والنقص معلن", async () => {
    const store = new MemoryLocalStore();
    const service = serviceFor(store);
    const plan = await service.buildPlan(
      baseInput({
        summaries: [
          {
            kind: "direct_sales",
            from: "2026-10-01",
            to: "2026-10-31",
            dimensions: { revenue: entered(50_000) },
            coverage: [],
          },
        ],
        cashObservation: { countedMinor: 9_000, knowledge: "known", observedOn: "2026-10-15" },
      }),
      "sdf-018",
    );
    if (!plan.ok) throw new Error(plan.message);
    /* المجموع يقع يوم الرصد داخل مدته: لا حسم قبل/بعد بوقت التسجيل، ولا
     * توزيع على الأيام — غير محسوم معلن. */
    expect(plan.value.preview.timingUnresolved).toHaveLength(1);
    expect(plan.value.preview.coveredByObservation).toHaveLength(0);
    /* والملخص نفسه يحتفظ بمدته الكاملة — لا أيام مولدة ولا قيم موزعة. */
    const summary = plan.value.preview.summaries[0]!;
    expect(summary.from).toBe("2026-10-01");
    expect(summary.to).toBe("2026-10-31");
    expect(summary.dimensions.revenue).toEqual(entered(50_000));
  });

  it("SDF-024/025: المجهول لا يُستنتج تناسبًا والتجاوز يُرفض قبل الكتابة عبر الخدمة", async () => {
    const store = new MemoryLocalStore();
    const service = serviceFor(store);
    /* SDF-024: بيع 80 بقبض وتكلفة مجهولين — لا 48/32 بالتناسب. */
    const unknownPlan = await service.buildPlan(
      baseInput({
        summaries: [
          {
            kind: "direct_sales",
            from: "2026-09-01",
            to: "2026-09-30",
            dimensions: {
              revenue: entered(8_000),
              received: { state: "unknown" },
              cost: { state: "unknown" },
            },
            coverage: [],
          },
        ],
      }),
      "sdf-024",
    );
    if (!unknownPlan.ok) throw new Error(unknownPlan.message);
    expect(unknownPlan.value.preview.unknownDimensions).toEqual([
      { summaryKind: "direct_sales", dimension: "received" },
      { summaryKind: "direct_sales", dimension: "cost" },
    ]);
    /* SDF-025: تفصيل يتجاوز المتبقي — رفض قبل أي كتابة والمخزن لم يُمس. */
    const before = await store.readSnapshot();
    const rejected = await service.buildPlan(
      baseInput({
        summaries: [
          {
            kind: "direct_sales",
            from: "2026-09-01",
            to: "2026-09-30",
            dimensions: { revenue: entered(10_000), received: entered(3_000) },
            coverage: [{ detailRef: "direct_sale:detail-1", dimension: "revenue", amountMinor: 11_000 }],
          },
        ],
      }),
      "sdf-025",
    );
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.code).toBe("over_coverage");
    const after = await store.readSnapshot();
    expect(after.ok && JSON.stringify(after.value)).toBe(before.ok ? JSON.stringify(before.value) : "");
  });

  it("SDF-026: نطاق مسجل سابقًا يُعلن ويُصحح صراحة قبل الحفظ — لا إضافة فوق الأصل", async () => {
    const store = new MemoryLocalStore();
    const service = serviceFor(store);
    const first = await service.buildPlan(baseInput(), "sdf-026-first");
    if (!first.ok) throw new Error(first.message);
    const committed = await service.commit(first.value);
    if (!committed.ok) throw new Error(committed.message);
    /* إدخال النطاق نفسه مرة أخرى — المعاينة تعلنه والالتزام يرفض حتى
     * التصحيح الصريح للمدة. */
    const duplicate = await service.buildPlan(baseInput(), "sdf-026-duplicate");
    if (!duplicate.ok) throw new Error(duplicate.message);
    expect(duplicate.value.preview.alreadyRepresented).toHaveLength(1);
    const refused = await service.commit(duplicate.value);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.code).toBe("over_coverage");
    /* وبعد تصحيح المدة صراحةً يلتزم — لا حذف تلقائي للمتشابه. */
    const corrected = await service.buildPlan(
      baseInput({
        from: "2026-11-01",
        to: "2026-11-02",
        summaries: [
          {
            kind: "direct_sales",
            from: "2026-11-01",
            to: "2026-11-02",
            dimensions: { revenue: entered(5_000) },
            coverage: [],
          },
        ],
      }),
      "sdf-026-corrected",
    );
    if (!corrected.ok) throw new Error(corrected.message);
    const correctedCommit = await service.commit(corrected.value);
    if (!correctedCommit.ok) throw new Error(correctedCommit.message);
    const all = await store.listPeriodSummaries();
    if (!all.ok) throw new Error(all.message);
    expect(all.value).toHaveLength(2);
  });

  it("SDF-027/028: الحق الافتتاحي من مصدره، والقبض مجهول المدين محدود المعرفة بلا طرف مختلق", async () => {
    const store = new MemoryLocalStore();
    const service = serviceFor(store);
    const plan = await service.buildPlan(
      baseInput({
        summaries: [
          {
            kind: "opening_commercial_right",
            from: "2026-08-01",
            to: "2026-08-31",
            dimensions: { remainingClaim: entered(5_000) },
            coverage: [],
          },
          {
            kind: "direct_sales",
            from: "2026-08-01",
            to: "2026-08-31",
            dimensions: {
              received: entered(50_000),
              remainingClaim: { state: "not_applicable", reason: "المدين الأصلي غير معروف" },
            },
            coverage: [],
          },
        ],
      }),
      "sdf-027-028",
    );
    if (!plan.ok) throw new Error(plan.message);
    const committed = await service.commit(plan.value);
    if (!committed.ok) throw new Error(committed.message);
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error("snapshot failed");
    /* لا طرف محفوظ مختلق ولا دين لعميل عشوائي — المعرفة محدودة معلنة. */
    expect(snapshot.value.counterparties ?? []).toHaveLength(0);
    const summaries = await store.listPeriodSummaries();
    if (!summaries.ok) throw new Error(summaries.message);
    const right = summaries.value.find(summary => summary.kind === "opening_commercial_right");
    const receipt = summaries.value.find(summary => summary.kind === "direct_sales");
    expect(right?.dimensions.remainingClaim).toEqual(entered(5_000));
    expect(receipt?.dimensions.remainingClaim).toEqual({
      state: "not_applicable",
      reason: "المدين الأصلي غير معروف",
    });
  });

  it("SDF-029: مسودة الرحلة تُستعاد بعد الإغلاق بنفس المدخلات وبلا أثر مالي ولا تكرار عند الاستكمال", async () => {
    const store = new MemoryLocalStore();
    const drafts = new FormDraftService(store, now);
    const values = {
      route: "returning",
      from: "2026-09-01",
      to: "2026-10-31",
      sales: { revenue: 20000, received: 12000 },
    };
    const saved = await drafts.save("account_completion", null, values);
    if (!saved.ok) throw new Error(saved.message);
    /* الإغلاق وإعادة الفتح (قراءة جديدة) — نفس المدخلات. */
    const reread = await drafts.read("account_completion", null);
    if (!reread.ok) throw new Error(reread.message);
    expect(reread.value?.values).toEqual(values);
    /* لا أثر مالي لوجود المسودة — لقطة العائلات المالية فارغة كما كانت. */
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error("snapshot failed");
    expect(snapshot.value.periodSummaries ?? []).toHaveLength(0);
    expect(snapshot.value.commandReceipts ?? []).toHaveLength(0);
    expect(snapshot.value.financialEvents ?? []).toHaveLength(0);
    /* والاستكمال بعد الاستعادة لا يكرر دفعة — الحتمية داخل الحد. */
    const service = serviceFor(store);
    const plan = await service.buildPlan(baseInput(), "sdf-029-commit");
    if (!plan.ok) throw new Error(plan.message);
    const first = await service.commit(plan.value);
    if (!first.ok) throw new Error(first.message);
    const retry = await service.commit(plan.value);
    if (!retry.ok) throw new Error(retry.message);
    expect(retry.value.reused).toBe(true);
    const summaries = await store.listPeriodSummaries();
    if (!summaries.ok) throw new Error(summaries.message);
    expect(summaries.value).toHaveLength(1);
  });

  it("SDF-030: فشل الحزمة المنسقة بعد بدء الكتابة يتدحرج كله — دفتر التراجع عند حد المخزن", async () => {
    /* نفس الحقن المثبت في accountCompletion.s14.test.ts (بعد أول كتابة
     * مجندلة) — هنا عبر الخدمة: الفشل يبلغ بصدق ولا شيء يبقى. */
    class FaultAfterFirstWrite extends MemoryLocalStore {
      private writes = 0;
      protected onCoordinatedWrite(): void {
        this.writes += 1;
        if (this.writes >= 1) throw new Error("حقن فشل اختباري بعد أول كتابة منسقة");
      }
    }
    const store = new FaultAfterFirstWrite();
    const service = serviceFor(store);
    const plan = await service.buildPlan(baseInput(), "sdf-030");
    if (!plan.ok) throw new Error(plan.message);
    const before = await store.readSnapshot();
    if (!before.ok) throw new Error("before failed");
    const failed = await service.commit(plan.value);
    expect(failed.ok).toBe(false);
    const after = await store.readSnapshot();
    if (!after.ok) throw new Error("after failed");
    expect(after.value).toEqual(before.value);
  });

  it("SDF-036: كمية معلومة بقيمة مجهولة تبقى كذلك — ولا هدر ولا استهلاك ولا لمس للمواد", async () => {
    const store = new MemoryLocalStore();
    const service = serviceFor(store);
    const plan = await service.buildPlan(
      baseInput({
        summaries: [
          {
            kind: "purchases",
            from: "2026-09-01",
            to: "2026-09-30",
            dimensions: {
              paid: entered(6_000),
              cost: { state: "unknown" },
              quantity: entered(5_000),
            },
            coverage: [],
          },
        ],
      }),
      "sdf-036",
    );
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.value.preview.unknownDimensions).toEqual([{ summaryKind: "purchases", dimension: "cost" }]);
    const committed = await service.commit(plan.value);
    if (!committed.ok) throw new Error(committed.message);
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error("snapshot failed");
    /* الكمية معلومة والتقييم مجهول بعد الحفظ؛ ولا حركة مواد ولا هدر ولا
     * إعادة تصنيف — تغيير اختيار التتبع فعل صاحبه لا المنسق. */
    const summaries = await store.listPeriodSummaries();
    if (!summaries.ok) throw new Error(summaries.message);
    expect(summaries.value[0]?.dimensions.quantity).toEqual(entered(5_000));
    expect(summaries.value[0]?.dimensions.cost).toEqual({ state: "unknown" });
    expect(snapshot.value.materials ?? []).toHaveLength(0);
    expect(snapshot.value.inventoryMovements ?? []).toHaveLength(0);
    expect(snapshot.value.inventoryShortages ?? []).toHaveLength(0);
  });

  it("SDF-050: نافذة ثانية وجيل جديد — الأمر القديم يُرفض حتى لو بقيت هوية المشروع نفسها", async () => {
    const store = new MemoryLocalStore();
    const service = serviceFor(store);
    /* خطة مبنية على الجيل الحي الأول. */
    const plan = await service.buildPlan(baseInput(), "sdf-050");
    if (!plan.ok) throw new Error(plan.message);
    const oldGeneration = plan.value.preview.command.generation;
    /* نافذة ثانية تستبدل القاعدة (البروتوكول المحروس الحقيقي) — يصك جيلًا
     * جديدًا فوق الجيل الذي بُني عليه الأمر القديم. */
    const exportFile = await new (await import("./localTransferService")).LocalTransferService(
      store,
      now,
    ).createExport();
    if (!exportFile.ok) throw new Error(exportFile.message);
    const opened = await store.beginReplacementIntent(
      {
        id: "rollback-active",
        file: exportFile.value,
        drafts: [],
        snapshotDigest: "sdf-050",
        generation: Number(oldGeneration),
        createdAt: NOW,
      },
      {
        id: "replacement-marker",
        commandId: "sdf-050-replace",
        commandType: "restore",
        fromGeneration: Number(oldGeneration),
        toGeneration: Number(oldGeneration) + 1,
        beforeDigest: "sdf-050-before",
        afterDigest: "sdf-050-after",
        payloadDigest: "sdf-050",
        summaryJson: "{}",
        startedAt: NOW,
      },
    );
    if (!opened.ok) throw new Error(opened.message);
    await store.commitReplacementIntent(
      Number(oldGeneration) + 1,
      {
        id: "replacement-receipt",
        commandId: "sdf-050-replace",
        commandType: "restore",
        payloadDigest: "sdf-050",
        summaryJson: "{}",
        generation: Number(oldGeneration) + 1,
        committedAt: NOW,
      },
      NOW,
    );
    const freshGeneration = await store.getDataGeneration();
    if (!freshGeneration.ok) throw new Error(freshGeneration.message);
    expect(freshGeneration.value).toBeGreaterThan(Number(oldGeneration));
    /* الأمر القديم فوق الجيل الجديد: تعارض حتمية صريح — لا تفسير لهوية
     * المشروع نفسها يعيد تنفيذ قصد الجيل القديم. */
    const before = await store.readSnapshot();
    const staleCommit = await store.commitAccountCompletion(plan.value.commit);
    expect(staleCommit.ok).toBe(false);
    if (!staleCommit.ok) expect(staleCommit.code).toBe("storage_stale");
    const after = await store.readSnapshot();
    expect(after.ok && JSON.stringify(after.value)).toBe(before.ok ? JSON.stringify(before.value) : "");
  });

  it("SDF-066/071: المنسق لا يشتري أصلًا اليوم ولا يصحح شراءً — ملكية الأثر عند أصحابها بلقطة متطابقة", async () => {
    const store = new MemoryLocalStore();
    const service = serviceFor(store);
    const plan = await service.buildPlan(
      baseInput({
        summaries: [
          {
            kind: "purchases",
            from: "2026-09-01",
            to: "2026-09-30",
            dimensions: { paid: entered(4_000), cost: entered(10_000), remainingClaim: entered(6_000) },
            coverage: [],
          },
        ],
      }),
      "sdf-066-071",
    );
    if (!plan.ok) throw new Error(plan.message);
    const committed = await service.commit(plan.value);
    if (!committed.ok) throw new Error(committed.message);
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error("snapshot failed");
    /* لا شراء أصل اليوم ولا عمر مختلق ولا تصحيح بتبعيات: الأصول والمشتريات
     * وأحداثها المالية عند مالكها — المنسق كتب الملخص والقياس والإيصال فقط. */
    expect(snapshot.value.assets ?? []).toHaveLength(0);
    expect(snapshot.value.supplierPurchases ?? []).toHaveLength(0);
    expect(snapshot.value.financialEvents ?? []).toHaveLength(0);
    expect(snapshot.value.inventoryMovements ?? []).toHaveLength(0);
    expect(snapshot.value.periodSummaries ?? []).toHaveLength(1);
    expect(snapshot.value.commandReceipts ?? []).toHaveLength(1);
    /* شراء قائم بمستحق مفتوح: حق المورد يقرأ من مصدره والملخص تاريخه —
     * تصحيح الشراء بتبعياته (استهلاك/تغطية/مكان) فعل مالكه داخل حده أو
     * يُرفض هناك؛ المنسق لا يمسه (SDF-071). */
    const summaries = await store.listPeriodSummaries();
    if (!summaries.ok) throw new Error(summaries.message);
    expect(summaries.value[0]?.dimensions.remainingClaim).toEqual(entered(6_000));
  });

  it("SDF-072: مسودة فوق حد 32KB تُرفض بقيمها سليمة — لا قص ولا localStorage مالي", async () => {
    const store = new MemoryLocalStore();
    const drafts = new FormDraftService(store, now);
    /* جواسيس تخزين المتصفح إن وُجدت في بيئة الاختبار — الرفض نفسه لا
     * يعتمد على وجودها (عقد ARCH-010 يمنع الإنتاج من الوصول أصلًا). */
    const sessionSetItem = typeof sessionStorage !== "undefined" ? vi.spyOn(sessionStorage, "setItem") : null;
    const localSetItem = typeof localStorage !== "undefined" ? vi.spyOn(localStorage, "setItem") : null;
    const oversized = { notes: "ق".repeat(40_000) };
    const refused = await drafts.save("account_completion", null, oversized);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.code).toBe("too_large");
      expect(refused.message ?? "").toContain("بقيت قيمك أمامك كما هي");
    }
    /* لا قص صامت ولا تخزين متصفح بديل — الرفض قبل أي كتابة. */
    if (sessionSetItem) expect(sessionSetItem).not.toHaveBeenCalled();
    if (localSetItem) expect(localSetItem).not.toHaveBeenCalled();
    const reread = await drafts.read("account_completion", null);
    if (!reread.ok) throw new Error(reread.message);
    expect(reread.value).toBeNull();
    if (sessionSetItem) sessionSetItem.mockRestore();
    if (localSetItem) localSetItem.mockRestore();
  });

  it("IndexedDB: الرحلة كاملة على المهايئ الحقيقي — تكافؤ الذاكرة في الالتزام والحتمية", async () => {
    await clearDatabase();
    const store = new IndexedDbLocalStore();
    const service = serviceFor(store);
    const plan = await service.buildPlan(baseInput(), "sdf-idb");
    if (!plan.ok) throw new Error(plan.message);
    const committed = await service.commit(plan.value);
    if (!committed.ok) throw new Error(committed.message);
    expect(committed.value.reused).toBe(false);
    const retried = await service.commit(plan.value);
    if (!retried.ok) throw new Error(retried.message);
    expect(retried.value.reused).toBe(true);
    const summaries = await store.listPeriodSummaries();
    if (!summaries.ok) throw new Error(summaries.message);
    expect(summaries.value).toHaveLength(1);
    const receipts = await store.listCommandReceipts();
    if (!receipts.ok) throw new Error(receipts.message);
    expect(receipts.value).toHaveLength(1);
  });
});
