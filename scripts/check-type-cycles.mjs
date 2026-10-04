#!/usr/bin/env node
/**
 * Wave H (STR-617 بند 1 — 2026-10-04): حارس الدورات النوعية (type-only SCCs).
 *
 * الفجوة الموثقة: حارس دورات التشغيل (check-runtime-cycles.mjs) يعدّ حواف
 * القيم فقط، فالدورات النوعية (import type المتبادلة) كانت تمر بCI بلا
 * تعداد ولا حراسة — «الرابعة تمر» في مصفوفة القاعدة→حارس (قاعدة ٩).
 *
 * هذا الحارس: تارجان فوق حواف الأنواع فقط (import type + export type from —
 * عبر مجمّع الحدود الموسع في Wave H)، يعدّ مكوّنات الترابط القوي (SCC) بين
 * ملفين أو أكثر، ويرفض أي SCC جديد فوق الأساس المقبول. الأساس = القياس الحي
 * عند التنفيذ (دورة نوعية واحدة داخل بيت التخزين — موثقة في سجل الملكية §5).
 *
 * الاستخدام: node scripts/check-type-cycles.mjs [repoRoot].
 * الخروج: 0 = لا دورات نوعية جديدة؛ 1 = دورة جديدة فوق الأساس.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { ROOT } from "./check-runtime-cycles.mjs";
import { collectAllImports } from "./check-module-boundaries.mjs";

/** الأساس المقبول (Wave H، 2026-10-04): الدورة النوعية الوحيدة القائمة —
 * داخل بيت التخزين بين واجهة المنفذ وحارس جدولة المورد (كلاهما بملكية
 * مسجلة؛ الحل ميكانيكي ممكن عند أول لمسة: نقل النوع المشترك لملف ورقي).
 * كان في المسح المعادي 3 دورات: أُغلقت اثنتان ببرنامج الإكمال (STR-620 عبر
 * projectFinancialTypes في Wave E؛ واستخراج القدرات في Wave C) وبقيت هذه. */
export const TYPE_SCC_BASELINE = [
  [
    "apps/prototype-web/client/src/storage/local/supplierScheduleCommitGuard.ts",
    "apps/prototype-web/client/src/storage/local/types.ts",
  ].join(" <-> "),
];

/** تارجان فوق الرسم الاتجاهي — يعيد SCCs بحجم ≥ 2 بمفاتيح حتمية. */
export function computeTypeSccs(imports) {
  const files = [...new Set(imports.map(i => i.file))];
  const graph = new Map(files.map(f => [f, new Set()]));
  for (const imp of imports) {
    if (imp.kind === "type" && imp.resolved) graph.get(imp.file)?.add(imp.resolved);
  }
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const sccs = [];
  let counter = 0;
  const strongconnect = v => {
    index.set(v, counter);
    low.set(v, counter);
    counter += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!index.has(w)) {
        strongconnect(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), index.get(w)));
      }
    }
    if (low.get(v) === index.get(v)) {
      const component = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      if (component.length > 1) sccs.push([...component].sort().join(" <-> "));
    }
  };
  for (const v of files) if (!index.has(v)) strongconnect(v);
  return [...new Set(sccs)].sort();
}

export function checkTypeCycles(repoRoot, imports) {
  const all = imports ?? collectAllImports(repoRoot);
  const live = computeTypeSccs(all);
  const baseline = new Set(TYPE_SCC_BASELINE);
  const violations = live.filter(key => !baseline.has(key)).map(key => ({
    rule: "type-scc",
    key,
    hint: "دورة نوعية جديدة (import type متبادلة) — حوّل الأنواع المشتركة إلى ملف ورقي leaf، أو سجّل الاستثناء في سجل الملكية §5 وحدّث الأساس في نفس الـPR",
  }));
  return { ok: violations.length === 0, violations, live };
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  if (!fs.existsSync(path.join(repoRoot, "package.json"))) {
    console.error("type-cycles: USAGE: node scripts/check-type-cycles.mjs [repoRoot]");
    process.exit(2);
  }
  const { ok, violations, live } = checkTypeCycles(repoRoot);
  if (!ok) {
    console.error(`type-cycles: FAIL — ${violations.length} دورة نوعية جديدة فوق الأساس المقبول:`);
    for (const v of violations) {
      console.error(`  [${v.rule}] ${v.key}`);
      console.error(`    ${v.hint}`);
    }
    process.exit(1);
  }
  console.log(
    `type-cycles: PASS — ${live.length} دورة نوعية قائمة (كلها ضمن الأساس المقبول)؛ صفر دورة جديدة صامتة (Wave H/STR-617 بند 1)`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
