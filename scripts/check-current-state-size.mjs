#!/usr/bin/env node
/**
 * WS-204 (برنامج عزل سياق التوثيق 2026-10-01): حارس عقد محتوى الحالة الحية.
 *
 * الغاية: منع عودة نموذج «ملف الحالة سجلٌّ تاريخي متضخم» (العلة الجذرية RC-1:
 * current-state.md بلغ 466,908 بايت / 1,716 سطرًا / ~100 قسم). يفرض هذا الحارس:
 *
 * 1. سقف حجم `docs/operations/current-state.md` عند 20,480 بايت (20 KB).
 * 2. وجود الأقسام الحية الإلزامية فيه (البوابات/الحدود/الخطوة التالية).
 * 3. وجود `docs/operations/current-state-log.md` حاملًا لافتة append-only التاريخية.
 * 4. ألا يحتوي ملف الحالة الحية على عناوين أقسام السجل التاريخي (§9 وما بعده).
 *
 * الاستخدام: node scripts/check-current-state-size.mjs [root]
 * الخروج: 0 = العقد محفوظ؛ 1 = أي خرق.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const LIVE_PATH = "docs/operations/current-state.md";
export const LOG_PATH = "docs/operations/current-state-log.md";
export const LIVE_MAX_BYTES = 20480;

/** أقسام حية إلزامية يجب أن تبقى في ملف الحالة الحية. */
export const REQUIRED_LIVE_HEADINGS = [
  "## 1. المصدر المعتمد والحالة العامة",
  "## 4. حدود مالية غير قابلة للتفاوض",
  "## 5. ما هو متوقف عمدًا",
  "## 8. التوسعة والخطوة التنفيذية التالية",
];

export function checkCurrentStateContract({ repoRoot = ROOT } = {}) {
  const findings = [];
  const liveAbs = path.join(repoRoot, LIVE_PATH);
  const logAbs = path.join(repoRoot, LOG_PATH);
  if (!fs.existsSync(liveAbs)) {
    return [{ kind: "missing-live", message: `${LIVE_PATH} does not exist` }];
  }
  const live = fs.readFileSync(liveAbs, "utf8");
  const liveBytes = Buffer.byteLength(live, "utf8");
  if (liveBytes > LIVE_MAX_BYTES) {
    findings.push({
      kind: "size",
      message: `${LIVE_PATH} is ${liveBytes} bytes (> ${LIVE_MAX_BYTES}); move slice/wave history to ${LOG_PATH}`,
    });
  }
  for (const heading of REQUIRED_LIVE_HEADINGS) {
    if (!live.includes(heading)) {
      findings.push({ kind: "missing-heading", message: `${LIVE_PATH} lost required live section "${heading}"` });
    }
  }
  const historyHeadings = live.match(/^## §\d+\./gm) ?? [];
  if (historyHeadings.length > 0) {
    findings.push({
      kind: "history-in-live",
      message: `${LIVE_PATH} contains ${historyHeadings.length} history section heading(s) (## §N.) — history belongs in ${LOG_PATH}`,
    });
  }
  if (!fs.existsSync(logAbs)) {
    findings.push({ kind: "missing-log", message: `${LOG_PATH} does not exist` });
  } else {
    const log = fs.readFileSync(logAbs, "utf8");
    if (!log.includes("HISTORICAL LOG / APPEND-ONLY")) {
      findings.push({ kind: "log-banner", message: `${LOG_PATH} missing append-only historical banner` });
    }
  }
  return findings;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  const findings = checkCurrentStateContract({ repoRoot: root });
  for (const f of findings) {
    console.error(`check-current-state-size: FAIL ${f.kind} ${f.message}`);
  }
  if (findings.length > 0) {
    console.error(`check-current-state-size: ${findings.length} finding(s)`);
    process.exit(1);
  }
  console.log(`check-current-state-size: live contract intact (${Buffer.byteLength(fs.readFileSync(path.join(root, LIVE_PATH), "utf8"), "utf8")}/${LIVE_MAX_BYTES} bytes)`);
  process.exit(0);
}
