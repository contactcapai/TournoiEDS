"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { exigerConnexionAction } from "../auth/guard";
import { db } from "../db/client";
import { event, eventAttendance } from "../db/schema";
import { identifiant, type ResultatAction } from "./_commun";

/**
 * Annoncer sa venue, ou se dédire (Story 12.2).
 *
 * 🔴 **UNE SEULE ACTION QUI BASCULE**, et non deux. Le geste est symétrique — on vient ou on ne
 * vient plus — et deux actions laisseraient l'écran choisir laquelle appeler d'après un état
 * qu'il a lu **avant** le clic. Sur un rendez-vous ouvert dans deux onglets, il se tromperait.
 * ⚠️ C'est donc la BASE qui décide : la ligne existe ⇒ on la retire, sinon on l'ajoute.
 *
 * ⚠️ **`exigerConnexionAction`, PAS UN RÔLE** : c'est le geste d'un participant, et c'est même
 * la première raison qu'il a d'avoir un compte.
 */
export async function basculerMaVenue(
  evenementId: string,
): Promise<ResultatAction<{ jyVais: boolean }>> {
  const compte = await exigerConnexionAction();

  if (!identifiant.safeParse(evenementId).success) {
    return { ok: false, error: "Ce rendez-vous n'est pas valide. Rechargez la page." };
  }

  /**
   * 🔴 L'ÉVÉNEMENT DOIT ÊTRE **PUBLIÉ**, ET LA CONDITION EST RELUE ICI. L'écran ne montre que
   * des rendez-vous publiés — mais une Server Action est un POST atteignable directement, et
   * s'annoncer à un brouillon apprendrait son existence à qui n'a rien à en savoir. La garde
   * ne peut pas vivre dans l'écran.
   */
  const [rendezVous] = await db
    .select({ id: event.id })
    .from(event)
    .where(and(eq(event.id, evenementId), eq(event.isPublished, true)))
    .limit(1);

  if (!rendezVous) {
    return { ok: false, error: "Ce rendez-vous n'existe plus. Rechargez la page." };
  }

  const retirees = await db
    .delete(eventAttendance)
    .where(
      and(
        eq(eventAttendance.eventId, evenementId),
        eq(eventAttendance.userId, compte.utilisateurId),
      ),
    )
    .returning({ eventId: eventAttendance.eventId });

  if (retirees.length > 0) {
    revalidatePath("/agenda");
    revalidatePath("/");
    return { ok: true, data: { jyVais: false } };
  }

  /**
   * ⚠️ `onConflictDoNothing` MALGRÉ LE `DELETE` QUI PRÉCÈDE : entre les deux, un second onglet
   * peut avoir inséré la même ligne. La clé primaire composite l'interdit en base — autant ne
   * pas transformer une course bénigne en erreur à la figure de quelqu'un.
   */
  await db
    .insert(eventAttendance)
    .values({ eventId: evenementId, userId: compte.utilisateurId })
    .onConflictDoNothing();

  revalidatePath("/agenda");
  revalidatePath("/");
  return { ok: true, data: { jyVais: true } };
}
