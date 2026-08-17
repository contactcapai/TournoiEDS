/**
 * Le rang d'un engagé dans une phase à DEUX places — tableau ou poule (Story 10.8, correctif).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 POURQUOI CE MODULE EXISTE : LE CLASSEMENT AUX POINTS NE VOIT QUE LES LOBBIES
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Mesuré sur la base de staging le 2026-08-15, après un tournoi TFT joué de bout en bout par
 * Brice : ses **14 places** portaient un **score** et **aucun rang**. Or `getClassementDuTournoi`
 * ne compte comme manche jouée qu'une place portant un **rang** — il est conçu pour les tables de
 * TFT. Conséquence : l'écran affichait *« Aucun résultat saisi pour l'instant »* sur une double
 * élimination **entièrement jouée**. Une phrase fausse, exactement celle qui fait croire à une
 * panne. Et le podium restait vide alors que la grande finale avait un vainqueur.
 *
 * 🔴 LE RANG SE **DÉDUIT DE LA STRUCTURE**, IL NE SE SAISIT PAS (arbitrage de Brice, 2026-08-15).
 * Un tableau dit déjà jusqu'où chacun est allé ; demander un rang en plus du score serait deux
 * saisies pour une seule information — 63 rencontres à saisir deux fois sur une élimination
 * simple à 64.
 *
 * ⚠️ **DEUX DÉRIVATIONS, PARCE QUE CE SONT DEUX CHOSES.** Dans un tableau, le rang est *jusqu'où
 * on est allé* ; dans une poule, personne n'est éliminé et le rang est *combien on a gagné*.
 * Appliquer la logique d'élimination à une poule marquerait tout le monde éliminé à sa première
 * défaite, ce qui n'a aucun sens quand chacun rencontre chacun.
 */

/** Ce dont la dérivation a besoin : la structure, et l'issue déjà dépouillée. */
export type RencontrePourRang = {
  readonly position: number;
  readonly places: readonly {
    readonly entryId: string | null;
    readonly score: number | null;
    readonly source: { readonly de: string; readonly rencontre?: number } | null;
  }[];
  readonly issue: {
    readonly complete: boolean;
    readonly vainqueur: string | null;
    readonly perdant: string | null;
    readonly exemption: boolean;
  };
};

export type LigneDeParcours = {
  readonly id: string;
  readonly rang: number;
  /**
   * La profondeur de la rencontre où il a été éliminé — `null` s'il ne l'a jamais été.
   * Sert à l'écran pour dire « 5ᵉ–8ᵉ » plutôt que d'inventer un ordre entre ex æquo.
   */
  readonly profondeur: number | null;
  /** Combien d'engagés partagent ce rang. `1` = pas d'ex æquo. */
  readonly exAequo: number;
};

/**
 * La profondeur d'une rencontre : la plus longue chaîne de rencontres qui y mène.
 *
 * 🔴 C'EST ELLE QUI ORDONNE, ET PAS `position` NI `round`. En double élimination, `position`
 * range **tout** le tableau des vainqueurs avant celui des perdants (contrainte d'allocation :
 * une source ne désigne qu'une position inférieure), et `round` repart à 1 dans chaque tableau.
 * Ni l'un ni l'autre ne dit qu'un tour 2 des perdants se joue APRÈS un tour 2 des vainqueurs.
 * La profondeur, si : la grande finale est toujours la plus profonde.
 *
 * ⚠️ Mémoïsée, et protégée contre un cycle : une structure cyclique ferait une récursion infinie.
 * Elle ne peut pas arriver depuis `generation.ts` (les sources pointent vers des positions
 * inférieures), mais une ligne écrite à la main en base, elle, pourrait.
 */
function profondeurs(rencontres: readonly RencontrePourRang[]): Map<number, number> {
  const parPosition = new Map(rencontres.map((r) => [r.position, r]));
  const cache = new Map<number, number>();
  const enCours = new Set<number>();

  const calculer = (position: number): number => {
    const connue = cache.get(position);
    if (connue !== undefined) return connue;
    if (enCours.has(position)) return 1; // garde anti-cycle
    enCours.add(position);

    const rencontre = parPosition.get(position);
    let maximum = 0;
    for (const place of rencontre?.places ?? []) {
      const amont = place.source?.rencontre;
      if (amont === undefined || !parPosition.has(amont)) continue;
      maximum = Math.max(maximum, calculer(amont));
    }

    enCours.delete(position);
    const valeur = maximum + 1;
    cache.set(position, valeur);
    return valeur;
  };

  for (const rencontre of rencontres) calculer(rencontre.position);
  return cache;
}

/** Tous les engagés qui occupent au moins une place de la phase. */
const engagesDeLaPhase = (rencontres: readonly RencontrePourRang[]): Set<string> => {
  const ids = new Set<string>();
  for (const rencontre of rencontres) {
    for (const place of rencontre.places) if (place.entryId !== null) ids.add(place.entryId);
  }
  return ids;
};

/**
 * Range des lignes déjà triées en rangs **denses** : les ex æquo partagent le plus petit rang.
 *
 * ⚠️ C'est ainsi qu'un tableau se lit vraiment — « 5ᵉ–8ᵉ » pour les quatre éliminés au premier
 * tour. Leur inventer un ordre serait un classement faux présenté comme un fait.
 */
function rangsDenses(
  triees: readonly { id: string; profondeur: number | null }[],
): LigneDeParcours[] {
  const groupes = new Map<string, { id: string; profondeur: number | null }[]>();
  for (const ligne of triees) {
    const clef = String(ligne.profondeur);
    const groupe = groupes.get(clef);
    if (groupe) groupe.push(ligne);
    else groupes.set(clef, [ligne]);
  }

  const lignes: LigneDeParcours[] = [];
  let rang = 1;
  for (const groupe of groupes.values()) {
    for (const ligne of groupe) {
      lignes.push({ ...ligne, rang, exAequo: groupe.length });
    }
    rang += groupe.length;
  }
  return lignes;
}

/**
 * Le rang dans un TABLEAU : jusqu'où chacun est allé.
 *
 * 🔴 « ÉLIMINÉ » SE DÉDUIT DES PROVENANCES, PAS DU FORMAT. Un engagé est éliminé quand il perd
 * une rencontre **d'où rien ne descend** — c'est-à-dire quand aucune place de la phase n'attend
 * le `perdant` de cette rencontre. Une seule règle couvre donc l'élimination simple (toute
 * défaite élimine) ET la double (une défaite chez les vainqueurs fait descendre, une défaite chez
 * les perdants élimine, la grande finale élimine). Écrire deux règles par format les ferait
 * diverger au troisième format.
 *
 * ⚠️ UNE EXEMPTION N'ÉLIMINE PERSONNE : `issue.perdant` y vaut `null` (personne n'a perdu une
 * rencontre qui n'a pas eu lieu), donc elle ne peut pas faire sortir quelqu'un du tableau.
 *
 * @param nomParEngage sert au départage FINAL, pour que l'ordre soit reproductible entre deux
 *   lectures — dette R31, déjà payée sur les sollicitations puis sur `classer()`.
 */
export function rangsParParcours(
  rencontres: readonly RencontrePourRang[],
  nomParEngage: ReadonlyMap<string, string>,
): LigneDeParcours[] {
  if (rencontres.length === 0) return [];

  const profondeurParPosition = profondeurs(rencontres);

  // Les rencontres d'où un PERDANT descend quelque part : y perdre n'élimine pas.
  const perdantDescend = new Set<number>();
  for (const rencontre of rencontres) {
    for (const place of rencontre.places) {
      if (place.source?.de === "perdant" && place.source.rencontre !== undefined) {
        perdantDescend.add(place.source.rencontre);
      }
    }
  }

  const elimineA = new Map<string, number>();
  for (const rencontre of rencontres) {
    if (!rencontre.issue.complete || rencontre.issue.perdant === null) continue;
    if (perdantDescend.has(rencontre.position)) continue;

    const profondeur = profondeurParPosition.get(rencontre.position) ?? 1;
    const connue = elimineA.get(rencontre.issue.perdant);
    // Le maximum : si une structure faisait sortir quelqu'un deux fois, on retient l'élimination
    // la plus tardive plutôt que la première rencontrée.
    elimineA.set(rencontre.issue.perdant, Math.max(connue ?? 0, profondeur));
  }

  const lignes = [...engagesDeLaPhase(rencontres)].map((id) => ({
    id,
    profondeur: elimineA.get(id) ?? null,
  }));

  lignes.sort((a, b) => {
    // Jamais éliminé passe devant tout le monde.
    if (a.profondeur === null && b.profondeur !== null) return -1;
    if (b.profondeur === null && a.profondeur !== null) return 1;
    if (a.profondeur !== null && b.profondeur !== null && a.profondeur !== b.profondeur) {
      return b.profondeur - a.profondeur; // éliminé plus tard = mieux classé
    }
    const nomA = nomParEngage.get(a.id) ?? "";
    const nomB = nomParEngage.get(b.id) ?? "";
    const parNom = nomA.localeCompare(nomB, "fr");
    return parNom !== 0 ? parNom : a.id.localeCompare(b.id);
  });

  return rangsDenses(lignes);
}

/**
 * Le rang dans une POULE : combien de victoires, puis la différence de score.
 *
 * ⚠️ AUCUNE ÉLIMINATION ICI, et c'est pour ça que la dérivation du tableau ne s'applique pas :
 * chacun rencontre chacun, une défaite ne sort personne.
 *
 * ⚠️ `profondeur` PORTE ICI LE NOMBRE DE VICTOIRES, pas une profondeur de tableau. C'est le même
 * champ parce que c'est le même usage — grouper les ex æquo —, et l'écran ne l'affiche jamais tel
 * quel : il n'en lit que `rang` et `exAequo`.
 */
export function rangsParVictoires(
  rencontres: readonly RencontrePourRang[],
  nomParEngage: ReadonlyMap<string, string>,
): LigneDeParcours[] {
  if (rencontres.length === 0) return [];

  const victoires = new Map<string, number>();
  const pour = new Map<string, number>();
  const contre = new Map<string, number>();

  for (const id of engagesDeLaPhase(rencontres)) {
    victoires.set(id, 0);
    pour.set(id, 0);
    contre.set(id, 0);
  }

  for (const rencontre of rencontres) {
    if (rencontre.issue.complete && rencontre.issue.vainqueur !== null) {
      const gagnant = rencontre.issue.vainqueur;
      victoires.set(gagnant, (victoires.get(gagnant) ?? 0) + 1);
    }

    // La différence de score se compte sur TOUTES les places saisies, dépouillées ou non : une
    // rencontre à égalité ne désigne pas de vainqueur mais ses scores comptent quand même.
    const total = rencontre.places.reduce((somme, p) => somme + (p.score ?? 0), 0);
    for (const place of rencontre.places) {
      if (place.entryId === null || place.score === null) continue;
      pour.set(place.entryId, (pour.get(place.entryId) ?? 0) + place.score);
      contre.set(place.entryId, (contre.get(place.entryId) ?? 0) + (total - place.score));
    }
  }

  const lignes = [...engagesDeLaPhase(rencontres)].map((id) => ({
    id,
    profondeur: victoires.get(id) ?? 0,
    difference: (pour.get(id) ?? 0) - (contre.get(id) ?? 0),
  }));

  lignes.sort((a, b) => {
    if (b.profondeur !== a.profondeur) return b.profondeur - a.profondeur;
    if (b.difference !== a.difference) return b.difference - a.difference;
    const nomA = nomParEngage.get(a.id) ?? "";
    const nomB = nomParEngage.get(b.id) ?? "";
    const parNom = nomA.localeCompare(nomB, "fr");
    return parNom !== 0 ? parNom : a.id.localeCompare(b.id);
  });

  // ⚠️ Le groupement des ex æquo tient compte de la DIFFÉRENCE, pas seulement des victoires :
  // deux joueurs à une victoire mais à des différences distinctes ne sont pas ex æquo.
  return rangsDenses(
    lignes.map((l) => ({ id: l.id, profondeur: l.profondeur * 1_000_000 + l.difference })),
  ).map((l) => ({ ...l, profondeur: victoires.get(l.id) ?? 0 }));
}

/**
 * Le podium qu'une phase désigne — 1ᵉʳ, 2ᵉ, 3ᵉ, **et seulement s'ils sont sans ambiguïté**.
 *
 * 🔴 UN EX ÆQUO NE MONTE PAS SUR LE PODIUM. Quatre joueurs 5ᵉ–8ᵉ, c'est un fait ; deux joueurs
 * « 3ᵉ » dont on n'écrirait qu'un seul serait une invention. On rend donc `null` pour une place
 * disputée, et l'écran demande à un humain de trancher — l'arbitrage du 2026-08-13 dit que
 * l'assistance **pré-remplit** et qu'un humain **valide**.
 */
export const podiumDepuis = (
  lignes: readonly LigneDeParcours[],
  nomParEngage: ReadonlyMap<string, string>,
): { premier: string | null; deuxieme: string | null; troisieme: string | null } => {
  const nomDuRang = (rang: number) => {
    const candidats = lignes.filter((l) => l.rang === rang);
    if (candidats.length !== 1) return null;
    return nomParEngage.get(candidats[0].id) ?? null;
  };

  return { premier: nomDuRang(1), deuxieme: nomDuRang(2), troisieme: nomDuRang(3) };
};
