#!/usr/bin/env node
/**
 * R11 W3 / OD-LABEL — حارس مفردات التسميات المكررة (duplicate-literal scan).
 *
 * المصدر الكنوني: FIELD_LABELS_AR في src/domain/shared/numeric.ts (يبقى في
 * Domain بقرار OD-LABEL). الحارس يمسح كل ملفات إنتاج العميل (بلا اختبارات)
 * بحثًا عن نصوص تساوي بالبايت قيمة من قيم المفردات:
 *  1) كل نص محدد بعلامات اقتباس (StringLiteral) يساوي قيمة تسمية؛
 *  2) كل نص JSX مستقل (JsxText) يساوي قيمة تسمية بعد التقليم — لأن تسمية
 *     الحقل المعروضة <span>الكمية</span> تكرار حقيقي للمفردة لا نثرًا.
 *
 * الراتشة: مجموعة البقايا المثبتة (PINNED_LABEL_LITERALS) هي الحالة المقاسة
 * الحية عند تنفيذ W3، مصنفة: migrated (أصلح) / owner-gated (R2/STR-106 يمنع
 * حافة قيمة جديدة من الواجهة إلى المجال) / variant (تطابق بايت عرضي لا
 * استهلاك تسمية حقل — يسجل ولا يوحد) / display (عرض واجهة قائم). أي تكرار
 * جديد خارج المجموعة يُرفض حتى يصنف في نفس الـPR؛ وأي مدخل غادر الشجرة
 * يُرفض (نظافة الأساس).
 *
 * لا يثبت (حدود موثقة): النصوص المحتوية على التسمية داخل جملة أطول (نثر)
 * خارج النطاق عمدًا — تغطيتها اختبار DOM text والمراجعة؛ وملفات الاختبارات
 * خارج المسح عمدًا (أدواتها معفاة).
 *
 * الاستخدام: node scripts/check-label-vocabulary.mjs [repoRoot].
 * الخروج: 0 = نظيف؛ 1 = أي خرق؛ 2 = خطأ استخدام.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { ROOT } from "./check-runtime-cycles.mjs";

const DOMAIN_NUMERIC = path.join("src", "domain", "shared", "numeric.ts");
const CLIENT_SRC = path.join("apps", "prototype-web", "client", "src");
const TEST_PAT = /\.(test|spec|dom\.test|ui\.test|contract\.test|characterization\.test|mutation\.test)\.[cm]?[jt]sx?$/;
const SOURCE_EXT = new Set([".ts", ".tsx"]);

/** استخراج خريطة FIELD_LABELS_ar من ملف الدومين (AST — أزواج مفاتيح/قيم). */
export function extractDomainLabels(repoRoot) {
  const full = path.join(repoRoot, DOMAIN_NUMERIC);
  const sf = ts.createSourceFile(full, fs.readFileSync(full, "utf8"), ts.ScriptTarget.Latest, true);
  let map = null;
  const visit = node => {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === "FIELD_LABELS_AR" && decl.initializer && ts.isObjectLiteralExpression(decl.initializer)) {
          const labels = {};
          for (const prop of decl.initializer.properties) {
            if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && ts.isStringLiteral(prop.initializer)) {
              labels[prop.name.text] = prop.initializer.text;
            }
          }
          map = labels;
        }
      }
    }
    if (map === null) ts.forEachChild(node, visit);
  };
  visit(sf);
  if (map === null) throw new Error("FIELD_LABELS_AR not found in domain/shared/numeric.ts");
  return map;
}

/** كل مواضع النصوص المساوية بالبايت لقيم المفردات في ملف واحد (AST). */
export function labelLiteralsIn(fileName, content, labelsByValue) {
  const sf = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
  const hits = [];
  const record = (node, text, kind) => {
    if (labelsByValue.has(text)) {
      hits.push({
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        kind,
        text,
        domainKeys: labelsByValue.get(text),
      });
    }
  };
  const visit = node => {
    if (ts.isStringLiteral(node)) record(node, node.text, "string-literal");
    else if (ts.isJsxText(node)) {
      const trimmed = node.getText(sf).replace(/^[\s{}]+|[\s{}]+$/g, "");
      if (trimmed.length > 0) record(node, trimmed, "jsx-text");
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

function listClientProductionFiles(repoRoot) {
  const out = [];
  const dir = path.join(repoRoot, CLIENT_SRC);
  if (!fs.existsSync(dir)) return out;
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (SOURCE_EXT.has(path.extname(e.name)) && !TEST_PAT.test(e.name)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

/**
 * البقايا المثبتة — الحالة المقاسة الحية عند تنفيذ R11 W3 (OD-LABEL) بعد
 * ترحيل مستهلك طبقة التطبيق الوحيد القابل للترحيل المحايد
 * (agreementPresentation.ts صار يستهلك fieldLabelAr من الدومين). البقية
 * مصنفة: owner-gated (حافة R2 مطلوبة) أو variant (تطابق بايت عرضي) أو
 * display (عرض قائم موثق). أي إضافة تكرارية جديدة تُرفض حتى تصنف هنا
 * في نفس الـPR.
 */
export const PINNED_LABEL_LITERALS = {
  "components/catalog/CatalogTemplatesSection.tsx": {
    "الكمية": "owner-gated display — تسمية حقل الكمية؛ حافة قيمة جديدة للواجهة→المجال يمنعها R2/STR-106",
    "أجر الساعة": "owner-gated display — aria-label لحقل أجر الساعة؛ R2/STR-106",
  },
  "components/catalog/CatalogUnitsSection.tsx": {
    "المصدر": "owner-gated display — تسمية حقل المصدر؛ R2/STR-106",
  },
  "components/cost/MaterialSheet.tsx": {
    "الكمية": "owner-gated display — تسمية حقل الكمية؛ R2/STR-106",
  },
  "components/finance/ExpenseBudgetsSectionBody.tsx": {
    "المبلغ": "owner-gated display — تسمية حقل المبلغ؛ R2/STR-106",
  },
  "components/finance/FinancePoliciesSection.tsx": {
    "المبلغ": "owner-gated display — تسمية حقل المبلغ؛ R2/STR-106",
    "النسبة": "owner-gated display — تسمية حقل النسبة؛ R2/STR-106",
    "المصدر": "owner-gated display — تسمية حقل المصدر؛ R2/STR-106",
    "السبب": "owner-gated display — تسمية حقل السبب؛ R2/STR-106",
  },
  "components/finance/RecurringConfirmPanel.tsx": {
    "المحفظة": "owner-gated display — تسمية حقل اختيار المحفظة؛ R2/STR-106",
  },
  "components/finance/AllocationReviewCard.tsx": {
    "إجمالي المصروف المشترك": "owner-gated display — تسمية حقل الإجمالي؛ R2/STR-106",
  },
  /* S10 (UNIT-031/032 — أمر b56967d8/DOC-019): محرر التقدير الموروث — تسمية
   * حقل كمية البند (jsx-text) وaria-label أجر الساعة (string-literal)، بنمط
   * MaterialSheet/CatalogTemplatesSection نفسه؛ تصنيف موثق في نفس الـPR. */
  "components/planning/LegacyEstimateEditor.tsx": {
    "الكمية": "owner-gated display — تسمية حقل الكمية؛ R2/STR-106",
    "أجر الساعة": "owner-gated display — aria-label لحقل أجر الساعة؛ R2/STR-106",
  },
  "components/owner/OwnerLedgerFormsSection.tsx": {
    "السبب": "owner-gated display — تسمية حقل السبب؛ R2/STR-106",
    "تاريخ الحركة": "owner-gated display — تسمية حقل تاريخ الحركة؛ R2/STR-106",
  },
  "components/presentation/ActualTimePanel.tsx": {
    "سبب التراجع": "owner-gated display — تسمية حقل سبب التراجع؛ R2/STR-106",
  },
  "pages/AssetEditor.tsx": {
    "تاريخ الشراء": "owner-gated display — تسمية حقل تاريخ الشراء؛ R2/STR-106",
  },
  "pages/CashDistribution.tsx": {
    "المحفظة": "owner-gated display — تسميات/عرض المحفظة؛ R2/STR-106",
  },
  "pages/CashWalletEditor.tsx": {
    "تاريخ البداية": "owner-gated display — تسمية حقل تاريخ البداية؛ R2/STR-106",
  },
  "pages/Collect.tsx": {
    "المحفظة": "owner-gated display — عرض المحفظة؛ R2/STR-106",
  },
  "pages/CostCalculator.tsx": {
    /* S10 (UNIT-031/032 — أمر b56967d8/DOC-019): «الكمية» غادرت الصفحة مع
     * محرر المجموعات/الميراث (تسميتها الآن في LegacyEstimateEditor أدناه) —
     * إزالة التثبيت المتقادم بنفس الـPR وفق بروتوكول النظافة. */
    "أجر الساعة": "owner-gated display — تسمية حقل أجر الساعة؛ R2/STR-106",
  },
  "pages/DirectSaleEditor.tsx": {
    "المحفظة": "variant — اسم شائع كبديل عرض لاسم محفظة غائب (walletName ?? «المحفظة»)، لا تسمية حقل walletId؛ يسجل ولا يوحد",
    "الكمية": "owner-gated display — تسمية حقل الكمية؛ R2/STR-106",
    "السعر المتفق عليه": "owner-gated display — تسمية حقل السعر؛ R2/STR-106",
  },
  "pages/DraftEditor.tsx": {
    "الكمية": "owner-gated display — تسمية حقل الكمية؛ R2/STR-106",
  },
  "pages/FinancialEventEditor.tsx": {
    "إجمالي المصروف المشترك": "owner-gated display — تسمية حقل الإجمالي؛ R2/STR-106",
  },
  "pages/InventoryMovementEditor.tsx": {
    "الكمية": "owner-gated display — تسمية حقل الكمية؛ R2/STR-106",
    "تاريخ الحركة": "owner-gated display — تسمية حقل تاريخ الحركة؛ R2/STR-106",
    "السبب": "owner-gated display — تسمية حقل السبب؛ R2/STR-106",
  },
  "pages/OwnerEntitlement.tsx": {
    "سبب التراجع": "owner-gated display — تسمية حقل سبب التراجع؛ R2/STR-106",
  },
  "pages/Profile.tsx": {
    "المحفظة": "owner-gated display — عرض المحفظة؛ R2/STR-106",
  },
  "pages/SupplierPurchaseEditor.tsx": {
    "اسم المورد": "owner-gated display — تسمية حقل اسم المورد؛ R2/STR-106",
    "تاريخ الشراء": "owner-gated display — تسمية حقل تاريخ الشراء؛ R2/STR-106",
  },
};

/** الفحص الكامل: يعيد الخروق والإحصاءات. */
export function checkLabelVocabulary(repoRoot) {
  const labels = extractDomainLabels(repoRoot);
  const labelsByValue = new Map();
  for (const [key, value] of Object.entries(labels)) {
    labelsByValue.set(value, [...(labelsByValue.get(value) ?? []), key]);
  }
  const violations = [];
  let scanned = 0;
  let pinnedLive = 0;
  for (const full of listClientProductionFiles(repoRoot)) {
    const rel = path.relative(path.join(repoRoot, CLIENT_SRC), full).split(path.sep).join("/");
    scanned += 1;
    const content = fs.readFileSync(full, "utf8");
    const hits = labelLiteralsIn(full, content, labelsByValue);
    const pinned = PINNED_LABEL_LITERALS[rel] ?? {};
    for (const hit of hits) {
      if (!(hit.text in pinned)) {
        violations.push({
          rule: "unclassified-domain-label-literal",
          key: `${rel}:${hit.line} — «${hit.text}» == domain ${hit.domainKeys.join("/")} (${hit.kind})`,
        });
      } else {
        pinnedLive += 1;
      }
    }
  }
  for (const [rel, literals] of Object.entries(PINNED_LABEL_LITERALS)) {
    for (const literal of Object.keys(literals)) {
      const full = path.join(repoRoot, CLIENT_SRC, rel);
      if (!fs.existsSync(full)) {
        violations.push({ rule: "pinned-file-stale", key: rel });
        continue;
      }
      const hits = labelLiteralsIn(full, fs.readFileSync(full, "utf8"), labelsByValue);
      if (!hits.some(hit => hit.text === literal)) {
        violations.push({ rule: "pinned-literal-stale", key: `${rel} — «${literal}»` });
      }
    }
  }
  const pinnedEntries = Object.values(PINNED_LABEL_LITERALS).reduce((sum, m) => sum + Object.keys(m).length, 0);
  return {
    ok: violations.length === 0,
    violations,
    stats: {
      domainLabels: Object.keys(labels).length,
      scanned,
      pinnedEntries,
      pinnedLive,
    },
  };
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  if (!fs.existsSync(path.join(repoRoot, "package.json"))) {
    console.error("label-vocabulary: USAGE: node scripts/check-label-vocabulary.mjs [repoRoot]");
    process.exit(2);
  }
  const { ok, violations, stats } = checkLabelVocabulary(repoRoot);
  if (!ok) {
    console.error(`label-vocabulary: FAIL — ${violations.length} خرقًا:`);
    for (const v of violations) console.error(`  [${v.rule}] ${v.key}`);
    process.exit(1);
  }
  console.log(
    `label-vocabulary: PASS — ${stats.domainLabels} تسمية دومين كنونية؛ ${stats.scanned} ملف إنتاج زُرع؛ ${stats.pinnedEntries} مدخلًا مثبتًا مصنفًا يغطي ${stats.pinnedLive} موضعًا حيًّا (owner-gated/variant — راتشة OD-LABEL: التكرار الجديد يُرفض حتى يصنف)؛ مستهلك طبقة التطبيق الوحيد المحايد (agreementPresentation) يستهلك fieldLabelAr من الدومين`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
