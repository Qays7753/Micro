/**
 * braces-free — bounded, iterative brace-pattern expansion.
 *
 * Replaces the `braces@3.0.3` dependency of micromatch@4.0.8 for the
 * expand mode used by this repository's toolchain (fast-glob calls
 * `micromatch.braces(pattern, { expand: true, nodupes: true,
 * keepEscaping: true })`). GHSA-vfj7-8cjw-p6xm (CWE-674): the original
 * library recurses without depth limits and expands without output
 * bounds; measured on the original stack, 200 sequential `{a,b}` groups
 * exhaust the Node heap (process kill), and inputs beyond 10,000
 * characters throw from its internal length guard.
 *
 * Security design of this engine:
 *   - NO RECURSION ANYWHERE: parsing and expansion are iterative with
 *     explicit worklists, so nesting depth cannot exhaust the stack.
 *   - MAX_PATTERN_LENGTH (10,000): mirrors the original library's own
 *     protective limit, with the same error type and message shape.
 *   - MAX_TOTAL_OUTPUT (65,536): hard ceiling on the number of expanded
 *     patterns; exponential blowups (e.g. `x{a,b}{a,b}...`) throw a
 *     descriptive Error immediately instead of exhausting memory.
 *     Fail-closed: callers (fast-glob -> stylelint) crash loudly with a
 *     non-zero exit; nothing is silently dropped or matched.
 *
 * Behavioral parity: every semantic encoded here is pinned by the golden
 * fixtures in scripts/security/braces-elimination/fixtures/ (95 cases
 * captured from braces@3.0.3 before the change), including:
 *   - left-outer cartesian ordering ({a,b}{c,d} -> ac,ad,bc,bd);
 *   - alternation parts are NOT trimmed ({a, b} -> ['a', ' b']);
 *   - range tokens ARE trimmed ({ 1..3} -> 1..3);
 *   - ranges: direction = sign(end-start); step magnitude = |step|;
 *     step 0 or empty -> 1 ({1..3..0} -> 1,2,3);
 *   - mixed endpoints expand by codepoint ({1..a} -> '1'..'a');
 *     multi-char non-numeric endpoints are invalid ({ab..ac} passes through);
 *   - zero-padding only when an endpoint has a leading zero
 *     ({01..3} -> 01..03, {-03..2} -> -03..002, {-2..2} unpadded);
 *   - invalid groups keep their braces literal but their inner valid
 *     groups still expand ({{a,b}} -> ['{a}','{b}']);
 *   - character classes are opaque ([{a,b}] and {[a,b]} pass through);
 *   - escapes: \x protects x from all meaning; keepEscaping=false
 *     unescapes literal output, true keeps backslashes.
 */
"use strict";

const MAX_PATTERN_LENGTH = 10_000;
const MAX_TOTAL_OUTPUT = 65_536;

const errors = {
  length(pattern) {
    return new SyntaxError(
      `Input length (${pattern.length}), exceeds max characters (${MAX_PATTERN_LENGTH})`,
    );
  },
  output(pattern) {
    return new Error(
      `braces-free shim: refusing to expand "${pattern.slice(0, 64)}..." — ` +
        `the expansion would exceed ${MAX_TOTAL_OUTPUT} patterns (bounded ` +
        `expansion replaces the unbounded braces@3.0.3 behavior, ` +
        `GHSA-vfj7-8cjw-p6xm / CWE-674). Fix the pattern.`,
    );
  },
};

/* ------------------------------------------------------------------ *
 * Parsing (iterative; escape- and class-aware).                      *
 * ------------------------------------------------------------------ */

/**
 * Find every balanced brace span in the pattern.
 * Returns [{ open, close }] (indices of '{' and '}'). Escaped braces,
 * braces inside character classes, and unclosed braces are not spans.
 */
function findSpans(pattern) {
  const spans = [];
  const stack = [];
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "\\") {
      i++; // escaped char: skip
      continue;
    }
    if (inClass) {
      if (ch === "]") inClass = false;
      continue;
    }
    if (ch === "[") {
      inClass = true;
      continue;
    }
    if (ch === "{") {
      stack.push(i);
    } else if (ch === "}") {
      const open = stack.pop();
      if (open !== undefined) spans.push({ open, close: i });
    }
  }
  return spans.sort((a, b) => a.open - b.open);
}

/**
 * Top-level comma indices inside a span's content (depth 0, outside
 * classes, unescaped).
 */
function topLevelCommas(pattern, span) {
  const commas = [];
  let depth = 0;
  let inClass = false;
  for (let i = span.open + 1; i < span.close; i++) {
    const ch = pattern[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (inClass) {
      if (ch === "]") inClass = false;
      continue;
    }
    if (ch === "[") {
      inClass = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === "," && depth === 0) commas.push(i);
  }
  return commas;
}

const NUMERIC_RE = /^-?\d+$/;
const LEADING_ZERO_RE = /^-?0\d/;

/**
 * Parse a comma-less span content as a range. Returns null when invalid.
 * Tokens are whitespace-trimmed; empty/zero step means 1; direction is
 * sign(end-start) and the step contributes only its magnitude.
 */
function parseRange(content) {
  const tokens = content.split("..").map((t) => t.trim());
  if (tokens.length < 2 || tokens.length > 3) return null;
  const [startTok, endTok, stepTokRaw = ""] = tokens;
  if (startTok === "" || endTok === "") return null;
  const startNumeric = NUMERIC_RE.test(startTok);
  const endNumeric = NUMERIC_RE.test(endTok);
  // Endpoints must be numeric or single characters; multi-char
  // non-numeric endpoints are invalid ({ab..ac} passes through).
  if (!startNumeric && startTok.length > 1) return null;
  if (!endNumeric && endTok.length > 1) return null;
  if (stepTokRaw !== "" && !NUMERIC_RE.test(stepTokRaw)) return null;

  const stepMag = stepTokRaw === "" ? 1 : Math.abs(parseInt(stepTokRaw, 10)) || 1;

  if (startNumeric && endNumeric) {
    const start = parseInt(startTok, 10);
    const end = parseInt(endTok, 10);
    const dir = end >= start ? 1 : -1;
    const padded = LEADING_ZERO_RE.test(startTok) || LEADING_ZERO_RE.test(endTok);
    const width = padded ? Math.max(startTok.length, endTok.length) : 0;
    return { mode: "numeric", start, end, dir, step: stepMag, width: padded ? width : null };
  }
  // Mixed or char endpoints: expand by codepoint ({1..a} -> '1'..'a').
  const start = startTok.charCodeAt(0);
  const end = endTok.charCodeAt(0);
  const dir = end >= start ? 1 : -1;
  return { mode: "char", start, end, dir, step: stepMag };
}

function formatNumber(value, width) {
  if (width === null || width === undefined) return String(value);
  if (value < 0) return "-" + String(Math.abs(value)).padStart(width - 1, "0");
  return String(value).padStart(width, "0");
}

function rangeValues(range) {
  const out = [];
  for (let v = range.start; range.dir > 0 ? v <= range.end : v >= range.end; v += range.dir * range.step) {
    out.push(range.mode === "numeric" ? formatNumber(v, range.width) : String.fromCharCode(v));
    if (out.length > MAX_TOTAL_OUTPUT) throw errors.output(String(range.start));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Tree construction: a group per VALID span; invalid spans keep their *
 * braces literal while their content is still parsed for inner spans. *
 * ------------------------------------------------------------------ */

function buildTree(pattern) {
  const spans = findSpans(pattern);
  const groups = [];

  for (const span of spans) {
    const commas = topLevelCommas(pattern, span);
    const content = pattern.slice(span.open + 1, span.close);
    let group;
    if (commas.length > 0) {
      const parts = [];
      let prev = span.open + 1;
      for (const ci of commas) {
        parts.push([prev, ci]);
        prev = ci + 1;
      }
      parts.push([prev, span.close]);
      group = { span, type: "alt", parts };
    } else {
      const range = parseRange(content);
      if (range) {
        group = { span, type: "range", range };
      } else {
        group = { span, type: "invalid" };
      }
    }
    groups.push(group);
  }

  // Depth of each group = number of strictly enclosing spans.
  const depth = new Map();
  for (const g of groups) {
    let d = 0;
    for (const other of groups) {
      if (other !== g && other.span.open < g.span.open && other.span.close > g.span.close) d++;
    }
    depth.set(g, d);
  }

  // Literal segments of a region [from, to): the text minus valid-group spans.
  // A group already consumed by an earlier (enclosing) group starts before
  // the cursor and must not be emitted again.
  function segments(from, to) {
    const segs = [];
    let cursor = from;
    for (const g of groups) {
      if (g.type === "invalid") continue;
      if (g.span.open >= from && g.span.close <= to && g.span.open >= cursor) {
        if (g.span.open > cursor) segs.push({ lit: pattern.slice(cursor, g.span.open) });
        segs.push({ group: g });
        cursor = g.span.close + 1;
      }
    }
    if (to > cursor) segs.push({ lit: pattern.slice(cursor, to) });
    return segs;
  }

  // Alternation parts become segment lists for cartesian assembly.
  for (const g of groups) {
    if (g.type === "alt") {
      g.partSegments = g.parts.map(([a, b]) => segments(a, b));
    }
  }

  return { rootSegments: segments(0, pattern.length), groups, depth };
}

/* ------------------------------------------------------------------ *
 * Iterative expansion (deepest groups first; cartesian left-outer).   *
 * ------------------------------------------------------------------ */

function unescapeLiteral(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\" && i + 1 < text.length) {
      out += text[i + 1];
      i++;
    } else {
      out += text[i];
    }
  }
  return out;
}

function assemble(segments, expansions, keepEscaping, pattern) {
  let results = [""];
  for (const seg of segments) {
    if (seg.lit !== undefined) {
      const lit = keepEscaping ? seg.lit : unescapeLiteral(seg.lit);
      for (let i = 0; i < results.length; i++) results[i] += lit;
      continue;
    }
    const values = expansions.get(seg.group);
    if (!values || values.length === 0) continue;
    if (results.length * values.length > MAX_TOTAL_OUTPUT) throw errors.output(pattern);
    const next = [];
    for (const r of results) {
      for (const v of values) {
        next.push(r + v);
        if (next.length > MAX_TOTAL_OUTPUT) throw errors.output(pattern);
      }
    }
    results = next;
  }
  return results;
}

function expand(pattern, options) {
  if (pattern.length > MAX_PATTERN_LENGTH) throw errors.length(pattern);
  const { expand: expandMode } = options || {};
  if (expandMode !== true) {
    throw new Error(
      "braces-free shim: only the expand mode is supported " +
        "(no consumer of this repository uses the regex-alternation mode; " +
        "see tools/micromatch-shim/README.md)",
    );
  }
  const keepEscaping = options && options.keepEscaping === true;
  const nodupes = !options || options.nodupes !== false;

  const tree = buildTree(pattern);
  const expansions = new Map();

  // Deepest-first worklist: a group's parts only reference strictly
  // deeper groups, which are already computed when it is processed.
  const ordered = [...tree.groups].sort((a, b) => tree.depth.get(b) - tree.depth.get(a));
  for (const g of ordered) {
    if (g.type === "range") {
      expansions.set(g, rangeValues(g.range));
    } else if (g.type === "alt") {
      const values = [];
      for (const partSegments of g.partSegments) {
        for (const v of assemble(partSegments, expansions, keepEscaping, pattern)) {
          values.push(v);
          if (values.length > MAX_TOTAL_OUTPUT) throw errors.output(pattern);
        }
      }
      expansions.set(g, values);
    }
  }

  let results = assemble(tree.rootSegments, expansions, keepEscaping, pattern);
  if (nodupes) {
    const seen = new Set();
    results = results.filter((r) => {
      if (seen.has(r)) return false;
      seen.add(r);
      return true;
    });
  }
  return results;
}

module.exports = {
  expandBraces: expand,
  MAX_PATTERN_LENGTH,
  MAX_TOTAL_OUTPUT,
};
