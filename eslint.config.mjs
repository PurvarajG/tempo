import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Packaged Electron output — a copy of .next plus all of node_modules.
    "dist-electron/**",
    // Design mockups and planning for v2 (includes .ts/.tsx explorations), not app code.
    "docs/design/**",
  ]),
  {
    // Electron's main process and electron-builder hooks are plain CommonJS;
    // they are loaded by Electron/Node directly, not bundled.
    files: ["electron/**/*.js", "scripts/electron-after-pack.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);

export default eslintConfig;
