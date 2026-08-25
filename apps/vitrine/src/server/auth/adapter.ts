import "server-only";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { Adapter } from "next-auth/adapters";

import { dbReel } from "../db/client";
import { account, session, user, verificationToken } from "../db/schema";

/**
 * Adaptateur Drizzle d'Auth.js, construit PARESSEUSEMENT (Story 6.1).
 *
 * 🔴 POURQUOI CETTE INDIRECTION — DÉFAUT RÉEL, ATTRAPÉ PAR `next build`.
 * `DrizzleAdapter(db, …)` choisit son dialecte immédiatement, par `is(db, PgDatabase)`.
 * Appelée sur le Proxy paresseux de `db/client.ts`, la détection échoue et l'adaptateur
 * lève `Unsupported database type (object)` — **au chargement du module**, donc pendant la
 * collecte des pages de `next build`. Message d'erreur mesuré, pas supposé.
 *
 * Deux issues étaient possibles, et une seule respecte le projet :
 *   ❌ passer l'instance réelle directement → la connexion serait construite à l'import,
 *      `next build` exigerait `DATABASE_URL`, et la CI tourne SANS secret (Garde-fou n°1
 *      et n°2 de la Story 1.7). C'est le garde-fou central de la couche données : on ne le
 *      sacrifie pas pour la commodité d'une bibliothèque.
 *   ✅ retarder la construction de l'adaptateur jusqu'au premier appel de méthode — c'est
 *      ce que fait le Proxy ci-dessous. À ce moment-là on est dans une vraie requête
 *      d'authentification, `dbReel()` peut ouvrir la connexion, et `is()` reçoit une
 *      véritable `PgDatabase`.
 *
 * ⚠️ Même patron que le Proxy de `db/client.ts` — c'est délibérément le MÊME montage, pour
 * que le lecteur n'ait qu'une idée à comprendre au lieu de deux.
 */
let adaptateurResolu: Adapter | undefined;

function resoudre(): Adapter {
  adaptateurResolu ??= DrizzleAdapter(dbReel(), {
    // 🔴 Tables passées EXPLICITEMENT : sans elles, l'adaptateur bâtirait ses propres
    // tables, absentes de `schema.ts`, donc SANS migration — l'échec n'apparaîtrait qu'au
    // premier login. Voir le bloc de commentaire de `db/schema.ts`.
    usersTable: user,
    accountsTable: account,
    sessionsTable: session,
    // 🔴 AJOUTÉE PAR LA STORY 8.1 (PR ②) — SANS ELLE, LE LIEN MAGIQUE ÉCRIRAIT AILLEURS.
    // C'est le cas exact que le commentaire ci-dessus décrit : l'adaptateur ne se plaint pas
    // d'une table absente, il en bâtit une à lui (`verificationToken`, en camelCase, hors de
    // nos migrations). Rien ne le dirait avant le premier « envoyez-moi un lien ».
    verificationTokensTable: verificationToken,
  });
  return adaptateurResolu;
}

/**
 * 🔴 QUATRE PIÈGES, PAS SEULEMENT `get` — DÉFAUT RÉEL TROUVÉ PAR `gate:admin`, ET PAR ELLE
 * SEULE. Une première version n'implémentait que `get`, comme le Proxy de `db/client.ts`.
 * Tout était vert — lint, typecheck, `next build`, et les six autres gardes de cette porte —
 * mais `/api/auth/csrf` répondait **500** :
 *
 *   [auth][error] MissingAdapterMethods: Required adapter methods were missing:
 *   createUser, getUser, getUserByEmail, getUserByAccount, updateUser, linkAccount,
 *   createSession, getSessionAndUser, updateSession, deleteSession
 *
 * Auth.js valide la complétude de l'adaptateur par un test d'APPARTENANCE (`"createUser" in
 * adapter`), pas par une lecture. Or `in` déclenche le piège `has`, absent : il retombait
 * donc sur la cible du Proxy — un objet vide — et Auth.js concluait que l'adaptateur ne
 * savait rien faire. `get` seul ne suffit pas dès qu'une bibliothèque INSPECTE l'objet au
 * lieu de simplement le lire.
 *
 * ⚠️ Conséquence à retenir pour les prochains montages paresseux du projet : `db/client.ts`
 * n'a besoin que de `get` parce que Drizzle ne fait que lire des méthodes. Ce n'est pas une
 * règle générale, et le supposer coûte un 500 que seule une requête réelle révèle.
 */
export const adaptateurDrizzle = new Proxy({} as Adapter, {
  get: (_cible, propriete) => {
    const valeur = resoudre()[propriete as keyof Adapter];
    // Les méthodes de l'adaptateur se ferment sur leur `client` et n'utilisent pas `this`
    // (vérifié dans `@auth/drizzle-adapter/lib/pg.js`). Le `bind` est là par sûreté : si une
    // version future s'y mettait, l'oubli produirait un `undefined` au moment de l'écriture,
    // c'est-à-dire au pire endroit.
    //
    // ⚠️ Précision apportée après revue (Edge Case Hunter) : si une version future RETIRAIT
    // une méthode qu'Auth.js appelle, le symptôme ne serait PAS le `MissingAdapterMethods`
    // lisible décrit plus bas — ce message-là ne sort que du piège `has`, à l'assertion de
    // configuration. Un appel direct sur une méthode absente donnerait un `TypeError` brut.
    return typeof valeur === "function" ? valeur.bind(resoudre()) : valeur;
  },

  // `"createUser" in adaptateur` — c'est le test qu'Auth.js fait réellement.
  has: (_cible, propriete) => propriete in resoudre(),

  // `Object.keys(adaptateur)` et la décomposition `{ ...adaptateur }`. Les deux traps
  // suivants vont ENSEMBLE : `ownKeys` seul ne suffit pas à `Object.keys`, qui filtre
  // ensuite sur le caractère énumérable via `getOwnPropertyDescriptor`.
  ownKeys: () => Reflect.ownKeys(resoudre()),

  getOwnPropertyDescriptor: (_cible, propriete) => {
    const descripteur = Reflect.getOwnPropertyDescriptor(resoudre(), propriete);
    if (descripteur === undefined) return undefined;
    // `configurable: true` est OBLIGATOIRE : la cible du Proxy ne possède pas ces
    // propriétés, et un descripteur non configurable violerait un invariant des Proxy —
    // ce qui lèverait un `TypeError` à la place du comportement attendu.
    return { ...descripteur, configurable: true };
  },
});
