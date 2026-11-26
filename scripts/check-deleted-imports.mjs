#!/usr/bin/env node
/**
 * M1.9 (قرار المالك D-10 — 2026-11-26): حارس الاستيراد المحذوف.
 *
 * الغاية: «لا يعود الكود الميت بصمت» — كل حذف يُعلَن في
 * `docs/manage-v2/DELETION-MANIFEST.md` **قبل** وقوعه، وبعد وقوعه (وسم
 * `deleted`) يفشل هذا الحارس إذا:
 *  1) استورد أي ملف إنتاج المسار المحذوف (بالمستعار `@micro-domain/…`
 *     أو `@/…` أو بالمسار النسبي — قيمة أو نوعًا أو ديناميكيًا أو
 *     تصديرًا-من، بتحويل افتراضي لا يشترط وجود الملف)، أو
 *  2) عاد المسار المحذوف نفسه إلى الشجرة (إعادة إحياء صامتة).
 *
 * الصفوف `planned` (المعلنة بعد) لا تُفرض — الجرد إعلان مسبق فقط.
 *
 * مصدر المسح: ملفات الإنتاج تحت `src/` و`apps/prototype-web/client/src/`
 * و`apps/prototype-web/worker/` (بلا اختبارات — عرف حراس المستودع).
 * جمع الاستيرادات يعاد استخدام دوال حارس الحدود نفسها
 * (collectAllImports) فتُغطى كل صيغ الاستيراد القائمة.
 *
 * الاستخدام: node scripts/check-deleted-imports.mjs [repoRoot].
 * الخروج: 0 = نظيف؛ 1 = أي خرق (استيراد محذوف / إحياء / جرد معطوب)؛
 * 2 = خطأ استخدام.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { collectAllImports, virtualImportTarget } from "./check-module-boundaries.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DELETION_MANIFEST_PATH = path.posix.join("docs", "manage-v2", "DELETION-MANIFEST.md");

const VALID_STATUSES = new Set(["planned", "deleted"]);
const SOURCE_EXT = /\.(ts|tsx|js|jsx)$/;
const TEST_PAT = /\.(test|spec|dom\.test|ui\.test|contract\.test|characterization\.test)\.[cm]?[jt]sx?$/;

/** جذور مسح ملفات الإنتاج (أوسع من حارس الحدود: تشمل العامل). */
export const SCAN_ROOTS = [
  "src",
  path.join("apps", "prototype-web", "client", "src"),
  path.join("apps", "prototype-web", "worker"),
];

function listProductionFiles(repoRoot) {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") continue;
        walk(full);
        continue;
      }
      if (!SOURCE_EXT.test(entry.name)) continue;
      if (TEST_PAT.test(entry.name)) continue;
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

const cleanCell = (cell) => cell.trim().replace(/^`+|`+$/g, "").trim();

/** تحليل الجرد: صفوف {مسار، سبب، بديل، حالة، مرحلة} + أخطاء فشل مغلق. */
export function parseDeletionManifest(manifestText) {
  const rows = [];
  const errors = [];
  const text = manifestText ?? "";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map(cleanCell);
    while (cells.length > 0 && cells[0] === "") cells.shift();
    while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
    if (cells.length === 0) continue;
    const first = cells[0] ?? "";
    if (first === "المسار" || /^-{2,}$/.test(first)) continue;
    if (cells.length !== 5 || first.length === 0 || !VALID_STATUSES.has(cells[3] ?? "")) {
      errors.push({
        rule: "manifest-invalid",
        key: line.slice(0, 120),
        hint: "صف جرد معطوب: خمس أعمدة (المسار/السبب/البديل/الحالة/المرحلة) وحالة من {planned, deleted} حصرًا — أصلح الجرد قبل الدمج",
      });
      continue;
    }
    rows.push({ path: cells[0] ?? "", reason: cells[1] ?? "", replacement: cells[2] ?? "", status: cells[3] ?? "", phase: cells[4] ?? "" });
  }
  return { rows, errors };
}

/** تطابق الهدف الافتراضي مع صف محذوف (ملف أو شجرة مجلد). */
function matchesDeletedRow(virtualTarget, rowPath) {
  if (virtualTarget === null || virtualTarget === undefined) return false;
  const strippedRow = rowPath.replace(/\/+$/, "").replace(/\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/, "");
  if (rowPath.endsWith("/")) {
    return virtualTarget === strippedRow || virtualTarget.startsWith(`${strippedRow}/`);
  }
  return virtualTarget === strippedRow;
}

/** الفحص الكامل: يعيد الخروق والإحصاءات. */
export function checkDeletedImports(repoRoot) {
  const manifestFull = path.join(repoRoot, ...DELETION_MANIFEST_PATH.split("/"));
  const violations = [];
  if (!fs.existsSync(manifestFull)) {
    return {
      ok: false,
      violations: [
        {
          rule: "manifest-missing",
          key: DELETION_MANIFEST_PATH,
          hint: "جرد الحذف غير موجود — كل حذف يجب أن يُعلَن قبل وقوعه (قرار المالك D-10/M1.9)",
        },
      ],
      stats: { rows: 0, planned: 0, deleted: 0, filesScanned: 0, importsScanned: 0 },
    };
  }
  const { rows, errors } = parseDeletionManifest(fs.readFileSync(manifestFull, "utf8"));
  for (const error of errors) violations.push(error);
  const planned = rows.filter((row) => row.status === "planned");
  const deleted = rows.filter((row) => row.status === "deleted");

  const files = listProductionFiles(repoRoot);
  const imports = files.length > 0 ? collectAllImports(repoRoot, files) : [];

  for (const row of deleted) {
    /* (٢) لا يعود المسار المحذوف إلى الشجرة نفسها. */
    const onDisk = path.join(repoRoot, ...row.path.split("/"));
    if (fs.existsSync(onDisk)) {
      violations.push({
        rule: "deleted-path-resurrected",
        key: row.path,
        hint: "مسار موسوم deleted موجود على الشجرة — لا يعود الكود الميت بصمت (D-10)؛ احذفه أو أعِد وسمه planned بقرار موثَّق",
      });
    }
    /* (١) لا مستورد للمسار المحذوف (مستعار/نسبي، بلا اشتراط وجود الهدف). */
    for (const imp of imports) {
      const virtual = virtualImportTarget(imp.specifier, path.join(repoRoot, imp.file), repoRoot);
      if (matchesDeletedRow(virtual, row.path)) {
        violations.push({
          rule: "deleted-import",
          key: `${imp.file} -> ${imp.specifier} (deleted ${row.path})`,
          hint: "استيراد لمسار محذوف في جرد الحذف — أزل الاستيراد أو راجع قرار الحذف (D-10/M1.9)",
        });
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    stats: {
      rows: rows.length,
      planned: planned.length,
      deleted: deleted.length,
      filesScanned: files.length,
      importsScanned: imports.length,
    },
  };
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  if (!fs.existsSync(path.join(repoRoot, "package.json"))) {
    console.error("deleted-imports: USAGE: node scripts/check-deleted-imports.mjs [repoRoot]");
    process.exit(2);
  }
  const { ok, violations, stats } = checkDeletedImports(repoRoot);
  if (!ok) {
    console.error(`deleted-imports: FAIL — ${violations.length} خرقًا (جرد الحذف D-10):`);
    for (const v of violations) {
      console.error(`  [${v.rule}] ${v.key}`);
      console.error(`    ${v.hint}`);
    }
    process.exit(1);
  }
  console.log(
    `deleted-imports: PASS — ${stats.rows} صفًا في الجرد (${stats.planned} planned / ${stats.deleted} deleted)؛ ${stats.importsScanned} استيرادًا مفحوصًا في ${stats.filesScanned} ملف إنتاج؛ صفر استيراد لمسار محذوف وصفر إحياء (M1.9/D-10)`,
  );
}

/* الاستدعاء المباشر (لا عند الاستيراد من الاختبارات). */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
