"use strict";
/**
 * micromatch-braces-free — a drop-in replacement for micromatch@4.0.8
 * with the `braces` dependency (GHSA-vfj7-8cjw-p6xm, CVE-2026-93687,
 * CWE-674) eliminated.
 *
 * Provenance: this module is a port of micromatch@4.0.8's index.js
 * (MIT, Copyright (c) 2014-present Jon Schlinkert), which is itself a
 * thin layer over picomatch. The matching engine is delegated to the
 * SAME picomatch version the original resolves (picomatch@2.3.2, pinned
 * exactly), so every matching API — list form, isMatch, makeRe, scan,
 * matcher, all/every/some/not/contains/capture/matchKeys — behaves
 * identically to the original for the same inputs.
 *
 * The ONLY behavioral change: `micromatch.braces` / `micromatch.braceExpand`
 * delegate to the local bounded expansion engine (./lib/braces-free.js)
 * instead of the vulnerable `braces` package. `micromatch.parse` — which
 * in the original pre-expands patterns through braces in regex-alternation
 * mode — is intentionally unsupported and throws loudly: no package in
 * this repository's dependency graph calls it (verified by the
 * consumer-surface test), and the braces-elimination harness pins the
 * full supported surface.
 *
 * Package shape mirrors the original exactly: CommonJS, main: index.js,
 * default export = the micromatch function with attached API methods.
 */
const util = require("util");
const picomatch = require("picomatch");
const { expandBraces } = require("./lib/braces-free");

/* Inlined from picomatch/lib/utils (the three helpers micromatch itself
 * imports from picomatch's internals) — reimplemented here so the shim
 * does not depend on an undocumented internal path. */
const utils = {
  isObject: (v) => typeof v === "object" && v !== null && !Array.isArray(v),
  isWindows: (o) => o && typeof o === "object" && /win/i.test(process.platform || ""),
  toPosixSlashes: (str) => str.replace(/\\/g, "/"),
};

const isEmptyString = (v) => v === "" || v === "./";
const hasBraces = (v) => {
  const index = v.indexOf("{");
  return index > -1 && v.indexOf("}", index) > index;
};

/**
 * Returns an array of strings that match one or more glob patterns.
 * (Ported verbatim from micromatch@4.0.8 — ordered last-match-wins
 * semantics with picomatch as the engine.)
 */
const micromatch = (list, patterns, options) => {
  patterns = [].concat(patterns);
  list = [].concat(list);

  let omit = new Set();
  let keep = new Set();
  let items = new Set();
  let negatives = 0;

  let onResult = (state) => {
    items.add(state.output);
    if (options && options.onResult) {
      options.onResult(state);
    }
  };

  for (let i = 0; i < patterns.length; i++) {
    let isMatch = picomatch(String(patterns[i]), { ...options, onResult }, true);
    let negated = isMatch.state.negated || isMatch.state.negatedExtglob;
    if (negated) negatives++;

    for (let item of list) {
      let matched = isMatch(item, true);

      let match = negated ? !matched.isMatch : matched.isMatch;
      if (!match) continue;

      if (negated) {
        omit.add(matched.output);
      } else {
        omit.delete(matched.output);
        keep.add(matched.output);
      }
    }
  }

  let result = negatives === patterns.length ? [...items] : [...keep];
  let matches = result.filter((item) => !omit.has(item));

  if (options && matches.length === 0) {
    if (options.failglob === true) {
      throw new Error(`No matches found for "${patterns.join(", ")}"`);
    }

    if (options.nonull === true || options.nullglob === true) {
      return options.unescape ? patterns.map((p) => p.replace(/\\/g, "")) : patterns;
    }
  }

  return matches;
};

/** Backwards compatibility */
micromatch.match = micromatch;

/** Returns a matcher function from the given glob `pattern` and `options`. */
micromatch.matcher = (pattern, options) => picomatch(pattern, options);

/** Returns true if **any** of the given glob `patterns` match `str`. */
micromatch.isMatch = (str, patterns, options) => picomatch(patterns, options)(str);

/** Backwards compatibility */
micromatch.any = micromatch.isMatch;

/** Returns a list of strings that do not match any of the given `patterns`. */
micromatch.not = (list, patterns, options = {}) => {
  patterns = [].concat(patterns).map(String);
  let result = new Set();
  let items = [];

  let onResult = (state) => {
    if (options.onResult) options.onResult(state);
    items.push(state.output);
  };

  let matches = new Set(micromatch(list, patterns, { ...options, onResult }));

  for (let item of items) {
    if (!matches.has(item)) {
      result.add(item);
    }
  }
  return [...result];
};

/** Returns true if the given `string` contains the given pattern. */
micromatch.contains = (str, pattern, options) => {
  if (typeof str !== "string") {
    throw new TypeError(`Expected a string: "${util.inspect(str)}"`);
  }

  if (Array.isArray(pattern)) {
    return pattern.some((p) => micromatch.contains(str, p, options));
  }

  if (typeof pattern === "string") {
    if (isEmptyString(str) || isEmptyString(pattern)) {
      return false;
    }

    if (str.includes(pattern) || (str.startsWith("./") && str.slice(2).includes(pattern))) {
      return true;
    }
  }

  return micromatch.isMatch(str, pattern, { ...options, contains: true });
};

/** Filter the keys of the given object with the given `glob` pattern. */
micromatch.matchKeys = (obj, patterns, options) => {
  if (!utils.isObject(obj)) {
    throw new TypeError("Expected the first argument to be an object");
  }
  let keys = micromatch(Object.keys(obj), patterns, options);
  let res = {};
  for (let key of keys) res[key] = obj[key];
  return res;
};

/** Returns true if some of the strings in `list` match any of the `patterns`. */
micromatch.some = (list, patterns, options) => {
  let items = [].concat(list);

  for (let pattern of [].concat(patterns)) {
    let isMatch = picomatch(String(pattern), options);
    if (items.some((item) => isMatch(item))) {
      return true;
    }
  }
  return false;
};

/** Returns true if every string in `list` matches any of the `patterns`. */
micromatch.every = (list, patterns, options) => {
  let items = [].concat(list);

  for (let pattern of [].concat(patterns)) {
    let isMatch = picomatch(String(pattern), options);
    if (!items.every((item) => isMatch(item))) {
      return false;
    }
  }
  return true;
};

/** Returns true if **all** of the `patterns` match the specified `string`. */
micromatch.all = (str, patterns, options) => {
  if (typeof str !== "string") {
    throw new TypeError(`Expected a string: "${util.inspect(str)}"`);
  }

  return [].concat(patterns).every((p) => picomatch(p, options)(str));
};

/** Returns an array of matches captured by `pattern` in `string`, or `null`. */
micromatch.capture = (glob, input, options) => {
  let posix = utils.isWindows(options);
  let regex = picomatch.makeRe(String(glob), { ...options, capture: true });
  let match = regex.exec(posix ? utils.toPosixSlashes(input) : input);

  if (match) {
    return match.slice(1).map((v) => (v === void 0 ? "" : v));
  }
};

/** Create a regular expression from the given glob `pattern`. */
micromatch.makeRe = (...args) => picomatch.makeRe(...args);

/** Scan a glob pattern to separate the pattern into segments. */
micromatch.scan = (...args) => picomatch.scan(...args);

/**
 * Parse a glob pattern to create regex source strings.
 * UNSUPPORTED: the original pre-expands patterns through `braces` in
 * regex-alternation mode. No consumer in this repository calls parse();
 * keeping it fail-closed prevents silent divergence.
 */
micromatch.parse = () => {
  throw new Error(
    "micromatch-braces-free: micromatch.parse is not supported — it requires " +
      "the braces regex-alternation mode this shim replaces. No consumer in " +
      "this repository uses it; if a future dependency does, extend the shim " +
      "deliberately (tools/micromatch-shim/README.md).",
  );
};

/**
 * Process the given brace `pattern` — bounded, iterative expansion
 * (the remediation for GHSA-vfj7-8cjw-p6xm).
 */
micromatch.braces = (pattern, options) => {
  if (typeof pattern !== "string") throw new TypeError("Expected a string");
  if ((options && options.nobrace === true) || !hasBraces(pattern)) {
    return [pattern];
  }
  return expandBraces(pattern, options);
};

/** Expand braces (expand mode forced). */
micromatch.braceExpand = (pattern, options) => {
  if (typeof pattern !== "string") throw new TypeError("Expected a string");
  return expandBraces(pattern, { ...options, expand: true });
};

// exposed for tests
micromatch.hasBraces = hasBraces;
module.exports = micromatch;
