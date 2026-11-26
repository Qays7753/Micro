/**
 * M1.8 (§10/§11 + §14.2 / قرار المالك D-7): اختبار الكتالوج مقابل
 * المواصفة — المفتاح والقيمة معًا. يقرأ `docs/manage-v2/micro-manage-spec-
 * final.md` بالتحليل التطبيقي الموثَّق نفسه المستخدم في بناء الكتالوج
 * (جداول `| مفتاح | نص |`، صفوف متعددة المفاتيح تقسم بالمسافة-الشرطة على
 * الجانبين وتُقترن بالفهرس، سطر §10.2 السطري، وحذف الحاشية الإنجليزية من
 * E-CORRECTION-BREAKS-BALANCES لأنها تعليق مواصفة لا نص واجهة)، ثم يثبت:
 *  - مجموعة مفاتيح الكتالوج = مجموعة مفاتيح المواصفة بالضبط (لا ناقص لا زائد).
 *  - كل قيمة مطابقة بايت-بايت للمواصفة («انسخ، لا تبتكر ولا تصُغ بأسلوبك»).
 *  - المفاتيح فريدة وكل قيمة غير فارغة، وt(key) ترجع نص الكتالوج وترمي
 *    على مفتاح مجهول (فشل مغلق).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MANAGE_STRING_KEYS, MANAGE_STRINGS_AR, t } from "./index";
import type { ManageStringKey } from "./keys";

const SPEC_URL = new URL("../../../../../../../docs/manage-v2/micro-manage-spec-final.md", import.meta.url);
const SPEC_PATH = fileURLToPath(SPEC_URL);

interface SpecEntry {
  key: string;
  value: string;
}

function extractSpecEntries(): SpecEntry[] {
  const spec = readFileSync(SPEC_PATH, "utf8");
  const lines = spec.split("\n");
  const start = lines.findIndex(line => line.startsWith("## 10. UI strings"));
  const end = lines.findIndex(line => line.startsWith("## 12. Implementation order"));
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const entries: SpecEntry[] = [];
  for (const raw of lines.slice(start, end)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    if (/^`[a-z0-9_.-]+`/.test(line) && line.includes("·")) {
      const pairPattern = /`([^`]+)`\s+([^·]+?)(?=\s·\s|$)/g;
      let match = pairPattern.exec(line);
      while (match !== null) {
        entries.push({ key: (match[1] ?? "").trim(), value: (match[2] ?? "").trim() });
        match = pairPattern.exec(line);
      }
      continue;
    }
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map(cell => cell.trim());
    while (cells.length > 0 && (cells[0] ?? "") === "") cells.shift();
    while (cells.length > 0 && (cells[cells.length - 1] ?? "") === "") cells.pop();
    if (cells.length < 2) continue;
    const keyCell = cells[0] ?? "";
    const valueCell = cells[1] ?? "";
    if (keyCell === "Key" || keyCell === "Code" || /^-+$/.test(keyCell)) continue;
    if (keyCell.includes(" / ")) {
      const keys = keyCell.split(" / ").map(key => key.trim());
      const values = valueCell.split(" / ").map(value => value.trim());
      expect(keys.length).toBe(values.length);
      keys.forEach((key, index) => entries.push({ key, value: values[index] ?? "" }));
      continue;
    }
    const value = valueCell.replace(/\s*\(and the dependent operations[^)]*\)\s*$/u, "").trim();
    entries.push({ key: keyCell, value });
  }
  return entries;
}

describe("M1.8 (§10/§11) — Manage strings catalog vs the spec", () => {
  const entries = extractSpecEntries();
  const specKeys = entries.map(entry => entry.key);
  const catalogKeys: string[] = [...MANAGE_STRING_KEYS];

  it("spec parse yields a unique, non-empty key set", () => {
    expect(new Set(specKeys).size).toBe(specKeys.length);
    expect(specKeys.length).toBeGreaterThan(200);
    for (const entry of entries) expect(entry.value.length).toBeGreaterThan(0);
  });

  it("catalog key set equals the spec key set exactly (no missing, no extra)", () => {
    expect(new Set(catalogKeys).size).toBe(catalogKeys.length);
    const missing = specKeys.filter(key => !catalogKeys.includes(key));
    const extra = catalogKeys.filter(key => !specKeys.includes(key));
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
    expect(catalogKeys.length).toBe(specKeys.length);
  });

  it("every catalog value matches the spec verbatim (byte-for-byte)", () => {
    const specByValue = new Map(entries.map(entry => [entry.key, entry.value] as const));
    for (const key of catalogKeys) {
      const expected = specByValue.get(key);
      expect(expected, `spec value for ${key}`).toBeDefined();
      expect(MANAGE_STRINGS_AR[key as ManageStringKey]).toBe(expected);
    }
  });

  it("t(key) returns the catalog text for every key and throws on an unknown key", () => {
    for (const key of catalogKeys) {
      expect(t(key as ManageStringKey)).toBe(MANAGE_STRINGS_AR[key as ManageStringKey]);
    }
    expect(() => t("definitely.not.a.key" as ManageStringKey)).toThrow();
  });

  it("the catalog record covers every key and nothing else", () => {
    expect(Object.keys(MANAGE_STRINGS_AR).sort()).toEqual([...catalogKeys].sort());
  });
});
