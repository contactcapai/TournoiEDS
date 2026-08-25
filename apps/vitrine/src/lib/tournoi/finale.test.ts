import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { PlaceLue } from "./classement";
import {
  SEUIL_VICTOIRE_DEFAUT,
  issueDeLaFinale,
  manchesDeFinale,
  seuilDeLaFinale,
  type PlaceDeFinale,
} from "./finale";

const place = (manche: number, qui: string, placement: number, points: number): PlaceDeFinale => ({
  manche,
  entryId: qui,
  nom: qui,
  placement,
  points,
});

/** Trois manches gagnées d'affilée : 8 + 8 + 6 = 22 points AVANT la 4ᵉ. */
const vingtDeux = [place(1, "a", 1, 8), place(2, "a", 1, 8), place(3, "a", 1, 6)];

describe("victoire en finale — le seuil se franchit AVANT la manche du top 1", () => {
  it("22 pts avant + top 1 → vainqueur", () => {
    const issue = issueDeLaFinale([...vingtDeux, place(4, "a", 1, 8)], 20);
    assert.equal(issue.vainqueur?.entryId, "a");
    assert.equal(issue.vainqueur?.total, 30);
  });

  it("20 pts PILE avant + top 1 → vainqueur, le seuil est inclusif", () => {
    const avant = [place(1, "a", 1, 8), place(2, "a", 1, 8), place(3, "a", 3, 4)];
    const issue = issueDeLaFinale([...avant, place(4, "a", 1, 8)], 20);
    assert.equal(issue.vainqueur?.entryId, "a");
    assert.equal(issue.vainqueur?.total, 28);
  });

  it("🔴 14 pts avant + top 1 (→ 22) → PAS vainqueur : le seuil a été franchi PENDANT", () => {
    // C'est LE cas qui discrimine. Un total final de 22 ≥ 20 et un top 1 : tout est réuni
    // SAUF l'ordre, et l'ordre est la règle (« d'abord les 20 points, PUIS le top 1 »).
    const issue = issueDeLaFinale([place(1, "a", 1, 8), place(2, "a", 2, 6), place(3, "a", 1, 8)], 20);
    assert.equal(issue.vainqueur, null);
    assert.deepEqual(
      issue.enPositionDeGagner.map((f) => f.total),
      [22],
      "il a maintenant 22 pts : un top 1 à la manche suivante lui donne le tournoi",
    );
  });

  it("25 pts mais PAS top 1 de la manche → personne ne gagne", () => {
    const issue = issueDeLaFinale(
      [...vingtDeux, place(4, "a", 2, 6), place(4, "b", 1, 8)],
      20,
    );
    assert.equal(issue.vainqueur, null, "b est top 1 mais n'avait aucun point avant");
  });

  it("un top 1 DISPUTÉ n'en est pas un — on n'invente jamais une place", () => {
    // Rien en base n'interdit deux rangs 1 dans une même table. L'ancienne app prenait le
    // premier trouvé ; en écrire un serait inventer un vainqueur (doctrine `podiumVisible`).
    const issue = issueDeLaFinale([...vingtDeux, place(4, "a", 1, 8), place(4, "b", 1, 8)], 20);
    assert.equal(issue.vainqueur, null);
  });

  it("une finale sans aucun résultat n'affirme rien", () => {
    assert.deepEqual(issueDeLaFinale([], 20), {
      vainqueur: null,
      enPositionDeGagner: [],
      seuil: 20,
      derniereManche: null,
    });
  });

  it("la dernière manche est la dernière DÉPOUILLÉE, pas la dernière générée", () => {
    // Une manche seulement générée ne porte aucune place jouée : elle n'entre pas ici, donc
    // elle ne peut pas faire passer la manche 3 pour une manche antérieure.
    const issue = issueDeLaFinale([...vingtDeux, place(4, "a", 1, 8)], 20);
    assert.equal(issue.derniereManche, 4);
  });
});

describe("qui peut encore gagner — le signal du moment", () => {
  it("liste ceux qui ont déjà le seuil, du meilleur au moins bon", () => {
    const issue = issueDeLaFinale(
      [place(1, "a", 1, 8), place(1, "b", 2, 7), place(2, "a", 2, 7), place(2, "b", 1, 8), place(2, "c", 8, 1)],
      14,
    );
    assert.deepEqual(
      issue.enPositionDeGagner.map((f) => `${f.nom}:${f.total}`),
      // 15 points chacun : le total ne les sépare pas, le nom tranche — un ordre TOTAL, sinon
      // deux lectures de la même finale se liraient dans deux ordres différents (dette R31).
      ["a:15", "b:15"],
    );
  });

  it("personne sous le seuil n'y figure", () => {
    const issue = issueDeLaFinale([place(1, "a", 1, 8)], 20);
    assert.deepEqual(issue.enPositionDeGagner, []);
  });
});

describe("le seuil — la PREMIÈRE manche de la finale gouverne tout le bloc", () => {
  it("prend celui de la première manche, jamais celui d'une suivante", () => {
    assert.equal(seuilDeLaFinale([{ seuil: 30 }, { seuil: 20 }, { seuil: 99 }]), 30);
  });

  it("retombe sur le défaut quand la première manche n'en porte pas", () => {
    // Le cas des finales DÉJÀ en base : `settings` y vaut `{}`, donc le seuil est `null`.
    assert.equal(seuilDeLaFinale([{ seuil: null }, { seuil: 30 }]), SEUIL_VICTOIRE_DEFAUT);
    assert.equal(seuilDeLaFinale([]), SEUIL_VICTOIRE_DEFAUT);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   LA TRADUCTION BASE → RÈGLE — l'endroit où l'erreur est MUETTE
   ═══════════════════════════════════════════════════════════════════════════════ */

const lue = (
  phasePosition: number,
  matchId: string,
  entryId: string,
  rank: number | null,
): PlaceLue => ({
  matchId,
  entryId,
  nom: entryId,
  abandonne: false,
  rank,
  phaseKind: "finale",
  phasePosition,
});

describe("manchesDeFinale — de la base à la règle", () => {
  it("les points suivent la taille RÉELLE de la table", () => {
    // Trois assis à une table de finale : le 1ᵉʳ marque 3, pas 8. Même arithmétique que le
    // classement, et c'est pour ça que `taillesParTable` est partagée.
    const manches = manchesDeFinale([
      lue(5, "m1", "a", 1),
      lue(5, "m1", "b", 2),
      lue(5, "m1", "c", 3),
    ]);
    assert.deepEqual(
      manches.map((m) => m.points),
      [3, 2, 1],
    );
  });

  it("les manches se numérotent par la POSITION de leur phase, pas par l'ordre des lignes", () => {
    // 🔴 C'est cette numérotation qui décide de ce qui est « antérieur », donc TOUTE la règle.
    // Les lignes arrivent ici dans l'ordre 9 puis 7 : le résultat doit rester 7 → 1, 9 → 2.
    const manches = manchesDeFinale([lue(9, "m2", "tardif", 1), lue(7, "m1", "tot", 1)]);
    const numero = new Map(manches.map((m) => [m.entryId, m.manche]));
    assert.equal(numero.get("tot"), 1, "position 7 : la première manche de la finale");
    assert.equal(numero.get("tardif"), 2, "position 9 : la seconde, malgré son arrivée en tête");
  });

  it("une place SANS RANG est écartée — sinon une manche vide passerait pour la dernière jouée", () => {
    const manches = manchesDeFinale([lue(1, "m1", "a", 1), lue(2, "m2", "a", null)]);
    assert.equal(manches.length, 1);
    assert.equal(manches[0].manche, 1, "la manche 2, non dépouillée, n'existe pas pour la règle");
  });

  it("bout à bout : deux manches jouées, le seuil franchi AVANT la seconde", () => {
    // Table de 2 : le vainqueur marque 2 points. Seuil à 2 ⇒ acquis à l'issue de la manche 1,
    // donc le top 1 de la manche 2 emporte la finale.
    const places = [
      lue(1, "m1", "a", 1),
      lue(1, "m1", "b", 2),
      lue(2, "m2", "a", 1),
      lue(2, "m2", "b", 2),
    ];
    const issue = issueDeLaFinale(manchesDeFinale(places), 2);
    assert.equal(issue.vainqueur?.nom, "a");
    assert.equal(issue.vainqueur?.total, 4);
  });
});
