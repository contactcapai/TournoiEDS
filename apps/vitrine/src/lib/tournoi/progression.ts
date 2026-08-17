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
  /**
   * ══════════════════════════════════════════════════════════════════════════════════════
   * 🔴 CETTE PLACE VIDE NE SERA-T-ELLE **JAMAIS** POURVUE ? DÉFAUT RÉEL, TROUVÉ PAR LE TEST.
   * ══════════════════════════════════════════════════════════════════════════════════════
   *
   * Une place vide est deux choses très différentes : une **exemption** (le tableau est plus
   * grand que l'effectif, personne ne viendra jamais) ou une place qui **attend** le vainqueur
   * d'une rencontre pas encore jouée. Ce module comptait les occupants sans les distinguer — son
   * en-tête l'annonçait même — et la conséquence était grave : au 2ᵉ tour d'un tableau de 8 pour
   * 5 présents, une rencontre « un occupant + une place en attente » était lue comme une
   * exemption, et **le joueur montait en finale sans avoir joué**. Aucune erreur, aucune trace.
   *
   * ⚠️ LE DÉFAUT VAUT `false` — donc « elle peut encore être pourvue », donc **pas d'exemption**.
   * C'est le sens sûr : à omettre l'information, on fait attendre à tort (visible, corrigeable)
   * au lieu de faire monter à tort (invisible, et devant les joueurs).
   *
   * ⚠️ Elle se dérive **transitivement**, et c'est pour ça que `calculerPropagation` est le seul
   * endroit qui la calcule : une place qui attend le PERDANT d'une exemption n'aura jamais
   * personne non plus — il faut avoir dépouillé l'amont pour le savoir.
   */
  readonly jamaisPourvue?: boolean;
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
    const autre = places.find((p) => p.entryId === null);
    // 🔴 SEULEMENT SI L'AUTRE PLACE NE SERA JAMAIS POURVUE. Sinon la rencontre ATTEND — voir
    // `PlaceJouee.jamaisPourvue`, et le défaut qu'elle documente.
    if (autre?.jamaisPourvue === true) {
      return {
        complete: true,
        raison: null,
        vainqueur: occupees[0].entryId,
        perdant: null,
        ordre: [occupees[0].entryId as string],
        exemption: true,
      };
    }
    return inachevee(
      "Cette rencontre attend encore son second participant — la rencontre qui le désigne " +
        "n'est pas dépouillée.",
    );
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
 * Une saisie est-elle ADMISSIBLE — indépendamment du fait qu'elle soit complète ?
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 DEUX QUESTIONS DIFFÉRENTES, ET LES CONFONDRE COÛTE DES POINTS FAUX
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `issueDeRencontre` répond à « la rencontre est-elle dépouillée ». Celle-ci répond à « peut-on
 * ENREGISTRER ça ». Ce n'est pas la même chose : on saisit un lobby de 8 au fur et à mesure, donc
 * une saisie **partielle** doit s'enregistrer. Mais une saisie partielle **fausse** ne doit pas.
 *
 * 🔴 LE CAS QUI COÛTE : DEUX JOUEURS AU MÊME RANG. `issueDeRencontre` le refuse — mais seulement
 * quand la rencontre est complète. Deux rangs 1 sur un lobby de 8 à moitié saisi passeraient
 * donc, et `getClassementDuTournoi` compte **toute** place portant un rang comme une manche
 * jouée : deux premières places, des points doublés, et rien à l'écran pour le dire.
 *
 * ⚠️ Les règles de rang vivent ICI et nulle part ailleurs. Les recopier dans l'action en ferait
 * une seconde définition, qui divergerait de celle du dépouillement.
 */
export function saisieAdmissible(
  places: readonly PlaceJouee[],
): { ok: true } | { ok: false; raison: string } {
  const occupees = places.filter((p) => p.entryId !== null);
  const borne = occupees.length;

  const rangs: number[] = [];
  for (const p of occupees) {
    if (p.rank === null) continue;
    if (!Number.isInteger(p.rank) || p.rank < 1 || p.rank > borne) {
      return {
        ok: false,
        raison: `Une place doit être un entier entre 1 et ${borne}. Reçu : ${p.rank}.`,
      };
    }
    if (rangs.includes(p.rank)) {
      return { ok: false, raison: `La place ${p.rank} est attribuée deux fois.` };
    }
    rangs.push(p.rank);
  }

  for (const p of occupees) {
    if (p.score === null) continue;
    if (!Number.isInteger(p.score) || p.score < 0) {
      return { ok: false, raison: `Un score doit être un entier positif. Reçu : ${p.score}.` };
    }
  }

  // 🔴 UN RÉSULTAT SUR UNE PLACE VIDE EST REFUSÉ. Sans ça, un score saisi sur une place qui
  // attend encore le vainqueur d'une rencontre amont serait écrasé sans un mot à la propagation
  // suivante — ou, pire, compté au classement pour personne.
  const vides = places.filter((p) => p.entryId === null && (p.rank !== null || p.score !== null));
  if (vides.length > 0) {
    return {
      ok: false,
      raison: "Un résultat est saisi sur une place qui n'a pas encore de participant.",
    };
  }

  return { ok: true };
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

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LA PROPAGATION — QUI MONTE OÙ. **PURE**, ET C'EST DÉLIBÉRÉ.
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Cette décision est la plus risquée de la Story 10.8 : elle avance des joueurs d'un tour à
 * l'autre, et une erreur y fait jouer les mauvaises personnes. Elle vit donc **hors de la
 * transaction**, où elle se teste sans base — l'action ne fait que lire, appeler, écrire.
 *
 * 🔴 ELLE SE RECALCULE EN ENTIER, ELLE NE S'APPLIQUE PAS PAR INCRÉMENTS. Une propagation
 * incrémentale (« ce résultat vient de tomber, je pousse le vainqueur d'un cran ») est fausse dès
 * la première **correction** : quand on rectifie un score du 1ᵉʳ tour, tout l'aval est déjà rempli
 * avec l'ancien vainqueur et rien ne va le reprendre. Un tournoi d'association passe son temps à
 * corriger des saisies faites dans le bruit d'une salle.
 *
 * ⚠️ UN SEUL PASSAGE SUFFIT, et ce n'est pas de la chance : `generation.ts` alloue les `position`
 * de telle sorte qu'une source ne désigne jamais qu'une position **inférieure**. On dépouille donc
 * dans l'ordre croissant, et l'aval est toujours traité après son amont.
 *
 * 🔴 ET UN CHANGEMENT D'OCCUPANT EFFACE LE RÉSULTAT DE SA PLACE. Si le vainqueur du tour 1 change,
 * la place du tour 2 change d'occupant : y garder le score le rattacherait à quelqu'un qui n'a
 * jamais joué cette rencontre. C'est le seul effacement automatique de cette story.
 */
export type PlaceAPropager = PlaceJouee & {
  readonly slotId: string;
  /** La provenance stockée. `null` ou une tête de série : la place ne bouge jamais. */
  readonly source: { readonly de: string; readonly rencontre?: number } | null;
};

export type RencontreAPropager = {
  readonly matchId: string;
  readonly position: number;
  readonly places: readonly PlaceAPropager[];
};

export type Propagation = {
  /** Les places dont l'occupant change. Leur score et leur rang doivent être effacés. */
  readonly deplacements: readonly { slotId: string; entryId: string | null }[];
  /** L'issue de chaque rencontre, par `matchId` — pour tenir `state` à jour. */
  readonly issues: ReadonlyMap<string, IssueDeRencontre>;
};

export function calculerPropagation(
  rencontres: readonly RencontreAPropager[],
): Propagation {
  // Copie mutable : on avance les occupants au fil des tours avant de rendre les écritures.
  const parPosition = new Map<
    number,
    { matchId: string; position: number; places: (PlaceJouee & { slotId: string; source: PlaceAPropager["source"] })[] }
  >();
  for (const rencontre of rencontres) {
    parPosition.set(rencontre.position, {
      matchId: rencontre.matchId,
      position: rencontre.position,
      places: rencontre.places.map((place) => ({ ...place })),
    });
  }

  const deplacements: { slotId: string; entryId: string | null }[] = [];
  const issues = new Map<string, IssueDeRencontre>();

  for (const position of [...parPosition.keys()].sort((a, b) => a - b)) {
    const rencontre = parPosition.get(position);
    if (!rencontre) continue;

    /**
     * 🔴 ON DÉCIDE ICI, ET SEULEMENT ICI, SI UNE PLACE VIDE EST DÉFINITIVE. La règle est
     * transitive, donc elle a besoin de l'amont déjà dépouillé — ce que l'ordre croissant des
     * `position` garantit :
     *   · une tête de série sans rang, ou une place sans provenance → jamais pourvue ;
     *   · une place qui attend un vainqueur ou un perdant → jamais pourvue **si** l'amont est
     *     dépouillé et ne désigne personne (le perdant d'une exemption, typiquement) ;
     *   · sinon elle ATTEND, et sa rencontre n'est pas une exemption.
     */
    const places = rencontre.places.map((place) => {
      if (place.entryId !== null) return place;
      const source = place.source;
      if (!source || (source.de !== "vainqueur" && source.de !== "perdant")) {
        return { ...place, jamaisPourvue: true };
      }
      const amont = source.rencontre === undefined ? undefined : issues.get(
        [...parPosition.values()].find((r) => r.position === source.rencontre)?.matchId ?? "",
      );
      if (amont === undefined || !amont.complete) return { ...place, jamaisPourvue: false };
      return {
        ...place,
        jamaisPourvue: occupantDepuis(amont, source.de) === null,
      };
    });

    const issue = issueDeRencontre(places);
    issues.set(rencontre.matchId, issue);

    for (const autre of parPosition.values()) {
      if (autre.position <= position) continue;
      for (let i = 0; i < autre.places.length; i += 1) {
        const place = autre.places[i];
        const source = place.source;
        if (!source || source.rencontre !== position) continue;
        if (source.de !== "vainqueur" && source.de !== "perdant") continue;

        const voulu = occupantDepuis(issue, source.de);
        if (voulu === place.entryId) continue;

        // Muter la copie est sûr : `autre.position > position`, donc cette rencontre n'a pas
        // encore été dépouillée dans cette boucle.
        autre.places[i] = { ...place, entryId: voulu, score: null, rank: null };
        deplacements.push({ slotId: place.slotId, entryId: voulu });
      }
    }
  }

  return { deplacements, issues };
}
