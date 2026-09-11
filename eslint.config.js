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
        /* المجموعة ٦ (التحصين الكامل): نقاء المجال — لا استيراد غير نسبي داخل
         * src/domain (لا React ولا حزم خارجية ولا مسارات التطبيق/الواجهة)؛
         * استيراد ديناميكي غير نسبي يُمنع بنفس القاعدة. */
        {
          selector: "ImportDeclaration[source.value=/^[^.]/]",
          message:
            "Domain core must import only relative domain modules — no external packages, aliases, or app/UI layers (domain purity, hardening program Group 6).",
        },
        {
          selector: "ImportExpression[source.value=/^[^.]/]",
          message:
            "Domain core must not dynamically import non-relative modules — no external packages, aliases, or app/UI layers (domain purity, hardening program Group 6).",
        },
      ],
      /* المجموعة ٦ (التحصين الكامل): المجال لا يلمس المتصفح — لا indexedDB
       * ولا localStorage ولا DOM؛ هذه حدود طبقة التخزين والتطبيق وحدها. */
      "no-restricted-globals": [
        "error",
        "indexedDB",
        "localStorage",
        "sessionStorage",
        "document",
        "window",
        "navigator",
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
      /* إعفاء Math الحالي يُحفظ كما هو (roundHalfUp نفسها تستخدم Math.round)،
       * لكن نقاء الاستيراد يبقى مفروضًا على shared أيضًا (المجموعة ٦):
       * كانت "off" فصارت قواعد نقاء الاستيراد وحدها — لا إضعاف، تشديد. */
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value=/^[^.]/]",
          message:
            "Domain core must import only relative domain modules — no external packages, aliases, or app/UI layers (domain purity, hardening program Group 6).",
        },
        {
          selector: "ImportExpression[source.value=/^[^.]/]",
          message:
            "Domain core must not dynamically import non-relative modules — no external packages, aliases, or app/UI layers (domain purity, hardening program Group 6).",
        },
      ],
    },
  },
  /* المجموعة ٦: اختبارات المجال يجوز لها استيراد أداة الاختبار (vitest) —
   * استثناء موثق لأدوات الاختبار لا لغيرها؛ حظر Math يبقى مفروضًا داخل
   * الاختبارات نفسها، وحدود المتصفح تبقى مفروضة أيضًا. */
  {
    files: ["src/domain/**/*.test.ts"],
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
    files: ["apps/prototype-web/client/src/pages/**/*.{ts,tsx}"],
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
                "Pages must use Application services, not the local storage layer directly (type imports stay allowed).",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/prototype-web/client/src/components/**/*.{ts,tsx}"],
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
                "Components must use Application services, not the local storage layer directly (type imports stay allowed).",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  /* S4-10/S5-13: طبقة التطبيق والتخزين تحت الفحص نفسه — لا any ولا استيراد React
   * (حدود الطبقات تُفرض لا تُفترض). جذر التركيب (app/) والسياقات وPWA مكونات
   * React مشروعة فتبقى بلا هذا القيد. */
  {
    files: [
      "apps/prototype-web/client/src/application/**/*.{ts,tsx}",
      "apps/prototype-web/client/src/storage/**/*.{ts,tsx}",
    ],
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
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "react/jsx-runtime"],
              message:
                "Application/storage layers must stay UI-free: no React imports (the composition root owns React).",
              allowTypeImports: false,
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "apps/prototype-web/client/src/app/**/*.{ts,tsx}",
      "apps/prototype-web/client/src/contexts/**/*.{ts,tsx}",
      "apps/prototype-web/client/src/presentation/**/*.{ts,tsx}",
      "apps/prototype-web/client/src/pwa/**/*.{ts,tsx}",
      "apps/prototype-web/client/src/lib/**/*.{ts,tsx}",
    ],
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
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  /* المجموعة ٦ (التحصين الكامل): لا تخزين متصفح مباشر من الصفحات/المكونات —
   * المرور عبر خدمات Application وحدها (حدود G5 المسودة والحدود المعمارية)؛
   * يستهدف window/globalThis والمعرف المجرد معًا. */
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
      "no-restricted-globals": ["error", "localStorage", "sessionStorage"],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='window'][property.name='localStorage'], MemberExpression[object.name='window'][property.name='sessionStorage']",
          message:
            "Pages/components must not touch browser storage directly — route through Application services (storage boundary, hardening program Group 6).",
        },
        {
          selector:
            "MemberExpression[object.name='globalThis'][property.name='localStorage'], MemberExpression[object.name='globalThis'][property.name='sessionStorage']",
          message:
            "Pages/components must not touch browser storage directly — route through Application services (storage boundary, hardening program Group 6).",
        },
      ],
    },
  },
  /* المجموعة ٦: استثناء موثق وضيق — ملفات اختبار الصفحات/المكونات يجوز لها
   * لمس localStorage في أدواتها (زرع/قراءة/تنظيف بيانات الاختبار) دون أن
   * يمس ذلك حد الإنتاج؛ لا يستثنى من قاعدة no-restricted-imports شيئًا.
   * إزالة الاستثناء: عندما تنتقل أدوات الاختبار إلى مهايئ خدمة صريح. */
  {
    files: [
      "apps/prototype-web/client/src/pages/**/*.test.{ts,tsx}",
      "apps/prototype-web/client/src/components/**/*.test.{ts,tsx}",
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "no-restricted-globals": "off",
      "no-restricted-syntax": "off",
    },
  },
];
