/**
 * R10-B5/F-031 + NF-022 (2026-10-13): راتشة سلك الإعداد — vite.config.ts كان
 * خارج كل بوابات التحليل الساكن (لا eslint ولا typecheck؛ tsconfig.node.json
 * موجود لكن لم يكن يشير إليه شيء). السلك صار: check في package.json يدير
 * `tsc --noEmit -p tsconfig.node.json` بعد فحص التطبيق نفسه. هذا الاختبار
 * يمنع فكّ السلك بصمت: لو حُذف المسار من check أو اختفى ملف الإعداد أو
 * غاب vite.config عن include فالبوابة تفشل هنا قبل أن تفشل في CI بلا شرح.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, "..");
const PACKAGE_JSON = path.join(APP_ROOT, "package.json");
const TSCONFIG_NODE = path.join(APP_ROOT, "tsconfig.node.json");

describe("F-031/NF-022 — tsconfig.node.json wiring (vite.config.ts typechecked)", () => {
  it("the check script runs BOTH configs: the app config then the node config", () => {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8"));
    const check = pkg.scripts?.check ?? "";
    expect(check).toContain("tsc --noEmit");
    /* الترتيب مقصود: فحص التطبيق أولًا ثم إعداد العقدة — والوجوب هو الاثنان. */
    const nodePass = /tsc\s+--noEmit\s+-p\s+tsconfig\.node\.json/.exec(check);
    expect(nodePass).not.toBeNull();
    expect(check.indexOf("tsc --noEmit")).toBeLessThan(check.indexOf("-p tsconfig.node.json"));
  });

  it("tsconfig.node.json exists, parses, and its include covers vite.config.ts", () => {
    const raw = fs.readFileSync(TSCONFIG_NODE, "utf8");
    /* tsconfig يسمح بالتعليقات — أزلها قبل التحليل كما يفعل tsc نفسه. */
    const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const parsed = JSON.parse(stripped);
    expect(parsed.compilerOptions?.noEmit).toBe(true);
    expect(parsed.compilerOptions?.strict).toBe(true);
    expect(parsed.include).toContain("vite.config.ts");
    expect(fs.existsSync(path.join(APP_ROOT, "vite.config.ts"))).toBe(true);
  });
});
