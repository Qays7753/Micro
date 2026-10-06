/**
 * Shared library for the braces-elimination parity harness.
 *
 * Purpose: one definition of the semantic matrix (micromatch API cases,
 * brace-expansion cases, stylelint invocation cases) plus the runner and
 * output normalizer, used by BOTH:
 *   - capture-baseline.mjs  (freezes the ORIGINAL stack's behavior into
 *     fixtures; refuses to run on a non-original stack), and
 *   - braces-elimination.parity.test.mjs (compares the CURRENT stack —
 *     post-change: the shim — against the frozen fixtures).
 *
 * The only normalization applied is of legitimate environment differences:
 * the repository root path and package-install paths inside node_modules.
 * Nothing else is normalized: exit codes, JSON findings, ordering, error
 * messages and thrown-error types are compared verbatim.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
export const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const CORPUS_DIR = path.join(HARNESS_DIR, "corpus");
export const FIXTURES_DIR = path.join(HARNESS_DIR, "fixtures");

/** fast-glob's EXACT braces options (out/utils/pattern.js:137). */
export const FAST_GLOB_BRACES_OPTIONS = { expand: true, nodupes: true, keepEscaping: true };

/* ------------------------------------------------------------------ *
 * Case 1: brace-expansion matrix (the behavior fast-glob depends on). *
 * ------------------------------------------------------------------ */

export const BRACES_CASES = [
  // literals / no expandable groups
  "a",
  "foo.css",
  "apps/**/*.css",
  "{}",
  "{abc}",
  "{a.b}",
  "{a{-}b}",
  "[{a,b}]",
  "a[b{c,d}]e",
  "a{b,c",
  "a}b",
  "x\\{y,z}",
  "\\{a,b\\}",
  // alternation
  "{a,b}",
  "{a,b,c}",
  "{a,}",
  "{,a}",
  "{a,,b}",
  "foo/{a,b}/bar",
  "{a,{b,c}}",
  "{{a,b},{c,d}}",
  "{a,b}{c,d}",
  "{x,y,z}{1,2}",
  "{1..3}{a,b}",
  "a/{b,c}/{d,e}",
  "a{b,c}d{e,f}g",
  "a/{b,}/{c,}/*",
  "{a\\,b,c}",
  "a{b,c\\}d,e}f",
  "{a,b}\\{c,d\\}",
  // ranges — numeric
  "{1..3}",
  "{5..1}",
  "{-2..2}",
  "{01..3}",
  "{0..10..3}",
  "{1..5..2}",
  "{10..0..-2}",
  "{2..2}",
  "{a..a}",
  // ranges — chars
  "{a..c}",
  "{a..e}",
  "{e..a}",
  "{a..c..2}",
  // mixed / invalid ranges -> alternation or passthrough
  "{a,c..g}",
  "n/{a,1..3}/z",
  "{1..a}",
  "{a..1}",
  "{ 1..3}",
  "{1 ..3}",
  "{a..}",
  "{..3}",
  "{1..2..}",
  "{1..2..x}",
  "{1..3..0}",
  // realistic compositions
  "**/{a,b}/*.css",
  "src/**/*.{css,CSS}",
  "lit/{x,y}/[a-c]/*.css",
  "dir\\ with\\ space/{a,b}",
  "{ñ,ö}",
  "x{1..3}y",
  // legitimately-nested (safe on the original stack)
  "{a,".repeat(50) + "b" + "}".repeat(50),
  // extended edge battery (range parsing lenience, padding, descents,
  // multi-level nesting, multi-group cartesians, empty alternation)
  "{5..1..2}",
  "{10..1..3}",
  "{1..03}",
  "{007..10}",
  "{-5..-1}",
  "{-03..2}",
  "{0..0}",
  "{1..1..2}",
  "{a..b..5}",
  "{9..7}",
  "{a..A}",
  "{ab..ac}",
  "{a,{b,{c,d}}}",
  "{x,{y,z},w}",
  "{a,b}{c,d}{e,f}",
  "z{a..c}y{d..f}w",
  "{,}",
  "\\{a,b\\}/{c,d}",
  "{[a,b]}",
  // final lenience battery (spaces in alternations, mixed multi-digit/char
  // endpoints, negative steps, redundant nesting, empty-group adjacency)
  "{a, b}",
  "{a ,b}",
  "{  }",
  "{ }",
  "{10..a}",
  "{a..b..-2}",
  "{1..2..-1}",
  "{2..1}",
  "{{a,b}}",
  "{a,b}{}",
  "{a,b}{abc}",
];

/* ---------------------------------------------------------------------- *
 * Case 2: micromatch API matrix (everything the installed consumers use, *
 * plus the documented full public surface where cheap to verify).        *
 * ---------------------------------------------------------------------- */

/** list-form micromatch(list, patterns, options) — ordered last-match-wins. */
export const LIST_FORM_CASES = [
  { list: ["a", "b", "c"], patterns: ["*"] },
  { list: ["a", "b", "c"], patterns: ["*", "!b"] },
  { list: ["a", "b"], patterns: ["!a", "*"] },
  { list: ["a", "b"], patterns: ["!a", "!b"] },
  { list: ["a/b.css", "c.css"], patterns: ["**/*.css", "!a/**"] },
  { list: ["a/b.css", "c.css"], patterns: ["!a/**", "**/*.css"] },
  { list: ["x.css", "y.ts"], patterns: ["*.css", "*.ts"] },
  { list: [".hidden.css", "visible.css"], patterns: ["*.css"] },
  { list: [".hidden.css", "visible.css"], patterns: ["*.css"], options: { dot: true } },
  { list: ["/abs/path/a.css", "rel.css"], patterns: ["*.css"], options: { basename: true } },
  { list: ["a.css"], patterns: "a.css" },
  { list: "a.css", patterns: ["*.css"] },
  { list: [], patterns: ["*"] },
  { list: ["a.css"], patterns: [] },
];

/** isMatch(string, patterns, options) — the augmentConfig path. */
export const IS_MATCH_CASES = [
  { str: "/a/b/styles.css", patterns: ["*.css"], options: { dot: true } },
  { str: "/a/b/styles.css", patterns: ["*.css"], options: { dot: true, basename: true } },
  { str: ".hidden.css", patterns: ["*.css"], options: { dot: true } },
  { str: ".hidden.css", patterns: ["*.css"], options: {} },
  { str: "dist/generated.css", patterns: ["**/dist/**"], options: { dot: true } },
  { str: "src/app/main.css", patterns: ["src/**", "!src/app/**"], options: { dot: true } },
  { str: "src/app/main.css", patterns: ["!src/app/**", "src/**"], options: { dot: true } },
  { str: "a/b/c.css", patterns: ["**/*.{css,ts}"], options: { dot: true } },
  { str: "a/b/c.css", patterns: "{a,b}/*.css", options: {} },
  { str: "fa.css", patterns: ["?a.css"], options: {} },
  { str: "fa.css", patterns: ["[fg]a.css"], options: {} },
  { str: "ن.css", patterns: ["*.css"], options: { dot: true } },
];

/** misc API spot cases: matcher/all/every/some/not/contains/capture. */
export const MISC_API_CASES = [
  { api: "matcher", args: ["*.css"], then: ["a.css", "a.ts", ".a.css"] },
  { api: "all", args: ["foo.css", ["*.css", "f*"]] },
  { api: "all", args: ["foo.css", ["*.css", "!foo.css"]] },
  { api: "every", args: [["a.css", "b.css"], ["*.css"]] },
  { api: "every", args: [["a.css", "b.ts"], ["*.css"]] },
  { api: "some", args: [["a.css", "b.ts"], ["*.css"]] },
  { api: "not", args: [["a.a", "b.b", "c.c"], "*.a"] },
  { api: "contains", args: ["aa/bb/cc", "*b"] },
  { api: "contains", args: ["aa/bb/cc", "*d"] },
  { api: "capture", args: ["test/*.js", "test/foo.js"] },
  { api: "capture", args: ["test/*.js", "foo/bar.css"] },
];

/** makeRe(pattern, options): both the regex source AND behavior battery. */
export const MAKE_RE_CASES = [
  { pattern: "*.css", options: { dot: true }, test: ["a.css", "a/b.css", "a.ts", ".x.css"] },
  { pattern: "**/*.css", options: { dot: true }, test: ["a.css", "a/b/c.css", "a/b.css"] },
  { pattern: "a/**/b", options: { dot: true }, test: ["a/b", "a/x/b", "a/x/y/b", "x/b"] },
  { pattern: "x?.css", options: { dot: true }, test: ["xa.css", "x.css", "xab.css"] },
  { pattern: "[a-c].css", options: { dot: true }, test: ["a.css", "d.css"] },
  { pattern: "{a,b}/*.css", options: { dot: true }, test: ["a/x.css", "b/x.css", "c/x.css"] },
  { pattern: "src/**/*.{css,CSS}", options: { dot: true }, test: ["src/a.css", "src/a.CSS", "src/a.ts"] },
];

/** scan(pattern, { parts: true }) — the fast-glob getPatternParts path. */
export const SCAN_CASES = [
  "a/b/*.css",
  "**/*.css",
  "/abs/x/*.css",
  "a",
  "",
  "a/{b,c}/*.css",
  "apps/**/*.css",
  "./rel/*.css",
];

/* ------------------------------------------------------------------ *
 * Case 3: stylelint invocation battery — the exact Micro invocation   *
 * paths plus the semantic corpus. Run with the repo's own config and  *
 * binary, from the repo root, exactly as design-guards does.          *
 * ------------------------------------------------------------------ */

const C = "scripts/security/braces-elimination/corpus";

export const STYLELINT_CASES = [
  // The exact production invocation (package.json scripts.design-guards).
  { label: "micro-actual-glob", args: ["apps/prototype-web/client/src/**/*.css"] },
  { label: "micro-actual-glob-json", args: ["apps/prototype-web/client/src/**/*.css", "--formatter", "json"] },
  // Corpus: globs with braces (the expansion path under test).
  { label: "corpus-all", args: [`${C}/**/*.css`], json: true },
  { label: "brace-alternation", args: [`${C}/{a,b,n}.css`], json: true },
  { label: "brace-nested-alt", args: [`${C}/{a,{b,n}}.css`], json: true },
  { label: "brace-sequence-extgroup", args: [`${C}/nested/deep/e.css`, `${C}/**/*.{css,CSS}`], json: true },
  { label: "brace-deep-nesting-50", args: ["{a,".repeat(50) + "b" + "}".repeat(50) + ".css"], json: true },
  // Glob shapes.
  { label: "dot-star-glob", args: [`${C}/*/*.css`], json: true },
  { label: "bracket-glob", args: [`${C}/[ab].css`], json: true },
  { label: "unicode-path-glob", args: [`${C}/unicode-*/**/*.css`], json: true },
  { label: "space-path-escape", args: [`${C}/dir\\ with\\ space/*.css`], json: true },
  { label: "space-path-direct", args: [`${C}/dir with space/*.css`], json: true },
  { label: "dotfile-explicit", args: [`${C}/.dotfile.css`], json: true },
  { label: "dotdir-glob", args: [`${C}/.hiddirentry/**/*.css`], json: true },
  // Ignore semantics.
  { label: "ignore-pattern-flag", args: [`${C}/**/*.css`, "--ignore-pattern", `${C}/nested/**`], json: true },
  { label: "negated-pattern", args: [`${C}/**/*.css`, `!${C}/nested/**`], json: true },
  { label: "ignorefiles-dist", args: [`${C}/dist/generated.css`], json: true },
  // Overrides (config-level glob routing).
  { label: "overrides-config", args: [`${C}/overrides/*.css`, "--config", `${C}/overrides-config.json`], json: true },
  // Violations must fail (rule coverage).
  { label: "violating-dir", args: [`${C}/violating/*.css`], json: true },
  // File-level behavior.
  { label: "explicit-existing-file", args: [`${C}/b.css`], json: true },
  { label: "missing-file", args: [`${C}/does-not-exist.css`], json: true },
  { label: "empty-match-allow-empty", args: [`${C}/**/*.nomatch`, "--allow-empty-input"], json: true },
  { label: "empty-match-default", args: [`${C}/**/*.nomatch`], json: true },
  { label: "malformed-pattern", args: [`${C}/[.css`], json: true },
  // Stdin.
  {
    label: "stdin-violation",
    args: ["--stdin-filename", `${C}/stdin.css`],
    json: true,
    stdin: ".stdin { z-index: 9999; font-size: 9px; }\n",
  },
  {
    label: "stdin-clean",
    args: ["--stdin-filename", `${C}/stdin.css`],
    json: true,
    stdin: ".stdin { z-index: 20; font-size: 1rem; }\n",
  },
  // Config printing (globby.hasMagic / isDynamicPattern path).
  { label: "print-config", args: ["--print-config", `${C}/a.css`] },
  { label: "print-config-glob-reject", args: ["--print-config", `${C}/*.css`] },
];

/* ---------------------------------------------------------------- *
 * Runner + normalization.                                          *
 * ---------------------------------------------------------------- */

/**
 * Normalize an output string: neutralize the repository root and
 * node_modules install paths (the only legitimate differences between
 * the baseline stack and the shimmed stack). Nothing else is touched.
 */
export function normalizeOutput(text) {
  if (typeof text !== "string") return text;
  return text
    .replaceAll(REPO_ROOT, "<ROOT>")
    /* postcss generates a random id for anonymous string inputs
     * ("<input css JrkfVf>") — content-free, normalize it away. */
    .replace(/<input css [A-Za-z0-9_-]+>/g, "<input css RAND>")
    /* node prints its PID in deprecation warnings — content-free. */
    .replace(/\(node:\d+\)/g, "(node:PID)")
    /* Node-INTERNAL stack frames differ between Node versions (line
     * numbers, frame names like onImport.tracePromise.__proto__, extra
     * frames, and the paren-less `at async node:internal/...` shape) —
     * the application-level error and frames are the behavioral surface;
     * internal frames are content-free. */
    .replace(
      /^\s*at\s+(?:async\s+)?(?:[\w.$]+\s+)?(?:\(node:internal\/[^)\n]*\)|node:internal\/[^\n]*)\s*$/gm,
      "",
    )
    .replace(/node_modules\/\.pnpm\/[^/"\s\\]+\/node_modules\/[^/"\s\\]+/g, "<PKG>")
    .replace(/node_modules\/\.pnpm\/[^/"\s\\]+/g, "<PKG>");
}

/** Parse a stylelint JSON report out of a possibly-mixed output string. */
export function extractJson(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("[");
    const end = trimmed.lastIndexOf("]");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fallthrough */
      }
    }
    const oStart = trimmed.indexOf("{");
    const oEnd = trimmed.lastIndexOf("}");
    if (oStart !== -1 && oEnd > oStart) {
      try {
        return JSON.parse(trimmed.slice(oStart, oEnd + 1));
      } catch {
        /* fallthrough */
      }
    }
    return null;
  }
}

/*
 * Run the repo's stylelint binary once. Returns a normalized result:
 * { exitCode, report, raw } where report is the parsed JSON (or null) and
 * raw is the normalized full output for non-JSON cases.
 */
export function effectiveArgs(c) {
  return c.json ? [...c.args, "--formatter", "json"] : c.args;
}

/** Spawn environment free of NODE_PATH pollution: vitest sets NODE_PATH to
 * its own dependency dirs (including pnpm's hoisted .pnpm/node_modules),
 * which would let subprocesses resolve packages the real graph does not
 * provide. Harness spawns must resolve EXACTLY what the repo graph has. */
export function cleanSpawnEnv() {
  const env = { ...process.env };
  delete env.NODE_PATH;
  return env;
}

export function runStylelint(args, stdin = null) {
  const bin = path.join(REPO_ROOT, "node_modules", ".bin", "stylelint");
  const res = spawnSync(bin, args, {
    cwd: REPO_ROOT,
    input: stdin,
    encoding: "utf8",
    timeout: 120_000,
    env: cleanSpawnEnv(),
  });
  const out = normalizeOutput(res.stdout || "");
  const err = normalizeOutput(res.stderr || "");
  return {
    exitCode: res.status,
    report: extractJson(err) ?? extractJson(out),
    raw: (err.trim() || out.trim()).slice(0, 4000),
  };
}

/** Deep stable-stringify with sorted object keys (order-insensitive objects,
 * order-sensitive arrays). */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
