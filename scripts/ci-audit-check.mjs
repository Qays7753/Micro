#!/usr/bin/env node
/**
 * الخطوة ٢+٣ (برنامج تصحيح ما بعد المسح لPR #316 — 2026-10-06): فاحص خطوة
 * التدقيق الأمني في CI مع سجل الاستثناءات الأمنية الموثق.
 *
 * السياق والعلة الجذرية:
 * - العلة (أ) — عيب bash في خطوة audit بci.yml (D8-a المسجل في Entry 45):
 *   كان `code=$?` يُلتقط بعد جملة `if` كاذبة فلا يرصد إلا خرج الجملة (0)،
 *   فتنجح الخطوة حتى عند فشل `pnpm audit` ثلاث مرات (شواهد: تشغيل 37328419419
 *   أخضر رغم وجود مكتشف high واحد). الإصلاح في `scripts/ci-audit-step.sh`.
 * - العلة (ب) — استشارة GHSA-vfj7-8cjw-p6xm (braces <=3.0.3 عبر stylelint،
 *   dev-only): لا توجد نسخة مرقّعة من المنبع (registry حي 2026-10-06: آخر
 *   إصدار 3.0.3؛ patched_versions = <0.0.0). القرار (تعليمات المالك للخطوة ٣):
 *   لا كتم صامت ولا حذف للتدقيق — بل سجل استثناء موثق بقرار مالك صريح.
 *
 * نموذج القرار (غير الصامت عمدًا):
 * - status = OWNER_ACCEPTED  → الاستثناء معتمد: يُطبع إشعار صريح في كل تشغيل
 *   (أبدًا لا يمر بصمت)، ولا يحجب الدمج.
 * - status = PROPOSED        → الاستثناء مقترح وينتظر قرار المالك: يُحجب
 *   التدقيق (خرج 1) برسالة تشير إلى القرار المعلق — القرار للمالك وحده.
 * - status = REJECTED        → المالك رفض الاستثناء: المكتشف يحجب كأي مكتشف.
 * - بلا صف في السجل           → المكتشف يحجب (سلوك pnpm audit الأصيل).
 * - صف OWNER_ACCEPTED بلا مكتشف حي مطابق → تحذير «الصف متقادم» (المنبع ربما
 *   أصلح؛ شرط الإزالة تحقق) — هذه هي طريقة المراقبة الفعالة للسجل.
 *
 * أكواد الخروج: 0 = نظيف أو معتمد بالكامل؛ 1 = مكتشفات محجوبة أو سجل تالف؛
 * 2 = فشل أداة التدقيق نفسها (شبكة/سجل npm) — إشارة قابلية إعادة المحاولة
 * يستهلكها غلاف bash.
 *
 * الاستخدام:
 *   node scripts/ci-audit-check.mjs [--audit-level high]
 *        [--report-file <path>] [--register <path>]
 * - الافتراضي يشغّل `pnpm audit --json` داخل جذر المستودع.
 * - `--report-file` يقيّم تقريرًا محفوظًا بلا شبكة (مسار الاختبارات وإعادة
 *   التقييم اليدوي للأدلة المحفوظة).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_REGISTER_PATH = path.join(ROOT, "docs", "quality", "security-exception-register.json");

export const EXIT_PASS = 0;
export const EXIT_BLOCKED = 1;
export const EXIT_TOOL_FAILURE = 2;

/** تحميل السجل — يفشل مغلقًا (BLOCKED) عند أي تلف لأن السجل جزء من أمن البوابة. */
export function loadRegister(registerPath) {
  try {
    const raw = fs.readFileSync(registerPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.exceptions)) {
      return { ok: false, register: null, error: "register root must be an object with an `exceptions` array" };
    }
    for (const [index, entry] of parsed.exceptions.entries()) {
      const missing = ["advisory_id", "package", "status"].filter(k => !(k in entry));
      if (missing.length > 0) {
        return { ok: false, register: null, error: `exceptions[${index}] missing required keys: ${missing.join(", ")}` };
      }
    }
    return { ok: true, register: parsed, error: null };
  } catch (error) {
    return { ok: false, register: null, error: `cannot read/parse register: ${error?.message ?? String(error)}` };
  }
}

/** استخراج المكتشفات من تقرير pnpm audit --json (خريطة advisories مرقّمة). */
export function extractAdvisories(report) {
  if (!report || typeof report !== "object" || !report.advisories) return [];
  return Object.values(report.advisories)
    .filter(a => a && typeof a === "object")
    .map(a => ({
      id: a.github_advisory_id ?? String(a.id ?? "unknown"),
      numericId: a.id ?? null,
      module: a.module_name ?? "unknown",
      severity: a.severity ?? "unknown",
      title: a.title ?? "untitled advisory",
      vulnerableVersions: a.vulnerable_versions ?? "",
      paths: (a.findings ?? []).flatMap(f => f?.paths ?? []),
    }));
}

/**
 * التقييم الصرف (بلا شبكة): يطابق المكتشفات مع السجل ويعيد القرار.
 * الحالة النهائية: { exitCode, blocked[], accepted[], stale[], summary }
 */
export function evaluateAuditReport(report, register) {
  const advisories = extractAdvisories(report);
  const entries = Array.isArray(register?.exceptions) ? register.exceptions : [];
  const blocked = [];
  const accepted = [];
  const matchedEntryIds = new Set();

  for (const advisory of advisories) {
    const entry = entries.find(e => e.advisory_id === advisory.id || (e.cve && e.cve === (advisory.cve ?? "")));
    if (!entry || entry.status === "REJECTED") {
      blocked.push({
        advisory,
        reason: entry?.status === "REJECTED" ? "exception explicitly REJECTED by owner — finding stands" : "no exception record",
      });
      continue;
    }
    if (entry.status === "OWNER_ACCEPTED") {
      accepted.push({
        advisory,
        entry,
        notice:
          `documented security exception (owner-accepted${entry.accepted_at ? ` ${entry.accepted_at}` : ""}): ` +
          `${entry.advisory_id} on ${entry.package} — ${entry.classification ?? "unclassified"}; ` +
          `removal condition: ${entry.removal_condition ?? "see register"}`,
      });
      matchedEntryIds.add(entry.advisory_id);
      continue;
    }
    /* PROPOSED وأي حالة أخرى غير معروفة: القرار معلق على المالك — يحجب. */
    blocked.push({
      advisory,
      reason:
        entry.status === "PROPOSED"
          ? "covered by a PROPOSED security exception awaiting the owner decision — flip status to OWNER_ACCEPTED in docs/quality/security-exception-register.json as the explicit owner decision, or reject it"
          : `unknown exception status '${entry.status}' — treated as blocking`,
    });
    matchedEntryIds.add(entry.advisory_id);
  }

  /* المراقبة: صفوف معتمدة بلا مكتشف حي مطابق = مرشحة للإزالة (المنبع أصلح). */
  const stale = entries
    .filter(e => e.status === "OWNER_ACCEPTED" && !matchedEntryIds.has(e.advisory_id))
    .map(e => ({
      entry: e,
      notice:
        `stale OWNER_ACCEPTED exception: ${e.advisory_id} on ${e.package} no longer appears in the live audit ` +
        `report — the removal condition may have been met; remove the entry in the same PR that updates the lockfile`,
    }));

  const exitCode = blocked.length > 0 ? EXIT_BLOCKED : EXIT_PASS;
  return { exitCode, blocked, accepted, stale };
}

/** تشغيل أداة التدقيق الحقيقية. */
export function runPnpmAudit(auditLevel) {
  const result = spawnSync("pnpm", ["audit", "--audit-level", auditLevel, "--json"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function render(verdict, toolSummary) {
  const lines = [];
  for (const a of verdict.accepted) lines.push(`ci-audit-check: NOTICE ${a.notice}`);
  for (const s of verdict.stale) lines.push(`ci-audit-check: WARNING ${s.notice}`);
  if (verdict.blocked.length > 0) {
    for (const b of verdict.blocked) {
      lines.push(
        `ci-audit-check: BLOCKED ${b.advisory.id} (${b.advisory.severity}) ${b.advisory.module} ` +
          `${b.advisory.vulnerableVersions} — ${b.advisory.title} — ${b.reason}`,
      );
    }
    lines.push(`ci-audit-check: FAIL — ${verdict.blocked.length} blocking finding(s) after applying the exception register`);
  } else {
    lines.push(
      `ci-audit-check: PASS — 0 blocking finding(s)` +
        `${verdict.accepted.length > 0 ? `, ${verdict.accepted.length} documented exception(s) printed above (never silent)` : ""}` +
        `${verdict.stale.length > 0 ? `, ${verdict.stale.length} stale exception(s) flagged above for removal` : ""}`,
    );
  }
  if (toolSummary) lines.push(`ci-audit-check: tool summary: ${toolSummary}`);
  return lines;
}

function main() {
  const args = process.argv.slice(2);
  const readFlag = name => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  const auditLevel = readFlag("--audit-level") ?? "high";
  const registerPath = readFlag("--register") ?? DEFAULT_REGISTER_PATH;
  const reportFile = readFlag("--report-file");

  const registerLoad = loadRegister(registerPath);
  if (!registerLoad.ok) {
    console.error(`ci-audit-check: FAIL — security-exception-register is unreadable/malformed (${registerPath}): ${registerLoad.error}`);
    process.exit(EXIT_BLOCKED);
  }

  let report = null;
  let toolSummary = null;
  if (reportFile) {
    try {
      report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
    } catch (error) {
      console.error(`ci-audit-check: TOOL FAILURE — cannot read/parse report file ${reportFile}: ${error?.message ?? String(error)}`);
      process.exit(EXIT_TOOL_FAILURE);
    }
  } else {
    const ran = runPnpmAudit(auditLevel);
    if (ran.status === 0) {
      console.log("ci-audit-check: PASS — pnpm audit exited 0 (no findings at or above the audit level)");
      process.exit(EXIT_PASS);
    }
    try {
      report = JSON.parse(ran.stdout);
      const meta = report?.metadata?.vulnerabilities;
      if (meta) {
        const total =
          meta.total ??
          (meta.critical ?? 0) + (meta.high ?? 0) + (meta.moderate ?? 0) + (meta.low ?? 0) + (meta.info ?? 0);
        toolSummary = `total ${total} (critical ${meta.critical ?? 0}, high ${meta.high ?? 0}, moderate ${meta.moderate ?? 0}, low ${meta.low ?? 0})`;
      }
    } catch {
      console.error("ci-audit-check: TOOL FAILURE — pnpm audit exited non-zero with no parseable JSON report (registry/network failure?) — retryable signal for the bash wrapper");
      console.error(ran.stderr.split("\n").slice(0, 5).join("\n"));
      process.exit(EXIT_TOOL_FAILURE);
    }
  }

  const verdict = evaluateAuditReport(report, registerLoad.register);
  for (const line of render(verdict, toolSummary)) console.log(line);
  process.exit(verdict.exitCode);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
