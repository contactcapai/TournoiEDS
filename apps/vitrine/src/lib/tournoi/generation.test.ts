import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rangsPlaces, structureDePhase, type RencontreAGenerer } from "./generation";

/**
 * La traduction « moteur → base » (Story 10.8).
 *
 * 🔴 CE QUI SE TESTE ICI EST CE QUI EST FAUX **EN SILENCE**. Une source qui ne désigne aucune
 * rencontre ne lève rien : elle rend un tableau qui ne progresse jamais, et on s'en aperçoit
 * devant les joueurs, au deuxième tour. Ni l'œil ni le typecheck ne voient ça.
 *
 * ⚠️ On ne re-teste PAS les appariements : ils appartiennent à `bracket.ts` et à
 * `classement.ts`, qui ont leurs propres tests. Ici on teste la TRADUCTION.
 */

/** Toutes les positions référencées par une source existent-elles vraiment ? */
const sourcesResolues = (structure: readonly RencontreAGenerer[]) => {
  const positions = new Set(structure.map((r) => r.position));
  const orphelines: string[] = [];
  for (const rencontre of structure) {
    for (const place of rencontre.places) {
      if (place.source.de === "tete_de_serie") continue;
      if (!positions.has(place.source.rencontre)) {
        orphelines.push(`${rencontre.bracket} r${rencontre.round} p${rencontre.position}`);
      }
    }
  }
  return orphelines;
};

describe("structureDePhase — les positions sont uniques et les sources désignent du réel", () => {
  const cas = [
    { nom: "élimination simple à 8", kind: "bracket" as const, nombre: 8, reglages: {} },
    { nom: "élimination simple à 5 (exemptions)", kind: "bracket" as const, nombre: 5, reglages: {} },
    {
      nom: "double élimination à 8",
      kind: "bracket" as const,
      nombre: 8,
      reglages: { doubleElimination: true },
    },
    {
      nom: "double élimination à 5",
      kind: "bracket" as const,
      nombre: 5,
      reglages: { doubleElimination: true },
    },
    { nom: "poule à 6", kind: "poule" as const, nombre: 6, reglages: {} },
    { nom: "poule à 5 (effectif impair)", kind: "poule" as const, nombre: 5, reglages: {} },
    {
      nom: "poule à 4 aller-retour",
      kind: "poule" as const,
      nombre: 4,
      reglages: { allerRetour: true },
    },
    { nom: "lobbies à 17", kind: "lobbies" as const, nombre: 17, reglages: {} },
    { nom: "lobbies à 7", kind: "lobbies" as const, nombre: 7, reglages: {} },
    { nom: "finale à 12", kind: "finale" as const, nombre: 12, reglages: {} },
  ];

  for (const { nom, kind, nombre, reglages } of cas) {
    it(`${nom} : positions uniques, aucune source orpheline`, () => {
      const structure = structureDePhase(kind, nombre, reglages);
      assert.ok(structure.length > 0, "la structure ne doit pas être vide");

      const positions = structure.map((r) => r.position);
      assert.equal(
        new Set(positions).size,
        positions.length,
        "deux rencontres ne peuvent pas porter la même position dans une phase",
      );
      assert.deepEqual(
        [...positions].sort((a, b) => a - b),
        Array.from({ length: positions.length }, (_, i) => i + 1),
        "les positions doivent être 1..N sans trou",
      );

      assert.deepEqual(
        sourcesResolues(structure),
        [],
        "une source qui ne désigne aucune rencontre rend un tableau qui ne progresse jamais",
      );
    });
  }
});

describe("structureDePhase — chaque présent reçoit une place, et une seule", () => {
  const cas = [
    { kind: "bracket" as const, nombre: 5, reglages: {} },
    { kind: "bracket" as const, nombre: 8, reglages: { doubleElimination: true } },
    { kind: "poule" as const, nombre: 5, reglages: {} },
    { kind: "lobbies" as const, nombre: 17, reglages: {} },
  ];

  for (const { kind, nombre, reglages } of cas) {
    it(`${kind} à ${nombre} : les rangs 1..${nombre} sont tous placés`, () => {
      const structure = structureDePhase(kind, nombre, reglages);
      const rangs = rangsPlaces(structure);
      // 🔴 UN PRÉSENT OUBLIÉ EST UN DÉFAUT MUET : le tournoi tourne sans lui, et personne ne
      // voit d'erreur — juste quelqu'un qui attend.
      for (let rang = 1; rang <= nombre; rang += 1) {
        assert.ok(rangs.has(rang), `le rang ${rang} n'a aucune place`);
      }
      assert.equal(rangs.size, nombre, "aucun rang au-delà de l'effectif ne doit être placé");
    });
  }

  it("un lobby ne place jamais deux fois le même rang", () => {
    const structure = structureDePhase("lobbies", 17, {});
    const vus: number[] = [];
    for (const rencontre of structure) {
      for (const place of rencontre.places) {
        if (place.source.de === "tete_de_serie" && place.source.rang !== null) {
          vus.push(place.source.rang);
        }
      }
    }
    assert.equal(new Set(vus).size, vus.length, "un joueur ne peut pas être à deux tables");
  });
});

describe("structureDePhase — les lobbies sont ÉQUILIBRÉS, jamais découpés en tranches", () => {
  it("17 joueurs en cible 8 donnent 6, 6, 5 — et pas 8, 8, 1", () => {
    const tailles = structureDePhase("lobbies", 17, {}).map((r) => r.places.length);
    assert.deepEqual(tailles, [6, 6, 5]);
  });

  it("7 joueurs en cible 8 donnent UNE table de 7", () => {
    const tailles = structureDePhase("lobbies", 7, {}).map((r) => r.places.length);
    assert.deepEqual(tailles, [7]);
  });

  it("10 joueurs en cible 8 donnent 5 et 5 — et pas 8 et 2", () => {
    const tailles = structureDePhase("lobbies", 10, {}).map((r) => r.places.length);
    assert.deepEqual(tailles, [5, 5]);
  });
});

describe("structureDePhase — une finale est UNE table, pas une répartition", () => {
  it("12 présents en cible 8 : une seule table, les 8 premiers", () => {
    const structure = structureDePhase("finale", 12, {});
    assert.equal(structure.length, 1, "deux tables de finale ne départageraient rien");
    assert.equal(structure[0].places.length, 8);
    assert.deepEqual(
      structure[0].places.map((p) => (p.source.de === "tete_de_serie" ? p.source.rang : null)),
      [1, 2, 3, 4, 5, 6, 7, 8],
      "ce sont les premiers de la liste reçue — donc du classement, si l'appelant l'a trié",
    );
  });

  it("une cible de 2 rend la finale classique d'un bracket", () => {
    const structure = structureDePhase("finale", 9, { tailleDeLobby: 2 });
    assert.equal(structure.length, 1);
    assert.equal(structure[0].places.length, 2);
  });

  it("moins de présents que la cible : la table rétrécit, elle ne se complète pas de vide", () => {
    const structure = structureDePhase("finale", 3, {});
    assert.equal(structure[0].places.length, 3);
  });
});

describe("structureDePhase — l'élimination SIMPLE ne parle jamais du tableau « vainqueurs »", () => {
  it("toutes ses rencontres sont dans le tableau `principal`", () => {
    const structure = structureDePhase("bracket", 8, {});
    assert.ok(
      structure.every((r) => r.bracket === "principal"),
      "un seul tableau s'appelle `principal` — voir MATCH_BRACKETS",
    );
  });

  it("🔴 et ses sources désignent bien ce tableau, pas « vainqueurs »", () => {
    // C'est LE piège de ce module : `bracket.ts` émet toujours `bracket: "vainqueurs"`, même
    // pour une élimination simple. Sans normalisation, aucune source ne trouverait sa cible et
    // le tableau ne progresserait jamais — sans qu'aucune erreur ne soit levée.
    const structure = structureDePhase("bracket", 8, {});
    assert.deepEqual(sourcesResolues(structure), []);

    const tour2 = structure.filter((r) => r.round === 2);
    assert.ok(tour2.length > 0, "un tableau de 8 a bien un second tour");
    assert.ok(
      tour2.every((r) => r.places.every((p) => p.source.de === "vainqueur")),
      "les places du 2ᵉ tour viennent de vainqueurs, pas de têtes de série",
    );
  });
});

describe("structureDePhase — la double élimination porte ses TROIS tableaux", () => {
  it("un tableau de 8 rend vainqueurs, perdants et grande finale", () => {
    const structure = structureDePhase("bracket", 8, { doubleElimination: true });
    const tableaux = new Set(structure.map((r) => r.bracket));
    assert.deepEqual([...tableaux].sort(), ["grande_finale", "perdants", "vainqueurs"]);
  });

  it("la grande finale reçoit un vainqueur de CHAQUE tableau", () => {
    const structure = structureDePhase("bracket", 8, { doubleElimination: true });
    const finale = structure.find((r) => r.bracket === "grande_finale");
    assert.ok(finale, "il doit y avoir une grande finale");

    const sources = finale.places.map((p) => p.source);
    assert.ok(
      sources.every((s) => s.de === "vainqueur"),
      "les deux places viennent d'un vainqueur",
    );

    const cibles = sources.map((s) => (s.de === "vainqueur" ? s.rencontre : 0));
    const parPosition = new Map(structure.map((r) => [r.position, r]));
    assert.deepEqual(
      cibles.map((position) => parPosition.get(position)?.bracket).sort(),
      ["perdants", "vainqueurs"],
      "un côté vient du tableau des vainqueurs, l'autre de celui des perdants",
    );
  });

  it("le tableau des perdants reçoit bien des PERDANTS du tableau des vainqueurs", () => {
    const structure = structureDePhase("bracket", 8, { doubleElimination: true });
    const parPosition = new Map(structure.map((r) => [r.position, r]));
    const perdants = structure.filter((r) => r.bracket === "perdants");

    const sourcesPerdant = perdants.flatMap((r) =>
      r.places.filter((p) => p.source.de === "perdant"),
    );
    assert.ok(sourcesPerdant.length > 0, "le tableau des perdants doit en recevoir");
    assert.ok(
      sourcesPerdant.every(
        (p) =>
          p.source.de === "perdant" &&
          parPosition.get(p.source.rencontre)?.bracket === "vainqueurs",
      ),
      "un perdant descend TOUJOURS du tableau des vainqueurs",
    );
  });
});

describe("structureDePhase — une traduction qui échoue CRIE, elle ne fabrique pas d'exemption", () => {
  it("🔴 aucune place de 2ᵉ tour n'est une exemption dans un tableau plein", () => {
    // C'est le contrôle qui manquait, et son absence a laissé passer un sabotage volontaire de
    // `tableauReel` : toutes les places du 2ᵉ tour devenaient des « exemptions », sans erreur,
    // et le tableau ne progressait jamais. Le repli qui produisait ça a été retiré — une
    // coordonnée introuvable LÈVE désormais. Ce test garde l'invariant côté sortie.
    for (const reglages of [{}, { doubleElimination: true }]) {
      const structure = structureDePhase("bracket", 8, reglages);
      const apresLePremierTour = structure.filter(
        (r) => !(r.bracket !== "grande_finale" && r.round === 1),
      );
      assert.ok(apresLePremierTour.length > 0);

      for (const rencontre of apresLePremierTour) {
        for (const place of rencontre.places) {
          assert.notEqual(
            place.source.de,
            "tete_de_serie",
            `${rencontre.bracket} tour ${rencontre.round} : une place au-delà du 1ᵉʳ tour ne ` +
              "peut pas être une tête de série — si elle l'est, la traduction a échoué en silence",
          );
        }
      }
    }
  });

  it("un tableau de 8 en élimination simple a EXACTEMENT 4 places de têtes de série par côté", () => {
    // Contrôle de dénombrement, indépendant de la forme : 8 participants = 8 places de départ.
    const structure = structureDePhase("bracket", 8, {});
    const tetes = structure.flatMap((r) => r.places.filter((p) => p.source.de === "tete_de_serie"));
    assert.equal(tetes.length, 8, "un tableau de 8 a 8 places de départ, ni plus ni moins");
  });
});

describe("structureDePhase — les effectifs qui ne permettent rien", () => {
  it("0 participant ne rend aucune rencontre", () => {
    for (const kind of ["bracket", "poule", "lobbies", "finale"] as const) {
      assert.deepEqual(structureDePhase(kind, 0), [], `${kind} à 0`);
    }
  });

  it("1 participant ne rend aucune rencontre en bracket ni en poule", () => {
    // ⚠️ Vide n'est PAS une erreur : c'est un état que l'écran doit DIRE. Lever ici obligerait
    // l'appelant à distinguer « pas assez de monde » d'une panne.
    assert.deepEqual(structureDePhase("bracket", 1), []);
    assert.deepEqual(structureDePhase("poule", 1), []);
  });

  it("un effectif non entier ou négatif ne rend rien", () => {
    assert.deepEqual(structureDePhase("lobbies", -3), []);
    assert.deepEqual(structureDePhase("lobbies", 2.5), []);
  });
});
