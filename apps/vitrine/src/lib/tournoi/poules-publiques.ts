import { rangsParPoule, type RencontreDePoule } from "./parcours";
import type { EntryState } from "./structure";

/** Une ligne du classement public d'une poule. `nom` à `null` = place sans nom publiable. */
export type LigneDePoule = {
  id: string;
  rang: number;
  nom: string | null;
  victoires: number;
  difference: number;
  qualifie: boolean;
};

export type PoulePublique = { poule: number | null; terminee: boolean; lignes: LigneDePoule[] };

/**
 * Le classement de chaque poule, tel que le moteur le range (`rangsParPoule`, jamais un second
 * classement). « Qualifié » ne se dit que poule terminée ET tableau tiré : c'est un fait, pas un
 * pronostic. Un engagé non présent n'est nommé que s'il a un résultat (règle 14.3).
 */
export function poulesPubliques(
  rencontres: readonly RencontreDePoule[],
  engages: ReadonlyMap<string, { nom: string; etat: EntryState }>,
  qualifies: ReadonlySet<string>,
): PoulePublique[] {
  const noms = new Map([...engages].map(([id, engage]) => [id, engage.nom]));
  const decoupee = rencontres.some((r) => r.pool !== null);

  return [...rangsParPoule(rencontres, noms).entries()].map(([poule, rangs]) => {
    const siennes = rencontres.filter((r) => (r.pool ?? 1) === poule);
    const terminee = siennes.length > 0 && siennes.every((r) => r.issue.complete);
    const difference = new Map<string, number>();
    const aUnResultat = new Set<string>();
    for (const rencontre of siennes) {
      // Même règle que le moteur : un forfait est un résultat, mais ne compte pas dans la différence.
      if (rencontre.places.some((p) => p.forfait === true)) {
        for (const p of rencontre.places) if (p.entryId !== null) aUnResultat.add(p.entryId);
        continue;
      }
      const total = rencontre.places.reduce((somme, p) => somme + (p.score ?? 0), 0);
      for (const place of rencontre.places) {
        if (place.entryId === null || place.score === null) continue;
        aUnResultat.add(place.entryId);
        const ecart = place.score - (total - place.score);
        difference.set(place.entryId, (difference.get(place.entryId) ?? 0) + ecart);
      }
    }

    return {
      poule: decoupee ? poule : null,
      terminee,
      lignes: rangs.map((ligne) => {
        const engage = engages.get(ligne.id);
        const nommable = engage?.etat === "present" || aUnResultat.has(ligne.id);
        return {
          id: ligne.id,
          rang: ligne.rang,
          nom: nommable ? (engage?.nom ?? null) : null,
          victoires: ligne.profondeur ?? 0,
          difference: difference.get(ligne.id) ?? 0,
          qualifie: terminee && qualifies.has(ligne.id),
        };
      }),
    };
  });
}
