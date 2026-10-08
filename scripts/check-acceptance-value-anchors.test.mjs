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
const INV_TYPES = `export const materialUnits = ["piece", "meter", "kilogram", "liter", "other"] as const;\n`;

function files(overrides = {}) {
  return {
    "apps/prototype-web/client/src/application/agreements/agreementContextService.ts": CTX_OK,
    "apps/prototype-web/client/src/application/agreements/agreementService.ts": SVC_OK,
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

  it("live repo smoke: all guarded sites consume their canonical sources (exit 0)", () => {
    const run = spawnSync(process.execPath, [SCRIPT_PATH, REPO_ROOT], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("acceptance-value-anchors: PASS");
  });
});
