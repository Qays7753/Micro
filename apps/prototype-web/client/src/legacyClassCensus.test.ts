import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/*
 * W2 (completion run) — حارس الأصناف المتقاعدة (repo-wide census guard).
 * ---------------------------------------------------------------------------
 * درس تدقيق الوكلاء: إحصاء سابق شمل pages/components فقط ففلت زر
 * StartupGate في app/. هذا الحارس يمسح كل الجذور المصدرية غير الاختبارية
 * (pages · components · app · pwa · contexts) ويفشل عند أي استخدام لأصناف
 * الأزرار/اللصاقات المتقاعدة في الكود (خارج التعليقات).
 */

const ROOT = fileURLToPath(new URL("./", import.meta.url));
const SCANNED_DIRS = ["pages", "components", "app", "pwa", "contexts"];
const LEGACY_CLASSES = [
  "micro-button-primary",
  "micro-button-secondary",
  "micro-button-danger",
  "micro-button-quiet",
  "micro-button-block",
  "micro-save-cost",
  "micro-full-action",
  "micro-choice-row",
  "micro-status-chip",
];

function listFiles(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(full);
      } else if (exts.some(ext => entry.name.endsWith(ext)) && !entry.name.includes(".test.")) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

/** يزيل التعليقات حتى لا يُحسب ذكرٌ توثيقي للصنف المتقاعد كاستخدام. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("legacy button/status class census guard (all source roots)", () => {
  it("no non-test source file uses a retired legacy class — use the shared primitives", () => {
    const violations: string[] = [];
    for (const dir of SCANNED_DIRS) {
      const files = listFiles(join(ROOT, dir), [".tsx", ".ts"]);
      for (const file of files) {
        const code = stripComments(readFileSync(file, "utf8"));
        for (const cls of LEGACY_CLASSES) {
          if (code.includes(cls)) {
            violations.push(`${file.replace(ROOT, "")} uses ${cls}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("the retired classes no longer have style definitions — primitives.css is the only button-contract home", () => {
    const indexCss = readFileSync(join(ROOT, "index.css"), "utf8");
    for (const cls of LEGACY_CLASSES) {
      expect(indexCss).not.toContain(`.${cls}`);
    }
  });
});
