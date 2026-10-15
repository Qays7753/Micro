#!/usr/bin/env node
/**
 * R11 ARCH-010 (موجة المتابعة 2026-10-15): حارس تخزين التشخيص المخصص —
 * فاشل-المغلق، مسجل-البنود — يرفض أي وصول إنتاجي جديد لمفاتيح تخزين
 * المتصفح (`localStorage`/`sessionStorage`) في كود العميل كله (طبقات
 * التطبيق والتخزين والصفحات والمكونات وجذر التركيب وPWA وغيرها)، ولا
 * يقبل إلا المواضع المسجلة بالضبط — لا قائمة `localStorage` عامة ولا
 * استثناء مجهول.
 *
 *  - الكشف AST (محلل TypeScript نفسه) لا نصًا: يلتقط المرجع المجرد
 *    (`localStorage.getItem`)، والوصول الخاص بجذر window/globalThis/self
 *    (`globalThis.localStorage` مع `?.` أو بدونه)، والوصول المحسوب الحرفي
 *    (`globalThis["localStorage"]`)، وتفكيك الكائن
 *    (`const {localStorage: ls} = globalThis` و`const {localStorage} = …`)،
 *    وربط الاستيراد/التصدير بالاسمين. التعليقات لا تُحتسب (ليست عقدًا).
 *  - الموضع المسجل حرفيًا (واحد فقط):
 *    `storage/diagnostics/browserDiagnosticStorage.ts` — مهايئ تشخيص
 *    المتصفح (الحد الجذري لـ R11-W1A-NF-001)؛ ويتحقق الحارس إضافيًا أنه
 *    لا يستورد من `@/storage/local` (قرار العقد: لا توجيه للتشخيص عبر
 *    منفذ التخزين المالية/المحلية أبدًا).
 *    R11 ARCH-012 (2026-10-15 — تقاعد مؤرخ): الاستثناء التراثي الثاني
 *    (application/drafts/legacyFormDraftMigration.ts — R11-ARCH010-NF-001)
 *    أُزيل مع تقاعد الترحيل بقرار المالك الموثق؛ عودة أي مهايئ مسودات
 *    تراثي = خرق غير مسجل يُرفض فورًا (القرار والإثبات في
 *    r11-arch012-20261015/evidence/).
 *  - موضع مسجل غادر الشجرة = فشل (تسجيل متقادم).
 *
 * لا يثبت (حدود موثقة):
 *  1) الوصول المحسوب بدمج نصي (`globalThis["local"+"Storage"]`) خارج الكشف
 *     الحرفي — نفس حد كل حراس AST في هذا المستودع؛ الحارس يجعل الاندراف
 *     مرئيًا لا مستحيلًا.
 *  2) `indexedDB` ليس نطاق هذا الحارس — له بنية مسجلة قائمة
 *     (`storage/local/indexedDbLifecycle.ts`) وحراسها.
 *
 * الاستخدام: node scripts/check-diagnostics-storage.mjs [repoRoot].
 * الخروج: 0 = نظيف؛ 1 = أي خرق؛ 2 = خطأ استخدام.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { ROOT } from "./check-runtime-cycles.mjs";

const CLIENT_SRC = path.join("apps", "prototype-web", "client", "src");
const TEST_PAT = /\.(test|spec|dom\.test|ui\.test|contract\.test|characterization\.test|mutation\.test)\.[cm]?[jt]sx?$/;
const SOURCE_EXT = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
const WEB_STORAGE_KEYS = new Set(["localStorage", "sessionStorage"]);
const GLOBAL_RECEIVERS = new Set(["window", "globalThis", "self", "global"]);

/** المدخل المسجل حرفيًا (registered-entry) — لا اجتهاد في العدّ.
 * R11 ARCH-012 (2026-10-15): المدخل التراثي الثاني أُزيل بتقاعد الترحيل. */
export const REGISTERED_DIAGNOSTICS_ADAPTER = path.join(
  CLIENT_SRC, "storage", "diagnostics", "browserDiagnosticStorage.ts",
);
export const REGISTERED_ENTRIES = [
  {
    file: REGISTERED_DIAGNOSTICS_ADAPTER,
    reason: "مهايئ تشخيص المتصفح — الحد الجذري R11-W1A-NF-001 (ARCH-010)",
  },
];

function listClientSourceFiles(repoRoot) {
  const out = [];
  const dir = path.join(repoRoot, CLIENT_SRC);
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

/** جذر سلسلة الوصول الخاص: `a.b.c` → معرّف `a` (أو null). */
function receiverRoot(expr) {
  let current = expr;
  while (ts.isPropertyAccessExpression(current)) current = current.expression;
  return ts.isIdentifier(current) ? current.text : null;
}

/** هل المعرّف في موقع اسم-خاصية (تعريف عضو/توقيع) لا قراءة قيمة؟ */
function isTypeMemberName(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isPropertySignature(parent) || ts.isMethodSignature(parent)) return parent.name === node;
  if (ts.isPropertyDeclaration(parent) || ts.isMethodDeclaration(parent)) return parent.name === node;
  return false;
}

/** كشف كل مواضع لمس تخزين المتصفح داخل ملف واحد (AST). */
export function webStorageAccessSites(fileName, content) {
  const sf = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
  const sites = [];
  const record = (node, kind) => sites.push({
    line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
    kind,
    text: node.getText(sf).slice(0, 100),
  });
  const visit = node => {
    if (ts.isPropertyAccessExpression(node)) {
      if (WEB_STORAGE_KEYS.has(node.name.text)) {
        const root = receiverRoot(node.expression);
        if (root !== null && GLOBAL_RECEIVERS.has(root)) record(node, `global-receiver property access`);
      }
    } else if (ts.isElementAccessExpression(node)) {
      if (ts.isStringLiteral(node.argumentExpression) && WEB_STORAGE_KEYS.has(node.argumentExpression.text)) {
        record(node, "computed literal access");
      }
    } else if (ts.isIdentifier(node)) {
      if (!WEB_STORAGE_KEYS.has(node.text)) { /* fallthrough */ }
      else {
        const parent = node.parent;
        if (!parent) { /* orphan — treat as reference */ }
        else if (isTypeMemberName(node)) { /* تعريف عضو نوع — ليس وصولًا */ }
        else if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
          /* اسم خاصية على مستقبِل غير معروف — يُفحص أعلاه عبر الجذر فقط */
        } else if (
          (ts.isBindingElement(parent) && parent.name === node && parent.propertyName === undefined) ||
          (ts.isBindingElement(parent) && parent.propertyName === node)
        ) {
          record(node, "object binding pattern");
        } else if (
          (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isImportClause(parent)) &&
          (parent.name === node || parent.propertyName === node)
        ) {
          record(node, "import/export binding");
        } else if (
          ts.isVariableDeclaration(parent) && parent.name === node
        ) {
          /* تصريح متغير بهذا الاسم نفسه يظل مشبوهًا (تظليل) — يُسجل */
          record(node, "identifier declaration/alias");
        } else if (
          ts.isPropertyAssignment(parent) && parent.name === node
        ) {
          /* مفتاح كائن حرفي بهذا الاسم (تشكيل كائن تخزين مزيف) — يُسجل */
          record(node, "object literal key");
        } else if (
          !(ts.isPropertyAccessExpression(parent) && parent.name === node) &&
          !ts.isQualifiedName(parent)
        ) {
          /* كل موقع مرجعي آخر: المستقبِل المجرد (sessionStorage.getItem) أو
           * القراءة المباشرة أو الوسيطة — يُسجل. موقع الاسم على مستقبِل غير
           * معروف يبقى لفحص الجذر أعلاه فقط. */
          record(node, "bare identifier reference");
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return sites;
}

/** الفحص الكامل: يعيد الخروق والإحصاءات. */
export function checkDiagnosticsStorage(repoRoot) {
  const violations = [];
  const registered = new Map(REGISTERED_ENTRIES.map(e => [e.file, e.reason]));
  let scanned = 0;
  let accessSites = 0;
  for (const full of listClientSourceFiles(repoRoot)) {
    const rel = path.relative(repoRoot, full).split(path.sep).join("/");
    scanned += 1;
    const content = fs.readFileSync(full, "utf8");
    const sites = webStorageAccessSites(full, content);
    if (registered.has(rel)) {
      accessSites += sites.length;
      continue;
    }
    for (const site of sites) {
      violations.push({
        rule: "unregistered-web-storage-access",
        key: `${rel}:${site.line} — ${site.kind} (${site.text})`,
      });
    }
  }
  for (const entry of REGISTERED_ENTRIES) {
    if (!fs.existsSync(path.join(repoRoot, entry.file))) {
      violations.push({
        rule: "registered-entry-stale",
        key: entry.file,
      });
    }
  }
  /* فصل الحدود (قرار العقد): المهايئ المسجل لا يستورد من منفذ التخزين
   * المالية/المحلية أبدًا — التشخيص غير مالي ومحلي ومعزول عمدًا. */
  const adapterPath = path.join(repoRoot, REGISTERED_DIAGNOSTICS_ADAPTER);
  if (fs.existsSync(adapterPath)) {
    const adapterContent = fs.readFileSync(adapterPath, "utf8");
    if (/@\/storage\/local|\.\.\/local\b/.test(adapterContent)) {
      violations.push({
        rule: "diagnostics-adapter-routed-through-local-storage-port",
        key: REGISTERED_DIAGNOSTICS_ADAPTER,
      });
    }
  }
  return {
    ok: violations.length === 0,
    violations,
    stats: { scanned, registeredEntries: REGISTERED_ENTRIES.length, exemptedSites: accessSites },
  };
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  if (!fs.existsSync(path.join(repoRoot, "package.json"))) {
    console.error("diagnostics-storage: USAGE: node scripts/check-diagnostics-storage.mjs [repoRoot]");
    process.exit(2);
  }
  const { ok, violations, stats } = checkDiagnosticsStorage(repoRoot);
  if (!ok) {
    console.error(`diagnostics-storage: FAIL — ${violations.length} خرقًا:`);
    for (const v of violations) console.error(`  [${v.rule}] ${v.key}`);
    process.exit(1);
  }
  console.log(
    `diagnostics-storage: PASS — ${stats.scanned} ملف إنتاج زُرع؛ صفر وصول غير مسجل لمفاتيح تخزين المتصفح؛ الموضع المسجل الوحيد بالضبط: مهايئ التشخيص (${REGISTERED_DIAGNOSTICS_ADAPTER} — R11-W1A-NF-001)؛ الاستثناء التراثي للمسودات أُزيل بتقاعد ARCH-012 (2026-10-15)؛ والمهايئ نظيف من منفذ التخزين المالية/المحلية (فصل الحدود سارٍ)`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
