import { z } from "zod";

import { MODELE_NOM_MAX, REGLEMENT_MAX, trousDu } from "../reglement";
import { texteNettoye, texteOptionnel, visiblementVide } from "./texte";

const texteObligatoire = (max: number, libelle: string) =>
  texteNettoye
    .refine((value) => !visiblementVide(value), { message: `${libelle} est obligatoire.` })
    .refine((value) => value.length <= max, {
      message: `${libelle} ne peut pas dépasser ${max} caractères.`,
    });

/** Un modèle de règlement. Ses trous `{{…}}` sont voulus : c'est le tournoi qui les refuse. */
export const modeleReglementSchema = z.object({
  name: texteObligatoire(MODELE_NOM_MAX, "Le nom du modèle"),
  body: texteObligatoire(REGLEMENT_MAX, "Le texte du modèle"),
});

/** Le règlement d'un tournoi : facultatif, mais jamais avec un trou `{{…}}` restant. */
export const reglementTournoiSchema = z.object({
  rules: texteOptionnel(REGLEMENT_MAX, "Le règlement").superRefine((valeur, ctx) => {
    // Un trou laissé tel quel s'afficherait au public : « {{places}} joueurs maximum ».
    const trous = valeur === null ? [] : trousDu(valeur);
    if (trous.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: `Le règlement contient encore des informations à compléter : ${trous
          .map((trou) => `« {{${trou}}} »`)
          .join(", ")}. Remplacez-les par la bonne valeur, ou retirez la phrase.`,
      });
    }
  }),
});
