// @repo/eslint-config/react — base + regles React (hooks + react-refresh/vite).
// Miroir de l'eslint.config.js du front tournoi, mutualise pour la future vitrine.
// Consommee via `import { react } from '@repo/eslint-config/react'`.
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { base } from './base.js'

export const react = [
  ...base,
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
]

export default react
