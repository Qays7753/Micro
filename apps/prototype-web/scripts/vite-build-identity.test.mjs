/**
 * OD-14 = D1 (2026-10-13) — الاختبار السلكي لوسيط هوية البناء (بيئة node
 * خالصة: الاستيراد الحي لـ vite.config نفسه يفرز (1) زوال define القديم
 * تمامًا من الإعداد المحلول، (2) حضور الوسيط في سلسلة الإنتاج، (3) سلوك
 * الإدراج والتهريب حرفيًا (فك التهريب عبر DOM الحقيقي مثبت في
 * buildIdentity.carrier.dom.test.ts بالصيغة المهرّبة نفسها)، (4) التحقق
 * الختامي الصارم (الحامل مرة واحدة بالقيمة المطابقة، وتسريب الهوية إلى
 * JS/CSS/خريطة يُرفض صادقًا)، و(5) توافق اسم الحامل وحد الطول مع عقد
 * buildIdentity.ts (مصدر حقيقة وقت التشغيل). يبني مخرجات وهمية في مجلد
 * مؤقت — لا يمس dist الحقيقي.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import viteConfigFactory, { MICRO_APP_IDENTITY_META_NAME, vitePluginBuildIdentity } from "../vite.config";
import { APP_IDENTITY_META_NAME, resolveAppIdentity } from "../client/src/application/identity/buildIdentity";

const GITHUB_SHA = "4c7fbbdf07cb89e3a786070a17baad0530c2c562";

const SOURCE_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <title>Micro — شريك مشروعك</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const tempDirs = [];
function makeTempDist() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "micro-d1-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
});

function writeDist(distRoot, { html, jsFiles }) {
  fs.mkdirSync(path.join(distRoot, "assets"), { recursive: true });
  fs.writeFileSync(path.join(distRoot, "index.html"), html);
  for (const [name, content] of Object.entries(jsFiles ?? {})) {
    fs.writeFileSync(path.join(distRoot, "assets", name), content);
  }
}

async function resolvedProductionConfig() {
  expect(typeof viteConfigFactory).toBe("function");
  return await viteConfigFactory({ mode: "production", command: "build" });
}

describe("vite.config wiring (OD-14/D1)", () => {
  it("the resolved production config carries NO retired identity define and includes the identity plugin", async () => {
    const config = await resolvedProductionConfig();
    const defineKeys = Object.keys(config.define ?? {});
    expect(defineKeys.join("|")).not.toContain(["__MICRO", "_APP_IDENTITY__"].join(""));
    expect(defineKeys).toEqual([]);
    const names = config.plugins.map(p => p?.name).filter(Boolean);
    expect(names).toContain("micro-build-identity");
    expect(names).toContain("micro-bundle-budget-gate");
  });

  it("carrier name and coercion bound match the runtime contract in buildIdentity.ts", () => {
    expect(MICRO_APP_IDENTITY_META_NAME).toBe(APP_IDENTITY_META_NAME);
    /* الحد الزمني-البنائي (64) يطابق عقد الإكراه: 64 مقبول و65 مرفوض. */
    expect(resolveAppIdentity("x".repeat(64))).toBe("x".repeat(64));
    expect(resolveAppIdentity("x".repeat(65))).toBe("micro-local-dev");
  });
});

describe("micro-build-identity transformIndexHtml (OD-14/D1)", () => {
  it("injects exactly one carrier meta with the exact identity before </head>", () => {
    const plugin = vitePluginBuildIdentity(GITHUB_SHA);
    const out = plugin.transformIndexHtml(SOURCE_HTML);
    expect(out).not.toBe(SOURCE_HTML);
    expect(out.match(/<meta[^>]*micro-app-identity[^>]*>/g)).toHaveLength(1);
    expect(out.indexOf('<meta name="micro-app-identity"')).toBeLessThan(out.indexOf("</head>"));
    expect(out).toContain(`content="${GITHUB_SHA}"`);
    /* الصيغة المهرّبة الحرفية هي ذاتها التي يثبت فكها فحص الحامل في
     * buildIdentity.carrier.dom.test.ts (a&amp;b&lt;c&gt;d&quot;e&#39;f ← الأصل). */
  });

  it("HTML-escapes hostile identity values into the exact pinned escaped form", () => {
    const hostile = "a&b<c>d\"e'f-g.h";
    const out = vitePluginBuildIdentity(hostile).transformIndexHtml(SOURCE_HTML);
    const meta = out.match(/<meta[^>]*micro-app-identity[^>]*>/g)[0];
    expect(meta).not.toContain(`content="${hostile}"`);
    expect(meta).toContain('content="a&amp;b&lt;c&gt;d&quot;e&#39;f-g.h"');
  });

  it("a null identity leaves index.html untouched (honest local fallback, same as the old define: null)", () => {
    expect(vitePluginBuildIdentity(null).transformIndexHtml(SOURCE_HTML)).toBe(SOURCE_HTML);
  });

  it("fails closed when the source html already carries the meta (double-injection guard)", () => {
    const carrying = vitePluginBuildIdentity(GITHUB_SHA).transformIndexHtml(SOURCE_HTML);
    expect(() => vitePluginBuildIdentity(GITHUB_SHA).transformIndexHtml(carrying)).toThrow(
      /micro-build-identity/,
    );
  });

  it("fails closed on malformed identities (empty-after-trim or overlong)", () => {
    expect(() => vitePluginBuildIdentity("   ")).toThrow(/OD-14\/D1/);
    expect(() => vitePluginBuildIdentity("x".repeat(65))).toThrow(/OD-14\/D1/);
    expect(() => vitePluginBuildIdentity("")).toThrow(/OD-14\/D1/);
  });
});

describe("micro-build-identity closeBundle verification (OD-14/D1)", () => {
  function pluginOver(distRoot) {
    const plugin = vitePluginBuildIdentity(GITHUB_SHA);
    plugin.configResolved({ build: { watch: false, outDir: distRoot } });
    return plugin;
  }

  it("accepts a clean dist: carrier present exactly once with the exact value, no identity in JS/CSS/map assets", () => {
    const dist = makeTempDist();
    const html = vitePluginBuildIdentity(GITHUB_SHA).transformIndexHtml(SOURCE_HTML);
    writeDist(dist, {
      html,
      jsFiles: {
        "index-00000000.js": 'console.log("no identity here");',
        "index-00000000.css": "body{color:red}",
        "index-00000000.js.map": '{"version":3}',
        "sw.js": 'const x="not-the-identity";',
      },
    });
    expect(() => pluginOver(dist).closeBundle()).not.toThrow();
  });

  it("rejects a missing carrier (no silent runtime fallback for a production identity)", () => {
    const dist = makeTempDist();
    writeDist(dist, { html: SOURCE_HTML, jsFiles: {} });
    expect(() => pluginOver(dist).closeBundle()).toThrow(/1 بالضبط/);
  });

  it("rejects a duplicated carrier", () => {
    const dist = makeTempDist();
    const one = vitePluginBuildIdentity(GITHUB_SHA).transformIndexHtml(SOURCE_HTML);
    const two = one.replace(
      '<meta name="micro-app-identity"',
      '<meta name="micro-app-identity" content="other" />\n    <meta name="micro-app-identity"',
    );
    writeDist(dist, { html: two, jsFiles: {} });
    expect(() => pluginOver(dist).closeBundle()).toThrow(/1 بالضبط/);
  });

  it("rejects a tampered/unreplaced carrier value", () => {
    const dist = makeTempDist();
    const one = vitePluginBuildIdentity(GITHUB_SHA).transformIndexHtml(SOURCE_HTML);
    writeDist(dist, { html: one.replace(GITHUB_SHA, "0".repeat(40)), jsFiles: {} });
    expect(() => pluginOver(dist).closeBundle()).toThrow(/لا تطابق الهوية/);
  });

  it("rejects an identity leaked into a generated JS asset", () => {
    const dist = makeTempDist();
    const html = vitePluginBuildIdentity(GITHUB_SHA).transformIndexHtml(SOURCE_HTML);
    writeDist(dist, {
      html,
      jsFiles: { "leaky-00000000.js": `const identity="${GITHUB_SHA}";` },
    });
    expect(() => pluginOver(dist).closeBundle()).toThrow(/تسريب هوية/);
  });

  it("rejects an identity leaked into a CSS or source-map asset", () => {
    const dist = makeTempDist();
    const html = vitePluginBuildIdentity(GITHUB_SHA).transformIndexHtml(SOURCE_HTML);
    writeDist(dist, {
      html,
      jsFiles: {
        "a-00000000.css": `/* ${GITHUB_SHA} */`,
        "b-00000000.js.map": `{"sources":["${GITHUB_SHA}"]}`,
      },
    });
    expect(() => pluginOver(dist).closeBundle()).toThrow(/تسريب هوية/);
  });
});
