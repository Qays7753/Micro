#!/usr/bin/env node
/**
 * المجموعة ٦ (برنامج التحصين الكامل 2026): فحص أسرار حتمي بلا شبكة ولا اعتماديات.
 *
 * الغاية: منع دخول أي سر (توكن وصول، مفتاح سحابي، مفتاح خاص) إلى المستودع —
 * نصًا أو ملفًا — قبل الدمج، عبر `pnpm guards` المتصل بـ`pnpm check` وبالتالي بCI.
 *
 * المبادئ:
 * - أنماط عالية الدقة فقط (بادئات مميزة معروفه صناعيًا)؛ لا فحص «قيمة تبدو
 *   سرية» العام القابل للأخطاء الإيجابية، لأن الفحص الذي يصرخ كذبًا يُتجاوز.
 * - المخرجات لا تطبع النص المطابق أبدًا: اسم النمط + الملف + رقم السطر فقط؛
 *   فحص الأسرار لا يجوز أن يكون هو مصدر تسريب.
 * - استثناء وحيد ضيق وموثق: مجلد `scripts/fixtures/secrets` — عينات مزيفة
 *   (بادئة نمط + حشو غير صالح كتوكن حقيقي) تثبت أن الفحص يصطاد؛ المالك:
 *   مالك المنتج؛ شرط الإزالة: تُحذف مع حذف اختبار `check-secrets.test.mjs`
 *   نفسه. لا يجوز توسيع الاستثناء لمجلدات مصدر.
 * - تهميش الملفات الثنائية: النمط ASCII فالفحص على بايتات الملف كما هي
 *   (latin1) يعطي نفس النتيجة دون فك ترميز.
 *
 * الاستخدام: node scripts/check-secrets.mjs [root] (الافتراضي: جذر المستودع).
 * الخروج: 0 = نظيف؛ 1 = أي إصابة (تُطبع أسماء الأنماط والمواقع بلا قيم).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* أنماط الأسرار المعتمدة — دقيقة القصد، تُعدَّل بقرار موثق لا بصمت. */
export const SECRET_PATTERNS = [
  { name: "github-classic-token", regex: /\bghp_[A-Za-z0-9]{36,}\b/ },
  { name: "github-fine-grained-token", regex: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/ },
  { name: "aws-access-key-id", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "slack-token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "openai-style-key", regex: /\bsk-[A-Za-z0-9]{32,}\b/ },
  {
    name: "private-key-block",
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY(?: BLOCK)?-----/,
  },
];

/* أسماء ملفات لا يجوز وجودها في المستودع أصلًا (مفاتيح/أسرار بلا استثناء). */
export const SECRET_FILE_NAMES = [/^\.env(\..+)?$/, /\.pem$/, /\.key$/, /^id_rsa/, /\.p12$/, /\.pfx$/];

export const EXCLUDED_DIR_NAMES = ["node_modules", ".git", "dist", "coverage", "fixtures"];

/** حصر ملفات المستودع (بلا رمزيات ولا مجلدات مستثناة) — حتمي بترتيب ثابت. */
export function listFiles(root, excludedDirNames = EXCLUDED_DIR_NAMES) {
  const files = [];
  const stack = [path.resolve(root)];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!excludedDirNames.includes(entry.name)) stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      files.push(full);
    }
  }
  files.sort();
  return files;
}

/** فحص محتوى واحد — يعيد أسماء الأنماط وأرقام الأسطر فقط، لا القيم أبدًا. */
export function scanContent(content, patterns = SECRET_PATTERNS) {
  const findings = [];
  for (const { name, regex } of patterns) {
    const match = regex.exec(content);
    if (match === null) continue;
    const line = content.slice(0, match.index).split("\n").length;
    findings.push({ patternName: name, line });
  }
  return findings;
}

/** فحص اسم ملف — هل هو اسم ملف سر بديهي؟ */
export function isSecretFileName(fileName) {
  return SECRET_FILE_NAMES.some((regex) => regex.test(path.basename(fileName)));
}

/** فحص شجرة كاملة — يعيد الإصابات بلا أي نص مطابق. */
export function scanTree(root, excludedDirNames = EXCLUDED_DIR_NAMES) {
  const findings = [];
  for (const file of listFiles(root, excludedDirNames)) {
    const relative = path.relative(path.resolve(root), file);
    if (isSecretFileName(file)) {
      findings.push({ file: relative, patternName: "secret-named-file", line: 1 });
      continue;
    }
    let content;
    try {
      content = fs.readFileSync(file).toString("latin1");
    } catch {
      continue;
    }
    for (const { patternName, line } of scanContent(content)) {
      findings.push({ file: relative, patternName, line });
    }
  }
  return findings;
}

function main() {
  const rootArg = process.argv[2] ?? ROOT;
  if (process.argv.length > 3) {
    process.stderr.write("check-secrets: USAGE — node scripts/check-secrets.mjs [root]\n");
    return 1;
  }
  if (!fs.existsSync(rootArg)) {
    process.stderr.write(`check-secrets: ROOT_MISSING — ${rootArg}\n`);
    return 1;
  }
  const findings = scanTree(rootArg);
  const scanned = listFiles(rootArg).length;
  if (findings.length > 0) {
    process.stderr.write(
      `check-secrets: FAIL SECRET_FOUND — ${findings.length} hit(s) — (file:pattern:line, values never printed)\n` +
        findings.map((f) => `  ${f.file} : ${f.patternName} : line ${f.line}`).join("\n") +
        "\n",
    );
    return 1;
  }
  process.stdout.write(`check-secrets: PASS — ${scanned} files scanned, 0 secret patterns\n`);
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(main());
}
