import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkCurrentStateContract, LIVE_MAX_BYTES, ROOT } from "./check-current-state-size.mjs";

function makeRepo({ live, log }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cs-contract-"));
  fs.mkdirSync(path.join(dir, "docs/operations"), { recursive: true });
  if (live !== undefined) fs.writeFileSync(path.join(dir, "docs/operations/current-state.md"), live);
  if (log !== undefined) fs.writeFileSync(path.join(dir, "docs/operations/current-state-log.md"), log);
  return dir;
}

describe("check-current-state-size", () => {
  it("fails when the live file exceeds the cap", () => {
    const dir = makeRepo({
      live: "# حالة\n" + "## 1. المصدر المعتمد والحالة العامة\n## 4. حدود مالية غير قابلة للتفاوض\n## 5. ما هو متوقف عمدًا\n## 8. التوسعة والخطوة التنفيذية التالية\n" + "أ".repeat(LIVE_MAX_BYTES),
      log: "**الحالة:** `HISTORICAL LOG / APPEND-ONLY — ليس المصدر الحالي`",
    });
    try {
      const findings = checkCurrentStateContract({ repoRoot: dir });
      expect(findings.some((f) => f.kind === "size")).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails when history sections creep back into the live file", () => {
    const dir = makeRepo({
      live: "# حالة\n## 1. المصدر المعتمد والحالة العامة\n## 4. حدود مالية غير قابلة للتفاوض\n## 5. ما هو متوقف عمدًا\n## 8. التوسعة والخطوة التنفيذية التالية\n## §31. المجموعة ٢\n",
      log: "**الحالة:** `HISTORICAL LOG / APPEND-ONLY — ليس المصدر الحالي`",
    });
    try {
      const findings = checkCurrentStateContract({ repoRoot: dir });
      expect(findings.some((f) => f.kind === "history-in-live")).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails when the log is missing or unbannered", () => {
    const dir = makeRepo({
      live: "# حالة\n## 1. المصدر المعتمد والحالة العامة\n## 4. حدود مالية غير قابلة للتفاوض\n## 5. ما هو متوقف عمدًا\n## 8. التوسعة والخطوة التنفيذية التالية\n",
      log: "# سجل بلا لافتة",
    });
    try {
      const findings = checkCurrentStateContract({ repoRoot: dir });
      expect(findings.some((f) => f.kind === "log-banner")).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("live repo: contract intact (WS-204 regression pin)", () => {
    const findings = checkCurrentStateContract({ repoRoot: ROOT });
    expect(findings).toEqual([]);
  });
});
