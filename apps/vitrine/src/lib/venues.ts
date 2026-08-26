import type { RendezVous } from "@/server/db/queries/rendez-vous";

/**
 * Les identifiants d'ÉVÉNEMENT d'une liste de rendez-vous (Story 12.2).
 *
 * ⚠️ **UN RENDEZ-VOUS DE NATURE `tournoi` N'EN A PAS**, et c'est exactement pourquoi cette
 * fonction existe : filtrer à la main dans chaque page produirait deux filtres qui finiraient
 * par différer — et l'un des deux lirait alors les venues d'une liste qui ne les affiche pas.
 * ⚠️ Un événement qui porte des tournois EST un événement : il garde son identifiant, et donc
 * son bouton « J'y serai ».
 */
export function identifiantsDEvenements(rendezVous: readonly RendezVous[]): string[] {
  return rendezVous
    .filter((rdv) => rdv.nature === "evenement")
    .map((rdv) => rdv.evenement.id);
}

/** Ce qu'une ligne doit savoir pour rendre son geste. `undefined` = aucun geste. */
export type EtatDeVenue = { connecte: boolean; jyVais: boolean };

export function etatDeVenue(
  rendezVous: RendezVous,
  connecte: boolean,
  mesVenues: ReadonlySet<string>,
): EtatDeVenue {
  return {
    connecte,
    jyVais: rendezVous.nature === "evenement" && mesVenues.has(rendezVous.evenement.id),
  };
}
