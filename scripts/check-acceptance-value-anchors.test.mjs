/**
 * Wave H (STR-623): اختبارات مراسي قيم القبول — حتمية بلا شبكة.
 * تغطي: النجاح على القيم المتطابقة، والاصطياد عند انحراف كل مرساة من
 * الأربعة (قيمة محلية زائدة/ناقصة، اتحاد تاريخي منحرف، طاقم محلي مختلف) —
 * وفحص دخاني على المستودع الحي.
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
export type LegacyAgreementSource = "conversation" | "call" | "in_person";
const sources = new Set<AgreementSourceValue>([
  "instagram", "whatsapp", "referral", "walk_in", "other",
  "conversation", "call", "in_person",
]);
`;
const GUIDED_OK = `
const walletKinds = new Set<CashWalletKind>(["cash_drawer", "bank_account", "digital_wallet", "other"]);
const materialUnits = new Set<MaterialUnit>(["piece", "meter", "kilogram", "liter", "other"]);
`;
const CASH_TYPES = `export type CashWalletKind = "cash_drawer" | "bank_account" | "digital_wallet" | "other";\n`;
const INV_TYPES = `export const materialUnits = ["piece", "meter", "kilogram", "liter", "other"] as const;\n`;

function files(overrides = {}) {
  return {
    "apps/prototype-web/client/src/application/agreements/agreementContextService.ts": CTX_OK,
    "apps/prototype-web/client/src/application/transfers/transferCompatibilityValues.ts": COMPAT,
    "apps/prototype-web/client/src/application/transfers/guidedOpeningImportService.ts": GUIDED_OK,
    "src/domain/cash-continuity/types.ts": CASH_TYPES,
    "src/domain/inventory-material/types.ts": INV_TYPES,
    ...overrides,
  };
}
const readFrom = map => rel => {
  if (!(rel in map)) throw new Error(`missing fixture ${rel}`);
  return map[rel];
};

describe("check-acceptance-value-anchors (Wave H — STR-623)", () => {
  it("passes when all four anchors match their canonical sources", () => {
    const result = checkAcceptanceValueAnchors(REPO_ROOT, readFrom(files()));
    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("catches a drifted agreement-source local set (extra value)", () => {
    const tampered = CTX_OK.replace('"walk_in",', '"walk_in", "telegram",');
    const result = checkAcceptanceValueAnchors(REPO_ROOT, readFrom(files({
      "apps/prototype-web/client/src/application/agreements/agreementContextService.ts": tampered,
    })));
    expect(result.ok).toBe(false);
    expect(result.violations.some(v => v.anchor === "agreement-source-acceptance")).toBe(true);
  });

  it("catches a drifted legacy union (missing value)", () => {
    const tampered = CTX_OK.replace('| "in_person"', "");
    const result = checkAcceptanceValueAnchors(REPO_ROOT, readFrom(files({
      "apps/prototype-web/client/src/application/agreements/agreementContextService.ts": tampered,
    })));
    expect(result.violations.some(v => v.anchor === "legacy-agreement-source-union")).toBe(true);
  });

  it("catches a drifted walletKinds local set", () => {
    const tampered = GUIDED_OK.replace('"digital_wallet", ', "");
    const result = checkAcceptanceValueAnchors(REPO_ROOT, readFrom(files({
      "apps/prototype-web/client/src/application/transfers/guidedOpeningImportService.ts": tampered,
    })));
    expect(result.violations.some(v => v.anchor === "guided-wallet-kinds")).toBe(true);
  });

  it("catches a domain-side materialUnits change (the canonical source moved)", () => {
    const tampered = INV_TYPES.replace('"liter", ', "");
    const result = checkAcceptanceValueAnchors(REPO_ROOT, readFrom(files({
      "src/domain/inventory-material/types.ts": tampered,
    })));
    expect(result.violations.some(v => v.anchor === "guided-material-units")).toBe(true);
  });

  it("live repo smoke: all four anchors hold (exit 0)", () => {
    const run = spawnSync(process.execPath, [SCRIPT_PATH, REPO_ROOT], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("acceptance-value-anchors: PASS");
  });
});
