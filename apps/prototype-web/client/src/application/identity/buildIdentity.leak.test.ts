/** OD-14 = D1 (2026-10-13) — الحماية السلبية الدائمة من قنوات الهوية الثانية:
 * لا وجود لـ define القديم في أي مكان، ولا استخدام كائني لـ import.meta.env،
 * ولا قراءة متغيرات هوية خارج موضعي الحل الموثقين (vite.config.ts وحارس
 * الأسطح المثبت بالتوافق)، والمصدر index.html خالٍ من الحامل (يُدخل وقت
 * البناء وحده). أي عودة لقناة هوية في الجافاسكربت تُصطاد هنا آليًا. */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const APP_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const CLIENT_SRC = path.join(APP_ROOT, "client", "src");
const PROTOTYPE_ROOT = APP_ROOT;

function walk(dir: string, visit: (file: string) => void) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".manus-logs") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, visit);
      continue;
    }
    visit(full);
  }
}

const isTestFile = (file: string) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file);

/** موضعا حل الهوية الموثقان وحدهما — الحارس نسخة توافق مثبتة بالاختبار. */
const ALLOWED_IDENTITY_ENV_SITES = new Set([
  path.join(PROTOTYPE_ROOT, "vite.config.ts"),
  path.join(PROTOTYPE_ROOT, "scripts", "check-bundle-surfaces.mjs"),
]);

/* مطابقة أنماط القراءة الفعلية (وصول خاصية أو تفكيك من env) — التعليقات
 * التوثيقية التي تذكر أسماء المتغيرات نصًا ليست قراءة ولا تُصطاد. */
const IDENTITY_ENV_READ =
  /\.(?:VITE_APP_VERSION|GITHUB_SHA|CF_PAGES_COMMIT_SHA)\b|\{\s*(?:VITE_APP_VERSION|GITHUB_SHA|CF_PAGES_COMMIT_SHA)\s*[,:}]/;

describe("OD-14/D1 static leak protection — no second identity channel", () => {
  it("the retired identity define (double-underscore MICRO constant) exists nowhere under apps/prototype-web", () => {
    /* الإبرة تُبنى ديناميكيًا حتى لا يصطاد الفحص نصه هو نفسه. */
    const retiredDefine = ["__MICRO", "_APP_IDENTITY__"].join("");
    const offenders: string[] = [];
    walk(PROTOTYPE_ROOT, file => {
      if (!/\.(ts|tsx|js|mjs|cjs|json|html)$/.test(file)) return;
      if (readFileSync(file, "utf8").includes(retiredDefine)) offenders.push(file);
    });
    expect(offenders).toEqual([]);
  });

  it("client production code never reads import.meta.env as a whole object or a VITE_ variable", () => {
    const wholeObject: string[] = [];
    const viteVar: string[] = [];
    walk(CLIENT_SRC, file => {
      if (isTestFile(file) || !/\.(ts|tsx)$/.test(file)) return;
      const text = readFileSync(file, "utf8");
      if (/import\.meta\.env(?![.\w])/.test(text)) wholeObject.push(file);
      if (/import\.meta\.env\s*\.\s*VITE_/.test(text)) viteVar.push(file);
    });
    expect(wholeObject).toEqual([]);
    expect(viteVar).toEqual([]);
  });

  it("identity environment variables are resolved only in the two documented sites", () => {
    const offenders: string[] = [];
    walk(PROTOTYPE_ROOT, file => {
      if (isTestFile(file)) return;
      if (!/\.(ts|tsx|js|mjs)$/.test(file)) return;
      if (ALLOWED_IDENTITY_ENV_SITES.has(file)) return;
      if (IDENTITY_ENV_READ.test(readFileSync(file, "utf8"))) offenders.push(file);
    });
    expect(offenders).toEqual([]);
  });

  it("the source index.html carries no identity meta — the carrier is injected at build time only", () => {
    const html = readFileSync(path.join(PROTOTYPE_ROOT, "client", "index.html"), "utf8");
    expect(html).not.toContain("micro-app-identity");
    expect(html).not.toContain("__MICRO");
  });
});
