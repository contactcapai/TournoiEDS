# @repo/ui

Design system partagé EDS (couronne, losanges, charte or/navy…).

> **SQUELETTE VIDE** dans la Story 1.0. Les tokens arrivent en **Story 1.2**, les
> primitives en **Story 1.3**. Ne pas remplir ici.

## ⚠️ Contrat de consommation (à lire avant d'importer ce package)

Ce package **expose ses sources TypeScript brutes** (`exports` → `./src/*.ts`),
pattern standard d'un package interne de monorepo Turborepo. Avec
`node-linker=hoisted`, il atterrit dans `node_modules/@repo/ui` — or **Vite et
Next.js n'appliquent pas leur pipeline TS sur `node_modules` par défaut**.

Toute app qui importe `@repo/ui` doit donc le transpiler explicitement :

- **Next.js (vitrine, Story 1.1)** : ajouter dans `next.config.ts`
  ```ts
  const nextConfig = { transpilePackages: ['@repo/ui'] }
  ```
  Sans ça : `SyntaxError: Unexpected token` au build/dev de la vitrine.

- **Vite** : les packages workspace en source TS sont gérés nativement (esbuild),
  mais vérifier `optimizeDeps`/`ssr.noExternal` si un import casse.

**Alternative long terme** : ajouter un step `build` (tsup/tsc → `dist/*.js` +
`.d.ts`) et repointer `exports` sur le `dist/`. Si ce step est ajouté, penser à
mettre `dependsOn: ["^build"]` sur la tâche `dev` de `turbo.json` (déjà fait) et à
vérifier que les apps buildent les deps upstream avant de démarrer.
