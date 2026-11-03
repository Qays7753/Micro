/** R7 / R6-F17-P02 (2026-10-10): عقد سطح حالة المالية المستخرج من الصفحة —
 * نفس سلوك التجميع الذي كانت الصفحة تنفذه: عزل الفشل بالكتلة (G-005)، تعيين
 * القيم كما هي، تصنيف الحالات المسجلة (membership لا حسابًا)، وترتيب القراءات
 * نفسه. هذه اختبارات وحدة التجميع (خدمات مزيفة بsentinels) — السلوك الكامل
 * للخدمات الحقيقية تحرسه أجنحتها وأجنحة رحلات الصفحة.
 *
 * UNIT-013 (تنفيذ S15 بالأمر الموحد §5): قراءات العربونات والأصول والقروض
 * والعربونات المحتفظة غادرت التجميع الأساسي مع طبقاتها (جرد القارئين — لا
 * قراءة بلا مستهلك)؛ العقد هنا يثبت الحدود الجديدة: لا قراءة من الخدمات
 * المغادرة داخل readFinanceOverview إطلاقًا. */
import { describe, expect, it } from "vitest";
import {
  monthBounds,
  readFinanceOverview,
  readProfitToCashBridge,
  type FinanceOverviewDeps,
} from "./financeState";
import type {
  CorrectionDigest,
  CorrectionHistoryService,
} from "../financial-records/correctionHistoryService";
import type { FinancialAnalysisService, G5Decision } from "../financial-analysis/financialAnalysisService";
import type { FinancialPulseService } from "../financial-pulse/financialPulseService";
import type { InventoryMaterialService } from "../inventory/inventoryMaterialService";
import type { PeriodWasteReading } from "../inventory/inventoryMaterialModel";
import type {
  OwnerEntitlementOverview,
  OwnerEntitlementService,
} from "../owner-money/ownerEntitlementService";
import type {
  FinancialInsights,
  ProjectFinancialPosition,
  ProjectFinancialService,
  RecordedPeriodResult,
} from "./projectFinancialService";
import type { ProfitToCashBridgeReading, ProfitToCashBridgeService } from "./profitToCashBridgeService";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { ShortCashDeclaration } from "@micro-domain/financial-analysis/index.js";
import type { StoredCraftOrder } from "@/storage/local/types";

const ok = <T>(value: T) => ({ ok: true as const, value });
const failed = { ok: false as const };

const sentinel = <T>(marker: string) => ({ marker }) as unknown as T;

/** ترتيب بدء القراءات — يُسجَّل لحظة الاستدعاء (تقييم Promise.all من اليسار). */
function makeDeps(
  overrides: {
    readPosition?: () => Promise<{ ok: true; value: ProjectFinancialPosition } | { ok: false }>;
    pulseRead?: () => Promise<unknown>;
    affectingPeriod?: () => Promise<{ ok: true; value: CorrectionDigest } | { ok: false }>;
    calls?: string[];
  } = {},
): FinanceOverviewDeps {
  const calls = overrides.calls ?? [];
  return {
    projectFinance: {
      readPosition: async () => {
        calls.push("readPosition");
        return overrides.readPosition
          ? overrides.readPosition()
          : ok(sentinel<ProjectFinancialPosition>("position"));
      },
      listEvents: async () => {
        calls.push("listEvents");
        return ok([sentinel<FinancialEvent>("event")] as readonly FinancialEvent[]);
      },
      readRecordedPeriodResult: async () => {
        calls.push("readRecordedPeriodResult");
        return ok(sentinel<RecordedPeriodResult>("period"));
      },
      readFinancialInsights: async () => {
        calls.push("readFinancialInsights");
        return ok(sentinel<FinancialInsights>("insights"));
      },
    } as unknown as ProjectFinancialService,
    financialPulse: {
      read: async () => {
        calls.push("pulse.read");
        if (overrides.pulseRead) return (await overrides.pulseRead()) as never;
        return {
          ok: true,
          pulse: sentinel<never>("pulse"),
          orders: [
            { order: { status: "delivered", resultStatus: "final" } },
            { order: { status: "delivered", resultStatus: "incomplete" } },
            { order: { status: "quote", resultStatus: "incomplete" } },
          ] as unknown as StoredCraftOrder[],
        };
      },
    } as unknown as FinancialPulseService,
    g5: {
      readDecision: async () => {
        calls.push("readDecision");
        return ok(sentinel<G5Decision>("decision"));
      },
      listDeclarations: async () => {
        calls.push("listDeclarations");
        return ok([sentinel<ShortCashDeclaration>("declaration")] as readonly ShortCashDeclaration[]);
      },
    } as unknown as FinancialAnalysisService,
    ownerEntitlement: {
      readOverview: async () => {
        calls.push("readOverview");
        return ok(sentinel<OwnerEntitlementOverview>("owner"));
      },
    } as unknown as OwnerEntitlementService,
    correctionHistory: {
      affecting: async (from?: string, to?: string) => {
        calls.push(`affecting:${from ?? ""}:${to ?? ""}`);
        if (from && to && overrides.affectingPeriod) return overrides.affectingPeriod();
        return ok(sentinel<CorrectionDigest>("corrections"));
      },
    } as unknown as CorrectionHistoryService,
    inventory: {
      readPeriodWaste: async () => {
        calls.push("readPeriodWaste");
        return ok(sentinel<PeriodWasteReading>("waste"));
      },
    } as unknown as InventoryMaterialService,
  };
}

describe("R7/P02 — readFinanceOverview (تجميع G-005 المستخرج)", () => {
  it("كل القراءات تنجح: حالة ready بكل القيم كما هي وبلا كتل فاشلة", async () => {
    const state = await readFinanceOverview(makeDeps(), "2026-09-01", "2026-09-30");
    expect(state.phase).toBe("ready");
    if (state.phase !== "ready") return;
    expect((state.position as unknown as { marker: string }).marker).toBe("position");
    expect((state.period as unknown as { marker: string }).marker).toBe("period");
    expect((state.insights as unknown as { marker: string }).marker).toBe("insights");
    expect((state.decision as unknown as { marker: string }).marker).toBe("decision");
    expect((state.owner as unknown as { marker: string }).marker).toBe("owner");
    expect(state.events).toHaveLength(1);
    expect(state.declarations).toHaveLength(1);
    expect(state.failedBlocks).toEqual({});
    /* تصنيف الحالات المسجلة (membership لا حسابًا): طلبان مسجلان (delivered) وثالث عرض. */
    expect(state.ordersRecorded).toBe(true);
    expect(state.finalOrdersRecorded).toBe(true);
    /* excludedOrders: المسجلة غير النهائية فقط (delivered/incomplete) — العرض خارجها. */
    expect(state.excludedOrders).toHaveLength(1);
  });

  it("فشل المجموعة الأساسية (readPosition) وحده يوجّه الصفحة للخطأ الصادق", async () => {
    const state = await readFinanceOverview(
      makeDeps({ readPosition: () => Promise.resolve(failed) }),
      "2026-09-01",
      "2026-09-30",
    );
    expect(state).toEqual({ phase: "error", message: "لم يتم تغيير بياناتك. أعد فتح التطبيق للمحاولة." });
  });

  it("رفض وعد النبضة يعامل كفشل المجموعة الأساسية (لا رفض غير معالج)", async () => {
    const state = await readFinanceOverview(
      makeDeps({ pulseRead: () => Promise.reject(new Error("storage down")) }),
      "2026-09-01",
      "2026-09-30",
    );
    expect(state.phase).toBe("error");
  });

  it("فشل كتلة متقدمة (تصحيحات الفترة) يصنف failedBlocks.period ولا يحجب الصفحة", async () => {
    const state = await readFinanceOverview(
      makeDeps({ affectingPeriod: () => Promise.resolve(failed) }),
      "2026-09-01",
      "2026-09-30",
    );
    expect(state.phase).toBe("ready");
    if (state.phase !== "ready") return;
    expect(state.failedBlocks).toEqual({ period: true });
    expect(state.correctionsInPeriod).toBeNull();
    expect((state.correctionsAllTime as unknown as { marker: string }).marker).toBe("corrections");
  });

  it("UNIT-013: التجميع الأساسي لا يقرأ العربونات/الأصول/القروض إطلاقًا (جرد القارئين)", async () => {
    /* العقود المغادرة لا تملك مقعدًا في النوع أصلًا — البرهان هنا سلوكي:
     * تجميع ناجح كامل لا يستدعي أي قراءة خارج العائلة المعلنة. لو أُعيد
     * إدخال قراءة أيتيمة في المستقبل فسيكسر ترتيب الاستدعاءات المثبت أدناه. */
    const calls: string[] = [];
    await readFinanceOverview(makeDeps({ calls }), "2026-09-01", "2026-09-30");
    const allowed = new Set([
      "pulse.read",
      "readPosition",
      "listEvents",
      "readRecordedPeriodResult",
      "readFinancialInsights",
      "readDecision",
      "listDeclarations",
      "readOverview",
      "affecting",
      "readPeriodWaste",
    ]);
    for (const call of calls) {
      const base = call.startsWith("affecting:") ? "affecting" : call;
      expect(allowed.has(base), `قراءة خارج العائلة المعلنة: ${call}`).toBe(true);
    }
  });

  it("نفس ترتيب بدء القراءات الذي كانت الصفحة تنفذه (IIFE النبضة ثم Promise.all من اليسار)", async () => {
    const calls: string[] = [];
    await readFinanceOverview(makeDeps({ calls }), "2026-09-01", "2026-09-30");
    expect(calls).toEqual([
      "pulse.read",
      "readPosition",
      "listEvents",
      "readRecordedPeriodResult",
      "readFinancialInsights",
      "readDecision",
      "listDeclarations",
      "readOverview",
      "affecting::",
      "affecting:2026-09-01:2026-09-30",
      "readPeriodWaste",
    ]);
  });
});

describe("R7/P02 — قراءتا الجسر والأفق (كتلتان مستقلتان)", () => {
  it("الجسر: قراءة ناجحة تُمرر كما هي؛ الفشل بطاقة خطأ لا صفرًا كاذبًا", async () => {
    const bridge = {
      readProfitToCashBridge: async () => ok(sentinel<ProfitToCashBridgeReading>("bridge")),
    } as unknown as ProfitToCashBridgeService;
    const good = await readProfitToCashBridge({ profitToCashBridge: bridge }, "2026-09-01", "2026-09-30");
    expect(good.phase).toBe("ready");
    const bad = await readProfitToCashBridge(
      {
        profitToCashBridge: {
          readProfitToCashBridge: async () => failed,
        } as unknown as ProfitToCashBridgeService,
      },
      "2026-09-01",
      "2026-09-30",
    );
    expect(bad).toEqual({ phase: "error" });
  });

  /* UNIT-021 (تنفيذ S15 بالأمر الموحد §5): كتلة قراءة أفق الكاش القصير
   * وعقدها أزيلا مع القدرة المؤجلة — لا قراءة توقع في تحميل المالية. */
});

describe("R7/P02 — monthBounds (حدود الشهر من النواة الكنسية)", () => {
  it("حدّا الشهر كما كانت الصفحة تحسبهما", () => {
    expect(monthBounds("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthBounds("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(monthBounds("2026-09")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });
});
