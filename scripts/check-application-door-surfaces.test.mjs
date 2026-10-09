/**
 * R5/S2: اختبارات حارس أسطح أبواب التطبيق — حتمية بلا شبكة ولا نوم؛
 * العينات تُبنى في مجلدات مؤقتة وتُمسح بعدها (نمط اختبارات حارس الحدود).
 *
 * تغطي: الأساس الحي يمر (دخاني)، وكل قاعدة رفض على حدة (توسيع قيمة/نوع،
 * انكماش، باب متداخل جديد غير مسجل، برميل جذر، ملف جذر جديد، `export *`،
 * `export * as ns`، صف أساس متقادم، غياب الأساس = إغلاق فاشل)، وسلوك CLI
 * على المستودع الحي.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { checkApplicationDoorSurfaces } from "./check-application-door-surfaces.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url).replace(
  /check-application-door-surfaces\.test\.mjs$/,
  "check-application-door-surfaces.mjs",
);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const tempDirs = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "micro-door-surfaces-"));
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

function app(rel) {
  return path.join("apps", "prototype-web", "client", "src", "application", rel);
}

const DOOR_OK = 'export { a } from "./a.js";\nexport type { T } from "./a.js";\n';
const DOOR_A = 'export const a = 1;\nexport type T = { x: number };\n';

function baselineWith(doors, rootFiles = []) {
  return JSON.stringify({ version: 1, doors, rootFiles }, null, 1);
}

function fixtureRoot(doorContent = DOOR_OK) {
  const root = makeTempDir();
  write(root, app("house/a.ts"), DOOR_A);
  write(root, app("house/index.ts"), doorContent);
  write(root, app("resultCodes.ts"), 'export const X = 1;\n');
  write(
    root,
    "scripts/application-door-surfaces-baseline.json",
    baselineWith({ house: { value: ["a"], type: ["T"] } }, ["resultCodes.ts"]),
  );
  return root;
}

describe("application door surfaces (R5/S2 — PC-3 exact value+type pin)", () => {
  it("live repo: all 29 doors + the root file match the registered baseline", () => {
    const result = checkApplicationDoorSurfaces(REPO_ROOT);
    expect(result.ok).toBe(true);
    expect(result.stats.doors).toBe(29);
    expect(result.stats.rootFiles).toBe(1);
    expect(result.violations).toEqual([]);
  });

  it("a registered fixture tree passes", () => {
    expect(checkApplicationDoorSurfaces(fixtureRoot()).ok).toBe(true);
  });

  it("adding a value symbol is a widening failure", () => {
    const root = fixtureRoot('export { a, b } from "./a.js";\nexport type { T } from "./a.js";\n');
    write(root, app("house/a.ts"), DOOR_A + "export const b = 2;\n");
    const result = checkApplicationDoorSurfaces(root);
    expect(result.ok).toBe(false);
    expect(result.violations).toContainEqual({ rule: "surface-widened", key: "house [value] +b" });
  });

  it("adding a type symbol is a widening failure", () => {
    const root = fixtureRoot('export { a } from "./a.js";\nexport type { T, U } from "./a.js";\n');
    write(root, app("house/a.ts"), DOOR_A + "export type U = { y: number };\n");
    const result = checkApplicationDoorSurfaces(root);
    expect(result.ok).toBe(false);
    expect(result.violations).toContainEqual({ rule: "surface-widened", key: "house [type] +U" });
  });

  it("removing a symbol is a shrinkage failure (stale row)", () => {
    const root = fixtureRoot('export type { T } from "./a.js";\n');
    const result = checkApplicationDoorSurfaces(root);
    expect(result.ok).toBe(false);
    expect(result.violations).toContainEqual({ rule: "surface-shrunk", key: "house [value] -a" });
  });

  it("a new nested barrel (any depth) is an unregistered door failure", () => {
    const root = fixtureRoot();
    write(root, app("house/helpers/index.ts"), 'export { a } from "../a.js";\n');
    const result = checkApplicationDoorSurfaces(root);
    expect(result.ok).toBe(false);
    expect(result.violations).toContainEqual({ rule: "door-unregistered", key: "house/helpers" });
  });

  it("a root application barrel is an unregistered door failure", () => {
    const root = fixtureRoot();
    write(root, app("index.ts"), 'export { a } from "./house/a.js";\n');
    const result = checkApplicationDoorSurfaces(root);
    expect(result.ok).toBe(false);
    expect(result.violations).toContainEqual({ rule: "door-unregistered", key: "" });
  });

  it("a new production root file is an unregistered failure (tests excluded)", () => {
    const root = fixtureRoot();
    write(root, app("quickAccess.ts"), 'export const q = 1;\n');
    write(root, app("scratch.test.ts"), 'export const t = 1;\n');
    const result = checkApplicationDoorSurfaces(root);
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([{ rule: "root-file-unregistered", key: "quickAccess.ts" }]);
  });

  it("a stale root-file row fails", () => {
    const root = fixtureRoot();
    fs.rmSync(path.join(root, app("resultCodes.ts")));
    const result = checkApplicationDoorSurfaces(root);
    expect(result.violations).toContainEqual({ rule: "root-file-stale", key: "resultCodes.ts" });
  });

  it("export * in a door is an invisible-widening failure", () => {
    const root = fixtureRoot('export * from "./a.js";\n');
    const result = checkApplicationDoorSurfaces(root);
    expect(result.ok).toBe(false);
    expect(result.violations).toContainEqual({ rule: "wildcard-export-in-door", key: "house: export *" });
  });

  it("export * as ns in a door is an invisible-widening failure", () => {
    const root = fixtureRoot('export * as ns from "./a.js";\n');
    const result = checkApplicationDoorSurfaces(root);
    expect(result.ok).toBe(false);
    expect(result.violations).toContainEqual({ rule: "wildcard-export-in-door", key: "house: export * as ns" });
  });

  it("a baseline row whose door left the tree fails (same-PR hygiene)", () => {
    const root = fixtureRoot();
    write(root, app("gone/index.ts"), 'export { a } from "../house/a.js";\n');
    write(
      root,
      "scripts/application-door-surfaces-baseline.json",
      baselineWith({ house: { value: ["a"], type: ["T"] }, gone: { value: ["a"], type: [] } }),
    );
    fs.rmSync(path.join(root, app("gone")), { recursive: true, force: true });
    const result = checkApplicationDoorSurfaces(root);
    expect(result.violations).toContainEqual({ rule: "door-stale", key: "gone" });
  });

  it("a missing baseline file fails closed (every live door unregistered)", () => {
    const root = makeTempDir();
    write(root, app("house/a.ts"), DOOR_A);
    write(root, app("house/index.ts"), DOOR_OK);
    const result = checkApplicationDoorSurfaces(root);
    expect(result.ok).toBe(false);
    expect(result.violations).toContainEqual({ rule: "door-unregistered", key: "house" });
  });

  it("CLI exits 0 on the live repo and 2 on a non-repo path", () => {
    const okRun = spawnSync("node", [SCRIPT_PATH, REPO_ROOT], { encoding: "utf8" });
    expect(okRun.status).toBe(0);
    expect(okRun.stdout).toContain("application-door-surfaces: PASS");
    const badRun = spawnSync("node", [SCRIPT_PATH, os.tmpdir()], { encoding: "utf8" });
    expect(badRun.status).toBe(2);
  });
});
