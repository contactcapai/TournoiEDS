// `server-only` en TOUTE PREMIÈRE LIGNE : ce module porte le secret client Discord et la
// clé de signature des sessions (AR-SEC4). Il ne doit jamais entrer dans un bundle client.
import "server-only";
import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";

import { adaptateurDrizzle } from "./adapter";

/**
 * Authentification du back-office — Auth.js v5 + Discord OAuth (FR26, AR-SEC1).
 *
 * ⚠️ DÉPENDANCE EN PRÉVERSION, ÉPINGLÉE À L'EXACT. `next-auth` est en `5.0.0-beta.32` :
 * `next-auth@latest` est la **v4**, conçue pour le Pages Router, dont l'API `auth()`
 * utilisée ici n'existe pas. Ne jamais « mettre à jour » sans re-mesurer — voir
 * `docs/PASSATION.md`.
 *
 * ⚠️ NE PAS RECOPIER LE MONTAGE « SPLIT CONFIG » DES TUTORIELS. La quasi-totalité de ce qui
 * est écrit sur Auth.js + Next scinde la configuration en deux (une sans adaptateur pour le
 * middleware Edge, une complète ailleurs). Cette gymnastique n'existe que parce que le
 * middleware tournait en Edge jusqu'à Next 15. En Next 16 le Proxy tourne en **Node.js par
 * défaut** (mesuré au cadrage), donc l'adaptateur Drizzle y est utilisable et UNE SEULE
 * configuration suffit. Deux configurations qui divergent, c'est une garde inerte qui ne se
 * voit pas.
 */
const { handlers, auth, signIn, signOut } = NextAuth({
  // Construit PARESSEUSEMENT — voir `./adapter.ts` : appelé directement ici, l'adaptateur
  // lèverait à l'import et ferait échouer `next build` (défaut mesuré, pas théorique).
  adapter: adaptateurDrizzle,

  // `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` sont détectées automatiquement par Auth.js :
  // les nommer ici les dupliquerait sans rien garantir de plus.
  providers: [Discord],

  // Session EN BASE et non JWT (`architecture.md`) : une déconnexion supprime réellement la
  // ligne, donc la session est révoquée côté serveur. Un JWT resterait valable jusqu'à son
  // expiration, quoi qu'on fasse.
  session: { strategy: "database" },

  // Les deux écrans par défaut d'Auth.js sont renvoyés vers NOTRE page de login : sans ça, un
  // refus d'allowlist afficherait la page d'erreur brute d'Auth.js (`/api/auth/error`), qui
  // n'a ni la charte ni un message lisible par un bénévole (EXPERIENCE.md).
  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },

  // 🔴 `trustHost` EN DUR PLUTÔT QU'EN VARIABLE D'ENVIRONNEMENT — décision de la Story 6.1.
  // En production Auth.js refuse d'inférer l'hôte sans autorisation explicite, et l'échec ne
  // survient QUE en production : impossible à voir en local. La variable `AUTH_TRUST_HOST`
  // ferait le même travail mais pourrait être oubliée sur le VPS. Ce site est self-hosted
  // derrière Traefik **par construction** — il n'existe aucun déploiement de la vitrine où
  // cette valeur devrait être `false`. On la fige donc plutôt que de la confier à un oubli.
  trustHost: true,

  callbacks: {
    /**
     * 🔴 CETTE GARDE A CHANGÉ DE NATURE À LA STORY 8.1 — ET C'EST LE GESTE LE PLUS RISQUÉ.
     *
     * Jusqu'ici elle était FAIL-CLOSED sur `AUTH_ADMIN_DISCORD_IDS` : se connecter et être
     * administrateur étaient le même fait, et personne hors de la liste ne pouvait créer une
     * ligne en base. Ce montage rendait impossible ce que la 8.1 doit livrer — attribuer un
     * accès depuis le back-office suppose que la personne ait déjà un compte, donc ait pu se
     * connecter d'abord. L'œuf et la poule.
     *
     * ⇒ Un compte Discord peut désormais entrer. IL N'OUVRE RIEN POUR AUTANT : les portes
     * sont tenues par `user_role` (`server/auth/guard.ts`), et un compte sans rôle ne voit
     * que `/admin/refus`. LE RÔLE NE VIENT PLUS JAMAIS DU FOURNISSEUR.
     *
     * ⚠️ CE QUE ÇA COÛTE, ÉCRIT PLUTÔT QUE DÉCOUVERT : n'importe quel compte Discord peut
     * créer une ligne `user` + `account`. C'est une écriture par un inconnu, sans limite de
     * débit. Elle est bornée (deux lignes, aucun contenu libre) et le sera par la même
     * surface en PR ② (Google, lien magique). Si ça devenait un problème réel, la parade est
     * une limite de débit sur `/api/auth/*`, pas le retour de l'allowlist — qui referme la
     * capacité livrée ici.
     */
    signIn({ account: compteOAuth }) {
      return compteOAuth?.provider === "discord";
    },

    /**
     * Expose l'identifiant local sur la session. Avec la stratégie `database`, Auth.js le
     * fournit déjà à l'exécution ; ce rappel explicite le rend visible au typage et évite
     * qu'un appelant le suppose sans preuve.
     */
    session({ session: sessionCourante, user: utilisateur }) {
      if (sessionCourante.user) {
        sessionCourante.user.id = utilisateur.id;
      }
      return sessionCourante;
    },
  },
});

export { handlers, auth, signIn, signOut };
