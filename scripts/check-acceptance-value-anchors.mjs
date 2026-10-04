#!/usr/bin/env node
/**
 * Wave H (STR-623 — 2026-10-04): مراسي دريفت قيم القبول المكررة.
 *
 * المكتشف المعادي: موقعان يعرفان طواقم قبول محلية تكرر معرفة مصادرها
 * السلطوية خارج سجل 4D وكل حراسة — تغيير القائمة المرجعية لا يفشل أي فحص
 * فينزلق الانحراف صامتًا (نمط الفشل الأول الذي وُجدت 4D لإغلاقه):
 *   (1) application/agreements/agreementContextService.ts — طاقم مصادر
 *       الاتفاق (8 قيم: 5 حالية + 3 تاريخية) + اتحاد LegacyAgreementSource؛
 *       السلطوي: AGREEMENT_SOURCE_ACCEPTANCE في transferCompatibilityValues
 *       (المفروز من LEGACY_AGREEMENT_SOURCES نفسه).
 *   (2) application/transfers/guidedOpeningImportService.ts — طاقما
 *       walletKinds وmaterialUnits؛ السلطوي: اتحاد CashWalletKind في
 *       domain/cash-continuity/types.ts وقائمة materialUnits في
 *       domain/inventory-material/types.ts.
 *
 * المرسى: يستخرج القيم الحرفية من الموقعين المحليين ومن مصادرهما السلطوية
 * ويفشل عند أي انحراف (قيمة ناقصة/زائدة/مختلفة). التوحيد الكامل (استهلاك
 * السلطوي مباشرة بدل النسخة المحلية) مؤجل لبوابته STR-608/الأثر الإنتاجي —
 * حتى ذلك الحين هذا المرسى يجعل الانحراف مستحيل الصمت.
 *
 * الاستخدام: node scripts/check-acceptance-value-anchors.mjs [repoRoot].
 * الخروج: 0 = المراسي ثابتة؛ 1 = أي انحراف.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { ROOT } from "./check-runtime-cycles.mjs";

const SITES = {
  agreementContext: "apps/prototype-web/client/src/application/agreements/agreementContextService.ts",
  compatibilityValues: "apps/prototype-web/client/src/application/transfers/transferCompatibilityValues.ts",
  guidedOpeningImport: "apps/prototype-web/client/src/application/transfers/guidedOpeningImportService.ts",
  cashContinuityTypes: "src/domain/cash-continuity/types.ts",
  inventoryMaterialTypes: "src/domain/inventory-material/types.ts",
};

/** استخراج قيم نصية حرفية من كتلة `[...]` بعد المرساة — مع فك الانتشار
 * `...CONST` بجلب قيم الثابت المشار إليه من الملف نفسه. */
export function extractStringLiterals(source, anchor, resolveSpread = true) {
  const idx = source.indexOf(anchor);
  if (idx === -1) return null;
  const rest = source.slice(idx);
  const bracketStart = rest.indexOf("[");
  const bracketEnd = rest.indexOf("]");
  if (bracketStart === -1 || bracketEnd === -1 || bracketEnd < bracketStart) return null;
  const body = rest.slice(bracketStart + 1, bracketEnd);
  const values = [...body.matchAll(/"([^"]+)"/g)].map(m => m[1]);
  if (resolveSpread) {
    for (const spread of body.matchAll(/\.\.\.([A-Z_][A-Z0-9_]*)/g)) {
      const spreadValues = extractStringLiterals(source, `${spread[1]} = [`, false);
      if (spreadValues) values.push(...spreadValues);
    }
  }
  return values;
}

/** استخراج قيم اتحاد نوعي: "a" | "b" | "c" بعد مرساة الاسم. */
export function extractUnionValues(source, anchor) {
  const idx = source.indexOf(anchor);
  if (idx === -1) return null;
  const rest = source.slice(idx);
  const eq = rest.indexOf("=");
  if (eq === -1) return null;
  const semi = rest.indexOf(";", eq);
  const body = rest.slice(eq + 1, semi === -1 ? undefined : semi);
  return [...body.matchAll(/"([^"]+)"/g)].map(m => m[1]);
}

function setsEqual(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const v of sa) if (!sb.has(v)) return false;
  return true;
}

export function checkAcceptanceValueAnchors(repoRoot, readFile) {
  const read = readFile ?? (rel => fs.readFileSync(path.join(repoRoot, rel), "utf8"));
  const violations = [];
  const report = {};

  /* (1) طاقم مصادر الاتفاق: المحلي ≡ السلطوي (الحالي ∪ التاريخي). */
  const ctx = read(SITES.agreementContext);
  const compat = read(SITES.compatibilityValues);
  const legacyCanonical = extractStringLiterals(compat, "LEGACY_AGREEMENT_SOURCES = [");
  const acceptanceCanonical = extractStringLiterals(compat, "AGREEMENT_SOURCE_ACCEPTANCE = [");
  const localSources = extractStringLiterals(ctx, "const sources = new Set<AgreementSourceValue>([");
  const localLegacy = extractUnionValues(ctx, "export type LegacyAgreementSource =");
  report.agreementSources = { canonical: acceptanceCanonical, local: localSources };
  if (!acceptanceCanonical || !localSources || !setsEqual(acceptanceCanonical, localSources)) {
    violations.push({
      anchor: "agreement-source-acceptance",
      hint: `طاقم مصادر الاتفاق المحلي انحرف عن AGREEMENT_SOURCE_ACCEPTANCE — المحلي: ${JSON.stringify(localSources)}؛ السلطوي: ${JSON.stringify(acceptanceCanonical)}`,
    });
  }
  if (!legacyCanonical || !localLegacy || !setsEqual(legacyCanonical, localLegacy)) {
    violations.push({
      anchor: "legacy-agreement-source-union",
      hint: `اتحاد LegacyAgreementSource المحلي انحرف عن LEGACY_AGREEMENT_SOURCES — المحلي: ${JSON.stringify(localLegacy)}؛ السلطوي: ${JSON.stringify(legacyCanonical)}`,
    });
  }

  /* (2) طاقما مستورد الفتح الموجه: المحلي ≡ المجال. */
  const guided = read(SITES.guidedOpeningImport);
  const cashTypes = read(SITES.cashContinuityTypes);
  const invTypes = read(SITES.inventoryMaterialTypes);
  const localWalletKinds = extractStringLiterals(guided, "const walletKinds = new Set<CashWalletKind>([");
  const localMaterialUnits = extractStringLiterals(guided, "const materialUnits = new Set<MaterialUnit>([");
  const canonicalWalletKinds = extractUnionValues(cashTypes, "export type CashWalletKind");
  const canonicalMaterialUnits = extractStringLiterals(invTypes, "export const materialUnits = [");
  report.walletKinds = { canonical: canonicalWalletKinds, local: localWalletKinds };
  report.materialUnits = { canonical: canonicalMaterialUnits, local: localMaterialUnits };
  if (!canonicalWalletKinds || !localWalletKinds || !setsEqual(canonicalWalletKinds, localWalletKinds)) {
    violations.push({
      anchor: "guided-wallet-kinds",
      hint: `طاقم walletKinds المحلي انحرف عن اتحاد CashWalletKind الكنوني — المحلي: ${JSON.stringify(localWalletKinds)}؛ السلطوي: ${JSON.stringify(canonicalWalletKinds)}`,
    });
  }
  if (!canonicalMaterialUnits || !localMaterialUnits || !setsEqual(canonicalMaterialUnits, localMaterialUnits)) {
    violations.push({
      anchor: "guided-material-units",
      hint: `طاقم materialUnits المحلي انحرف عن قائمة المجال الكنونية — المحلي: ${JSON.stringify(localMaterialUnits)}؛ السلطوي: ${JSON.stringify(canonicalMaterialUnits)}`,
    });
  }

  return { ok: violations.length === 0, violations, report };
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  if (!fs.existsSync(path.join(repoRoot, "package.json"))) {
    console.error("acceptance-value-anchors: USAGE: node scripts/check-acceptance-value-anchors.mjs [repoRoot]");
    process.exit(2);
  }
  const { ok, violations } = checkAcceptanceValueAnchors(repoRoot);
  if (!ok) {
    console.error(`acceptance-value-anchors: FAIL — ${violations.length} انحرافًا في قيم القبول المثبتة:`);
    for (const v of violations) {
      console.error(`  [${v.anchor}]`);
      console.error(`    ${v.hint}`);
    }
    process.exit(1);
  }
  console.log(
    "acceptance-value-anchors: PASS — المراسي الأربعة ثابتة (مصادر الاتفاق 5+3، الاتحاد التاريخي، walletKinds، materialUnits) — صفر انحراف صامت (Wave H/STR-623)",
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
