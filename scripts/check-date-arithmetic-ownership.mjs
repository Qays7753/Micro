#!/usr/bin/env node
/**
 * Guard: date-arithmetic ownership (R2 — M-09, WS-216/ARCH-007, 2026-10-08;
 * tightened after the final five-role review — FH-4/FA-02/FA-03/FT-3).
 *
 * Every date defect R2 repaired came from date logic living outside the
 * canonical kernel: numeric Date.UTC calls remapping years < 100 to 1900+,
 * noon-anchor toISOString RangeErrors, calendar-blind regexes accepting
 * rollover dates, and business dates derived by slicing UTC timestamps.
 * The kernel (src/domain/shared/numeric.ts) owns validity and arithmetic as
 * pure integer computation; businessTime owns Amman derivation. This guard
 * keeps that true:
 *
 *  R1 — `Date.UTC(` (including bracket access like Date["UTC"](...)) is
 *       FORBIDDEN in all production code under src/ and
 *       apps/prototype-web/client/src/ — zero exceptions (pure-integer
 *       kernel arithmetic replaces it everywhere).
 *  R2 — `new Date(` inside src/domain/ is allowed ONLY in the exact file
 *       src/domain/shared/businessTime.ts (the owned instant-parsing/
 *       Amman-derivation contract) — file-level, not directory-level.
 *  R3 — `Date.parse(` inside src/domain/ is allowed ONLY in the exact file
 *       src/domain/shared/numeric.ts (isValidTimestamp).
 *  R4 — raw business-date slicing (`.slice(0,10)` / `.substring(0,10)` /
 *       `.split("T")[0]`) is forbidden across ALL layers of
 *       apps/prototype-web/client/src/ EXCEPT as the fallback branch of a
 *       guarded derivation — the R2-D4 clock-slicing bug class can never
 *       return in any layer.
 *       **R11 W1A-2 / D-03 (R10A-F-014، قرار OD-GUARD الخيار A، 2026-10-14):
 *       الإعفاء صار مربوطًا بالـAST لا بالنص** — الكشف والربط عبر تحليل
 *       تحليلي بـ`ts.createSourceFile` (بلا Program ولا مدقق أنواع ولا حل
 *       وحدات ولا تنفيذ): العقدة القاطعة معفاة **فقط** إذا كانت المعامل
 *       الأيمن المباشر لتعبير `??` ثلاثي، والإعفاء مثبت على المواقع الخمسة
 *       المعتمدة حصرًا (الملف + نص المعامل الأيسر + نص مستقبل القص + نوع
 *       القص) — تعليق يحوي `??`، أو نص يحويه، أو `??` مجاور في نفس السطر،
 *       أو `||` بدله: لا يُعفي أيٌّ منها (سلبيات مثبتة). أي سادس fallback
 *       محروس يُرفض حتى إعادة إرساء موثقة، وأي موقع مثبت تغيّر أو غادر
 *       يُرفض، وخطأ التحليل يُفشل الحارس فاشلًا-مغلقًا (parseDiagnostics).
 *       مجموعة الملفات الممسوحة هي نفسها مجموعة الحارس النصي السابق
 *       (collectProductionFiles) — superset بالتساوي.
 *  R5 (date-ownership R5 — M-11/D13, 2026-10-08): a zero-argument
 *       `localDateInAmman()` call, or one whose argument is a directly
 *       constructed ambient `new Date()`, is FORBIDDEN in all production
 *       code — the instant must be explicit (an injected clock value, a
 *       stored timestamp, or the named application boundary todayInAmman).
 *       Known limitation, by design: bare function REFERENCES
 *       (`useState(localDateInAmman)`) are not zero-arg calls and are not
 *       matched here — after D13 the parameter is required, so TypeScript
 *       rejects that shape at compile time (tsc is the enforcement layer
 *       for references; this guard is the enforcement layer for calls).
 *  R6 (date-ownership R6 — M-11/D13, 2026-10-08): a zero-argument ambient
 *       `new Date()` is FORBIDDEN inside src/domain/** — including
 *       businessTime.ts itself, the former home of the default. Parsing an
 *       explicit input (`new Date(instant)`) stays legal in businessTime.ts
 *       (R2 above); ambient construction of "now" anywhere in the domain
 *       fails. The ONLY active ambient clock in the app is systemClock
 *       (application/time/clock.ts — the documented infra boundary).
 *
 * R1/R2/R3/R5/R6 remain text-based (out of D-03's approved scope); comments
 * are stripped with string-literal awareness for them (a `//` inside quotes
 * never blanks a line). R4 is AST-bound (see above). Test files, fixtures,
 * and dist output are out of scope (tests legitimately build clocks and
 * legacy-comparison algorithms).
 *
 * FAILS on the first violation with file:line and the rule text; exit 0 only
 * when the whole production tree is clean.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SCANNED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const isTestFile = filePath => /\.(?:test|spec|fixture)\.[jt]sx?$/.test(filePath) || filePath.includes("__fixtures__");
const isDist = filePath => filePath.includes(`${path.sep}dist${path.sep}`);

/** Walk a directory collecting production files with a scanned extension. */
export function collectProductionFiles(directory) {
  const results = [];
  if (!fs.existsSync(directory)) return results;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
      results.push(...collectProductionFiles(full));
      continue;
    }
    if (!SCANNED_EXTENSIONS.has(path.extname(entry.name))) continue;
    if (isTestFile(full) || isDist(full)) continue;
    results.push(full);
  }
  return results;
}

/**
 * Strip comments with string-literal awareness: a `//` inside a quoted string
 * never starts a comment (FH-4 remediation — a literal like "a//b" used to
 * blank the rest of the line and could hide violations).
 */
export function stripComments(text) {
  let result = "";
  let quote = null; /* current quote char when inside a string */
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quote !== null) {
      result += char;
      if (char === "\\") {
        result += next ?? "";
        index += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      result += char;
      continue;
    }
    if (char === "/" && next === "/") {
      /* line comment: blank to end of line (keep the newline) */
      while (index < text.length && text[index] !== "\n") index += 1;
      result += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      /* block comment: blank, preserve newlines for line numbering */
      index += 2;
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) {
        if (text[index] === "\n") result += "\n";
        index += 1;
      }
      index += 1;
      continue;
    }
    result += char;
  }
  return result;
}

/** Numeric Date.UTC in direct or bracket-access form — R1's detection set. */
export const DATE_UTC_PATTERN = /Date\s*\.\s*UTC\s*\(|Date\s*\[\s*["']UTC["']\s*\]/;

/** Zero-argument or ambient-new-Date localDateInAmman calls — R5's detection set. */
export const AMBIENT_LOCAL_DATE_PATTERN =
  /localDateInAmman\s*\(\s*\)|localDateInAmman\s*\(\s*new\s+Date\s*\(\s*\)\s*\)/;

/** Zero-argument ambient Date construction — R6's detection set (domain only). */
export const AMBIENT_NEW_DATE_PATTERN = /new\s+Date\s*\(\s*\)/;

/* ─── R4 (D-03 — R11 W1A-2): الكشف والربط التحليلي ───────────────────────────
 * خمسة مواقع معتمدة (قياس حي عند 5ef4ce08 بتاريخ 2026-10-14) — كل موقع
 * مثبت بالملف + نص المعامل الأيسر + مستقبل القص + نوع القص؛ تغيّر أي مكوّن
 * = إعادة إرساء في نفس الـPR (لا موقع سادس، ولا تعديل صامت). */
export const GUARDED_FALLBACK_SITES = [
  {
    file: "apps/prototype-web/client/src/components/finance/CorrectionsLayer.tsx",
    left: "formatLocalDate(businessDateFromTimestamp(entry.recordedAt))",
    receiver: "entry.recordedAt",
    kind: "slice",
  },
  {
    file: "apps/prototype-web/client/src/components/settings/SettingsDataProtectionSection.tsx",
    left: "formatLocalDate(businessDateFromTimestamp(lastExport))",
    receiver: "lastExport",
    kind: "slice",
  },
  {
    file: "apps/prototype-web/client/src/components/forms/FormDraftRestoreBanner.tsx",
    left: "formatLocalDate(businessDateFromTimestamp(savedAt))",
    receiver: "savedAt",
    kind: "slice",
  },
  {
    file: "apps/prototype-web/client/src/application/financial-records/correctionHistoryService.ts",
    left: "ammanDateOrNull(revision.createdAt)",
    receiver: "revision.createdAt",
    kind: "slice",
  },
  {
    file: "apps/prototype-web/client/src/application/financial-records/correctionHistoryService.ts",
    left: "ammanDateOrNull(revision.changedAt)",
    receiver: "revision.changedAt",
    kind: "slice",
  },
];

const guardedSiteKey = site => `${site.file} :: ${site.left} ?? ${site.receiver}.${site.kind}`;

/** ScriptKind صريح لكل امتداد (RV3-A1: الاستدلال العام يفسد تحليل 140/427). */
function scriptKindFor(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".ts")) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

/** هل العقدة رقم حرفي بقيمة معينة؟ */
function isNumericLiteralOf(node, value) {
  return node !== undefined && ts.isNumericLiteral(node) && Number(node.text) === value;
}

/**
 * كشف مواقع القص الخام تحليليًا داخل ملف واحد (بلا Program ولا فحص أنواع):
 *  - CallExpression بمستقبل slice/substring ووسيطين حرفيين 0 و10؛
 *  - ElementAccessExpression بفهرس 0 فوق استدعاء split("T").
 * يعيد قائمة {node, kind, receiverText} — العقدة هي التعبير الخام كله.
 */
export function findRawDateSlicesAst(sourceFile) {
  const found = [];
  const visit = node => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (
        ts.isPropertyAccessExpression(callee) &&
        (callee.name.text === "slice" || callee.name.text === "substring") &&
        node.arguments.length === 2 &&
        isNumericLiteralOf(node.arguments[0], 0) &&
        isNumericLiteralOf(node.arguments[1], 10)
      ) {
        found.push({ node, kind: callee.name.text, receiverText: callee.expression.getText(sourceFile) });
      } else if (
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === "split" &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text === "T" &&
        ts.isElementAccessExpression(node.parent) &&
        isNumericLiteralOf(node.parent.argumentExpression, 0)
      ) {
        found.push({ node: node.parent, kind: "splitT", receiverText: callee.expression.getText(sourceFile) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/** هل العقدة المعامل الأيمن المباشر لتعبير ?? (الربط التحليلي للإعفاء)؟ */
export function isDirectNullishRightOperand(node) {
  return (
    node.parent !== undefined &&
    ts.isBinaryExpression(node.parent) &&
    node.parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken &&
    node.parent.right === node
  );
}

/**
 * Evaluate the six ownership rules over the production tree.
 * Returns an array of violation objects { rule, file, line, excerpt }.
 */
export function findViolations(root = ROOT) {
  const violations = [];
  const scanned = collectProductionFiles(path.join(root, "src")).concat(
    collectProductionFiles(path.join(root, "apps", "prototype-web", "client", "src")),
  );

  /* تعداد المواقع المحروسة الحية للتحقق من مطابقة الأساس الخماسي. */
  const liveGuardedKeys = new Set();

  for (const file of scanned) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    const content = fs.readFileSync(file, "utf8");

    /* ── R4 (D-03): التحليل التحليلي — فشل مغلق على أخطاء التحليل. ── */
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, scriptKindFor(file));
    if (sourceFile.parseDiagnostics.length > 0) {
      const first = sourceFile.parseDiagnostics[0];
      violations.push({
        rule: "R4-PARSE-ERROR (fail-closed — AST exemption requires a parseable file)",
        file: relative,
        line: first.start === undefined ? 1 : sourceFile.getLineAndCharacterOfPosition(first.start).line + 1,
        excerpt: "(parse diagnostic — content not excerpted)",
      });
      continue; /* لا فحص نصي آخر لملف لا يُحلَّل — فاشل مغلق. */
    }
    for (const slice of findRawDateSlicesAst(sourceFile)) {
      if (isDirectNullishRightOperand(slice.node)) {
        /* fallback محروس: يجب أن يكون أحد المواقع الخمسة المعتمدة بالنص الكامل. */
        const parent = slice.node.parent;
        const site = {
          file: relative,
          left: parent.left.getText(sourceFile),
          receiver: slice.receiverText,
          kind: slice.kind,
        };
        liveGuardedKeys.add(guardedSiteKey(site));
        if (!GUARDED_FALLBACK_SITES.some(pinned => guardedSiteKey(pinned) === guardedSiteKey(site))) {
          violations.push({
            rule: "R4-guarded-fallback-unregistered (سادس fallback محروس — D-03: خمسة مواقع فقط معتمدة)",
            file: relative,
            line: sourceFile.getLineAndCharacterOfPosition(slice.node.getStart()).line + 1,
            excerpt: `${site.left} ?? ${site.receiver}.${slice.kind}(…)`,
          });
        }
      } else {
        violations.push({
          rule: "R4 (raw business-date slicing — use localDateInAmman/businessDateFromTimestamp)",
          file: relative,
          line: sourceFile.getLineAndCharacterOfPosition(slice.node.getStart()).line + 1,
          excerpt: `${slice.receiverText}.${slice.kind === "splitT" ? 'split("T")[0]' : `${slice.kind}(0, 10)`} (AST-bound — الإعفاء يتطلب أن يكون القص المعامل الأيمن المباشر لـ ??)`,
        });
      }
    }

    /* ── R1/R2/R3/R5/R6: كما هي — نصية، خارج نطاق D-03 المعتمد. ── */
    const code = stripComments(content);
    const lines = code.split("\n");
    lines.forEach((line, index) => {
      const at = { file: relative, line: index + 1, excerpt: line.trim().slice(0, 120) };
      /* R1: numeric Date.UTC anywhere in production (direct or bracket access). */
      if (DATE_UTC_PATTERN.test(line)) {
        violations.push({ rule: "R1 (Date.UTC outside the pure-integer kernel)", ...at });
      }
      /* R2/R3: the Date object and Date.parse are kernel-file-only inside the domain. */
      if (relative.startsWith("src/domain/") && relative !== "src/domain/shared/businessTime.ts") {
        if (line.includes("new Date(")) {
          violations.push({ rule: "R2 (new Date in domain outside shared/businessTime.ts)", ...at });
        }
      }
      if (relative.startsWith("src/domain/") && relative !== "src/domain/shared/numeric.ts") {
        if (line.includes("Date.parse(")) {
          violations.push({ rule: "R3 (Date.parse in domain outside shared/numeric.ts)", ...at });
        }
      }
      /* R5 (date-ownership): zero-arg or ambient-new-Date localDateInAmman
       * calls are forbidden in ALL production layers. */
      if (AMBIENT_LOCAL_DATE_PATTERN.test(line)) {
        violations.push({
          rule: "R5 (localDateInAmman without an explicit instant — use todayInAmman() or pass a clock/timestamp)",
          ...at,
        });
      }
      /* R6 (date-ownership): ambient zero-arg new Date() is forbidden in the
       * domain — even inside businessTime.ts (the default's former home). */
      if (relative.startsWith("src/domain/") && AMBIENT_NEW_DATE_PATTERN.test(line)) {
        violations.push({ rule: "R6 (ambient new Date() in the domain — the only active clock is systemClock)", ...at });
      }
    });
  }

  /* ── نظافة أساس المواقع الخمسة: موقع مثبت غادر أو تغيّر = إعادة إرساء. ── */
  for (const pinned of GUARDED_FALLBACK_SITES) {
    const key = guardedSiteKey(pinned);
    if (!liveGuardedKeys.has(key)) {
      violations.push({
        rule: "R4-guarded-fallback-stale (موقع معتمد غادر الشجرة أو تغيّر نص معامله/مستقبله — أعد الإرساء في نفس الـPR)",
        file: pinned.file,
        line: 0,
        excerpt: key,
      });
    }
  }

  return violations;
}

function main() {
  const violations = findViolations();
  if (violations.length === 0) {
    console.log(
      "check-date-arithmetic-ownership: PASS — no Date.UTC in production; the Date object/Date.parse are kernel-file-only in the domain; no unguarded business-date slicing in any app layer (AST-bound ?? exemption, five approved sites); no localDateInAmman without an explicit instant; no ambient new Date() in the domain (R1–R6 clean).",
    );
    return 0;
  }
  console.error(`check-date-arithmetic-ownership: FAIL — ${violations.length} violation(s):`);
  for (const violation of violations) {
    console.error(`  ${violation.rule}\n    ${violation.file}:${violation.line}\n    ${violation.excerpt}`);
  }
  console.error("\nThe canonical owner is src/domain/shared/numeric.ts (validity + integer arithmetic)");
  console.error("and src/domain/shared/businessTime.ts (Amman business dates). See R2-SEMANTIC-CHANGE-MANIFESTS.md M-09.");
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
