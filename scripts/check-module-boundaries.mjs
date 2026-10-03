#!/usr/bin/env node
/**
 * Wave 4E (ARCH-002/WS-212 — بطاقة RC-9): مراقب الحدود القائم على الفَلْحة
 * (resolution-based) — يفحص حدود الوحدات عبر تحليل AST وحل الاستيرادات إلى
 * ملفات حقيقية، لا بمطابقة نصية.
 *
 * القواعد الثلاث (ratchet — CI يرفض الجديد فقط؛ الأساس المقبول مضمّن):
 *  R1) استيراد عميق داخل المجال من خارج طبقة المجال
 *      (`@micro-domain/<area>/<غير-index>`): مقصور على الأزواج المسجلة
 *      (الاستثناءات الموثقة في سجل الملكية §5 — D-034 وSTR-205).
 *  R2) حافة قيمة مباشرة من واجهة المستخدم إلى المجال (STR-106 — قرار مالك
 *      معلق): مجمدة على الأساس المسجل؛ أي حافة جديدة ترفض حتى قرار المالك.
 *  R3) حافة قيمة من التطبيق إلى العرض (STR-203 — قرار مالك معلق): مجمدة
 *      على الأساس المسجل كذلك.
 *
 * تحديث الأساس عمدًا مشروط: أي حافة جديدة مشروعة تُضاف إلى الأساس في نفس
 * الـPR مع صف/تحديث في سجل الملكية §5 (سجل الاستثناءات) — الحارس يجعل
 * الزيادة مرئية لا مستحيلة، ويمنعها الصامتة فحسب.
 *
 * الاستخدام: node scripts/check-module-boundaries.mjs [repoRoot].
 * الخروج: 0 = نظيف؛ 1 = أي خرق جديد.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { ROOT, resolveSpecifier } from "./check-runtime-cycles.mjs";

const SCAN_ROOTS = ["src", path.join("apps", "prototype-web", "client", "src")];

/* طبقات الوحدة بمرآة منهجية سجل الملكية/الجرد (owner_layer). */
export function layerOf(repoRoot, file) {
  const rel = path.relative(repoRoot, file).split(path.sep).join("/");
  if (rel.startsWith("src/domain/")) return "domain";
  if (rel.startsWith("apps/prototype-web/client/src/storage/")) return "storage";
  if (rel.startsWith("apps/prototype-web/client/src/application/")) return "application";
  if (rel.startsWith("apps/prototype-web/client/src/presentation/")) return "presentation";
  if (rel.startsWith("apps/prototype-web/client/src/app/")) return "app-shell";
  if (rel.startsWith("apps/prototype-web/client/src/pwa/")) return "pwa";
  if (rel.startsWith("apps/prototype-web/client/src/lib/")) return "lib";
  if (rel.startsWith("apps/prototype-web/client/src/contexts/")) return "contexts";
  if (rel.startsWith("apps/prototype-web/client/src/")) return "ui"; /* pages/components/styles/جذر client */
  if (rel.startsWith("tests/") || rel.startsWith("scripts/")) return "infra";
  return "infra";
}

const UI_LAYERS = new Set(["ui", "app-shell", "contexts", "lib"]);

/** هل الاستيراد يحمل قيمة في زمن التشغيل؟ (AST — نفس منطق حارس الدورات) */
function importCarriesRuntimeValue(node) {
  const clause = node.importClause;
  if (!clause) return true;
  if (clause.isTypeOnly) return false;
  if (clause.name) return true;
  const bindings = clause.namedBindings;
  if (!bindings) return false;
  if (ts.isNamespaceImport(bindings)) return true;
  if (ts.isNamedImports(bindings)) return bindings.elements.some(element => !element.isTypeOnly);
  return false;
}

function listProductionFiles(repoRoot) {
  const files = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") continue;
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      if (/\.test\.[a-z]+$/.test(entry.name)) continue;
      if (/\.d\.ts$/.test(entry.name)) continue;
      files.push(full);
    }
  };
  for (const relativeRoot of SCAN_ROOTS) {
    const absolute = path.join(repoRoot, relativeRoot);
    if (fs.existsSync(absolute)) walk(absolute);
  }
  return files.sort();
}

/** جمع كل الاستيرادات (ثابتة وديناميكية، قيمة ونوعًا) مع حلها إلى ملفات. */
export function collectAllImports(repoRoot, files) {
  const sources = files ?? listProductionFiles(repoRoot);
  const imports = [];
  for (const file of sources) {
    const content = fs.readFileSync(file, "utf8");
    const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, kind);
    const layer = layerOf(repoRoot, file);
    const push = (specifier, value, dynamic) => {
      const resolved = resolveSpecifier(specifier, file, repoRoot);
      imports.push({
        file: path.relative(repoRoot, file).split(path.sep).join("/"),
        layer,
        specifier,
        resolved: resolved ? path.relative(repoRoot, resolved).split(path.sep).join("/") : null,
        kind: value ? "value" : "type",
        dynamic,
      });
    };
    for (const statement of sourceFile.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
        push(statement.moduleSpecifier.text, importCarriesRuntimeValue(statement), false);
      } else if (
        ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        !statement.isTypeOnly
      ) {
        push(statement.moduleSpecifier.text, true, false);
      }
    }
    const visitDynamic = node => {
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        ts.isStringLiteral(node.arguments[0] ?? {})
      ) {
        push(node.arguments[0].text, true, true);
      }
      ts.forEachChild(node, visitDynamic);
    };
    visitDynamic(sourceFile);
  }
  return imports;
}

/* ─── الأساس المقبول (ratchet baseline) ────────────────────────────────────
 * مصدر الأساس: القياس الحي عند تنفيذ Wave 4E (سجل الجرد v1.2 + رسم الاستيراد)
 * مطابقًا لسجل الاستثناءات في سجل الملكية §5. التحديث عمدًا في نفس الـPR
 * المصورة الحافة/الاستيراد الجديد، مع صف السجل. */

/** R1: الاستيرادات العميقة المسجلة داخل المجال من خارجه (كلها ديناميكية موثقة).
 * Wave F (ADR-013، 2026-10-04): فحص MIC-18 انتقل حرفيًا من integrityCheckService.ts
 * إلى بيته الشقيق integrityCheckSettlementBasis.ts — الحافة الموثقة نفسها
 * (STR-205/STR-313) انتقلت معه؛ تحديث الأساس في نفس الـPR وفق بروتوكول الحارس.
 * Wave F شريحة ٢ (ADR-013 عنقود ٣، 2026-10-04): قراءة المؤشرات انتقلت حرفيًا من
 * projectFinancialService.ts إلى بيته الشقيق projectFinancialInsights.ts — حافة
 * operatingBreakEven الموثقة D-034 نفسها (خارج حزمة الدخول عمدًا) انتقلت معها. */
export const DEEP_DOMAIN_IMPORT_BASELINE = [
  "apps/prototype-web/client/src/application/finance/integrityCheckSettlementBasis.ts -> @micro-domain/craft-order/settlementInvariant.js",
  "apps/prototype-web/client/src/application/finance/projectFinancialInsights.ts -> @micro-domain/financial-analysis/operatingBreakEven.js",
  "apps/prototype-web/client/src/application/financial-analysis/financialAnalysisService.ts -> @micro-domain/financial-analysis/operatingBreakEven.js",
];

/** R2: حواف القيمة المباشرة المسجلة من الواجهة إلى المجال (STR-106). */
export const UI_TO_DOMAIN_VALUE_BASELINE = [
  "apps/prototype-web/client/src/components/finance/AllocationReviewCard.tsx -> @micro-domain/financial-event/index.js",
  "apps/prototype-web/client/src/components/finance/ExpenseBudgetsSectionBody.tsx -> @micro-domain/shared/index.js",
  "apps/prototype-web/client/src/components/finance/quickFormHelpers.ts -> @micro-domain/cash-continuity/index.js",
  "apps/prototype-web/client/src/components/presentation/EventEffectPreview.tsx -> @micro-domain/financial-event/index.js",
  "apps/prototype-web/client/src/pages/AssetDetail.tsx -> @micro-domain/asset/index.js",
  "apps/prototype-web/client/src/pages/Catalog.tsx -> @micro-domain/recurring-margin/index.js",
  "apps/prototype-web/client/src/pages/CostEditor.tsx -> @micro-domain/craft-order/index.js",
  "apps/prototype-web/client/src/pages/DirectSaleEditor.tsx -> @micro-domain/direct-sale/index.js",
  "apps/prototype-web/client/src/pages/Finance.tsx -> @micro-domain/owner-safe-withdrawal/index.js",
  "apps/prototype-web/client/src/pages/InventoryMaterials.tsx -> @micro-domain/shared/index.js",
  "apps/prototype-web/client/src/pages/OrderDetail.tsx -> @micro-domain/craft-order/index.js",
  "apps/prototype-web/client/src/pages/OrderDetail.tsx -> @micro-domain/shared/index.js",
  "apps/prototype-web/client/src/pages/OwnerEntitlement.tsx -> @micro-domain/owner-entitlement/index.js",
];

/** R3: حواف القيمة المسجلة من التطبيق إلى العرض (STR-203). */
/** R3: حواف القيمة من التطبيق إلى العرض — **صفر بعد Wave B (ADR-011 §2،
 * 2026-10-03):** استُخرجت مفردات التنسيق/التسميات/عرض الاتفاق النقية إلى
 * بيوت تطبيقية (@/application/formatting/formatters، activity/activityLabels،
 * agreements/agreementPresentation) وواجهة العرض صارت تعيد التصدير (الاتجاه
 * الصحيح). أي حافة جديدة تطبيق→عرض يرفضها الحارس من جديد. */
export const APPLICATION_TO_PRESENTATION_VALUE_BASELINE = [];

/** الفحص الكامل: يعيد الخروق الجديدة والإحصاءات. */
export function checkModuleBoundaries(repoRoot, imports) {
  const all = imports ?? collectAllImports(repoRoot);
  const violations = [];
  const deepDomain = new Set(DEEP_DOMAIN_IMPORT_BASELINE);
  const uiToDomain = new Set(UI_TO_DOMAIN_VALUE_BASELINE);
  const appToPresentation = new Set(APPLICATION_TO_PRESENTATION_VALUE_BASELINE);
  const stats = {
    files: new Set(all.map(i => i.file)).size,
    deepDomain: 0,
    uiToDomain: 0,
    appToPresentation: 0,
  };

  for (const imp of all) {
    /* R1: عميق داخل المجال من خارج طبقة المجال (قيمة أو نوع — كلاهما مقيد). */
    const deepMatch = imp.specifier.match(/^@micro-domain\/([a-z-]+)\/(.+)$/);
    if (deepMatch && deepMatch[2] !== "index.js" && imp.layer !== "domain") {
      stats.deepDomain += 1;
      const key = `${imp.file} -> ${imp.specifier}`;
      if (!deepDomain.has(key)) {
        violations.push({
          rule: "R1-deep-domain-import",
          key,
          hint: "استيراد عميق جديد داخل المجال من خارجه — استورد من برميل المنطقة أو سجّل استثناءً موثقًا في سجل الملكية §5 وحدّث الأساس في نفس الـPR",
        });
      }
    }
    /* R2: قيمة مباشرة من الواجهة إلى المجال (STR-106 — قرار مالك معلق). */
    if (UI_LAYERS.has(imp.layer) && imp.kind === "value" && imp.resolved?.startsWith("src/domain/")) {
      stats.uiToDomain += 1;
      const key = `${imp.file} -> ${imp.specifier}`;
      if (!uiToDomain.has(key)) {
        violations.push({
          rule: "R2-ui-to-domain-value",
          key,
          hint: "حافة قيمة جديدة من الواجهة إلى المجال (STR-106 — سياسة معلقة على قرار المالك): مرّرها عبر خدمة تطبيق أو استورد نوعًا فقط، أو سجّل القرار وحدّث الأساس",
        });
      }
    }
    /* R3: قيمة من التطبيق إلى العرض (STR-203 — قرار مالك معلق). */
    if (
      imp.layer === "application" &&
      imp.kind === "value" &&
      imp.resolved?.startsWith("apps/prototype-web/client/src/presentation/")
    ) {
      stats.appToPresentation += 1;
      const specifier = imp.specifier.replace(/\.(ts|tsx|js)$/, "");
      const key = `${imp.file} -> ${specifier}`;
      if (!appToPresentation.has(key)) {
        violations.push({
          rule: "R3-application-to-presentation-value",
          key,
          hint: "حافة قيمة جديدة من التطبيق إلى العرض (STR-203 — قرار مالك معلق): سجّل القرار/الاستثناء وحدّث الأساس في نفس الـPR",
        });
      }
    }
  }
  return { ok: violations.length === 0, violations, stats };
}

/* ─── CLI ─────────────────────────────────────────────────────────────────── */
function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  if (!fs.existsSync(path.join(repoRoot, "package.json"))) {
    console.error("module-boundaries: USAGE: node scripts/check-module-boundaries.mjs [repoRoot]");
    process.exit(2);
  }
  const { ok, violations, stats } = checkModuleBoundaries(repoRoot);
  if (!ok) {
    console.error(`module-boundaries: FAIL — ${violations.length} خرقًا جديدًا فوق الأساس المقبول:`);
    for (const v of violations) {
      console.error(`  [${v.rule}] ${v.key}`);
      console.error(`    ${v.hint}`);
    }
    process.exit(1);
  }
  console.log(
    `module-boundaries: PASS — ${stats.files} ملف إنتاج؛ الأساس المقبول: ${stats.deepDomain} استيرادًا عميقًا داخل المجال، ${stats.uiToDomain} حافة واجهة→مجال، ${stats.appToPresentation} حافة تطبيق→عرض؛ صفر زيادة صامتة (ratchet — Wave 4E/RC-9)`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
