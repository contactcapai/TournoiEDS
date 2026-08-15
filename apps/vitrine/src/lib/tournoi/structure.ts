/**
 * La structure d'un tournoi — phases, engagés, rencontres (Story 10.1).
 *
 * Ce module ne contient que ce qui **ne peut pas** être une contrainte de base : deux règles
 * qui se tiennent à la frontière d'écriture. Tout le reste (non-blanc, bornes, unicité) est
 * dans `server/db/schema.ts`, là où Postgres le fait respecter.
 */

/** Nature d'une phase. `lobbies` = le format TFT actuel, N joueurs par table. */
export const PHASE_KINDS = ["poule", "bracket", "lobbies", "finale"] as const;
export type PhaseKind = (typeof PHASE_KINDS)[number];

/**
 * Cycle de vie d'une phase. Une phase `planifiee` se réécrit librement ; dès qu'un résultat
 * existe elle se fige, et toute modification devient un geste explicite (voir
 * `phaseLibrementModifiable`).
 */
export const PHASE_STATES = ["planifiee", "en_cours", "terminee"] as const;
export type PhaseState = (typeof PHASE_STATES)[number];

/** Le pointage du jour J. Un engagé absent n'est pas supprimé — il est marqué. */
export const ENTRY_STATES = ["inscrit", "present", "absent"] as const;
export type EntryState = (typeof ENTRY_STATES)[number];

export const MATCH_STATES = ["a_jouer", "en_cours", "terminee"] as const;
export type MatchState = (typeof MATCH_STATES)[number];

/**
 * Un engagé porte EXACTEMENT l'effectif annoncé par le tournoi (`teamSize`).
 *
 * 🔴 Cet invariant n'est PAS exprimable par un `CHECK` : il porte sur le NOMBRE de lignes
 * d'une autre table, ce qu'une contrainte de ligne ne peut pas voir. Il se tient donc ici,
 * à la frontière d'écriture, et c'est la seule raison d'être de cette fonction.
 *
 * ⚠️ L'individuel n'est pas un cas à part : c'est une équipe d'un membre (`teamSize` = 1).
 * Un second chemin de code pour « le joueur seul » divergerait en silence.
 *
 * ⚠️ Une équipe incomplète n'est pas un état intermédiaire à modéliser : elle N'ENTRE PAS
 * (arbitrage 2026-08-13 — c'est MATELY qui compose les équipes, pas nous).
 */
export const effectifConforme = (nombreDeMembres: number, teamSize: number) =>
  Number.isInteger(nombreDeMembres) && nombreDeMembres === teamSize;

/**
 * Une phase se réécrit librement TANT QU'AUCUNE rencontre n'a de résultat.
 *
 * 🔴 Le témoin est le RÉSULTAT, jamais l'état déclaré de la phase : l'état est saisi, le
 * résultat est un fait. Se fier à `state === "planifiee"` laisserait effacer des scores en
 * remettant la phase à `planifiee`.
 *
 * Le pointage révèle la réalité (4 équipes prévues, 3 présentes) et la structure doit pouvoir
 * être refaite entre le pointage et le coup d'envoi — c'est exactement ce que cette règle
 * autorise, et ce qu'elle cesse d'autoriser dès la première rencontre jouée.
 */
export const phaseLibrementModifiable = (
  rencontres: readonly { readonly aUnResultat: boolean }[],
) => rencontres.every((r) => !r.aUnResultat);
