import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkImagePolicy, listImages, ROOT } from "./check-image-policy.mjs";

function makeRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "img-policy-"));
  for (const rel of files) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, "x");
  }
  return dir;
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
      expect(findings.some((f) => f.path === "reports/agent-report/2026-99-99_run/screen.png")).toBe(true);
      expect(findings.some((f) => f.path === "docs/quality/screenshots/x.png")).toBe(true);
      expect(findings.some((f) => f.path?.startsWith("apps/"))).toBe(false);
      expect(findings.some((f) => f.path?.startsWith("planning/ux-001"))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails when the frozen operational-image count drifts", () => {
    const dir = makeRepo(["apps/prototype-web/client/public/brand/mark.svg"]);
    try {
      const findings = checkImagePolicy({ repoRoot: dir });
      expect(findings.some((f) => f.kind === "image-count-drift")).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("live repo: all images within the approved baseline (WS-204 regression pin)", () => {
    const imgs = listImages(ROOT);
    expect(imgs.length).toBe(36);
    expect(checkImagePolicy({ repoRoot: ROOT })).toEqual([]);
  });
});
