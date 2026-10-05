/**
 * Wave H (STR-617 بند 5): اختبارات مراقب تغطية سجل الملكية — حتمية بلا شبكة.
 * تغطي: اشتقاق الوحدات من الشجرة، الاصطياد عند بيت تطبيق/منطقة مجال بلا ذكر،
 * والنجاح عند الذكر — وفحص دخاني على المستودع الحي.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { checkRegistryCoverage, listOwnershipUnits } from "./check-registry-coverage.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url).replace(
  /check-registry-coverage\.test\.mjs$/,
  "check-registry-coverage.mjs",
);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const tempDirs = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "micro-regcov-"));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe("check-registry-coverage (Wave H — STR-617 item 5)", () => {
  it("derives application homes and domain areas from the tree", () => {
    const root = makeTempDir();
    fs.mkdirSync(path.join(root, "apps/prototype-web/client/src/application/one/two"), { recursive: true });
    fs.mkdirSync(path.join(root, "src/domain/alpha"), { recursive: true });
    const units = listOwnershipUnits(root);
    expect(units.applicationHomes).toEqual(["one/"]);
    expect(units.domainAreas).toEqual(["alpha/"]);
  });

  it("an unregistered application home is caught; a registered one passes", () => {
    const root = makeTempDir();
    fs.mkdirSync(path.join(root, "apps/prototype-web/client/src/application/known"), { recursive: true });
    fs.mkdirSync(path.join(root, "apps/prototype-web/client/src/application/orphan"), { recursive: true });
    const result = checkRegistryCoverage(root, "سجل يذكر بيت known/ فقط");
    expect(result.ok).toBe(false);
    const appViolations = result.violations.filter(v => v.kind === "application-home");
    expect(appViolations.length).toBe(1);
    expect(appViolations[0]?.unit).toBe("orphan/");
  });

  it("an unregistered domain area is caught", () => {
    const root = makeTempDir();
    fs.mkdirSync(path.join(root, "src/domain/registered-area"), { recursive: true });
    fs.mkdirSync(path.join(root, "src/domain/ghost-area"), { recursive: true });
    const result = checkRegistryCoverage(root, "السجل يذكر registered-area/ في §1");
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.kind).toBe("domain-area");
    expect(result.violations[0]?.unit).toBe("ghost-area/");
  });

  it("live repo smoke: every live home and area is mentioned (exit 0)", () => {
    const run = spawnSync(process.execPath, [SCRIPT_PATH, REPO_ROOT], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("registry-coverage: PASS");
  });
});
