import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "public/sw.js",
      "scripts/**/*.cjs",
      "test-results/**",
      "dist/**",
      "mcp/dist/**",
    ],
  },
  {
    rules: {
      // Apostrophes and quotes in JSX prose render correctly; in a copy-heavy
      // marketing app this rule fires on every contraction and is pure noise.
      "react/no-unescaped-entities": "off",
      // App Router uses <a> for cross-app and external links by design.
      "@next/next/no-html-link-for-pages": "off",
      // React Compiler advisory rules introduced with eslint-config-next 16.
      // Existing violations are tracked as warnings and cleaned up in the
      // v2 bug-fix pass; new code should not add more.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];

export default config;
