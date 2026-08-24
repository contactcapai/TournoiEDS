/**
 * Générer la structure d'une phase — le pont entre les moteurs et la base (Story 10.8).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE MODULE NE DÉCIDE PAS QUI JOUE QUI. IL TRADUIT.
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `bracket.ts` (10.2) et `classement.ts` (10.3) savent déjà tout : appariements, exemptions,
 * bracket des perdants, répartition en lobbies. Ce module les APPELLE et rend une structure
 * directement écrivable dans `tournament_match` / `tournament_match_slot`. Réimplémenter ne
 * serait-ce qu'un appariement ici en ferait une **seconde** définition, qui divergerait au
 * premier format ajouté — et un bracket faux se voit devant des joueurs.
 *
 * 🔴 IL RAISONNE EN RANGS (1..N), JAMAIS EN ENGAGÉS. Comme `bracket.ts`, et pour la même
 * raison : c'est ce qui le rend testable et rejouable. C'est l'appelant qui associe un rang à
 * un `tournament_entry` — et c'est lui qui décide de l'ORDRE de la liste, ce qui n'est pas
 * neutre : ordre de saisie pour un premier tour, ordre du CLASSEMENT pour une manche suisse ou
 * une finale. Trancher cet ordre ici masquerait la décision.
 *
 * 🔴 ET IL RÉSOUT LES COORDONNÉES **UNE SEULE FOIS**. `bracket.ts` désigne une rencontre par
 * (tableau, tour, rang dans le tour) ; la base la désigne par sa `position`, unique dans la
 * phase. La traduction se fait ici, à la génération, et le résultat est stocké dans
 * `tournament_match_slot.source`. La saisie d'un résultat n'a donc plus à re-dériver « le
 * vainqueur du tour r rang p monte au tour r+1 rang ceil(p/2) » : elle lit la provenance.
 */

import {
  eliminationDouble,
  eliminationSimple,
  roundRobin,
  type OrdreDePlacement,
  type Source,
  type TourGenere,
} from "./bracket";
import { repartirEnLobbies } from "./classement";
import { estParTables, type MatchBracket, type PhaseKind } from "./structure";

/** Cible par défaut d'un lobby TFT. C'est le format que l'association fait tourner. */
export const TAILLE_LOBBY_DEFAUT = 8;
/** Bornes de saisie : en dessous de 2, une « table » n'oppose personne. */
export const TAILLE_LOBBY_MIN = 2;
export const TAILLE_LOBBY_MAX = 16;

/**
 * D'où vient l'occupant d'une place, **en coordonnées de base**.
 *
 * `rencontre` est la `position` de la rencontre source dans la phase — jamais un tour et un
 * rang, qui ne veulent rien dire sans savoir de quel tableau on parle.
 */
export type SourceResolue =
  /** `rang` est un numéro dans la liste fournie (1..N). `null` = exemption (*bye*). */
  | { de: "tete_de_serie"; rang: number | null }
  | { de: "vainqueur"; rencontre: number }
  | { de: "perdant"; rencontre: number };

export type PlaceAGenerer = {
  /** Rang de la place DANS la rencontre : 1 et 2 en bracket, 1..N dans un lobby. */
  position: number;
  source: SourceResolue;
};

export type RencontreAGenerer = {
  /** Unique dans la phase — c'est `tournament_match.position`. */
  position: number;
  round: number;
  bracket: MatchBracket;
  places: PlaceAGenerer[];
};

export type ReglagesGeneration = {
  /** `bracket` seulement : deux tableaux plutôt qu'un. */
  doubleElimination?: boolean;
  /** `poule` seulement : chaque paire se joue deux fois, rôles inversés. */
  allerRetour?: boolean;
  /** `lobbies` et `finale` : combien de joueurs par table. */
  tailleDeLobby?: number;
  /** Comment les rangs entrent dans le tableau (`bracket` seulement). */
  ordre?: OrdreDePlacement;
};

/** Clef d'une rencontre dans les coordonnées de `bracket.ts`. */
const clef = (bracket: MatchBracket, round: number, rang: number) => `${bracket}|${round}|${rang}`;

/**
 * ⚠️ `bracket.ts` PARLE TOUJOURS DE « vainqueurs », MÊME QUAND IL N'Y A QU'UN TABLEAU, et c'est
 * un piège réel : une élimination **simple** est stockée en `principal`, donc une source
 * `{ bracket: "vainqueurs" }` doit être relue comme `principal`. Sans cette normalisation, la
 * traduction ne trouverait aucune rencontre et **rendrait des places sans provenance** — un
 * tableau qui ne progresse jamais, sans qu'aucune erreur ne soit levée.
 */
const tableauReel = (deBracket: string, simple: boolean): MatchBracket =>
  simple && deBracket === "vainqueurs" ? "principal" : (deBracket as MatchBracket);

/**
 * Assemble les tours d'un tableau en rencontres numérotées, et note leurs coordonnées.
 *
 * ⚠️ L'ORDRE D'ALLOCATION N'EST PAS ARBITRAIRE : une source ne peut désigner qu'une rencontre
 * DÉJÀ numérotée. Les tableaux s'allouent donc dans l'ordre où ils se dépendent — vainqueurs,
 * puis perdants (qui reçoivent des vainqueurs), puis la grande finale (qui reçoit des deux).
 */
function ajouterTours(
  tours: readonly TourGenere[],
  bracket: MatchBracket,
  etat: { position: number; parClef: Map<string, number> },
  brut: { bracket: MatchBracket; round: number; rang: number; sources: readonly Source[] }[],
) {
  for (const tour of tours) {
    for (const rencontre of tour.rencontres) {
      etat.position += 1;
      etat.parClef.set(clef(bracket, tour.round, rencontre.position), etat.position);
      brut.push({
        bracket,
        round: tour.round,
        rang: rencontre.position,
        sources: rencontre.sources,
      });
    }
  }
}

/**
 * La structure d'une phase, prête à écrire.
 *
 * @param kind la nature de la phase, telle que la 10.4 l'a saisie.
 * @param nombre le nombre de participants — **les PRÉSENTS**, jamais les inscrits : c'est tout
 *   le sens du pointage de la 10.5.
 * @returns une liste vide quand l'effectif ne permet aucune rencontre (0 ou 1 participant).
 *   ⚠️ Vide n'est PAS une erreur : c'est un état que l'écran doit dire, pas une exception.
 */
export function structureDePhase(
  kind: PhaseKind,
  nombre: number,
  reglages: ReglagesGeneration = {},
): RencontreAGenerer[] {
  if (!Number.isInteger(nombre) || nombre < 1) return [];

  const etat = { position: 0, parClef: new Map<string, number>() };
  const brut: {
    bracket: MatchBracket;
    round: number;
    rang: number;
    sources: readonly Source[];
  }[] = [];

  // Les formats PAR TABLES ne passent PAS par `bracket.ts` : une table de 8 n'est pas une
  // rencontre à deux places. Ils passent par `repartirEnLobbies` (10.3), qui est justement ce
  // qui rend un lobby à 7 correct au lieu de fabriquer un lobby à 2.
  // ⚠️ `estParTables` et non une liste recopiée — `suisse` produit EXACTEMENT la structure de
  // `lobbies` (seul l'ordre d'entrée diffère, et il est décidé par l'appelant).
  if (estParTables(kind)) {
    const cible = reglages.tailleDeLobby ?? TAILLE_LOBBY_DEFAUT;
    const rangs = Array.from({ length: nombre }, (_, i) => i + 1);

    // 🔴 UNE FINALE EST **UNE SEULE** TABLE, et c'est la différence entière avec `lobbies` :
    // on n'y répartit pas, on retient les premiers. Deux tables de finale ne départageraient
    // rien. Avec une cible de 2, c'est la finale classique d'un bracket ; avec 8, le lobby
    // final d'un TFT. Un seul chemin de code, un paramètre.
    const tables = kind === "finale" ? [rangs.slice(0, Math.min(nombre, cible))] : repartirEnLobbies(rangs, cible);

    return tables
      .filter((table) => table.length > 0)
      .map((table, index) => ({
        position: index + 1,
        round: 1,
        bracket: "principal" as MatchBracket,
        places: table.map((rang, rangDansLaTable) => ({
          position: rangDansLaTable + 1,
          source: { de: "tete_de_serie" as const, rang },
        })),
      }));
  }

  if (kind === "poule") {
    ajouterTours(roundRobin(nombre, reglages.allerRetour ?? false), "principal", etat, brut);
  } else if (reglages.doubleElimination) {
    const { vainqueurs, perdants, grandeFinale } = eliminationDouble(nombre, reglages.ordre);
    ajouterTours(vainqueurs, "vainqueurs", etat, brut);
    ajouterTours(perdants, "perdants", etat, brut);
    ajouterTours(grandeFinale, "grande_finale", etat, brut);
  } else {
    ajouterTours(eliminationSimple(nombre, reglages.ordre), "principal", etat, brut);
  }

  const simple = kind === "poule" || !reglages.doubleElimination;

  // Second passage : les coordonnées de `bracket.ts` deviennent des `position` de base. Il faut
  // que TOUTES les rencontres soient numérotées avant de traduire une seule source.
  return brut.map((rencontre, index) => ({
    position: index + 1,
    round: rencontre.round,
    bracket: rencontre.bracket,
    places: rencontre.sources.map((source, rangDeLaPlace) => ({
      position: rangDeLaPlace + 1,
      source: resoudre(source, etat.parClef, simple),
    })),
  }));
}

/**
 * Traduit une source de `bracket.ts` en source de base.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 UNE COORDONNÉE INTROUVABLE **LÈVE**. ELLE NE DEVIENT PAS UNE EXEMPTION.
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Ce repli a existé, et il a été retiré parce qu'il MASQUAIT une panne de traduction. En
 * sabotant volontairement `tableauReel` (2026-08-15), une élimination simple a rendu un tableau
 * dont **toutes** les places de 2ᵉ tour étaient des « exemptions » : aucune erreur, aucune source
 * orpheline détectable, et un tournoi qui ne progresse jamais. Le contrôle qui l'a vu ne l'a vu
 * que par chance — il vérifiait la FORME des sources du 2ᵉ tour, pas leur résolution.
 *
 * ⚠️ ET IL N'Y A **AUCUN** CAS LÉGITIME D'INTROUVABLE. Le seul candidat — la grande finale d'une
 * double élimination sans tableau des perdants — est déjà émis par `bracket.ts` comme
 * `teteDeSerie(null)`, donc il ne passe jamais par ce chemin (vérifié dans `eliminationDouble`).
 * Un introuvable ici est donc toujours un défaut de traduction, et un défaut doit crier :
 * la génération échoue, l'action l'attrape, et rien de faux n'entre en base.
 */
function resoudre(source: Source, parClef: Map<string, number>, simple: boolean): SourceResolue {
  if (source.de === "tete_de_serie") return { de: "tete_de_serie", rang: source.place };

  const tableau = tableauReel(source.bracket, simple);
  const position = parClef.get(clef(tableau, source.round, source.position));
  if (position === undefined) {
    throw new Error(
      `Génération impossible : la place attend le ${source.de} de la rencontre ` +
        `(${tableau}, tour ${source.round}, rang ${source.position}), qui n'existe pas dans la ` +
        "structure générée. C'est un défaut de traduction, pas une exemption.",
    );
  }

  return source.de === "vainqueur"
    ? { de: "vainqueur", rencontre: position }
    : { de: "perdant", rencontre: position };
}

/**
 * Les rangs à qui la structure donne une place au DÉPART.
 *
 * Sert à deux choses, et la seconde est une garde : remplir les places du premier tour, et
 * vérifier qu'aucun participant présent n'a été oublié par le générateur. Un engagé pointé
 * présent qui n'apparaît nulle part est un défaut **muet** — le tournoi tourne sans lui.
 */
export const rangsPlaces = (structure: readonly RencontreAGenerer[]): Set<number> => {
  const rangs = new Set<number>();
  for (const rencontre of structure) {
    for (const place of rencontre.places) {
      if (place.source.de === "tete_de_serie" && place.source.rang !== null) {
        rangs.add(place.source.rang);
      }
    }
  }
  return rangs;
};
