// @repo/eslint-config/base — config flat ESLint partagee (JS/TS).
// Extraite de l'eslint.config.js du front tournoi (typescript-eslint v8).
// Consommee via `import { base } from '@repo/eslint-config/base'`.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

export const base = [
  globalIgnores(['dist', 'node_modules', '.turbo']),
  js.configs.recommended,
  ...tseslint.configs.recommended,
]

export default base
