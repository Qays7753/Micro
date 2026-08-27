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
];
