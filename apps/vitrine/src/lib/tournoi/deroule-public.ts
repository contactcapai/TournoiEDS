import { SEUIL_VICTOIRE_DEFAUT } from "./finale";
import type { PhaseKind } from "./structure";

/** Une phase telle que sa phrase se dérive : sa nature et ses réglages (`jsonb`, non typé). */
export type PhasePourPhrase = { readonly kind: PhaseKind; readonly settings: unknown };

function reglage(settings: unknown, clef: string): unknown {
  return typeof settings === "object" && settings !== null
    ? (settings as Record<string, unknown>)[clef]
    : undefined;
}

function entier(settings: unknown, clef: string): number | null {
  const brut = reglage(settings, clef);
  return typeof brut === "number" && Number.isInteger(brut) && brut >= 1 ? brut : null;
}

function phrase(phase: PhasePourPhrase, suivante: PhasePourPhrase | undefined, seuil: number) {
  switch (phase.kind) {
    case "poule": {
      const poules = entier(phase.settings, "poules");
      const allerRetour = reglage(phase.settings, "allerRetour") === true ? ", en aller-retour" : "";
      // Le nombre de qualifiés n'existe qu'une fois le tableau suivant tiré : jamais avant.
      const qualifies =
        suivante?.kind === "bracket" && reglage(suivante.settings, "depuis") === "poules"
          ? entier(suivante.settings, "qualifiesParPoule")
          : null;
      const base =
        poules === 1
          ? `Chacun rencontre chacun${allerRetour}`
          : `${poules ? `${poules} poules : c` : "C"}hacun rencontre chacun dans sa poule${allerRetour}`;
      const suite =
        qualifies === null
          ? ""
          : qualifies === 1
            ? ` ; le premier de chaque poule passe au tableau`
            : ` ; les ${qualifies} premiers de chaque poule passent au tableau`;
      return `${base}${suite}. Classement aux victoires.`;
    }
    case "bracket": {
      const double = reglage(phase.settings, "doubleElimination");
      if (double === true) return "Tableau à double élimination : on sort après deux défaites.";
      if (double === false) return "Tableau à élimination directe : le perdant sort.";
      return "Tableau : rencontres deux à deux, le vainqueur avance.";
    }
    case "lobbies": {
      const taille = entier(phase.settings, "tailleDeLobby");
      return `${taille ? `Tables de ${taille} joueurs` : "Plusieurs joueurs par table"}. À chaque manche, le 1er marque autant de points qu'il y a de joueurs à sa table, et chaque place en dessous un point de moins.`;
    }
    case "suisse":
      return "Les tables se refont d'après le classement : chacun rejoue contre son niveau. Même barème de points.";
    case "finale":
      return `Une table, et les points repartent de zéro : pour l'emporter, atteindre ${seuil} points, puis faire un top 1.`;
  }
}

/**
 * Une phrase par phase, dérivée de sa nature et de ses réglages — `null` quand elle répète la
 * phrase de la phase précédente (douze manches suisses ne se décrivent qu'une fois).
 */
export function phrasesDuDeroule(phases: readonly PhasePourPhrase[]): (string | null)[] {
  // Le seuil de la PREMIÈRE manche de finale gouverne tout le bloc (10.14).
  const premiereFinale = phases.find((phase) => phase.kind === "finale");
  const seuil = premiereFinale
    ? (entier(premiereFinale.settings, "seuilDeVictoire") ?? SEUIL_VICTOIRE_DEFAUT)
    : SEUIL_VICTOIRE_DEFAUT;
  const phrases = phases.map((phase, rang) => phrase(phase, phases[rang + 1], seuil));
  return phrases.map((texte, rang) => (rang > 0 && phrases[rang - 1] === texte ? null : texte));
}
