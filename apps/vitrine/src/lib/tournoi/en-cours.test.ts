import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { etatDuJour, fusionnerCeQuiSeJoue, type PhaseDuDeroule } from "./en-cours";

// Deux lectures posent la même question (le tableau de bord, la liste publique) et deux
// surfaces s'en servent le même jour. Une préséance qui trancherait à l'envers d'un côté ne
// casserait RIEN : elle ferait juste dire deux choses différentes du même tournoi.

describe("fusionner les deux sources", () => {
  it("le déroulé l'emporte sur la date de début pour un même tournoi", () => {
    const fusion = fusionnerCeQuiSeJoue(
      [{ id: "t1", nom: "TFT", journee: "2026-09-12" }],
      [{ id: "t1", nom: "TFT", jour: "2026-09-06" }],
    );
    assert.deepEqual(fusion, [{ id: "t1", nom: "TFT", journee: "2026-09-12" }]);
  });

  it("ordonne totalement : journée, puis nom, puis identifiant", () => {
    const fusion = fusionnerCeQuiSeJoue(
      [
        { id: "b", nom: "Zelda", journee: "2026-09-06" },
        { id: "a", nom: "Alpha", journee: "2026-09-06" },
      ],
      [{ id: "c", nom: "Bravo", jour: "2026-09-05" }],
    );
    assert.deepEqual(
      fusion.map((t) => t.id),
      ["c", "a", "b"],
    );
  });
});

describe("ce qu'on peut dire d'un tournoi aujourd'hui", () => {
  const PHASE = (p: Partial<PhaseDuDeroule>): PhaseDuDeroule => ({
    name: "Manche 1",
    state: "planifiee",
    playedOn: null,
    ...p,
  });

  it("🔴 une manche « en cours » ne fait PAS parler un tournoi d'un autre jour", () => {
    // DÉFAUT MESURÉ SUR STAGING LE JOUR DU DÉPLOIEMENT, et ce test est né de lui : la règle
    // disait d'abord « une phase en_cours l'emporte sur toute date ». Or `tournoi-tft`
    // commence le 15 septembre 2026 et porte DEUX phases restées `en_cours` — la fiche
    // annonçait « En ce moment » pour un tournoi qui ne se jouait pas.
    // 🔴 La cause est structurelle : RIEN ne referme une phase. Aucun écran ne repasse
    // `en_cours` à `terminee` quand la journée s'achève.
    const etat = etatDuJour(
      [PHASE({ name: "Poule A", state: "en_cours", playedOn: null })],
      "2026-09-15",
      "2026-08-25",
    );
    assert.deepEqual(etat, { nature: "rien" });
  });

  it("le calendrier ouvre la porte, la manche dit de quoi on parle", () => {
    const phases = [PHASE({ name: "Demi-finales", state: "en_cours", playedOn: "2026-09-06" })];
    assert.deepEqual(etatDuJour(phases, "2026-09-06", "2026-09-06"), {
      nature: "manche_en_cours",
      manche: "Demi-finales",
    });
    // Le MÊME état de phase, un autre jour : on se tait.
    assert.deepEqual(etatDuJour(phases, "2026-09-06", "2026-09-07"), { nature: "rien" });
  });

  it("une phase datée d'aujourd'hui suffit à dire que ça se joue", () => {
    const phases = [PHASE({ playedOn: "2026-09-06" }), PHASE({ playedOn: "2026-09-13" })];
    assert.deepEqual(etatDuJour(phases, "2026-09-06", "2026-09-06"), { nature: "aujourd_hui" });
    assert.deepEqual(etatDuJour(phases, "2026-09-06", "2026-09-07"), { nature: "rien" });
  });

  it("🔴 un tournoi de plusieurs week-ends ne s'annonce PAS tous les jours du premier", () => {
    // `starts_at` est le PREMIER jour et le reste à jamais. Sans la condition « aucune phase
    // datée », un TFT de trois samedis se dirait « ça se joue » chaque jour du 6 septembre.
    const phases = [PHASE({ playedOn: "2026-09-12" }), PHASE({ playedOn: "2026-09-19" })];
    assert.deepEqual(etatDuJour(phases, "2026-09-06", "2026-09-06"), { nature: "rien" });
  });

  it("sans aucune phase datée, la date de début décide", () => {
    assert.deepEqual(etatDuJour([], "2026-09-06", "2026-09-06"), { nature: "aujourd_hui" });
    assert.deepEqual(etatDuJour([PHASE({})], "2026-09-06", "2026-09-07"), { nature: "rien" });
  });
});
