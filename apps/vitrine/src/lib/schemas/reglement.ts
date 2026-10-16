import { z } from "zod";

import { MODELE_NOM_MAX, REGLEMENT_MAX } from "../reglement";
import { texteNettoye, visiblementVide } from "./texte";

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
