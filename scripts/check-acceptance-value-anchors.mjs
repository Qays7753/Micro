#!/usr/bin/env node
/**
 * Wave H (STR-623 — 2026-10-04) ثم R4-B2 (2026-10-08): مراسي قيم القبول.
 *
 * التاريخ: كان المكتشف موقعين يعرفان طواقم قبول محلية تكرر معرفة مصادرها
 * السلطوية — فأقيمت هذه المراسي على «تساوي حرفي بين النسختين» (أي انحراف
 * يفشل الفحص) إلى حين بوابة STR-608.
 *
 * R4-B2 (توحيد قيم القبول الحالية — قرار STR-608 الموثق): المواقع الثلاثة
 * صارت تستهلك مصادرها الكنونية مباشرة وقت التشغيل:
 *   (1) application/agreements/agreementContextService.ts — يستورد
 *       AGREEMENT_SOURCE_ACCEPTANCE وLegacyAgreementSource من
 *       transferCompatibilityValues (السجل الكنوني) ويبني الطاقم منه؛
 *   (2) application/transfers/guidedOpeningImportService.ts — يبني walletKinds
 *       من cashWalletKinds الكنونية (domain/cash-continuity) وmaterialUnits
 *       من قائمة المجال (domain/inventory-material).
 * بعد التوحيد صار الانحراف مستحيلًا بالبناء (النوع + الاستيراد) — المراسي
 * هنا تثبت **الاستهلاك نفسه**: أن كل موقع ما زال يستورد ويبني من مصدره
 * الكنوني، ولم يعد يحمل نسخة حرفية محلية، وأن مصادر المجال قائمة بأعضائها.
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

  /* (١) مصادر الاتفاق: الاستهلاك الكنوني المباشر من سجل التوافق. */
  const ctx = read(SITES.agreementContext);
  const compat = read(SITES.compatibilityValues);
  const legacyCanonical = extractStringLiterals(compat, "LEGACY_AGREEMENT_SOURCES = [");
  const acceptanceCanonical = extractStringLiterals(compat, "AGREEMENT_SOURCE_ACCEPTANCE = [");
  const ctxImportsRegistry =
    /import\s*\{[^}]*AGREEMENT_SOURCE_ACCEPTANCE[^}]*\}\s*from\s*"@\/application\/transfers\/transferCompatibilityValues"/.test(
      ctx,
    );
  const ctxBuildsFromRegistry = ctx.includes("new Set<AgreementSourceValue>(AGREEMENT_SOURCE_ACCEPTANCE)");
  const ctxNoLocalLiteral = !ctx.includes("new Set<AgreementSourceValue>([");
  report.agreementSources = { canonical: acceptanceCanonical, consumed: ctxBuildsFromRegistry };
  if (!ctxImportsRegistry || !ctxBuildsFromRegistry || !ctxNoLocalLiteral) {
    violations.push({
      anchor: "agreement-source-acceptance",
      hint: `agreementContextService لم يعد يستهلك AGREEMENT_SOURCE_ACCEPTANCE من سجل التوافق مباشرة (استيراد: ${ctxImportsRegistry}؛ بناء: ${ctxBuildsFromRegistry}؛ خلوّ من النسخة الحرفية: ${ctxNoLocalLiteral})`,
    });
  }
  const ctxImportsLegacyType =
    /import\s*\{[^}]*type\s+LegacyAgreementSource[^}]*\}\s*from\s*"@\/application\/transfers\/transferCompatibilityValues"/.test(
      ctx,
    );
  const ctxNoLocalLegacyUnion = !/export type LegacyAgreementSource\s*=\s*"/.test(ctx);
  report.legacyAgreementSource = { canonical: legacyCanonical, consumed: ctxImportsLegacyType };
  if (!ctxImportsLegacyType || !ctxNoLocalLegacyUnion || !legacyCanonical) {
    violations.push({
      anchor: "legacy-agreement-source-union",
      hint: `اتحاد LegacyAgreementSource لم يعد يُستهلك من السجل الكنوني (استيراد النوع: ${ctxImportsLegacyType}؛ لا اتحاد محلي: ${ctxNoLocalLegacyUnion})`,
    });
  }

  /* (٢) مستورد الفتح الموجه: الاستهلاك الكنوني المباشر من المجال. */
  const guided = read(SITES.guidedOpeningImport);
  const cashTypes = read(SITES.cashContinuityTypes);
  const invTypes = read(SITES.inventoryMaterialTypes);
  const canonicalWalletKinds = extractStringLiterals(cashTypes, "export const cashWalletKinds = [");
  const canonicalMaterialUnits = extractStringLiterals(invTypes, "export const materialUnits = [");
  report.walletKinds = { canonical: canonicalWalletKinds, consumed: true };
  report.materialUnits = { canonical: canonicalMaterialUnits, consumed: true };
  const guidedImportsWalletKinds =
    /import\s*\{[^}]*cashWalletKinds[^}]*\}\s*from\s*"@micro-domain\/cash-continuity\/index\.js"/.test(
      guided,
    );
  const guidedBuildsWalletKinds = guided.includes("new Set<CashWalletKind>(cashWalletKinds)");
  const guidedNoLocalWalletLiteral = !guided.includes("new Set<CashWalletKind>([");
  if (!guidedImportsWalletKinds || !guidedBuildsWalletKinds || !guidedNoLocalWalletLiteral) {
    violations.push({
      anchor: "guided-wallet-kinds",
      hint: `guidedOpeningImportService لم يعد يستهلك cashWalletKinds الكنونية (استيراد: ${guidedImportsWalletKinds}؛ بناء: ${guidedBuildsWalletKinds}؛ خلوّ من النسخة الحرفية: ${guidedNoLocalWalletLiteral})`,
    });
  }
  const guidedImportsMaterialUnits =
    /import\s*\{[^}]*materialUnits\s+as\s+domainMaterialUnits[^}]*\}\s*from\s*"@micro-domain\/inventory-material\/index\.js"/.test(
      guided,
    );
  const guidedBuildsMaterialUnits = guided.includes("new Set<MaterialUnit>(domainMaterialUnits)");
  const guidedNoLocalMaterialLiteral = !guided.includes("new Set<MaterialUnit>([");
  if (!guidedImportsMaterialUnits || !guidedBuildsMaterialUnits || !guidedNoLocalMaterialLiteral) {
    violations.push({
      anchor: "guided-material-units",
      hint: `guidedOpeningImportService لم يعد يستهلك قائمة materialUnits الكنونية (استيراد مُعاد التسمية: ${guidedImportsMaterialUnits}؛ بناء: ${guidedBuildsMaterialUnits}؛ خلوّ من النسخة الحرفية: ${guidedNoLocalMaterialLiteral})`,
    });
  }

  /* (٣) تثبيت المصادر الكنونية نفسها — القوائم الحية بأعضائها الموثقة. */
  const expectedWalletKinds = ["cash_drawer", "bank_account", "digital_wallet", "other"];
  if (!canonicalWalletKinds || !setsEqual(canonicalWalletKinds, expectedWalletKinds)) {
    violations.push({
      anchor: "domain-cash-wallet-kinds",
      hint: `قائمة cashWalletKinds الكنونية في domain/cash-continuity تغيرت عن الأعضاء الأربعة الموثقة — الحالي: ${JSON.stringify(canonicalWalletKinds)}`,
    });
  }
  if (!canonicalMaterialUnits || canonicalMaterialUnits.length === 0) {
    violations.push({
      anchor: "domain-material-units",
      hint: `قائمة materialUnits الكنونية في domain/inventory-material غير مقروءة — ${JSON.stringify(canonicalMaterialUnits)}`,
    });
  }

  return { ok: violations.length === 0, violations, report };
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  if (!fs.existsSync(path.join(repoRoot, "package.json"))) {
    console.error(
      "acceptance-value-anchors: USAGE: node scripts/check-acceptance-value-anchors.mjs [repoRoot]",
    );
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
    "acceptance-value-anchors: PASS — المواقع الثلاثة تستهلك مصادرها الكنونية مباشرة (مصادر الاتفاق من سجل التوافق؛ walletKinds وmaterialUnits من المجال) والقوائم الكنونية بأعضائها الموثقة — صفر نسخة حرفية محلية (Wave H/STR-623 ثم توحيد R4-B2)",
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
