import type { PhaseKind } from "@/lib/tournoi/structure";

/**
 * Découper un déroulé en JOURNÉES, pour l'affichage (Story 13.1).
 *
 * Une journée est une suite de phases CONSÉCUTIVES qui partagent la même date. La notion vient
 * de la 10.10 (`played_on`) et de la 10.12 (le pointage, dont la clé est la DATE) ; il manquait
 * l'écran qui la donne à lire.
 *
 * 🔴 EXTRAITE PLUTÔT QUE RECOPIÉE, ET C'EST LA LEÇON D'`estParTables()` (10.10) : deux
 * consommateurs la veulent — le déroulé existant et l'APERÇU de l'assistant. Deux copies
 * divergeraient en silence, et le jour où elles divergent, l'aperçu montre une structure et
 * l'écriture en pose une autre. Or c'est exactement ce que l'aperçu est là pour empêcher.
 *
 * 🔴 CONSÉCUTIVES, ET C'EST TOUTE LA GARDE. Rassembler toutes les phases d'une même date où
 * qu'elles soient dans l'ordre RÉORDONNERAIT l'affichage : un déroulé 1 = samedi,
 * 2 = dimanche, 3 = samedi se lirait « 1, 3 » puis « 2 », pendant que les numéros de position
 * et les flèches ↑ ↓ disent l'inverse — un fait faux à l'écran, au pire endroit pour en avoir
 * un. Un même samedi qui revient produit donc deux blocs : c'est ce que le déroulé fait
 * vraiment, et le lisser serait mentir sur l'ordre de jeu.
 *
 * ⚠️ `playedOn` est NULLABLE et le restera : un tournoi d'un seul jour n'a aucune phase datée.
 * Il ressort ici comme un unique groupe à `jour: null` — c'est au rendu de constater qu'un seul
 * groupe ne se nomme pas.
 */
export type PhaseDatable = { playedOn: string | null };

export type Journee<T extends PhaseDatable> = {
  jour: string | null;
  /**
   * L'index GLOBAL dans le déroulé est conservé avec chaque phase : lui seul dit si « monter »
   * ou « descendre » est en bout de liste. Le perdre ferait des flèches actives aux extrémités.
   */
  phases: { phase: T; index: number }[];
};

export function decouperEnJournees<T extends PhaseDatable>(phases: readonly T[]): Journee<T>[] {
  const journees: Journee<T>[] = [];
  phases.forEach((phase, index) => {
    const derniere = journees.at(-1);
    if (derniere && derniere.jour === phase.playedOn) derniere.phases.push({ phase, index });
    else journees.push({ jour: phase.playedOn, phases: [{ phase, index }] });
  });
  return journees;
}

/**
 * Le numéro affiché d'une journée : on ne compte que les journées DATÉES qui précèdent.
 *
 * ⚠️ Un bloc sans jour fixé ne consomme PAS de numéro. Le faire compter ferait sauter
 * « Journée 3 » à « Journée 5 » sans que rien à l'écran n'explique le trou.
 */
export function numeroDeJournee<T extends PhaseDatable>(
  journees: readonly Journee<T>[],
  rang: number,
): number | null {
  if (journees[rang]?.jour === null) return null;
  return journees.slice(0, rang + 1).filter((journee) => journee.jour !== null).length;
}

/** Les phases telles que l'assistant les propose, avant toute écriture (10.10). */
export type PhaseProposee = { name: string; kind: PhaseKind; playedOn: string | null };
