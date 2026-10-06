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

const registered = {
  "ai-skills/README.ar.md": "| demo | x | y | z | o | d | CURRENT |\n",
  "docs/00-document-index.md": "| 24 | `ai-skills/demo/` | CURRENT | demo |\n",
};

describe("check-skill-references", () => {
  it("extracts markdown/backticked paths, skipping urls", () => {
    const paths = extractPaths("اقرأ `../../docs/a.md` و[الرابط](b/c.md) و`https://x.io/d.md` ونص عادي");
    expect(paths).toContain("../../docs/a.md");
    expect(paths).toContain("b/c.md");
    expect(paths.some(p => p.startsWith("https://"))).toBe(false);
  });

  it("flags missing paths and unregistered skills", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-refs-"));
    try {
      seed(dir, {
        "ai-skills/demo/SKILL.md": "# Demo\nاقرأ `../../docs/missing.md`\n",
        "ai-skills/README.ar.md": "# README\n(لا صف)\n",
        "docs/00-document-index.md": "# index\n(لا صف)\n",
      });
      const { findings } = checkSkills({ repoRoot: dir });
      expect(findings.some(f => f.kind === "C1-missing-path")).toBe(true);
      expect(findings.some(f => f.kind === "C3-unregistered")).toBe(true);
      expect(findings.some(f => f.kind === "C3-unindexed")).toBe(true);
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
        "ai-skills/demo/SKILL.md":
          "# Demo\nاقرأ `../../docs/product/problem-statement-v4.md` و`../../docs/guide-v1.md`\n",
        ...registered,
      });
      const { findings } = checkSkills({ repoRoot: dir });
      expect(findings.some(f => f.kind === "C2-version-drift" && f.message.includes("guide-v1.md"))).toBe(
        true,
      );
      expect(
        findings.some(f => f.kind === "C2-version-drift" && f.message.includes("problem-statement-v4")),
      ).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("live repo: 8 skills registered, all references resolve (WS-204 regression pin)", () => {
    expect(listSkills(ROOT).length).toBe(8);
    expect(checkSkills({ repoRoot: ROOT })).toEqual({ findings: [], warnings: [] });
  });

  it("F-05a C4: warns on a parallel reading list in an active skill (warning only, no failure)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-refs-"));
    try {
      seed(dir, {
        "AGENTS.md": "# AGENTS\n",
        "docs/a.md": "# a",
        "docs/b.md": "# b",
        "docs/c.md": "# c",
        "ai-skills/demo/SKILL.md": [
          "# Demo",
          "حمّل حزمة `CORE+FIN` وفق `AGENTS.md` §2 — لا قوائم قراءة مكررة هنا.",
          "اقرأ `../../docs/a.md` قبل كل قرار.",
          "اقرأ `../../docs/b.md` و`../../docs/c.md` عند التصميم.",
          "اقرأ `../../docs/a.md` مرة أخرى قبل الاختبار.",
          "",
        ].join("\n"),
        ...registered,
      });
      const { findings, warnings } = checkSkills({ repoRoot: dir });
      expect(findings).toEqual([]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].kind).toBe("C4-parallel-reading-list");
      expect(warnings[0].file).toBe("ai-skills/demo/SKILL.md");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("F-05a C4: no warning for a retired skill (preserved historical content) or few citations", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-refs-"));
    try {
      seed(dir, {
        "docs/a.md": "# a",
        "docs/b.md": "# b",
        "ai-skills/retired/SKILL.md": [
          "> **الحالة:** متقاعدة (RETIRED) — محفوظة لمهام MVP اللاحق.",
          "اقرأ `../../docs/a.md` أولًا.",
          "اقرأ `../../docs/b.md` ثانيًا.",
          "اقرأ `../../docs/a.md` ثالثًا.",
          "",
        ].join("\n"),
        "ai-skills/sparse/SKILL.md": [
          "# Sparse",
          "اقرأ `../../docs/a.md` عند الحاجة.",
          "اقرأ `../../docs/b.md` عند القرار.",
          "",
        ].join("\n"),
        "ai-skills/README.ar.md":
          "| retired | x | y | z | o | d | RETIRED |\n| sparse | x | y | z | o | d | CURRENT |\n",
        "docs/00-document-index.md":
          "| 24 | `ai-skills/retired/` | RETIRED | r |\n| 25 | `ai-skills/sparse/` | CURRENT | s |\n",
      });
      const { warnings } = checkSkills({ repoRoot: dir });
      expect(warnings).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
