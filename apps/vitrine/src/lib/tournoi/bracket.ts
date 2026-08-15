/**
 * Moteur de bracket — élimination simple, double élimination, round robin (Story 10.2).
 *
 * 🔴 CE MODULE NE CONNAÎT NI LA BASE NI LES ENGAGÉS. Il raisonne en **numéros de tête de
 * série** (1..N) et rend une structure. C'est l'appelant qui associe un numéro à un
 * `tournament_entry`. Sans ça, on ne pourrait ni le tester ni le rejouer.
 *
 * Provenance : la logique de placement, de byes et de bracket perdants s'inspire de l'état de
 * l'art public (notamment `brackets-manager`). Aucun code n'en est repris — un algorithme
 * n'est pas protégé, seule son expression l'est. Note gardée pour dire **où aller regarder**
 * le jour où un cas limite apparaît, pas par obligation.
 *
 * ⚠️ La justesse est la NÔTRE : un bracket faux se voit devant des joueurs. D'où les tests.
 */

/** Numéro de tête de série, ou `null` pour une place vide — une exemption (*bye*). */
export type Place = number | null;

/** D'où vient l'occupant d'une place. C'est ce qui dit qui arrive où. */
export type Source =
  | { de: "tete_de_serie"; place: Place }
  | { de: "vainqueur"; bracket: Bracket; round: number; position: number }
  | { de: "perdant"; bracket: "vainqueurs"; round: number; position: number };

export type Bracket = "vainqueurs" | "perdants";

export type RencontreGeneree = {
  position: number;
  /** Toujours deux places en bracket. Une place `null` au 1ᵉʳ tour est une exemption. */
  sources: [Source, Source];
};

export type TourGenere = { round: number; rencontres: RencontreGeneree[] };

export type OrdreDePlacement = "naturel" | "inverse" | "demi_decalage";

/**
 * La puissance de deux immédiatement supérieure ou égale. C'est la taille réelle du tableau :
 * un effectif de 3 se joue dans un tableau de 4, avec une exemption.
 */
export const tailleDeTableau = (nombre: number) => {
  if (nombre < 1) return 0;
  let taille = 1;
  while (taille < nombre) taille *= 2;
  return taille;
};

/**
 * L'ordre standard d'un tableau : celui qui fait que la tête de série 1 et la 2 ne peuvent se
 * rencontrer qu'en finale.
 *
 * Construction par doublement : chaque position `x` d'un tableau de taille `n` engendre la
 * paire `x` / `2n + 1 - x`. Pour 8 : [1,8,5,4,3,6,7,2].
 *
 * ⚠️ LE SENS DE LA PAIRE S'ALTERNE D'UNE POSITION À L'AUTRE, et l'oublier ne casse rien de
 * visible : sans l'alternance on obtient [1,8,4,5,2,7,3,6], qui respecte AUSSI « 1 et 2 ne se
 * croisent qu'en finale » et donne les mêmes demi-finales. Seul l'ORDRE D'AFFICHAGE change —
 * la tête de série 2 se retrouve au milieu du tableau au lieu du bas, là où tout le monde
 * s'attend à la voir. Défaut trouvé par les tests, pas à l'œil.
 */
export const ordreDeTableau = (taille: number): number[] => {
  if (taille < 1) return [];
  let ordre = [1];
  while (ordre.length < taille) {
    const n = ordre.length * 2;
    ordre = ordre.flatMap((x, i) => (i % 2 === 0 ? [x, n + 1 - x] : [n + 1 - x, x]));
  }
  return ordre;
};

/**
 * Place `nombre` engagés dans un tableau, en complétant par des exemptions.
 *
 * 🔴 LES EXEMPTIONS VONT AUX MIEUX CLASSÉS, ET CE N'EST PAS UN CHOIX ESTHÉTIQUE : les places
 * complétées portent les numéros les plus hauts, et l'ordre standard les met en face des
 * numéros les plus bas. C'est ce qui rend le cas « 3 équipes au lieu de 4 » correct sans
 * traitement particulier.
 */
export const placer = (nombre: number, ordre: OrdreDePlacement = "naturel"): Place[] => {
  const taille = tailleDeTableau(nombre);
  const rangs = ordreDeTableau(taille);
  const numeros = Array.from({ length: nombre }, (_, i) => i + 1);

  const classement =
    ordre === "inverse"
      ? [...numeros].reverse()
      : ordre === "demi_decalage"
        ? // Décale d'une demi-liste : utile quand les têtes de série viennent d'une phase de
          // poules et qu'on veut éviter que deux membres d'une même poule se croisent d'emblée.
          [...numeros.slice(Math.ceil(nombre / 2)), ...numeros.slice(0, Math.ceil(nombre / 2))]
        : numeros;

  return rangs.map((rang) => classement[rang - 1] ?? null);
};

const teteDeSerie = (place: Place): Source => ({ de: "tete_de_serie", place });

const vainqueurDe = (bracket: Bracket, round: number, position: number): Source => ({
  de: "vainqueur",
  bracket,
  round,
  position,
});

const perdantDe = (round: number, position: number): Source => ({
  de: "perdant",
  bracket: "vainqueurs",
  round,
  position,
});

/**
 * Élimination simple. Le premier tour part des places, les suivants des vainqueurs.
 *
 * ⚠️ Une rencontre du 1ᵉʳ tour dont une place est `null` est une exemption : elle se résout
 * sans être jouée. Ce module la RESTITUE plutôt que de la masquer — c'est à l'appelant de
 * décider s'il la crée en base, et le rendre implicite ici rendrait les tours faux.
 */
export const eliminationSimple = (
  nombre: number,
  ordre: OrdreDePlacement = "naturel",
): TourGenere[] => {
  const places = placer(nombre, ordre);
  if (places.length < 2) return [];

  const tours: TourGenere[] = [];
  let largeur = places.length / 2;

  tours.push({
    round: 1,
    rencontres: Array.from({ length: largeur }, (_, i) => ({
      position: i + 1,
      sources: [teteDeSerie(places[2 * i]), teteDeSerie(places[2 * i + 1])] as [Source, Source],
    })),
  });

  let round = 2;
  while (largeur > 1) {
    largeur = largeur / 2;
    tours.push({
      round,
      rencontres: Array.from({ length: largeur }, (_, i) => ({
        position: i + 1,
        sources: [
          vainqueurDe("vainqueurs", round - 1, 2 * i + 1),
          vainqueurDe("vainqueurs", round - 1, 2 * i + 2),
        ] as [Source, Source],
      })),
    });
    round += 1;
  }

  return tours;
};

/**
 * Double élimination : bracket des vainqueurs, bracket des perdants, grande finale.
 *
 * 🔴 LA STRUCTURE DU BRACKET DES PERDANTS ALTERNE, et c'est le seul point réellement piégeux :
 * · tour 1 — les perdants du tour 1 des vainqueurs s'affrontent entre eux ;
 * · tours PAIRS — les rescapés affrontent les perdants du tour suivant des vainqueurs
 *   (« ils descendent ») : l'effectif ne diminue pas, le nombre de rencontres non plus ;
 * · tours IMPAIRS (au-delà du 1ᵉʳ) — les rescapés s'affrontent entre eux, l'effectif est divisé.
 * D'où `2k - 2` tours pour un tableau de `2^k`, et non `k`.
 *
 * ⚠️ Les perdants entrent dans l'ORDRE INVERSE des positions du tour dont ils viennent. Ce
 * n'est pas cosmétique : dans l'ordre direct, deux joueurs qui viennent de s'affronter dans le
 * bracket des vainqueurs se retrouvent immédiatement face à face dans celui des perdants.
 */
export const eliminationDouble = (
  nombre: number,
  ordre: OrdreDePlacement = "naturel",
): { vainqueurs: TourGenere[]; perdants: TourGenere[]; grandeFinale: TourGenere[] } => {
  const vainqueurs = eliminationSimple(nombre, ordre);
  if (vainqueurs.length === 0) return { vainqueurs: [], perdants: [], grandeFinale: [] };

  const k = vainqueurs.length; // tours du bracket des vainqueurs = log2(taille)
  const perdants: TourGenere[] = [];

  if (k >= 2) {
    // Tour 1 : uniquement des perdants du tour 1, appariés à rebours.
    const matchsT1 = vainqueurs[0].rencontres.length; // = taille / 2
    perdants.push({
      round: 1,
      rencontres: Array.from({ length: matchsT1 / 2 }, (_, i) => ({
        position: i + 1,
        sources: [perdantDe(1, matchsT1 - 2 * i), perdantDe(1, matchsT1 - 2 * i - 1)] as [
          Source,
          Source,
        ],
      })),
    });

    for (let round = 2; round <= 2 * k - 2; round += 1) {
      const precedent = perdants[round - 2];
      const nbPrecedent = precedent.rencontres.length;

      if (round % 2 === 0) {
        // Tour PAIR : un rescapé contre un perdant qui descend du bracket des vainqueurs.
        const tourSource = round / 2 + 1;
        perdants.push({
          round,
          rencontres: Array.from({ length: nbPrecedent }, (_, i) => ({
            position: i + 1,
            sources: [
              vainqueurDe("perdants", round - 1, i + 1),
              perdantDe(tourSource, nbPrecedent - i),
            ] as [Source, Source],
          })),
        });
      } else {
        // Tour IMPAIR : entre rescapés, l'effectif est divisé.
        perdants.push({
          round,
          rencontres: Array.from({ length: nbPrecedent / 2 }, (_, i) => ({
            position: i + 1,
            sources: [
              vainqueurDe("perdants", round - 1, 2 * i + 1),
              vainqueurDe("perdants", round - 1, 2 * i + 2),
            ] as [Source, Source],
          })),
        });
      }
    }
  }

  const grandeFinale: TourGenere[] =
    k >= 1
      ? [
          {
            round: 1,
            rencontres: [
              {
                position: 1,
                sources: [
                  vainqueurDe("vainqueurs", k, 1),
                  perdants.length > 0
                    ? vainqueurDe("perdants", perdants.length, 1)
                    : teteDeSerie(null),
                ] as [Source, Source],
              },
            ],
          },
        ]
      : [];

  return { vainqueurs, perdants, grandeFinale };
};

/**
 * Round robin — chacun rencontre chacun, par la méthode du cercle.
 *
 * Un participant reste fixe, les autres tournent d'un cran à chaque tour. Pour un effectif
 * IMPAIR on ajoute un participant fantôme : celui qui l'affronte se repose ce tour-là, et sa
 * rencontre porte une place `null`.
 *
 * ⚠️ `allerRetour` double les tours en inversant les rôles, il ne rejoue pas les mêmes paires
 * dans le même sens.
 */
export const roundRobin = (nombre: number, allerRetour = false): TourGenere[] => {
  if (nombre < 2) return [];

  const impair = nombre % 2 === 1;
  const participants: Place[] = Array.from({ length: nombre }, (_, i) => i + 1);
  if (impair) participants.push(null);

  const taille = participants.length;
  const tours: TourGenere[] = [];

  // Le premier reste fixe ; les `taille - 1` autres tournent.
  let rotation = participants.slice(1);

  for (let round = 1; round <= taille - 1; round += 1) {
    const colonne: Place[] = [participants[0], ...rotation];
    const rencontres: RencontreGeneree[] = [];

    for (let i = 0; i < taille / 2; i += 1) {
      const a = colonne[i];
      const b = colonne[taille - 1 - i];
      // Alterne les côtés d'un tour à l'autre : sans ça le participant fixe recevrait
      // toujours la même position, ce qui compte dès qu'un côté a un avantage.
      const paire: [Place, Place] = round % 2 === 0 ? [b, a] : [a, b];
      rencontres.push({
        position: rencontres.length + 1,
        sources: [teteDeSerie(paire[0]), teteDeSerie(paire[1])],
      });
    }

    tours.push({ round, rencontres });
    rotation = [rotation[rotation.length - 1], ...rotation.slice(0, -1)];
  }

  if (!allerRetour) return tours;

  const retour = tours.map((tour) => ({
    round: tour.round + tours.length,
    rencontres: tour.rencontres.map((r) => ({
      position: r.position,
      sources: [r.sources[1], r.sources[0]] as [Source, Source],
    })),
  }));

  return [...tours, ...retour];
};
