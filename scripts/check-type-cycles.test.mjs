/**
 * Wave H (STR-617 بند 1): اختبارات حارس الدورات النوعية — حتمية بلا شبكة.
 * تغطي: حساب SCC النوعي على رسم مصطنع (نجاح + اصطياد دورة جديدة فوق الأساس
 * + الحواف القيمية لا تُحتسب)، وفحص دخاني على المستودع الحي.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TYPE_SCC_BASELINE, checkTypeCycles, computeTypeSccs } from "./check-type-cycles.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url).replace(/check-type-cycles\.test\.mjs$/, "check-type-cycles.mjs");
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const imp = (file, resolved, kind) => ({ file, layer: "application", specifier: "x", resolved, kind, dynamic: false });

describe("check-type-cycles (Wave H — STR-617 item 1)", () => {
  it("detects a mutual type-only cycle and ignores value-only edges", () => {
    const imports = [
      imp("a.ts", "b.ts", "type"),
      imp("b.ts", "a.ts", "type"),
      imp("c.ts", "d.ts", "value"),
      imp("d.ts", "c.ts", "value"),
    ];
    const sccs = computeTypeSccs(imports);
    expect(sccs).toEqual(["a.ts <-> b.ts"]);
  });

  it("a NEW type cycle above the baseline is a violation; the registered one passes", () => {
    const registered = TYPE_SCC_BASELINE[0].split(" <-> ");
    const okResult = checkTypeCycles(REPO_ROOT, [
      imp(registered[0], registered[1], "type"),
      imp(registered[1], registered[0], "type"),
    ]);
    expect(okResult.ok).toBe(true);
    const badResult = checkTypeCycles(REPO_ROOT, [
      imp("x/one.ts", "x/two.ts", "type"),
      imp("x/two.ts", "x/one.ts", "type"),
    ]);
    expect(badResult.ok).toBe(false);
    expect(badResult.violations[0]?.rule).toBe("type-scc");
    expect(badResult.violations[0]?.key).toBe("x/one.ts <-> x/two.ts");
  });

  it("a longer type cycle (3 files) is enumerated as one SCC", () => {
    const imports = [
      imp("p.ts", "q.ts", "type"),
      imp("q.ts", "r.ts", "type"),
      imp("r.ts", "p.ts", "type"),
    ];
    const result = checkTypeCycles(REPO_ROOT, imports);
    expect(result.ok).toBe(false);
    expect(result.live).toEqual(["p.ts <-> q.ts <-> r.ts"]);
  });

  it("live repo smoke: exits 0 with the baseline SCC only", () => {
    const run = spawnSync(process.execPath, [SCRIPT_PATH, REPO_ROOT], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("type-cycles: PASS");
  });
});
