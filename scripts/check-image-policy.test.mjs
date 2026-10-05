import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { checkImagePolicy, listImages, enumerationMode, ROOT } from "./check-image-policy.mjs";

function makeRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "img-policy-"));
  for (const rel of files) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, "x");
  }
  return dir;
}

/**
 * الخطوة ٥ (تصحيح ما بعد المسح لPR #316 — 2026-10-06): عينة git مصغرة —
 * مستودع حقيقي بفهرس و.gitignore لاختبار نطاق المصدر السلطوي (المتتبع +
 * غير المتتبع غير المتجاهل) ضد الناتج المولَّد المتجاهَل.
 */
function makeGitRepo(trackedFiles, ignoredDirs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "img-policy-git-"));
  fs.writeFileSync(path.join(dir, ".gitignore"), `${ignoredDirs.join("\n")}\n`, "utf8");
  for (const rel of trackedFiles) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, "x");
  }
  const git = args =>
    spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  git(["init", "-q"]);
  git(["add", ".gitignore", ...trackedFiles]);
  return { dir, git };
}

describe("check-image-policy", () => {
  it("lists images across the scanned trees", () => {
    const dir = makeRepo(["apps/x/a.png", "docs/b.jpeg", "reports/c.SVG"]);
    try {
      const imgs = listImages(dir);
      expect(imgs).toContain("apps/x/a.png");
      expect(imgs).toContain("docs/b.jpeg");
      expect(imgs).toContain("reports/c.SVG");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails for screenshots outside the baseline and allows only operational assets", () => {
    const dir = makeRepo([
      "apps/prototype-web/client/public/brand/mark.svg",
      "planning/ux-001-v2-evolution-2026-09-24/visual-review/shot.png",
      "reports/agent-report/2026-99-99_run/screen.png",
      "docs/quality/screenshots/x.png",
    ]);
    try {
      const findings = checkImagePolicy({ repoRoot: dir });
      expect(findings.some(f => f.path === "reports/agent-report/2026-99-99_run/screen.png")).toBe(true);
      expect(findings.some(f => f.path === "docs/quality/screenshots/x.png")).toBe(true);
      expect(findings.some(f => f.path?.startsWith("apps/"))).toBe(false);
      expect(findings.some(f => f.path?.startsWith("planning/ux-001"))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails when the frozen operational-image count drifts", () => {
    const dir = makeRepo(["apps/prototype-web/client/public/brand/mark.svg"]);
    try {
      const findings = checkImagePolicy({ repoRoot: dir });
      expect(findings.some(f => f.kind === "image-count-drift")).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("live repo: all images within the approved baseline (WS-204 regression pin)", () => {
    expect(enumerationMode(ROOT)).toBe("git");
    const imgs = listImages(ROOT);
    expect(imgs.length).toBe(36);
    expect(checkImagePolicy({ repoRoot: ROOT })).toEqual([]);
  });

  /* ─── الخطوة ٥: انحراف dist/ الزائف — نطاق المصدر مقابل الناتج المولَّد ─── */

  it("regression (Step 5, git mode): temporary dist/ copies after a build create no false positives", () => {
    const { dir, git } = makeGitRepo(["apps/prototype-web/client/public/brand/mark.svg"], ["dist/", "build/"]);
    try {
      /* نسخ مولَّدة كما يفعل البناء: dist في الجذر ومتداخلة تحت apps. */
      for (const rel of [
        "dist/public/brand/mark.svg",
        "apps/prototype-web/dist/public/brand/mark.svg",
        "apps/prototype-web/build/brand-copy.svg",
      ]) {
        const abs = path.join(dir, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, "x");
      }
      expect(enumerationMode(dir)).toBe("git");
      const imgs = listImages(dir);
      expect(imgs).toEqual(["apps/prototype-web/client/public/brand/mark.svg"]);
      const findings = checkImagePolicy({ repoRoot: dir });
      /* الانحراف الوحيد المتبقي هو عدد العينة (1≠36) — لا صور خارج خط الأساس
       * ولا أي مسار dist/ في أي مكتشف: النسخ المولَّدة خارج نطاق المصدر. */
      expect(findings.some(f => f.path?.includes("dist/") || f.path?.includes("build/"))).toBe(false);
      expect(findings.every(f => f.kind === "image-count-drift")).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("no bypass in git mode: an untracked non-ignored source image is still enumerated and judged", () => {
    const { dir } = makeGitRepo(["apps/prototype-web/client/public/brand/mark.svg"], ["dist/"]);
    try {
      const prohibited = path.join(dir, "planning", "visual-review", "shot.png");
      fs.mkdirSync(path.dirname(prohibited), { recursive: true });
      fs.writeFileSync(prohibited, "x");
      const imgs = listImages(dir);
      expect(imgs).toContain("planning/visual-review/shot.png");
      const findings = checkImagePolicy({ repoRoot: dir });
      expect(findings.some(f => f.path === "planning/visual-review/shot.png")).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fallback mode (no git): generated directory names are excluded at any depth, tracked-style sources still counted", () => {
    const dir = makeRepo([
      "apps/prototype-web/client/public/brand/mark.svg",
      "apps/prototype-web/dist/public/brand/mark.svg",
      "docs/quality/screenshots/x.png",
    ]);
    try {
      expect(enumerationMode(dir)).toBe("walk-fallback");
      const imgs = listImages(dir);
      expect(imgs).toContain("apps/prototype-web/client/public/brand/mark.svg");
      expect(imgs).not.toContain("apps/prototype-web/dist/public/brand/mark.svg");
      expect(imgs).toContain("docs/quality/screenshots/x.png");
      const findings = checkImagePolicy({ repoRoot: dir });
      expect(findings.some(f => f.path === "docs/quality/screenshots/x.png")).toBe(true);
      expect(findings.some(f => f.path?.includes("dist/"))).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
