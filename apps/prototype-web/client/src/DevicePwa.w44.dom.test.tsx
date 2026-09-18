/** @vitest-environment jsdom */
/* Wave 4.4 — P-4.4-6: الجهاز وPWA والأداء والانحدار النهائي.
 * ---------------------------------------------------------------------------
 * ١) حارس مصدر دائم: لا <bdi> داخل <option> في أي سطح — المتصفح يرفض
 *    التعشيش ويسجّل أخطاء كونسول (عُثر عليها بجهاز QA الحي على /schedule
 *    ودفتر مال المالك بعد بيانات حقيقية).
 * ٢) حارس CSS لإعادة التدفق: عمود رصيد بطاقات القوائم المشتركة ينكمش
 *    بأرضية min-content (لا تمركز أفقي عند 360px مع أسماء طويلة) وبطاقة
 *    القائمة تتكدس عموديًا دون 340px — التزام عقد Reflow عند 320 CSS px.
 * ٣) حارس PWA: بيان Manifest الجاهز يعتمد standalone وrtl وar وأيقونات
 *    192/512 + maskable — لا انجراف صامت في هوية التثبيت.
 * ٤) حارس هوامش الأمان: env(safe-area-inset-*) موجودة في الكروم العلوي
 *    والسفلي (viewport-fit=cover) — لا محتوى خلف شريط النظام.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const CLIENT_SRC = resolve(__dirname);
const INDEX_CSS = resolve(CLIENT_SRC, "index.css");
const VITE_CONFIG = resolve(CLIENT_SRC, "..", "..", "vite.config.ts");
const INDEX_HTML = resolve(CLIENT_SRC, "..", "index.html");

function collectTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.endsWith(".test.tsx") || entry.endsWith(".test.ts")) continue;
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectTsxFiles(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** يجد كل محتوى <option>…</option> في مصدر JSX (متعدد الأسطر).
 *  يزيل التعليقات والوسوم self-closing أولًا حتى لا تُحسب إيجابيات كاذبة. */
function optionBodies(source: string): string[] {
  const cleaned = source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/<option[^>]*\/>/g, "");
  const bodies: string[] = [];
  const re = /<option[^>]*>([\s\S]*?)<\/option>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) bodies.push(m[1]);
  return bodies;
}

describe("P-4.4-6 — خيار القوائم بلا عناصر مرفوضة (console نظيف)", () => {
  it("لا يعرّش أي سطح <bdi> أو مكوّن قيمة داخل <option>", () => {
    const offenders: string[] = [];
    for (const file of collectTsxFiles(CLIENT_SRC)) {
      for (const body of optionBodies(readFileSync(file, "utf8"))) {
        if (
          body.includes("<bdi") ||
          body.includes("MoneyValue") ||
          body.includes("LocalDateValue") ||
          body.includes("DateTimeValue") ||
          body.includes("TimeValue")
        ) {
          offenders.push(`${file.split("client/src/")[1]}: ${body.trim().slice(0, 80)}`);
        }
      }
    }
    expect(
      offenders,
      `bdi/مكوّن قيمة داخل option يكسر HTML ويكتب أخطاء كونسول:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("P-4.4-6 — Reflow عند المقاسات الضيقة (حارس CSS)", () => {
  const css = readFileSync(INDEX_CSS, "utf8");

  it("عمود رصيد بطاقات القوائم المشتركة ينكمش بأرضية min-content لا صفر", () => {
    const block = css.match(/\.micro-supplier-balance\s*\{[^}]*\}/)?.[0] ?? "";
    expect(block, "كتلة .micro-supplier-balance موجودة").toContain("flex: 0 1 auto");
    expect(block, "أرضية min-content تمنع فيض المبالغ يسارًا في RTL").toContain("min-width: min-content");
  });

  it("بطاقة القائمة تتكدس عموديًا دون 340px — Reflow عند 320 CSS px", () => {
    const media = css.match(/@media\s*\(max-width:\s*340px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(media, "درجة نزول ≤340px موجودة").toContain("flex-direction: column");
    expect(media).toContain(".micro-supplier-list article");
    expect(media).toContain(".micro-supplier-balance");
  });
});

describe("P-4.4-6 — هوية PWA وحقن البيان", () => {
  const viteConfig = readFileSync(VITE_CONFIG, "utf8");
  const indexHtml = readFileSync(INDEX_HTML, "utf8");

  it("البيان: standalone + rtl + ar + أيقونات 192/512 وmaskable", () => {
    expect(viteConfig).toContain('display: "standalone"');
    expect(viteConfig).toContain('dir: "rtl"');
    expect(viteConfig).toContain('lang: "ar"');
    expect(viteConfig).toMatch(/192x192/);
    expect(viteConfig).toMatch(/512x512/);
    expect(viteConfig).toContain('"maskable"');
  });

  it("الترويسة: viewport-fit=cover وtheme-color للوضعين", () => {
    expect(indexHtml).toContain("viewport-fit=cover");
    expect(indexHtml).toMatch(/theme-color[^>]*prefers-color-scheme: light/);
    expect(indexHtml).toMatch(/theme-color[^>]*prefers-color-scheme: dark/);
  });

  it("هوامش الأمان فعلية في الكروم العلوي والسفلي", () => {
    const css = readFileSync(INDEX_CSS, "utf8");
    expect(css).toMatch(/env\(safe-area-inset-top\)/);
    expect(css).toMatch(/env\(safe-area-inset-bottom\)/);
  });
});
