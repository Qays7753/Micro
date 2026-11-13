import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // EX-D20 Phase B: repository-supported local PostgreSQL test path.
    // Boots an embedded PostgreSQL once per run (or uses
    // MICRO_TEST_PG_CONNECTION when provided) for the worker tests.
    globalSetup: [path.resolve(import.meta.dirname, "scripts", "pg-test-server.mjs")],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@micro-domain": path.resolve(import.meta.dirname, "..", "..", "src", "domain"),
      /* التحصين الكامل (المجموعة ٣): اختبار مسار تحديث PWA الحقيقي (register.ts)
       * يستدعي وحدة virtual:pwa-register الافتراضية — في الاختبار تُستبدل بكعب
       * اختباري مُحكم بلا أي أثر على بناء المنتج (vite.config.ts كما هو). */
      "virtual:pwa-register": path.resolve(
        import.meta.dirname,
        "client",
        "src",
        "pwa",
        "registerSW.virtual.ts",
      ),
    },
  },
});
