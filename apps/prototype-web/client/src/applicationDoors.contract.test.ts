/**
 * الخطوة ٦ (STR-615 الشاملة — تصحيح PR #316، 2026-10-06): عقد أسطح أبواب
 * بيوت التطبيق — يثبت أن كل باب يصدّر حصرًا رموز القيمة المسجلة (PC-3:
 * توسيع السطح تعديل مقصود يظهر في هذا الاختبار نفسه). سطح الأنواع يفرضه
 * المترجم (tsc) عند الاستخدام وR6 عند المسار؛ اتجاه القيمة هو اتجاه الحزمة
 * فهو المثبت هنا حرفيًا.
 */
import { describe, expect, it } from "vitest";
import * as activity from "@/application/activity";
import * as agreements from "@/application/agreements";
import * as assets from "@/application/assets";
import * as catalog from "@/application/catalog";
import * as collections from "@/application/collections";
import * as cost from "@/application/cost";
import * as diagnostics from "@/application/diagnostics";
import * as drafts from "@/application/drafts";
import * as estimates from "@/application/estimates";
import * as financialPulse from "@/application/financial-pulse";
import * as followUp from "@/application/follow-up";
import * as fulfillment from "@/application/fulfillment";
import * as home from "@/application/home";
import * as input from "@/application/input";
import * as loans from "@/application/loans";
import * as parties from "@/application/parties";
import * as preferences from "@/application/preferences";
import * as scheduling from "@/application/scheduling";
import * as security from "@/application/security";
import * as share from "@/application/share";
import * as suppliers from "@/application/suppliers";
import * as time from "@/application/time";
import * as transfers from "@/application/transfers";
import * as budgets from "@/application/budgets";
import * as cash from "@/application/cash";
import * as finance from "@/application/finance";
import * as financialRecords from "@/application/financial-records";
import * as inventory from "@/application/inventory";
import * as ownerMoney from "@/application/owner-money";

/** السطح القيمي المسجل لكل باب (القياس الحي عند التنفيذ — تحديثه عمدًا بنفس الـPR). */
const REGISTERED_VALUE_SURFACE: Record<string, string[]> = {
  activity: [],
  agreements: [
    "agreementPriceIsReady",
    "applyProtectionPriceAsStart",
    "classifyFollowUpDate",
    "protectionPriceIsReadyForAgreement",
    "startAgreementPrice",
  ],
  assets: [],
  catalog: [],
  collections: [],
  cost: [],
  diagnostics: ["localDiagnostics", "routeTemplateFor"],
  drafts: [
    "LEGACY_SETUP_DRAFT_KEY",
    "browserLegacyFormDraftStorage",
    "clearLegacyFormDraftStorage",
    "legacyFinanceDraftKey",
    "migrateLegacyFormDraft",
  ],
  estimates: [],
  "financial-pulse": [],
  "follow-up": [],
  fulfillment: [],
  home: [],
  input: [
    "allowsEnglishNumericText",
    "blurEnglishNumericText",
    "echoQuantityMilli",
    "focusEnglishNumericText",
    "formatEnglishNumericValue",
    /* R2 (M-07/D14، 2026-10-08): منسّق صدى الكمية — توسيع سطح مقصود بنفس
     * الموجة (PC-3): انتقل من تعريف محلي في EnglishQuantityInput إلى نواة
     * الإدخال بمالك واحد؛ لا رمز بلا مستهلك. */
    "formatEnglishQuantityEcho",
    "normalizeAsciiDigits",
    "parseEnglishNumericText",
    "parseEnglishQuantityText",
    "percentToBpsExact",
  ],
  loans: ["ReceivedLoanService"],
  parties: [],
  preferences: [],
  scheduling: ["buildCapacityDecisionViewModel"],
  security: ["LOCK_AUTO_LOCK_OPTIONS", "LocalLockService"],
  share: ["collectionShareDraft", "customerShareDraft", "standingCollectionEvent"],
  suppliers: [],
  /* R2 (M-11/D13، 2026-10-08): أول قيمة في باب الوقت — حد «اليوم»
   * المسماى الوحيد (توسيع مقصود PC-3). */
  time: ["todayInAmman"],
  transfers: [],
  /* أبواب Wave B/W4 بعد فصل الأنواع (الخطوة ٦): */
  budgets: ["ExpenseBudgetService"],
  /* R2 (M-10/D11، 2026-10-08): بانيا نص سجل تسوية العدّ انتقلا من العرض —
   * توسيع سطح مقصود بنفس الـPR (PC-3). */
  cash: [
    "CashContinuityService",
    "WalletLedgerService",
    "cashCountDifferenceReason",
    "cashCountSettlementNote",
  ],
  finance: [
    "DueDatesService",
    "IntegrityCheckService",
    "PeriodComparisonService",
    "ProfitToCashBridgeService",
    "ProjectFinancialService",
    "RecurringExpenseService",
    "RecurringWorkService",
    "StatementMarkdownService",
    "StatementService",
    "UpcomingService",
    "DEFAULT_SHORT_CASH_HORIZON_DAYS",
    "SHORT_CASH_HORIZON_DAYS",
    "SHORT_CASH_HORIZON_LABELS_AR",
    "isPeriodActive",
    "previousEqualPeriod",
    "resolvePeriodPreset",
  ],
  "financial-records": [
    "CorrectionHistoryService",
    "RetainedDepositService",
    "deriveExpenseCategorySuggestions",
    "expandExpenseRecordIntent",
    "normalizeCategoryLabelInput",
  ],
  inventory: ["InventoryMaterialService", "readMaterialSuggestions", "resolveInventoryMovementType"],
  "owner-money": ["OwnerEntitlementService"],
};

const DOORS: Record<string, Record<string, unknown>> = {
  activity,
  agreements,
  assets,
  catalog,
  collections,
  cost,
  diagnostics,
  drafts,
  estimates,
  "financial-pulse": financialPulse,
  "follow-up": followUp,
  fulfillment,
  home,
  input,
  loans,
  parties,
  preferences,
  scheduling,
  security,
  share,
  suppliers,
  time,
  transfers,
  budgets,
  cash,
  finance,
  "financial-records": financialRecords,
  inventory,
  "owner-money": ownerMoney,
};

describe("application door surfaces (STR-615 — PC-3 exact-value-surface pin)", () => {
  it("every door exports exactly its registered value symbols — no silent widening", () => {
    for (const [house, door] of Object.entries(DOORS)) {
      const registered = [...(REGISTERED_VALUE_SURFACE[house] ?? [])].sort();
      const live = Object.keys(door).sort();
      expect(live, `door '${house}' value surface drifted`).toEqual(registered);
    }
  });

  it("all 29 doors are covered by the pin (no unregistered door)", () => {
    expect(Object.keys(DOORS)).toHaveLength(29);
    expect(Object.keys(REGISTERED_VALUE_SURFACE)).toHaveLength(29);
  });
});
