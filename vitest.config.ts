import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /* المجموعة ٦ (التحصين الكامل): اختبارات حراس المستودع (scripts/*.test.mjs)
     * تعمل مع اختبارات المجال في نفس المسار — بلا شبكة وبلا sleep. */
    include: ["tests/**/*.test.ts", "src/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
