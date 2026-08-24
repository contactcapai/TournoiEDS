import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ajouterJours,
  jourLisible,
  parisWallClockFromInput,
  parisWallClockOptionnelFromInput,
  toInputValue,
} from "./date-paris";

// Les fuseaux se trompent EN SILENCE : le site affiche une heure fausse sans rien casser,
// et personne ne le voit avant que quelqu'un se déplace pour rien. D'où ce fichier.
describe("saisie d'une heure murale de Paris", () => {
  it("fait l'aller-retour saisie → instant → saisie, été comme hiver", () => {
    // Été (UTC+2) et hiver (UTC+1) : c'est le décalage qui casse les allers-retours naïfs.
    for (const saisie of ["2026-08-13T20:30", "2026-01-15T20:30"]) {
      const instant = parisWallClockFromInput(saisie);
      assert.ok(instant, saisie);
      assert.equal(toInputValue(instant), saisie);
    }
  });

  it("refuse les dépassements de borne au lieu de les reporter", () => {
    // Date.UTC reporte silencieusement : "2026-13-32T25:99" deviendrait 2027-02-02 02:39.
    for (const saisie of ["2026-13-32T25:99", "2026-00-15T19:00", "n'importe quoi", ""]) {
      assert.equal(parisWallClockFromInput(saisie), null, saisie);
    }
  });

  it("refuse une date qui n'existe pas au calendrier", () => {
    // 2026 n'est pas bissextile : le 29 février glissait au 1ᵉʳ mars sans un mot.
    assert.equal(parisWallClockFromInput("2026-02-29T19:00"), null);
    assert.ok(parisWallClockFromInput("2024-02-29T19:00"), "2024 est bissextile");
  });
});

describe("champ de date FACULTATIF", () => {
  it("distingue « pas renseigné » de « mal tapé »", () => {
    // Confondre les deux ferait EFFACER une date déjà enregistrée à la première faute
    // de frappe, en silence.
    assert.deepEqual(parisWallClockOptionnelFromInput(""), { cas: "absent" });
    assert.deepEqual(parisWallClockOptionnelFromInput("   "), { cas: "absent" });
    assert.deepEqual(parisWallClockOptionnelFromInput("2026-02-29T19:00"), { cas: "invalide" });
    assert.equal(parisWallClockOptionnelFromInput("2026-08-13T20:30").cas, "ok");
  });
});

/**
 * Les jours-calendriers (2026-08-24) — `played_on` d'une phase.
 *
 * 🔴 CE QUI PEUT ÊTRE FAUX EN SILENCE EST LE DÉCALAGE D'UN CRAN. `jourLisible` construit une
 * `Date` à minuit UTC : sans `timeZone: "UTC"` au formatage, tout fuseau à l'ouest de
 * Greenwich rendrait LA VEILLE. Ça ne se verrait ni à Reims, ni en CI (le conteneur tourne en
 * UTC) — seulement chez quelqu'un d'autre, et sur un week-end de tournoi.
 */
describe("les jours-calendriers d'une phase", () => {
  it("ajoute des jours sans jamais changer de quantième par surprise", () => {
    assert.equal(ajouterJours("2026-09-05", 7), "2026-09-12");
    assert.equal(ajouterJours("2026-09-05", 0), "2026-09-05");
  });

  it("franchit une fin de mois et une fin d'année", () => {
    assert.equal(ajouterJours("2026-10-31", 1), "2026-11-01");
    assert.equal(ajouterJours("2026-12-28", 7), "2027-01-04");
  });

  it("franchit le 29 février d'une année bissextile", () => {
    assert.equal(ajouterJours("2024-02-28", 1), "2024-02-29");
    assert.equal(ajouterJours("2024-02-28", 2), "2024-03-01");
  });

  it("enjambe le passage à l'heure d'hiver sans perdre un jour", () => {
    // 2026-10-25 est le dimanche du changement d'heure. Un calcul en heure LOCALE ferait ici
    // 25 heures dans la journée, et un décalage d'un cran sur la suite.
    assert.equal(ajouterJours("2026-10-24", 1), "2026-10-25");
    assert.equal(ajouterJours("2026-10-24", 2), "2026-10-26");
  });

  it("🔴 se lit au BON jour, quel que soit le fuseau de qui affiche", () => {
    // Le témoin qui compte : à minuit UTC, tout fuseau à l'ouest est encore la veille.
    const original = process.env.TZ;
    try {
      for (const fuseau of ["Europe/Paris", "America/Los_Angeles", "Pacific/Honolulu"]) {
        process.env.TZ = fuseau;
        assert.match(
          jourLisible("2026-09-05"),
          /samedi 5 septembre/,
          `le 5 septembre doit rester le 5 en ${fuseau}`,
        );
      }
    } finally {
      process.env.TZ = original;
    }
  });
});
