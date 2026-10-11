#!/usr/bin/env node
/**
 * R9-GA-F7.1 (استمرار R9 الجذري — برنامج WS-216/ARCH-007): حارس استاتيكي
 * لمستمعات طبقة التخزين — يمنع دخول مستمع onsuccess غير محروس جديد بصمت.
 *
 * العائلة: رمي متزامن داخل مستمع نجاح طلب IndexedDB يهرب إلى المحرك فيعتمد
 * الحسم على معالجة المحرك لاستثناء المستمع (فقدان حمولة الخطأ الأصلي خلف
 * AbortError بديلة على المحركات المطابقة، أو ما هو أسوأ: وعد لا يُحسم أبدًا
 * على الوجه القرائي، أو نجاح زائف على محرك لا يحترم الراية القديمة).
 *
 * القاعدة: كل إسناد `.onsuccess =` داخل ملفات حد التخزين يجب أن يحمل واحدًا
 * من ثلاث حمايات موثقة:
 *   1) التغليف بـ guardedSuccessListener (نمط R9-GA-F7 في المحوّل)؛
 *   2) التقاط try/catch صريح داخل جسم المستمع نفسه (النمط المحلي المكافئ —
 *      writeOneIdempotent وlistAll بعد R9-GA-F7.1)؛
 *   3) استثناء موثق في EXEMPTIONS أدناه بجسم لا يمكن أن يرمي بحكم البناء
 *      (قراءات خصائص فقط — readOne، وopenDatabase ذات الالتقاط الداخلي).
 * أي مستمع جديد يرتّب كتابة (put/add/delete/clear) أو يستدعي رد نداء
 * مستدعٍ (مقارن ترتيب مثلًا) بلا حماية يُفشل هذا الحارس.
 *
 * الاستخدام: node scripts/check-storage-listener-guards.mjs [repoRoot].
 * الخروج: 0 = كل المستمعات محروسة؛ 1 = أي إصابة (الملف والسطر — نص آمن).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** ملفات حد التخزين الخاضعة للحارس (نفس حد الجرد التنفيذي). */
export const STORAGE_BOUNDARY_FILES = [
  "apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.ts",
  "apps/prototype-web/client/src/storage/local/indexedDbPrimitives.ts",
  "apps/prototype-web/client/src/storage/local/indexedDbSnapshot.ts",
  "apps/prototype-web/client/src/storage/local/indexedDbLifecycle.ts",
];

/** الاستثناءات الموثقة: أجسام لا يمكن أن يرمي شيء فيها بحكم البناء.
 * كل استثناء يحمل سببه الدقيق — إزالته تتطلب تحديث هذا السجل بحجة. */
export const EXEMPTIONS = new Map([
  [
    "apps/prototype-web/client/src/storage/local/indexedDbPrimitives.ts:readOne",
    "resolve-only body: request.result property read + nullish coalescing — no user callbacks, no writes, nothing that can throw (R9-GA-F7 review classification, preserved 2026-10-11)",
  ],
  [
    "apps/prototype-web/client/src/storage/local/indexedDbLifecycle.ts:openDatabase",
    "internally guarded: the only fallible call (request.result.close) is inside its own try/catch; the remaining statements are flag assignments, non-throwing handler attachment, and resolve",
  ],
]);

/** يجد مواضع إسناد `.onsuccess =` مع امتداد الجسم (حتى الإسناد التالي
 * لمستمع آخر أو نهاية معقولة). حتمي بترتيب الملف. */
export function findOnsuccessAssignments(source) {
  const lines = source.split("\n");
  const assignments = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/\.onsuccess\s*=/.test(lines[index])) continue;
    /* جسم المستمع: حتى 150 سطرًا أو حتى إسناد مستمع آخر — نفس نافذة
     * جرد التنفيذ. */
    let end = Math.min(index + 150, lines.length);
    for (let j = index + 1; j < end; j += 1) {
      if (
        /\.(onsuccess|onerror|onabort|oncomplete|onupgradeneeded|onblocked|onversionchange)\s*=/.test(
          lines[j],
        )
      ) {
        end = j;
        break;
      }
    }
    assignments.push({ line: index + 1, body: lines.slice(index, end).join("\n") });
  }
  return assignments;
}

/** اسم الدالة المحيطة (تقريبي): آخر تعريف دالة قبل السطر. */
export function enclosingFunctionName(source, lineNumber) {
  const lines = source.split("\n");
  const methodRe =
    /^(?:export )?(?:async )?function\s+([A-Za-z0-9_]+)(?:<[^>]*>)?\s*\(|^  (?:override )?(?:async )?([A-Za-z0-9_]+)(?:<[^>]*>)?\s*\(/;
  let name = "(module)";
  for (let index = 0; index < lineNumber - 1; index += 1) {
    const match = methodRe.exec(lines[index]);
    if (match) name = match[1] ?? match[2] ?? name;
  }
  return name;
}

/** هل الجسم محروس؟ guardedSuccessListener أو try/catch داخلي. */
export function isGuarded(body) {
  return body.includes("guardedSuccessListener") || /\btry\s*\{/.test(body);
}

/** فحص ملف واحد — يعيد الإصابات {file, line, function, reason}. */
export function scanStorageFile(repoRoot, relPath) {
  const absolute = path.join(path.resolve(repoRoot), relPath);
  const source = fs.readFileSync(absolute, "utf8");
  const findings = [];
  for (const assignment of findOnsuccessAssignments(source)) {
    if (isGuarded(assignment.body)) continue;
    const fn = enclosingFunctionName(source, assignment.line);
    const key = `${relPath}:${fn}`;
    const exemption = EXEMPTIONS.get(key);
    if (exemption !== undefined) continue;
    const queuesWrite = /\.(put|add|delete|clear)\s*\(/.test(assignment.body);
    const reason = queuesWrite
      ? "queues a write inside an unguarded onsuccess listener"
      : "unguarded onsuccess listener body";
    findings.push({ file: relPath, line: assignment.line, function: fn, reason });
  }
  return findings;
}

function main() {
  const repoRoot = process.argv[2] ?? ROOT;
  if (process.argv.length > 3) {
    process.stderr.write(
      "check-storage-listener-guards: USAGE — node scripts/check-storage-listener-guards.mjs [repoRoot]\n",
    );
    return 1;
  }
  if (!fs.existsSync(repoRoot)) {
    process.stderr.write(`check-storage-listener-guards: ROOT_MISSING — ${repoRoot}\n`);
    return 1;
  }
  const findings = [];
  for (const relPath of STORAGE_BOUNDARY_FILES) {
    findings.push(...scanStorageFile(repoRoot, relPath));
  }
  if (findings.length > 0) {
    process.stderr.write(
      `check-storage-listener-guards: FAIL — ${findings.length} unguarded onsuccess listener(s) in the storage boundary:\n` +
        findings.map(f => `  ${f.file}:${f.line} in ${f.function} — ${f.reason}`).join("\n") +
        "\nWrap the listener with guardedSuccessListener or an in-body try/catch, or document an exemption with its exact reason.\n",
    );
    return 1;
  }
  let total = 0;
  for (const relPath of STORAGE_BOUNDARY_FILES) {
    const source = fs.readFileSync(path.join(path.resolve(repoRoot), relPath), "utf8");
    total += findOnsuccessAssignments(source).length;
  }
  process.stdout.write(
    `check-storage-listener-guards: PASS — ${total} onsuccess listeners across ${STORAGE_BOUNDARY_FILES.length} storage boundary files, all guarded (or documented exemptions: ${EXEMPTIONS.size})\n`,
  );
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(main());
}
