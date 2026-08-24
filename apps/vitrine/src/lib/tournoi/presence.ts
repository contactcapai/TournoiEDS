import type { EntryState } from "./structure";

/**
 * Est-ce que cet engagé joue **ce jour-là** ? (2026-08-24)
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 UNE SEULE RÈGLE, ET SON ORDRE EST TOUT
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `tournament_entry.state` est GLOBAL au tournoi. Sur un TFT étalé sur quatre week-ends,
 * « présent au 2ᵉ, absent au 3ᵉ, revenu au 4ᵉ » n'était pas exprimable : pointer le 3ᵉ
 * écrasait le 2ᵉ. `tournament_entry_attendance` ajoute le pointage PAR JOURNÉE — mais deux
 * sources qui décident du même fait, c'est deux vérités. D'où cette fonction, seul endroit du
 * dépôt qui tranche.
 *
 * L'ordre, et chaque étage a sa raison :
 * 1. **L'abandon l'emporte toujours.** Qui a arrêté ne revient pas ; le noter par journée
 *    laisserait écrire « abandonné le 12, présent le 19 ».
 * 2. **Sinon, le pointage de CETTE journée**, s'il existe.
 * 3. **Sinon, l'état global.** ⚠️ Cet étage n'est pas une commodité : sans lui, un tournoi
 *    d'un seul jour — dont les phases n'ont aucune date — n'aurait plus AUCUN présent, et
 *    **tous les tournois existants cesseraient de se générer**.
 */
export function joueCeJourLa(
  etatGlobal: EntryState,
  pointageDuJour: EntryState | undefined,
): boolean {
  // ① Un abandon est définitif, et aucun pointage de journée ne le contredit.
  if (etatGlobal === "abandonne") return false;

  // ② Le pointage de la journée, quand il existe.
  if (pointageDuJour !== undefined) return pointageDuJour === "present";

  // ③ Le repli : l'état global. C'est ce qui garde les tournois d'un jour fonctionnels.
  return etatGlobal === "present";
}

/**
 * L'état à AFFICHER pour un engagé à une journée donnée — ce que le pointage doit montrer.
 *
 * ⚠️ Distinct de `joueCeJourLa` : celle-ci répond « joue-t-il ? » par oui ou non, celle-là dit
 * QUEL état montrer, `inscrit` compris (pas encore pointé ce jour-là). Les fusionner ferait
 * afficher « absent » à quelqu'un qu'on n'a simplement pas encore pointé — et « pas encore
 * pointé » est exactement l'information dont on a besoin en début de journée.
 */
export function etatAffiche(
  etatGlobal: EntryState,
  pointageDuJour: EntryState | undefined,
): EntryState {
  if (etatGlobal === "abandonne") return "abandonne";
  if (pointageDuJour !== undefined) return pointageDuJour;
  return etatGlobal;
}

/**
 * Le pointage d'une journée pour tout un tournoi, indexé par engagé.
 *
 * ⚠️ `jour === null` ⇒ une Map VIDE, donc `joueCeJourLa` retombe partout sur l'état global.
 * C'est le cas d'une phase non datée, et le comportement d'avant le 2026-08-24.
 */
export function pointagesDuJour(
  lignes: readonly { entryId: string; playedOn: string; state: EntryState }[],
  jour: string | null,
): Map<string, EntryState> {
  if (jour === null) return new Map();
  const parEngage = new Map<string, EntryState>();
  for (const ligne of lignes) {
    if (ligne.playedOn === jour) parEngage.set(ligne.entryId, ligne.state);
  }
  return parEngage;
}
