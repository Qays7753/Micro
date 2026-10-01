import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkSkills, extractPaths, listSkills, ROOT } from "./check-skill-references.mjs";

function seed(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
}

describe("check-skill-references", () => {
  it("extracts markdown/backticked paths, skipping urls", () => {
    const paths = extractPaths("اقرأ `../../docs/a.md` و[الرابط](b/c.md) و`https://x.io/d.md` ونص عادي");
    expect(paths).toContain("../../docs/a.md");
    expect(paths).toContain("b/c.md");
    expect(paths.some((p) => p.startsWith("https://"))).toBe(false);
  });

  it("flags missing paths and unregistered skills", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-refs-"));
    try {
      seed(dir, {
        "ai-skills/demo/SKILL.md": "# Demo\nاقرأ `../../docs/missing.md`\n",
        "ai-skills/README.ar.md": "# README\n(لا صف)\n",
        "docs/00-document-index.md": "# index\n(لا صف)\n",
      });
      const findings = checkSkills({ repoRoot: dir });
      expect(findings.some((f) => f.kind === "C1-missing-path")).toBe(true);
      expect(findings.some((f) => f.kind === "C3-unregistered")).toBe(true);
      expect(findings.some((f) => f.kind === "C3-unindexed")).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("flags version-pin drift but honors the scoped-sibling allowlist", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-refs-"));
    try {
      seed(dir, {
        "docs/product/problem-statement-v4.md": "# v4",
        "docs/product/problem-statement-v5.md": "# v5",
        "docs/guide-v1.md": "# g1",
        "docs/guide-v2.md": "# g2",
        "ai-skills/demo/SKILL.md": "# Demo\nاقرأ `../../docs/product/problem-statement-v4.md` و`../../docs/guide-v1.md`\n",
        "ai-skills/README.ar.md": "| demo | x | y | z | o | d | CURRENT |\n",
        "docs/00-document-index.md": "| 24 | `ai-skills/demo/` | CURRENT | demo |\n",
      });
      const findings = checkSkills({ repoRoot: dir });
      expect(findings.some((f) => f.kind === "C2-version-drift" && f.message.includes("guide-v1.md"))).toBe(true);
      expect(findings.some((f) => f.kind === "C2-version-drift" && f.message.includes("problem-statement-v4"))).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("live repo: 8 skills registered, all references resolve (WS-204 regression pin)", () => {
    expect(listSkills(ROOT).length).toBe(8);
    expect(checkSkills({ repoRoot: ROOT })).toEqual([]);
  });
});
