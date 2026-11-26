#!/usr/bin/env node
/**
 * Wave 4E (ARCH-002/WS-212 — بطاقة RC-9): مراقب الحدود القائم على الفَلْحة
 * (resolution-based) — يفحص حدود الوحدات عبر تحليل AST وحل الاستيرادات إلى
 * ملفات حقيقية، لا بمطابقة نصية.
 *
 * القواعد (راتشة — CI يرفض الجديد فقط؛ الأساس المقبول مضمّن) — *(تصحيح مؤرخ
 * 2026-10-07 — R1/TG-03 [R1-D2]: كان العنوان «القواعد الخمس» والكود أكثر)*:
 *  R1) استيراد عميق داخل المجال من خارج طبقة المجال
 *      (`@micro-domain/<area>/<غير-index>`): مقصور على الأزواج المسجلة في سجل
 *      الملكية §5 (D-034/STR-205)؛ نمط المنطقة `[a-z0-9-]+` (إصلاح Wave H —
 *      STR-617 بند 8: كان g5 كامنًا؛ القياس الحي بعده: 3 حواف، صفر g5).
 *  R2) حافة قيمة مباشرة من واجهة المستخدم إلى المجال (STR-106 — قرار مالك
 *      معلق): مجمدة على الأساس المسجل؛ أي حافة جديدة تُرفض حتى قرار المالك؛
 *      presentation/* داخل UI_LAYERS (Wave H — STR-617 بند 4).
 *  R3) حافة قيمة من التطبيق إلى العرض (STR-203 — قرار مالك معلق): مجمدة —
 *      **صفر بعد Wave B (ADR-011 §2، 2026-10-03)**؛ أي حافة جديدة تُرفض.
 *  R4) استيراد عميق عابر للمناطق داخل المجال نفسه (STR-617 بند 2 — كان بلا
 *      قاعدة): مجمد على الأزواج الثلاث الموثقة في سجل الملكية §5؛ الجديد يُرفض.
 *  R5) حافة قيمة من واجهة المستخدم إلى تخزين زمن التشغيل حلًّا resolution-based
 *      (STR-617 بند 3 — مكمل ESLint النصي؛ لا إفلات بمسار نسبي): الاستثناءان
 *      الموثقان (StartupGate، PrototypeServicesContext — بشروط إزالة مسار UI).
 *  R6) استيراد عميق من طبقات الواجهة إلى دواخل بيوت التطبيق
 *      (`application/<house>/<non-index>`) — راتشة STR-615 الشاملة (برنامج
 *      تصحيح PR #316، الخطوة ٦، 2026-10-06): خط الأساس ملف مسجل
 *      `scripts/ui-application-import-baseline.json` ينكمش رتيبًا مع هجرة
 *      الأبواب؛ صف أساس غادر الشجرة يُرفض (نظافة نفس-PR). طبقات الفحص:
 *      ui/app-shell/contexts/lib/presentation + pwa (register.ts يستهلك
 *      خدمات التطبيق). **(R5/S1، 2026-10-09):** المحدّد النوعي
 *      `import("…").X` وامتداد المسح `.js/.jsx` صارا يُسجلان (سلبيات مثبتة).
 *  R7) استيراد من مكوّنات الواجهة إلى صفحاتها (components/** -> pages/**)
 *      — فئة الانحدار المباشرة لدورة المالية (R8-F-019، 2026-10-10): الحافة
 *      النوعية السابقة فُكّت في R7-1 (financeState — STR-204c)؛ القاعدة تمنع
 *      عودة الصنف كله بأي شكل (قيمة/نوع/ديناميكي/ImportTypeNode/إعادة تصدير)
 *      وحلًّا للمسارات؛ الاتجاه المعاكس حر؛ الاستثناء قائمة مالك صريحة
 *      (فارغة عند التأسيس) — لا أساس انجراري مفتوح.
 *  R8) حافة نوعية من طبقات الواجهة إلى التخزين (R11 W1A-1 / D-01 —
 *      R10A-F-006، قرار OD-GUARD الخيار A، 2026-10-13): أساس كامل مسجل
 *      (الـ17 التاريخية + ملفا app-shell + الموثقة لاحقًا؛ النمط مصرَّح به في
 *      ESLint)؛ النمو الصامت والانكماش غير الموثق يُرفضان (نظافة نفس-الـPR)؛
 *      العدّ بحل الاستيرادات (المختلط = قيمة) ويشمل `import type` وكل
 *      المحددات النوعية و`import("…")` و`export type … from` وصيغة
 *      `import x = require("…")` — جمع ImportEqualsDeclaration فلا إفلات
 *      بتغيير إملاء.
 *  R9) راتشة أزواج بيوت التطبيق الداخلية (R11 W1A-1 / D-07 — R10B-NF-005،
 *      قرار OD-10 الخيار A، 2026-10-13): جرد كامل مسجل بملف
 *      `scripts/application-house-edges-census.json` (تصنيف مهيمن-النوع؛
 *      الأبواب وملفات الجذر مشتركة بالتعريف). الإعفاءات الورقية المعتمدة:
 *      time/clock.ts وformatting/formatters.ts وidentity/buildIdentity.ts
 *      + ملف الجذر resultCodes.ts (قانوني بالتعريف). الفشول: زوج جديد،
 *      تجاوز سقف زوج (قيمة/نوع منفصلين)، حافة أساس غادرت الشجرة، انجراف
 *      جرد على هدف معفي، خرق ثوابت الإعفاء (إلغاء تلقائي معلن)، ودورة
 *      بيوت جديدة أو محلولة بلا إعادة إرساء. الأساس يُحدّث عمدًا في
 *      نفس الـPR فقط.
 *  R10/R11 (M1.6 — manage-v2 phase 1، §14.1–14.3/D-5، 2026-11-26): حدود مانج
 *      جاهزة قبل وجود كودها — R10: لا ملف تحت client/src يستورد
 *      `src/domain/manage` ولا `apps/prototype-web/worker/application/manage`
 *      (قيمة/نوع/ديناميكي؛ بلا أساس ولا استثناءات)؛ R11: مجال مانج يستورد
 *      شجرته و`src/domain/shared` حصرًا — أي هدف داخلي آخر يُرفض. الكشف بتحويل
 *      افتراضي للمحدد (بلا اشتراط وجود الملف) فلا إفلات بتغيير الإملاءة.
 * تحديث الأساس عمدًا مشروط: أي حافة جديدة مشروعة تُضاف إلى الأساس في نفس
 * الـPR مع صف/تحديث في سجل الملكية §5 — الحارس يجعل الزيادة مرئية لا
 * مستحيلة، ويمنعها الصامتة فحسب.
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

/* Wave H (STR-617 بند 4): presentation ضُمّت — حواف عرض→مجال تحت تجميد R2. */
const UI_LAYERS = new Set(["ui", "app-shell", "contexts", "lib", "presentation"]);

/* ─── R6 (الخطوة ٦ — STR-615): طبقات حدود بيوت التطبيق = UI_LAYERS + pwa. ── */
const R6_LAYERS = new Set([...UI_LAYERS, "pwa"]);

const APPLICATION_INTERIOR_PREFIX = "apps/prototype-web/client/src/application/";

/* ─── R10/R11 (M1.6 — manage-v2 phase 1، §14.1–14.3/D-5، 2026-11-26) ────
 * مسارات مانج قد لا توجد بعد — التحويل الافتراضي (بلا اشتراط وجود الملف)
 * يجعلهما جاهزتين قبل ولادة كود مانج بلا تضعيف أي قاعدة قائمة. */
const MANAGE_DOMAIN_PREFIX = "src/domain/manage";
const MANAGE_WORKER_APPLICATION_PREFIX = "apps/prototype-web/worker/application/manage";
const CLIENT_SRC_PREFIX = "apps/prototype-web/client/src";

const isUnderPrefix = (rel, prefix) => rel === prefix || rel.startsWith(`${prefix}/`);

/** M1.6: المسار الافتراضي للمحدد داخل المستودع (مستعار/نسبي، بلا اشتراط
 * وجود الملف)؛ المحدد الخارجي يعيد null — شأن ناشره (مبدأ الحارس نفسه). */
export function virtualImportTarget(specifier, fromFile, repoRoot) {
  const stripExt = p => p.replace(/\.(js|mjs|cjs|jsx)$/, "");
  if (specifier.startsWith("@micro-domain/")) {
    return stripExt(path.posix.join("src/domain", specifier.slice("@micro-domain/".length)));
  }
  if (specifier.startsWith("@/") && !specifier.startsWith("@micro-domain/")) {
    return stripExt(path.posix.join(CLIENT_SRC_PREFIX, specifier.slice(2)));
  }
  if (specifier.startsWith(".")) {
    const resolved = path.resolve(path.dirname(fromFile), specifier);
    return stripExt(path.relative(repoRoot, resolved).split(path.sep).join("/"));
  }
  return null;
}

/** أساس R6: ملف JSON مسجل — غيابه = قائمة فارغة (لا يفلت شيء بوجوده أو غيابه). */
export function loadUiApplicationImportBaseline(repoRoot) {
  const baselinePath = path.join(repoRoot, "scripts", "ui-application-import-baseline.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    return Array.isArray(parsed?.allowed) ? new Set(parsed.allowed) : new Set();
  } catch {
    return new Set();
  }
}

/** هل الاستيراد داخل دواخل بيت تطبيقي (لا بابًا ولا ملف جذر تطبيقي)؟ */
export function applicationInteriorOf(resolved) {
  if (!resolved?.startsWith(APPLICATION_INTERIOR_PREFIX)) return null;
  const parts = resolved.slice(APPLICATION_INTERIOR_PREFIX.length).split("/");
  if (parts.length < 2) return null; /* ملف جذر تطبيقي — ليس دواخل بيت */
  if (parts[parts.length - 1] === "index.ts") return null; /* باب البيت */
  return parts[0];
}

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
      if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
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
      } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
        /* Wave H: تصدير-من النوعي (`export type {X} from ...`) صار حافة نوع
         * مرئية للقواعد (كان محذوفًا) — يغذي R4 بمصداقية ولا يمس R2/R3
         * (قيمتان فقط) ولا R1 (قياس حي: صفر حواف من النوع خارج المجال). */
        push(statement.moduleSpecifier.text, !statement.isTypeOnly, false);
      } else if (ts.isImportEqualsDeclaration(statement)) {
        /* R11 W1A-1 (D-01، 2026-10-14): صيغة `import x = require("…")` (و
         * النوعية `import type x = require("…")`) كانت خارج الجمع كله —
         * تهرّب من كل القواعد بتغيير الإملاء فقط. الإضافة تراكمية: صفر
         * مواقع حية عند التأسيس (قياس مباشر عند 5ef4ce08) فلا سلوك يتغير
         * للقواعد القائمة، والصيغة تصير مقودة تحت R8/R9 كسائر الأشكال. */
        const moduleReference = statement.moduleReference;
        if (ts.isExternalModuleReference(moduleReference) && ts.isStringLiteral(moduleReference.expression)) {
          push(moduleReference.expression.text, !statement.isTypeOnly, false);
        }
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
      /* R5/S1 (2026-10-09): الموضع النوعي `import("…").X` — المحدّد داخل
       * LiteralTypeNode لا StringLiteral مباشرة؛ يُسجّل نوعًا ديناميكيًا
       * فتُحسب القواعد المسارية (R1/R4/R6) وحدها ولا تدخل قواعد القيمة. */
      if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal)
      ) {
        push(node.argument.literal.text, false, true);
      }
      ts.forEachChild(node, visitDynamic);
    };
    visitDynamic(sourceFile);
  }
  return imports;
}

/* ─── الأساس المقبول (ratchet baseline) ────────────────────────────────────
 * مصدر الأساس: القياس الحي عند Wave 4E (سجل الجرد v1.2) مطابقًا لسجل الملكية
 * §5؛ التحديث عمدًا بنفس الـPR مع صف السجل. */

/** R1: الاستيرادات العميقة المسجلة داخل المجال من خارجه (كلها ديناميكية
 * موثقة — Wave F/ADR-013 نقلت حافتين حرفيًا لبيوت شقيقة بنفس الـPR). */
export const DEEP_DOMAIN_IMPORT_BASELINE = [
  /* S04 (DOC-013، 2026-10-28): نفس علة D-034 — إرساء بنفس الـPR. */
  "apps/prototype-web/client/src/application/cash/cashCountService.ts -> @micro-domain/cash-continuity/observationPolicy.js",
  "apps/prototype-web/client/src/application/finance/integrityCheckSettlementBasis.ts -> @micro-domain/craft-order/settlementInvariant.js",
  "apps/prototype-web/client/src/application/finance/projectFinancialInsights.ts -> @micro-domain/financial-analysis/operatingBreakEven.js",
  "apps/prototype-web/client/src/application/financial-analysis/financialAnalysisService.ts -> @micro-domain/financial-analysis/operatingBreakEven.js",
];

/** R2: حواف القيمة المباشرة المسجلة من الواجهة إلى المجال (STR-106) —
 * presentation ضُمّت لـUI_LAYERS في Wave H (STR-617 بند 4). */
export const UI_TO_DOMAIN_VALUE_BASELINE = [
  /* R10-B4/F-021 (2026-10-12): اشتقاقات دومين صرف تُستهلك للعرض
   * (previewSupplierPurchase*، *DepositMinorOf…) — تسجيل بنفس الـPR. */
  "apps/prototype-web/client/src/components/orders/OrderDepositPanels.tsx -> @micro-domain/craft-order/index.js",
  "apps/prototype-web/client/src/pages/SupplierPurchaseEditor.tsx -> @micro-domain/supplier-purchase/index.js",
  "apps/prototype-web/client/src/components/finance/AllocationReviewCard.tsx -> @micro-domain/financial-event/index.js",
  "apps/prototype-web/client/src/components/finance/ExpenseBudgetsSectionBody.tsx -> @micro-domain/shared/index.js",
  "apps/prototype-web/client/src/components/finance/quickFormHelpers.ts -> @micro-domain/cash-continuity/index.js",
  "apps/prototype-web/client/src/components/presentation/EventEffectPreview.tsx -> @micro-domain/financial-event/index.js",
  "apps/prototype-web/client/src/pages/AssetDetail.tsx -> @micro-domain/asset/index.js",
  "apps/prototype-web/client/src/pages/Catalog.tsx -> @micro-domain/recurring-margin/index.js",
  "apps/prototype-web/client/src/pages/CostEditor.tsx -> @micro-domain/craft-order/index.js",
  "apps/prototype-web/client/src/pages/DirectSaleEditor.tsx -> @micro-domain/direct-sale/index.js",
  "apps/prototype-web/client/src/pages/InventoryMaterials.tsx -> @micro-domain/shared/index.js",
  "apps/prototype-web/client/src/pages/OrderDetail.tsx -> @micro-domain/craft-order/index.js",
  "apps/prototype-web/client/src/pages/OrderDetail.tsx -> @micro-domain/shared/index.js",
  "apps/prototype-web/client/src/pages/OwnerEntitlement.tsx -> @micro-domain/owner-entitlement/index.js",
  "apps/prototype-web/client/src/presentation/catalogPresentation.ts -> @micro-domain/recurring-margin/index.js",
  "apps/prototype-web/client/src/presentation/ownerEntitlementPresentation.ts -> @micro-domain/owner-entitlement/index.js",
];

/** R3: حواف القيمة من التطبيق إلى العرض (STR-203) — **صفر بعد Wave B
 * (ADR-011 §2):** استُخرجت مفردات العرض النقية إلى بيوت تطبيقية وواجهة
 * العرض تعيد التصدير؛ أي حافة جديدة تُرفض. */
export const APPLICATION_TO_PRESENTATION_VALUE_BASELINE = [];

/** R4 (Wave H — STR-617 بند 2): الأزواج العميقة المسجلة العابرة للمناطق
 * داخل المجال نفسه (الأزواج الثلاثة الموثقة في سجل الملكية §5 — STR-030). */
export const DOMAIN_CROSS_AREA_DEEP_BASELINE = [
  "src/domain/recurring-expense/policies.ts -> ../financial-event/types.js",
  "src/domain/recurring-margin/policies.ts -> ../inventory-material/policies.js",
  "src/domain/recurring-margin/types.ts -> ../inventory-material/types.js",
];

/** R5 (Wave H — STR-617 بند 3): حافتا القيمة الموثقتان من واجهة المستخدم
 * إلى تخزين زمن التشغيل — الاستثناءان المقيدان بشروط إزالة مسار UI. */
export const UI_TO_STORAGE_VALUE_BASELINE = [
  "apps/prototype-web/client/src/app/PrototypeServicesContext.tsx -> @/storage/local/createBrowserLocalStore",
  "apps/prototype-web/client/src/app/StartupGate.tsx -> @/storage/local/persistentStorage",
];

/** R7 (R8-F-019): استثناءات مكوّن->صفحة الموثقة بقرار مالك — فارغة عند
 * التأسيس؛ أي إضافة تتطلب صف سجل ملكية ومرجع قرار، لا أساس انجراري. */
export const COMPONENT_TO_PAGE_BASELINE = [];

/** R8 (R11 W1A-1 / D-01 — OD-GUARD الخيار A): الأساس الكامل لحواف النوع
 * فقط من طبقات الواجهة إلى التخزين — قياس حي عند 5ef4ce08 (صفحات +
 * مكوّنات + ملفا app-shell؛ النمط مصرَّح به في ESLint)؛ الراتشة تمنع
 * النمو الصامت والانكماش غير الموثق فحسب. */
export const UI_TO_STORAGE_TYPE_BASELINE = [
  "apps/prototype-web/client/src/app/PrototypeServicesContext.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/app/StartupGate.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/components/cost/MaterialSheet.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/components/forms/useFormDraft.ts -> @/storage/local/types",
  "apps/prototype-web/client/src/components/order/AgreementContextPanel.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/components/settings/SettingsDataProtectionSection.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/components/settings/SettingsOperatingModeSection.tsx -> @/storage/local/types",
  /* S03/DOC-012 (2026-10-28، نفس-الـPR): +1 موثقة — قسم بيانات المشروع
   * يستورد نوع ActivityProfile الكنوني وحده؛ الصف في سجل الملكية §5. */
  "apps/prototype-web/client/src/components/settings/SettingsProjectDataSection.tsx -> @/storage/local/types",
  /* EX-D23 M6 (DOC-040، 2026-11-14، نفس-الالتزام): +1 موثقة — حارس الوضع
   * المتصل-فقط يستورد نوع PrototypeLocalStore وحده (تغليف بوكيل الحارس). */
  "apps/prototype-web/client/src/app/manageOnlineGuard.ts -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/AgreementEditor.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/CostCalculator.tsx -> @/storage/local/types",
  /* S10 (UNIT-030/031/032 — أمر b56967d8/DOC-019، نفس-الـPR): +4 موثقة —
   * أسطح التخطيط تستورد الأنواع وحدها (القيم عبر الخدمات). */
  "apps/prototype-web/client/src/components/planning/LegacyEstimateEditor.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/components/planning/PlanningGroupEditor.tsx -> @/storage/local/planningCalculationTypes",
  "apps/prototype-web/client/src/components/planning/SavedCalculations.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/CostCalculator.tsx -> @/storage/local/planningCalculationTypes",
  "apps/prototype-web/client/src/pages/CostEditor.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/DraftEditor.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/Finance.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/NewDraft.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/OrderDetail.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/Orders.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/ScheduleEditor.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/Settings.tsx -> @/storage/local/types",
];

/** R8 — المجموعة التاريخية الـ17 (إحصاء RV1/R10-A: صفحات/مكوّنات فقط) —
 * تُحفظ للمقارنة التاريخية المسماة لا كأساس تنفيذي؛ الاختبار يتحقق
 * أنها مجموعة جزئية صارمة من الأساس الكامل. */
export const UI_TO_STORAGE_TYPE_BASELINE_HISTORICAL_17 = [
  "apps/prototype-web/client/src/components/cost/MaterialSheet.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/components/forms/useFormDraft.ts -> @/storage/local/types",
  "apps/prototype-web/client/src/components/order/AgreementContextPanel.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/components/settings/SettingsDataProtectionSection.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/components/settings/SettingsOperatingModeSection.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/AgreementEditor.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/CostCalculator.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/CostEditor.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/DraftEditor.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/EstimateDetail.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/Finance.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/NewDraft.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/OrderDetail.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/Orders.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/ScheduleEditor.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/Settings.tsx -> @/storage/local/types",
  "apps/prototype-web/client/src/pages/Tools.tsx -> @/storage/local/types",
];

/* ─── R9 (R11 W1A-1 / D-07 — OD-10 Option A) ───────────────────────────────
 * جرد أزواج البيوت: تحميل فاشل-مغلق + جمع حي مهيمن-النوع + ثوابت الإعفاء
 * + دورات البيوت. كل رقم يقارن بالجرد المسجل لا بعد مجرد. */

export const HOUSE_EDGES_CENSUS_PATH = path.join("scripts", "application-house-edges-census.json");
export const HOUSE_EDGES_CENSUS_SCHEMA = "micro-application-house-edges-census/1";
const APPLICATION_PREFIX = "apps/prototype-web/client/src/application/";
const WRITE_VOCABULARY_EXPORT = /^(save|commit|delete|replace|clear)[A-Z]/;

/** تحميل الجرد — فشل مغلق: غياب/تلف/إصدار غير معروف يعيد خرقًا لا تمريرًا. */
export function loadHouseEdgesCensus(repoRoot) {
  const censusPath = path.join(repoRoot, HOUSE_EDGES_CENSUS_PATH);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(censusPath, "utf8"));
  } catch (error) {
    return { error: `CENSUS_INVALID — ${path.relative(repoRoot, censusPath)}: ${error.message}` };
  }
  if (parsed?.schema !== HOUSE_EDGES_CENSUS_SCHEMA) {
    return { error: `CENSUS_INVALID — schema ${JSON.stringify(parsed?.schema)} is not ${HOUSE_EDGES_CENSUS_SCHEMA}` };
  }
  return { census: parsed };
}

/** جمع الحواف الحية: مواقع -> حواف فريدة (ملف -> هدف) بتصنيف مهيمن-النوع. */
export function collectHouseEdges(all) {
  const sites = new Map();
  for (const imp of all) {
    if (imp.layer !== "application" || !imp.resolved?.startsWith(APPLICATION_PREFIX)) continue;
    const targetRel = imp.resolved.slice(APPLICATION_PREFIX.length);
    const targetParts = targetRel.split("/");
    if (targetParts.length < 2) continue; /* ملف جذر — هدف قانوني بالتعريف */
    if (targetParts[targetParts.length - 1] === "index.ts") continue; /* باب البيت */
    const fileRel = imp.file.replace(/^apps\/prototype-web\/client\/src\/application\//, "");
    const fileParts = fileRel.split("/");
    if (fileParts.length < 2) continue; /* مصدر جذر — طبقة مشتركة بالتعريف */
    const sourceHouse = fileParts[0];
    const targetHouse = targetParts[0];
    if (sourceHouse === targetHouse) continue;
    const key = `application/${fileRel} -> application/${targetRel}`;
    if (!sites.has(key)) sites.set(key, { value: 0, type: 0, sourceHouse, targetHouse });
    sites.get(key)[imp.kind === "value" ? "value" : "type"]++;
  }
  return [...sites.entries()]
    .map(([key, s]) => ({ key, kind: s.type > 0 ? "type" : "value", sourceHouse: s.sourceHouse, targetHouse: s.targetHouse }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** دورات البيوت (تارجان) على حواف نوع واحد — يعيد مجموعات مرتبة. */
export function houseSccs(edges, kind) {
  const graph = new Map();
  for (const edge of edges) {
    if (edge.kind !== kind) continue;
    if (!graph.has(edge.sourceHouse)) graph.set(edge.sourceHouse, new Set());
    graph.get(edge.sourceHouse).add(edge.targetHouse);
  }
  const index = new Map(), low = new Map(), onStack = new Set(), stack = [], out = [];
  let counter = 0;
  const nodes = new Set([...graph.keys(), ...[...graph.values()].flatMap(set => [...set])]);
  const strongconnect = v => {
    index.set(v, counter); low.set(v, counter); counter++;
    stack.push(v); onStack.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!index.has(w)) { strongconnect(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
    }
    if (low.get(v) === index.get(v)) {
      const component = []; let w;
      do { w = stack.pop(); onStack.delete(w); component.push(w); } while (w !== v);
      if (component.length > 1) out.push(component.sort());
    }
  };
  for (const v of nodes) if (!index.has(v)) strongconnect(v);
  return out.sort();
}

/** ثوابت الإعفاء لكل وحدة معفاة — أي خرق = إلغاء معلن (فشل الحارس). */
export function checkExemptModuleInvariants(repoRoot, moduleEntry, liveEdges) {
  const violations = [];
  const relToClientSrc = moduleEntry.path; /* "application/..." */
  const full = path.join(repoRoot, "apps", "prototype-web", "client", "src", relToClientSrc);
  if (!fs.existsSync(full)) {
    return [{ rule: "R9-exemption-violation", key: `${relToClientSrc}: MODULE_MISSING`, hint: "وحدة معفاة غادرت الشجرة — حدّث الجرد والقرار في نفس الـPR" }];
  }
  const content = fs.readFileSync(full, "utf8");
  const kind = full.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(full, content, ts.ScriptTarget.Latest, true, kind);
  /* (i) قائمة الاستيرادات == القائمة المثبتة حرفيًا */
  const imports = [];
  let hasMutableState = false;
  let illegalTopLevel = null;
  const exportedNames = [];
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      imports.push(statement.moduleSpecifier.text);
    } else if (ts.isVariableStatement(statement)) {
      if (statement.declarationList.flags & (ts.NodeFlags.Let | ts.NodeFlags.Var)) hasMutableState = true;
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) exportedNames.push(declaration.name.text);
      }
    } else if (
      !ts.isExportDeclaration(statement) && !ts.isFunctionDeclaration(statement) &&
      !ts.isClassDeclaration(statement) && !ts.isInterfaceDeclaration(statement) &&
      !ts.isTypeAliasDeclaration(statement) && !ts.isEnumDeclaration(statement) &&
      !ts.isImportEqualsDeclaration(statement) && !ts.isExportAssignment(statement)
    ) {
      illegalTopLevel = ts.SyntaxKind[statement.kind];
    }
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isVariableStatement(statement))) {
      const hasExport = statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
      if (hasExport) {
        if (ts.isFunctionDeclaration(statement) && statement.name) exportedNames.push(statement.name.text);
        if (ts.isClassDeclaration(statement) && statement.name) exportedNames.push(statement.name.text);
      }
    }
  }
  const allowlist = [...moduleEntry.importAllowlist].sort();
  const importsSorted = [...imports].sort();
  if (JSON.stringify(importsSorted) !== JSON.stringify(allowlist)) {
    violations.push({
      rule: "R9-exemption-violation",
      key: `${relToClientSrc}: IMPORT_ALLOWLIST_DRIFT`,
      hint: `استيرادات الوحدة المعفاة (${importsSorted.join(", ") || "لا شيء"}) لا تطابق القائمة المثبتة (${allowlist.join(", ") || "لا شيء"}) — الإعفاء مشروط بثوابت OD-10؛ أصلح أو أعِد الإرساء بقرار`,
    });
  }
  if (hasMutableState) {
    violations.push({ rule: "R9-exemption-violation", key: `${relToClientSrc}: MUTABLE_MODULE_STATE`, hint: "حالة وحدة قابلة للتغيير (let/var) تكسر ثابت النقاء التركيبي للإعفاء (OD-10)" });
  }
  if (illegalTopLevel !== null) {
    violations.push({ rule: "R9-exemption-violation", key: `${relToClientSrc}: TOP_LEVEL_SIDE_EFFECT (${illegalTopLevel})`, hint: "عبارة عليا غير تصريحية في وحدة معفاة — أثر استيراد محتمل يكسر ثابت OD-10" });
  }
  const writeExport = exportedNames.find(name => WRITE_VOCABULARY_EXPORT.test(name));
  if (writeExport !== undefined) {
    violations.push({ rule: "R9-exemption-violation", key: `${relToClientSrc}: POLICY_EXPORT (${writeExport})`, hint: "تصدير بمفردة كتابة من وحدة معفاة — الإعفاء لمفردات نقية لا سياسات ميزات (OD-10)" });
  }
  /* (v) صفر حواف خارجة عابرة للبيوت من الوحدة المعفاة */
  const outgoing = liveEdges.filter(edge => edge.key.startsWith(`${relToClientSrc} -> `));
  if (outgoing.length > 0) {
    violations.push({ rule: "R9-exemption-violation", key: `${relToClientSrc}: OUTGOING_CROSS_HOUSE (${outgoing.length})`, hint: `حواف خارجة من وحدة معفاة: ${outgoing.map(e => e.key.split(" -> ")[1]).join(", ")} — الإعفاء ورقي مشروط (OD-10)` });
  }
  return violations;
}

/** الفحص الكامل: يعيد الخروق الجديدة والإحصاءات. */
export function checkModuleBoundaries(repoRoot, imports) {
  const all = imports ?? collectAllImports(repoRoot);
  const violations = [];
  const deepDomain = new Set(DEEP_DOMAIN_IMPORT_BASELINE);
  const uiToDomain = new Set(UI_TO_DOMAIN_VALUE_BASELINE);
  const appToPresentation = new Set(APPLICATION_TO_PRESENTATION_VALUE_BASELINE);
  const domainCrossArea = new Set(DOMAIN_CROSS_AREA_DEEP_BASELINE);
  const uiToStorage = new Set(UI_TO_STORAGE_VALUE_BASELINE);
  const r6Allowed = loadUiApplicationImportBaseline(repoRoot);
  const r6Seen = new Set();
  const componentToPage = new Set(COMPONENT_TO_PAGE_BASELINE);
  const uiToStorageType = new Set(UI_TO_STORAGE_TYPE_BASELINE);
  const r8Seen = new Set();
  const stats = {
    files: new Set(all.map(i => i.file)).size,
    deepDomain: 0,
    uiToDomain: 0,
    appToPresentation: 0,
    domainCrossArea: 0,
    uiToStorage: 0,
    uiToApplicationDeep: 0,
    componentToPage: 0,
    uiToStorageType: 0,
    houseEdges: 0,
    houseEdgesValue: 0,
    houseEdgesType: 0,
    clientToManage: 0,
    manageDomainForeign: 0,
  };
  const domainArea = f => (f.match(/src\/domain\/([^/]+)\//) || [])[1] ?? null;

  for (const imp of all) {
    /* R1: عميق داخل المجال من خارج طبقة المجال (قيمة أو نوع — كلاهما مقيد).
     * نمط المنطقة [a-z0-9-]+ (إصلاح Wave H — كان g5 كامنًا خارج المطابقة). */
    const deepMatch = imp.specifier.match(/^@micro-domain\/([a-z0-9-]+)\/(.+)$/);
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
    /* R4 (Wave H — STR-617 بند 2): عميق عابر للمناطق داخل المجال نفسه. */
    if (imp.layer === "domain" && imp.resolved?.startsWith("src/domain/")) {
      const fromArea = domainArea(imp.file);
      const toArea = domainArea(imp.resolved);
      const isBarrel = /\/index\.[tj]s$/.test(imp.resolved);
      if (fromArea && toArea && fromArea !== toArea && !isBarrel) {
        stats.domainCrossArea += 1;
        const key = `${imp.file} -> ${imp.specifier}`;
        if (!domainCrossArea.has(key)) {
          violations.push({
            rule: "R4-domain-cross-area-deep",
            key,
            hint: "استيراد عميق جديد عابر لمناطق المجال (كان بلا قاعدة — STR-617): استورد من برميل المنطقة الأخرى، أو سجّل الاستثناء في سجل الملكية §5 وحدّث الأساس في نفس الـPR",
          });
        }
      }
    }
    /* R5 (Wave H — STR-617 بند 3): قيمة واجهة→تخزين زمن التشغيل — resolution-based. */
    if (UI_LAYERS.has(imp.layer) && imp.kind === "value" && imp.resolved?.startsWith("apps/prototype-web/client/src/storage/")) {
      stats.uiToStorage += 1;
      const key = `${imp.file} -> ${imp.specifier}`;
      if (!uiToStorage.has(key)) {
        violations.push({
          rule: "R5-ui-to-storage-value",
          key,
          hint: "حافة قيمة جديدة من الواجهة إلى التخزين (resolution-based — مكمل ESLint): الوصول للبيانات عبر خدمات التطبيق والمنافذ؛ الاستثناءان الموثقان (StartupGate/PrototypeServicesContext) بشروط إزالة مسار UI",
        });
      }
    }
    /* R6 (STR-615): استيراد عميق من طبقات الواجهة إلى دواخل بيوت التطبيق
     * (قيمة أو نوع — الحد مساري)؛ الباب `application/<house>/index.ts` حصرًا. */
    if (R6_LAYERS.has(imp.layer) && applicationInteriorOf(imp.resolved) !== null) {
      stats.uiToApplicationDeep += 1;
      const key = `${imp.file} -> ${imp.resolved}`;
      if (r6Allowed.has(key)) {
        r6Seen.add(key);
      } else {
        violations.push({
          rule: "R6-ui-to-application-deep",
          key,
          hint: "استيراد عميق جديد من الواجهة إلى دواخل بيت تطبيقي (STR-615): استورد من باب البيت `@/application/<house>` أو سجّل استثناءً موثقًا وحدّث خط الأساس في نفس الـPR",
        });
      }
    }
    /* R7 (R8-F-019): مكوّن -> صفحة — فئة انحدار دورة المالية؛ التمييز بالمسار
     * الحلولي وكل أنواع الاستيراد مقبوضة؛ الاتجاه المعاكس قانوني. */
    if (
      imp.file.startsWith("apps/prototype-web/client/src/components/") &&
      imp.resolved?.startsWith("apps/prototype-web/client/src/pages/")
    ) {
      stats.componentToPage += 1;
      const key = `${imp.file} -> ${imp.resolved}`;
      if (!componentToPage.has(key)) {
        violations.push({
          rule: "R7-component-to-page",
          key,
          hint: "حافة مكوّن->صفحة ممنوعة (فئة انحدار دورة المالية R8-F-019): الصفحة تملك التركيب والمكوّن يستهلكها لا العكس؛ انقل الحالة المشتركة إلى بيت تطبيقي (نمط financeState في R7-1) أو سجّل استثناء بقرار مالك",
        });
      }
    }
    /* R8 (R11 W1A-1 / D-01): حافة نوعية واجهة→تخزين — راتشة على النمط المصرَّح
     * به؛ النمو الصامت والانكماش غير الموثق يُرفضان (نظافة نفس-الـPR). */
    if (UI_LAYERS.has(imp.layer) && imp.kind === "type" && imp.resolved?.startsWith("apps/prototype-web/client/src/storage/")) {
      stats.uiToStorageType += 1;
      const key = `${imp.file} -> ${imp.specifier}`;
      if (uiToStorageType.has(key)) {
        r8Seen.add(key);
      } else {
        violations.push({
          rule: "R8-ui-to-storage-type",
          key,
          hint: "حافة نوعية جديدة من الواجهة إلى التخزين (R10A-F-006/OD-GUARD): النمط مصرَّح به لكن نموه يحتاج تحديث أساس موثقًا في نفس الـPR مع صف سجل الملكية §5",
        });
      }
    }
    /* R10 (M1.6/§14.1–14.3/D-5): العميل لا يستورد مجال مانج ولا معالجاته
     * السيرفرية (قيمة/نوع/ديناميكي؛ بلا أساس) — الافتراضي يصطاد قبل وجود الملفات. */
    const virtualTarget = virtualImportTarget(imp.specifier, path.join(repoRoot, imp.file), repoRoot);
    if (imp.file.startsWith(`${CLIENT_SRC_PREFIX}/`) && virtualTarget !== null) {
      if (isUnderPrefix(virtualTarget, MANAGE_DOMAIN_PREFIX) || isUnderPrefix(virtualTarget, MANAGE_WORKER_APPLICATION_PREFIX)) {
        stats.clientToManage += 1;
        violations.push({
          rule: "R10-client-to-manage-import",
          key: `${imp.file} -> ${imp.specifier}`,
          hint: "استيراد من العميل إلى مجال مانج أو معالجاته السيرفرية (M1.6/§14.3/D-5): العميل API رفيع + عرض + كاش بلا أي حساب؛ أزل الحافة — لا استثناءات مسجلة",
        });
      }
    }
    /* R11 (M1.6 — §14.3): مجال مانج يستورد شجرته وsrc/domain/shared حصرًا —
     * أي هدف داخلي آخر (مجال آخر/عميل/عامل) يُرفض؛ الخارجي شأن ناشره. */
    if (
      virtualTarget !== null &&
      isUnderPrefix(imp.file, MANAGE_DOMAIN_PREFIX) &&
      !isUnderPrefix(virtualTarget, MANAGE_DOMAIN_PREFIX) &&
      !isUnderPrefix(virtualTarget, "src/domain/shared")
    ) {
      stats.manageDomainForeign += 1;
      violations.push({
        rule: "R11-manage-domain-import",
        key: `${imp.file} -> ${imp.specifier}`,
        hint: "مجال مانج يستورد هدفًا داخليًا خارج شجرته وshared (M1.6/§14.3): مانج وحدة منفصلة داخل التطبيق؛ أزل الحافة — لا استثناءات مسجلة",
      });
    }
  }
  /* R6 — نظافة الأساس: صف غادر الشجرة يُزال من الملف في نفس الـPR. */
  for (const key of r6Allowed) {
    if (!r6Seen.has(key)) {
      violations.push({
        rule: "R6-baseline-stale",
        key,
        hint: "صف أساس R6 لم يعد حيًّا في الشجرة (هاجر الموقع أو حُذف الملف) — أزل الصف من scripts/ui-application-import-baseline.json في نفس الـPR",
      });
    }
  }
  /* R9 (R11 W1A-1 / D-07 — OD-10 Option A): راتشة أزواج البيوت على الجرد الكامل — التحميل فاشل-مغلق. */
  const censusResult = loadHouseEdgesCensus(repoRoot);
  if (censusResult.error) {
    violations.push({
      rule: "R9-census-invalid",
      key: HOUSE_EDGES_CENSUS_PATH,
      hint: `جرد أزواج البيوت غير قابل للتحميل: ${censusResult.error} — أصلح الملف أو أعِد إنشاءه من القياس الحي بنفس الـPR`,
    });
  } else {
    const census = censusResult.census;
    const censusEdgeKeys = new Map(census.edges.map(edge => [edge.key, edge]));
    const exemptTargets = new Set(census.exemptModules.filter(m => m.role === "leaf").map(m => m.path));
    const liveEdges = collectHouseEdges(all);
    stats.houseEdges = liveEdges.length;
    stats.houseEdgesValue = liveEdges.filter(e => e.kind === "value").length;
    stats.houseEdgesType = liveEdges.filter(e => e.kind === "type").length;
    /* تماثل الجرد الداخلي: الإجماليات والأغلف مطابقة لقائمة الحواف نفسها. */
    const totalsEdges = census.edges.length;
    const totalsValue = census.edges.filter(e => e.kind === "value").length;
    const censusPairCaps = {};
    for (const edge of census.edges) {
      if (exemptTargets.has(edge.key.split(" -> ")[1])) continue;
      const sourceHouse = edge.key.split(" -> ")[0].split("/")[1];
      const targetHouse = edge.key.split(" -> ")[1].split("/")[1];
      const pairKey = `${sourceHouse}->${targetHouse}`;
      censusPairCaps[pairKey] = censusPairCaps[pairKey] || { value: 0, type: 0 };
      censusPairCaps[pairKey][edge.kind]++;
    }
    if (
      census.totals?.edges !== totalsEdges ||
      census.totals?.value !== totalsValue ||
      census.totals?.type !== census.edges.length - totalsValue ||
      census.totals?.governedEdges !== totalsEdges - census.edges.filter(e => exemptTargets.has(e.key.split(" -> ")[1])).length ||
      census.totals?.governedPairs !== Object.keys(censusPairCaps).length ||
      JSON.stringify(census.pairCaps) !== JSON.stringify(censusPairCaps)
    ) {
      violations.push({
        rule: "R9-census-inconsistent",
        key: HOUSE_EDGES_CENSUS_PATH,
        hint: "جرد أزواج البيوت غير متسق داخليًا (الإجماليات/الأغلف لا تطابق قائمة الحواف) — أعِد توليده من القياس الحي",
      });
    }
    const livePairCounts = {};
    for (const edge of liveEdges) {
      const target = edge.key.split(" -> ")[1];
      const inCensus = censusEdgeKeys.get(edge.key);
      if (exemptTargets.has(target)) {
        if (inCensus === undefined) {
          /* هدف معفى: الوصول by-design مسموح — لكن الجرد يجب أن يبقى كاملًا ودقيقًا: ليس بصمتك. */
          violations.push({
            rule: "R9-census-drift",
            key: edge.key,
            hint: "حافة جديدة على هدف معفى ورقي (OD-10): الوصول مسموح بتصميم لكن أضف صف الحافة إلى الجرد في نفس الـPR — النمو مرئي لا صامت",
          });
        } else if (inCensus.kind !== edge.kind) {
          violations.push({
            rule: "R9-census-drift",
            key: `${edge.key} [${edge.kind} != ${inCensus.kind}]`,
            hint: "تغير تصنيف حافة قائمة في الجرد — أعِد الإرساء في نفس الـPR",
          });
        }
        continue;
      }
      const pairKey = `${edge.sourceHouse}->${edge.targetHouse}`;
      livePairCounts[pairKey] = livePairCounts[pairKey] || { value: 0, type: 0 };
      livePairCounts[pairKey][edge.kind]++;
      if (inCensus === undefined) {
        violations.push({
          rule: census.pairCaps[pairKey] === undefined ? "R9-new-pair" : "R9-cap-growth",
          key: edge.key,
          hint:
            census.pairCaps[pairKey] === undefined
              ? "زوج بيوت جديد غير مسجل في غلاف المعايير (OD-10): استورد من باب البيت أو سجّل الزوج بقرار مالك موثق في نفس الـPR"
              : "حافة جديدة تجاوز سقف الزوج المسجل (OD-10): استورد من الباب أو أعِد إرساء السقف بتسجيل موثق في نفس الـPR",
        });
      } else if (inCensus.kind !== edge.kind) {
        violations.push({
          rule: "R9-cap-growth",
          key: `${edge.key} [${edge.kind} != ${inCensus.kind}]`,
          hint: "تغير تصنيف حافة حية عن الجرد المسجل — أعِد الإرساء في نفس الـPR",
        });
      }
    }
    /* سقف الزوج المسجل يُحترم حرفيًا (قيمة/نوع منفصلين). */
    for (const [pairKey, cap] of Object.entries(census.pairCaps)) {
      const live = livePairCounts[pairKey] ?? { value: 0, type: 0 };
      if (live.value > cap.value || live.type > cap.type) {
        violations.push({
          rule: "R9-cap-growth",
          key: `${pairKey}: value ${live.value}/${cap.value}, type ${live.type}/${cap.type}`,
          hint: "تجاوز سقف زوج البيوت المسجل (OD-10) — أعِد الإرساء بتسجيل موثق في نفس الـPR",
        });
      }
    }
    /* حافة أساس غادرت الشجرة الحية = قدم (نظافة نفس-الـPR). */
    for (const edge of census.edges) {
      if (!liveEdges.some(live => live.key === edge.key)) {
        violations.push({
          rule: "R9-stale-edge",
          key: edge.key,
          hint: "حافة جرد غادرت الشجرة الحية (هاجرة/حذف) — أزل الصف من الجرد وحدّث الإجماليات والأغلف في نفس الـPR",
        });
      }
    }
    /* ثوابت الإعفاء تُتحقق كل تشغيل — أي خرق = إلغاء معلن (فشل). */
    for (const moduleEntry of census.exemptModules) {
      violations.push(...checkExemptModuleInvariants(repoRoot, moduleEntry, liveEdges));
    }
    /* دورات البيوت: الجديد يفشل، والمحلول يفشل أيضًا حتى إعادة الإرساء. */
    for (const kind of ["value", "type"]) {
      const liveScc = houseSccs(liveEdges, kind);
      const baselineScc = census.sccBaselines?.[kind] ?? [];
      const toSerializedSet = list => new Set([...list].map(component => JSON.stringify([...component].sort())));
      const liveSerialized = toSerializedSet(liveScc);
      const baselineSerialized = toSerializedSet(baselineScc);
      for (const component of liveSerialized) {
        if (!baselineSerialized.has(component)) {
          violations.push({
            rule: kind === "value" ? "R9-new-value-cycle" : "R9-new-type-cycle",
            key: `${kind}: ${component}`,
            hint: "دورة بيوت جديدة غير مسجلة في الجرد (OD-10) — فك الدورة أو سجّلها بقرار موثق في نفس الـPR",
          });
        }
      }
      for (const component of baselineSerialized) {
        if (!liveSerialized.has(component)) {
          violations.push({
            rule: "R9-resolved-cycle",
            key: `${kind}: ${component}`,
            hint: "دورة مسجلة حُلّت من الشجرة الحية — حسنًا؛ أزل الإرساء من الجرد في ننفس الـPR ليبقى التسجيل دقيقًا",
          });
        }
      }
    }
  }
  /* R8 — نظافة الأساس: مفتاح غادر الشجرة يُزال من الثابت في نفس الـPR. */
  for (const key of uiToStorageType) {
    if (!r8Seen.has(key)) {
      violations.push({
        rule: "R8-baseline-stale",
        key,
        hint: "مفتاح أساس R8 لم يعد حيًّا في الشجرة (هاجر الموقع أو حُذف الملف أو صار الاستيراد قيميًّا) — أزل السطر من UI_TO_STORAGE_TYPE_BASELINE في نفس الـPR",
      });
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
    `module-boundaries: PASS — ${stats.files} ملف إنتاج؛ الأساس المقبول: ${stats.deepDomain} استيرادًا عميقًا داخل المجال، ${stats.uiToDomain} حافة واجهة→مجال، ${stats.appToPresentation} حافة تطبيق→عرض، ${stats.domainCrossArea} حافة عميقة عابرة لمناطق المجال، ${stats.uiToStorage} حافة واجهة→تخزين (resolution-based)، ${stats.uiToApplicationDeep} استيرادًا عميقًا واجهة→دواخل بيوت التطبيق (راتشة R6/STR-615)، ${stats.componentToPage} حافة مكوّن→صفحة (الصنف الممنوع — R8-F-019)؛ ${stats.uiToStorageType} حافة نوعية واجهة→تخزين (راتشة R8/D-01 على أساس 19 مفتاحًا)؛ ${stats.houseEdges} حافة أزواج بيوت تطبيق منها ${stats.houseEdgesValue} قيمة و${stats.houseEdgesType} نوعًا (راتشة R9/D-07 على جرد 130/81/49 مع إعفاءات OD-10 الورقية)؛ ${stats.clientToManage} حافة عميل→مانج و${stats.manageDomainForeign} حافة أجنبية من مجال مانج (صفر مسموح — R10/R11 جاهزتان قبل كود مانج، M1.6/§14.3/D-5)؛ صفر زيادة صامتة (ratchet — Wave 4E/RC-9 + Wave H/STR-617 + الخطوة ٦/STR-615 + R8/R8-F-019 + M1.6/R10-R11)`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
