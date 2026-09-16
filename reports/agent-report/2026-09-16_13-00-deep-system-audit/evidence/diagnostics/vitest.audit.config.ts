import path from "node:path";
import { defineConfig } from "vitest/config";

/* Read-only audit diagnostic config: lives OUTSIDE the repo; only reads repo sources. */
const APP = "/home/z/my-project/micro-repo-readonly/apps/prototype-web";
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(APP, "client", "src"),
      "@micro-domain": path.resolve("/home/z/my-project/micro-repo-readonly/src", "domain"),
      "virtual:pwa-register": path.resolve(APP, "client", "src", "pwa", "registerSW.virtual.ts"),
    },
  },
  test: {
    include: [path.resolve("/home/z/my-project/audit-2026-09-16/agents/2-b/diagnostics", "*.test.ts")],
  },
});
