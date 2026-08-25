import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  agregerParEngage,
  classementPubliable,
  classer,
  lobbiesSuisses,
  pointsDePlacement,
  repartirEnLobbies,
  statistiques,
  type EngageClassable,
  type PlaceLue,
} from "./classement";

const stats = (
  total: number,
  premieres = 0,
  moitieHaute = 0,
  dernierPlacement = 1,
) => ({ total, premieres, moitieHaute, dernierPlacement, manchesJouees: 1, moyenne: total });

const engage = (id: string, nom: string, s: ReturnType<typeof stats>, abandonne = false):
  EngageClassable => ({ id, nom, stats: s, abandonne });

describe("points — le « TFT à 8 » a disparu", () => {
  it("donne N points au premier d'un lobby de N, et 1 au dernier", () => {
    assert.equal(pointsDePlacement(1, 8), 8);
    assert.equal(pointsDePlacement(8, 8), 1);
    assert.equal(pointsDePlacement(1, 6), 6);
    assert.equal(pointsDePlacement(6, 6), 1);
  });

  it("ne rend PLUS le barème de 8 sur un lobby plus petit", () => {
    // Le défaut de l'original, mesuré : il rendait 8 pour un 1er dans un lobby de 6.
    assert.notEqual(pointsDePlacement(1, 6), 8);
    assert.equal(pointsDePlacement(1, 6), 6);
  });

  it("refuse un placement impossible plutôt que de rendre un nombre négatif", () => {
    assert.equal(pointsDePlacement(9, 8), 0);
    assert.equal(pointsDePlacement(0, 8), 0);
    assert.equal(pointsDePlacement(1, 0), 0);
  });
});

describe("répartition en lobbies — plus jamais de lobby orphelin", () => {
  const tailles = (groupes: unknown[][]) => groupes.map((g) => g.length);
  const joueurs = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  it("équilibre au lieu de découper en tranches", () => {
    // L'original rendait [8, 2] à 10 joueurs. Personne ne veut jouer le lobby de 2.
    assert.deepEqual(tailles(repartirEnLobbies(joueurs(10), 8)), [5, 5]);
    assert.deepEqual(tailles(repartirEnLobbies(joueurs(17), 8)), [6, 6, 5]);
    assert.deepEqual(tailles(repartirEnLobbies(joueurs(9), 8)), [5, 4]);
  });

  it("laisse les comptes ronds intacts", () => {
    assert.deepEqual(tailles(repartirEnLobbies(joueurs(16), 8)), [8, 8]);
    assert.deepEqual(tailles(repartirEnLobbies(joueurs(8), 8)), [8]);
  });

  it("rend UN lobby incomplet quand l'effectif est plus petit que la cible", () => {
    // « Un lobby à 7 au lieu de 8 » — le cas que le pointage doit rendre possible.
    assert.deepEqual(tailles(repartirEnLobbies(joueurs(7), 8)), [7]);
    assert.deepEqual(tailles(repartirEnLobbies(joueurs(3), 8)), [3]);
  });

  it("n'écarte jamais plus d'une place entre le plus grand et le plus petit lobby", () => {
    for (let n = 1; n <= 40; n += 1) {
      const t = tailles(repartirEnLobbies(joueurs(n), 8));
      assert.ok(Math.max(...t) - Math.min(...t) <= 1, `${n} joueurs -> ${t.join(",")}`);
      assert.equal(
        t.reduce((s, x) => s + x, 0),
        n,
        `${n} joueurs : personne ne doit disparaître`,
      );
    }
  });

  it("CONSERVE l'ordre reçu — c'est lui qui porte le sens", () => {
    // Mélanger ici rendrait la méthode suisse fausse en silence.
    assert.deepEqual(repartirEnLobbies([1, 2, 3, 4], 2), [
      [1, 2],
      [3, 4],
    ]);
  });
});

describe("statistiques — la « moitié haute » remplace le top 4", () => {
  const manches = [
    { placement: 1, points: 8, ordre: 1 },
    { placement: 5, points: 4, ordre: 2 },
    { placement: 3, points: 6, ordre: 3 },
  ];

  it("compte la moitié haute d'un lobby de 8 : les places 1 à 4", () => {
    const s = statistiques(manches, 8);
    assert.equal(s.total, 18);
    assert.equal(s.premieres, 1);
    assert.equal(s.moitieHaute, 2, "les places 1 et 3");
    assert.equal(s.manchesJouees, 3);
  });

  it("resserre le seuil sur un lobby de 6 : les places 1 à 3", () => {
    // Avec « top 4 » en dur, la 4e place d'un lobby de 6 aurait compté — deux tiers du plateau.
    assert.equal(statistiques([{ placement: 4, points: 3, ordre: 1 }], 6).moitieHaute, 0);
    assert.equal(statistiques([{ placement: 3, points: 4, ordre: 1 }], 6).moitieHaute, 1);
  });

  it("prend le dernier résultat par l'ORDRE, pas par la position dans la liste", () => {
    assert.equal(statistiques(manches, 8).dernierPlacement, 3, "la manche d'ordre 3");
  });

  it("rend des zéros sans planter quand rien n'a été joué", () => {
    assert.deepEqual(statistiques([], 8), {
      total: 0,
      premieres: 0,
      moitieHaute: 0,
      dernierPlacement: 0,
      manchesJouees: 0,
      moyenne: 0,
    });
  });
});

describe("classement", () => {
  it("applique les départages dans l'ordre éprouvé", () => {
    const rangs = classer([
      engage("a", "Alice", stats(20, 1, 2, 3)),
      engage("b", "Bob", stats(20, 2, 2, 5)),
      engage("c", "Chloe", stats(25, 0, 1, 8)),
    ]);
    assert.deepEqual(
      rangs.map((r) => r.nom),
      ["Chloe", "Bob", "Alice"],
      "les points d'abord, puis les premières places",
    );
  });

  it("départage par le MEILLEUR dernier résultat, donc le plus PETIT placement", () => {
    const rangs = classer([
      engage("a", "Alice", stats(10, 1, 1, 7)),
      engage("b", "Bob", stats(10, 1, 1, 2)),
    ]);
    assert.equal(rangs[0].nom, "Bob");
  });

  it("🔴 rend un ordre TOTAL — deux ex æquo parfaits ne changent plus de place", () => {
    // L'original s'arrêtait au dernier résultat : l'ordre de deux égaux était indéterminé,
    // donc le classement affiché n'était pas reproductible (famille R31).
    const egaux = [engage("z", "Zoe", stats(10, 1, 1, 3)), engage("a", "Alice", stats(10, 1, 1, 3))];
    const premier = classer(egaux).map((r) => r.id);
    const second = classer([...egaux].reverse()).map((r) => r.id);
    assert.deepEqual(premier, second, "le même ensemble donne le même ordre");
    assert.deepEqual(premier, ["a", "z"], "et il est déterminé par le nom");
  });

  it("numérote les rangs à partir de 1, sans trou", () => {
    const rangs = classer([
      engage("a", "Alice", stats(30)),
      engage("b", "Bob", stats(20)),
      engage("c", "Chloe", stats(10)),
    ]);
    assert.deepEqual(
      rangs.map((r) => r.rang),
      [1, 2, 3],
    );
  });

  it("garde au classement un engagé qui a ABANDONNÉ (dette R60)", () => {
    // Le retirer réécrirait les manches où ses adversaires l'ont battu.
    const rangs = classer([
      engage("a", "Alice", stats(30)),
      engage("b", "Bob", stats(40), true),
    ]);
    assert.equal(rangs[0].nom, "Bob");
    assert.equal(rangs.length, 2);
  });
});

describe("méthode suisse", () => {
  it("regroupe par niveau : les meilleurs ensemble", () => {
    const lobbies = lobbiesSuisses(
      [
        engage("a", "A", stats(10)),
        engage("b", "B", stats(40)),
        engage("c", "C", stats(30)),
        engage("d", "D", stats(20)),
      ],
      2,
    );
    assert.deepEqual(
      lobbies.map((l) => l.map((e) => e.nom)),
      [
        ["B", "C"],
        ["D", "A"],
      ],
    );
  });

  it("ÉCARTE de la manche suivante ceux qui ont abandonné", () => {
    const lobbies = lobbiesSuisses(
      [
        engage("a", "A", stats(40)),
        engage("b", "B", stats(30), true),
        engage("c", "C", stats(20)),
      ],
      2,
    );
    assert.deepEqual(
      lobbies.flat().map((e) => e.nom),
      ["A", "C"],
      "B est au classement mais ne rejoue pas",
    );
  });
});

describe("statistiques — le seuil de moitié haute suit la taille de CHAQUE table (Story 10.8)", () => {
  it("🔴 deux manches de tailles différentes ne partagent pas un seul seuil", () => {
    // 17 participants donnent des lobbies de 6, 6, 5 (`repartirEnLobbies`). Une 3ᵉ place est
    // dans la moitié haute d'un lobby de 6 (seuil 3) et PAS dans celle d'un lobby de 5
    // (seuil 3 aussi)… il faut donc un écart plus net : 4ᵉ sur 8 (seuil 4, dedans) contre
    // 4ᵉ sur 5 (seuil 3, dehors).
    const s = statistiques(
      [
        { placement: 4, points: 5, ordre: 1, tailleDuLobby: 8 },
        { placement: 4, points: 2, ordre: 2, tailleDuLobby: 5 },
      ],
      8,
    );
    assert.equal(
      s.moitieHaute,
      1,
      "la 4ᵉ place compte sur une table de 8, pas sur une table de 5",
    );
  });

  it("le repli reste le paramètre quand la manche ne porte pas sa taille", () => {
    // Garde de non-régression : les appelants d'avant la 10.8 ne changent pas de comportement.
    const s = statistiques([{ placement: 3, points: 4, ordre: 1 }], 6);
    assert.equal(s.moitieHaute, 1);
  });

  it("un seul seuil global aurait donné un autre résultat — le test discrimine", () => {
    const parTable = statistiques(
      [
        { placement: 3, points: 6, ordre: 1, tailleDuLobby: 8 },
        { placement: 3, points: 1, ordre: 2, tailleDuLobby: 3 },
      ],
      8,
    );
    const seuilUnique = statistiques(
      [
        { placement: 3, points: 6, ordre: 1 },
        { placement: 3, points: 1, ordre: 2 },
      ],
      8,
    );
    assert.equal(parTable.moitieHaute, 1);
    assert.equal(seuilUnique.moitieHaute, 2);
    assert.notEqual(parTable.moitieHaute, seuilUnique.moitieHaute);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   DES PLACES LUES EN BASE À UN CLASSEMENT (Story 14.2)
   ═══════════════════════════════════════════════════════════════════════════════ */

const place = (
  matchId: string,
  entryId: string,
  rank: number | null,
  abandonne = false,
): PlaceLue => ({ matchId, entryId, nom: entryId, abandonne, rank });

describe("agrégat — les places d'une table deviennent un classement", () => {
  it("compte la taille RÉELLE de la table, pas la taille générée", () => {
    // Trois personnes assises à une table : le 1ᵉʳ marque 3, pas 8.
    const lignes = agregerParEngage([
      place("m1", "a", 1),
      place("m1", "b", 2),
      place("m1", "c", 3),
    ]);
    const parNom = new Map(lignes.map((l) => [l.nom, l.stats.total]));
    assert.deepEqual([parNom.get("a"), parNom.get("b"), parNom.get("c")], [3, 2, 1]);
  });

  it("une place SANS RANG ne compte pas comme manche jouée — mais crée quand même la ligne", () => {
    // C'est le comportement du back-office, et c'est exactement ce que `classementPubliable`
    // existe pour ne PAS publier. Le figer ici évite qu'on le « corrige » côté admin.
    const [ligne] = agregerParEngage([place("m1", "a", null), place("m1", "b", null)]);
    assert.equal(ligne.stats.manchesJouees, 0);
    assert.equal(ligne.stats.total, 0);
  });

  it("l'ORDRE reçu situe les manches dans le temps — il départage le dernier résultat", () => {
    // Deux engagés à égalité parfaite de points, de premières et de moitié haute : seul le
    // MEILLEUR DERNIER résultat les sépare, donc l'ordre d'arrivée des tables décide.
    const lignes = agregerParEngage([
      place("m1", "a", 1),
      place("m1", "b", 2),
      place("m2", "a", 2),
      place("m2", "b", 1),
    ]);
    const derniers = new Map(lignes.map((l) => [l.nom, l.stats.dernierPlacement]));
    assert.equal(derniers.get("a"), 2);
    assert.equal(derniers.get("b"), 1);
    assert.equal(classer(lignes)[0].nom, "b");
  });

  it("l'abandon remonte jusqu'à la ligne, sans lui retirer ses points", () => {
    const [ligne] = agregerParEngage([place("m1", "a", 1, true), place("m1", "b", 2)]);
    assert.equal(ligne.abandonne, true);
    assert.equal(ligne.stats.total, 2);
  });
});

describe("publication — on nomme qui a JOUÉ (Story 14.2)", () => {
  it("retire les engagés sans aucune manche jouée", () => {
    // Le cas réel : une manche générée, une seule table dépouillée. Les autres sont assis,
    // pas encore joués — les nommer à 0 point serait nommer quelqu'un pour rien.
    const classement = classer(
      agregerParEngage([
        place("m1", "a", 1),
        place("m1", "b", 2),
        place("m2", "c", null),
        place("m2", "d", null),
      ]),
    );
    assert.equal(classement.length, 4);
    const publie = classementPubliable(classement);
    assert.deepEqual(
      publie.map((l) => l.nom),
      ["a", "b"],
    );
  });

  it("un tournoi joué au SCORE ne publie RIEN — aucune place ne porte de rang", () => {
    // Un bracket se dépouille au score : `getClassementDuTournoi` rend alors tout le plateau
    // à 0 point. Sans ce filtre, la fiche publique nommerait tout le monde pour rien.
    const classement = classer(
      agregerParEngage([place("m1", "a", null), place("m1", "b", null)]),
    );
    assert.equal(classement.length, 2);
    assert.equal(classementPubliable(classement).length, 0);
  });

  it("un DROP qui a joué garde sa ligne, son pseudo et sa place", () => {
    const publie = classementPubliable(
      classer(agregerParEngage([place("m1", "a", 1, true), place("m1", "b", 2)])),
    );
    assert.deepEqual(
      publie.map((l) => l.nom),
      ["a", "b"],
    );
    assert.equal(publie[0].abandonne, true);
  });

  it("les rangs restent 1..N, sans trou, et sans bouger ceux du haut", () => {
    // Une manche jouée vaut au moins 1 point : les lignes retirées sont toujours strictement
    // dernières, donc la renumérotation ne déplace personne. Ce test le PROUVE au lieu de le
    // supposer — c'est la seule raison pour laquelle le classement public et celui du
    // back-office peuvent afficher les mêmes numéros le même jour.
    const classement = classer(
      agregerParEngage([
        place("m1", "a", 1),
        place("m1", "b", 2),
        place("m1", "c", 3),
        place("m2", "z", null),
      ]),
    );
    const publie = classementPubliable(classement);
    assert.deepEqual(
      publie.map((l) => l.rang),
      [1, 2, 3],
    );
    for (const ligne of publie) {
      assert.equal(ligne.rang, classement.find((l) => l.id === ligne.id)?.rang);
    }
  });
});
