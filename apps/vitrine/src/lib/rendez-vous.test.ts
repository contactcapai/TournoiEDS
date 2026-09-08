import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { visuelDuRendezVous } from "./rendez-vous";
import type { RendezVous } from "@/server/db/queries/rendez-vous";

// La règle du visuel (Story 15.1) est testée parce que ses DEUX moitiés se trompent sans rien
// casser : lire la colonne de l'autre nature rend « pas d'image » (une carte qui a l'air
// normale), et oublier `is_published` rend un cadre vide vers une URL qui répond 404. Aucune
// des deux ne lève, ne rougit, ni ne se voit là où l'on développe — on y publie tout ce qu'on
// téléverse. Le reste de cette story est du rendu, et l'œil le voit mieux.

const IMAGE = { filename: "a.webp", alt: "Une affiche", isPublished: true, focalX: 30, focalY: 40 };

// ⚠️ Les rendez-vous sont fabriqués au strict nécessaire puis castés : reconstruire un
// `AgendaEvent` complet (dix-huit colonnes plus le bar) ferait un décor de 200 lignes pour
// une fonction qui lit DEUX champs — c'est `pieges/decor-de-test.md`.
const evenementAvec = (visuel: unknown) =>
  ({ nature: "evenement", cle: "e1", startsAt: new Date(), libelle: "Jeudi", evenement: { visuel }, tournois: [] }) as unknown as RendezVous;

const tournoiAvec = (photo: unknown) =>
  ({ nature: "tournoi", cle: "t1", startsAt: new Date(), libelle: "TFT", tournoi: { photo } }) as unknown as RendezVous;

describe("le visuel d'un rendez-vous", () => {
  it("lit `visuel` sur un événement et `photo` sur un tournoi", () => {
    // Les deux colonnes ne portent pas le même nom parce qu'elles sont dans deux tables.
    // Inverser les deux lectures rendrait `undefined` — donc « aucune image », en silence.
    assert.deepEqual(visuelDuRendezVous(evenementAvec(IMAGE)), IMAGE);
    assert.deepEqual(visuelDuRendezVous(tournoiAvec(IMAGE)), IMAGE);
  });

  it("refuse une image dépubliée, sur les deux natures", () => {
    // 🔴 LE CAS QUI JUSTIFIE CE FICHIER. `/medias/[filename]` répond 404 sur un brouillon
    // (garde 6.4), et dépublier ne vide PAS `photo_id` — la carte rendrait donc un cadre vide.
    const depubliee = { ...IMAGE, isPublished: false };
    assert.equal(visuelDuRendezVous(evenementAvec(depubliee)), null);
    assert.equal(visuelDuRendezVous(tournoiAvec(depubliee)), null);
  });

  it("rend `null` quand aucune image n'est choisie — le cas nominal", () => {
    // `null` (ce que rend Drizzle) et `undefined` (un objet reconstruit à la main) doivent
    // donner la même réponse, sans quoi la règle dépendrait de la façon dont on l'appelle.
    assert.equal(visuelDuRendezVous(evenementAvec(null)), null);
    assert.equal(visuelDuRendezVous(evenementAvec(undefined)), null);
    assert.equal(visuelDuRendezVous(tournoiAvec(null)), null);
  });

  it("n'emprunte PAS le visuel d'un tournoi rattaché à l'événement", () => {
    // Un événement qui porte dix animations (Game'in Reims) ne doit pas afficher l'affiche
    // de l'une d'elles : ce serait en désigner une arbitrairement. Même retenue que
    // `destinationDuCta`, qui refuse de choisir quand il y en a plusieurs.
    const evenement = {
      nature: "evenement",
      cle: "e1",
      startsAt: new Date(),
      libelle: "Game'in Reims",
      evenement: { visuel: null },
      tournois: [{ photo: IMAGE }, { photo: IMAGE }],
    } as unknown as RendezVous;
    assert.equal(visuelDuRendezVous(evenement), null);
  });
});
