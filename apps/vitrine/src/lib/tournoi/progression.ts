/**
 * L'issue d'une rencontre, et ce qu'elle fait avancer (Story 10.8).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 C'EST LE SECOND ENDROIT DE CETTE STORY OÙ UNE ERREUR EST **MUETTE**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Le premier est la traduction des coordonnées (`generation.ts`). Celui-ci est le dépouillement :
 * deux joueurs au rang 1 d'un même lobby, un score saisi sur une place vide, une égalité dans un
 * tableau à élimination — rien de tout ça ne lève quoi que ce soit. Ça donne des **points faux**
 * (`pointsDePlacement` rend 0 hors bornes) et un vainqueur qui monte au tour suivant alors que
 * personne n'a gagné.
 *
 * 🔴 CE MODULE NE TOUCHE NI LA BASE NI LES POINTS. Il dit seulement : cette rencontre est-elle
 * dépouillée, et si oui, dans quel ordre. Les points restent à `classement.ts` (10.3), la
 * progression à l'appelant, qui lit les provenances stockées par la 10.8.
 */

/** Une place telle qu'elle est en base, une fois la saisie faite (ou pas). */
export type PlaceJouee = {
  readonly position: number;
  readonly entryId: string | null;
  readonly score: number | null;
  readonly rank: number | null;
};

export type IssueDeRencontre = {
  /** Vrai quand la rencontre est dépouillée sans ambiguïté. */
  readonly complete: boolean;
  /** Pourquoi elle ne l'est pas — destiné à l'écran, pas à un journal. */
  readonly raison: string | null;
  readonly vainqueur: string | null;
  /**
   * Le perdant — **seulement à deux places**. Dans un lobby, « le perdant » ne veut rien dire :
   * il y a un classement, pas un éliminé. Rendre le dernier ferait descendre quelqu'un dans un
   * tableau des perdants qui n'existe pas.
   */
  readonly perdant: string | null;
  /** Les engagés du 1ᵉʳ au dernier. Vide tant que la rencontre n'est pas dépouillée. */
  readonly ordre: readonly string[];
  /** Vrai quand la rencontre s'est résolue **sans être jouée** — une exemption (*bye*). */
  readonly exemption: boolean;
};

const inachevee = (raison: string): IssueDeRencontre => ({
  complete: false,
  raison,
  vainqueur: null,
  perdant: null,
  ordre: [],
  exemption: false,
});

/**
 * Dépouille une rencontre.
 *
 * 🔴 UNE PLACE VIDE N'EST PAS UNE PLACE PERDUE. Une place sans engagé peut être trois choses :
 * une exemption (le tableau est plus grand que l'effectif), une place qui **attend** encore le
 * vainqueur d'une rencontre amont, ou une place jamais pourvue. Ce module ne les distingue pas —
 * il compte les occupants. C'est l'appelant qui sait si l'amont est joué.
 *
 * @param places toutes les places de la rencontre, occupées ou non.
 */
export function issueDeRencontre(places: readonly PlaceJouee[]): IssueDeRencontre {
  const occupees = places.filter((p) => p.entryId !== null);

  if (occupees.length === 0) return inachevee("Cette rencontre n'a encore aucun participant.");

  /**
   * 🔴 UNE SEULE PLACE OCCUPÉE DANS UNE RENCONTRE À DEUX = UNE EXEMPTION, et elle est résolue
   * SANS SAISIE. C'est le « combler le tableau » de l'AC : un tableau de 8 pour 5 présents
   * produit trois exemptions, et demander à un bénévole de cliquer trois fois sur des rencontres
   * qui n'ont pas eu lieu serait lui faire valider une arithmétique.
   * ⚠️ Elle ne s'applique QU'À DEUX PLACES. Un lobby de 8 où une seule personne est arrivée
   * n'est pas une exemption : c'est un lobby à refaire, et le dire vaut mieux que de désigner un
   * vainqueur qui n'a joué contre personne.
   */
  if (places.length === 2 && occupees.length === 1) {
    return {
      complete: true,
      raison: null,
      vainqueur: occupees[0].entryId,
      perdant: null,
      ordre: [occupees[0].entryId as string],
      exemption: true,
    };
  }

  if (occupees.length === 1) {
    return inachevee(
      "Cette table n'a qu'un seul participant : il n'y a rien à départager. " +
        "Regénérez la phase, ou complétez la table.",
    );
  }

  const avecRang = occupees.filter((p) => p.rank !== null);
  const avecScore = occupees.filter((p) => p.score !== null);

  // ── Dépouillement PAR RANG — le cas des lobbies, et le cas nominal du TFT ────────────
  if (avecRang.length > 0) {
    if (avecRang.length !== occupees.length) {
      return inachevee(
        `Il manque le classement de ${occupees.length - avecRang.length} participant(s) sur ` +
          `${occupees.length}.`,
      );
    }

    /**
     * 🔴 LES RANGS DOIVENT ÊTRE UNE PERMUTATION DE 1..N, ET C'EST LA GARDE QUI COMPTE.
     * Deux joueurs au rang 1, ou un rang 9 dans un lobby de 8, ne lèvent rien : le classement
     * s'affiche, et `pointsDePlacement` rend **0** pour un placement hors bornes — donc des
     * points silencieusement faux, sur un tournoi entier. C'est exactement la famille du « 8
     * codé en dur » que la 10.3 a corrigé (dette R60).
     */
    const rangs = avecRang.map((p) => p.rank as number).sort((a, b) => a - b);
    const attendus = Array.from({ length: occupees.length }, (_, i) => i + 1);
    if (rangs.some((rang, i) => rang !== attendus[i])) {
      return inachevee(
        `Les places doivent aller de 1 à ${occupees.length}, une seule fois chacune. ` +
          `Saisi : ${rangs.join(", ")}.`,
      );
    }

    const ordonnees = [...avecRang].sort((a, b) => (a.rank as number) - (b.rank as number));
    const ordre = ordonnees.map((p) => p.entryId as string);

    return {
      complete: true,
      raison: null,
      vainqueur: ordre[0],
      // Le perdant n'a de sens qu'à deux places — voir le type.
      perdant: places.length === 2 ? ordre[ordre.length - 1] : null,
      ordre,
      exemption: false,
    };
  }

  // ── Dépouillement PAR SCORE — le cas d'un bracket (2-1, 3-0) ─────────────────────────
  if (avecScore.length > 0) {
    if (avecScore.length !== occupees.length) {
      return inachevee(
        `Il manque le score de ${occupees.length - avecScore.length} participant(s) sur ` +
          `${occupees.length}.`,
      );
    }

    const ordonnees = [...avecScore].sort((a, b) => (b.score as number) - (a.score as number));

    /**
     * ⚠️ UNE ÉGALITÉ NE DÉSIGNE PAS DE VAINQUEUR, ET ON NE LA TRANCHE PAS ICI. Départager au
     * hasard, ou par ordre de saisie, ferait monter quelqu'un au tour suivant sans raison — et
     * de façon **non reproductible** d'une lecture à l'autre, ce qui est le défaut R31 déjà payé
     * sur les sollicitations. Un match nul dans un tableau à élimination est une situation à
     * régler par un humain (belle, prolongation), pas par un tri.
     */
    if (ordonnees.length >= 2 && ordonnees[0].score === ordonnees[1].score) {
      return inachevee(
        `Égalité en tête (${ordonnees[0].score} partout) : il n'y a pas de vainqueur. ` +
          "Départagez la rencontre avant de continuer.",
      );
    }

    const ordre = ordonnees.map((p) => p.entryId as string);
    return {
      complete: true,
      raison: null,
      vainqueur: ordre[0],
      perdant: places.length === 2 ? ordre[ordre.length - 1] : null,
      ordre,
      exemption: false,
    };
  }

  return inachevee("Aucun résultat saisi.");
}

/**
 * L'engagé qu'une provenance désigne, une fois la rencontre amont dépouillée.
 *
 * ⚠️ Rend `null` quand la rencontre amont n'est pas dépouillée — la place **attend**, elle n'est
 * pas vide. Et `null` aussi pour le perdant d'une exemption : personne n'a perdu une rencontre
 * qui n'a pas eu lieu, donc rien ne descend dans le tableau des perdants.
 */
export const occupantDepuis = (
  issue: IssueDeRencontre,
  de: "vainqueur" | "perdant",
): string | null => {
  if (!issue.complete) return null;
  return de === "vainqueur" ? issue.vainqueur : issue.perdant;
};
