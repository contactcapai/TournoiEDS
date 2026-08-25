// `server-only` en TOUTE PREMIÈRE LIGNE : ce module porte le secret client Discord et la
// clé de signature des sessions (AR-SEC4). Il ne doit jamais entrer dans un bundle client.
import "server-only";
import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";

import { COMPTE_SMTP, optionsSmtp } from "../mail/client";
import { envoyerLienMagique } from "../mail/lienMagique";
import { adaptateurDrizzle } from "./adapter";

/**
 * Authentification — Auth.js v5, TROIS moyens de connexion (Story 8.1, FR26, AR-SEC1).
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

  // ══════════════════════════════════════════════════════════════════════════════════════
  // TROIS MOYENS D'ENTRER, UN SEUL COMPTE — « tant qu'il y en a un, c'est bon »
  // ══════════════════════════════════════════════════════════════════════════════════════
  //
  // 🔴 AUCUNE AUTORISATION NE SE DÉCIDE ICI. Entrer ne donne RIEN : les portes sont tenues
  // par la table `user_role` (`./guard.ts`). Ne jamais réintroduire de filtre à cet endroit
  // — ce serait refermer la capacité livrée par la 8.1, et rendre l'écran d'attribution des
  // accès inutilisable (on ne peut donner un rôle qu'à quelqu'un qui a pu se connecter).
  //
  // `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` / `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` sont
  // détectées automatiquement par Auth.js : les nommer ici les dupliquerait sans rien
  // garantir de plus.
  providers: [
    Discord({ allowDangerousEmailAccountLinking: true }),
    Google({ allowDangerousEmailAccountLinking: true }),

    /**
     * ════════════════════════════════════════════════════════════════════════════════════
     * 🔴 `allowDangerousEmailAccountLinking` — POURQUOI ON L'ACTIVE, MALGRÉ SON NOM
     * ════════════════════════════════════════════════════════════════════════════════════
     *
     * C'est LA condition de « liés sur un seul compte ». Sans elle, quelqu'un dont le compte
     * a été créé par Discord et qui revient un jour par Google reçoit `OAuthAccountNotLinked`
     * — un mur, sur une adresse pourtant identique. Et il ne peut pas s'en sortir seul :
     * `user.email` est UNIQUE, donc Auth.js ne peut pas non plus créer un second compte.
     *
     * ⚠️ CE QUE LE MOT « DANGEROUS » DÉSIGNE VRAIMENT, ET POURQUOI ÇA NE S'APPLIQUE PAS ICI.
     * Le risque est la prise de contrôle par un fournisseur qui NE VÉRIFIE PAS les adresses :
     * on s'inscrirait chez lui avec l'adresse d'autrui, et la liaison donnerait le compte
     * existant. Les deux fournisseurs retenus vérifient l'adresse avant de la publier
     * (Google par construction ; Discord exige la vérification pour utiliser le compte).
     * ⇒ ⚠️ **NE PAS AJOUTER UN TROISIÈME FOURNISSEUR OAUTH AVEC CE DRAPEAU SANS AVOIR VÉRIFIÉ
     * QU'IL VÉRIFIE LES ADRESSES.** C'est la seule condition qui rend ce réglage acceptable,
     * et elle ne se relit pas toute seule.
     */
    Nodemailer({
      from: COMPTE_SMTP,

      // 🔴 `server` EST OBLIGATOIRE À L'EXÉCUTION, MALGRÉ UN TYPE QUI LE DIT FACULTATIF.
      // Défaut trouvé par `next build` et par lui seul — ni le lint ni le typecheck ne
      // voient rien : *« Nodemailer requires a `server` configuration »*, levé pendant la
      // collecte des pages. C'est un rappel utile : `server?` dans un `.d.ts` décrit ce que
      // le TYPE autorise, pas ce que la bibliothèque VÉRIFIE.
      //
      // ⚠️ ET C'EST LA MÊME CONFIGURATION QUE LE TRANSPORT RÉEL, pas une seconde copie —
      // `optionsSmtp()` est écrite une seule fois dans `mail/client.ts`, qui s'en sert aussi.
      // Une copie ici perdrait `requireTLS` au premier écart, sur les envois qui portent des
      // LIENS DE CONNEXION. (`00 référence/pieges/garde-sur-une-copie.md`.)
      server: optionsSmtp(),

      // ⚠️ L'envoi réel ne passe PAS par `server` : on remplace `sendVerificationRequest`,
      // donc c'est le transport singleton de `mail/client.ts` qui écrit sur le réseau.
      sendVerificationRequest: ({ identifier, url, expires }) =>
        envoyerLienMagique({ destinataire: identifier, url, expiration: expires }),
    }),
  ],

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
    // 🔴 SANS CETTE LIGNE, LE LIEN MAGIQUE FINIT SUR UNE PAGE ANGLAISE NON STYLÉE.
    // Auth.js affiche sinon son écran par défaut à `/api/auth/verify-request` — hors du
    // matcher du proxy, donc il s'afficherait bien, mais en anglais et sans la charte, juste
    // après qu'un bénévole a demandé un lien. `sections.ts` ouvre cette route SANS session :
    // celui qui la voit n'est, par définition, pas encore connecté.
    verifyRequest: "/admin/login/verifier",
  },

  // 🔴 `trustHost` EN DUR PLUTÔT QU'EN VARIABLE D'ENVIRONNEMENT — décision de la Story 6.1.
  // En production Auth.js refuse d'inférer l'hôte sans autorisation explicite, et l'échec ne
  // survient QUE en production : impossible à voir en local. La variable `AUTH_TRUST_HOST`
  // ferait le même travail mais pourrait être oubliée sur le VPS. Ce site est self-hosted
  // derrière Traefik **par construction** — il n'existe aucun déploiement de la vitrine où
  // cette valeur devrait être `false`. On la fige donc plutôt que de la confier à un oubli.
  trustHost: true,

  // ══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 IL N'Y A PLUS DE CALLBACK `signIn`, ET C'EST UNE DÉCISION — PAS UN OUBLI
  // ══════════════════════════════════════════════════════════════════════════════════════
  //
  // Jusqu'à la 8.1 il portait la garde la plus importante du projet : FAIL-CLOSED sur
  // `AUTH_ADMIN_DISCORD_IDS`, exécuté AVANT que l'adaptateur n'écrive quoi que ce soit. Se
  // connecter et être administrateur étaient le même fait.
  //
  // La 8.1 sépare les deux, parce qu'il le fallait : attribuer un accès depuis le back-office
  // suppose que la personne ait DÉJÀ pu se connecter (l'œuf et la poule). Un callback qui
  // rendrait `true` dans tous les cas ne serait que du code mort donnant l'illusion d'une
  // garde — on le retire donc, et on écrit ici pourquoi.
  //
  // ⇒ ENTRER NE DONNE RIEN. Les portes sont tenues par `user_role` (`./guard.ts`), et un
  // compte sans rôle ne voit que `/admin/refus`. LE RÔLE NE VIENT JAMAIS DU FOURNISSEUR.
  //
  // ⚠️ CE QUE ÇA COÛTE, ÉCRIT PLUTÔT QUE DÉCOUVERT : n'importe qui peut faire créer une ligne
  // `user` (+ `account`, ou `verification_token` pour un lien magique). C'est une écriture
  // par un inconnu, sans limite de débit. Elle est bornée — aucune de ces lignes ne porte de
  // contenu libre, et aucune n'ouvre de porte. Si ça devenait un problème réel, la parade est
  // une limite de débit sur `/api/auth/*`, PAS le retour d'une allowlist : ce serait refermer
  // la capacité que cette story existe pour livrer.
  callbacks: {
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
