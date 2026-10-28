import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  REGISTERED_DIAGNOSTICS_ADAPTER,
  REGISTERED_ENTRIES,
  checkDiagnosticsStorage,
  webStorageAccessSites,
} from "./check-diagnostics-storage.mjs";
import { ROOT } from "./check-runtime-cycles.mjs";

/* R11 ARCH-010 (موجة المتابعة 2026-10-15): اختبار الحارس المخصص نفسه —
 * يثبت أنه يمر على الشجرة الحية، ويرفض كل صنف وصول جديد غير مسجل
 * (مرجع مجرد، مستقبِل عام، وصول محسوب حرفي، تفكيك كائن، اسم مستعار)،
 * ولا يُخدع بالتعليقات، ويحترم المواضع المسجلة بالضبط، ويفشل على تسجيل
 * متقادم وعلى توجيه المهايئ عبر منفذ التخزين المالية/المحلية. */

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "diag-storage-guard-"));
  fs.mkdirSync(path.join(dir, "apps", "prototype-web", "client", "src", "application", "demo"), { recursive: true });
  fs.mkdirSync(path.dirname(path.join(dir, REGISTERED_DIAGNOSTICS_ADAPTER)), { recursive: true });
  return dir;
}

function withRegisteredTree(dir) {
  for (const entry of REGISTERED_ENTRIES) {
    const target = path.join(dir, entry.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "export const ok = 1;\n", "utf8");
  }
}

function writeClientFile(dir, rel, content) {
  const target = path.join(dir, "apps", "prototype-web", "client", "src", rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
  return target;
}

function runCli(repoRoot) {
  return execFileSync(
    process.execPath,
    [path.join(ROOT, "scripts", "check-diagnostics-storage.mjs"), repoRoot],
    { encoding: "utf8" },
  );
}

describe("check-diagnostics-storage (R11 ARCH-010 dedicated guard)", () => {
  it("passes on the live repository tree with exactly the one registered entry", () => {
    const stdout = runCli(ROOT);
    expect(stdout).toContain("PASS");
    /* 370 (كانت 369 بعد ARCH-012): R11 موجة المتابعة الموحدة (2026-10-16)
     * أضافت وحدة W2b application/transfers/transferTopLevelDataKeys.ts (اشتقاق
     * المفاتيح المسموحة وحمولة الرفض — لا وصول لتخزين المتصفح) فنما عدّ
     * الملفات المزروعة 369→370؛ والتسجيل يبقى موضعًا واحدًا بالضبط (مهايئ
     * التشخيص). تحديث العدّ المتوقع هنا هو بروتوكول الراتشة نفسه (تحديث
     * بنفس الـPR مع السبب الموثق).
     * S02 (2026-10-27): وحدات القفل السبع حُذفت مع تقاعد ٠٤٢ وأُضيفت وحدات
     * حماية الاستبدال الأربع (البروتوكول، التطبيع/البصمة المنفصلان، محرك
     * قاعدة الحماية، تقاعد السجل) — العدّ المزروع صار 368؛ والتسجيل يبقى
     * موضعًا واحدًا بالضبط (مهايئ التشخيص).
     * S03 (2026-10-28): قسما الإعدادات الجديدان (بيانات المشروع — دمج
     * 038/039، وما يقدّمه مشروعك — 038) أُضيفا كملفي إنتاج مزروعين فصار
     * العدّ 370؛ التسجيل يبقى موضعًا واحدًا بالضبط (مهايئ التشخيص). */
    expect(stdout).toMatch(/370 ملف إنتاج/);
    const { ok, stats } = checkDiagnosticsStorage(ROOT);
    expect(ok).toBe(true);
    expect(stats.registeredEntries).toBe(1);
    expect(stats.exemptedSites).toBeGreaterThanOrEqual(1);
  });

  it("ARCH-012: a reintroduced legacy drafts adapter is no longer registered and is rejected", () => {
    /* R11 ARCH-012 (2026-10-15): التقاعد أزال التسجيل التراثي — إعادة إدخال
     * مهايئ مسودات تراثي في طبقة التطبيق (المسار القديم نفسه أو أي جار)
     * خرق غير مسجل يُرفض فورًا؛ الاستثناء لا يعود إلا بقرار مالك جديد
     * يوسع التسجيل صراحةً. */
    const dir = tempRepo();
    withRegisteredTree(dir);
    writeClientFile(
      dir,
      "application/drafts/legacyFormDraftMigration.ts",
      [
        "export function browserLegacyFormDraftStorage() {",
        "  return globalThis.localStorage;",
        "}",
        "",
      ].join("\n"),
    );
    const { ok, violations } = checkDiagnosticsStorage(dir);
    expect(ok).toBe(false);
    expect(
      violations.some(v => v.rule === "unregistered-web-storage-access" && v.key.includes("legacyFormDraftMigration.ts:2")),
    ).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a new unregistered direct globalThis.localStorage access in an application service", () => {
    const dir = tempRepo();
    withRegisteredTree(dir);
    writeClientFile(
      dir,
      "application/demo/demoService.ts",
      [
        "export function bad() {",
        "  const storage = globalThis.localStorage;",
        "  return storage.getItem('x');",
        "}",
        "",
      ].join("\n"),
    );
    const { ok, violations } = checkDiagnosticsStorage(dir);
    expect(ok).toBe(false);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("unregistered-web-storage-access");
    expect(violations[0].key).toContain("application/demo/demoService.ts:2");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a bare sessionStorage reference (abstract identifier, no receiver)", () => {
    const dir = tempRepo();
    withRegisteredTree(dir);
    writeClientFile(
      dir,
      "application/demo/sessionLeak.ts",
      [
        "export function bad() {",
        "  return sessionStorage.getItem('x');",
        "}",
        "",
      ].join("\n"),
    );
    const { ok, violations } = checkDiagnosticsStorage(dir);
    expect(ok).toBe(false);
    expect(violations.some(v => v.key.includes("sessionLeak.ts:2"))).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a window.localStorage access (receiver variant)", () => {
    const dir = tempRepo();
    withRegisteredTree(dir);
    writeClientFile(
      dir,
      "components/Demo.tsx",
      [
        "export function Demo() {",
        "  return window.localStorage;",
        "}",
        "",
      ].join("\n"),
    );
    const { ok, violations } = checkDiagnosticsStorage(dir);
    expect(ok).toBe(false);
    expect(violations.some(v => v.key.includes("components/Demo.tsx:2"))).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rejects the computed literal access variant globalThis['localStorage']", () => {
    const dir = tempRepo();
    withRegisteredTree(dir);
    writeClientFile(
      dir,
      "lib/computed.ts",
      [
        "export function bad() {",
        "  return globalThis['localStorage'];",
        "}",
        "",
      ].join("\n"),
    );
    const { ok, violations } = checkDiagnosticsStorage(dir);
    expect(ok).toBe(false);
    expect(violations.some(v => v.key.includes("lib/computed.ts:2") && v.key.includes("computed literal access"))).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rejects the object destructuring alias variant", () => {
    const dir = tempRepo();
    withRegisteredTree(dir);
    writeClientFile(
      dir,
      "application/demo/destructure.ts",
      [
        "export function bad() {",
        "  const { localStorage: ls } = globalThis;",
        "  return ls;",
        "}",
        "",
      ].join("\n"),
    );
    const { ok, violations } = checkDiagnosticsStorage(dir);
    expect(ok).toBe(false);
    expect(violations.some(v => v.key.includes("destructure.ts:2") && v.key.includes("object binding pattern"))).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rejects the const-alias of the bare global (identifier aliasing)", () => {
    const dir = tempRepo();
    withRegisteredTree(dir);
    writeClientFile(
      dir,
      "application/demo/alias.ts",
      [
        "export function bad() {",
        "  const ls = localStorage;",
        "  return ls;",
        "}",
        "",
      ].join("\n"),
    );
    const { ok, violations } = checkDiagnosticsStorage(dir);
    expect(ok).toBe(false);
    expect(violations.some(v => v.key.includes("alias.ts:2"))).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rejects optional-chaining globalThis?.localStorage (formatting variant)", () => {
    const dir = tempRepo();
    withRegisteredTree(dir);
    writeClientFile(
      dir,
      "pwa/optional.ts",
      [
        "export function bad() {",
        "  return globalThis?.localStorage?.getItem?.('x') ?? null;",
        "}",
        "",
      ].join("\n"),
    );
    const { ok, violations } = checkDiagnosticsStorage(dir);
    expect(ok).toBe(false);
    expect(violations.some(v => v.key.includes("pwa/optional.ts:2"))).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("is not fooled by comments or unrelated property names, and allows the registered adapter's own access", () => {
    const sites = webStorageAccessSites(
      "x.ts",
      [
        "// globalThis.localStorage mentioned in a comment only",
        "/* const ls = localStorage; */",
        "export type S = { getItem(k: string): string | null };",
        "export const key = 'micro.diagnostics.v1';",
        "export function storageUnavailable() { throw new Error('diagnostics storage unavailable'); }",
        "",
      ].join("\n"),
    );
    expect(sites).toHaveLength(0);
  });

  it("accepts the registered diagnostics adapter file's real access but flags the same access one directory away", () => {
    const adapterContent = fs.readFileSync(path.join(ROOT, REGISTERED_DIAGNOSTICS_ADAPTER), "utf8");
    const sites = webStorageAccessSites(REGISTERED_DIAGNOSTICS_ADAPTER, adapterContent);
    expect(sites.length).toBeGreaterThanOrEqual(1);
    expect(sites.every(s => s.kind === "global-receiver property access")).toBe(true);

    const dir = tempRepo();
    withRegisteredTree(dir);
    writeClientFile(
      dir,
      "storage/diagnostics/impostor.ts",
      "export const ls = globalThis.localStorage;\n",
    );
    const { ok, violations } = checkDiagnosticsStorage(dir);
    expect(ok).toBe(false);
    expect(violations.some(v => v.key.includes("storage/diagnostics/impostor.ts"))).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("fails on a stale registration (registered entry left the tree)", () => {
    const dir = tempRepo();
    const target = path.join(dir, REGISTERED_DIAGNOSTICS_ADAPTER);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    /* لا ننشئ المهايئ المسجل إطلاقًا — التسجيل متقادم */
    writeClientFile(dir, "application/demo/ok.ts", "export const ok = 1;\n");
    const { ok, violations } = checkDiagnosticsStorage(dir);
    expect(ok).toBe(false);
    expect(violations.some(v => v.rule === "registered-entry-stale")).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("fails when the diagnostics adapter is routed through the financial/local storage port (boundary separation)", () => {
    const dir = tempRepo();
    for (const entry of REGISTERED_ENTRIES) {
      const target = path.join(dir, entry.file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, "export const ok = 1;\n", "utf8");
    }
    const target = path.join(dir, REGISTERED_DIAGNOSTICS_ADAPTER);
    fs.writeFileSync(
      target,
      [
        "import type { PrototypeLocalStore } from '@/storage/local/types';",
        "export function bad(store: PrototypeLocalStore) { return store; }",
        "export const ls = globalThis.localStorage;",
        "",
      ].join("\n"),
      "utf8",
    );
    const { ok, violations } = checkDiagnosticsStorage(dir);
    expect(ok).toBe(false);
    expect(violations.some(v => v.rule === "diagnostics-adapter-routed-through-local-storage-port")).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
