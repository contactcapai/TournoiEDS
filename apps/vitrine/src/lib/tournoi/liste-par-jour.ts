import { jourParis } from "../date-paris";
import { cleanText } from "../text";

/**
 * La liste publique des tournois à venir, groupée PAR JOUR (retour UX du 2026-10-16 : dix
 * tournois de la Game'in Reims sur deux jours faisaient ~6 700 px sur téléphone).
 *
 * Ce qui est COMMUN à tous les tournois d'un jour se dit une fois dans son titre, plus sur
 * chaque carte : la partie du lieu avant « — » et le tarif. ⚠️ Commun veut dire TOUS : un seul
 * tournoi différent, et chaque carte garde son information entière.
 */

const SEPARATEUR_LIEU = " — ";

type TournoiDatable = {
  readonly startsAt: Date;
  readonly venueName: string | null;
  readonly priceText: string | null;
};

export type JourDeTournois<T> = {
  /** `AAAA-MM-JJ`, heure de Paris. */
  jour: string;
  /** La partie du lieu partagée par tous, ou `null`. */
  lieuCommun: string | null;
  /** Le tarif partagé par tous, ou `null`. */
  tarifCommun: string | null;
  tournois: T[];
};

const valeurCommune = (valeurs: readonly (string | null)[]): string | null =>
  valeurs.length > 0 && valeurs[0] !== null && valeurs.every((v) => v === valeurs[0])
    ? valeurs[0]
    : null;

/** Groupe des tournois DÉJÀ triés par date ; l'ordre est conservé dans chaque jour. */
export function groupesParJour<T extends TournoiDatable>(tournois: readonly T[]): JourDeTournois<T>[] {
  const parJour = new Map<string, T[]>();
  for (const tournoi of tournois) {
    const jour = jourParis(tournoi.startsAt);
    parJour.set(jour, [...(parJour.get(jour) ?? []), tournoi]);
  }
  return [...parJour.entries()].map(([jour, liste]) => ({
    jour,
    lieuCommun: valeurCommune(
      liste.map((t) => {
        const lieu = cleanText(t.venueName);
        return lieu?.includes(SEPARATEUR_LIEU) ? lieu.split(SEPARATEUR_LIEU)[0] : lieu;
      }),
    ),
    tarifCommun: valeurCommune(liste.map((t) => cleanText(t.priceText))),
    tournois: liste,
  }));
}

/** Ce qui reste à dire du lieu sur la carte quand le titre du jour en porte la partie commune. */
export function lieuSurLaCarte(venueName: string | null, lieuCommun: string | null): string | null {
  const lieu = cleanText(venueName);
  if (lieu === null || lieuCommun === null) return lieu;
  if (lieu === lieuCommun) return null;
  return lieu.startsWith(lieuCommun + SEPARATEUR_LIEU) ? lieu.slice(lieuCommun.length + SEPARATEUR_LIEU.length) : lieu;
}
