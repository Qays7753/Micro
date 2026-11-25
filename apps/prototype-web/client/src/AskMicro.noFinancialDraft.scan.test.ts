/* M1.3 (حدود النطاق / IMPACT S3 — أمر تنفيذ المرحلة ١، الموجة A): مسح مصدر
 * سطح Ask — القبول الحرفي للأمر: لا إشارة في `client/src/pages/AskMicro.tsx`
 * ولا في أي ملف تحت `client/src/components/ask/` إلى بطاقة المسودة ولا إلى
 * بنّاء الحدث المالي ولا إلى مسار حفظ السجلات المالية. الدخان السلوكي
 * المقابل في الملف الملاصق AskMicro.noFinancialDraft.dom.test.tsx. */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ASK_SCAN_ROOT = fileURLToPath(new URL("./components/ask/", import.meta.url));

function askComponentSources(): { file: string; source: string }[] {
  if (!existsSync(ASK_SCAN_ROOT)) return [];
  const sources: { file: string; source: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = join(dir, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        sources.push({ file: child, source: readFileSync(child, "utf8") });
      }
    }
  };
  walk(ASK_SCAN_ROOT);
  return sources;
}

describe("M1.3 (IMPACT S3) — مسح مصدر سطح Ask", () => {
  it("لا إشارة إلى بطاقة المسودة ولا إلى بنّاء الحدث المالي ولا إلى عائلة السجلات المالية", () => {
    const pageSource = readFileSync(fileURLToPath(new URL("./pages/AskMicro.tsx", import.meta.url)), "utf8");
    const scanned = [{ file: "client/src/pages/AskMicro.tsx", source: pageSource }, ...askComponentSources()];
    expect(scanned.length).toBeGreaterThan(0);
    const tokens = ["AskDraftCard", "constructFinancialEventRecord", "saveManageRecord", "financialEvents"];
    const offenders = scanned
      .flatMap(({ file, source }) =>
        tokens.filter(token => source.includes(token)).map(token => `${file}: ${token}`),
      )
      .sort();
    expect(offenders).toEqual([]);
  });
});
