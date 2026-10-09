/** R7 / R6-F17-P02 (2026-10-10): عقد سطح حالة المالية المستخرج من الصفحة —
 * نفس سلوك التجميع الذي كانت الصفحة تنفذه: عزل الفشل بالكتلة (G-005)، تعيين
 * القيم كما هي، تصنيف الحالات المسجلة (membership لا حسابًا)، وترتيب القراءات
 * نفسه. هذه اختبارات وحدة التجميع (خدمات مزيفة بsentinels) — السلوك الكامل
 * للخدمات الحقيقية تحرسه أجنحتها وأجنحة رحلات الصفحة. */
import { describe, expect, it } from "vitest";
import {
  monthBounds,
  readFinanceOverview,
  readProfitToCashBridge,
  readShortCashHorizonBlock,
  type FinanceOverviewDeps,
} from "./financeState";
import type { AssetOverviewRead, AssetService } from "../assets/assetService";
import type {
  CorrectionDigest,
  CorrectionHistoryService,
} from "../financial-records/correctionHistoryService";
import type { RetainedDepositRow, RetainedDepositService } from "../financial-records/retainedDepositService";
import type { DepositOverview, FulfillmentService } from "../fulfillment/fulfillmentService";
import type {
  FinancialAnalysisService,
  G5Decision,
  ShortCashHorizonReading,
} from "../financial-analysis/financialAnalysisService";
import type { FinancialPulseService } from "../financial-pulse/financialPulseService";
import type { InventoryMaterialService, PeriodWasteReading } from "../inventory/inventoryMaterialModel";
import type { LoanOverviewRead, LoanService } from "../loans/loanService";
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
import type { ShortCashHorizonDays } from "./shortCashHorizon";
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
    loansOverview?: () => Promise<{ ok: true; value: LoanOverviewRead } | { ok: false }>;
    loans?: LoanService | null;
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
    fulfillment: {
      listDepositOverview: async () => {
        calls.push("listDepositOverview");
        return ok(sentinel<DepositOverview>("deposits"));
      },
    } as unknown as FulfillmentService,
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
    assets: {
      overview: async () => {
        calls.push("assets.overview");
        return ok(sentinel<AssetOverviewRead>("assets"));
      },
    } as unknown as AssetService,
    loans:
      overrides.loans === undefined
        ? ({
            overview: async () => {
              calls.push("loans.overview");
              return overrides.loansOverview
                ? overrides.loansOverview()
                : ok(sentinel<LoanOverviewRead>("loans"));
            },
          } as unknown as LoanService)
        : overrides.loans,
    retainedDeposits: {
      listPending: async () => {
        calls.push("listPending");
        return ok([sentinel<RetainedDepositRow>("retained")] as readonly RetainedDepositRow[]);
      },
    } as unknown as RetainedDepositService,
  };
}

describe("R7/P02 — readFinanceOverview (تجميع G-005 المستخرج)", () => {
  it("كل القراءات تنجح: حالة ready بكل القيم كما هي وبلا كتل فاشلة", async () => {
    const state = await readFinanceOverview(makeDeps(), "2026-09-01", "2026-09-30");
    expect(state.phase).toBe("ready");
    if (state.phase !== "ready") return;
    expect((state.position as { marker: string }).marker).toBe("position");
    expect((state.period as { marker: string }).marker).toBe("period");
    expect((state.insights as { marker: string }).marker).toBe("insights");
    expect((state.decision as { marker: string }).marker).toBe("decision");
    expect((state.owner as { marker: string }).marker).toBe("owner");
    expect((state.deposits as { marker: string }).marker).toBe("deposits");
    expect((state.assetsOverview as { marker: string }).marker).toBe("assets");
    expect((state.loansOverview as { marker: string }).marker).toBe("loans");
    expect(state.events).toHaveLength(1);
    expect(state.declarations).toHaveLength(1);
    expect(state.pendingRetainedDeposits).toHaveLength(1);
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
    expect((state.correctionsAllTime as { marker: string }).marker).toBe("corrections");
  });

  it("القروض غير المجهزة بعد (null) = كتلة معطوبة صادقة تُعاد قراءتها فور جاهزيتها", async () => {
    const state = await readFinanceOverview(makeDeps({ loans: null }), "2026-09-01", "2026-09-30");
    expect(state.phase).toBe("ready");
    if (state.phase !== "ready") return;
    expect(state.failedBlocks).toEqual({ loans: true });
    expect(state.loansOverview).toBeNull();
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
      "listDepositOverview",
      "affecting::",
      "affecting:2026-09-01:2026-09-30",
      "readPeriodWaste",
      "assets.overview",
      "loans.overview",
      "listPending",
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

  it("الأفق: نفس العقد — قيمة أو بطاقة إعادة محاولة، والرفض ملفوف", async () => {
    const good = await readShortCashHorizonBlock(
      {
        g5: {
          readShortCashHorizon: async () => ok(sentinel<ShortCashHorizonReading>("horizon")),
        } as unknown as FinancialAnalysisService,
      },
      30 as ShortCashHorizonDays,
    );
    expect(good.phase).toBe("ready");
    const rejected = await readShortCashHorizonBlock(
      {
        g5: {
          readShortCashHorizon: () => Promise.reject(new Error("x")),
        } as unknown as FinancialAnalysisService,
      },
      30 as ShortCashHorizonDays,
    );
    expect(rejected).toEqual({ phase: "error" });
  });
});

describe("R7/P02 — monthBounds (حدود الشهر من النواة الكنسية)", () => {
  it("حدّا الشهر كما كانت الصفحة تحسبهما", () => {
    expect(monthBounds("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthBounds("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(monthBounds("2026-09")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });
});
