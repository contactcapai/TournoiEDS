import type { EntryState, MatchBracket, PhaseKind, PhaseState } from "./structure";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * QUI JOUE CONTRE QUI, CÔTÉ PUBLIC (Story 14.3)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CE MODULE PORTE UNE RÈGLE DE **DONNÉES PERSONNELLES**, PAS UNE MISE EN FORME. La 14.2 avait
 * tranché « on nomme qui a un résultat saisi » ; « qui joue contre qui » parle précisément de
 * gens qui **n'ont pas encore joué**, si bien que la story ne pouvait pas exister sans étendre
 * l'arbitrage. Il l'a été (Brice, 2026-08-25) : **être tiré à une table publiée est un fait
 * public**, et la raison d'origine tient toujours — une place n'est occupée que par quelqu'un
 * que la génération a tiré **parmi les présents du jour**.
 *
 * ⚠️ **UN DROP GARDE SA CHAISE, ET C'EST PRÉCISÉMENT LE PROBLÈME.** Rien ne libère sa place tant
 * que le bénévole n'a pas régénéré — c'est tout le sujet de la 10.13. Écrire son nom sous « qui
 * joue » affirmerait donc qu'il joue, ce qui est faux. ⇒ Son nom est **tu tant que la rencontre
 * n'a aucun résultat**, et **conservé** dès qu'elle en a un : il a joué, l'effacer réécrirait la
 * partie (dette R60, la même que le classement).
 *
 * ⚠️ CE FICHIER NE CONNAÎT PAS LA BASE : il reçoit des lignes plates déjà lues et déjà ordonnées.
 * C'est ce qui permet de l'éprouver sans Postgres — et c'est là que vit la seule règle qui puisse
 * être fausse **en silence**, une page qui nomme une personne de trop n'ayant pas l'air cassée.
 */

/** Une ligne telle que la requête publique la rend : une place, avec sa rencontre et sa phase. */
export type LigneDeRencontre = {
  readonly phaseId: string;
  readonly phasePosition: number;
  readonly phaseName: string;
  readonly phaseKind: PhaseKind;
  readonly phaseState: PhaseState;
  readonly phasePlayedOn: string | null;
  readonly matchId: string;
  readonly matchPosition: number;
  readonly round: number | null;
  readonly bracket: MatchBracket;
  /** `null` quand la rencontre n'a aucune place (cas dégénéré) — la jointure est `left`. */
  readonly slotPosition: number | null;
  readonly nom: string | null;
  readonly etatEngage: EntryState | null;
  readonly score: number | null;
  readonly rank: number | null;
};

export type PlacePublique = {
  position: number;
  /** `null` = personne, ou quelqu'un qu'on n'a pas le droit de nommer ici. Voir le bloc de tête. */
  nom: string | null;
  score: number | null;
  rank: number | null;
};

export type RencontrePublique = {
  id: string;
  position: number;
  places: PlacePublique[];
  /** Vrai dès qu'une place porte un rang **ou** un score — le témoin est le RÉSULTAT. */
  depouillee: boolean;
};

/** Un tour d'un tableau, ou une manche de tables. */
export type GroupeDeRencontres = {
  clef: string;
  bracket: MatchBracket;
  round: number;
  rencontres: RencontrePublique[];
};

export type PhaseAvecRencontres = {
  id: string;
  position: number;
  name: string;
  kind: PhaseKind;
  state: PhaseState;
  playedOn: string | null;
  groupes: GroupeDeRencontres[];
};

/**
 * Regroupe les lignes plates en phases → tours → rencontres → places.
 *
 * ⚠️ **L'ORDRE REÇU EST L'ORDRE RENDU** : la requête trie par (position de phase, tableau, tour,
 * position de rencontre, position de place) et rien ici ne retrie. Deux tris qui divergeraient
 * feraient lire l'arbre dans un ordre et les résultats dans un autre.
 *
 * ⚠️ **`round` RETOMBE SUR 1**, jamais sur `null` : une phase de tables n'a pas de tour, mais le
 * groupement en a besoin. La colonne reste nullable en base parce que c'est vrai — la valeur de
 * repli est une décision d'affichage, elle vit ici.
 */
export function regrouperRencontresPubliques(
  lignes: readonly LigneDeRencontre[],
): PhaseAvecRencontres[] {
  // ① La rencontre est-elle dépouillée ? Il faut la réponse AVANT de décider des noms, et elle
  //    dépend de TOUTES ses places — d'où une première passe complète.
  const depouillee = new Set<string>();
  for (const ligne of lignes) {
    if (ligne.rank !== null || ligne.score !== null) depouillee.add(ligne.matchId);
  }

  const phases = new Map<string, PhaseAvecRencontres>();
  const groupes = new Map<string, GroupeDeRencontres>();
  const rencontres = new Map<string, RencontrePublique>();

  for (const ligne of lignes) {
    let phase = phases.get(ligne.phaseId);
    if (!phase) {
      phase = {
        id: ligne.phaseId,
        position: ligne.phasePosition,
        name: ligne.phaseName,
        kind: ligne.phaseKind,
        state: ligne.phaseState,
        playedOn: ligne.phasePlayedOn,
        groupes: [],
      };
      phases.set(ligne.phaseId, phase);
    }

    const round = ligne.round ?? 1;
    const clefGroupe = `${ligne.phaseId}|${ligne.bracket}|${round}`;
    let groupe = groupes.get(clefGroupe);
    if (!groupe) {
      groupe = { clef: clefGroupe, bracket: ligne.bracket, round, rencontres: [] };
      groupes.set(clefGroupe, groupe);
      phase.groupes.push(groupe);
    }

    let rencontre = rencontres.get(ligne.matchId);
    if (!rencontre) {
      rencontre = {
        id: ligne.matchId,
        position: ligne.matchPosition,
        places: [],
        depouillee: depouillee.has(ligne.matchId),
      };
      rencontres.set(ligne.matchId, rencontre);
      groupe.rencontres.push(rencontre);
    }

    // Une rencontre sans aucune place : la jointure rend une ligne, il n'y a rien à empiler.
    if (ligne.slotPosition === null) continue;

    rencontre.places.push({
      position: ligne.slotPosition,
      nom: nomPubliable(ligne.nom, ligne.etatEngage, rencontre.depouillee),
      score: ligne.score,
      rank: ligne.rank,
    });
  }

  return [...phases.values()];
}

/**
 * Le nom qu'on a le droit d'écrire sur cette place.
 *
 * 🔴 **UN DROP N'EST NOMMÉ QUE SUR UNE RENCONTRE DÉJÀ JOUÉE.** Sa chaise lui reste jusqu'à la
 * régénération (10.13) : le nommer sur une table à venir dirait qu'il joue, et c'est faux.
 * ⚠️ Un `absent` ou un `inscrit` ne peut pas se trouver ici — la génération tire parmi les
 * **présents** —, mais la garde ne coûte rien et l'écrit noir sur blanc : **seul un état qui a
 * joué, ou qui joue, se publie.**
 */
function nomPubliable(
  nom: string | null,
  etat: EntryState | null,
  rencontreDepouillee: boolean,
): string | null {
  if (nom === null || etat === null) return null;
  if (etat === "present") return nom;
  return rencontreDepouillee ? nom : null;
}
