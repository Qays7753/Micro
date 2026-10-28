#!/usr/bin/env node
/**
 * Guard: application ambient-time effect classes (R11 W1b-3 / D-12 —
 * R10B-NF-014، قرار المالك OD-TIME الخيار A مع موقف D: AST_GUARD_NO_ID_INJECTION).
 *
 * قرار المالك المعتمد (OD-TIME): حارس AST-bound لتصنيف مواقع «الزمن المحيطي»
 * في طبقة التطبيق (application/) حصرًا — عائلة ID-fallback المعتمدة تبقى،
 * وقراءة الساعة غير العائلية تُرفض، ولا أي حقن ساعة في عائلة الـID.
 *
 * الفئات (كل موقع `Date.now()` / `new Date` / `performance.now` في ملفات
 * إنتاج طبقة التطبيق يُصنَّف تحليليًا بـts.createSourceFile — بلا Program
 * ولا تنفيذ؛ وخطأ التحليل يُفشل الحارس فاشلًا-مغلقًا):
 *
 *  AT-1 (قراءة ساعة غير عائلية): `Date.now()` خارج مناطق الإعفاء البنيوية
 *      → رفض. الإعفاء البنيوي الوحيد: أن يكون الاستدعاء **داخل** المعامل
 *      الأيمن لعامل `??` معامله الأيسر حرفيًا `globalThis.crypto?.randomUUID?.()`
 *      (الشكل أ)، أو داخل الفرع البديل لثلاثي شرطه حرفيًا
 *      `typeof crypto !== "undefined" && "randomUUID" in crypto` وفرعه
 *      المقابل نداء `crypto.randomUUID()` (الشكل ب) — عائلة الـID-fallback
 *      المعتمدة: قيمة معتم تُشتق كبذرة معرف عند غياب crypto، لا تاريخًا
 *      ولا قيمة مالية (قرار OD-TIME صريح).
 *      الربط بنيوي لا نصي-مجاور: تعليق يحوي النمط أو نص يحويه أو `||`
 *      بدل `??` أو مستقبل خاطئ أو متغير وسيط (alias) — لا يُعفي أيًّا منها.
 *  AT-2 (ratشية المواقع): جرد المناطق المعفاة يطابق حرفيًا القائمة المثبتة
 *      الـ21 موقعًا (17 شكل-أ + 4 شكل-ب) — موقع جديد في ملف غير مثبت
 *      = رفض حتى إعادة إرساء موثقة، وموقع مثبت غادر = رفض (تحديث القائمة).
 *  AT-3 (بناء محيط): `new Date()` بلا وسيط في طبقة التطبيق مسموح حصريًا في
 *      `application/time/clock.ts` داخل شكل `new Date().toISOString()` —
 *      منفذ systemClock الموثق (STR-618): الساعة المحيطية النشطة الوحيدة.
 *      أي بناء محيط آخر (أو نسخة ثانية في الملف نفسه) = رفض.
 *  AT-4 (مراجع بدون نداء): `Date.now` مرجعًا (بلا أقواس) — وسيط تمرير
 *      ساعة مقنّع = رفض (لا مواقع حية عند التأسيس).
 *  AT-5 (ساعات أداء): `performance.now()` في طبقة التطبيق = رفض (لا مواقع).
 *
 * خارج النطاق حصرًا (قرار OD-TIME): التحليل الصريح ليس زمنًا محيطيًا —
 * `new Date(value)` / `Date.parse(value)` بوسيط صريح مسموح (مواقع التحليل
 * (S02-B: مواقع localLockService.ts الثلاثة حُذفت مع الوحدة المتقاعدة — قرار
 * إلغاء ٠٤٢ المعتمد؛ الباقي تحليل صريح مسموح كما هو).
 * مؤقتات الواجهة (pages/components) وlock-idle (AppLockGate) خارج هذا
 * الحارس كليًا — lock-idle له توصيف مستقل (W1b-4) ولا سلوك يتغير هنا.
 * الاختبارات والـfixtures والـdist خارج المسح أصلاً.
 *
 * FAILS on the first violation batch with file:line and the rule text;
 * exit 0 only when the whole application layer is clean.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const APPLICATION_ROOT = path.join(ROOT, "apps", "prototype-web", "client", "src", "application");

/** الشكل أ: نص المعامل الأيسر المعتمد حرفيًا (مع تطبيع المسافات). */
export const ID_FALLBACK_NULLISH_LEFT = "globalThis.crypto?.randomUUID?.()";
/** الشكل ب: نص شرط الثلاثي المعتمد حرفيًا (مع تطبيع المسافات). */
export const ID_FALLBACK_TERNARY_CONDITION = 'typeof crypto !== "undefined" && "randomUUID" in crypto';
/** الشكل ب: نص فرع الوفاء المعتمد حرفيًا. */
export const ID_FALLBACK_TERNARY_CONSEQUENT = "crypto.randomUUID()";

/** فرع وفاء معتمد بنيويًا: يحوي نداء `crypto.randomUUID()` بلا وسائط —
 *  النداء المجرد نفسه أو داخل قالب نصي مع بادئات (نمط
 *  `${prefix}-${crypto.randomUUID()}`)؛ الربط الفعلي هو الشرط الحرفي
 *  المثبت أعلاه + وجود نداء randomUUID الفعلي في فرع الوفاء. */
function isApprovedTernaryConsequent(node, sourceFile) {
  let hasRandomUuidCall = false;
  const visit = inner => {
    if (
      ts.isCallExpression(inner) &&
      ts.isPropertyAccessExpression(inner.expression) &&
      inner.expression.expression.getText(sourceFile) === "crypto" &&
      inner.expression.name.getText(sourceFile) === "randomUUID" &&
      inner.arguments.length === 0
    ) {
      hasRandomUuidCall = true;
    }
    ts.forEachChild(inner, visit);
  };
  visit(node);
  return hasRandomUuidCall;
}

/** منفذ الساعة الموثق — الملف والشكل المسموحان لبناء محيط وحيد. */
export const CLOCK_BOUNDARY_FILE = "application/time/clock.ts";
export const CLOCK_BOUNDARY_SHAPE = "new Date().toISOString()";

/**
 * الجرد المثبت للـ22 موقعًا المعتمدًا (قرار OD-TIME — لا يُعدَّل بصمت؛
 * أي تغيير يتطلب إعادة إرساء موثقة في نفس الـPR مع مرجع مراجعة مالك).
 */
export const APPROVED_ID_FALLBACK_SITES = [
  { file: "application/assets/assetService.ts", shape: "nullish" },
  { file: "application/budgets/expenseBudgetService.ts", shape: "nullish" },
  { file: "application/cash/cashContinuityService.ts", shape: "nullish" },
  /* S04 (DOC-013، 2026-10-28): مساعد العهدة نفسه انتقل مع recordCashCount إلى خدمة العدّ المستقلة — إرساء بنفس الـPR. */
  { file: "application/cash/cashCountService.ts", shape: "nullish" },
  { file: "application/catalog/catalogService.ts", shape: "ternary" },
  { file: "application/collections/collectionReversalService.ts", shape: "nullish" },
  { file: "application/cost/costService.ts", shape: "ternary" },
  { file: "application/direct-sales/directSaleService.ts", shape: "nullish" },
  { file: "application/drafts/draftService.ts", shape: "ternary" },
  { file: "application/estimates/costEstimateService.ts", shape: "nullish" },
  { file: "application/finance/projectFinancialEventWrites.ts", shape: "nullish" },
  { file: "application/finance/recurringWorkService.ts", shape: "nullish" },
  { file: "application/financial-analysis/financialAnalysisService.ts", shape: "nullish" },
  { file: "application/financial-records/retainedDepositService.ts", shape: "nullish" },
  { file: "application/inventory/inventoryMaterialModel.ts", shape: "nullish" },
  { file: "application/loans/loanService.ts", shape: "nullish" },
  { file: "application/loans/receivedLoanService.ts", shape: "nullish" },
  { file: "application/owner-money/ownerEntitlementService.ts", shape: "nullish" },
  { file: "application/owner/ownerProfileService.ts", shape: "nullish" },
  { file: "application/recurring/recurringExpenseService.ts", shape: "nullish" },
  { file: "application/suppliers/supplierPurchaseService.ts", shape: "nullish" },
  { file: "application/time/actualTimeService.ts", shape: "ternary" },
];

const isTestFile = filePath =>
  /\.(?:test|spec|fixture)\.[jt]sx?$/.test(filePath) || filePath.includes("__fixtures__");
const isDist = filePath => filePath.includes(`${path.sep}dist${path.sep}`);

/** تطبيع النص: مسافات متتالية ← مسافة واحدة (للمقارنة الحرفية المتسامحة مع التنسيق فقط). */
function normalize(text) {
  return text.replace(/\s+/g, " ").trim();
}

/** ملفات إنتاج طبقة التطبيق (.ts/.tsx) تحت جذر التطبيق. */
function walkApplicationDir(directory, results) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
      walkApplicationDir(full, results);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (isTestFile(full) || isDist(full)) continue;
    results.push(full);
  }
  return results;
}

export function collectApplicationFiles(repoRoot) {
  const appRoot = path.join(repoRoot, "apps", "prototype-web", "client", "src", "application");
  const results = [];
  if (!fs.existsSync(appRoot)) return results;
  return walkApplicationDir(appRoot, results);
}

function relToApplication(repoRoot, file) {
  return (
    "application/" +
    path
      .relative(path.join(repoRoot, "apps", "prototype-web", "client", "src", "application"), file)
      .split(path.sep)
      .join("/")
  );
}

/** هل الاستدعاء/العقدة داخل مدى منطقة معفاة (احتواء موضعي في نفس الملف)؟ */
function insideAnyRegion(node, regions) {
  return regions.some(region => node.getStart() >= region.start && node.getEnd() <= region.end);
}

/**
 * التصنيف الكامل لطبقة التطبيق: يعيد { violations, stats } —
 * violations مرتبة حسب (ملف، سطر)؛ stats تعداد صادق لكل فئة.
 */
export function classifyAmbientTime(repoRoot) {
  const violations = [];
  const stats = {
    files: 0,
    approvedIdFallbackRegions: 0,
    approvedDateNowCalls: 0,
    parseCalls: 0,
    clockBoundarySites: 0,
  };
  const regionCounts = new Map(); /* relFile -> { nullish, ternary } */

  for (const file of collectApplicationFiles(repoRoot)) {
    const content = fs.readFileSync(file, "utf8");
    const kind = file.endsWith(".tsx") ? ts.ScriptKind.TX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, kind);
    const parseErrors = sourceFile.parseDiagnostics;
    if (parseErrors && parseErrors.length > 0) {
      violations.push({
        rule: "AT-parse-error",
        key: `${relToApplication(repoRoot, file)}:${parseErrors[0].start ?? 0} (فشل مغلق — التحليل التحليلي يجب أن ينجح)`,
        hint: "خطأ تحليل TypeScript يمنع التصنيف — أصلح الملف أولًا؛ الحارس لا يمرر ما لا يستطيع قراءته",
      });
      continue;
    }
    stats.files += 1;
    const rel = relToApplication(repoRoot, file);

    /* المرحلة ١: جمع مناطق الإعفاء البنيوية في هذا الملف. */
    const regions = [];
    const visitRegions = node => {
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
        if (normalize(node.left.getText(sourceFile)) === ID_FALLBACK_NULLISH_LEFT) {
          regions.push({ start: node.right.getStart(), end: node.right.getEnd(), shape: "nullish" });
        }
      } else if (ts.isConditionalExpression(node)) {
        if (
          normalize(node.condition.getText(sourceFile)) === ID_FALLBACK_TERNARY_CONDITION &&
          isApprovedTernaryConsequent(node.whenTrue, sourceFile)
        ) {
          regions.push({ start: node.whenFalse.getStart(), end: node.whenFalse.getEnd(), shape: "ternary" });
        }
      }
      ts.forEachChild(node, visitRegions);
    };
    visitRegions(sourceFile);
    if (regions.length > 0) {
      const counts = { nullish: 0, ternary: 0 };
      for (const region of regions) counts[region.shape] += 1;
      regionCounts.set(rel, counts);
      stats.approvedIdFallbackRegions += regions.length;
    }

    /* المرحلة ٢: تصنيف كل موقع زمن محيطي. */
    const visit = node => {
      /* AT-5: performance.now() — ساعة أداء غير معتمدة إطلاقًا في التطبيق. */
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText(sourceFile) === "performance" &&
        node.expression.name.getText(sourceFile) === "now" &&
        node.arguments.length === 0
      ) {
        violations.push({
          rule: "AT-performance-now",
          key: `${rel}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}`,
          hint: "performance.now() في طبقة التطبيق — ساعة محيطية غير معتمدة؛ مرّر لحظة صريحة أو استخدم منفذ systemClock",
        });
      }

      /* AT-4: مرجع Date.now بدون نداء (تمرير ساعة مقنّع). */
      if (
        ts.isIdentifier(node) &&
        node.getText(sourceFile) === "now" &&
        ts.isPropertyAccessExpression(node.parent) &&
        node.parent.expression.getText(sourceFile) === "Date" &&
        !ts.isCallExpression(node.parent.parent)
      ) {
        violations.push({
          rule: "AT-date-now-reference",
          key: `${rel}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}`,
          hint: "مرجع Date.now بدون نداء — تمرير ساعة مقنّع يتهرب من التصنيف؛ استدعِ صراحة أو مرّر Clock",
        });
      }

      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const receiver = node.expression.expression.getText(sourceFile);
        const method = node.expression.name.getText(sourceFile);

        /* Date.now() — الفئة المحورية. */
        if (receiver === "Date" && method === "now" && node.arguments.length === 0) {
          if (insideAnyRegion(node, regions)) {
            stats.approvedDateNowCalls += 1;
          } else {
            violations.push({
              rule: "AT-date-now-out-of-family",
              key: `${rel}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}`,
              hint: "قراءة ساعة Date.now() خارج عائلة ID-fallback المعتمدة — عائلة الإعفاء: المعامل الأيمن لـ ?? خلف globalThis.crypto?.randomUUID?.() أو الفرص البديل للثلاثي المشروط على توفر randomUUID؛ ما عدا ذلك يمر عبر منفذ systemClock أو لحظة صريحة",
            });
          }
        }

        /* Date.parse(value) — تحليل صريح: مسموح ومُعدّ (ليس زمنًا محيطيًا). */
        if (receiver === "Date" && method === "parse" && node.arguments.length >= 1) {
          stats.parseCalls += 1;
        }
      }

      /* AT-3: بناء محيط new Date(...) — بلا وسيط مرفوض إلا منفذ الساعة الموثق. */
      if (ts.isNewExpression(node) && node.expression.getText(sourceFile) === "Date") {
        const hasArgs = node.arguments !== undefined && node.arguments.length > 0;
        if (!hasArgs) {
          const parent = node.parent;
          const isSystemClockShape =
            ts.isPropertyAccessExpression(parent) && parent.name.getText(sourceFile) === "toISOString";
          if (rel === CLOCK_BOUNDARY_FILE && isSystemClockShape) {
            stats.clockBoundarySites += 1;
          } else {
            violations.push({
              rule: "AT-ambient-new-date",
              key: `${rel}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}`,
              hint:
                rel === CLOCK_BOUNDARY_FILE
                  ? "بناء محيط ثانٍ داخل ملف منفذ الساعة — الشكل المسموح الوحيد هو new Date().toISOString() لمنفذ systemClock؛ أعد الإرساء بتوثيق إن كان حدًا جديدًا مقصودًا"
                  : "بناء محيط new Date() في طبقة التطبيق خارج منفذ الساعة الموثق (application/time/clock.ts — systemClock)؛ مرّر لحظة صريحة أو استخدم Clock المحقون",
            });
          }
        }
        /* new Date(value) — تحليل صريح: مسموح ومُعدّ. */
        else {
          stats.parseCalls += 1;
        }
      }

      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  /* المرحلة ٣: مطابقة الجرد — ratشة المواقع المعتمدة. */
  const pinnedByFile = new Map();
  for (const entry of APPROVED_ID_FALLBACK_SITES) {
    const current = pinnedByFile.get(entry.file) ?? { nullish: 0, ternary: 0 };
    pinnedByFile.set(entry.file, { ...current, [entry.shape]: current[entry.shape] + 1 });
  }
  for (const [file, pinned] of pinnedByFile) {
    const live = regionCounts.get(file);
    if (live === undefined) {
      violations.push({
        rule: "AT-stale-id-fallback-site",
        key: `${file} (موقع مثبت غادر الشجرة)`,
        hint: "الملف مثبت في جرد OD-TIME لكن لا منطقة إعفاء حية فيه — حدّث APPROVED_ID_FALLBACK_SITES في نفس الـPR بتوثيق",
      });
    } else if (live.nullish !== pinned.nullish || live.ternary !== pinned.ternary) {
      violations.push({
        rule: "AT-id-fallback-census-mismatch",
        key: `${file}: مثبت ${pinned.nullish}أ/${pinned.ternary}ب، حي ${live.nullish}أ/${live.ternary}ب`,
        hint: "عدد مناطق الإعفاء في الملف لا يطابق الجرد المثبت — حدّث الجرد بإعادة إرساء موثقة أو أعد الموقع للعائلة المعتمدة",
      });
    }
  }
  for (const [file, live] of regionCounts) {
    if (!pinnedByFile.has(file)) {
      violations.push({
        rule: "AT-new-id-fallback-site",
        key: `${file}: ${live.nullish}أ/${live.ternary}ب`,
        hint: "موقع ID-fallback جديد خارج الجرد المعتمد (21 موقعًا) — الإضافة تتطلب إعادة إرساء موثقة بمرجع مراجعة مالك في نفس الـPR (نمط ratشة R9/D-07)",
      });
    }
  }

  violations.sort((a, b) => a.key.localeCompare(b.key));
  return { violations, stats };
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  const { violations, stats } = classifyAmbientTime(repoRoot);
  if (violations.length > 0) {
    console.error(`application-ambient-time: FAIL — ${violations.length} خرقًا فوق التصنيف المعتمد:`);
    for (const violation of violations) {
      console.error(`  [${violation.rule}] ${violation.key}`);
      console.error(`    ${violation.hint}`);
    }
    process.exit(1);
  }
  console.log(
    `application-ambient-time: PASS — ${stats.files} ملف إنتاج تطبيقي؛ ` +
      `${stats.approvedIdFallbackRegions} منطقة ID-fallback معتمدة فيها ${stats.approvedDateNowCalls} نداء Date.now() معفى؛ ` +
      `${stats.parseCalls} تحليلًا صريحًا (مسموح)؛ منفذ الساعة الموثق ${stats.clockBoundarySites} موقعًا؛ ` +
      `صفر قراءة ساعة غير عائلية (ratشة OD-TIME على جرد 22 موقعًا: 18 شكل-أ + 4 شكل-ب)`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
