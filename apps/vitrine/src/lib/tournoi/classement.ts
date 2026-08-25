import type { PhaseKind } from "./structure";

/**
 * Classement, points et répartition en lobbies (Story 10.3).
 *
 * 🔴 GÉNÉRALISATION DE CE QUI MARCHE, PAS UNE RÉÉCRITURE. Le moteur de `apps/tournoi-api` a
 * fait tourner de vrais tournois — c'est la meilleure preuve qui existe (A12). On garde son
 * barème, son ordre de départage et sa méthode suisse ; on retire le « 8 » codé en dur.
 *
 * ⚠️ Ce module ne touche PAS `tournoi-api` : ses 64 tests gardent l'application qui tourne
 * aujourd'hui. Le retrait de l'ancienne app est la Story 10.7, et pas avant.
 */

/**
 * Points d'un placement : le 1ᵉʳ d'un lobby de N marque N points, le dernier en marque 1.
 *
 * 🔴 C'EST ICI QUE LE « TFT À 8 » DISPARAÎT. L'original s'appelait
 * `calculatePoints(placement, _lobbySize)` — le second paramètre était préfixé d'un `_`,
 * c'est-à-dire **déclaré inutilisé**, et la fonction rendait `8 - placement + 1` quelle que
 * soit la taille réelle. Dans un lobby de 6, le premier marquait donc **8 points** au lieu
 * de 6, et le dernier **3** au lieu de 1.
 * ⚠️ Ce n'était pas un défaut tant que tous les lobbies faisaient 8. Ça le devient à la
 * seconde où le pointage rend un lobby incomplet — c'est-à-dire le cas nominal de la GIR.
 */
export const pointsDePlacement = (placement: number, tailleDuLobby: number): number => {
  if (!Number.isInteger(placement) || placement < 1) return 0;
  if (!Number.isInteger(tailleDuLobby) || tailleDuLobby < 1) return 0;
  if (placement > tailleDuLobby) return 0;
  return tailleDuLobby - placement + 1;
};

/**
 * Répartit des participants en lobbies **équilibrés**.
 *
 * 🔴 L'ORIGINAL DÉCOUPAIT EN TRANCHES, ET LE RESTE PARTAIT SEUL. `generateRandomLobbies` et
 * `generateSwissLobbies` faisaient tous deux `slice(i, i + 8)` : à 10 participants, ça rend un
 * lobby de **8** et un lobby de **2**. Personne ne veut jouer le second, et son barème n'a rien
 * à voir avec celui du premier.
 *
 * ⇒ On choisit d'abord le NOMBRE de lobbies (`ceil(P / cible)`), puis on répartit au plus
 * juste. À 10 pour une cible de 8 : **5 et 5**. À 17 : **6, 6, 5**. À 7 : **un seul lobby de
 * 7** — le « lobby à 7 au lieu de 8 » que le pointage doit rendre possible.
 *
 * ⚠️ L'ordre reçu est CONSERVÉ : c'est lui qui porte le sens (rang pour la méthode suisse,
 * tirage pour un premier tour). Mélanger ici rendrait la méthode suisse fausse en silence.
 */
export const repartirEnLobbies = <T>(participants: readonly T[], cible: number): T[][] => {
  if (participants.length === 0 || cible < 1) return [];

  const nombre = Math.ceil(participants.length / cible);
  const base = Math.floor(participants.length / nombre);
  const reste = participants.length % nombre;

  const lobbies: T[][] = [];
  let curseur = 0;
  for (let i = 0; i < nombre; i += 1) {
    // Les `reste` premiers lobbies portent une place de plus : l'écart entre le plus grand et
    // le plus petit ne dépasse jamais 1.
    const taille = base + (i < reste ? 1 : 0);
    lobbies.push(participants.slice(curseur, curseur + taille) as T[]);
    curseur += taille;
  }
  return lobbies;
};

/** Une manche jouée par un engagé. `ordre` situe la manche dans le temps. */
export type ResultatDeManche = {
  readonly placement: number;
  readonly points: number;
  readonly ordre: number;
  /**
   * 🔴 LA TAILLE DE **CETTE** TABLE — AJOUTÉE PAR LA STORY 10.8, QUI EN EST LE 1ᵉʳ CONSOMMATEUR.
   *
   * `statistiques()` recevait UNE taille pour toutes les manches d'un engagé. C'est juste quand
   * tous les lobbies font 8 — et c'est faux dans le cas même que cette story existe pour
   * servir : `repartirEnLobbies` rend **6, 6, 5** à 17 participants, et une manche suivante peut
   * en rendre d'autres. `moitieHaute` était alors compté contre une taille qui n'était pas celle
   * de la table jouée, donc **faux en silence** — et c'est le 3ᵉ départage de `classer()`, donc
   * un ordre de classement faux sans rien à l'écran pour le dire.
   *
   * C'est exactement le motif que la 10.3 a corrigé sur les POINTS (le « 8 » codé en dur) sans
   * l'appliquer à ce seuil-ci : le commentaire de `statistiques` disait déjà *« sur un lobby de
   * 6, la moitié haute est le top 3 »* sans que rien ne le tienne pour des lobbies mélangés.
   *
   * ⚠️ Facultatif, et le repli est le paramètre de `statistiques()` : les appelants existants ne
   * changent pas de comportement. Ce n'est donc pas une story mergée qu'on modifie, c'est un
   * champ qu'on lui ajoute.
   */
  readonly tailleDuLobby?: number;
};

export type StatistiquesEngage = {
  total: number;
  premieres: number;
  moitieHaute: number;
  dernierPlacement: number;
  manchesJouees: number;
  moyenne: number;
};

/**
 * Statistiques d'un engagé à partir de ses manches.
 *
 * ⚠️ `moitieHaute` REMPLACE le `top4Count` de l'original, et ce n'est pas un renommage : « top
 * 4 » est la moitié haute **d'un lobby de 8**. Sur un lobby de 6, la moitié haute est le top 3
 * — compter les places 1 à 4 y récompenserait les deux tiers du plateau.
 *
 * 🔴 ET LE SEUIL SE CALCULE **PAR MANCHE** DEPUIS LA STORY 10.8, quand la manche porte sa propre
 * taille (`ResultatDeManche.tailleDuLobby`). Un seul seuil pour toutes les manches d'un engagé
 * était faux dès que les lobbies différaient — c'est-à-dire dans le cas nominal (17 participants
 * donnent 6, 6, 5). Le raisonnement complet est sur le champ.
 *
 * @param tailleDuLobby repli, utilisé pour les manches qui ne portent pas la leur.
 */
export const statistiques = (
  resultats: readonly ResultatDeManche[],
  tailleDuLobby: number,
): StatistiquesEngage => {
  if (resultats.length === 0) {
    return {
      total: 0,
      premieres: 0,
      moitieHaute: 0,
      dernierPlacement: 0,
      manchesJouees: 0,
      moyenne: 0,
    };
  }

  const seuilDe = (r: ResultatDeManche) => Math.ceil((r.tailleDuLobby ?? tailleDuLobby) / 2);
  const total = resultats.reduce((somme, r) => somme + r.points, 0);
  const derniere = resultats.reduce((tard, r) => (r.ordre > tard.ordre ? r : tard));

  return {
    total,
    premieres: resultats.filter((r) => r.placement === 1).length,
    moitieHaute: resultats.filter((r) => r.placement <= seuilDe(r)).length,
    dernierPlacement: derniere.placement,
    manchesJouees: resultats.length,
    moyenne: Math.round((total / resultats.length) * 100) / 100,
  };
};

export type EngageClassable = {
  readonly id: string;
  readonly nom: string;
  readonly stats: StatistiquesEngage;
  /** Un engagé qui a ARRÊTÉ en cours de route garde ses points et ses parties (dette R60). */
  readonly abandonne?: boolean;
};

export type LigneDeClassement = EngageClassable & { rang: number };

/**
 * Classe des engagés — départages de l'original, **plus un ordre TOTAL**.
 *
 * Ordre conservé tel quel, parce qu'il a fait ses preuves : points totaux, puis nombre de
 * premières places, puis places en moitié haute, puis meilleur dernier résultat.
 *
 * 🔴 CE QUE L'ORIGINAL N'AVAIT PAS : UN DÉPARTAGE FINAL. Sa comparaison s'arrêtait au dernier
 * résultat, donc deux ex æquo parfaits avaient un ordre **indéterminé** — il changeait d'une
 * lecture à l'autre, et le classement affiché n'était pas reproductible. C'est le défaut que
 * ce projet a déjà payé sur les sollicitations (dette R31). Le nom tranche en dernier ressort,
 * et l'identifiant derrière lui : le résultat est stable, toujours.
 *
 * ⚠️ UN ABANDON NE FAIT PAS PERDRE CE QUI A ÉTÉ JOUÉ. Un engagé qui arrête garde ses points et
 * son rang. Le retirer réécrirait les manches où ses adversaires l'ont battu.
 */
export const classer = (engages: readonly EngageClassable[]): LigneDeClassement[] =>
  [...engages]
    .sort((a, b) => {
      if (b.stats.total !== a.stats.total) return b.stats.total - a.stats.total;
      if (b.stats.premieres !== a.stats.premieres) return b.stats.premieres - a.stats.premieres;
      if (b.stats.moitieHaute !== a.stats.moitieHaute) {
        return b.stats.moitieHaute - a.stats.moitieHaute;
      }
      if (a.stats.dernierPlacement !== b.stats.dernierPlacement) {
        return a.stats.dernierPlacement - b.stats.dernierPlacement;
      }
      const parNom = a.nom.localeCompare(b.nom, "fr");
      return parNom !== 0 ? parNom : a.id.localeCompare(b.id);
    })
    .map((engage, index) => ({ ...engage, rang: index + 1 }));

/**
 * Méthode suisse : on classe, puis on répartit dans l'ordre du classement — les meilleurs
 * ensemble, et ainsi de suite.
 *
 * ⚠️ Les engagés qui ont ABANDONNÉ sont écartés de la manche suivante, mais restent au
 * classement. Les laisser entrer fabriquerait des lobbies à places mortes.
 */
export const lobbiesSuisses = (
  engages: readonly EngageClassable[],
  cible: number,
): LigneDeClassement[][] =>
  repartirEnLobbies(
    classer(engages).filter((e) => !e.abandonne),
    cible,
  );

/* ═══════════════════════════════════════════════════════════════════════════════
   DES PLACES LUES EN BASE À UN CLASSEMENT — EXTRAIT PAR LA STORY 14.2
   ═══════════════════════════════════════════════════════════════════════════════ */

/** Une place de table telle que la base la rend : l'engagé, sa table, son rang s'il est saisi. */
export type PlaceLue = {
  readonly matchId: string;
  readonly entryId: string;
  readonly nom: string;
  readonly abandonne: boolean;
  /** `null` = place générée mais **pas encore dépouillée**. Ce n'est pas une manche jouée. */
  readonly rank: number | null;
  /**
   * La phase d'où vient cette place — **ajoutée par la Story 10.14**, et pas par confort.
   *
   * 🔴 UN TOURNOI A DEUX ESPACES DE POINTS DÈS QU'IL PORTE UNE FINALE : les qualifications, et
   * la finale, **où l'on repart de zéro**. Sans le format de la phase ici, ce module ne peut
   * pas les séparer — et le seuil de victoire (20 points) serait atteint dès les qualifications,
   * ce qui viderait la règle de son sens.
   * ⚠️ `phasePosition` sert à **numéroter les manches de la finale**, jamais à décider qui en
   * fait partie : c'est `kind` qui le dit (voir `estDeLaFinale`).
   */
  readonly phaseKind: PhaseKind;
  readonly phasePosition: number;
};

/**
 * La taille **RÉELLE** de chaque table : le nombre de places occupées, pas la taille générée.
 *
 * 🔴 EXPORTÉE PARCE QUE DEUX CALCULS EN DÉPENDENT (10.14) — le classement et les manches de
 * finale — et que c'est **le** fait qui serait faux en silence. Un lobby de 8 où 6 personnes se
 * sont assises est un lobby de **6** : compter 8 donnerait 3 points au dernier au lieu de 1, et
 * gonflerait tout le tableau. C'est le même défaut que le « 8 codé en dur » de la 10.3, et le
 * recopier dans le second consommateur serait la faute d'`estParTables` (10.10).
 */
export const taillesParTable = (places: readonly PlaceLue[]): Map<string, number> => {
  const tailles = new Map<string, number>();
  for (const place of places) {
    tailles.set(place.matchId, (tailles.get(place.matchId) ?? 0) + 1);
  }
  return tailles;
};

/**
 * Agrège des places en engagés classables.
 *
 * 🔴 EXTRAIT DE `getClassementDuTournoi` SANS CHANGER SON COMPORTEMENT, parce que la lecture
 * PUBLIQUE pose sa propre garde `is_published` dans son `WHERE` (doctrine 14.1) et ne peut donc
 * pas appeler la lecture d'admin. Sans cette extraction, les deux requêtes porteraient deux
 * copies de ce calcul — et c'est la recopie qui a déjà coûté un défaut muet au 5ᵉ cas sur ce
 * projet (`estParTables`, 10.10).
 *
 * ⚠️ **L'ORDRE DES PLACES REÇUES PORTE DU SENS, ET RIEN ICI NE LE VÉRIFIE.** `ordre` situe la
 * manche dans le temps ; il se dérive du rang d'arrivée de chaque table dans la liste, et il
 * départage `dernierPlacement` — 4ᵉ critère de `classer()`. L'appelant doit trier par (position
 * de phase, position de rencontre), **jamais par une horloge** : deux rencontres créées dans la
 * même transaction portent le même `createdAt`. Un test fige ce contrat.
 *
 * ⚠️ **UNE PLACE VIDE NE COMPTE PAS DANS LA TAILLE.** Un lobby de 8 où 6 personnes se sont
 * assises est un lobby de **6** : compter 8 donnerait 3 points au dernier au lieu de 1, et
 * gonflerait tout le tableau. L'appelant ne remonte que les places qui portent un engagé.
 */
export const agregerParEngage = (places: readonly PlaceLue[]): EngageClassable[] => {
  const tailleParMatch = taillesParTable(places);

  const ordreParMatch = new Map<string, number>();
  for (const place of places) {
    if (!ordreParMatch.has(place.matchId)) {
      ordreParMatch.set(place.matchId, ordreParMatch.size + 1);
    }
  }

  const parEngage = new Map<
    string,
    { nom: string; abandonne: boolean; manches: ResultatDeManche[] }
  >();

  for (const place of places) {
    let engage = parEngage.get(place.entryId);
    if (!engage) {
      engage = { nom: place.nom, abandonne: place.abandonne, manches: [] };
      parEngage.set(place.entryId, engage);
    }

    // Une place sans rang n'est pas une manche jouée — elle est en attente de saisie.
    if (place.rank === null) continue;

    const taille = tailleParMatch.get(place.matchId) ?? 0;
    engage.manches.push({
      placement: place.rank,
      points: pointsDePlacement(place.rank, taille),
      ordre: ordreParMatch.get(place.matchId) ?? 0,
      tailleDuLobby: taille,
    });
  }

  return [...parEngage.entries()].map(([id, engage]) => ({
    id,
    nom: engage.nom,
    abandonne: engage.abandonne,
    // Le repli n'a plus de consommateur — chaque manche porte sa taille —, mais le paramètre
    // reste obligatoire : on lui passe la taille de la dernière table connue.
    stats: statistiques(engage.manches, engage.manches.at(-1)?.tailleDuLobby ?? 1),
  }));
};

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE QU'ON A LE DROIT DE PUBLIER — ON NOMME QUI A **JOUÉ** (Story 14.2)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * C'est la **première surface du site qui publie des pseudos**, et l'arbitrage écrit le matin
 * du 2026-08-25 disait « les PRÉSENTS, et eux seuls ». Appliqué tel quel, il ne tient pas : le
 * classement **cumule tout le tournoi** pendant que la présence se lit **par journée** depuis
 * la 10.12. Quelqu'un qui a joué samedi et manque le suivant a de vrais points — lire le seul
 * état du jour l'effacerait d'un classement où il figure à bon droit.
 *
 * ⇒ La règle retenue (arbitrage de Brice, même jour, à froid) est plus simple **et** plus
 * stricte : **une ligne se publie quand elle porte un résultat saisi.** C'est la doctrine déjà
 * écrite deux fois dans ce dépôt (`phaseADesResultats`, `aDesResultatsSaisis`) — l'état est
 * *saisi*, le résultat est un *fait*. Elle règle les trois cas sans exception particulière :
 *
 *   · un `inscrit` ou un `absent` n'a jamais de rang ⇒ **jamais nommé**. Personne n'est nommé
 *     publiquement pour n'être pas venu, ce qui était tout le sens de l'arbitrage ;
 *   · une place **générée mais pas encore dépouillée** ne nomme personne — et c'est le trou
 *     réel, pas une précaution : `agregerParEngage` crée l'engagé **avant** de regarder son
 *     rang, si bien que le classement d'admin porte une ligne à 0 point par place en attente.
 *     Sur un tournoi joué au **score** (bracket, poule), aucune place ne porte de rang : c'est
 *     donc **tout le plateau** qui serait nommé à 0 ;
 *   · un **drop qui a joué** garde sa ligne, son rang et son pseudo. Cet arbitrage-là **amende**
 *     le « jamais un `abandonne` » du matin : il est venu, il a joué, ses points comptent (R60),
 *     et le retirer décalerait les rangs de tous ceux d'en dessous — le classement public et
 *     celui du back-office se contrediraient le même jour, sur le même tournoi.
 *
 * ⚠️ LES RANGS SONT RENUMÉROTÉS, et ce n'est **pas** une divergence : une manche jouée vaut au
 * moins 1 point (`pointsDePlacement`), donc les lignes retirées sont toujours **strictement
 * dernières** et les numéros du haut ne bougent pas. La renumérotation interdit seulement un
 * trou dans la suite — qui se lirait comme une panne.
 */
export const classementPubliable = (lignes: readonly LigneDeClassement[]): LigneDeClassement[] =>
  lignes
    .filter((ligne) => ligne.stats.manchesJouees > 0)
    .map((ligne, index) => ({ ...ligne, rang: index + 1 }));
