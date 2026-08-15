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

  const seuil = Math.ceil(tailleDuLobby / 2);
  const total = resultats.reduce((somme, r) => somme + r.points, 0);
  const derniere = resultats.reduce((tard, r) => (r.ordre > tard.ordre ? r : tard));

  return {
    total,
    premieres: resultats.filter((r) => r.placement === 1).length,
    moitieHaute: resultats.filter((r) => r.placement <= seuil).length,
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
