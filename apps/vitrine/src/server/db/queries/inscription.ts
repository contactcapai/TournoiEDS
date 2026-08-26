import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import type { PseudosDuProfil } from "../../../lib/tournoi/plateforme";
import { db } from "../client";
import { tournamentEntry, userProfile } from "../schema";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LA FICHE DOIT SAVOIR POUR PROPOSER DE S'INSCRIRE (Story 12.3)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ **AUCUN FILTRE `is_published` ICI, ET CE N'EST PAS UN OUBLI** — contrairement aux lectures
 * de l'Epic 14, qui refiltrent la publication sur une jointure. Celle-ci ne rend **aucun contenu
 * de tournoi** : un décompte, et l'inscription du demandeur lui-même. Elle ne peut donc rien
 * divulguer d'un brouillon, et son unique appelant est une page qui a **déjà** obtenu son
 * tournoi par `getTournamentBySlug` — c'est-à-dire filtré.
 * 🔴 La garde qui compte vit dans **l'action** (`actions/inscription.ts`), qui relit la
 * publication et l'état du tournoi : une Server Action est un POST atteignable directement,
 * l'écran ne peut pas la porter.
 */

/** Le décompte, l'inscription du demandeur, et ses pseudos déclarés. */
export type EtatInscription = {
  /**
   * Combien de places sont prises, **toutes sources confondues** — saisie bénévole comprise.
   *
   * 🔴 ON COMPTE **TOUTES** LES LIGNES, SANS REGARDER L'ÉTAT. Une place occupée par quelqu'un
   * qui sera finalement `absent` reste une place occupée tant que personne ne l'a retirée : la
   * capacité borne des **chaises**, pas des présences. Filtrer sur `inscrit` ferait rouvrir des
   * places le jour du pointage, c'est-à-dire au pire moment.
   */
  readonly inscrits: number;
  /** L'inscription rattachée au compte connecté, s'il en a une sur ce tournoi. */
  readonly mienne: { readonly id: string; readonly displayName: string } | null;
  /** Ses identifiants déclarés, pour pré-remplir le champ — `null` s'il n'est pas connecté. */
  readonly profil: PseudosDuProfil | null;
};

export async function getEtatInscription(
  tournoiId: string,
  utilisateurId: string | null,
): Promise<EtatInscription> {
  const [decompte] = await db
    .select({ nombre: sql<number>`count(*)`.mapWith(Number) })
    .from(tournamentEntry)
    .where(eq(tournamentEntry.tournamentId, tournoiId));

  const inscrits = decompte?.nombre ?? 0;

  // ⚠️ **LE COÛT NE TOMBE QUE SUR LES CONNECTÉS**, patron du chrome public de la 12.1 : un
  // visiteur anonyme ne déclenche aucune des deux lectures qui suivent.
  if (utilisateurId === null) return { inscrits, mienne: null, profil: null };

  const [mienne] = await db
    .select({ id: tournamentEntry.id, displayName: tournamentEntry.displayName })
    .from(tournamentEntry)
    .where(
      and(
        eq(tournamentEntry.tournamentId, tournoiId),
        eq(tournamentEntry.userId, utilisateurId),
      ),
    )
    .limit(1);

  const [profil] = await db
    .select({
      pseudo: userProfile.pseudo,
      riotId: userProfile.riotId,
      steamId: userProfile.steamId,
      epicId: userProfile.epicId,
    })
    .from(userProfile)
    .where(eq(userProfile.userId, utilisateurId))
    .limit(1);

  return {
    inscrits,
    mienne: mienne ?? null,
    // ⚠️ Un compte sans ligne de profil n'est pas une anomalie, c'est l'état de départ — on rend
    // un profil VIDE plutôt que `null`, patron `lireProfilComplet`.
    profil: profil ?? { pseudo: null, riotId: null, steamId: null, epicId: null },
  };
}

/**
 * Le nombre de places occupées, **lu dans une transaction déjà verrouillée**.
 *
 * 🔴 ELLE EXISTE SÉPARÉMENT DE `getEtatInscription` PARCE QU'ELLE PREND UNE TRANSACTION. Compter
 * hors de la transaction qui écrit rendrait le verrou décoratif : deux inscriptions concurrentes
 * liraient toutes deux « il reste une place ». Voir `pieges/concurrence-lock.md`.
 */
export async function compterEngagesDansTransaction(
  tx: Pick<typeof db, "select">,
  tournoiId: string,
): Promise<number> {
  const [ligne] = await tx
    .select({ nombre: sql<number>`count(*)`.mapWith(Number) })
    .from(tournamentEntry)
    .where(eq(tournamentEntry.tournamentId, tournoiId));

  return ligne?.nombre ?? 0;
}

/**
 * Retire l'inscription **prise sur ce site** par ce compte — et ne touche à rien d'autre.
 *
 * 🔴 `external_id IS NULL` EST UNE GARDE DE PRÉSÉANCE, PAS UNE PRÉCAUTION. L'arbitrage du
 * 2026-08-25 pose que **MATELY fait foi jusqu'au pointage** : supprimer localement une
 * inscription venue de chez eux serait réécrit à la re-synchro suivante (11.2), donc une
 * annulation qui « marche » et revient. On refuse plutôt que de promettre.
 *
 * ⚠️ **AUCUNE LECTURE PRÉALABLE**, et c'est le point : la condition vit **dans le `WHERE`**, donc
 * deux onglets qui annulent en même temps ne peuvent pas supprimer deux fois. Le nombre de lignes
 * rendues est la réponse — patron de l'acceptation d'une réclamation (12.1).
 * ⚠️ Le refus de la base quand une place de rencontre existe (`ON DELETE RESTRICT`, 10.1) n'est
 * PAS doublé ici : on le laisse tirer et on le **traduit**, exactement comme `supprimerEngage`.
 */
export async function retirerMonInscription(
  tournoiId: string,
  utilisateurId: string,
): Promise<number> {
  const retirees = await db
    .delete(tournamentEntry)
    .where(
      and(
        eq(tournamentEntry.tournamentId, tournoiId),
        eq(tournamentEntry.userId, utilisateurId),
        isNull(tournamentEntry.externalId),
      ),
    )
    .returning({ id: tournamentEntry.id });

  return retirees.length;
}
