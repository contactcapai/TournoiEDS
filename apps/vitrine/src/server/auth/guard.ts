// `server-only` en TOUTE PREMIÈRE LIGNE : cette garde ne doit exister que côté serveur.
import "server-only";
import { and, eq } from "drizzle-orm";

import { db } from "../db/client";
import { account } from "../db/schema";
import { estAdminAutorise } from "./allowlist";
import { auth } from "./config";

/**
 * 🔴 GARDE D'ÉCRITURE — APPEL OBLIGATOIRE EN PREMIÈRE LIGNE DE TOUTE SERVER ACTION
 * D'ADMINISTRATION (Stories 6.3, 6.4, 6.5, 6.9, 6.10, 6.11, 6.13).
 *
 * Ce n'est pas une ceinture de sécurité en plus du proxy : c'est la SEULE couche qui protège
 * les mutations. Fait mesuré au cadrage de la Story 6.1, tiré de la documentation Next 16
 * (`proxy.js`, § Execution order), cité mot pour mot :
 *
 *   « Server Functions are not separate routes in this chain. They are handled as POST
 *     requests to the route where they are used, so a Proxy matcher that excludes a path
 *     will also skip Proxy coverage. A matcher change or a refactor that moves a Server
 *     Function to a different route can silently remove Proxy coverage. Always verify
 *     authentication and authorization inside each Server Function rather than relying on
 *     Proxy alone. »
 *
 * Autrement dit : le jour où une action est déplacée, réutilisée depuis une surface publique,
 * ou le jour où quelqu'un resserre le matcher du proxy, la garde du proxy disparaît SANS
 * QU'AUCUNE PORTE NE LE DISE — ni lint, ni typecheck, ni build, ni le gate visuel.
 *
 * ⚠️ CE QUI N'EST PAS CONCERNÉ : `submitSolicitation` (Story 5.1) est une Server Action
 * appelée depuis une page PUBLIQUE. Elle ne doit JAMAIS recevoir cette garde — l'autorisation
 * appropriée y est *aucune*, et la lui poser fermerait le formulaire de sollicitation au
 * public (FR28, FR32).
 */

/** Administrateur résolu et re-vérifié pour la requête en cours. */
export type AdminConnecte = {
  /** Identifiant local (table `user`). */
  utilisateurId: string;
  /** Identifiant numérique Discord — la valeur sur laquelle l'allowlist s'est prononcée. */
  identifiantDiscord: string;
  nom: string | null;
  image: string | null;
};

/** Levée quand une Server Action d'administration est atteinte sans droit. */
export class ErreurAccesAdmin extends Error {
  constructor(raison: string) {
    super(`Accès administrateur refusé : ${raison}`);
    this.name = "ErreurAccesAdmin";
  }
}

/**
 * Résout l'administrateur de la requête courante, ou `null`.
 *
 * 🔴 L'ALLOWLIST EST RE-VÉRIFIÉE À CHAQUE REQUÊTE, ET CE N'EST PAS DE LA PARANOÏA.
 * La vérifier uniquement à la connexion (`callbacks.signIn`) laisserait une session déjà
 * ouverte survivre au retrait de son identifiant de l'allowlist — c'est-à-dire qu'un ancien
 * bénévole, ou un compte compromis, garderait l'accès jusqu'à l'expiration naturelle de sa
 * session. Sur un back-office à rôle admin unique (FR27), retirer quelqu'un doit prendre
 * effet à la requête suivante, pas dans trente jours.
 *
 * Le coût est une requête supplémentaire par requête d'administration — négligeable pour un
 * back-office à un utilisateur, et c'est le prix d'une révocation immédiate.
 */
export async function lireAdmin(): Promise<AdminConnecte | null> {
  const sessionCourante = await auth();
  const utilisateurId = sessionCourante?.user?.id;

  if (typeof utilisateurId !== "string" || utilisateurId.length === 0) return null;

  const lignes = await db
    .select({ identifiantDiscord: account.providerAccountId })
    .from(account)
    .where(and(eq(account.userId, utilisateurId), eq(account.provider, "discord")))
    .limit(1);

  const identifiantDiscord = lignes[0]?.identifiantDiscord;
  if (!estAdminAutorise(identifiantDiscord)) return null;

  return {
    utilisateurId,
    // `estAdminAutorise` a déjà écarté `undefined` et la chaîne vide ; le typage ne le sait
    // pas, d'où ce resserrement explicite plutôt qu'une assertion non expliquée.
    identifiantDiscord: identifiantDiscord as string,
    nom: sessionCourante?.user?.name ?? null,
    image: sessionCourante?.user?.image ?? null,
  };
}

/**
 * Exige un administrateur, ou **lève**.
 *
 * 🔴 ELLE LÈVE, ELLE NE RETOURNE PAS `false`. Une garde qui rend un booléen dépend de son
 * appelant pour le tester : l'oublier la rend silencieusement inerte, et rien ne le
 * signalerait. Une exception ne s'oublie pas.
 */
export async function requireAdmin(): Promise<AdminConnecte> {
  const admin = await lireAdmin();
  if (admin === null) {
    throw new ErreurAccesAdmin("session absente, expirée, ou compte hors allowlist");
  }
  return admin;
}
