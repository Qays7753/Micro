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
 * F-027 (R10-B5 — 2026-10-13): الحدود الموثقة للفحص بقرار الموجة —
 * - شجرة العمل الحية وحدها تُفحص؛ تاريخ git ليس مفحوصًا هنا (البطاقة الدقيقة
 *   R10B-NF-025 تملك مسح التاريخ: المالك = المالك، المُشغّل = طلب المالك أو
 *   مراجعة أمنية، الكشف = مسح `git log -p` لمرة واحدة أو أداة تاريخ).
 * - لا فحص إنتروبيا عام (استبعاد تصميمي أصيل لا نقص تغطية: القيمة عالية
 *   الدقة أولًا لأن الإنذار الكاذب يُضعف الثقة بالفحص كله).
 * - مفاتيح AWS السرية مقيّدة بسياق المعرّف القانوني وحده (انظر النمط أدناه)
 *   لأن 40 محرفًا base64 مجردة لا تُميَّز عن بصمات git/SHA-1 الممتلئ بها
 *   مستودعنا المشروعي — القيد سياقي ليبقى الاصطياد صادقًا لا صارخًا كذبًا.
 * - JWT يتطلب البنية الثلاثية الكاملة بالنقاط؛ «eyJ» مجردة تظهر عرضًا في
 *   نصوص base64 عادية فلا تصلح دليلًا وحدها.
 * - عناوين قواعد البيانات بلا كلمة مرور (`scheme://user@host`) ليست سرًا
 *   ولا تُصطاد؛ الاصطياد لصيغة المعلومات المضمّنة user:pass@ حصرًا.
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
  /* F-14 (برنامج ما بعد المسح W8، 2026-10-05): بادئات مضافة — رموز GitHub
   * من غير فئة ghp (OAuth/التطبيقات/المستخدم/التحديث)، ومفاتيح Google API،
   * ورموز npm المحببة — نفس عتبات الأطوال الموثقة علنًا. */
  { name: "github-secondary-tokens", regex: /\bgh[ousr]_[A-Za-z0-9]{36,}\b/ },
  { name: "google-api-key", regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "npm-granular-token", regex: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { name: "aws-access-key-id", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "slack-token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "openai-style-key", regex: /\bsk-[A-Za-z0-9]{32,}\b/ },
  /* F-027 (R10-B5 — 2026-10-13): ست عائلات مضافة بتعداد W0 الموثق — نفس
   * مبدأ الدقة العالية (بادئات صناعية مميزة أو بنية تركيبية كاملة)، مع
   * قيود السياق الموثقة في رأس الملف حيثما كان التمييز يستلزمها:
   * - stripe-live-secret-key: مفاتيح Stripe الحية `sk_live_` (عتبة الطول
   *   الموثقة علنًا 24+)؛ مفاتيح الاختبار sk_test_ ليست سر إنتاج فلا تُصطاد.
   * - anthropic-api-key: `sk-ant-` بحدث أدنى 20؛ الشكل القانوني
   *   sk-ant-api03-... يدخل ضمنه ولا يتقاطع مع openai-style-key (الشرطة
   *   بعد ant تكسر صنف [A-Za-z0-9] الخاص بذاك).
   * - gitlab-token: `glpat-` بحدث أدنى 16 (أطوال PAT الحالية 16-26).
   * - jwt: الرأس eyJ + حمولة + توقيع بالنقاط الفاصلة — بنية كاملة لا بادئة.
   * - aws-secret-access-key: المفتاح السري (40 base64) مقيدًا بمعرّفه
   *   القانوني secret[_ ]?access[_ ]?key (بفجوة ≤12 محرفًا ليس من أبجدية
   *   base64) — الحصر الموصوف في الرأس أعلاه.
   * - db-url-with-credentials: صيغة scheme://user:pass@ لقواعد البيانات
   *   الشائعة؛ بلا كلمة مرور لا اصطياد (موثق في الرأس). */
  { name: "stripe-live-secret-key", regex: /\bsk_live_[A-Za-z0-9]{24,}\b/ },
  { name: "anthropic-api-key", regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { name: "gitlab-token", regex: /\bglpat-[A-Za-z0-9_-]{16,}\b/ },
  {
    name: "jwt",
    regex: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  },
  {
    name: "aws-secret-access-key",
    regex:
      /(?<![A-Za-z0-9/+])secret[_ ]?access[_ ]?key[^A-Za-z0-9/+]{0,12}[A-Za-z0-9/+]{40}(?![A-Za-z0-9/+])/i,
  },
  {
    name: "db-url-with-credentials",
    regex:
      /\b(?:postgres(?:ql)?|mariadb|mysql|mongodb(?:\+srv)?|rediss|redis|amqps|amqp):\/\/[^\s:@/'"<>]{1,64}:[^\s@/'"<>]{1,}@/,
  },
  {
    name: "private-key-block",
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY(?: BLOCK)?-----/,
  },
];

/* أسماء ملفات لا يجوز وجودها في المستودع أصلًا (مفاتيح/أسرار بلا استثناء). */
export const SECRET_FILE_NAMES = [/^\.env(\..+)?$/, /\.pem$/, /\.key$/, /^id_rsa/, /\.p12$/, /\.pfx$/];

export const EXCLUDED_DIR_NAMES = ["node_modules", ".git", "dist", "coverage"];
/* F-056 (W4-P1 — REM-004): الاستثناء ضاق من اسم مجلد «fixtures» (أي مجلد
 * بهذا الاسم في أي مسار — كان يُخرج docs/fixtures وغيرها من الفحص!) إلى
 * المسار الموثق وحده: scripts/fixtures/secrets (عينات مزيفة للاختبار الذاتي).
 * المجلدات الأخرى المسماة fixtures تُفحص الآن كأي مصدر. */
export const EXCLUDED_DIR_PATHS = ["scripts/fixtures/secrets"];

/** حصر ملفات المستودع (بلا رمزيات ولا مجلدات مستثناة) — حتمي بترتيب ثابت. */
export function listFiles(
  root,
  excludedDirNames = EXCLUDED_DIR_NAMES,
  excludedDirPaths = EXCLUDED_DIR_PATHS,
) {
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
        if (excludedDirNames.includes(entry.name)) continue;
        /* F-056: استثناء المسار الموثق وحده لا اسم المجلد. */
        const relative = path.relative(path.resolve(root), full).split(path.sep).join("/");
        if (excludedDirPaths.some(excluded => relative === excluded || relative.startsWith(`${excluded}/`)))
          continue;
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      files.push(full);
    }
  }
  files.sort();
  return files;
}

/** فحص محتوى واحد — يعيد أسماء الأنماط وأرقام الأسطر فقط، لا القيم أبدًا.
 * F-027 (R10-B5 — 2026-10-13): تكرار كل الإصابات لا الأولى فقط لكل نمط —
 * كان الفحص يسرد أول إصابة لكل عائلة في كل ملف فنقصَ مخزون الاصطياد
 * (RV4-N6) دون أن يمرر شيئًا (الفشل مغلق على أي إصابة). الآن matchAll
 * عبر نسخة /g جديدة لكل استدعاء — كائن جديد فيبدأ lastIndex من صفر في كل
 * مرة (حتمية كاملة بلا حالة متسربة بين الملفات أو الاستدعاءات). */
export function scanContent(content, patterns = SECRET_PATTERNS) {
  const findings = [];
  for (const { name, regex } of patterns) {
    const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
    for (const match of content.matchAll(new RegExp(regex.source, flags))) {
      const line = content.slice(0, match.index).split("\n").length;
      findings.push({ patternName: name, line });
    }
  }
  return findings;
}

/** فحص اسم ملف — هل هو اسم ملف سر بديهي؟ */
export function isSecretFileName(fileName) {
  return SECRET_FILE_NAMES.some(regex => regex.test(path.basename(fileName)));
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
        findings.map(f => `  ${f.file} : ${f.patternName} : line ${f.line}`).join("\n") +
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
