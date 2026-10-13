import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
import { VitePWA } from "vite-plugin-pwa";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
/* Q-002: أدوات التطوير تُخزّن خارج public/ — لا تنسخ إلى أي بناء إنتاجي،
 * وتُقدّم في التطوير فقط عبر وسيط الخادم أدناه. */
const DEV_TOOLS_DIR = path.join(PROJECT_ROOT, "dev-tools");
const DEBUG_COLLECTOR_PATH = path.join(DEV_TOOLS_DIR, "debug-collector.js");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per log file
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6); // Trim to 60% to avoid constant re-trimming

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }

    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    // Keep newest lines (from end) that fit within 60% of maxSize
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
    /* ignore trim errors */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);

  // Format entries with timestamps
  const lines = entries.map(entry => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  // Append to log file
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");

  // Trim if exceeds max size
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

/**
 * Vite plugin to collect browser debug logs
 * - POST /__manus__/logs: Browser sends logs, written directly to files
 * - Files: browserConsole.log, networkRequests.log, sessionReplay.log
 * - Auto-trimmed when exceeding 1MB (keeps newest entries)
 */
function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true,
            },
            injectTo: "head",
          },
        ],
      };
    },

    configureServer(server: ViteDevServer) {
      /* Q-002: تقديم أداة التطوير من خارج public/ — الإنتاج لا يراها أبدًا. */
      server.middlewares.use("/__manus__/debug-collector.js", (_req, res) => {
        try {
          res.setHeader("Content-Type", "application/javascript");
          res.end(fs.readFileSync(DEBUG_COLLECTOR_PATH));
        } catch {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("dev debug collector not found");
        }
      });

      // POST /__manus__/logs: Browser sends logs (written directly to files)
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          // Write logs directly to files
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = "";
        req.on("data", chunk => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

function vitePluginStorageProxy(): Plugin {
  return {
    name: "manus-storage-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/manus-storage", async (req, res) => {
        const key = req.url?.replace(/^\//, "");
        if (!key) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Missing storage key");
          return;
        }

        const forgeBaseUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
        const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;

        if (!forgeBaseUrl || !forgeKey) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Storage proxy not configured");
          return;
        }

        try {
          const forgeUrl = new URL("v1/storage/presign/get", forgeBaseUrl + "/");
          forgeUrl.searchParams.set("path", key);

          const forgeResp = await fetch(forgeUrl, {
            headers: { Authorization: `Bearer ${forgeKey}` },
          });

          if (!forgeResp.ok) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("Storage backend error");
            return;
          }

          const { url } = (await forgeResp.json()) as { url: string };
          if (!url) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("Empty signed URL");
            return;
          }

          res.writeHead(307, { Location: url, "Cache-Control": "no-store" });
          res.end();
        } catch {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end("Storage proxy error");
        }
      });
    },
  };
}

/* D-034 (المجموعة ٤ — برنامج التحصين الكامل): بوابة الميزانية داخل البناء
 * نفسه — الوسيط الخادم (closeBundle) يشغّل السكربت الواحد نفسه (مصدر الحقيقة
 * واحد: scripts/check-bundle-budget.mjs) بعد كتابة المخرجات فيفشل البناء —
 * حتى من مسار `vite build` المباشر لا من مسار pnpm وحده. تُتخطى في وضع
 * المراقبة (watch) حيث لا معنى لبوابة نهائية على إعادة بناء متكررة. */
function vitePluginBundleBudgetGate(): Plugin {
  let watching = false;
  return {
    name: "micro-bundle-budget-gate",
    configResolved(config) {
      watching = Boolean(config.build.watch);
    },
    closeBundle() {
      if (watching) return;
      const checker = path.join(PROJECT_ROOT, "scripts", "check-bundle-budget.mjs");
      const distDir = path.join(PROJECT_ROOT, "dist", "public");
      const outcome = spawnSync(process.execPath, [checker, distDir], { encoding: "utf8" });
      if (outcome.status === 0) return;
      const detail = `${outcome.stdout ?? ""}${outcome.stderr ?? ""}`.trim();
      throw new Error(`bundle budget gate failed (D-034):
${detail}`);
    },
  };
}

const pwa = VitePWA({
  registerType: "prompt",
  injectRegister: false,
  /* W2 (brand) + R8-N1 root fix (2026-10-10): ONE canonical precache-selection
   * path — Workbox `globPatterns` over the build output (which contains the
   * verbatim public tree). The previous `includeAssets` selectors (brand mark/
   * motion/favicon/pwa) and the plugin's default `includeManifestIcons: true`
   * each re-selected the same public files into `workbox.additionalManifestEntries`,
   * and Workbox does not dedupe those against globPatterns — 31 duplicate precache
   * URLs in the generated sw.js (measured: 187 entries / 156 unique before the fix).
   * Every intended offline asset class is already covered by globPatterns
   * (svg/png/ico brand assets incl. splash, woff2/css fonts, js/css/html shell),
   * and manifest.webmanifest keeps its own plugin-managed entry — so the redundant
   * selectors are removed, not narrowed: each intended URL is selected exactly
   * once, by exactly one path. App-shell brand surfaces (mark, favicon, install
   * icons) precache with the shell; splash motion layers + platform-ready splash
   * references precache too so the launch moment works offline. No API, financial
   * or storage behavior enters the SW. check-bundle-surfaces now fails closed on
   * any duplicate precache URL (regression class for this fix). */
  includeManifestIcons: false,
  manifest: {
    id: "/",
    name: "Micro — شريك مشروعك",
    short_name: "Micro",
    description: "Micro: شريك مالي وتشغيلي محلي لصاحب المشروع.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    lang: "ar",
    dir: "rtl",
    background_color: "#F0F3F4",
    theme_color:
      "#F0F3F4" /* UX-001 V2: canvas chrome — matches index.html meta + ThemeContext runtime value; identity lives on the create surface, not app chrome */,
    /* W2 (brand): approved symbol-only icons. 512 any stays the install anchor; the
     * maskable 512 is declared separately with purpose "maskable" so platforms never
     * letterbox or crop the any-purpose mark. */
    icons: [
      { src: "/brand/pwa/ios-android-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/pwa/ios-android-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/pwa/web-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  },
  workbox: {
    cleanupOutdatedCaches: true,
    clientsClaim: false,
    skipWaiting: false,
    navigateFallback: "/index.html",
    navigateFallbackAllowlist: [/^\/(?!__manus__)/],
    globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
    globIgnores: ["**/__manus__/**"],
    maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
  },
  devOptions: { enabled: false },
});

// أدوات بيئة التوليد ليست جزءًا من المنتج. تعمل في التطوير فقط، ولا تدخل
// أي بناء إنتاجي. لتعطيلها في التطوير أيضًا: MICRO_DEV_TOOLS=0
function devOnlyPlugins(mode: string) {
  if (mode === "production" || process.env.MICRO_DEV_TOOLS === "0") return [];
  return [vitePluginManusRuntime(), vitePluginManusDebugCollector(), vitePluginStorageProxy()];
}

/* المجموعة ٥ (التحصين الكامل — هوية البناء) + OD-14 = D1 (2026-10-13 — الجذر
 * المعتمد لـ R10B-NF-038): الهوية تُحمل في index.html (وسم meta واحد) عند حدود
 * الإصدار لا في مدخل الجافاسكربت — فيصير رسم شظايا الحزمة محصّنًا ضد تغيّر
 * الهوية (نهاية شلال إعادة التهشير الذي كان يعيد لف gzip الدخول عشرات
 * البايتات مع كل التزام بلا أي تغيير محتوى)، ويبقى إبطال ذاكرة PWA سليمًا
 * عبر مراجعة precache الخاصة بـ index.html ذاتها. وسم meta هو الحامل الوحيد
 * الممكن تحت CSP (script-src 'self' بلا unsafe-inline): لا سكربت مضمن ولا
 * ملف بيانات يُجلب وقت التشغيل ولا مصدر هوية ثانٍ. */
function buildIdentityFromEnv(): string | null {
  const explicit = process.env.VITE_APP_VERSION?.trim();
  if (explicit) return explicit;
  const githubSha = process.env.GITHUB_SHA?.trim();
  if (githubSha) return githubSha;
  const pagesSha = process.env.CF_PAGES_COMMIT_SHA?.trim();
  if (pagesSha) return pagesSha;
  return null;
}
const MICRO_APP_IDENTITY = buildIdentityFromEnv();

/** اسم وسم الحامل في index.html — نفس ثابت buildIdentity.ts (يفرز اختبار
 * سلكي تساويهما، وقراءته وقت التشغيل محروسة ضد غياب المستند). */
export const MICRO_APP_IDENTITY_META_NAME = "micro-app-identity";

/* نفس حد الإكراه في buildIdentity.ts::MAX_APP_IDENTITY_CHARS (مصدر الحقيقة
 * وقت التشغيل) — التطابق مثبت بالاختبار السلكي scripts/vite-build-identity.test.mjs. */
const MAX_BUILD_IDENTITY_CHARS = 64;

/** تهريب سمة HTML قبل الإدراج — المحارف الخمسة وحدها تكفي لسلامة السمة
 * المقتبسة، والقراءة عبر getAttribute تعيد فك التهريب للقيمة الأصلية ذاتها. */
function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function vitePluginBuildIdentity(identity: string | null): Plugin {
  /* تحقق صارم وقت البناء: هوية صريحة لا تجتاز عقد الإكراه (فارغة بعد
   * التقليم أو أطول من الحد) تفشل البناء الآن — لا سقوط صامت إلى قيمة
   * محلية في مخرج إنتاج. */
  if (identity !== null && (identity.trim() === "" || identity.length > MAX_BUILD_IDENTITY_CHARS)) {
    throw new Error(
      `micro-build-identity: الهوية فشلت التحقق الصارم (OD-14/D1) — فارغة بعد التقليم أو أطول من ${MAX_BUILD_IDENTITY_CHARS} محرفًا (عقد buildIdentity.ts)`,
    );
  }
  let watching = false;
  let distRoot = path.join(PROJECT_ROOT, "dist", "public");
  return {
    name: "micro-build-identity",
    configResolved(config) {
      watching = Boolean(config.build.watch);
      if (typeof config.build.outDir === "string" && config.build.outDir !== "") {
        distRoot = config.build.outDir;
      }
    },
    transformIndexHtml(html) {
      if (html.includes(`name="${MICRO_APP_IDENTITY_META_NAME}"`)) {
        throw new Error(
          `micro-build-identity: تعارض الحامل (OD-14/D1) — index.html المصدر يحمل وسم ${MICRO_APP_IDENTITY_META_NAME} مسبقًا والحامل يُدخل وقت البناء وحده`,
        );
      }
      if (identity === null) {
        /* لا هوية من البيئة (تطوير/اختبار محلي) — لا وسم؛ حارس وقت التشغيل
         * في buildIdentity يرجع البديل المحلي الصادق تمامًا كما كان define: null. */
        return html;
      }
      const anchor = "  </head>";
      const anchorAt = html.indexOf(anchor);
      if (anchorAt === -1) {
        throw new Error("micro-build-identity: لا مرساة </head> في index.html لإدراج الحامل (OD-14/D1)");
      }
      const tag = `    <meta name="${MICRO_APP_IDENTITY_META_NAME}" content="${escapeHtmlAttribute(identity)}" />\n`;
      return html.slice(0, anchorAt) + tag + html.slice(anchorAt);
    },
    closeBundle() {
      if (watching || identity === null) return;
      /* التحقق الختامي الصارم — يفشل البناء قبل قبول أي مخرجات: الحامل موجود
       * مرة واحدة بالقيمة المطابقة حرفيًا، والهوية غائبة من كل مخرجات JS/CSS/
       * خرائط المصدر (تسريب الهوية لغير index.html عيب يُرفض صادقًا).
       * الهويات الأقصر من 16 محرفًا لا تُمسح بايتيًا — إبرة بهذا القصر غير
       * قابلة للتمييز دون إيجابيات كاذبة؛ الآلية مثبتة بالاختبار السلبي
       * الدائم بهوية بطول SHA (واقع Actions/Pages دائمًا). */
      const html = fs.readFileSync(path.join(distRoot, "index.html"), "utf8");
      const tagPattern = new RegExp(`<meta[^>]*name="${MICRO_APP_IDENTITY_META_NAME}"[^>]*>`, "g");
      const tags = html.match(tagPattern) ?? [];
      if (tags.length !== 1) {
        throw new Error(
          `micro-build-identity: وسم الحامل موجود ${tags.length} مرة — المطلوب 1 بالضبط (OD-14/D1)`,
        );
      }
      const expectedContent = `content="${escapeHtmlAttribute(identity)}"`;
      if (!tags[0].includes(expectedContent)) {
        throw new Error(
          "micro-build-identity: قيمة الحامل لا تطابق الهوية (فارغة/معطوبة/غير مستبدلة — OD-14/D1)",
        );
      }
      if (identity.length >= 16) {
        const needle = Buffer.from(identity, "utf8");
        const scan = (dir: string) => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              scan(full);
              continue;
            }
            if (entry.name === "index.html") continue;
            if (!/\.(js|css|map)$/.test(entry.name)) continue;
            if (fs.readFileSync(full).includes(needle)) {
              throw new Error(
                `micro-build-identity: تسريب هوية (OD-14/D1) — الهوية موجودة في ${path.relative(distRoot, full)} ولا تجوز إلا في index.html`,
              );
            }
          }
        };
        scan(distRoot);
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    vitePluginBuildIdentity(MICRO_APP_IDENTITY),
    ...devOnlyPlugins(mode),
    pwa,
    ...(mode === "production" ? [vitePluginBundleBudgetGate()] : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@micro-domain": path.resolve(import.meta.dirname, "..", "..", "src", "domain"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    /* D-034 (المجموعة ٤): بيّنة البناء — مصدر اختيار المدخل الرئيسي في
     * بوابة الميزانية (لا تخمين أسماء التجزئة). */
    manifest: true,
    rollupOptions: {
      output: {
        /* Q-003 (دورة التدقيق النهائي): أزيلت sonner من الشجرة؛ بقيت vaul فقط
         * في حزمة التفاعل. الشكل الكائني لا يضمن ترتيب الإسناد فالدالة تحسمه. */
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|wouter)[\\/]/.test(id))
            return "react-runtime";
          if (/[\\/]node_modules[\\/](vaul)[\\/]/.test(id)) return "interaction-runtime";
          if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) return "iconography";
          /* S5-10: فصل radix — مشترك بين Tooltip المتحمس وvaul الكسول؛ فصله يجعل كسل التفاعل حقيقيًا. */
          if (/[\\/]node_modules[\\/]@radix-ui[\\/]/.test(id)) return "radix-runtime";
          return undefined;
        },
      },
    },
  },
  server: {
    port: 3000,
    strictPort: false, // Will find next available port if 3000 is busy
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      ".replit.dev",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      allow: [
        path.resolve(import.meta.dirname, "client"),
        path.resolve(import.meta.dirname, "..", "..", "src"),
      ],
      deny: ["**/.*"],
    },
  },
}));
