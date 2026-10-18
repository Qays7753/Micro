import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  EXEMPTIONS,
  ROOT,
  STORAGE_BOUNDARY_FILES,
  findOnsuccessAssignments,
  isGuarded,
  scanStorageFile,
} from "./check-storage-listener-guards.mjs";

/* R9-GA-F7.1 (استمرار R9 الجذري): اختبار الحارس الاستاتيكي نفسه — يثبت
 * أنه يمر على الشجرة الحية، ويفشل على مستمع كتابة غير محروس، ويفشل على
 * مستمع رد نداء غير محروس، ويحترم الاستثناءات الموثقة فقط. */

function writeTempFixture(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "listener-guard-"));
  const relDir = path.join("apps/prototype-web/client/src/storage/local");
  fs.mkdirSync(path.join(dir, relDir), { recursive: true });
  for (const rel of STORAGE_BOUNDARY_FILES) {
    const target = path.join(dir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "", "utf8");
  }
  fs.writeFileSync(path.join(dir, relDir, "indexedDbPrimitives.ts"), content, "utf8");
  return dir;
}

function runCli(repoRoot) {
  const stdout = execFileSync(
    process.execPath,
    [path.join(ROOT, "scripts", "check-storage-listener-guards.mjs"), repoRoot],
    { encoding: "utf8" },
  );
  return stdout;
}

describe("check-storage-listener-guards (R9-GA-F7.1 static guard)", () => {
  it("passes on the live repository tree — every storage onsuccess listener guarded or exempted", () => {
    const stdout = runCli(ROOT);
    expect(stdout).toContain("PASS");
    /* U001-IR-002 (2026-10-18): 77 -> 78 — مستمع onsuccess جديد واحد في
     * commitProfileCreate (IndexedDbLocalStore) مغلّف بguardedSuccessListener
     * نفسه؛ إعادة إرساء العدّ موثقة نفس-الـPR لا تعديلًا صامتًا. */
    expect(stdout).toMatch(/78 onsuccess listeners/);
  });

  it("fails on an unguarded write-queueing onsuccess listener (the F7 family recurrence)", () => {
    const dir = writeTempFixture(
      [
        "export async function bad(storeName: string, value: unknown) {",
        "  const database = await connection();",
        "  return await new Promise(resolve => {",
        '    const transaction = database.transaction(storeName, "readwrite");',
        "    const scan = transaction.objectStore(storeName).getAll();",
        "    scan.onsuccess = () => {",
        "      transaction.objectStore(storeName).put(value);",
        "    };",
        "    transaction.oncomplete = () => resolve({ ok: true });",
        "  });",
        "}",
        "",
      ].join("\n"),
    );
    const findings = scanStorageFile(dir, STORAGE_BOUNDARY_FILES[1]);
    expect(findings).toHaveLength(1);
    expect(findings[0].function).toBe("bad");
    expect(findings[0].reason).toContain("queues a write");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("fails on an unguarded caller-callback onsuccess listener (the F7.1 read family)", () => {
    const dir = writeTempFixture(
      [
        "export async function listBad<T>(storeName: string, sort: (a: T, b: T) => number) {",
        "  const database = await connection();",
        "  return await new Promise(resolve => {",
        "    const request = database.transaction(storeName).objectStore(storeName).getAll();",
        "    request.onsuccess = () => {",
        "      resolve({ ok: true, value: (request.result as T[]).sort(sort) });",
        "    };",
        "  });",
        "}",
        "",
      ].join("\n"),
    );
    const findings = scanStorageFile(dir, STORAGE_BOUNDARY_FILES[1]);
    expect(findings).toHaveLength(1);
    expect(findings[0].function).toBe("listBad");
    expect(findings[0].reason).toContain("unguarded onsuccess listener body");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("accepts the equivalent local guard (in-body try/catch) and the guardedSuccessListener wrapper", () => {
    const dir = writeTempFixture(
      [
        "export async function locallyGuarded<T>(storeName: string, sort: (a: T, b: T) => number) {",
        "  const database = await connection();",
        "  return await new Promise(resolve => {",
        "    const request = database.transaction(storeName).objectStore(storeName).getAll();",
        "    request.onsuccess = () => {",
        "      try {",
        "        resolve({ ok: true, value: (request.result as T[]).sort(sort) });",
        "      } catch (error) {",
        "        resolve(failure(error, database));",
        "      }",
        "    };",
        "  });",
        "}",
        "export async function wrappedListener(storeName: string) {",
        "  const database = await connection();",
        "  return await new Promise(resolve => {",
        "    const scan = database.transaction(storeName).objectStore(storeName).getAll();",
        "    scan.onsuccess = guardedSuccessListener(failFromListener, () => {",
        "      resolve({ ok: true });",
        "    });",
        "  });",
        "}",
        "",
      ].join("\n"),
    );
    const findings = scanStorageFile(dir, STORAGE_BOUNDARY_FILES[1]);
    expect(findings).toHaveLength(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("honors only the documented exemptions — each carries a non-empty reason", () => {
    expect(EXEMPTIONS.size).toBe(2);
    for (const reason of EXEMPTIONS.values()) {
      expect(reason.trim().length).toBeGreaterThan(20);
    }
    /* الاستثناءات نفسها تشير إلى أجسام موجودة فعلًا في الشجرة الحية. */
    for (const key of EXEMPTIONS.keys()) {
      const [rel, fn] = key.split(":");
      const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
      expect(source).toContain(`function ${fn}`);
    }
  });

  it("the body-window finder stops at the next listener assignment (bounded, deterministic)", () => {
    const source = [
      "async function two() {",
      "  const a = store.getAll();",
      "  a.onsuccess = () => {",
      "    resolve({ ok: true });",
      "  };",
      "  const b = store.getAll();",
      "  b.onerror = () => resolve({});",
      "}",
    ].join("\n");
    const assignments = findOnsuccessAssignments(source);
    expect(assignments).toHaveLength(1);
    expect(isGuarded(assignments[0].body)).toBe(false);
    expect(assignments[0].body).not.toContain("onerror");
  });
});
