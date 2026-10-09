#!/usr/bin/env node
/**
 * R5/S2 (WS-216/ARCH-007 — 2026-10-09): حارس أسطح أبواب التطبيق — يثبت أن كل
 * باب `application/…/index.ts` (على أي عمق) يصدّر حصرًا رموزه المسجلة قيمةً
 * ونوعًا (PC-3/R0-N20: اختبار العقد يثبت القيم تشغيليًا؛ هذا الحارس يثبت
 * القيم والأنواع معًا استاتيكيًا)، ويحظر البراميل غير المرئية (`export *` و
 * `export * as ns`) في الأبواب، ويحرس طاقم ملفات جذر التطبيق الإنتاجية
 * (`resultCodes.ts` وحده اليوم) وبرميل الجذر إن وُجد يومًا.
 *
 *  - توسيع سطح (رمز جديد بلا تسجيل) = فشل — «توسيع الباب تعديل مقصود»
 *    يظهر في الأساس بنفس الـPR لا صمتًا.
 *  - انكماش سطح (رمز مسجل غادر) = فشل (صف أساس متقادم).
 *  - باب جديد (أي عمق) أو برميل جذر أو ملف جذر إنتاجي جديد غير مسجل = فشل.
 *  - باب مسجل غادر الشجرة = فشل (نظافة الأساس نفس-الـPR).
 *  - `export *` / `export * as ns` في أي باب = فشل (توسيع غير مرئي).
 *
 * لا يثبت: استهلاك كل رمز (جرد المستهلكين عمل السجل الحدي)؛ ولا أسطح
 * واجهات العرض التوافقية الثلاث (مسار T عند موجة UI — السجل الحدي §4).
 *
 * الاستخدام: node scripts/check-application-door-surfaces.mjs [repoRoot].
 * الخروج: 0 = نظيف؛ 1 = أي خرق؛ 2 = خطأ استخدام.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { ROOT } from "./check-runtime-cycles.mjs";

const TEST_PAT = /\.(test|spec|dom\.test|ui\.test|contract\.test|characterization\.test)\.[cm]?[jt]sx?$/;

function applicationRoot(repoRoot) {
  return path.join(repoRoot, "apps", "prototype-web", "client", "src", "application");
}

function hasExportModifier(st) {
  return !!st.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
}

/** استخراج أسطح الباب: رموز القيمة والنوع وأي براميل غير مرئية. */
export function extractDoorSurface(sourceFile) {
  const value = new Set();
  const type = new Set();
  const wildcards = [];
  for (const st of sourceFile.statements) {
    if (ts.isExportDeclaration(st)) {
      if (st.exportClause && ts.isNamedExports(st.exportClause)) {
        for (const el of st.exportClause.elements) {
          const name = (el.propertyName ?? el.name).text;
          (el.isTypeOnly || st.isTypeOnly ? type : value).add(name);
        }
      } else if (st.exportClause && ts.isNamespaceExport(st.exportClause)) {
        wildcards.push(`export * as ${st.exportClause.name.text}`);
      } else if (!st.exportClause) {
        wildcards.push("export *");
      }
    } else if (ts.isExportAssignment(st)) {
      value.add("default");
    } else if (
      (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isEnumDeclaration(st) || ts.isVariableStatement(st)) &&
      hasExportModifier(st)
    ) {
      if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) value.add(d.name.text);
      } else if (st.name) value.add(st.name.text);
    } else if ((ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st)) && hasExportModifier(st)) {
      type.add(st.name.text);
    }
  }
  return { value: [...value].sort(), type: [...type].sort(), wildcards };
}

/** جرد أبواب الشجرة الحية (أي عمق) + ملفات الجذر الإنتاجية. */
export function censusApplicationDoors(repoRoot) {
  const appDir = applicationRoot(repoRoot);
  const walk = (dir, out) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, out);
      else out.push(full);
    }
    return out;
  };
  const doors = {};
  const rootFiles = [];
  for (const full of walk(appDir, [])) {
    const rel = path.relative(appDir, full).split(path.sep).join("/");
    if (TEST_PAT.test(rel) || !/\.(ts|tsx)$/.test(rel)) continue;
    if (rel.endsWith("index.ts")) {
      const sf = ts.createSourceFile(full, fs.readFileSync(full, "utf8"), ts.ScriptTarget.Latest, true);
      doors[rel.slice(0, -"/index.ts".length)] = extractDoorSurface(sf);
    } else if (!rel.includes("/")) {
      rootFiles.push(rel);
    }
  }
  rootFiles.sort();
  return { doors, rootFiles };
}

/** الفحص الكامل: يعيد الخروق والإحصاءات. */
export function checkApplicationDoorSurfaces(repoRoot) {
  const baselinePath = path.join(repoRoot, "scripts", "application-door-surfaces-baseline.json");
  let base = { doors: {}, rootFiles: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    base = { doors: parsed.doors ?? {}, rootFiles: parsed.rootFiles ?? [] };
  } catch {
    /* غياب الأساس = قوائم فارغة: كل باب حي غير مسجل — يفشل مغلقاً */
  }
  const { doors, rootFiles } = censusApplicationDoors(repoRoot);
  const violations = [];
  const diff = (door, kind, live, registered) => {
    for (const s of live.filter(x => !registered.includes(x)))
      violations.push({ rule: "surface-widened", key: `${door} [${kind}] +${s}` });
    for (const s of registered.filter(x => !live.includes(x)))
      violations.push({ rule: "surface-shrunk", key: `${door} [${kind}] -${s}` });
  };
  for (const [door, live] of Object.entries(doors)) {
    const reg = base.doors[door];
    if (!reg) {
      violations.push({ rule: "door-unregistered", key: door });
      continue;
    }
    for (const w of live.wildcards) violations.push({ rule: "wildcard-export-in-door", key: `${door}: ${w}` });
    diff(door, "value", live.value, reg.value ?? []);
    diff(door, "type", live.type, reg.type ?? []);
  }
  for (const door of Object.keys(base.doors)) if (!(door in doors)) violations.push({ rule: "door-stale", key: door });
  for (const f of rootFiles) if (!base.rootFiles.includes(f)) violations.push({ rule: "root-file-unregistered", key: f });
  for (const f of base.rootFiles) if (!rootFiles.includes(f)) violations.push({ rule: "root-file-stale", key: f });
  return {
    ok: violations.length === 0,
    violations,
    stats: { doors: Object.keys(doors).length, rootFiles: rootFiles.length, baselineDoors: Object.keys(base.doors).length },
  };
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  if (!fs.existsSync(path.join(repoRoot, "package.json"))) {
    console.error("application-door-surfaces: USAGE: node scripts/check-application-door-surfaces.mjs [repoRoot]");
    process.exit(2);
  }
  const { ok, violations, stats } = checkApplicationDoorSurfaces(repoRoot);
  if (!ok) {
    console.error(`application-door-surfaces: FAIL — ${violations.length} خرقًا:`);
    for (const v of violations) console.error(`  [${v.rule}] ${v.key}`);
    process.exit(1);
  }
  console.log(
    `application-door-surfaces: PASS — ${stats.doors} بابًا (أي عمق) + ${stats.rootFiles} ملف جذر إنتاجيًا؛ الأسطح (قيمًا وأنواعًا) مطابقة للأساس المسجل؛ صفر توسيع/انكماش/برميل غير مرئي صامت (R5/S2 — PC-3/R0-N20)`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
