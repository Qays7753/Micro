/**
 * Wave H (STR-623) ثم R4-B2 (2026-10-08): اختبارات مراسي قيم القبول —
 * حتمية بلا شبكة. بعد توحيد R4-B2 تُثبت المراسي **الاستهلاك الكنوني
 * المباشر** (استيراد + بناء من المصدر) لا تساوي نسختين حرفيتين:
 * تغطي النجاح عند الاستهلاك الكامل، والاصطياد عند رجوع أي موقع إلى نسخة
 * حرفية محلية، وعند تغيّر القائمة الكنونية نفسها — وفحص دخاني على
 * المستودع الحي.
 * R4-REC-5 (2026-10-08، شريحة التحصين): أُضيف الموقع الثالث —
 * agreementService.ts — بورقة إيجابية وسلبيتين: الرجوع إلى النسخة
 * الحرفية بصيغتها التاريخية غير المطابقة `new Set([` (المسجلة في
 * c5363c82^) وإسقاط الاستيراد الكنوني مع إبقاء حرفية مطابقة.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkAcceptanceValueAnchors } from "./check-acceptance-value-anchors.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url).replace(
  /check-acceptance-value-anchors\.test\.mjs$/,
  "check-acceptance-value-anchors.mjs",
);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const COMPAT = `
export const LEGACY_AGREEMENT_SOURCES = ["conversation", "call", "in_person"] as const;
export type LegacyAgreementSource = (typeof LEGACY_AGREEMENT_SOURCES)[number];
export const AGREEMENT_SOURCE_ACCEPTANCE = [
  "instagram",
  "whatsapp",
  "referral",
  "walk_in",
  "other",
  ...LEGACY_AGREEMENT_SOURCES,
] as const;
`;
const CTX_OK = `
import {
  AGREEMENT_SOURCE_ACCEPTANCE,
  type LegacyAgreementSource,
} from "@/application/transfers/transferCompatibilityValues";
export type { LegacyAgreementSource };
const sources = new Set<AgreementSourceValue>(AGREEMENT_SOURCE_ACCEPTANCE);
`;
const SVC_OK = `
import { AGREEMENT_SOURCE_ACCEPTANCE } from "@/application/transfers/transferCompatibilityValues";
const allowedAgreementSources = new Set<string>(AGREEMENT_SOURCE_ACCEPTANCE);
`;
const GUIDED_OK = `
import { cashWalletKinds } from "@micro-domain/cash-continuity/index.js";
import { materialUnits as domainMaterialUnits } from "@micro-domain/inventory-material/index.js";
const walletKinds = new Set<CashWalletKind>(cashWalletKinds);
const materialUnits = new Set<MaterialUnit>(domainMaterialUnits);
`;
const CASH_TYPES = `export const cashWalletKinds = ["cash_drawer", "bank_account", "digital_wallet", "other"] as const;\nexport type CashWalletKind = (typeof cashWalletKinds)[number];\n`;
const INV_TYPES = `export const materialUnits = ["piece", "meter", "kilogram", "liter", "other"] as const;\ntype InventoryMovementType =\n  "opening" | "purchase_receipt" | "consumption" | "waste" | "adjustment" | "reversal";\n`;
/* R6-W2/F-024: عينات مواقع العائلات الست الجديدة. */
const CATALOG_TYPES = `export const catalogItemKinds = ["product", "service"] as const;\nexport type CatalogItemKind = (typeof catalogItemKinds)[number];\ntype CatalogTemplateYieldReadiness = "not_configured" | "ready" | "needs_conversion";\n`;
const STORAGE_TYPES = `export type ScheduleStatus = "scheduled" | "postponed" | "completed" | "cancelled";\n`;
const FIN_ANALYSIS_TYPES = `export type G5Knowledge = "known" | "estimated" | "needs_review";\ntype G5Direction = "collection" | "commitment";\ntype ShortCashDeclarationKind = "declaration" | "reversal";\n`;
const FIN_EVENT_TYPES = `type ExpenseRelationship = "project" | "shared";\ntype ExpenseBehavior = "fixed" | "variable" | "mixed" | "unknown";\ntype ExpensePurpose = "project_general" | "period" | "order" | "product" | "campaign" | "unallocated";\ntype ExpenseKnowledge = "known" | "estimated" | "needs_review";\n`;
const TFV = `export const isScheduleStatus = (value: unknown) =>
  value === "scheduled" || value === "postponed" || value === "completed" || value === "cancelled";
export const isYieldReadiness = (value: unknown) =>
  value === "not_configured" || value === "ready" || value === "needs_conversion";
export const isInventoryMovementType = (value: unknown) =>
  value === "opening" ||
  value === "purchase_receipt" ||
  value === "consumption" ||
  value === "waste" ||
  value === "adjustment" ||
  value === "reversal";
export function validCatalogItem(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.kind === "product" || value.kind === "service")
  );
}
export function validShortCashDeclaration(value: unknown): boolean {
  return (
    (value.kind === "declaration" || value.kind === "reversal") &&
    (value.direction === "collection" || value.direction === "commitment") &&
    (value.knowledge === "known" || value.knowledge === "estimated" || value.knowledge === "needs_review")
  );
}
export const isExpenseContext = (value: unknown) =>
  isRecord(value) &&
  (value.relationship === "project" || value.relationship === "shared") &&
  (value.behavior === "fixed" || value.behavior === "variable" || value.behavior === "mixed" || value.behavior === "unknown") &&
  (value.purpose === "project_general" || value.purpose === "period" || value.purpose === "order" || value.purpose === "product" || value.purpose === "campaign" || value.purpose === "unallocated") &&
  (value.knowledge === "known" || value.knowledge === "estimated" || value.knowledge === "needs_review");
`;

function files(overrides = {}) {
  return {
    "apps/prototype-web/client/src/application/agreements/agreementContextService.ts": CTX_OK,
    "apps/prototype-web/client/src/application/agreements/agreementService.ts": SVC_OK,
    "apps/prototype-web/client/src/application/transfers/transferCompatibilityValues.ts": COMPAT,
    "apps/prototype-web/client/src/application/transfers/guidedOpeningImportService.ts": GUIDED_OK,
    "src/domain/cash-continuity/types.ts": CASH_TYPES,
    "src/domain/inventory-material/types.ts": INV_TYPES,
    "src/domain/catalog/types.ts": CATALOG_TYPES,
    "apps/prototype-web/client/src/storage/local/types.ts": STORAGE_TYPES,
    "src/domain/financial-analysis/types.ts": FIN_ANALYSIS_TYPES,
    "src/domain/financial-event/types.ts": FIN_EVENT_TYPES,
    "apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts": TFV,
    ...overrides,
  };
}
const readFrom = map => rel => {
  if (!(rel in map)) throw new Error(`missing fixture ${rel}`);
  return map[rel];
};

describe("check-acceptance-value-anchors (Wave H — STR-623، توحيد R4-B2، ثم إغلاق R4-REC-5)", () => {
  it("passes when all guarded consumption sites are canonical (agreementContext, agreementService, guided walletKinds + materialUnits)", () => {
    const result = checkAcceptanceValueAnchors(REPO_ROOT, readFrom(files()));
    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("catches agreementContext reverting to a local literal acceptance set", () => {
    const tampered = CTX_OK.replace(
      "const sources = new Set<AgreementSourceValue>(AGREEMENT_SOURCE_ACCEPTANCE);",
      'const sources = new Set<AgreementSourceValue>(["instagram", "whatsapp", "referral", "walk_in", "other", "conversation", "call", "in_person", "telegram"]);',
    );
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(
        files({
          "apps/prototype-web/client/src/application/agreements/agreementContextService.ts": tampered,
        }),
      ),
    );
    expect(result.ok).toBe(false);
    expect(result.violations.some(v => v.anchor === "agreement-source-acceptance")).toBe(true);
  });

  it("catches agreementContext defining a local LegacyAgreementSource union again", () => {
    const tampered = `${CTX_OK}\nexport type LegacyAgreementSource = "conversation" | "call";\n`;
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(
        files({
          "apps/prototype-web/client/src/application/agreements/agreementContextService.ts": tampered,
        }),
      ),
    );
    expect(result.violations.some(v => v.anchor === "legacy-agreement-source-union")).toBe(true);
  });

  it("R4-REC-5: catches agreementService reverting to a local literal acceptance set (untyped historical HF-1 form)", () => {
    const tampered = SVC_OK.replace(
      "const allowedAgreementSources = new Set<string>(AGREEMENT_SOURCE_ACCEPTANCE);",
      'const allowedAgreementSources = new Set(["instagram", "whatsapp", "referral", "walk_in", "other", "conversation", "call", "in_person"]);',
    );
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(
        files({
          "apps/prototype-web/client/src/application/agreements/agreementService.ts": tampered,
        }),
      ),
    );
    expect(result.ok).toBe(false);
    expect(result.violations.some(v => v.anchor === "agreement-service-acceptance")).toBe(true);
  });

  it("R4-REC-5: catches agreementService losing the registry import while keeping a literal set", () => {
    const tampered = `
const allowedAgreementSources = new Set<string>(["instagram", "whatsapp", "referral", "walk_in", "other", "conversation", "call", "in_person"]);
`;
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(
        files({
          "apps/prototype-web/client/src/application/agreements/agreementService.ts": tampered,
        }),
      ),
    );
    expect(result.violations.some(v => v.anchor === "agreement-service-acceptance")).toBe(true);
  });

  it("catches guidedOpeningImport reverting walletKinds to a local literal set", () => {
    const tampered = GUIDED_OK.replace(
      "const walletKinds = new Set<CashWalletKind>(cashWalletKinds);",
      'const walletKinds = new Set<CashWalletKind>(["cash_drawer", "bank_account", "digital_wallet"]);',
    );
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(
        files({
          "apps/prototype-web/client/src/application/transfers/guidedOpeningImportService.ts": tampered,
        }),
      ),
    );
    expect(result.violations.some(v => v.anchor === "guided-wallet-kinds")).toBe(true);
  });

  it("catches guidedOpeningImport reverting materialUnits to a local literal set", () => {
    const tampered = GUIDED_OK.replace(
      "const materialUnits = new Set<MaterialUnit>(domainMaterialUnits);",
      'const materialUnits = new Set<MaterialUnit>(["piece", "meter", "kilogram", "liter"]);',
    );
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(
        files({
          "apps/prototype-web/client/src/application/transfers/guidedOpeningImportService.ts": tampered,
        }),
      ),
    );
    expect(result.violations.some(v => v.anchor === "guided-material-units")).toBe(true);
  });

  it("catches a domain-side cashWalletKinds change (the canonical source moved)", () => {
    const tampered = CASH_TYPES.replace('"digital_wallet", ', "");
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(
        files({
          "src/domain/cash-continuity/types.ts": tampered,
        }),
      ),
    );
    expect(result.violations.some(v => v.anchor === "domain-cash-wallet-kinds")).toBe(true);
  });

  it("R4-S8/F3: catches a domain-side materialUnits member change (the canonical source moved)", () => {
    const tampered = INV_TYPES.replace('"liter", ', "");
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(
        files({
          "src/domain/inventory-material/types.ts": tampered,
        }),
      ),
    );
    expect(result.violations.some(v => v.anchor === "domain-material-units")).toBe(true);
  });

  /* ── R6-W2/F-024: عائلات GUARDED_UNION الست — إيجابية ثم سلبيات في
   * الاتجاهين (انحراف اتحاد المجال، وانحراف مدققة النقل) لكل عائلة. ── */

  it("R6-W2/F-024: passes when all six GUARDED_UNION families match domain == validator == documented", () => {
    const result = checkAcceptanceValueAnchors(REPO_ROOT, readFrom(files()));
    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.report["inventory-movement-type"].domain).toEqual([
      "opening",
      "purchase_receipt",
      "consumption",
      "waste",
      "adjustment",
      "reversal",
    ]);
  });

  it("R6-W2/F-024: catches a domain-side InventoryMovementType drift (validator unchanged)", () => {
    const tampered = INV_TYPES.replace('"adjustment" | ', "");
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(files({ "src/domain/inventory-material/types.ts": tampered })),
    );
    expect(result.violations.some(v => v.anchor === "inventory-movement-type")).toBe(true);
  });

  it("R6-W2/F-024: catches a validator-side isInventoryMovementType drift (domain unchanged)", () => {
    const tampered = TFV.replace('value === "reversal";', 'value === "transfer";');
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(files({ "apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts": tampered })),
    );
    expect(result.violations.some(v => v.anchor === "inventory-movement-type")).toBe(true);
  });

  it("R6-W2/F-024: catches a domain-side catalogItemKinds member change", () => {
    const tampered = CATALOG_TYPES.replace('"service"', '"subscription"');
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(files({ "src/domain/catalog/types.ts": tampered })),
    );
    expect(result.violations.some(v => v.anchor === "catalog-item-kind")).toBe(true);
  });

  it("R6-W2/F-024: catches a validator-side validCatalogItem accepting a non-domain kind", () => {
    const tampered = TFV.replace(
      '(value.kind === "product" || value.kind === "service")',
      '(value.kind === "product" || value.kind === "service" || value.kind === "subscription")',
    );
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(files({ "apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts": tampered })),
    );
    expect(result.violations.some(v => v.anchor === "catalog-item-kind")).toBe(true);
  });

  it("R6-W2/F-024: catches a domain-side ScheduleStatus union drift", () => {
    const tampered = STORAGE_TYPES.replace(' | "cancelled"', "");
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(files({ "apps/prototype-web/client/src/storage/local/types.ts": tampered })),
    );
    expect(result.violations.some(v => v.anchor === "schedule-status")).toBe(true);
  });

  it("R6-W2/F-024: catches a validator-side isScheduleStatus drift", () => {
    const tampered = TFV.replace(
      'value === "scheduled" || value === "postponed" || value === "completed" || value === "cancelled";',
      'value === "scheduled" || value === "postponed" || value === "completed" || value === "cancelled" || value === "archived";',
    );
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(files({ "apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts": tampered })),
    );
    expect(result.violations.some(v => v.anchor === "schedule-status")).toBe(true);
  });

  it("R6-W2/F-024: catches a domain-side yield-readiness union drift", () => {
    const tampered = CATALOG_TYPES.replace(' | "needs_conversion"', "");
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(files({ "src/domain/catalog/types.ts": tampered })),
    );
    expect(result.violations.some(v => v.anchor === "yield-readiness")).toBe(true);
  });

  it("R6-W2/F-024: catches a validator-side isYieldReadiness drift", () => {
    const tampered = TFV.replace(
      'value === "not_configured" || value === "ready" || value === "needs_conversion";',
      'value === "not_configured" || value === "ready";',
    );
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(files({ "apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts": tampered })),
    );
    expect(result.violations.some(v => v.anchor === "yield-readiness")).toBe(true);
  });

  it("R6-W2/F-024: catches a domain-side short-cash declaration union drift (G5Direction)", () => {
    const tampered = FIN_ANALYSIS_TYPES.replace('"collection" | "commitment"', '"collection" | "commitment" | "reversal_in"');
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(files({ "src/domain/financial-analysis/types.ts": tampered })),
    );
    expect(result.violations.some(v => v.anchor === "short-cash-declaration")).toBe(true);
  });

  it("R6-W2/F-024: catches a validator-side validShortCashDeclaration knowledge drift", () => {
    const tampered = TFV.replace(
      '(value.knowledge === "known" || value.knowledge === "estimated" || value.knowledge === "needs_review")\n  );\n}\nexport const isExpenseContext',
      '(value.knowledge === "known" || value.knowledge === "estimated")\n  );\n}\nexport const isExpenseContext',
    );
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(files({ "apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts": tampered })),
    );
    expect(result.violations.some(v => v.anchor === "short-cash-declaration")).toBe(true);
  });

  it("R6-W2/F-024: catches a domain-side expense-context union drift (ExpensePurpose)", () => {
    const tampered = FIN_EVENT_TYPES.replace(' | "unallocated"', "");
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(files({ "src/domain/financial-event/types.ts": tampered })),
    );
    expect(result.violations.some(v => v.anchor === "expense-context")).toBe(true);
  });

  it("R6-W2/F-024: catches a validator-side isExpenseContext behavior drift", () => {
    const tampered = TFV.replace(
      '(value.behavior === "fixed" || value.behavior === "variable" || value.behavior === "mixed" || value.behavior === "unknown")',
      '(value.behavior === "fixed" || value.behavior === "variable" || value.behavior === "mixed")',
    );
    const result = checkAcceptanceValueAnchors(
      REPO_ROOT,
      readFrom(files({ "apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts": tampered })),
    );
    expect(result.violations.some(v => v.anchor === "expense-context")).toBe(true);
  });

  it("live repo smoke: all guarded sites consume their canonical sources (exit 0)", () => {
    const run = spawnSync(process.execPath, [SCRIPT_PATH, REPO_ROOT], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("acceptance-value-anchors: PASS");
  });
});
