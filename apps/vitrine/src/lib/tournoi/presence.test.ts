import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { etatAffiche, joueCeJourLa, pointagesDuJour } from "./presence";

/**
 * Le pointage par journée (2026-08-24).
 *
 * 🔴 CE QUI PEUT ÊTRE FAUX EN SILENCE EST L'ORDRE DES TROIS ÉTAGES, et chacun casse
 * différemment : sans le repli sur l'état global, TOUS les tournois d'un seul jour cessent de
 * se générer (leurs phases n'ont aucune date, donc aucun pointage de journée) ; sans la
 * priorité de l'abandon, quelqu'un qui a arrêté revient au week-end suivant parce qu'une
 * ligne de présence traîne. Aucun des deux ne lève d'erreur.
 */
describe("joueCeJourLa — l'ordre des trois étages", () => {
  it("🔴 un abandon l'emporte sur TOUT pointage de journée", () => {
    assert.equal(joueCeJourLa("abandonne", "present"), false, "qui a arrêté ne revient pas");
    assert.equal(joueCeJourLa("abandonne", undefined), false);
  });

  it("suit le pointage de la journée quand il existe", () => {
    assert.equal(joueCeJourLa("present", "absent"), false, "présent au tournoi, pas ce jour-là");
    assert.equal(joueCeJourLa("absent", "present"), true, "absent la dernière fois, revenu");
  });

  it("🔴 retombe sur l'état global quand la journée n'est pas pointée", () => {
    // Le cas de TOUS les tournois d'un seul jour : aucune phase datée, donc aucun pointage de
    // journée. Sans ce repli, plus personne n'est présent nulle part.
    assert.equal(joueCeJourLa("present", undefined), true);
    assert.equal(joueCeJourLa("absent", undefined), false);
    assert.equal(joueCeJourLa("inscrit", undefined), false, "inscrit n'est pas pointé");
  });
});

describe("etatAffiche — « pas encore pointé » n'est pas « absent »", () => {
  it("montre l'état global tant que la journée n'est pas pointée", () => {
    assert.equal(etatAffiche("inscrit", undefined), "inscrit");
  });

  it("montre le pointage du jour dès qu'il existe", () => {
    assert.equal(etatAffiche("inscrit", "present"), "present");
    assert.equal(etatAffiche("present", "absent"), "absent");
  });

  it("montre l'abandon quoi qu'il arrive", () => {
    assert.equal(etatAffiche("abandonne", "present"), "abandonne");
  });
});

describe("pointagesDuJour — on ne lit QUE la journée demandée", () => {
  const lignes = [
    { entryId: "alice", playedOn: "2026-09-05", state: "present" as const },
    { entryId: "alice", playedOn: "2026-09-12", state: "absent" as const },
    { entryId: "bob", playedOn: "2026-09-12", state: "present" as const },
  ];

  it("ne retient que les lignes du jour", () => {
    const pointages = pointagesDuJour(lignes, "2026-09-12");
    assert.equal(pointages.get("alice"), "absent");
    assert.equal(pointages.get("bob"), "present");
    assert.equal(pointages.size, 2);
  });

  it("🔴 le pointage d'une journée n'écrase PAS celui d'une autre", () => {
    // Tout l'objet de la table : avant, pointer le 12 effaçait le 5.
    assert.equal(pointagesDuJour(lignes, "2026-09-05").get("alice"), "present");
    assert.equal(pointagesDuJour(lignes, "2026-09-12").get("alice"), "absent");
  });

  it("🔴 rend une Map VIDE pour une phase non datée — donc repli sur l'état global", () => {
    assert.equal(pointagesDuJour(lignes, null).size, 0);
  });

  it("rend une Map vide pour un jour où personne n'a été pointé", () => {
    assert.equal(pointagesDuJour(lignes, "2026-09-19").size, 0);
  });
});
