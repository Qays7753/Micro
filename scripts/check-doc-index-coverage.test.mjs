import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkCoverage, listMarkdownFiles, ROOT } from "./check-doc-index-coverage.mjs";

describe("check-doc-index-coverage", () => {
  it("lists markdown files recursively", () => {
    const files = listMarkdownFiles(ROOT, "docs/architecture");
    expect(files).toContain("docs/architecture/SOURCE_OF_TRUTH.md");
    expect(files).toContain("docs/architecture/ADRs/ADR-001-fixed-strategy.md");
  });

  it("flags an authority file missing from the catalog", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "doc-idx-cov-"));
    try {
      fs.mkdirSync(path.join(dir, "docs/contracts"), { recursive: true });
      fs.writeFileSync(path.join(dir, "docs/contracts/99-test-contract.md"), "# test");
      fs.writeFileSync(path.join(dir, "docs/00-document-index.md"), "# catalog\n");
      const findings = checkCoverage({ repoRoot: dir });
      expect(findings.some((f) => f.kind === "unindexed" && f.path === "docs/contracts/99-test-contract.md")).toBe(true);
      expect(findings.some((f) => f.kind === "pin")).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("live repo: catalog coverage is complete (WS-204 regression pin)", () => {
    const findings = checkCoverage({ repoRoot: ROOT });
    expect(findings).toEqual([]);
  });
});
