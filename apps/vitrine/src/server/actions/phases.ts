"use server";

import { and, asc, eq, gt, lt, sql } from "drizzle-orm";

import { derouleType, derouleTypeSaisi, phaseSaisie } from "../../lib/schemas/phase";
import { requireAdmin } from "../auth/guard";
import { db } from "../db/client";
import { getPhasesForTournament } from "../db/queries/phases";
import { tournamentPhase } from "../db/schema";
import {
  erreursParChamp,
  identifiant,
  messageErreurBase as traduireErreurBase,
  type ResultatAction,
} from "./_commun";

/**
 * Les CHECK de `tournament_phase` traduits pour un benevole. Zod devrait les avoir devances ;
 * si l un d eux tire quand meme, c est un chemin qui le contourne — d ou le console.error.
 */
const CONTRAINTES: Record<string, string> = {
  tournament_phase_name_non_blanc: "Donnez un nom lisible a cette phase.",
  tournament_phase_position_positive: "Le rang de cette phase est invalide. Rechargez la page.",
  tournament_phase_ordre_unique: "Deux phases occupent le meme rang. Rechargez la page.",
};

/**
 * Server Actions de la composition d'un tournoi (Story 10.4).
 *
 * Patron d'`actions/ateliers.ts` : `await requireAdmin()` en PREMIÈRE LIGNE, retour discriminé,
 * `identifiant` sur tout `id` reçu. Pas de média, donc pas de nettoyage de fichier.
 *
 * 🔴 CE QUI EST PROPRE À CET ÉCRAN : une phase ne se supprime ni ne se déplace dès qu'une
 * rencontre a un résultat. Le témoin est le RÉSULTAT et jamais l'état déclaré de la phase —
 * sinon il suffirait de la repasser à « planifiée » pour effacer des scores.
 */

/** Vide ⇒ `null`. La chaîne n'est jamais convertie en `Date` : voir `schemas/phase.ts`. */
const jourOptionnel = (valeur: FormDataEntryValue | null): string | null => {
  const texte = String(valeur ?? "").trim();
  return texte.length === 0 ? null : texte;
};

/** Le rang libre suivant. Calculé en base pour ne pas dépendre d'une lecture périmée. */
const prochainePosition = async (tournoiId: string) => {
  const [ligne] = await db
    .select({ max: sql<number | null>`max(${tournamentPhase.position})`.mapWith(Number) })
    .from(tournamentPhase)
    .where(eq(tournamentPhase.tournamentId, tournoiId));
  return (ligne?.max ?? 0) + 1;
};

export async function ajouterPhase(
  tournoiId: string,
  donnees: FormData,
): Promise<ResultatAction<{ id: string }>> {
  await requireAdmin();

  if (!identifiant.safeParse(tournoiId).success) {
    return { ok: false, error: "Ce tournoi n'est pas valide. Rechargez la page." };
  }

  const analyse = phaseSaisie.safeParse({
    name: donnees.get("name"),
    kind: donnees.get("kind"),
    // Un `<input type="date">` vide poste la chaîne VIDE, pas `null` : sans ce repli, la
    // validation refuserait un jour facultatif qu'on a simplement laissé tranquille.
    playedOn: jourOptionnel(donnees.get("playedOn")),
  });
  if (!analyse.success) {
    return { ok: false, error: "Vérifiez la saisie.", fieldErrors: erreursParChamp(analyse.error.issues) };
  }

  try {
    const [ligne] = await db
      .insert(tournamentPhase)
      .values({
        tournamentId: tournoiId,
        position: await prochainePosition(tournoiId),
        name: analyse.data.name,
        kind: analyse.data.kind,
        playedOn: analyse.data.playedOn,
      })
      .returning({ id: tournamentPhase.id });

    return { ok: true, data: { id: ligne.id } };
  } catch (erreur) {
    console.error("[ajouterPhase] Échec de l'écriture :", erreur);
    return { ok: false, error: traduireErreurBase(erreur, CONTRAINTES) };
  }
}

/**
 * Supprime une phase — refusé dès qu'une rencontre a un résultat.
 *
 * ⚠️ La suppression détruit les rencontres de la phase (`CASCADE`, Story 10.1). C'est
 * précisément pourquoi la garde ci-dessous n'est pas décorative.
 */
export async function supprimerPhase(id: string): Promise<ResultatAction<undefined>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [phase] = await db
      .select({ tournoi: tournamentPhase.tournamentId })
      .from(tournamentPhase)
      .where(eq(tournamentPhase.id, id));
    if (!phase) return { ok: false, error: "Cette phase a déjà été supprimée." };

    const phases = await getPhasesForTournament(phase.tournoi);
    const cible = phases.find((p) => p.id === id);
    if (cible && !cible.librementModifiable) {
      return {
        ok: false,
        error:
          "Cette phase a déjà des résultats : elle ne se supprime plus. " +
          "Corrigez les rencontres concernées, ou créez une phase supplémentaire.",
      };
    }

    await db.delete(tournamentPhase).where(eq(tournamentPhase.id, id));
    return { ok: true, data: undefined };
  } catch (erreur) {
    console.error("[supprimerPhase] Échec de la suppression :", erreur);
    return { ok: false, error: traduireErreurBase(erreur, CONTRAINTES) };
  }
}

/**
 * Déplace une phase d'un rang.
 *
 * 🔴 ÉCHANGE EN TROIS ÉCRITURES, DANS UNE TRANSACTION. `tournament_phase_ordre_unique` interdit
 * deux phases au même rang : écrire directement `a.position = b.position` violerait l'index
 * AVANT que le second `UPDATE` ne rétablisse l'ordre. Il faut donc garer la première sur un
 * rang libre, puis échanger.
 *
 * ⚠️ **LE TAMPON EST POSITIF, ET CE N'EST PAS UN DÉTAIL.** Le réflexe est de garer sur `-1` ou
 * `0` ; le `CHECK` `tournament_phase_position_positive` (`position >= 1`) le REFUSERAIT, et le
 * déplacement échouerait en bloc. On se gare donc **au-dessus du dernier rang**.
 */
export async function deplacerPhase(
  id: string,
  sens: "monter" | "descendre",
): Promise<ResultatAction<undefined>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [phase] = await db
      .select({
        tournoi: tournamentPhase.tournamentId,
        position: tournamentPhase.position,
      })
      .from(tournamentPhase)
      .where(eq(tournamentPhase.id, id));
    if (!phase) return { ok: false, error: "Cette phase n'existe plus. Rechargez la page." };

    const [voisine] = await db
      .select({ id: tournamentPhase.id, position: tournamentPhase.position })
      .from(tournamentPhase)
      .where(
        and(
          eq(tournamentPhase.tournamentId, phase.tournoi),
          sens === "monter"
            ? lt(tournamentPhase.position, phase.position)
            : gt(tournamentPhase.position, phase.position),
        ),
      )
      .orderBy(
        sens === "monter"
          ? sql`${tournamentPhase.position} desc`
          : asc(tournamentPhase.position),
      )
      .limit(1);

    // Aux extrémités il n'y a rien à faire, et ce n'est pas une erreur : l'écran désactive
    // déjà la flèche, mais deux onglets ouverts suffisent à ce que le cas arrive.
    if (!voisine) return { ok: true, data: undefined };

    const tampon = await prochainePosition(phase.tournoi);

    await db.transaction(async (tx) => {
      await tx
        .update(tournamentPhase)
        .set({ position: tampon })
        .where(eq(tournamentPhase.id, id));
      await tx
        .update(tournamentPhase)
        .set({ position: phase.position })
        .where(eq(tournamentPhase.id, voisine.id));
      await tx
        .update(tournamentPhase)
        .set({ position: voisine.position })
        .where(eq(tournamentPhase.id, id));
    });

    return { ok: true, data: undefined };
  } catch (erreur) {
    console.error("[deplacerPhase] Échec du déplacement :", erreur);
    return { ok: false, error: traduireErreurBase(erreur, CONTRAINTES) };
  }
}

/**
 * Pose un déroulé TFT complet d'un coup — l'assistant (2026-08-24).
 *
 * 🔴 IL NE S'APPLIQUE QUE SUR UN DÉROULÉ VIDE, ET C'EST CE QUI LE REND SÛR. Compléter un
 * déroulé existant demanderait de deviner si la manche posée doit partir du classement ou de
 * l'ordre de saisie, où l'insérer, et quoi faire des dates déjà là. Un point de DÉPART se
 * raisonne ; un ajout au milieu se devine — et ce qu'on devine ici s'écrit en base.
 *
 * ⚠️ TOUT OU RIEN : une transaction. Un déroulé à moitié posé serait pire que pas de déroulé —
 * il faudrait deviner ce qui manque avant de recommencer.
 */
export async function poserDerouleType(
  tournoiId: string,
  donnees: FormData,
): Promise<ResultatAction<{ posees: number }>> {
  await requireAdmin();

  if (!identifiant.safeParse(tournoiId).success) {
    return { ok: false, error: "Ce tournoi n'est pas valide. Rechargez la page." };
  }

  const analyse = derouleTypeSaisi.safeParse({
    journees: entierSaisi(donnees.get("journees")),
    manchesParJournee: entierSaisi(donnees.get("manchesParJournee")),
    premierJour: jourOptionnel(donnees.get("premierJour")),
    finale: donnees.get("finale") === "true",
  });
  if (!analyse.success) {
    return {
      ok: false,
      error: analyse.error.issues[0]?.message ?? "Vérifiez les réglages.",
      fieldErrors: erreursParChamp(analyse.error.issues),
    };
  }

  // 🔴 LA GARDE EST LUE ICI **ET** TENUE PAR LE `WHERE` DE L'ÉCRITURE (voir plus bas) : cette
  // lecture existe pour le MESSAGE, pas pour la sûreté.
  const existantes = await getPhasesForTournament(tournoiId);
  if (existantes.length > 0) {
    return {
      ok: false,
      error:
        `Ce tournoi a déjà ${existantes.length} phase${existantes.length > 1 ? "s" : ""}. ` +
        "L'assistant ne sert qu'à partir de zéro : supprimez le déroulé existant, ou ajoutez " +
        "vos phases une par une.",
    };
  }

  const aPoser = derouleType(analyse.data);

  try {
    await db.transaction(async (tx) => {
      // ⚠️ La condition « aucune phase » est REPOSÉE dans la transaction, sur la base et non
      // sur la lecture d'avant : deux clics rapides poseraient sinon deux déroulés l'un sur
      // l'autre, et `tournament_phase_ordre_unique` ne les distinguerait même pas puisque les
      // positions repartiraient de 1. Défaut de la même famille que celui mesuré en 6.4.
      const [dejaLa] = await tx
        .select({ nombre: sql<number>`count(*)`.mapWith(Number) })
        .from(tournamentPhase)
        .where(eq(tournamentPhase.tournamentId, tournoiId));
      if ((dejaLa?.nombre ?? 0) > 0) {
        throw new Error("DEROULE_DEJA_POSE");
      }

      await tx.insert(tournamentPhase).values(
        aPoser.map((phase, index) => ({
          tournamentId: tournoiId,
          position: index + 1,
          name: phase.name,
          kind: phase.kind,
          playedOn: phase.playedOn,
        })),
      );
    });

    return { ok: true, data: { posees: aPoser.length } };
  } catch (erreur) {
    if (erreur instanceof Error && erreur.message === "DEROULE_DEJA_POSE") {
      return {
        ok: false,
        error:
          "Un déroulé vient d'être posé sur ce tournoi. Rechargez la page pour le voir — rien " +
          "n'a été écrit en double.",
      };
    }
    console.error("[poserDerouleType] Échec de l'écriture :", erreur);
    return { ok: false, error: traduireErreurBase(erreur, CONTRAINTES) };
  }
}

/** Comme `entierOptionnel` des tournois : vide ⇒ `NaN`, pour que le message soit le nôtre. */
function entierSaisi(valeur: FormDataEntryValue | null): number {
  const texte = String(valeur ?? "").trim();
  if (!/^\d+$/.test(texte)) return Number.NaN;
  return Number(texte);
}
