#!/usr/bin/env node
/**
 * R5/S3 (WS-216/ARCH-007 — 2026-10-09): حارس قراءة/كتابة التطبيق — يثبت أن
 * ملفات القراءة المسجلة في عائلات R5 المالية لا تستدعي أي فعل كتابة على
 * منفذ التخزين (قبول الموجة: «القارئ لا يكتب» — F-08 حتمية لا عرضية).
 *
 *  - الطاقم المسجل `READER_FILES` (18 ملفًا عند التأسيس) + **آلية توسيع
 *    ذاتية**: أي ملف غير اختباري في العائلات الخمس يحمل وسم `PC-4 read-model:`
 *    في ترويسته (ترويسات S4) يُدرج تلقائيًا في المنع.
 *  - المنع: أي استدعاء (AST) لاسم يبدأ بـ save/commit/delete/replace/clear
 *    بحرف كبير — بصيغتي الوصول الخاص (`store.saveX()`) والمعرّف المجرد
 *    (`const {saveX} = store; saveX()`).
 *  - صف مسجل غادر الشجرة = فشل (نظافة الأساس نفس-الـPR).
 *
 * لا يثبت (حدود موثقة بمالك ومحفز):
 *  1) مفردات المنع تغطي أفعال كتابة منفذ التخزين (save وcommit وdelete و
 *     replace وclearFormDrafts) — ليست مفردات خدمات الكاتب
 *     (createBudget/recordFinancialEvent/…)؛ قارئ يستدعي خدمة كاتب يهرّب —
 *     الطبقة مسجلة في السجل الحدي §5 (الكتاب عبر مالكها الكنوني).
 *  2) التسجيل لقطة + الوسم: ملف قارئ جديد بلا وسم PC-4 وبلا تسجيل يبقى
 *     خارج الشبكة حتى تصنيفه — متبقٍ مؤرخ (المالك: successor؛ المحفز: كل
 *     PR يضيف ملفًا للعائلات الخمس يصنفه في السجل الحدي).
 *  3) الكتّاب السبعة خارج الطاقم عمدًا: قراءاتهم شروط كتابة موثقة.
 *
 * الاستخدام: node scripts/check-application-readwrite.mjs [repoRoot].
 * الخروج: 0 = نظيف؛ 1 = أي خرق؛ 2 = خطأ استخدام.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { ROOT } from "./check-runtime-cycles.mjs";

const CLIENT_APPLICATION = path.join("apps", "prototype-web", "client", "src", "application");
const TEST_PAT = /\.(test|spec|dom\.test|ui\.test|contract\.test|characterization\.test)\.[cm]?[jt]sx?$/;
const PC4_MARKER = "PC-4 read-model";
const WRITE_CALL = /^(save|commit|delete|replace|clear)[A-Z]/;

/** طاقم القراءة المسجل (R5/S3 — تعداد حصري من الشجرة عند التأسيس). */
export const READER_FILES = [
  "finance/projectFinancialReads.ts",
  "finance/projectFinancialPeriodReads.ts",
  "finance/projectFinancialInsights.ts",
  "finance/statementService.ts",
  "finance/periodComparisonService.ts",
  "finance/profitToCashBridgeService.ts",
  "finance/integrityCheckService.ts",
  "finance/integrityCheckModel.ts",
  "finance/integrityCheckCoreFinance.ts",
  "finance/integrityCheckInventory.ts",
  "finance/integrityCheckAssetsLoans.ts",
  "finance/integrityCheckContinuity.ts",
  "finance/integrityCheckSupplierWallet.ts",
  "finance/integrityCheckSettlementBasis.ts",
  "finance/integrityCheckOffenderSummaries.ts",
  "finance/dueDatesService.ts",
  "finance/upcomingService.ts",
  "financial-records/correctionHistoryService.ts",
];

/** العائلات الخمس التي يُفتش فيها عن ووسم PC-4 للتوسيع الذاتي. */
const PC4_FAMILIES = ["finance", "owner-money", "financial-records", "budgets", "transfers"];

function listFamilyFiles(repoRoot) {
  const out = [];
  for (const family of PC4_FAMILIES) {
    const dir = path.join(repoRoot, CLIENT_APPLICATION, family);
    if (!fs.existsSync(dir)) continue;
    const walk = d => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full);
        else out.push(full);
      }
    };
    walk(dir);
  }
  return out.filter(f => f.endsWith(".ts") && !TEST_PAT.test(path.basename(f)));
}

/** الملفات المحروسة: الطاقم المسجل + كل ملف موسوم PC-4 في العائلات الخمس. */
export function enrolledReaderFiles(repoRoot) {
  const auto = [];
  for (const full of listFamilyFiles(repoRoot)) {
    if (fs.readFileSync(full, "utf8").includes(PC4_MARKER)) auto.push(full);
  }
  return { registered: READER_FILES.map(rel => path.join(repoRoot, CLIENT_APPLICATION, rel)), auto };
}

/** رصد أي استدعاء كتابة في ملف قارئ (وصول خاص أو معرّف مجرد). */
export function writeCallsIn(sourceFile) {
  const calls = [];
  const visit = node => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : ts.isIdentifier(callee)
          ? callee.text
          : null;
      if (name && WRITE_CALL.test(name)) calls.push(name);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return calls;
}

/** الفحص الكامل: يعيد الخروق والإحصاءات. */
export function checkApplicationReadWrite(repoRoot) {
  const { registered, auto } = enrolledReaderFiles(repoRoot);
  const violations = [];
  for (const full of registered) {
    const rel = path.relative(repoRoot, full).split(path.sep).join("/");
    if (!fs.existsSync(full)) {
      violations.push({ rule: "reader-file-stale", key: rel });
      continue;
    }
    const sf = ts.createSourceFile(full, fs.readFileSync(full, "utf8"), ts.ScriptTarget.Latest, true);
    for (const name of writeCallsIn(sf)) violations.push({ rule: "reader-writes", key: `${rel}: ${name}()` });
  }
  for (const full of auto) {
    const rel = path.relative(repoRoot, full).split(path.sep).join("/");
    const sf = ts.createSourceFile(full, fs.readFileSync(full, "utf8"), ts.ScriptTarget.Latest, true);
    for (const name of writeCallsIn(sf)) violations.push({ rule: "reader-writes", key: `${rel}: ${name}()` });
  }
  return {
    ok: violations.length === 0,
    violations,
    stats: { registered: registered.length, autoEnrolled: auto.length, writeCalls: violations.length },
  };
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  if (!fs.existsSync(path.join(repoRoot, "package.json"))) {
    console.error("application-readwrite: USAGE: node scripts/check-application-readwrite.mjs [repoRoot]");
    process.exit(2);
  }
  const { ok, violations, stats } = checkApplicationReadWrite(repoRoot);
  if (!ok) {
    console.error(`application-readwrite: FAIL — ${violations.length} خرقًا:`);
    for (const v of violations) console.error(`  [${v.rule}] ${v.key}`);
    process.exit(1);
  }
  console.log(
    `application-readwrite: PASS — ${stats.registered} ملف قارئ مسجلًا + ${stats.autoEnrolled} موسوم PC-4؛ صفر استدعاءات كتابة (save/commit/delete/replace/clear بأول حرف كبير)؛ القارئ لا يكتب حتميًا في حدود المفردات الموثقة (R5/S3 — F-08)`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
