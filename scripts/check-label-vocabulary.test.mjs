import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  PINNED_LABEL_LITERALS,
  checkLabelVocabulary,
  extractDomainLabels,
  labelLiteralsIn,
} from "./check-label-vocabulary.mjs";
import { ROOT } from "./check-runtime-cycles.mjs";

/* R11 W3 / OD-LABEL (موجة المتابعة 2026-10-15): اختبار حارس مفردة التسميات
 * نفسه — يثبت أنه يمر على الشجرة الحية بالمجموعة المثبتة المصنفة، ويرفض
 * أي تكرار جديد غير مصنف (نص محدد أو نص JSX)، ويرفض المدخل المتقادم،
 * ويشتق خريطة الدومين من مصدرها الكنوني لا من نسخة. */

const CLIENT_SRC = path.join("apps", "prototype-web", "client", "src");

function tempRepoWithLiveDomain() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "label-vocab-guard-"));
  fs.mkdirSync(path.join(dir, "src", "domain", "shared"), { recursive: true });
  fs.copyFileSync(
    path.join(ROOT, "src", "domain", "shared", "numeric.ts"),
    path.join(dir, "src", "domain", "shared", "numeric.ts"),
  );
  return dir;
}

function writeClientFile(dir, rel, content) {
  const target = path.join(dir, CLIENT_SRC, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
  return target;
}

function runCli(repoRoot) {
  return execFileSync(
    process.execPath,
    [path.join(ROOT, "scripts", "check-label-vocabulary.mjs"), repoRoot],
    { encoding: "utf8" },
  );
}

describe("check-label-vocabulary (R11 W3 OD-LABEL duplicate-literal ratchet)", () => {
  it("passes on the live repository tree with the classified pinned set", () => {
    const stdout = runCli(ROOT);
    expect(stdout).toContain("PASS");
    expect(stdout).toMatch(/45 تسمية دومين كنونية/);
    const { ok, stats } = checkLabelVocabulary(ROOT);
    expect(ok).toBe(true);
    expect(stats.domainLabels).toBe(45);
    expect(stats.pinnedEntries).toBe(Object.values(PINNED_LABEL_LITERALS).reduce((s, m) => s + Object.keys(m).length, 0));
    expect(stats.pinnedLive).toBeGreaterThanOrEqual(stats.pinnedEntries);
  });

  it("derives the domain label map from the canonical source (no parallel copy)", () => {
    const labels = extractDomainLabels(ROOT);
    expect(labels.agreedPriceMinor).toBe("السعر المتفق عليه");
    expect(labels.quantity).toBe("الكمية");
    expect(labels.occurredOn).toBe("تاريخ الحركة");
    expect(Object.keys(labels).length).toBe(45);
  });

  it("detects both quoted string literals and standalone JSX text matching a domain label", () => {
    const hits = labelLiteralsIn(
      "probe.tsx",
      [
        "export function P() {",
        "  const a = \"الكمية\";",
        "  return <span>السعر المتفق عليه</span>;",
        "}",
        "",
      ].join("\n"),
      new Map([["الكمية", ["quantity"]], ["السعر المتفق عليه", ["agreedPriceMinor"]]]),
    );
    expect(hits).toHaveLength(2);
    expect(hits.filter(h => h.kind === "string-literal")).toHaveLength(1);
    expect(hits.filter(h => h.kind === "jsx-text")).toHaveLength(1);
  });

  it("rejects a NEW unclassified domain-label literal in a page (ratchet)", () => {
    const dir = tempRepoWithLiveDomain();
    writeClientFile(
      dir,
      "pages/Probe.tsx",
      'export const label = "اسم العميل";\n',
    );
    const { ok, violations } = checkLabelVocabulary(dir);
    expect(ok).toBe(false);
    expect(violations.some(v => v.rule === "unclassified-domain-label-literal" && v.key.includes("pages/Probe.tsx") && v.key.includes("اسم العميل"))).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a NEW unclassified domain-label JSX text in a component (ratchet)", () => {
    const dir = tempRepoWithLiveDomain();
    writeClientFile(
      dir,
      "components/Probe.tsx",
      "export const P = () => <span>تاريخ الشراء</span>;\n",
    );
    const { ok, violations } = checkLabelVocabulary(dir);
    expect(ok).toBe(false);
    expect(violations.some(v => v.rule === "unclassified-domain-label-literal" && v.key.includes("components/Probe.tsx"))).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("does not count prose that merely contains a label inside a longer sentence (documented limit)", () => {
    const hits = labelLiteralsIn(
      "probe.tsx",
      [
        "export const note = \"أدخل الكمية بالأرقام قبل الحفظ — المبلغ إلزامي.\";",
        "",
      ].join("\n"),
      new Map([["الكمية", ["quantity"]]]),
    );
    expect(hits).toHaveLength(0);
  });

  it("fails on a pinned entry that left the live tree (baseline hygiene)", () => {
    const dir = tempRepoWithLiveDomain();
    /* لا ملفات عميل إطلاقًا — كل مداخل المجموعة المثبتة متقادمة */
    const { ok, violations } = checkLabelVocabulary(dir);
    expect(ok).toBe(false);
    expect(violations.some(v => v.rule === "pinned-file-stale")).toBe(true);
    expect(violations.some(v => v.rule === "pinned-literal-stale")).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("accepts a pinned literal that remains present (the frozen residual set is the contract)", () => {
    const dir = tempRepoWithLiveDomain();
    writeClientFile(
      dir,
      "pages/Collect.tsx",
      'export const walletFallback = "المحفظة";\n',
    );
    const { violations } = checkLabelVocabulary(dir);
    expect(violations.some(v => v.key.includes("pages/Collect.tsx"))).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("ROOT import sanity (single root source)", () => {
    expect(typeof ROOT).toBe("string");
  });
});
