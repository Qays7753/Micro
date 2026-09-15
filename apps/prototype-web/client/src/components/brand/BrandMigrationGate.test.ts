/**
 * W2 migration gate — after the brand migration no ACTIVE runtime reference to the old
 * `micro-mark` assets may remain, and the old public files must be gone.
 * Historical documentation references are allowed (evidence is preserved, not rewritten).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* client/src/components/brand → apps/prototype-web (4 levels up). */
const APP_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const CLIENT_ROOT = path.join(APP_ROOT, "client");

const RUNTIME_FILES = [
  path.join(CLIENT_ROOT, "index.html"),
  path.join(APP_ROOT, "vite.config.ts"),
  path.join(CLIENT_ROOT, "src", "components", "layout", "AppHeader.tsx"),
  path.join(CLIENT_ROOT, "src", "components", "brand", "BrandMark.tsx"),
  path.join(CLIENT_ROOT, "src", "components", "brand", "BrandLaunchSplash.tsx"),
];

const OLD_RUNTIME_FILES = [
  "client/public/micro-mark.svg",
  "client/public/micro-mark-192.png",
  "client/public/micro-mark-512.png",
];

describe("brand migration gate (W2)", () => {
  it("has no micro-mark reference in any active runtime file", () => {
    for (const file of RUNTIME_FILES) {
      const content = fs.readFileSync(file, "utf8");
      expect(content, `old reference remains in ${path.basename(file)}`).not.toMatch(/micro-mark/);
    }
  });

  it("removed the old public logo assets", () => {
    for (const rel of OLD_RUNTIME_FILES) {
      expect(fs.existsSync(path.join(APP_ROOT, rel)), `${rel} still exists`).toBe(false);
    }
  });

  it("references only approved symbol-only brand assets at runtime", () => {
    const html = fs.readFileSync(path.join(CLIENT_ROOT, "index.html"), "utf8");
    for (const ref of [
      "/brand/favicon/favicon.ico",
      "/brand/favicon/micro-favicon-field.svg",
      "/brand/favicon/micro-favicon-field-dark.svg",
      "/brand/favicon/favicon-32.png",
      "/brand/favicon/favicon-16.png",
      "/brand/pwa/ios-android-180.png",
    ]) {
      expect(html, `missing favicon reference ${ref}`).toContain(ref);
    }
    const viteConfig = fs.readFileSync(path.join(APP_ROOT, "vite.config.ts"), "utf8");
    expect(viteConfig).toContain("/brand/pwa/ios-android-192.png");
    expect(viteConfig).toContain("/brand/pwa/ios-android-512.png");
    expect(viteConfig).toContain("/brand/pwa/web-maskable-512.png");
    expect(viteConfig).not.toMatch(
      /lockup|arabic-light|arabic-dark|latin-light|latin-dark|appicon-terracotta/,
    );
  });

  it("keeps lang=ar, dir=rtl and both theme-color metas intact", () => {
    const html = fs.readFileSync(path.join(CLIENT_ROOT, "index.html"), "utf8");
    expect(html).toContain('lang="ar"');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('media="(prefers-color-scheme: light)"');
    expect(html).toContain('media="(prefers-color-scheme: dark)"');
  });

  it("ships every declared brand asset on disk (manifest icons exist at their paths)", () => {
    const required = [
      "client/public/brand/mark/micro-quad.svg",
      "client/public/brand/mark/micro-quad-dark.svg",
      "client/public/brand/mark/micro-quad-compact.svg",
      "client/public/brand/pwa/ios-android-192.png",
      "client/public/brand/pwa/ios-android-512.png",
      "client/public/brand/pwa/web-maskable-512.png",
      "client/public/brand/pwa/ios-android-180.png",
      "client/public/brand/favicon/favicon.ico",
      "client/public/brand/motion/light/1-top-ink.svg",
      "client/public/brand/motion/light/4-left-terracotta.svg",
      "client/public/brand/motion/dark/1-top-ink.svg",
      "client/public/brand/motion/dark/4-left-terracotta.svg",
    ];
    for (const rel of required) {
      expect(fs.existsSync(path.join(APP_ROOT, rel)), `${rel} missing`).toBe(true);
    }
  });

  it("keeps git-tracked source tree free of lockup/wordmark assets", () => {
    const out = execSync("git ls-files apps/prototype-web/client/public", {
      cwd: APP_ROOT,
      encoding: "utf8",
    });
    expect(out).not.toMatch(/lockup|arabic-light|arabic-dark|latin-light|latin-dark|appicon-terracotta/);
  });
});
