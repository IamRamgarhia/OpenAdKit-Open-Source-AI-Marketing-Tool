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
      // React Compiler rules introduced with eslint-config-next 16. All
      // existing violations were fixed in the v2 bug-fix pass (lazy
      // initializers, useSyncExternalStore for storage/event values, impure
      // calls moved out of render), so they are enforced again.
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/purity": "error",
      "react-hooks/immutability": "error",
    },
  },
];

export default config;
