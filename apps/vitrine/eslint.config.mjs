// ESLint flat config de la vitrine.
// - `base` (@repo/eslint-config/base) : regles JS/TS mutualisees du monorepo (zero divergence).
// - eslint-config-next : regles specifiques Next.js (App Router, core-web-vitals).
// NB : la config partagee `@repo/eslint-config/react` est ecartee ici car elle embarque
//      `react-refresh/vite`, specifique au front tournoi (Vite) et inadapte a Next.
import { defineConfig, globalIgnores } from "eslint/config";
import { base } from "@repo/eslint-config/base";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...base,
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
