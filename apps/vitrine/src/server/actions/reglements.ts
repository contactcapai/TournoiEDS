"use server";

import { eq } from "drizzle-orm";

import { modeleReglementSchema, reglementTournoiSchema } from "../../lib/schemas/reglement";
import { exigerRoleAction } from "../auth/guard";
import { db } from "../db/client";
import { rulesTemplate, tournament } from "../db/schema";
import { erreursParChamp, identifiant, messageErreurBase, type ResultatAction } from "./_commun";

const CHAMP_PAR_CONTRAINTE: Record<string, string> = {
  rules_template_name_valide: "le nom du modèle",
  rules_template_body_valide: "le texte du modèle",
};

/**
 * Crée ou modifie un modèle de règlement. ⚠️ Les tournois déjà créés n'en dépendent pas :
 * ils portent leur COPIE, et la modifier ici ne change rien à ce que les inscrits ont lu.
 */
export async function enregistrerModeleReglement(
  idExistant: string | null,
  formData: FormData,
): Promise<ResultatAction<{ id: string }>> {
  await exigerRoleAction("admin_tournoi");

  if (idExistant !== null && !identifiant.safeParse(idExistant).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  const analyse = modeleReglementSchema.safeParse({
    name: formData.get("name"),
    body: formData.get("body"),
  });
  if (!analyse.success) {
    return {
      ok: false,
      error: analyse.error.issues[0]?.message ?? "Le formulaire contient une erreur.",
      fieldErrors: erreursParChamp(analyse.error.issues),
    };
  }

  try {
    const [ligne] =
      idExistant === null
        ? await db.insert(rulesTemplate).values(analyse.data).returning({ id: rulesTemplate.id })
        : await db
            .update(rulesTemplate)
            .set(analyse.data)
            .where(eq(rulesTemplate.id, idExistant))
            .returning({ id: rulesTemplate.id });

    if (!ligne) return { ok: false, error: "Ce modèle n'existe plus : il a été supprimé entre-temps." };
    return { ok: true, data: { id: ligne.id } };
  } catch (erreur) {
    if ((erreur as { code?: string }).code === "23505") {
      return {
        ok: false,
        error: "Ce nom est déjà pris.",
        fieldErrors: { name: "Un autre modèle porte déjà ce nom. Choisissez-en un autre." },
      };
    }
    console.error("[enregistrerModeleReglement] Échec de l'enregistrement :", erreur);
    return { ok: false, error: messageErreurBase(erreur, CHAMP_PAR_CONTRAINTE) };
  }
}

export async function supprimerModeleReglement(id: string): Promise<ResultatAction<undefined>> {
  await exigerRoleAction("admin_tournoi");

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [ligne] = await db
      .delete(rulesTemplate)
      .where(eq(rulesTemplate.id, id))
      .returning({ id: rulesTemplate.id });
    if (!ligne) return { ok: false, error: "Ce modèle a déjà été supprimé." };
    return { ok: true, data: undefined };
  } catch (erreur) {
    console.error("[supprimerModeleReglement] Échec de la suppression :", erreur);
    return { ok: false, error: messageErreurBase(erreur, CHAMP_PAR_CONTRAINTE) };
  }
}

/** Enregistre le règlement d'un tournoi — seule colonne touchée, la fiche n'est pas réécrite. */
export async function enregistrerReglementTournoi(
  tournoiId: string,
  formData: FormData,
): Promise<ResultatAction<undefined>> {
  await exigerRoleAction("admin_tournoi");

  if (!identifiant.safeParse(tournoiId).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  const analyse = reglementTournoiSchema.safeParse({ rules: formData.get("rules") });
  if (!analyse.success) {
    return {
      ok: false,
      error: analyse.error.issues[0]?.message ?? "Le règlement contient une erreur.",
      fieldErrors: erreursParChamp(analyse.error.issues),
    };
  }

  try {
    const [ligne] = await db
      .update(tournament)
      .set({ rules: analyse.data.rules })
      .where(eq(tournament.id, tournoiId))
      .returning({ id: tournament.id });
    if (!ligne) return { ok: false, error: "Ce tournoi n'existe plus : il a été supprimé entre-temps." };
    return { ok: true, data: undefined };
  } catch (erreur) {
    console.error("[enregistrerReglementTournoi] Échec de l'enregistrement :", erreur);
    return {
      ok: false,
      error: messageErreurBase(erreur, { tournament_rules_valide: "le règlement" }),
    };
  }
}
