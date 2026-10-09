#!/usr/bin/env node
/**
 * Wave H (STR-623 — 2026-10-04) ثم R4-B2 (2026-10-08): مراسي قيم القبول.
 *
 * التاريخ: كان المكتشف موقعين يعرفان طواقم قبول محلية تكرر معرفة مصادرها
 * السلطوية — فأقيمت هذه المراسي على «تساوي حرفي بين النسختين» (أي انحراف
 * يفشل الفحص) إلى حين بوابة STR-608.
 *
 * R4-B2 (توحيد قيم القبول الحالية — قرار STR-608 الموثق) ثم R4-S8/F1:
 * مواقع استهلاك قيم القبول الحالية تستهلك مصادرها الكنونية مباشرة وقت التشغيل:
 *   (1) application/agreements/agreementContextService.ts — يستورد
 *       AGREEMENT_SOURCE_ACCEPTANCE وLegacyAgreementSource من
 *       transferCompatibilityValues (السجل الكنوني) ويبني الطاقم منه؛
 *   (2) application/transfers/guidedOpeningImportService.ts — يبني walletKinds
 *       من cashWalletKinds الكنونية (domain/cash-continuity) وmaterialUnits
 *       من قائمة المجال (domain/inventory-material)؛
 *   (3) application/agreements/agreementService.ts — يستورد
 *       AGREEMENT_SOURCE_ACCEPTANCE من السجل الكنوني نفسه (وحدة HF-1).
 * R4-REC-5 (2026-10-08، شريحة تحصين بإذن المالك): أُضيف الموقع الثالث إلى
 * المراسي مع سلبيتين تثبتان الاصطياد عند رجوعه إلى نسخة حرفية — إغلاق فجوة
 * تغطية الحارس الموثقة في مصالحة الأدلة (كان الاستهلاك الكنوني قائمًا
 * ومطابقًا، والفجوة في تعميق الحارس فقط).
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
  agreementService: "apps/prototype-web/client/src/application/agreements/agreementService.ts",
  compatibilityValues: "apps/prototype-web/client/src/application/transfers/transferCompatibilityValues.ts",
  guidedOpeningImport: "apps/prototype-web/client/src/application/transfers/guidedOpeningImportService.ts",
  cashContinuityTypes: "src/domain/cash-continuity/types.ts",
  inventoryMaterialTypes: "src/domain/inventory-material/types.ts",
  /* R6-W2/F-024 (2026-10-09): عائلات GUARDED_UNION الست خارج طاقم مراسي
   * الدريفت (Wave 3B) — كانت محمولة بالتشخيص/الذهبيات فقط. */
  catalogTypes: "src/domain/catalog/types.ts",
  storageLocalTypes: "apps/prototype-web/client/src/storage/local/types.ts",
  financialAnalysisTypes: "src/domain/financial-analysis/types.ts",
  financialEventTypes: "src/domain/financial-event/types.ts",
  transferFamilyValidators: "apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts",
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

/** R6-W2/F-024: استخراج طاقم القبول الحرفي لمدققة نقل — نافذة المدققة تمتد
 * من مرساتها حتى التصدير التالي، وتُجمع القيم الحرفية إما من مقارنات
 * `value === "x"` (مدققات القيمة المفردة) أو من مقارنات `value.<field> === "x"`
 * (مدققات الشكل متعدد الحقول). الحقول undefined = القيمة المفردة. */
export function extractValidatorLiterals(source, anchor, fields = undefined) {
  const idx = source.indexOf(anchor);
  if (idx === -1) return null;
  const rest = source.slice(idx);
  const nextExport = rest.indexOf("\nexport ");
  const window = nextExport === -1 ? rest : rest.slice(0, nextExport);
  if (fields === undefined) {
    return [...window.matchAll(/value\s*===\s*"([^"]+)"/g)].map(m => m[1]);
  }
  const byField = {};
  for (const field of fields) {
    const re = new RegExp(`value\\.${field}\\s*===\\s*"([^"]+)"`, "g");
    byField[field] = [...window.matchAll(re)].map(m => m[1]);
  }
  return byField;
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

  /* (١-ب) R4-REC-5: الموقع الثالث لمصادر الاتفاق — خدمة الاتفاق نفسها (وحدة
   * HF-1، وُحدت في استجابة S8). الاستهلاك الكنوني قائم؛ المرساة هنا تثبته
   * وتصاد أي رجوع. شبكة «لا نسخة حرفية» مقصودة على مستوى الملف كله (نمط
   * HF-8 المغلق): الصيغة التاريخية للوحدة قبل الإصلاح كانت `new Set([`
   * غير المطابقة (مسجلة في c5363c82^) فتُحظر مع الصيغة المطابقة
   * `new Set<string>([` معًا — الرجوع الكامل يصيده بُعد البناء من المصدر،
   * والإضافة الحرفية الموازية (بأي الصيغتين) تصيدها شبكة الخلوّ. */
  const svc = read(SITES.agreementService);
  const svcImportsRegistry =
    /import\s*\{[^}]*AGREEMENT_SOURCE_ACCEPTANCE[^}]*\}\s*from\s*"@\/application\/transfers\/transferCompatibilityValues"/.test(
      svc,
    );
  const svcBuildsFromRegistry = svc.includes("new Set<string>(AGREEMENT_SOURCE_ACCEPTANCE)");
  const svcNoLocalLiteral = !svc.includes("new Set<string>([") && !svc.includes("new Set([");
  report.agreementServiceSources = { canonical: acceptanceCanonical, consumed: svcBuildsFromRegistry };
  if (!svcImportsRegistry || !svcBuildsFromRegistry || !svcNoLocalLiteral) {
    violations.push({
      anchor: "agreement-service-acceptance",
      hint: `agreementService لم يعد يستهلك AGREEMENT_SOURCE_ACCEPTANCE من سجل التوافق مباشرة (استيراد: ${svcImportsRegistry}؛ بناء: ${svcBuildsFromRegistry}؛ خلوّ من النسخة الحرفية: ${svcNoLocalLiteral})`,
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
  /* R4-S8/F3 (تدقيق عدائي، 2026-10-08): أعيد تثبيت أعضاء القائمة بالضبط —
   * كان الفحص «غير فارغة» فقط فكان تغيير عضو مجالي يمر صامتًا. */
  const expectedMaterialUnits = ["piece", "meter", "kilogram", "liter", "other"];
  if (!canonicalMaterialUnits || !setsEqual(canonicalMaterialUnits, expectedMaterialUnits)) {
    violations.push({
      anchor: "domain-material-units",
      hint: `قائمة materialUnits الكنونية في domain/inventory-material تغيرت عن الأعضاء الخمسة الموثقة — الحالي: ${JSON.stringify(canonicalMaterialUnits)}`,
    });
  }

  /* (٤) R6-W2/F-024 (2026-10-09): عائلات GUARDED_UNION الست التي كانت خارج
   * طاقم مراسي الدريفت (Wave 3B — domainTransferDriftAnchors) ومحمولة
   * بالتشخيص/الذهبيات فقط. كل عائلة تُثبت الآن من الجهتين: اتحاد المجال
   * الكنوني (نص المصدر) == طاقم القبول الحرفي في مدققة النقل == الطاقم
   * الموثق هنا — أي انحراف في أي جهة يُصاد. الجذر (تصدير قوائم تشغيلية
   * مجالية للمستهلكين — مسار 4D/STR-302) يبقى قرار مالك محجوزًا؛ هذا تحصين
   * اختباري فقط لا يغير إنتاجًا ولا يوسع قبولًا. */
  const tfv = read(SITES.transferFamilyValidators);
  const invMaterial = read(SITES.inventoryMaterialTypes);
  const catalogTypes = read(SITES.catalogTypes);
  const storageTypes = read(SITES.storageLocalTypes);
  const finAnalysis = read(SITES.financialAnalysisTypes);
  const finEvent = read(SITES.financialEventTypes);

  const F024_FAMILIES = [
    {
      anchor: "inventory-movement-type",
      what: "InventoryMovementType",
      domain: extractUnionValues(invMaterial, "type InventoryMovementType ="),
      validator: extractValidatorLiterals(tfv, "isInventoryMovementType = "),
      expected: ["opening", "purchase_receipt", "consumption", "waste", "adjustment", "reversal"],
    },
    {
      anchor: "catalog-item-kind",
      what: "CatalogItemKind",
      domain: extractStringLiterals(catalogTypes, "export const catalogItemKinds = [", false),
      validator: extractValidatorLiterals(tfv, "validCatalogItem", ["kind"]).kind,
      expected: ["product", "service"],
    },
    {
      anchor: "schedule-status",
      what: "ScheduleStatus",
      domain: extractUnionValues(storageTypes, "export type ScheduleStatus ="),
      validator: extractValidatorLiterals(tfv, "isScheduleStatus = "),
      expected: ["scheduled", "postponed", "completed", "cancelled"],
    },
    {
      anchor: "yield-readiness",
      what: "CatalogTemplateYieldReadiness",
      domain: extractUnionValues(catalogTypes, "type CatalogTemplateYieldReadiness ="),
      validator: extractValidatorLiterals(tfv, "isYieldReadiness = "),
      expected: ["not_configured", "ready", "needs_conversion"],
    },
    {
      anchor: "short-cash-declaration",
      what: "ShortCashDeclaration kind/direction/knowledge",
      domain: [
        ...(extractUnionValues(finAnalysis, "type ShortCashDeclarationKind =") ?? []),
        ...(extractUnionValues(finAnalysis, "type G5Direction =") ?? []),
        ...(extractUnionValues(finAnalysis, "export type G5Knowledge =") ?? []),
      ],
      validator: (() => {
        const byField = extractValidatorLiterals(tfv, "validShortCashDeclaration", [
          "kind",
          "direction",
          "knowledge",
        ]);
        return byField ? [...byField.kind, ...byField.direction, ...byField.knowledge] : null;
      })(),
      expected: [
        "declaration",
        "reversal",
        "collection",
        "commitment",
        "known",
        "estimated",
        "needs_review",
      ],
    },
    {
      anchor: "expense-context",
      what: "ExpenseContext relationship/behavior/purpose/knowledge",
      domain: [
        ...(extractUnionValues(finEvent, "type ExpenseRelationship =") ?? []),
        ...(extractUnionValues(finEvent, "type ExpenseBehavior =") ?? []),
        ...(extractUnionValues(finEvent, "type ExpensePurpose =") ?? []),
        ...(extractUnionValues(finEvent, "type ExpenseKnowledge =") ?? []),
      ],
      validator: (() => {
        const byField = extractValidatorLiterals(tfv, "isExpenseContext = ", [
          "relationship",
          "behavior",
          "purpose",
          "knowledge",
        ]);
        return byField
          ? [
              ...byField.relationship,
              ...byField.behavior,
              ...byField.purpose,
              ...byField.knowledge,
            ]
          : null;
      })(),
      expected: [
        "project",
        "shared",
        "fixed",
        "variable",
        "mixed",
        "unknown",
        "project_general",
        "period",
        "order",
        "product",
        "campaign",
        "unallocated",
        "known",
        "estimated",
        "needs_review",
      ],
    },
  ];

  for (const family of F024_FAMILIES) {
    report[family.anchor] = { domain: family.domain, validator: family.validator };
    const domainOk = family.domain !== null && setsEqual(family.domain, family.expected);
    const validatorOk = family.validator !== null && setsEqual(family.validator, family.expected);
    if (!domainOk || !validatorOk) {
      violations.push({
        anchor: family.anchor,
        hint: `${family.what}: انحراف في طاقم القبول — اتحاد المجال: ${JSON.stringify(
          family.domain,
        )}؛ مدققة النقل: ${JSON.stringify(family.validator)}؛ الموثق: ${JSON.stringify(
          family.expected,
        )} (المصدران يجب أن يطابقا الطاقم الموثق — R6-W2/F-024)`,
      });
    }
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
    "acceptance-value-anchors: PASS — مواقع الاستهلاك الأربعة المحروسة (agreementContextService وagreementService لمصادر الاتفاق من سجل التوافق؛ walletKinds وmaterialUnits في guided من المجال) تستهلك مصادرها الكنونية مباشرة والقوائم الكنونية بأعضائها الموثقة — رجوع أي موقع إلى نسخة حرفية (بصيغتيها) يُصاد حتميًا بالسلبيات المثبتة (Wave H/STR-623 ثم توحيد R4-B2 ثم إغلاق R4-REC-5)؛ وعائلات F-024 الست (inventoryMovementType وcatalogItemKind وscheduleStatus وyieldReadiness وshortCashDeclaration وexpenseContext) مثبتة من الجهتين: اتحاد المجال == مدققة النقل == الطاقم الموثق (R6-W2/F-024)",
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
