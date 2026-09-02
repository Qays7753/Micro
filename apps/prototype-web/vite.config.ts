import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
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

const pwa = VitePWA({
  registerType: "prompt",
  injectRegister: false,
  includeAssets: ["micro-mark.svg", "micro-mark-192.png", "micro-mark-512.png"],
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
    background_color: "#FAF9F5",
    theme_color: "#CC785C",
    icons: [
      { src: "/micro-mark-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/micro-mark-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
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

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...devOnlyPlugins(mode), pwa],
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
    rollupOptions: {
      output: {
        /* Q-003 (دورة التدقيق النهائي): أزيلت sonner من الشجرة؛ بقيت vaul فقط
         * في حزمة التفاعل. الشكل الكائني لا يضمن ترتيب الإسناد فالدالة تحسمه. */
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|wouter)[\\/]/.test(id)) return "react-runtime";
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
