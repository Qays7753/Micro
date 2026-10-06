/**
 * CJS entrypoint probe: exercises stylelint's CommonJS API surface
 * (lib/*.cjs — augmentConfig.cjs / isPathIgnored.cjs), which loads the
 * micromatch replacement through require() — the CJS side of the shim.
 *
 * Prints a stable JSON summary; used identically by capture-baseline.mjs
 * (original stack) and the parity test (shimmed stack).
 */
"use strict";

const stylelint = require("stylelint");

async function main() {
  const results = [];

  // Case 1: lint a string via the CJS API (config resolution + rules).
  const stringLint = await stylelint.lint({
    code: ".probe { z-index: 9999; font-size: 2rem; }\n",
    config: {
      rules: {
        "declaration-property-value-disallowed-list": { "z-index": ["auto", "/^9\\d+/"] },
      },
    },
    formatter: "json",
  });
  results.push({
    label: "cjs-string-lint-violation",
    errored: stringLint.errored,
    output: JSON.parse(stringLint.output).map((r) => ({
      source: r.source,
      warnings: r.warnings.map((w) => ({ rule: w.rule, text: w.text })),
    })),
  });

  // Case 2: clean string via the CJS API.
  const cleanLint = await stylelint.lint({
    code: ".probe { z-index: 20; }\n",
    config: { rules: { "declaration-property-value-disallowed-list": { "z-index": ["auto", "/^9\\d+/"] } } },
    formatter: "json",
  });
  results.push({
    label: "cjs-string-lint-clean",
    errored: cleanLint.errored,
    output: JSON.parse(cleanLint.output).map((r) => ({
      source: r.source,
      warnings: r.warnings.map((w) => ({ rule: w.rule, text: w.text })),
    })),
  });

  // Case 3: file lint via the CJS API with glob patterns containing braces
  // (exercises fast-glob + brace expansion through require()).
  const globLint = await stylelint.lint({
    files: ["scripts/security/braces-elimination/corpus/{a,b,n}.css"],
    formatter: "json",
  });
  results.push({
    label: "cjs-glob-brace-lint",
    errored: globLint.errored,
    output: JSON.parse(globLint.output)
      .map((r) => ({
        source: (r.source || "").replace(/.*corpus\//, "corpus/"),
        warnings: r.warnings.map((w) => ({ rule: w.rule, text: w.text })),
      }))
      .sort((a, b) => (a.source < b.source ? -1 : 1)),
  });

  // Case 4: isPathIgnored via the CJS API (micromatch list form in .cjs).
  // resolveConfig -> augmentConfig/isPathIgnored with ignoreFiles.
  const ignored = await stylelint.lint({
    files: ["scripts/security/braces-elimination/corpus/**/*.css"],
    config: {
      rules: {},
      ignoreFiles: ["**/nested/**", "**/dist/**"],
    },
    formatter: "json",
  });
  results.push({
    label: "cjs-ignorefiles-glob",
    errored: ignored.errored,
    output: JSON.parse(ignored.output)
      .map((r) => ({
        source: (r.source || "").replace(/.*corpus\//, "corpus/"),
        warnings: r.warnings.map((w) => ({ rule: w.rule, text: w.text })),
      }))
      .sort((a, b) => (a.source < b.source ? -1 : 1)),
  });

  process.stdout.write(JSON.stringify(results, null, 1));
}

main().catch((err) => {
  process.stderr.write(`CJS-PROBE-FAILED: ${err && err.stack ? err.stack : String(err)}\n`);
  process.exit(1);
});
