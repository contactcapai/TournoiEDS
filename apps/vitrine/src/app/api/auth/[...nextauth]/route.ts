// Point de terminaison d'Auth.js — il sert TOUT le flux OAuth : `/api/auth/signin`,
// `/api/auth/callback/discord`, `/api/auth/signout`, `/api/auth/session`, `/api/auth/csrf`.
//
// 🔴 CE CHEMIN N'EST PAS NÉGOCIABLE : `/api/auth/callback/discord` est l'URL déclarée dans le
// portail développeur Discord, et la correspondance y est EXACTE. Déplacer ce fichier casse
// le retour du flux — et l'erreur (`invalid_redirect_uri`) n'apparaît qu'APRÈS que le
// visiteur ait cliqué « Autoriser », donc après un parcours qui a l'air de fonctionner.
// ⚠️ `architecture.md` a longtemps prescrit `app/auth/callback/route.ts` : c'était un vestige
// de la passerelle Kong de Supabase, retiré le 2026-07-29. Corrigé à la source par la 6.1.
import { handlers } from "../../../../server/auth/config";

export const { GET, POST } = handlers;
