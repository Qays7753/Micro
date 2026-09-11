#!/usr/bin/env node
/**
 * المجموعة ٨ (برنامج المعالجة الرباعية — STR-023 الحارس المرافق): كاشف دورات
 * الاستيراد في زمن التشغيل — حتمي بلا شبكة ولا اعتمادات جديدة (محلل TypeScript
 * نفسه موجود في devDependencies الجذر).
 *
 * المبدأ: الدورة «النوعية فقط» تُمحى عند التجميع فلا وجود لها في زمن التشغيل
 * (الدورة القائمة الوحيدة اليوم: types.ts ↔ supplierScheduleCommitGuard —
 * الاتجاهان `import type`، مصنّفة Preserve في المسح). هذا الفحص يرصد الدورة
 * *القابلة للتنفيذ* فقط: استيراد قيم (افتراضي/مسماة/تأثير جانبي/ديناميكي)
 * أو إعادة تصدير قيم. الاستيراد `import type` واستيراد/إعادة تصدير تكون كل
 * عناصرها `type` تُتجاهل عمدًا — بمستوى AST لا بتخمين نصي.
 *
 * النطاق: مصادر الإنتاج فقط — `src/` و`apps/prototype-web/client/src/`
 * (استثناء `*.test.*` و`*.d.ts`). المحددات الخارجية (react وwouter
 * وvirtual:pwa-register...) خارج الرسم البياني — دورتنا شأننا، ودورة الحزمة
 * شأن ناشرها.
 *
 * الاستخدام: node scripts/check-runtime-cycles.mjs [root]
 * الخروج: 0 = لا دورات؛ 1 = دورات مكتشفة (تُطبع مساراتها الكاملة)؛
 * 2 = خطأ استخدام/نطاق (لا ملفات — فشل صادق لا نجاح صامت).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SCAN_ROOTS = ["src", path.join("apps", "prototype-web", "client", "src")];

function listProductionFiles(root) {
  const files = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") continue;
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx|mts|cts)$/.test(entry.name)) continue;
      if (/\.test\.[a-z]+$/.test(entry.name)) continue;
      if (/\.d\.ts$/.test(entry.name)) continue;
      files.push(full);
    }
  };
  for (const relativeRoot of SCAN_ROOTS) {
    const absolute = path.join(root, relativeRoot);
    if (fs.existsSync(absolute)) walk(absolute);
  }
  return files.sort();
}

/** هل الاستيراد يحمل قيمًا في زمن التشغيل؟ (AST — لا تخمين نصي) */
function importCarriesRuntimeValue(node) {
  const clause = node.importClause;
  if (!clause) return true; /* import "x" — أثر جانبي حي */
  if (clause.isTypeOnly) return false; /* import type X */
  if (clause.name) return true; /* استيراد افتراضي */
  const bindings = clause.namedBindings;
  if (!bindings) return false;
  if (ts.isNamespaceImport(bindings)) return true; /* import * as ns */
  if (ts.isNamedImports(bindings)) {
    return bindings.elements.some(element => !element.isTypeOnly);
  }
  return false;
}

/** إعادة التصدير: هل تحمل قيمًا؟ (`export type` أو كل العناصر type → ممحوة) */
function reexportCarriesRuntimeValue(node) {
  if (node.isTypeOnly) return false; /* export type { X } from */
  if (!node.exportClause) return true; /* export * from — قيم */
  if (ts.isNamedExports(node.exportClause)) {
    return node.exportClause.elements.some(element => !element.isTypeOnly);
  }
  return true; /* export * as ns from */
}

function tryResolve(base) {
  const stripped = base.replace(/\.(js|mjs|cjs|jsx)$/, "");
  const candidates = [
    `${stripped}.ts`,
    `${stripped}.tsx`,
    `${stripped}.mts`,
    path.join(stripped, "index.ts"),
    path.join(stripped, "index.tsx"),
    stripped,
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** تحويل المحدد إلى ملف محلي — null يعني خارجيًا (ليس شأننا). */
export function resolveSpecifier(specifier, fromFile, root) {
  if (specifier.startsWith("@/") && !specifier.startsWith("@micro-domain/")) {
    return tryResolve(path.join(root, "apps", "prototype-web", "client", "src", specifier.slice(2)));
  }
  if (specifier.startsWith("@micro-domain/")) {
    return tryResolve(path.join(root, "src", "domain", specifier.slice("@micro-domain/".length)));
  }
  if (specifier.startsWith(".")) {
    return tryResolve(path.resolve(path.dirname(fromFile), specifier));
  }
  return null; /* react/wouter/virtual:... وكل الحزم الخارجية */
}

/** جمع حواف زمن التشغيل: Map<ملف, Set<ملف>> — بترتيب حتمي. */
export function collectRuntimeEdges(root, files) {
  const sources = files ?? listProductionFiles(root);
  const edges = new Map();
  const parsed = [];
  for (const file of sources) {
    edges.set(file, new Set());
    const content = fs.readFileSync(file, "utf8");
    const kind = file.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : file.endsWith(".ts")
        ? ts.ScriptKind.TS
        : ts.ScriptKind.TS;
    parsed.push([file, ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, kind)]);
  }
  for (const [file, sourceFile] of parsed) {
    for (const statement of sourceFile.statements) {
      let specifier = null;
      if (ts.isImportDeclaration(statement) && importCarriesRuntimeValue(statement)) {
        specifier = statement.moduleSpecifier.text;
      } else if (
        ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier &&
        reexportCarriesRuntimeValue(statement)
      ) {
        specifier = statement.moduleSpecifier.text;
      } else if (
        ts.isImportEqualsDeclaration(statement) &&
        ts.isExternalModuleReference(statement.moduleReference)
      ) {
        specifier = statement.moduleReference.expression.text;
      }
      if (specifier === null) continue;
      const resolved = resolveSpecifier(specifier, file, root);
      if (resolved === null) continue;
      edges.get(file)?.add(resolved);
    }
    /* الاستيراد الديناميكي import("x") حافة زمن تشغيل — في أي عمق بالتعبير. */
    const visitDynamic = node => {
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        ts.isStringLiteral(node.arguments[0] ?? {})
      ) {
        const resolved = resolveSpecifier(node.arguments[0].text, file, root);
        if (resolved !== null) edges.get(file)?.add(resolved);
      }
      node.forEachChild(visitDynamic);
    };
    sourceFile.forEachChild(visitDynamic);
  }
  return edges;
}

/** دورة واحدة قابلة للعرض داخل مكوّن قوي الترابط (تفضيل المسار الأقصر). */
function cycleWithin(edges, component) {
  const inComponent = new Set(component);
  for (const start of component) {
    const previous = new Map([[start, null]]);
    const queue = [start];
    while (queue.length > 0) {
      const current = queue.shift();
      for (const next of edges.get(current) ?? []) {
        if (!inComponent.has(next)) continue;
        if (next === start) {
          const cycle = [];
          let node = current;
          while (node !== null && node !== undefined) {
            cycle.push(node);
            node = previous.get(node) ?? null;
          }
          return cycle.reverse();
        }
        if (!previous.has(next)) {
          previous.set(next, current);
          queue.push(next);
        }
      }
    }
  }
  return component;
}

/** مكونات ترابط قوية (تارجان) ثم استخراج دورة عرض لكل مكوّن غير بديهي. */
export function findRuntimeCycles(edges) {
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  let counter = 0;
  const components = [];
  const strongConnect = vertex => {
    index.set(vertex, counter);
    low.set(vertex, counter);
    counter += 1;
    stack.push(vertex);
    onStack.add(vertex);
    for (const successor of edges.get(vertex) ?? []) {
      if (!index.has(successor)) {
        strongConnect(successor);
        low.set(vertex, Math.min(low.get(vertex), low.get(successor)));
      } else if (onStack.has(successor)) {
        low.set(vertex, Math.min(low.get(vertex), index.get(successor)));
      }
    }
    if (low.get(vertex) === index.get(vertex)) {
      const component = [];
      let popped = null;
      do {
        popped = stack.pop();
        onStack.delete(popped);
        component.push(popped);
      } while (popped !== vertex);
      components.push(component);
    }
  };
  for (const vertex of [...edges.keys()].sort()) {
    if (!index.has(vertex)) strongConnect(vertex);
  }
  const cycles = [];
  for (const component of components) {
    const hasSelfLoop = component.length === 1 && (edges.get(component[0]) ?? new Set()).has(component[0]);
    if (component.length < 2 && !hasSelfLoop) continue;
    cycles.push(cycleWithin(edges, component));
  }
  return cycles;
}

function relativeToRoot(file, root) {
  return path.relative(root, file).split(path.sep).join("/");
}

function main() {
  const root = path.resolve(process.argv[2] ?? ROOT);
  const files = listProductionFiles(root);
  if (files.length === 0) {
    console.error("SCAN_EMPTY: no production source files found under the scan roots");
    process.exit(2);
  }
  const edges = collectRuntimeEdges(root, files);
  const cycles = findRuntimeCycles(edges);
  if (cycles.length === 0) {
    console.log(
      `runtime-cycle-guard: ${files.length} production files scanned, 0 runtime cycles (type-only edges ignored)`,
    );
    process.exit(0);
  }
  console.error(
    `runtime-cycle-guard: ${cycles.length} runtime cycle(s) found (type-only edges are ignored):`,
  );
  for (const cycle of cycles) {
    const display = [...cycle, cycle[0]].map(file => relativeToRoot(file, root));
    console.error(`  ${display.join(" -> ")}`);
  }
  process.exit(1);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
