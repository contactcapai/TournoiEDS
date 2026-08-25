// `server-only` en TOUTE PREMIÈRE LIGNE, comme les autres familles de requêtes (garde-fou
// n°1 de la Story 1.7). Ce module lit des comptes : il ne doit jamais atteindre le client.
import "server-only";
import { asc, eq } from "drizzle-orm";

import type { RoleAdmin } from "../../../lib/roles";
import { db } from "../client";
import { account, user, userRole } from "../schema";

/**
 * Lectures de l'écran des accès (Story 8.1).
 *
 * 🔴 ON LISTE TOUS LES COMPTES, PAS SEULEMENT LES ADMINISTRATEURS. Depuis la 8.1, se
 * connecter ne donne rien : quelqu'un à qui on veut ouvrir un accès s'est d'abord connecté,
 * et il apparaît ici SANS AUCUN RÔLE. N'afficher que les comptes déjà pourvus rendrait
 * l'écran incapable de faire la seule chose qu'on lui demande.
 */
export type CompteAvecRoles = {
  id: string;
  nom: string | null;
  email: string | null;
  image: string | null;
  roles: RoleAdmin[];
  /** `null` si le compte n'est pas passé par Discord. Sert à situer le noyau de secours. */
  identifiantDiscord: string | null;
};

/**
 * Tous les comptes et leurs rôles, du plus pourvu au moins pourvu.
 *
 * ⚠️ Une jointure À GAUCHE, jamais une jointure interne : un compte sans rôle est
 * précisément celui qu'on vient chercher ici, et un `INNER JOIN` le ferait disparaître de
 * l'écran censé lui en donner un.
 *
 * ⚠️ L'ORDRE EST TOTAL (`name`, puis `id`) : deux comptes homonymes — banal quand le nom
 * vient d'un pseudo Discord — sortiraient sinon dans un ordre que Postgres ne garantit pas,
 * et les lignes danseraient d'un rechargement à l'autre pendant qu'on coche des cases.
 */
export async function listerComptes(): Promise<CompteAvecRoles[]> {
  const lignes = await db
    .select({
      id: user.id,
      nom: user.name,
      email: user.email,
      image: user.image,
      role: userRole.role,
      identifiantDiscord: account.providerAccountId,
    })
    .from(user)
    .leftJoin(userRole, eq(userRole.userId, user.id))
    .leftJoin(account, eq(account.userId, user.id))
    .orderBy(asc(user.name), asc(user.id));

  const parCompte = new Map<string, CompteAvecRoles>();

  for (const ligne of lignes) {
    const existant = parCompte.get(ligne.id);
    const compte =
      existant ??
      ({
        id: ligne.id,
        nom: ligne.nom,
        email: ligne.email,
        image: ligne.image,
        roles: [],
        identifiantDiscord: ligne.identifiantDiscord,
      } satisfies CompteAvecRoles);

    // La double jointure multiplie les lignes (2 rôles × 1 compte OAuth = 2 lignes) : on
    // dédoublonne ici plutôt que de faire deux requêtes pour une poignée de comptes.
    if (ligne.role !== null && !compte.roles.includes(ligne.role)) compte.roles.push(ligne.role);
    compte.identifiantDiscord ??= ligne.identifiantDiscord;

    parCompte.set(ligne.id, compte);
  }

  return [...parCompte.values()];
}

/** Combien de comptes portent ce rôle — sert la garde anti-verrouillage de `actions/acces.ts`. */
export async function compterPorteursDe(role: RoleAdmin): Promise<number> {
  const lignes = await db.select({ id: userRole.userId }).from(userRole).where(eq(userRole.role, role));
  return lignes.length;
}
