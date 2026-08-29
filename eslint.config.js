import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/coverage/**"],
  },
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      complexity: ["warn", 12],
      "max-lines-per-function": ["warn", { max: 60, skipBlankLines: true, skipComments: true }],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["src/domain/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='round'], CallExpression[callee.object.name='Math'][callee.property.name='floor']",
          message:
            "Money rounding must go through the shared helpers in src/domain/shared/ (roundHalfUp and friends); raw Math.round/Math.floor drift is banned (D-02/A-07). Math.ceil for contract-documented ceilings stays allowed.",
        },
      ],
    },
  },
  {
    files: ["src/domain/shared/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    files: [
      "apps/prototype-web/client/src/pages/**/*.{ts,tsx}",
      "apps/prototype-web/client/src/components/**/*.{ts,tsx}",
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/storage/local/*"],
              message:
                "Pages/components must use Application services, not the local storage layer directly (type imports stay allowed).",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
];
