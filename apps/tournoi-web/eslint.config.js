// Config ESLint de tournoi-web : consomme le preset partage @repo/eslint-config/react
// (base JS/TS + react-hooks + react-refresh/vite), cree en Story 1.0 et desormais
// la source unique des regles. Garder ici uniquement les specificites de l'app.
import { defineConfig } from 'eslint/config'
import { react } from '@repo/eslint-config/react'

export default defineConfig([...react])
