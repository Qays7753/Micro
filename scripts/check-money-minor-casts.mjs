#!/usr/bin/env node
/**
 * R11 W1A-2 / D-02 (R10A-F-013، قرار OD-MONEY الخيار A، 2026-10-13): مراقب
 * casts ومزج الوحدات حول عائلة `*Minor` — **مراقبة فقط، لا تغيير تمثيل**.
 *
 * السياسة المرصدة (OD-MONEY): يبقى `MoneyMinor = number` (المعلن الوحيد:
 * src/domain/shared/currency.ts:2) — لا علامة نوع (branding) جزئية أو
 * كاملة الآن (W5 مغلقة بمحفزات موثقة)، ولا تغيير حسابات النواة الصحيحة
 * أو المنسّق أو الكاتب أو التمثيل المحفوظ. هذا الحارس يجعل الانحراف
 * الصرفي مرئيًا لا صامتًا.
 *
 * المُسند المسجل حرفيًا (منهج العد — قابل لإعادة الإنتاج):
 *  - **الداخل (ENTERING):** أي تأكيد نوع (`x as T` أو `<T>x`) نص نوعه يطابق
 *    `/\w*Minor\b/` (يشمل `as MoneyMinor` و`<MoneyMinor>x` و
 *    `as unknown as MoneyMinor` و`as MoneyMinor[]`) خارج المناطق المعتمدة —
 *    الأساس **صفر مواقع**. أي ظهور = فشل (لا إرساء تراكمي لهذا الصنف).
 *  - **الخارج (EXITING):** تأكيدٌ تعبيره ينتهي بمعرّف `…Minor` (الورقة
 *    الأخيرة في نص التعبير) إلى نوع غير-Minor:
 *      · `as number` — تضييق هوية بعد فحوص null (MoneyMinor = number
 *        بالسياسة): **راتشة عضوية** على 13 موقعًا مقيسة حية عند 5ef4ce08؛
 *        النمو أو غياب موقع = فشل (إعادة إرساء بنفس الـPR).
 *      · أي نوع آخر (`as unknown` و`as string` ووحدة أخرى…) = **غير مصرح**
 *        إطلاقًا — فشل دائم (جسر التبييض `as unknown` يُصاد هنا قبل طبقته).
 *  - **المناطق المعتمدة المستثناة من العد:** `src/domain/shared/` (بيت
 *    النواة: currency.ts صاحب persistedMoneyTextMinor + numeric.ts) و
 *    `apps/prototype-web/client/src/application/formatting/` (بيت منسّق
 *    العرض: formatters.ts صاحب formatMoneyMinor). ما عدا ذلك مراقب بالكامل.
 *  - الفحص صرفي تركيبي (AST بلا Program ولا مدقق أنواع) — طبقة الاسم
 *    (تعبير معرّف/وصول خاصية ينتهي بـ…Minor) **مكملة** لا حصرية ومحصورة
 *    بالأشكال النوعية للمعرّفات (نص اعتباطي ينتهي بكلمة Minor — كقيم كائن
 *    حرفي — ليس قيمة مسماة): قيمة Minor مُمرَّرة عبر وسيط غير مسمى تهرّب
 *    من طبقة الخارج (فجوة موثقة) لكن طبقة الداخل (نوع التأكيد) تبقى
 *    الحماية الأولية، وW5 تفتح فقط بمحفز مالك موثق.
 *  - النطاق: ملفات الإنتاج تحت src/ وapps/prototype-web/client/src/
 *    (الاختبارات والfixtures خارج النطاق — لها أنواعها الخاصة).
 *
 * الفشول: ENTERING_CAST / EXIT_CAST_UNAUTHORIZED / EXIT_NARROWING_GROWTH /
 * EXIT_NARROWING_STALE — كل برسالته المميزة.
 *
 * الاستخدام: node scripts/check-money-minor-casts.mjs [repoRoot]
 * الخروج: 0 = مطابق للأساس؛ 1 = أي خرق؛ 2 = خطأ استخدام.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** عائلة Minor النوعية — مطابقة على نص نوع التأكيد. */
export const MINOR_TYPE_PATTERN = /\w*Minor\b/;
/** المناطق المعتمدة (kernels/formatter) — خارج العد بقرار OD-MONEY. */
export const APPROVED_ZONES = [
  "src/domain/shared/",
  "apps/prototype-web/client/src/application/formatting/",
];

/**
 * أساس تضييق الهوية الخارجي (13 موقعًا مقيسة حية عند 5ef4ce08 بتاريخ
 * 2026-10-14) — مفاتيح مستقرة بالمحتوى (الملف :: نص التعبير as number)
 * مع تعداد كل مفتاح (موقعان متطابقان النص في نفس الملف = عدّ 2).
 */
export const EXIT_NARROWING_BASELINE = {
  "apps/prototype-web/client/src/application/inventory/inventoryMaterialLifecycle.ts :: input.opening.valueMinor as number": 3,
  "apps/prototype-web/client/src/application/inventory/inventoryMaterialLifecycle.ts :: input.valueMinor as number": 3,
  "apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts :: value.residualValueMinor as number": 2,
  "apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts :: value.cashDeltaMinor as number": 1,
  "apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts :: value.valueDeltaMinor as number": 1,
  "apps/prototype-web/client/src/application/transfers/transferSnapshotValidation.ts :: entry.cashDeltaMinor as number": 3,
};

const isTestFile = filePath => /\.(?:test|spec|fixture)\.[jt]sx?$/.test(filePath) || filePath.includes("__fixtures__");
const isDist = filePath => filePath.includes(`${path.sep}dist${path.sep}`);
const inApprovedZone = relative => APPROVED_ZONES.some(zone => relative.startsWith(zone));

function collectProductionFiles(directory) {
  const results = [];
  if (!fs.existsSync(directory)) return results;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
      results.push(...collectProductionFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (isTestFile(full) || isDist(full)) continue;
    results.push(full);
  }
  return results;
}

/** هل التعبير معرّفًا/وصول خاصية ينتهي اسمه بـ Minor؟ (طبقة الاسم المكملة —
 * محصورة بالأشكال النوعية Identity/PropertyAccess عمدًا: نص اعتباطي ينتهي
 * بكلمة Minor — مثل قيم كائن حرفي — ليس «قيمة مسماة Minor»، والفارق جوهري
 * لا تجميلي: الطبقة مكملة والدقة شرط قبولها. */
export function isMinorNamedValueExpression(node) {
  if (ts.isIdentifier(node)) return /Minor$/.test(node.text);
  if (ts.isPropertyAccessExpression(node)) return /Minor$/.test(node.name.text);
  return false;
}

/**
 * جرد تأكيدات النوع في ملف واحد (AST) — يعيد {entering, exiting} حيث
 * entering = تأكيدات بنوع Minor، وexiting = تأكيدات بتعبير …Minor إلى نوع
 * غير Minor (مصنفة number مقابل غير ذلك).
 */
export function collectCastSites(sourceFile, relative) {
  const entering = [];
  const exiting = [];
  const visit = node => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      const typeText = node.type.getText(sourceFile);
      const expressionText = node.expression.getText(sourceFile);
      const typeIsMinor = MINOR_TYPE_PATTERN.test(typeText);
      const expressionIsMinorNamed = isMinorNamedValueExpression(node.expression);
      if (typeIsMinor) {
        entering.push({ file: relative, type: typeText, expression: expressionText });
      } else if (expressionIsMinorNamed) {
        exiting.push({
          file: relative,
          expression: expressionText,
          type: typeText,
          identityNarrowing: typeText === "number",
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { entering, exiting };
}

/** الفحص الكامل — يعيد الخروق والإحصاءات. */
export function checkMoneyMinorCasts(root = ROOT) {
  const violations = [];
  const scanned = collectProductionFiles(path.join(root, "src")).concat(
    collectProductionFiles(path.join(root, "apps", "prototype-web", "client", "src")),
  );
  const liveNarrowing = new Map();
  let enteringTotal = 0;
  let exitingUnauthorizedTotal = 0;
  let zoneSkipped = 0;
  for (const file of scanned) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    if (inApprovedZone(relative)) {
      /* المناطق المعتمدة خارج العد عمدًا (kernels/formatter — OD-MONEY). */
      const content = fs.readFileSync(file, "utf8");
      zoneSkipped += content.length;
      continue;
    }
    const content = fs.readFileSync(file, "utf8");
    if (!/Minor/.test(content)) continue; /* تسريع: بلا Minor لا مواقع */
    const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, kind);
    const { entering, exiting } = collectCastSites(sourceFile, relative);
    for (const site of entering) {
      enteringTotal += 1;
      violations.push({
        rule: "ENTERING_CAST",
        key: `${site.file} :: ${site.expression} as ${site.type}`,
        hint: "تأكيد نوع جديد يدخل عائلة *Minor خارج المناطق المعتمدة (OD-MONEY): قيم Minor تُشتق عبر النواة الصحيحة لا بالتأكيد الصرفي — أزله أو سجّل قرار مالك موثقًا (W5 مغلقة)",
      });
    }
    for (const site of exiting) {
      if (!site.identityNarrowing) {
        exitingUnauthorizedTotal += 1;
        violations.push({
          rule: "EXIT_CAST_UNAUTHORIZED",
          key: `${site.file} :: ${site.expression} as ${site.type}`,
          hint: "تأكيد من قيمة …Minor إلى نوع غير رقمي/غير Minor (OD-MONEY): مزج وحدات أو جسر تبييض — ممنوع خارج المناطق المعتمدة مهما كان السياق",
        });
        continue;
      }
      const key = `${site.file} :: ${site.expression} as number`;
      liveNarrowing.set(key, (liveNarrowing.get(key) ?? 0) + 1);
    }
  }
  /* راتشة تضييق الهوية: النمو والغياب كلاهما مرئي. */
  for (const [key, liveCount] of liveNarrowing) {
    const baselineCount = EXIT_NARROWING_BASELINE[key] ?? 0;
    if (liveCount > baselineCount) {
      violations.push({
        rule: "EXIT_NARROWING_GROWTH",
        key: `${key} (x${liveCount} > x${baselineCount})`,
        hint: "موقع تضييق هوية جديد على قيمة …Minor (OD-MONEY/D-02): النمو يتطلب إعادة إرساء موثقة في نفس الـPR — لا تراكم صامت",
      });
    }
  }
  for (const [key, baselineCount] of Object.entries(EXIT_NARROWING_BASELINE)) {
    const liveCount = liveNarrowing.get(key) ?? 0;
    if (liveCount < baselineCount) {
      violations.push({
        rule: "EXIT_NARROWING_STALE",
        key: `${key} (x${liveCount} < x${baselineCount})`,
        hint: "موقع تضييق هوية مسجل غادر أو تغيّر نصه — حدّث EXIT_NARROWING_BASELINE في نفس الـPR ليبقى العد دقيقًا",
      });
    }
  }
  return {
    ok: violations.length === 0,
    violations,
    stats: {
      scannedFiles: scanned.length,
      entering: enteringTotal,
      exitingUnauthorized: exitingUnauthorizedTotal,
      exitingNarrowing: [...liveNarrowing.values()].reduce((sum, count) => sum + count, 0),
      baselineNarrowing: Object.values(EXIT_NARROWING_BASELINE).reduce((sum, count) => sum + count, 0),
    },
  };
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  if (!fs.existsSync(path.join(repoRoot, "package.json"))) {
    console.error("check-money-minor-casts: USAGE: node scripts/check-money-minor-casts.mjs [repoRoot]");
    process.exit(2);
  }
  const { ok, violations, stats } = checkMoneyMinorCasts(repoRoot);
  if (!ok) {
    console.error(`check-money-minor-casts: FAIL — ${violations.length} خرقًا:`);
    for (const violation of violations) console.error(`  [${violation.rule}] ${violation.key}`);
    process.exit(1);
  }
  console.log(
    `check-money-minor-casts: PASS — ${stats.scannedFiles} ملف إنتاج مفحوصًا (خارج المناطق المعتمدة)؛ صفر تأكيدات داخلية إلى عائلة Minor (أساس 0)؛ صفر تأكيدات خارجية غير مصرحة؛ ${stats.exitingNarrowing}/${stats.baselineNarrowing} موقع تضييق هوية as-number مطابقًا للأساس (D-02/OD-MONEY — MoneyMinor = number كما هو؛ W5 مغلقة بمحفزاتها)`,
  );
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
