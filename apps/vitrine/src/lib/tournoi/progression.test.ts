import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { issueDeRencontre, occupantDepuis, type PlaceJouee } from "./progression";

/**
 * Le dépouillement d'une rencontre (Story 10.8).
 *
 * 🔴 CE QUI SE TESTE ICI EST CE QUI DONNE DES POINTS FAUX **SANS RIEN LEVER** : deux joueurs au
 * même rang, un rang hors bornes, une égalité en tête. `pointsDePlacement` rend **0** pour un
 * placement hors bornes — donc un classement entier faux, et personne pour le dire.
 */

const place = (
  position: number,
  entryId: string | null,
  extra: { score?: number; rank?: number } = {},
): PlaceJouee => ({
  position,
  entryId,
  score: extra.score ?? null,
  rank: extra.rank ?? null,
});

describe("issueDeRencontre — l'exemption se résout SANS saisie", () => {
  it("une place occupée sur deux : l'occupant passe, et c'est marqué exemption", () => {
    const issue = issueDeRencontre([place(1, "alice"), place(2, null)]);
    assert.equal(issue.complete, true);
    assert.equal(issue.exemption, true);
    assert.equal(issue.vainqueur, "alice");
    // 🔴 PERSONNE N'A PERDU une rencontre qui n'a pas eu lieu : rien ne doit descendre dans le
    // tableau des perdants. Rendre « alice » ou l'absent ferait entrer un fantôme.
    assert.equal(issue.perdant, null);
  });

  it("l'exemption ne s'applique QU'À DEUX PLACES", () => {
    // Un lobby de 8 où une seule personne s'est présentée n'est pas une exemption : désigner un
    // vainqueur qui n'a joué contre personne fausserait le classement.
    const lobby = [place(1, "alice"), ...[2, 3, 4, 5, 6, 7, 8].map((p) => place(p, null))];
    const issue = issueDeRencontre(lobby);
    assert.equal(issue.complete, false);
    assert.equal(issue.exemption, false);
    assert.match(issue.raison ?? "", /un seul participant/);
  });

  it("aucune place occupée : la rencontre attend, elle n'est pas gagnée", () => {
    const issue = issueDeRencontre([place(1, null), place(2, null)]);
    assert.equal(issue.complete, false);
    assert.equal(issue.vainqueur, null);
  });
});

describe("issueDeRencontre — dépouillement par RANG (lobbies, TFT)", () => {
  it("un lobby de 4 classé 1..4 rend l'ordre complet", () => {
    const issue = issueDeRencontre([
      place(1, "alice", { rank: 3 }),
      place(2, "bob", { rank: 1 }),
      place(3, "chloe", { rank: 4 }),
      place(4, "david", { rank: 2 }),
    ]);
    assert.equal(issue.complete, true);
    assert.equal(issue.vainqueur, "bob");
    assert.deepEqual(issue.ordre, ["bob", "david", "alice", "chloe"]);
    // Plus de deux places : « le perdant » ne veut rien dire.
    assert.equal(issue.perdant, null);
  });

  it("🔴 refuse DEUX joueurs au même rang, et dit ce qui a été saisi", () => {
    const issue = issueDeRencontre([
      place(1, "alice", { rank: 1 }),
      place(2, "bob", { rank: 1 }),
      place(3, "chloe", { rank: 3 }),
    ]);
    assert.equal(issue.complete, false);
    assert.match(issue.raison ?? "", /de 1 à 3, une seule fois chacune/);
    assert.match(issue.raison ?? "", /1, 1, 3/);
  });

  it("🔴 refuse un rang HORS BORNES — c'est lui qui rendrait 0 point en silence", () => {
    const issue = issueDeRencontre([
      place(1, "alice", { rank: 1 }),
      place(2, "bob", { rank: 9 }),
    ]);
    assert.equal(issue.complete, false);
    assert.match(issue.raison ?? "", /de 1 à 2/);
  });

  it("refuse un classement incomplet, et dit combien il en manque", () => {
    const issue = issueDeRencontre([
      place(1, "alice", { rank: 1 }),
      place(2, "bob"),
      place(3, "chloe", { rank: 3 }),
    ]);
    assert.equal(issue.complete, false);
    assert.match(issue.raison ?? "", /manque le classement de 1 participant\(s\) sur 3/);
  });

  it("une place VIDE ne compte pas dans les rangs attendus", () => {
    // Un lobby de 8 généré, mais 6 présents à cette table : les rangs vont de 1 à 6.
    const issue = issueDeRencontre([
      place(1, "a", { rank: 1 }),
      place(2, "b", { rank: 2 }),
      place(3, "c", { rank: 3 }),
      place(4, "d", { rank: 4 }),
      place(5, "e", { rank: 5 }),
      place(6, "f", { rank: 6 }),
      place(7, null),
      place(8, null),
    ]);
    assert.equal(issue.complete, true);
    assert.equal(issue.vainqueur, "a");
    assert.equal(issue.ordre.length, 6);
  });
});

describe("issueDeRencontre — dépouillement par SCORE (bracket)", () => {
  it("2-1 désigne un vainqueur et un perdant", () => {
    const issue = issueDeRencontre([
      place(1, "alice", { score: 2 }),
      place(2, "bob", { score: 1 }),
    ]);
    assert.equal(issue.complete, true);
    assert.equal(issue.vainqueur, "alice");
    assert.equal(issue.perdant, "bob");
    assert.equal(issue.exemption, false);
  });

  it("un score de 0 est un score, pas une absence de saisie", () => {
    const issue = issueDeRencontre([
      place(1, "alice", { score: 3 }),
      place(2, "bob", { score: 0 }),
    ]);
    assert.equal(issue.complete, true);
    assert.equal(issue.vainqueur, "alice");
    assert.equal(issue.perdant, "bob");
  });

  it("🔴 une ÉGALITÉ ne désigne pas de vainqueur, et ne se tranche pas au hasard", () => {
    const issue = issueDeRencontre([
      place(1, "alice", { score: 2 }),
      place(2, "bob", { score: 2 }),
    ]);
    assert.equal(issue.complete, false);
    assert.equal(issue.vainqueur, null);
    assert.match(issue.raison ?? "", /Égalité en tête/);
  });

  it("refuse un score manquant", () => {
    const issue = issueDeRencontre([place(1, "alice", { score: 2 }), place(2, "bob")]);
    assert.equal(issue.complete, false);
    assert.match(issue.raison ?? "", /manque le score/);
  });

  it("le RANG l'emporte sur le score quand les deux sont saisis", () => {
    // Une seule règle de préséance, écrite une fois : sans elle, deux dépouillements
    // possibles pour la même rencontre — donc deux vainqueurs possibles.
    const issue = issueDeRencontre([
      place(1, "alice", { score: 0, rank: 1 }),
      place(2, "bob", { score: 99, rank: 2 }),
    ]);
    assert.equal(issue.complete, true);
    assert.equal(issue.vainqueur, "alice");
  });
});

describe("issueDeRencontre — rien de saisi", () => {
  it("deux participants sans score ni rang : la rencontre reste à jouer", () => {
    const issue = issueDeRencontre([place(1, "alice"), place(2, "bob")]);
    assert.equal(issue.complete, false);
    assert.equal(issue.raison, "Aucun résultat saisi.");
  });
});

describe("occupantDepuis — une place AMONT non dépouillée fait attendre, elle ne vide pas", () => {
  it("rend null tant que la rencontre amont n'est pas dépouillée", () => {
    const enCours = issueDeRencontre([place(1, "alice"), place(2, "bob")]);
    assert.equal(occupantDepuis(enCours, "vainqueur"), null);
    assert.equal(occupantDepuis(enCours, "perdant"), null);
  });

  it("rend le vainqueur et le perdant d'une rencontre jouée", () => {
    const jouee = issueDeRencontre([
      place(1, "alice", { score: 2 }),
      place(2, "bob", { score: 1 }),
    ]);
    assert.equal(occupantDepuis(jouee, "vainqueur"), "alice");
    assert.equal(occupantDepuis(jouee, "perdant"), "bob");
  });

  it("🔴 sur une exemption, le vainqueur monte mais AUCUN perdant ne descend", () => {
    const exemption = issueDeRencontre([place(1, "alice"), place(2, null)]);
    assert.equal(occupantDepuis(exemption, "vainqueur"), "alice");
    assert.equal(occupantDepuis(exemption, "perdant"), null);
  });
});
