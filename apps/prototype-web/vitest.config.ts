import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
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
