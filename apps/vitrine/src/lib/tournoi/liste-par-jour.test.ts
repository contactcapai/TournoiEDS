import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { groupesParJour, lieuSurLaCarte } from "./liste-par-jour";

const PARC = "Parc des expositions de Reims";
const t = (iso: string, venueName: string | null, priceText: string | null = "Gratuit") => ({
  startsAt: new Date(iso),
  venueName,
  priceText,
});

// Une information retirée de la carte doit EXISTER dans le titre du jour : sinon elle disparaît
// de la page sans que personne ne le voie.
describe("liste des tournois groupée par jour", () => {
  it("groupe par jour DE PARIS — un tournoi à 0h30 le dimanche n'est pas du samedi", () => {
    const jours = groupesParJour([
      t("2026-11-21T09:15:00Z", `${PARC} — zone PC`),
      t("2026-11-21T23:30:00Z", `${PARC} — couch`), // dimanche 0h30 à Paris
    ]);
    assert.deepEqual(jours.map((j) => j.jour), ["2026-11-21", "2026-11-22"]);
  });

  it("le lieu et le tarif communs passent dans le titre, la carte garde la précision", () => {
    const [samedi] = groupesParJour([
      t("2026-11-21T09:15:00Z", `${PARC} — stand EDS, zone PC`),
      t("2026-11-21T10:45:00Z", `${PARC} — stands EDS & Mately, 26 PC`),
    ]);
    assert.equal(samedi.lieuCommun, PARC);
    assert.equal(samedi.tarifCommun, "Gratuit");
    assert.equal(lieuSurLaCarte(`${PARC} — stand EDS, zone PC`, PARC), "stand EDS, zone PC");
  });

  it("un seul tournoi différent, et rien n'est mis en commun", () => {
    const [jour] = groupesParJour([
      t("2026-11-21T09:15:00Z", `${PARC} — zone PC`, "Gratuit"),
      t("2026-11-21T10:45:00Z", "En ligne", "5 €"),
    ]);
    assert.equal(jour.lieuCommun, null);
    assert.equal(jour.tarifCommun, null);
    assert.equal(lieuSurLaCarte("En ligne", jour.lieuCommun), "En ligne");
  });

  it("un tarif absent n'est jamais « commun » — on n'annonce pas la gratuité à la place", () => {
    const [jour] = groupesParJour([t("2026-11-21T09:15:00Z", PARC, null), t("2026-11-21T10:45:00Z", PARC, null)]);
    assert.equal(jour.tarifCommun, null);
  });
});
