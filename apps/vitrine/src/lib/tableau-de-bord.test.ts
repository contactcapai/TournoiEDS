import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  composerAttentes,
  galerieEnAttente,
  libelleJournee,
  type LecturesTableauDeBord,
} from "./tableau-de-bord";

// Les deux règles de ce module sont DATÉES, donc fausses en silence : un « se joue demain »
// affiché le jour même, ou une alerte de galerie qui ne s'éteint jamais, n'ont l'air de rien.
// C'est le seul endroit de la Story 13.3 qui méritait des tests — le reste est du rendu.

describe("le jour où ça se joue", () => {
  it("nomme aujourd'hui, demain, et date le reste", () => {
    assert.equal(libelleJournee("2026-08-25", "2026-08-25"), "aujourd'hui");
    assert.equal(libelleJournee("2026-08-26", "2026-08-25"), "demain");
    assert.equal(libelleJournee("2026-08-29", "2026-08-25"), "samedi 29 août");
  });

  it("tient les deux week-ends de bascule d'heure", () => {
    // Ces nuits-là durent 23 h ou 25 h : un écart calculé en millisecondes ferait basculer
    // « demain » en « aujourd'hui » une fois l'an, sur deux jours seulement.
    assert.equal(libelleJournee("2026-10-25", "2026-10-24"), "demain"); // → heure d'hiver
    assert.equal(libelleJournee("2026-03-29", "2026-03-28"), "demain"); // → heure d'été
  });
});

describe("la galerie restée muette", () => {
  const evenement = { id: "e1", titre: "Jeudi au Kraken", jour: "2026-07-30", photos: 0 };

  it("le signale tant que l'événement est récent, et se tait ensuite", () => {
    // 30 jours est une BORNE INCLUSIVE : au 31e, ce n'est plus ce qui attend, c'est l'histoire.
    assert.equal(galerieEnAttente(evenement, "2026-08-29"), true); // 30 jours
    assert.equal(galerieEnAttente(evenement, "2026-08-30"), false); // 31 jours
  });

  it("se tait dès qu'une photo existe, ou s'il n'y a jamais eu d'événement", () => {
    assert.equal(galerieEnAttente({ ...evenement, photos: 1 }, "2026-08-01"), false);
    assert.equal(galerieEnAttente(null, "2026-08-01"), false);
  });
});

describe("la bande n'annonce que ce que le compte peut ouvrir", () => {
  it("ne dit rien d'une section fermée, même quand elle aurait quelque chose à dire", () => {
    // Le cas RÉEL depuis la Story 8.1 : un administrateur de tournoi n'ouvre que « Tournois ».
    // Lui annoncer des sollicitations, ou que l'agenda est vide, serait une porte sans pièce.
    const lectures: LecturesTableauDeBord = {
      sollicitations: null,
      agenda: null,
      tournois: { quiSeJouent: [{ id: "t1", nom: "TFT des Sacres", journee: "2026-08-25" }] },
      galerie: null,
    };

    const attentes = composerAttentes(lectures, "2026-08-25");

    assert.deepEqual(
      attentes.map((attente) => attente.cle),
      ["tournoi-t1"],
    );
    assert.equal(attentes[0]?.texte, "TFT des Sacres se joue aujourd'hui");
  });

  it("réserve le corail à ce qu'une personne attend vraiment", () => {
    const lectures: LecturesTableauDeBord = {
      sollicitations: { aTraiter: 2 },
      agenda: { prochain: null },
      tournois: { quiSeJouent: [] },
      galerie: { dernierEvenement: null },
    };

    const attentes = composerAttentes(lectures, "2026-08-25");

    assert.deepEqual(
      attentes.map((attente) => [attente.cle, attente.urgent]),
      [
        ["sollicitations", true],
        ["agenda-vide", false],
      ],
    );
    assert.equal(attentes[0]?.texte, "2 sollicitations attendent une réponse");
  });
});
