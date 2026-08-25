import {
  classementPubliable,
  pointsDePlacement,
  taillesParTable,
  type LigneDeClassement,
  type PlaceLue,
} from "./classement";
import type { PhaseKind } from "./structure";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * LA RÈGLE DE VICTOIRE DE LA FINALE — 20 POINTS, **PUIS** UN TOP 1 (Story 10.14)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CETTE RÈGLE N'EST PAS NEUVE : elle tourne depuis le 2026-04-18 dans l'ancienne app
 * (`apps/tournoi-api/src/services/winnerDetector.ts`, validée par Brice), et le nouveau moteur
 * n'en avait **rien**. `finale` n'y différait de `lobbies` que par une seule ligne — une table
 * unique au lieu de lobbies équilibrés. ⚠️ **C'est donc un prérequis de la Story 10.7** :
 * retirer l'ancienne app sans ce module perdrait la règle qui désigne le vainqueur.
 *
 * 🔴 LE SEUIL DOIT ÊTRE FRANCHI DANS UNE MANCHE **ANTÉRIEURE**, ET C'EST TOUTE LA RÈGLE.
 * Traverser 20 points **pendant** la manche où l'on fait top 1 ne suffit pas — « d'abord
 * atteindre les 20 points, **puis** faire un top 1 » (Brice, 2026-08-25). Les trois cas qui
 * discriminent, repris de l'ancienne app :
 *   · 22 pts avant la manche + top 1 → **vainqueur**
 *   · 20 pts pile avant + top 1      → **vainqueur** (le seuil est inclusif)
 *   · 14 pts avant + top 1 (→ 22)    → **PAS** vainqueur
 *
 * 🔴 ET LA FINALE EST SON PROPRE ESPACE DE POINTS — ON Y REPART DE ZÉRO. Ce n'est pas une
 * commodité d'affichage : dans l'ancienne app, `aggregateFinaleRankings` ne compte que les
 * journées `type = 'finale'`. Sans cette remise à zéro, le seuil de 20 serait atteint dès les
 * qualifications et la règle n'aurait plus aucun sens. ⚠️ Ce module ne fait donc **jamais**
 * entrer une place de qualification : c'est l'appelant qui lui passe le seul bloc de finale.
 *
 * ⚠️ CE FICHIER NE CONNAÎT NI LA BASE NI LES PHASES : il reçoit des places déjà lues, déjà
 * réduites à la finale et déjà numérotées par manche. C'est ce qui permet de l'éprouver sans
 * Postgres — et c'est le joint de partage entre le back-office et la fiche publique.
 */

/** Le seuil de l'association, et celui de l'ancienne app depuis deux ans. */
export const SEUIL_VICTOIRE_DEFAUT = 20;

/**
 * Bornes de **saisie**, pas de règle de tournoi.
 *
 * ⚠️ En dessous de 1, « atteindre le seuil » serait vrai avant d'avoir joué : le premier top 1
 * emporterait la finale, ce qui n'est plus la règle mais son contraire.
 */
export const SEUIL_VICTOIRE_MIN = 1;
export const SEUIL_VICTOIRE_MAX = 200;

/**
 * Les phases qui composent la finale.
 *
 * 🔴 **UNE PHASE `finale` = UNE TABLE = UNE MANCHE** (`generation.ts` : *« deux tables de finale
 * ne départageraient rien »*). Une finale en plusieurs manches est donc **plusieurs phases
 * `finale`**, et la règle s'étend sur ce **bloc** — jamais sur une phase seule.
 *
 * ⚠️ LA FINALE SE DÉFINIT PAR LE **FORMAT**, JAMAIS PAR LA POSITION. Un « les phases après la
 * dernière qualification » se désynchroniserait au premier réordonnancement du déroulé, et
 * l'écart serait muet : le classement changerait d'espace sans que personne ne touche à un
 * format. `kind` est saisi une fois et ne bouge plus.
 */
export const estDeLaFinale = (kind: PhaseKind) => kind === "finale";

/** Ce qu'une phase doit porter pour que le seuil se dérive. `seuil` vient de `settings`. */
export type PhaseDuBlocFinal = { readonly seuil: number | null };

/**
 * Le seuil qui gouverne **tout** le bloc de finale : celui de sa **première** manche.
 *
 * 🔴 ARBITRAGE DE BRICE (2026-08-25) — ET IL ÉVITE UNE DIVERGENCE MUETTE. Le seuil se saisit à
 * la première phase `finale` ; les suivantes l'affichent en lecture seule. Un seuil **par
 * manche** laisserait deux manches d'une même finale porter deux règles différentes, sans que
 * rien ne le signale et sans que personne ait le **devoir** de les garder d'accord — c'est
 * exactement la famille des phases que rien ne referme (leçon 14.1).
 *
 * ⚠️ Le repli est le seuil par défaut, et il couvre les finales déjà en base : `settings` vaut
 * `{}` sur toutes les phases générées avant cette story, donc `seuil` y est `null`.
 */
export const seuilDeLaFinale = (bloc: readonly PhaseDuBlocFinal[]): number =>
  bloc[0]?.seuil ?? SEUIL_VICTOIRE_DEFAUT;

/**
 * Une place **jouée** d'une manche de finale.
 *
 * ⚠️ `manche` situe la manche dans la finale (1, 2, 3…) et c'est l'appelant qui la dérive de la
 * position des phases — jamais d'une horloge. ⚠️ Seules les places **dépouillées** entrent ici :
 * une place sans rang n'est pas un résultat, et la faire entrer ferait passer une manche
 * seulement générée pour la dernière manche jouée.
 */
export type PlaceDeFinale = {
  readonly manche: number;
  readonly entryId: string;
  readonly nom: string;
  readonly placement: number;
  readonly points: number;
};

/** Un finaliste et son total dans l'espace de points de la finale. */
export type Finaliste = { entryId: string; nom: string; total: number };

/**
 * Ce que la finale permet d'affirmer à l'instant où on la regarde.
 *
 * ⚠️ **DEUX CHAMPS PARCE QU'IL Y A DEUX BESOINS**, et n'en rendre qu'un refabriquerait le défaut
 * de la 10.13 — une règle juste que personne ne voit. `vainqueur` répond « c'est fini » ;
 * `enPositionDeGagner` répond « il ne lui manque plus qu'un top 1 », qui est **l'information du
 * moment** pendant que la finale se joue.
 */
export type IssueDeFinale = {
  vainqueur: Finaliste | null;
  /** Ceux qui ont déjà le seuil : un top 1 à la manche suivante leur donne le tournoi. */
  enPositionDeGagner: Finaliste[];
  /** Le seuil appliqué — rendu pour que l'écran l'écrive sans le redériver. */
  seuil: number;
  /** Le numéro de la dernière manche dépouillée, `null` si la finale n'a rien de joué. */
  derniereManche: number | null;
};

const totaliser = (places: readonly PlaceDeFinale[]) => {
  const parEngage = new Map<string, Finaliste>();
  for (const place of places) {
    const courant = parEngage.get(place.entryId);
    if (courant) courant.total += place.points;
    else parEngage.set(place.entryId, { entryId: place.entryId, nom: place.nom, total: place.points });
  }
  return parEngage;
};

/**
 * Applique la règle de victoire à un bloc de finale.
 *
 * ⚠️ **UN TOP 1 DISPUTÉ N'EN EST PAS UN.** Si deux places de la dernière manche portent le rang
 * 1 — ce que rien n'interdit en base —, la finale ne désigne personne. L'ancienne app prenait
 * la première trouvée ; en écrire une serait inventer une victoire, et c'est la doctrine déjà
 * tenue par `podiumVisible` et `podiumDepuis` : on n'invente jamais une place disputée.
 */
export function issueDeLaFinale(
  places: readonly PlaceDeFinale[],
  seuil: number,
): IssueDeFinale {
  if (places.length === 0) {
    return { vainqueur: null, enPositionDeGagner: [], seuil, derniereManche: null };
  }

  const derniereManche = places.reduce((tard, place) => Math.max(tard, place.manche), 0);

  // Le total de CHACUN sur toute la finale : c'est lui qui dit qui peut gagner à la manche
  // suivante. Il inclut la dernière manche jouée, puisqu'elle est désormais derrière.
  const totaux = totaliser(places);

  const enPositionDeGagner = [...totaux.values()]
    .filter((finaliste) => finaliste.total >= seuil)
    .sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom, "fr") || a.entryId.localeCompare(b.entryId));

  // 🔴 LE TOP 1 DE LA DERNIÈRE MANCHE, ET IL DOIT ÊTRE UNIQUE.
  const premiers = places.filter((place) => place.manche === derniereManche && place.placement === 1);
  if (premiers.length !== 1) {
    return { vainqueur: null, enPositionDeGagner, seuil, derniereManche };
  }
  const top1 = premiers[0];

  /**
   * 🔴 LE TOTAL **AVANT** CETTE MANCHE, ET C'EST TOUTE LA RÈGLE. On ne retire pas « les points
   * de la dernière manche » du total : on **recompte** sur les manches strictement antérieures.
   * La soustraction (celle de l'ancienne app) donne le même chiffre tant qu'un engagé n'a
   * qu'une place par manche — mais elle deviendrait fausse en silence le jour où il en aurait
   * deux, alors que ce filtre-ci reste juste par construction.
   */
  const avant = totaliser(places.filter((place) => place.manche < derniereManche));
  const totalAvant = avant.get(top1.entryId)?.total ?? 0;

  if (totalAvant < seuil) {
    return { vainqueur: null, enPositionDeGagner, seuil, derniereManche };
  }

  const total = totaux.get(top1.entryId)?.total ?? 0;
  return {
    vainqueur: { entryId: top1.entryId, nom: top1.nom, total },
    enPositionDeGagner,
    seuil,
    derniereManche,
  };
}

/**
 * Traduit les places de finale **lues en base** en manches, points compris.
 *
 * 🔴 LES POINTS SUIVENT LA TAILLE **RÉELLE** DE LA TABLE, et le calcul est celui du classement —
 * `taillesParTable` est partagée exprès (10.14). Une seconde arithmétique ici donnerait un jour
 * un vainqueur que le classement de la finale contredirait, sur le même écran.
 *
 * ⚠️ **LES MANCHES SONT NUMÉROTÉES PAR LA POSITION DE LEUR PHASE**, jamais par l'ordre d'arrivée
 * des lignes : c'est cette numérotation qui décide de ce qui est « antérieur », donc toute la
 * règle. ⚠️ La numérotation est **dense sur les manches qui portent un résultat** : une manche
 * générée et vide n'existe pas encore pour la règle, exactement comme elle n'existe pas pour le
 * classement.
 *
 * ⚠️ Une place sans rang est **écartée** — elle n'est pas un résultat, et la garder ferait passer
 * une manche seulement générée pour la dernière manche jouée.
 */
export function manchesDeFinale(placesDeLaFinale: readonly PlaceLue[]): PlaceDeFinale[] {
  const tailles = taillesParTable(placesDeLaFinale);

  const jouees = placesDeLaFinale.filter((place) => place.rank !== null);
  const positions = [...new Set(jouees.map((place) => place.phasePosition))].sort((a, b) => a - b);
  const numeroDeManche = new Map(positions.map((position, index) => [position, index + 1]));

  return jouees.map((place) => ({
    manche: numeroDeManche.get(place.phasePosition) ?? 0,
    entryId: place.entryId,
    nom: place.nom,
    placement: place.rank as number,
    points: pointsDePlacement(place.rank as number, tailles.get(place.matchId) ?? 0),
  }));
}

/**
 * La finale telle qu'on a le **droit** de la publier (Stories 14.2 + 10.14).
 *
 * 🔴 **DEUX APPELANTS, UNE SEULE RÈGLE** : la fiche publique et l'aperçu du bénévole. Ce dernier
 * lit un BROUILLON, donc ne passe pas par la requête publique — mais il doit montrer **ce que le
 * site montrera**, sans quoi il ment au moment précis où on lui demande la vérité (doctrine 6.3).
 *
 * ⚠️ **NOMMER LE VAINQUEUR NE CONTOURNE PAS LA RÈGLE DE LA 14.2** (« on nomme qui a joué ») : par
 * construction, quiconque paraît ici porte des points de finale, donc au moins un résultat saisi.
 * La garde n'est pas contournée, elle est **déjà satisfaite** — et le dire évite qu'on l'ajoute
 * une seconde fois « par prudence », ce qui masquerait le vainqueur d'une finale à une manche.
 */
export function finalePubliable(finale: {
  classement: readonly LigneDeClassement[];
  issue: IssueDeFinale;
}) {
  return {
    classement: classementPubliable(finale.classement),
    vainqueur: finale.issue.vainqueur
      ? { nom: finale.issue.vainqueur.nom, total: finale.issue.vainqueur.total }
      : null,
    enPositionDeGagner: finale.issue.enPositionDeGagner.map((f) => ({
      nom: f.nom,
      total: f.total,
    })),
    seuil: finale.issue.seuil,
  };
}
