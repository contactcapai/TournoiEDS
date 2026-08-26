"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { exigerConnexionAction, exigerRoleAction } from "../auth/guard";
import { db } from "../db/client";
import { tournament, tournamentEntry, tournamentEntryClaim } from "../db/schema";
import { identifiant, type ResultatAction } from "./_commun";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * RÉCLAMER UNE INSCRIPTION, ET TRANCHER (Story 12.1, 2/2)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 DEUX ACTIONS, DEUX GARDES DIFFÉRENTES, ET C'EST TOUTE LA MÉCANIQUE : le **joueur**
 * demande (`exigerConnexionAction` — il n'a aucun rôle), le **bénévole** tranche
 * (`exigerRoleAction("admin_tournoi")`). Une seule garde pour les deux laisserait soit le
 * joueur s'attribuer l'inscription, soit le bénévole seul capable de demander.
 */

/** Demande le rattachement d'une inscription à SON compte. */
export async function reclamerInscription(entryId: string): Promise<ResultatAction<null>> {
  const compte = await exigerConnexionAction();

  if (!identifiant.safeParse(entryId).success) {
    return { ok: false, error: "Cette inscription n'est pas valide. Rechargez la page." };
  }

  /**
   * 🔴 LES TROIS CONDITIONS SONT RELUES **ICI**, PAS SEULEMENT À L'AFFICHAGE. L'écran ne
   * propose que des inscriptions libres de tournois publiés — mais une Server Action est un
   * POST atteignable directement, et l'écran a pu être composé il y a dix minutes. Sans cette
   * relecture, on réclamerait une inscription déjà rattachée, ou celle d'un brouillon.
   * ⚠️ `isNull(userId)` EST LA CONDITION QUI COMPTE : une inscription déjà rattachée n'est plus
   * réclamable, sinon deux comptes se disputeraient une ligne que le bénévole a déjà tranchée.
   */
  const [inscription] = await db
    .select({ id: tournamentEntry.id })
    .from(tournamentEntry)
    .innerJoin(tournament, eq(tournament.id, tournamentEntry.tournamentId))
    .where(
      and(
        eq(tournamentEntry.id, entryId),
        isNull(tournamentEntry.userId),
        eq(tournament.isPublished, true),
      ),
    )
    .limit(1);

  if (!inscription) {
    return {
      ok: false,
      error:
        "Cette inscription n'est plus disponible : elle a peut-être déjà été rattachée à un " +
        "compte. Rechargez la page.",
    };
  }

  /**
   * ⚠️ `onConflictDoNothing` SUR `(entry_id, user_id)` : un double-clic, ou un retour en
   * arrière du navigateur, ne doit pas créer deux demandes ni lever une erreur à la figure de
   * quelqu'un qui n'a rien fait de mal. Demander deux fois, c'est demander une fois.
   */
  await db
    .insert(tournamentEntryClaim)
    .values({ entryId, userId: compte.utilisateurId })
    .onConflictDoNothing({
      target: [tournamentEntryClaim.entryId, tournamentEntryClaim.userId],
    });

  revalidatePath("/profil");
  return { ok: true, data: null };
}

const decisionSaisie = z.enum(["acceptee", "refusee"]);

/**
 * Tranche une réclamation — **geste de bénévole**.
 *
 * 🔴 L'ACCEPTATION ÉCRIT `tournament_entry.user_id` **SOUS CONDITION QU'IL SOIT ENCORE VIDE**,
 * et la condition est dans le `WHERE`, pas dans un `if` : deux bénévoles peuvent trancher deux
 * réclamations concurrentes sur la MÊME inscription au même instant — c'est le cas d'homonymie
 * que cette story existe pour arbitrer, donc le cas où la course arrive vraiment. Le second
 * `UPDATE` ne touche alors aucune ligne, et l'écran le dit au lieu d'écraser le premier.
 *
 * ⚠️ **REFUSER NE SUPPRIME PAS LA LIGNE** : sans trace, la demande se rejouerait à l'infini et
 * le bénévole reverrait la même à chaque tournoi.
 */
export async function deciderReclamation(
  claimId: string,
  decision: string,
): Promise<ResultatAction<{ rattachee: boolean }>> {
  await exigerRoleAction("admin_tournoi");

  if (!identifiant.safeParse(claimId).success) {
    return { ok: false, error: "Cette demande n'est pas valide. Rechargez la page." };
  }
  const analyse = decisionSaisie.safeParse(decision);
  if (!analyse.success) {
    return { ok: false, error: "Décision inconnue. Rechargez la page." };
  }

  const [demande] = await db
    .select({ entryId: tournamentEntryClaim.entryId, userId: tournamentEntryClaim.userId })
    .from(tournamentEntryClaim)
    .where(
      and(eq(tournamentEntryClaim.id, claimId), eq(tournamentEntryClaim.state, "en_attente")),
    )
    .limit(1);

  if (!demande) {
    return { ok: false, error: "Cette demande a déjà été traitée. Rechargez la page." };
  }

  if (analyse.data === "refusee") {
    await db
      .update(tournamentEntryClaim)
      .set({ state: "refusee", updatedAt: new Date() })
      .where(eq(tournamentEntryClaim.id, claimId));
    revalidatePath("/admin/tournois");
    return { ok: true, data: { rattachee: false } };
  }

  const rattachees = await db
    .update(tournamentEntry)
    .set({ userId: demande.userId, updatedAt: new Date() })
    .where(and(eq(tournamentEntry.id, demande.entryId), isNull(tournamentEntry.userId)))
    .returning({ id: tournamentEntry.id });

  if (rattachees.length === 0) {
    return {
      ok: false,
      error:
        "Cette inscription vient d'être rattachée à un autre compte. La demande reste en " +
        "attente : refusez-la si elle n'est plus justifiée.",
    };
  }

  await db
    .update(tournamentEntryClaim)
    .set({ state: "acceptee", updatedAt: new Date() })
    .where(eq(tournamentEntryClaim.id, claimId));

  revalidatePath("/admin/tournois");
  revalidatePath("/profil");
  return { ok: true, data: { rattachee: true } };
}
