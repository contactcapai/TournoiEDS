"use server";

import { and, eq } from "drizzle-orm";

import { type RoleAdmin, estRoleAdmin } from "../../lib/roles";
import { exigerRoleAction } from "../auth/guard";
import { db } from "../db/client";
import { userRole } from "../db/schema";
import { compterPorteursDe } from "../db/queries/comptes";
import { identifiant, type ResultatAction } from "./_commun";

/**
 * Server Actions de l'attribution des accès (Story 8.1, absorbe l'ex-Story 7.9).
 *
 * `await exigerRoleAction("admin_site")` en PREMIÈRE LIGNE, comme les six autres surfaces
 * d'écriture du back-office.
 *
 * 🔴 CE QUI EST PROPRE À CE DOMAINE : C'EST LE SEUL ÉCRAN QUI PEUT SE FERMER SUR LUI-MÊME.
 * Partout ailleurs, la pire erreur se répare depuis le back-office. Ici, retirer le mauvais
 * rôle retire justement le droit d'entrer pour le réparer. D'où les deux gardes ci-dessous,
 * qui ne sont pas du confort d'écran mais la condition pour que cet écran soit utilisable
 * sans filet.
 */

type Resultat = ResultatAction<{ role: RoleAdmin }>;

function role_invalide(): Resultat {
  return { ok: false, error: "Ce rôle n'existe pas. Rechargez la page." };
}

export async function accorderRole(utilisateurId: string, role: string): Promise<Resultat> {
  const acteur = await exigerRoleAction("admin_site");

  if (!estRoleAdmin(role)) return role_invalide();
  if (!identifiant.safeParse(utilisateurId).success) {
    return { ok: false, error: "Ce compte n'est pas valide. Rechargez la page." };
  }

  try {
    // `onConflictDoNothing` plutôt qu'un test préalable : deux responsables qui cochent la
    // même case en même temps ne doivent pas voir d'erreur — le résultat voulu est atteint.
    await db
      .insert(userRole)
      .values({ userId: utilisateurId, role, grantedBy: acteur.utilisateurId })
      .onConflictDoNothing();
  } catch (erreur) {
    console.error("[acces] échec d'attribution du rôle", erreur);
    return {
      ok: false,
      error: "Ce compte n'existe plus. Rechargez la page pour voir l'état réel.",
    };
  }

  return { ok: true, data: { role } };
}

export async function retirerRole(utilisateurId: string, role: string): Promise<Resultat> {
  const acteur = await exigerRoleAction("admin_site");

  if (!estRoleAdmin(role)) return role_invalide();
  if (!identifiant.safeParse(utilisateurId).success) {
    return { ok: false, error: "Ce compte n'est pas valide. Rechargez la page." };
  }

  /**
   * 🔴 GARDE ① — ON NE SE FERME PAS LA PORTE À SOI-MÊME.
   * Le retrait prend effet à la requête SUIVANTE (les rôles sont relus à chaque requête,
   * jamais portés par la session) : la page qu'on vient de quitter serait la dernière. Ce
   * n'est pas une erreur qu'on répare, c'est une erreur après laquelle on appelle quelqu'un.
   * ⚠️ Elle ne vaut que pour `admin_site` : se retirer `admin_tournoi` est un geste
   * ordinaire, qui ne ferme aucune porte de retour.
   */
  if (role === "admin_site" && utilisateurId === acteur.utilisateurId) {
    return {
      ok: false,
      error:
        "Vous ne pouvez pas retirer votre propre accès à l'administration du site : vous " +
        "n'auriez plus accès à cet écran pour revenir en arrière. Demandez à un autre " +
        "responsable de le faire.",
    };
  }

  /**
   * 🔴 GARDE ② — IL RESTE TOUJOURS AU MOINS UN ADMINISTRATEUR DU SITE.
   * La garde ① seule ne suffit pas : deux responsables peuvent se retirer mutuellement le
   * rôle, et la dernière écriture gagnante laisse la table VIDE. Le back-office ne serait
   * alors plus joignable que par le noyau de secours `AUTH_ADMIN_DISCORD_IDS`, quand il est
   * configuré — c'est-à-dire pas toujours.
   * ⚠️ Ce compte est une LECTURE, pas un verrou : deux retraits vraiment simultanés peuvent
   * encore passer tous les deux. Le noyau de secours reste le filet, et c'est son emploi.
   */
  if (role === "admin_site" && (await compterPorteursDe("admin_site")) <= 1) {
    return {
      ok: false,
      error:
        "C'est le dernier compte qui administre le site : le retirer fermerait le " +
        "back-office à tout le monde. Ouvrez d'abord ce rôle à quelqu'un d'autre.",
    };
  }

  await db
    .delete(userRole)
    .where(and(eq(userRole.userId, utilisateurId), eq(userRole.role, role)));

  return { ok: true, data: { role } };
}
