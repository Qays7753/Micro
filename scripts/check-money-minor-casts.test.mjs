/**
 * R11 W1A-2 / D-02: اختبارات مراقب casts عائلة Minor — حتمية بلا شبكة.
 *
 * تغطي: الأساس الحي (0 داخل / 0 غير مصرح / 13 تضييق هوية)، وكل فشل مقصود
 * (دخول as MoneyMinor بكل صوره، وخروج غير مصرح، ونمو التضييق، وغياب موقع
 * مسجل)، ومناطق الإعفاء، ودقة طبقة الاسم (قيم كائن حرفي تنتهي بكلمة Minor
 * ليست قيمة مسماة — انحدار guidedOpeningImportService المكتشف والذي
 * حُصر بالأشكال النوعية للمعرّفات)، وسلوك CLI.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  EXIT_NARROWING_BASELINE,
  MINOR_TYPE_PATTERN,
  checkMoneyMinorCasts,
  isMinorNamedValueExpression,
} from "./check-money-minor-casts.mjs";
import ts from "typescript";

const SCRIPT_PATH = fileURLToPath(import.meta.url).replace(
  /check-money-minor-casts\.test\.mjs$/,
  "check-money-minor-casts.mjs",
);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const tempDirs = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "micro-minor-casts-"));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});
function write(root, rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}

/** شجرة تحقق الأساس كاملًا: المواقع الـ13 بتعدادها المسجل حرفيًا. */
function baselineTree() {
  const root = makeTempDir();
  const q = "x";
  write(
    root,
    "apps/prototype-web/client/src/application/inventory/inventoryMaterialLifecycle.ts",
    `export const a = [${q},${q},${q}];\n` +
      `export const opening = (input: any) => [input.opening.valueMinor as number, input.opening.valueMinor as number, input.opening.valueMinor as number];\n` +
      `export const value = (input: any) => [input.valueMinor as number, input.valueMinor as number, input.valueMinor as number];\n`,
  );
  write(
    root,
    "apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts",
    `export const r = (value: any) => [value.residualValueMinor as number, value.residualValueMinor as number];\n` +
      `export const c = (value: any) => value.cashDeltaMinor as number;\n` +
      `export const v = (value: any) => value.valueDeltaMinor as number;\n`,
  );
  write(
    root,
    "apps/prototype-web/client/src/application/transfers/transferSnapshotValidation.ts",
    `export const s = (entry: any) => [entry.cashDeltaMinor as number, entry.cashDeltaMinor as number, entry.cashDeltaMinor as number];\n`,
  );
  return root;
}

describe("money Minor cast monitor (R11 W1A-2 / D-02 — OD-MONEY Option A)", () => {
  it("the baseline totals 13 identity-narrowing sites across 6 content-stable keys", () => {
    const total = Object.values(EXIT_NARROWING_BASELINE).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(13);
    expect(Object.keys(EXIT_NARROWING_BASELINE)).toHaveLength(6);
    expect(MINOR_TYPE_PATTERN.test("MoneyMinor")).toBe(true);
    expect(MINOR_TYPE_PATTERN.test("MoneyMinor[]")).toBe(true);
    expect(MINOR_TYPE_PATTERN.test("MinorSemantics")).toBe(false);
  });

  it("the live repository passes: 0 entering, 0 unauthorized, 13/13 narrowing", () => {
    const result = checkMoneyMinorCasts(REPO_ROOT);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.stats.entering).toBe(0);
    expect(result.stats.exitingUnauthorized).toBe(0);
    expect(result.stats.exitingNarrowing).toBe(13);
    expect(result.stats.baselineNarrowing).toBe(13);
  });

  it("a tree matching the baseline passes (synthetic reproduction)", () => {
    const result = checkMoneyMinorCasts(baselineTree());
    expect(result.violations).toEqual([]);
    expect(result.stats.exitingNarrowing).toBe(13);
  });

  it("mutation: an unauthorized as MoneyMinor outside zones fails (ENTERING_CAST)", () => {
    const root = baselineTree();
    write(root, "apps/prototype-web/client/src/pages/Checkout.tsx", "export const total = (raw: number) => raw as MoneyMinor;\n");
    const result = checkMoneyMinorCasts(root);
    expect(result.violations.some(v => v.rule === "ENTERING_CAST" && v.key.includes("Checkout.tsx"))).toBe(true);
  });

  it("mutation: angle-bracket and unknown-bridge entering forms fail too", () => {
    const root = baselineTree();
    write(root, "apps/prototype-web/client/src/pages/Angle.ts", "export const t = <MoneyMinor>(41 as unknown);\n");
    write(root, "apps/prototype-web/client/src/pages/Bridge.ts", "export const b = (raw: unknown) => raw as unknown as MoneyMinor;\n");
    const result = checkMoneyMinorCasts(root);
    expect(result.violations.some(v => v.rule === "ENTERING_CAST" && v.key.includes("Angle.ts"))).toBe(true);
    expect(result.violations.some(v => v.rule === "ENTERING_CAST" && v.key.includes("Bridge.ts"))).toBe(true);
  });

  it("mutation: a cross-unit exit cast fails (as string / as QuantityMilli)", () => {
    const root = baselineTree();
    write(root, "apps/prototype-web/client/src/pages/Mix.ts", "export const m = (price: { priceMinor: number }) => price.priceMinor as string;\n");
    write(root, "apps/prototype-web/client/src/pages/Mix2.ts", "export const m2 = (price: { priceMinor: number }) => price.priceMinor as QuantityMilli;\n");
    const result = checkMoneyMinorCasts(root);
    expect(result.violations.filter(v => v.rule === "EXIT_CAST_UNAUTHORIZED").length).toBeGreaterThanOrEqual(2);
  });

  it("mutation: the laundering bridge as unknown fails on the exit layer", () => {
    const root = baselineTree();
    write(root, "apps/prototype-web/client/src/pages/Launder.ts", "export const l = (price: { priceMinor: number }) => price.priceMinor as unknown;\n");
    const result = checkMoneyMinorCasts(root);
    expect(result.violations.some(v => v.rule === "EXIT_CAST_UNAUTHORIZED" && v.key.includes("Launder.ts"))).toBe(true);
  });

  it("mutation: growth of identity narrowing fails (a 14th as-number site)", () => {
    const root = baselineTree();
    write(root, "apps/prototype-web/client/src/application/inventory/newReads.ts", "export const n = (row: any) => row.deltaMinor as number;\n");
    const result = checkMoneyMinorCasts(root);
    expect(result.violations.some(v => v.rule === "EXIT_NARROWING_GROWTH" && v.key.includes("newReads.ts"))).toBe(true);
  });

  it("mutation: a departed/changed baseline site fails (EXIT_NARROWING_STALE)", () => {
    const root = baselineTree();
    /* حذف ملف كامل يسقط مواقع snapshot الثلاثة. */
    fs.rmSync(path.join(root, "apps/prototype-web/client/src/application/transfers/transferSnapshotValidation.ts"));
    const result = checkMoneyMinorCasts(root);
    expect(result.violations.some(v => v.rule === "EXIT_NARROWING_STALE" && v.key.includes("transferSnapshotValidation.ts"))).toBe(true);
  });

  it("approved zones are excluded: kernel and formatter casts are not counted", () => {
    const root = baselineTree();
    write(root, "src/domain/shared/currency.ts", "export type MoneyMinor = number;\nexport const k = (raw: number) => raw as MoneyMinor;\n");
    write(root, "apps/prototype-web/client/src/application/formatting/formatters.ts", "export const f = (m: { priceMinor: number }) => m.priceMinor as number;\nexport const g = (raw: number) => raw as MoneyMinor;\n");
    const result = checkMoneyMinorCasts(root);
    expect(result.violations.filter(v => v.rule.startsWith("ENTERING") || v.rule.startsWith("EXIT"))).toEqual([]);
  });

  it("name-layer precision: arbitrary text ending in a Minor word is NOT a Minor-named value (guidedOpeningImportService regression)", () => {
    const sf = ts.createSourceFile(
      "t.ts",
      "const x = { openingMinor: item.openingMinor } as FileRow;\n",
      ts.ScriptTarget.Latest,
      true,
    );
    const nodes = [];
    const visit = node => {
      if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) nodes.push(node);
      ts.forEachChild(node, visit);
    };
    visit(sf);
    /* القوس الأول: كائن حرفي — ليس معرّفًا/وصول خاصية Minor. */
    expect(nodes).toHaveLength(1);
    expect(isMinorNamedValueExpression(nodes[0].expression)).toBe(false);
    /* أما وصول الخاصية فمعرّف Minor حقيقي. */
    const prop = nodes[0].expression.properties[0].initializer;
    expect(isMinorNamedValueExpression(prop)).toBe(true);
  });

  it("MoneyMinor stays = number and W5 stays closed (policy invariants)", () => {
    const currency = fs.readFileSync(path.join(REPO_ROOT, "src/domain/shared/currency.ts"), "utf8");
    expect(currency).toContain("export type MoneyMinor = number;");
    expect(currency).not.toContain("declare const __minorBrand");
    expect(currency).not.toContain("& { __minor");
  });

  it("CLI usage error exits 2 on a non-repo path", () => {
    const run = spawnSync("node", [SCRIPT_PATH, "/definitely-not-a-repo"], { encoding: "utf8" });
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("USAGE");
  });
});
