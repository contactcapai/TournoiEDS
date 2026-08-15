import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  eliminationDouble,
  eliminationSimple,
  ordreDeTableau,
  placer,
  roundRobin,
  tailleDeTableau,
  type Place,
  type RencontreGeneree,
  type Source,
  type TourGenere,
} from "./bracket";

const compterRencontres = (tours: TourGenere[]) =>
  tours.reduce((total, tour) => total + tour.rencontres.length, 0);

const tetesDeSerie = (tour: TourGenere) =>
  tour.rencontres.flatMap((r) =>
    r.sources.map((s: Source) => (s.de === "tete_de_serie" ? s.place : undefined)),
  );

/** Les paires réellement jouées d'un round robin, normalisées pour comparer sans les côtés. */
const paires = (tours: TourGenere[]) =>
  tours.flatMap((tour) =>
    tour.rencontres
      .map((r) => r.sources.map((s) => (s.de === "tete_de_serie" ? s.place : null)))
      .filter(([a, b]) => a !== null && b !== null)
      .map(([a, b]) => [a, b].sort((x, y) => (x as number) - (y as number)).join("-")),
  );

describe("taille du tableau et ordre standard", () => {
  it("arrondit à la puissance de deux supérieure", () => {
    assert.equal(tailleDeTableau(1), 1);
    assert.equal(tailleDeTableau(3), 4);
    assert.equal(tailleDeTableau(8), 8);
    assert.equal(tailleDeTableau(9), 16);
  });

  it("rend l'ordre standard, celui où 1 et 2 ne se croisent qu'en finale", () => {
    assert.deepEqual(ordreDeTableau(2), [1, 2]);
    assert.deepEqual(ordreDeTableau(4), [1, 4, 3, 2]);
    assert.deepEqual(ordreDeTableau(8), [1, 8, 5, 4, 3, 6, 7, 2]);
  });

  it("met les deux premières têtes de série dans des MOITIÉS opposées", () => {
    for (const taille of [4, 8, 16, 32]) {
      const ordre = ordreDeTableau(taille);
      const moitie = (n: number) => (ordre.indexOf(n) < taille / 2 ? "haut" : "bas");
      assert.notEqual(moitie(1), moitie(2), `taille ${taille}`);
    }
  });
});

describe("placement et exemptions", () => {
  it("donne les exemptions aux MIEUX classés", () => {
    // 3 engagés dans un tableau de 4 : c'est la tête de série 1 qui passe le tour.
    assert.deepEqual(placer(3), [1, null, 3, 2]);
    // 5 dans un tableau de 8 : les trois premiers passent.
    const p5 = placer(5);
    assert.equal(p5.length, 8);
    assert.deepEqual(
      p5.map((x, i) => (x === null ? i : -1)).filter((i) => i >= 0).length,
      3,
      "trois places vides",
    );
    assert.equal(p5[1], null, "la tête de série 1 est exemptée");
  });

  it("place tout le monde exactement une fois, quel que soit l'ordre", () => {
    for (const ordre of ["naturel", "inverse", "demi_decalage"] as const) {
      const places = placer(6, ordre).filter((x) => x !== null).sort((a, b) => a! - b!);
      assert.deepEqual(places, [1, 2, 3, 4, 5, 6], `ordre ${ordre}`);
    }
  });
});

describe("élimination simple", () => {
  it("rend log2(taille) tours et taille-1 rencontres", () => {
    const t8 = eliminationSimple(8);
    assert.equal(t8.length, 3);
    assert.deepEqual(
      t8.map((t) => t.rencontres.length),
      [4, 2, 1],
    );
    assert.equal(compterRencontres(t8), 7, "8 engagés = 7 rencontres");
  });

  it("fait jouer chaque engagé exactement une fois au premier tour", () => {
    const premier = eliminationSimple(8)[0];
    const vus = tetesDeSerie(premier).filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
    assert.deepEqual(vus, [1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("gère un effectif qui n'est PAS une puissance de deux", () => {
    // Le cas « 3 équipes au lieu de 4 » du pointage — celui qui doit marcher le jour J.
    const t3 = eliminationSimple(3);
    assert.equal(compterRencontres(t3), 3, "tableau de 4 = 3 rencontres, exemption comprise");
    const exemptions = t3[0].rencontres.filter((r) =>
      r.sources.some((s) => s.de === "tete_de_serie" && s.place === null),
    );
    assert.equal(exemptions.length, 1, "une seule exemption");
  });

  it("fait progresser les vainqueurs vers la bonne rencontre", () => {
    const [, deuxieme] = eliminationSimple(8);
    assert.deepEqual(deuxieme.rencontres[0].sources, [
      { de: "vainqueur", bracket: "vainqueurs", round: 1, position: 1 },
      { de: "vainqueur", bracket: "vainqueurs", round: 1, position: 2 },
    ]);
  });

  it("ne rend rien en dessous de deux engagés", () => {
    assert.deepEqual(eliminationSimple(1), []);
    assert.deepEqual(eliminationSimple(0), []);
  });
});

describe("double élimination", () => {
  it("rend 2N-2 rencontres au total, grande finale comprise", () => {
    for (const n of [4, 8, 16]) {
      const { vainqueurs, perdants, grandeFinale } = eliminationDouble(n);
      const total =
        compterRencontres(vainqueurs) + compterRencontres(perdants) + compterRencontres(grandeFinale);
      assert.equal(total, 2 * n - 2, `${n} engagés`);
    }
  });

  it("donne 2k-2 tours au bracket des perdants, et non k", () => {
    // C'est l'erreur classique : le bracket des perdants alterne, il a presque deux fois
    // plus de tours que celui des vainqueurs.
    for (const n of [4, 8, 16, 32]) {
      const { vainqueurs, perdants } = eliminationDouble(n);
      assert.equal(perdants.length, 2 * vainqueurs.length - 2, `${n} engagés`);
    }
  });

  it("alterne : les tours pairs font DESCENDRE un perdant du bracket des vainqueurs", () => {
    const { perdants } = eliminationDouble(8);
    const tour2 = perdants[1];
    assert.equal(tour2.round, 2);
    for (const rencontre of tour2.rencontres) {
      const origines = rencontre.sources.map((s) => s.de);
      assert.ok(origines.includes("vainqueur"), "un rescapé du tour précédent");
      assert.ok(origines.includes("perdant"), "un descendant du bracket des vainqueurs");
    }
  });

  it("n'alterne PAS aux tours impairs : entre rescapés seulement", () => {
    const { perdants } = eliminationDouble(8);
    const tour3 = perdants[2];
    assert.equal(tour3.round, 3);
    for (const rencontre of tour3.rencontres) {
      assert.ok(
        rencontre.sources.every((s) => s.de === "vainqueur" && s.bracket === "perdants"),
        "aucun descendant à un tour impair",
      );
    }
  });

  it("fait descendre les perdants dans l'ORDRE INVERSE, pour éviter une revanche immédiate", () => {
    const { perdants } = eliminationDouble(8);
    const descendants = perdants[1].rencontres.map((r) => {
      const s = r.sources.find((x) => x.de === "perdant");
      return s && s.de === "perdant" ? s.position : -1;
    });
    assert.deepEqual(descendants, [2, 1], "les positions descendent, elles ne montent pas");
  });

  it("oppose en grande finale le vainqueur de chaque bracket", () => {
    const { vainqueurs, perdants, grandeFinale } = eliminationDouble(8);
    assert.deepEqual(grandeFinale[0].rencontres[0].sources, [
      { de: "vainqueur", bracket: "vainqueurs", round: vainqueurs.length, position: 1 },
      { de: "vainqueur", bracket: "perdants", round: perdants.length, position: 1 },
    ]);
  });
});

/**
 * Vérifier tour par tour ne dit pas si le tableau tient DE BOUT EN BOUT. On le joue donc pour
 * de vrai : la meilleure tête de série gagne toujours, une place vide perd toujours, et on
 * résout les rencontres dans l'ordre où leurs sources deviennent disponibles.
 */
const jouerDoubleElimination = (nombre: number) => {
  const { vainqueurs, perdants, grandeFinale } = eliminationDouble(nombre);
  const resultats = new Map<string, { vainqueur: Place; perdant: Place }>();
  const cle = (b: string, r: number, p: number) => `${b}/${r}/${p}`;
  const defaites = new Map<number, number>();

  const resoudre = (source: Source): Place | undefined => {
    if (source.de === "tete_de_serie") return source.place;
    const r = resultats.get(cle(source.bracket, source.round, source.position));
    if (!r) return undefined;
    return source.de === "vainqueur" ? r.vainqueur : r.perdant;
  };

  const aJouer: { bracket: string; tour: TourGenere; rencontre: RencontreGeneree }[] = [];
  for (const [bracket, tours] of [
    ["vainqueurs", vainqueurs],
    ["perdants", perdants],
    ["grande_finale", grandeFinale],
  ] as const) {
    for (const tour of tours) for (const rencontre of tour.rencontres) aJouer.push({ bracket, tour, rencontre });
  }

  let restant = aJouer;
  let tours = 0;
  while (restant.length > 0) {
    if (tours++ > 100) throw new Error("dependances circulaires : le tableau ne se resout pas");
    const encore: typeof restant = [];
    for (const item of restant) {
      const [a, b] = item.rencontre.sources.map(resoudre);
      if (a === undefined || b === undefined) {
        encore.push(item);
        continue;
      }
      // Une place vide perd ; sinon le plus petit numéro l'emporte.
      const vainqueur = a === null ? b : b === null ? a : Math.min(a, b);
      const perdant = vainqueur === a ? b : a;
      if (typeof perdant === "number") defaites.set(perdant, (defaites.get(perdant) ?? 0) + 1);
      resultats.set(cle(item.bracket, item.tour.round, item.rencontre.position), { vainqueur, perdant });
    }
    if (encore.length === restant.length) throw new Error("blocage : aucune rencontre resolvable");
    restant = encore;
  }

  const finale = resultats.get(cle("grande_finale", 1, 1))!;
  return { finale, defaites };
};

describe("double élimination — le tableau JOUÉ de bout en bout", () => {
  it("se résout entièrement, sans blocage ni dépendance circulaire", () => {
    for (const n of [4, 8, 16]) {
      assert.doesNotThrow(() => jouerDoubleElimination(n), `${n} engagés`);
    }
  });

  it("oppose bien les deux meilleurs en grande finale", () => {
    for (const n of [4, 8, 16]) {
      const { finale } = jouerDoubleElimination(n);
      assert.equal(finale.vainqueur, 1, `${n} engagés — vainqueur`);
      assert.equal(finale.perdant, 2, `${n} engagés — finaliste`);
    }
  });

  it("n'élimine PERSONNE avant sa DEUXIÈME défaite — c'est tout le contrat", () => {
    const { defaites } = jouerDoubleElimination(8);
    for (const [seed, n] of defaites) {
      assert.ok(n <= 2, `la tête de série ${seed} a perdu ${n} fois`);
    }
    // Tout le monde sauf le champion finit avec exactement deux défaites.
    const perdantsDefinitifs = [...defaites.entries()].filter(([, n]) => n === 2);
    assert.equal(perdantsDefinitifs.length, 7, "7 éliminés sur 8 engagés");
    assert.equal(defaites.get(1) ?? 0, 0, "le champion ne perd jamais");
  });
});

describe("round robin", () => {
  it("fait se rencontrer chaque paire EXACTEMENT une fois", () => {
    const p = paires(roundRobin(6));
    assert.equal(p.length, 15, "6 participants = 15 paires");
    assert.equal(new Set(p).size, 15, "aucune paire en double");
  });

  it("rend N-1 tours pour un effectif pair", () => {
    assert.equal(roundRobin(6).length, 5);
    assert.equal(roundRobin(4).length, 3);
  });

  it("fait reposer un participant par tour quand l'effectif est IMPAIR", () => {
    const tours = roundRobin(5);
    assert.equal(tours.length, 5, "tableau de 6, donc 5 tours");
    for (const tour of tours) {
      const repos = tour.rencontres.filter((r) =>
        r.sources.some((s) => s.de === "tete_de_serie" && s.place === null),
      );
      assert.equal(repos.length, 1, `tour ${tour.round}`);
    }
    const p = paires(tours);
    assert.equal(new Set(p).size, 10, "5 participants = 10 paires, toutes distinctes");
  });

  it("ne fait jamais jouer quelqu'un deux fois dans le même tour", () => {
    for (const tour of roundRobin(8)) {
      const joueurs = tour.rencontres
        .flatMap((r) => r.sources.map((s) => (s.de === "tete_de_serie" ? s.place : null)))
        .filter((x): x is number => typeof x === "number");
      assert.equal(new Set(joueurs).size, joueurs.length, `tour ${tour.round}`);
    }
  });

  it("en aller-retour, rejoue chaque paire une seconde fois en inversant les côtés", () => {
    const simple = roundRobin(4);
    const double = roundRobin(4, true);
    assert.equal(double.length, simple.length * 2);
    const p = paires(double);
    assert.equal(p.length, 12, "chaque paire deux fois");
    assert.equal(new Set(p).size, 6, "sur 6 paires distinctes");
    // Les côtés sont bien inversés, sinon on rejouerait le même match.
    assert.deepEqual(double[simple.length].rencontres[0].sources, [
      simple[0].rencontres[0].sources[1],
      simple[0].rencontres[0].sources[0],
    ]);
  });

  it("ne rend rien en dessous de deux participants", () => {
    assert.deepEqual(roundRobin(1), []);
  });
});
